// lib/aya/ask/search.ts
//
// Recherche en langage courant dans le registre AYA.
// 1. parseAskQuery traduit la phrase en critères.
// 2. localPgAskSearch trouve les candidates dans tout le registre.
// 3. Pour chaque candidate, chaque critère est vérifié dans les VRAIS champs de
//    la fiche, et la phrase trouvée est renvoyée telle quelle comme preuve.
//    Rien n'est rédigé par le modèle sur l'entreprise.
// 4. Les villes connues sont situées pour la carte.

import { localPgAskSearch, type AskSearchRow } from '@/lib/db-local-pg';
import { parseAskQuery, type AskIntent } from './parse';
import { geocodeCity, distanceKm, isGeocoded, type GeoPoint } from './geo';
import { withSlot } from '@/lib/aya/guard';

/** strong : le mot demandé lui-même figure dans la fiche ; sinon seulement un synonyme. */
export type AskWhy = { label: string; matched: boolean; strong: boolean; evidence: string | null };

/** Racine du mot principal d'un libellé : "Pizzeria" donne "pizzer", "Végétarien" donne "vegetari". */
function stemOf(label: string): string {
    const words = norm(label).split(/[\s'’-]+/).filter((w) => w.length >= 4).sort((a, b) => b.length - a.length);
    const w = words[0] || norm(label);
    return w.length > 6 ? w.slice(0, w.length - 2) : w;
}

export type AskResult = {
    entity_id: string;
    name: string;
    domain: string;
    website: string | null;
    url: string;
    country: string | null;
    sector: string | null;
    score: number | null;
    certified: boolean;
    /** 'riche' quand la fiche contient des services ou une description. */
    detail: 'riche' | 'simple';
    city: string | null;
    zone: string | null;
    description: string | null;
    why: AskWhy[];
    matched_count: number;
    /** Poids des critères prouvés : le premier (le métier demandé) compte double. */
    match_weight: number;
    price: string | null;
    audience: string | null;
    /** Téléphone publié par l'entreprise ; email public seulement pour les fiches certifiées. */
    contact: { phone: string | null; email: string | null } | null;
    /** Contact via AYA possible : fiche certifiée avec une adresse vérifiée. */
    can_contact: boolean;
    geo: GeoPoint | null;
    distance_km: number | null;
};

export type AskResponse = {
    q: string;
    understood: { chips: string[]; city: string | null; country: string | null; sector: string | null; source: AskIntent['source']; terms: string[]; requirements: AskIntent['requirements'] };
    center: GeoPoint | null;
    total: number;
    all_criteria: number;
    results: AskResult[];
};

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

function v(obj: any, ...path: string[]): any {
    let o = obj;
    for (const p of path) { if (o == null) return undefined; o = o[p]; }
    return o;
}

function asList(x: any): string[] {
    if (Array.isArray(x)) return x.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim());
    if (typeof x === 'string' && x.trim()) return [x.trim()];
    return [];
}

function cut(s: string, max = 150): string {
    const t = s.replace(/\s+/g, ' ').trim();
    return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t;
}

function decode(s: string): string {
    return s.replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function domainOf(website: string | null): string {
    return (website || '').replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
}

/**
 * Les fiches ont trois formats selon leur origine :
 * - AYO (diagnostic) et certifiées : asr_payload.data.identite.city.value, etc.
 * - Web Data Commons (FUSION-WDC, MIN3) : asr_payload.city / description / telephone.
 * - Robot AYA-BOT (AYA-PREINDEX) : asr_payload.data.entity.city / contacts, aio_blocks.
 */
function cityOf(p: any): string | null {
    const d = p.data || {};
    return asList(v(d, 'identite', 'city', 'value'))[0]
        || asList(p.city)[0]
        || asList(v(d, 'entity', 'city'))[0]
        || asList(v(p, 'entity', 'city'))[0]
        || asList(v(d, 'aio_blocks', 'identite', 'fields', 'city'))[0]
        || null;
}
function phoneOf(p: any): string | null {
    const d = p.data || {};
    return asList(v(d, 'identite', 'contact_phone', 'value'))[0]
        || asList(p.telephone)[0]
        || asList(v(d, 'entity', 'contacts', 'phone'))[0]
        || asList(v(d, 'aio_blocks', 'identite', 'fields', 'phone'))[0]
        || null;
}

/** Toutes les phrases réelles d'une fiche où un critère peut être prouvé. */
function evidencePool(row: AskSearchRow): string[] {
    const p: any = row.asr_payload || {};
    const d = p.data || {};
    return [
        ...asList(p.description),
        ...asList(v(d, 'source', 'meta_description')),
        ...asList(v(d, 'offre', 'services', 'value')),
        ...asList(v(d, 'offre', 'products', 'value')),
        ...asList(v(d, 'offre', 'use_cases', 'value')),
        ...asList(v(d, 'offre', 'target_audience', 'value')),
        ...asList(v(d, 'offre', 'pricing_indication', 'value')),
        ...asList(v(d, 'processus_methodes', 'geographies_served', 'value')),
        ...asList(v(d, 'processus_methodes', 'process_steps', 'value')),
        ...asList(v(d, 'engagements_conformite', 'certifications', 'value')),
        ...asList(v(d, 'identite', 'description', 'value')),
        ...asList(v(p, 'enrichment', 'gemini_description_fr')),
        ...asList(v(p, 'enrichment', 'gemini_description')),
        ...asList(v(d, 'aio_blocks', 'offre', 'fields', 'meta_description')),
        ...asList(row.display_name), ...asList(row.sector_macro),
    ];
}

/**
 * Une expression est prouvée par une phrase de la fiche quand ses mots utiles
 * y figurent : tous pour 1 ou 2 mots, au moins les deux tiers au-delà.
 */
function phraseIn(text: string, phrase: string): boolean {
    const words = phrase.split(/\s+/).filter((w) => w.length >= 3);
    if (words.length === 0) return false;
    const hits = words.filter((w) => text.includes(w)).length;
    return words.length <= 2 ? hits === words.length : hits >= Math.ceil((words.length * 2) / 3);
}

function findEvidence(pool: string[], terms: string[]): string | null {
    const ts = terms.map(norm).filter((t) => t.length >= 3);
    for (const s of pool) {
        const n = norm(s);
        if (ts.some((t) => phraseIn(n, t))) return cut(s);
    }
    return null;
}

function shape(row: AskSearchRow, intent: AskIntent): AskResult {
    const p: any = row.asr_payload || {};
    const d = p.data || {};
    const pool = evidencePool(row);
    const city = cityOf(p);
    const zone = asList(v(d, 'processus_methodes', 'geographies_served', 'value'))[0] || null;
    const description =
        asList(v(p, 'enrichment', 'gemini_description_fr'))[0] ||
        asList(v(d, 'identite', 'description', 'value'))[0] ||
        asList(p.description)[0] ||
        asList(v(d, 'aio_blocks', 'offre', 'fields', 'meta_description'))[0] ||
        asList(v(d, 'source', 'meta_description'))[0] ||
        asList(v(d, 'offre', 'services', 'value'))[0] || null;

    const why: AskWhy[] = intent.requirements.map((r) => {
        const strongEv = findEvidence(pool, [stemOf(r.label)]);
        const evidence = strongEv || findEvidence(pool, r.terms);
        return { label: r.label, matched: !!evidence, strong: !!strongEv, evidence };
    });
    if (intent.city) {
        const c = norm(intent.city);
        const where = [city, zone].filter(Boolean) as string[];
        const ev = where.find((s) => norm(s).includes(c)) || findEvidence(pool, [intent.city]);
        why.push({ label: intent.city, matched: !!ev, strong: !!ev, evidence: ev ? cut(ev) : null });
    }

    const certified = row.payment_completed === true;
    // Téléphone professionnel publié par l'entreprise (site ou données schema.org) :
    // montré pour toutes les fiches. L'email public, lui, seulement pour les certifiées.
    const phone = phoneOf(p);
    // Adresse PUBLIQUE de la fiche (lue sur le site) uniquement. contact_email du
    // registre est l'adresse de la personne qui a réclamé la fiche : elle ne sert
    // qu'au relais « Contacter via AYA » et n'est jamais montrée.
    const email = certified ? (asList(v(d, 'identite', 'contact_email', 'value'))[0] || null) : null;
    const services = asList(v(d, 'offre', 'services', 'value'));

    return {
        entity_id: row.entity_id,
        name: decode(row.display_name || row.legal_name || domainOf(row.website)),
        domain: domainOf(row.website),
        website: row.website,
        url: `/aya/e/${row.entity_id}`,
        country: row.country_legal,
        sector: row.sector_macro,
        score: row.asr_score != null ? Number(row.asr_score) : null,
        certified,
        detail: services.length > 0 || !!description ? 'riche' : 'simple',
        city,
        zone: zone ? cut(zone, 120) : null,
        description: description ? cut(description, 220) : null,
        why,
        matched_count: why.filter((w) => w.matched).length,
        // Preuve forte = 2, synonyme = 1 ; le premier critère (le métier) compte double.
        match_weight: why.reduce((s, w, i) =>
            s + (w.matched ? (w.strong ? 2 : 1) * (i === 0 && intent.requirements.length > 1 ? 2 : 1) : 0), 0),
        price: asList(v(d, 'offre', 'pricing_indication', 'value'))[0] ? cut(asList(v(d, 'offre', 'pricing_indication', 'value'))[0], 80) : null,
        audience: asList(v(d, 'offre', 'target_audience', 'value'))[0] ? cut(asList(v(d, 'offre', 'target_audience', 'value'))[0], 80) : null,
        contact: phone || email ? { phone, email } : null,
        can_contact: certified && /@/.test(row.contact_email || ''),
        geo: null,
        distance_km: null,
    };
}

export async function askRegistry(q: string, opts: { limit?: number; lang?: 'fr' | 'en' } = {}): Promise<AskResponse> {
    const intent = await parseAskQuery(q, opts.lang ?? 'fr');
    const raw = q.trim().toLowerCase();
    const rows = (await withSlot(() => localPgAskSearch({
        // La phrase brute est aussi cherchée telle quelle : c'est ainsi qu'un nom
        // d'entreprise tapé en entier ("Happy Green Kids") est retrouvé.
        terms: raw.length <= 60 ? [raw, ...intent.terms] : intent.terms,
        country: intent.country,
        city: intent.city,
        sector: intent.sector,
        limit: 100,
    }))) ?? [];

    // Recherche par nom : si la phrase est le nom (ou le domaine) d'une fiche,
    // cette fiche seule répond, sans critères déduits par le modèle.
    const nq = norm(q.trim());
    const byName = rows.filter((r) =>
        norm(decode(r.display_name || '')) === nq || norm(r.legal_name || '') === nq || domainOf(r.website) === nq);
    if (byName.length > 0) {
        const nameIntent: AskIntent = { ...intent, requirements: [], city: null };
        const results = byName.slice(0, 5).map((r) => shape(r, nameIntent));
        await Promise.all(results.map(async (r) => { if (r.city) r.geo = await geocodeCity(r.city, r.country); }));
        return {
            q,
            understood: { chips: [q.trim()], city: null, country: null, sector: null, source: intent.source, terms: [raw], requirements: [] },
            center: null, total: byName.length, all_criteria: byName.length, results,
        };
    }

    // On ne montre que des fiches qui prouvent au moins un critère, et, quand un
    // pays est demandé, celles de ce pays (ou sans pays mais citant le lieu).
    const shaped = rows.map((r) => shape(r, intent)).filter((r) => {
        if (r.matched_count === 0) return false;
        const cityOk = !!intent.city && r.why[r.why.length - 1]?.matched === true;
        const needOk = r.why.some((w) => w.matched && w.label !== intent.city);
        // Le lieu seul ne suffit pas quand la demande précise aussi un besoin.
        if (!needOk && (intent.requirements.length > 0 || !cityOk)) return false;
        if (intent.country && r.country !== intent.country && !cityOk) return false;
        return true;
    });
    shaped.sort((a, b) =>
        (b.match_weight - a.match_weight) ||
        (Number(b.certified) - Number(a.certified)) ||
        ((b.score ?? 0) - (a.score ?? 0)));

    const results = shaped.slice(0, Math.min(Math.max(opts.limit ?? 10, 1), 20));
    const center = intent.city ? await geocodeCity(intent.city, intent.country) : null;

    // Suisse : géocodeur fédéral, sans limite. Ailleurs : 3 nouvelles villes au plus
    // par recherche (Nominatim, une par seconde) ; les suivantes viennent du cache.
    let remoteBudget = 3;
    await Promise.all(results.map(async (r) => {
        if (!r.city) return;
        const ch = (r.country || '').toUpperCase() === 'CH';
        if (!ch && !isGeocoded(r.city, r.country)) {
            if (remoteBudget <= 0) return;
            remoteBudget -= 1;
        }
        r.geo = await geocodeCity(r.city, r.country);
        if (r.geo && center) r.distance_km = Math.round(distanceKm(center, r.geo));
    }));

    const nCriteria = intent.requirements.length + (intent.city ? 1 : 0);
    return {
        q,
        understood: {
            chips: [...intent.requirements.map((r) => r.label), ...(intent.city ? [intent.city] : [])],
            city: intent.city, country: intent.country, sector: intent.sector, source: intent.source,
            terms: intent.terms, requirements: intent.requirements,
        },
        center,
        total: rows.length,
        all_criteria: nCriteria > 0 ? shaped.filter((r) => r.matched_count === nCriteria).length : 0,
        results,
    };
}
