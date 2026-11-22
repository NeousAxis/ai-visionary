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
import { geocodeCity, distanceKm, type GeoPoint } from './geo';

export type AskWhy = { label: string; matched: boolean; evidence: string | null };

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
    price: string | null;
    audience: string | null;
    /** Coordonnées montrées seulement pour les fiches certifiées. */
    contact: { phone: string | null; email: string | null } | null;
    /** Contact via AYA possible : fiche certifiée avec une adresse vérifiée. */
    can_contact: boolean;
    geo: GeoPoint | null;
    distance_km: number | null;
};

export type AskResponse = {
    q: string;
    understood: { chips: string[]; city: string | null; country: string | null; sector: string | null; source: AskIntent['source'] };
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

function domainOf(website: string | null): string {
    return (website || '').replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
}

/** Toutes les phrases réelles d'une fiche où un critère peut être prouvé. */
function evidencePool(row: AskSearchRow): string[] {
    const p: any = row.asr_payload || {};
    const d = p.data || {};
    return [
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

function findEvidence(pool: string[], terms: string[]): string | null {
    const ts = terms.map(norm).filter((t) => t.length >= 3);
    for (const s of pool) {
        const n = norm(s);
        if (ts.some((t) => n.includes(t))) return cut(s);
    }
    return null;
}

function shape(row: AskSearchRow, intent: AskIntent): AskResult {
    const p: any = row.asr_payload || {};
    const d = p.data || {};
    const pool = evidencePool(row);
    const city = asList(v(d, 'identite', 'city', 'value'))[0] || null;
    const zone = asList(v(d, 'processus_methodes', 'geographies_served', 'value'))[0] || null;
    const description =
        asList(v(p, 'enrichment', 'gemini_description_fr'))[0] ||
        asList(v(d, 'identite', 'description', 'value'))[0] ||
        asList(v(d, 'aio_blocks', 'offre', 'fields', 'meta_description'))[0] ||
        asList(v(d, 'offre', 'services', 'value'))[0] || null;

    const why: AskWhy[] = intent.requirements.map((r) => {
        const evidence = findEvidence(pool, r.terms);
        return { label: r.label, matched: !!evidence, evidence };
    });
    if (intent.city) {
        const c = norm(intent.city);
        const where = [city, zone].filter(Boolean) as string[];
        const ev = where.find((s) => norm(s).includes(c)) || findEvidence(pool, [intent.city]);
        why.push({ label: intent.city, matched: !!ev, evidence: ev ? cut(ev) : null });
    }

    const certified = row.payment_completed === true;
    const phone = certified ? (asList(v(d, 'identite', 'contact_phone', 'value'))[0] || null) : null;
    const email = certified ? (row.contact_email || asList(v(d, 'identite', 'contact_email', 'value'))[0] || null) : null;
    const services = asList(v(d, 'offre', 'services', 'value'));

    return {
        entity_id: row.entity_id,
        name: row.display_name || row.legal_name || domainOf(row.website),
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
        price: asList(v(d, 'offre', 'pricing_indication', 'value'))[0] ? cut(asList(v(d, 'offre', 'pricing_indication', 'value'))[0], 80) : null,
        audience: asList(v(d, 'offre', 'target_audience', 'value'))[0] ? cut(asList(v(d, 'offre', 'target_audience', 'value'))[0], 80) : null,
        contact: certified ? { phone, email } : null,
        can_contact: certified && !!email,
        geo: null,
        distance_km: null,
    };
}

export async function askRegistry(q: string, opts: { limit?: number } = {}): Promise<AskResponse> {
    const intent = await parseAskQuery(q);
    const rows = await localPgAskSearch({
        terms: intent.terms,
        country: intent.country,
        city: intent.city,
        sector: intent.sector,
        limit: 40,
    });

    const shaped = rows.map((r) => shape(r, intent));
    shaped.sort((a, b) =>
        (b.matched_count - a.matched_count) ||
        (Number(b.certified) - Number(a.certified)) ||
        ((b.score ?? 0) - (a.score ?? 0)));

    const results = shaped.slice(0, Math.min(Math.max(opts.limit ?? 10, 1), 20));
    const center = intent.city ? await geocodeCity(intent.city, intent.country) : null;

    await Promise.all(results.map(async (r) => {
        if (!r.city) return;
        r.geo = await geocodeCity(r.city, r.country);
        if (r.geo && center) r.distance_km = Math.round(distanceKm(center, r.geo));
    }));

    const nCriteria = intent.requirements.length + (intent.city ? 1 : 0);
    return {
        q,
        understood: {
            chips: [...intent.requirements.map((r) => r.label), ...(intent.city ? [intent.city] : [])],
            city: intent.city, country: intent.country, sector: intent.sector, source: intent.source,
        },
        center,
        total: rows.length,
        all_criteria: nCriteria > 0 ? shaped.filter((r) => r.matched_count === nCriteria).length : 0,
        results,
    };
}
