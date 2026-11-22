// lib/aya/ask/memindex.ts
//
// Index de recherche en mémoire du registre AYA.
//
// Chercher dans tout le texte des fiches avec SQL obligeait Postgres à convertir
// chaque fiche complète en texte à chaque recherche (jusqu'à 6 s et plus sur la
// production). Ici, le texte utile de chaque fiche (nom, domaine, secteur, ville,
// descriptions, offre) est chargé une fois, en minuscules et sans accents, puis
// gardé en mémoire et rafraîchi toutes les 6 heures. Une recherche le parcourt en
// quelques dizaines de millisecondes. Aucune modification de la base.
//
// Tant que l'index n'est pas prêt (premières minutes après un redémarrage),
// search.ts retombe sur la recherche SQL.

import { localPgScanSearchDocs } from '@/lib/db-local-pg';

type Index = {
    ids: string[];
    docs: string[];
    country: string[];
    sector: string[];
    certified: Uint8Array;
    score: Float32Array;
    builtAt: number;
};

const REFRESH_MS = 6 * 3600 * 1000;
const BATCH = 20_000;
let current: Index | null = null;
let building: Promise<void> | null = null;

export const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

async function build(): Promise<void> {
    const t0 = Date.now();
    const ids: string[] = [], docs: string[] = [], country: string[] = [], sector: string[] = [];
    const cert: number[] = [], score: number[] = [];
    let after: string | null = null;
    for (;;) {
        const rows = await localPgScanSearchDocs(after, BATCH);
        for (const r of rows) {
            ids.push(r.entity_id);
            docs.push(fold(r.doc || ''));
            country.push((r.country_legal || '').toUpperCase());
            sector.push(r.sector_macro || '');
            cert.push(r.payment_completed ? 1 : 0);
            score.push(Number(r.asr_score) || 0);
        }
        if (rows.length < BATCH) break;
        after = rows[rows.length - 1].entity_id;
        await new Promise((res) => setTimeout(res, 150)); // ménage la base entre deux tranches
    }
    current = { ids, docs, country, sector, certified: Uint8Array.from(cert), score: Float32Array.from(score), builtAt: Date.now() };
    console.warn(`[aya/memindex] ${ids.length} fiches indexées en ${Math.round((Date.now() - t0) / 1000)} s`);
}

/** Lance (ou relance si périmé) la construction en arrière-plan ; ne bloque jamais. */
export function ensureIndex(): void {
    const stale = !current || Date.now() - current.builtAt > REFRESH_MS;
    if (!stale || building) return;
    building = build()
        .catch((err) => console.error('[aya/memindex] build failed:', (err as Error)?.message))
        .finally(() => { building = null; });
}

export function indexReady(): boolean {
    return !!current;
}

export type MemHit = { id: string; score: number };

/**
 * Même classement que la recherche SQL : chaque terme trouvé rapporte des
 * points, la ville demandée beaucoup, puis le secteur, la certification.
 * Pays demandé : ce pays, ou une fiche sans pays qui cite le lieu.
 */
export function memSearch(p: { terms: string[]; city: string | null; country: string | null; sector: string | null; limit: number }): MemHit[] | null {
    const ix = current;
    if (!ix) return null;
    const terms = Array.from(new Set(p.terms.map(fold).filter((t) => t.length >= 3))).slice(0, 12);
    const city = p.city ? fold(p.city) : null;
    if (terms.length === 0 && !city) return [];
    const cc = p.country && /^[A-Za-z]{2}$/.test(p.country) ? p.country.toUpperCase() : null;

    const hits: MemHit[] = [];
    for (let i = 0; i < ix.docs.length; i++) {
        const d = ix.docs[i];
        let s = 0;
        let any = false;
        for (const t of terms) if (d.includes(t)) { s += 2; any = true; }
        const cityHit = !!city && d.includes(city);
        if (!any && !cityHit) continue;
        if (cc && ix.country[i] !== cc && !((ix.country[i] === '' || ix.country[i] === 'XX') && cityHit)) continue;
        // Le lieu demandé pèse plus que plusieurs synonymes réunis.
        if (cityHit) s += 10;
        if (p.sector && ix.sector[i] === p.sector) s += 2;
        if (ix.certified[i]) s += 3;
        hits.push({ id: ix.ids[i], score: s + ix.score[i] / 1000 });
    }
    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, p.limit);
}
