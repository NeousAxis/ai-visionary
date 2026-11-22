// lib/aya/ask/parse.ts
//
// Comprend une demande écrite en langage courant ("des repas faits maison livrés
// au bureau à Lausanne") et la transforme en critères de recherche.
//
// Le modèle (Infomaniak, hébergé en Suisse) ne fait que reformuler la DEMANDE
// du visiteur. Il n'invente jamais rien sur les entreprises : les preuves
// affichées viennent toujours des fiches du registre (voir search.ts).
// S'il est lent ou indisponible, un découpage par mots prend le relais.

import { llmJson } from '@/lib/llm-provider';

export type AskRequirement = {
    /** Libellé court montré au visiteur, dans sa langue ("Végétarien"). */
    label: string;
    /** Mots à retrouver dans une fiche pour considérer le critère rempli. */
    terms: string[];
};

export type AskIntent = {
    /** Tous les mots utiles pour trouver des candidates dans le registre. */
    terms: string[];
    /** Les critères de la demande, un par besoin exprimé. */
    requirements: AskRequirement[];
    /** Ville ou région demandée, telle qu'écrite par le visiteur. */
    city: string | null;
    /** Pays (ISO 2 lettres) quand la demande le dit ou que la ville l'implique. */
    country: string | null;
    /** Un des macro-secteurs du registre, si la demande en relève clairement. */
    sector: string | null;
    /** 'llm' quand le modèle a répondu, 'mots' pour le découpage de secours. */
    source: 'llm' | 'mots';
};

export const REGISTRY_SECTORS = [
    'Conseil & Services Pro', 'Santé & Pharma', 'Technologie & SaaS',
    'Industrie & Manufacturing', 'Média & Communication', 'Tourisme & Transport',
    'E-commerce & Retail', 'Immobilier', 'Luxe & Mode', 'Éducation & Formation',
    'Finance & Banque', 'Restauration & Alimentation', 'Administration & Public',
];

const STOP_WORDS = new Set([
    'le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'en', 'à', 'a', 'au', 'aux',
    'dans', 'pour', 'sur', 'par', 'avec', 'qui', 'que', 'est', 'sont', 'je', 'nous', 'on',
    'cherche', 'cherchons', 'trouver', 'une', 'entreprise', 'société', 'mon', 'ma', 'mes',
    'the', 'of', 'in', 'and', 'for', 'on', 'at', 'to', 'is', 'an', 'with', 'looking', 'find',
    'company', 'my', 'we', 'need', 'des', 'chez', 'près', 'pres', 'vers', 'ou', 'or',
]);

const SYSTEM = `Tu transformes une demande de recherche d'entreprise en critères JSON.
Réponds UNIQUEMENT avec un objet JSON de cette forme :
{"requirements":[{"label":"...","terms":["...","..."]}],"city":null,"country":null,"sector":null,"terms":["..."]}
Règles :
- requirements : un élément par besoin exprimé (au plus 5). "label" = 1 à 4 mots dans la langue de la demande, avec majuscule initiale. "terms" = 2 à 6 mots ou expressions courtes, en minuscules, qu'une fiche d'entreprise contiendrait si elle remplit ce besoin (synonymes français ET anglais, formes avec et sans accents).
- La ville ou la région ne va PAS dans requirements : mets-la dans "city" telle qu'écrite.
- country : code ISO à 2 lettres si la demande ou la ville l'indique clairement (Lausanne, Genève, Zurich = "CH"), sinon null.
- sector : exactement une valeur de cette liste si la demande en relève clairement, sinon null : ${REGISTRY_SECTORS.join(' | ')}.
- terms : 4 à 10 mots-clés courts (minuscules) pour trouver des candidates, métier d'abord (ex. "traiteur", "restaurant", "catering", "repas").
- N'invente aucun nom d'entreprise.`;

function clean(s: unknown, max = 60): string {
    return typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function fallbackIntent(q: string): AskIntent {
    const words = q
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
        .split(/\s+/)
        .map((w) => w.replace(/^[ld]'/, ''))
        .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
    const uniq = Array.from(new Set(words)).slice(0, 8);
    return {
        terms: uniq,
        requirements: uniq.slice(0, 5).map((w) => ({ label: w.charAt(0).toUpperCase() + w.slice(1), terms: [w] })),
        city: null,
        country: null,
        sector: null,
        source: 'mots',
    };
}

export async function parseAskQuery(q: string): Promise<AskIntent> {
    const query = q.trim().slice(0, 300);
    if (!query) return fallbackIntent('');
    try {
        const res = await llmJson({
            system: SYSTEM,
            prompt: query,
            temperature: 0,
            maxTokens: 600,
            timeoutMs: 9_000,
        });
        const raw = JSON.parse(res.text) as Record<string, unknown>;
        const requirements: AskRequirement[] = (Array.isArray(raw.requirements) ? raw.requirements : [])
            .slice(0, 5)
            .map((r: any) => ({
                label: clean(r?.label, 40),
                terms: (Array.isArray(r?.terms) ? r.terms : []).map((t: unknown) => clean(t, 40).toLowerCase()).filter((t: string) => t.length >= 3).slice(0, 6),
            }))
            .filter((r) => r.label && r.terms.length > 0);
        const city = clean(raw.city, 60) || null;
        const countryRaw = clean(raw.country, 2).toUpperCase();
        const country = /^[A-Z]{2}$/.test(countryRaw) ? countryRaw : null;
        const sectorRaw = clean(raw.sector, 60);
        const sector = REGISTRY_SECTORS.includes(sectorRaw) ? sectorRaw : null;
        const terms = Array.from(new Set([
            ...(Array.isArray(raw.terms) ? raw.terms : []).map((t: unknown) => clean(t, 40).toLowerCase()),
            ...requirements.flatMap((r) => r.terms),
        ])).filter((t) => t.length >= 3).slice(0, 10);
        if (terms.length === 0 && !city) return fallbackIntent(query);
        return { terms, requirements, city, country, sector, source: 'llm' };
    } catch (err) {
        console.warn('[aya/ask] parse fallback:', (err as Error)?.message);
        return fallbackIntent(query);
    }
}
