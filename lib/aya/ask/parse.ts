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

// Mots trop vagues pour prouver quoi que ce soit ("service" trouve "Conseil &
// Services Pro") : jamais utilisés comme mots de recherche ni comme preuve.
const GENERIC = new Set([
    'service', 'services', 'solution', 'solutions', 'entreprise', 'entreprises', 'company', 'companies',
    'business', 'local', 'locale', 'locaux', 'professionnel', 'professionnels', 'professional', 'qualité',
    'quality', 'offre', 'offres', 'produit', 'produits', 'product', 'products', 'client', 'clients',
    'customer', 'customers', 'online', 'ligne', 'site', 'web', 'meilleur', 'best', 'pro', 'expert', 'experts',
]);
const notGeneric = (t: string) => !t.split(/\s+/).every((w) => GENERIC.has(w));

const SYSTEM = `Tu transformes une demande de recherche d'entreprise en critères JSON.
Réponds UNIQUEMENT avec un objet JSON de cette forme :
{"requirements":[{"label":"...","terms":["...","..."]}],"city":null,"country":null,"sector":null,"terms":["..."]}
Règles :
- requirements : un élément par idée distincte de la demande (au plus 5). Exemple : "repas faits maison livrés au bureau, végétarien" = 3 besoins ("Fait maison", "Livraison au bureau", "Végétarien"). "label" = 1 à 3 mots repris de la demande elle-même (ex. "Association", "Énergie", "Végétarien"), avec majuscule initiale. "terms" = 3 à 6 mots ou expressions de 1 ou 2 mots, en minuscules, qu'une fiche d'entreprise contiendrait si elle remplit ce besoin (synonymes français ET anglais, formes avec et sans accents). Jamais la ville dans terms.
- N'ajoute AUCUN besoin absent de la demande. Le type d'entreprise demandé (restaurant, avocat, menuisier...) est lui-même un besoin.
- La ville ou la région (ex. "Lausanne", "Vaud", "Suisse romande") ne va PAS dans requirements : mets-la dans "city" telle qu'écrite.
- country : code ISO à 2 lettres si la demande ou la ville l'indique clairement (Lausanne, Genève, Zurich = "CH"), sinon null.
- sector : exactement une valeur de cette liste si la demande en relève clairement, sinon null : ${REGISTRY_SECTORS.join(' | ')}.
- terms : 4 à 10 mots SEULS (un mot chacun, minuscules, sans la ville) pour trouver des candidates, le métier d'abord (ex. "traiteur", "restaurant", "catering", "repas").
- N'invente aucun nom d'entreprise.`;

const deaccent = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '');

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

export async function parseAskQuery(q: string, lang: 'fr' | 'en' = 'fr'): Promise<AskIntent> {
    const query = q.trim().slice(0, 300);
    if (!query) return fallbackIntent('');
    try {
        const res = await llmJson({
            system: `${SYSTEM}\n- Écris chaque "label" en ${lang === 'en' ? 'ANGLAIS' : 'FRANÇAIS'}.`,
            prompt: query,
            temperature: 0,
            maxTokens: 600,
            timeoutMs: 9_000,
        });
        const raw = JSON.parse(res.text) as Record<string, unknown>;
        // La ville telle qu'écrite dans la phrase : le modèle la traduit parfois
        // ("Geneva" pour "Genève"), ce qui empêche de la retrouver dans les fiches.
        let city = clean(raw.city, 60) || null;
        if (city) {
            const head = deaccent(city.toLowerCase()).slice(0, 4);
            const word = query.split(/[\s,;.!?]+/).find((w) => w.length >= 3 && deaccent(w.toLowerCase()).replace(/^[ld]'/, '').startsWith(head));
            if (word) city = word.replace(/^[lLdD]'/, '');
        }
        // La ville est un critère à part : on la retire des mots des autres critères.
        const cityWords = new Set((city || '').toLowerCase().split(/[\s,'-]+/).filter(Boolean));
        const stripCity = (t: string) => t.split(/\s+/).filter((w) => !cityWords.has(w)).join(' ').trim();
        const requirements: AskRequirement[] = (Array.isArray(raw.requirements) ? raw.requirements : [])
            .slice(0, 5)
            .map((r: any) => ({
                label: clean(r?.label, 40),
                terms: Array.from(new Set((Array.isArray(r?.terms) ? r.terms : [])
                    .map((t: unknown) => stripCity(clean(t, 40).toLowerCase()))
                    .filter((t: string) => t.length >= 3 && notGeneric(t)))).slice(0, 6) as string[],
            }))
            .filter((r) => r.label && r.terms.length > 0);
        // Garde-fou : un critère doit venir de la demande. Ceux que le modèle
        // ajoute de lui-même (aucun de leurs mots dans la phrase) sont retirés.
        const nq = deaccent(query.toLowerCase());
        // Seul le LIBELLÉ compte : un synonyme présent dans la phrase ne suffit pas
        // à justifier un critère inventé ("Traiteur" pour "repas faits maison").
        const fromQuery = (r: AskRequirement) =>
            deaccent(r.label.toLowerCase()).split(/[\s'’-]+/)
                .some((w) => w.length >= 4 && nq.includes(w.slice(0, Math.max(4, w.length - 2))));
        // Un critère qui reprend le lieu ("Proximité Morges") fait doublon avec la ville.
        const notPlace = (r: AskRequirement) => !deaccent(r.label.toLowerCase()).split(/[\s'’-]+/)
            .some((w) => cityWords.has(w) || [...cityWords].some((c) => deaccent(c) === w));
        const kept = requirements.filter((r) => fromQuery(r) && notPlace(r));
        if (kept.length === 0) {
            for (const w of fallbackIntent(query).terms.filter((x) => !cityWords.has(x)).slice(0, 3)) {
                kept.push({ label: w.charAt(0).toUpperCase() + w.slice(1), terms: [w] });
            }
        }
        requirements.splice(0, requirements.length, ...kept);
        const countryRaw = clean(raw.country, 2).toUpperCase();
        // Le pays ne filtre que si la phrase cite un lieu : le modèle ne doit pas
        // déduire un pays de ce qu'il sait d'une entreprise ("Infomaniak" seul).
        const placeInQuery = !!city || /\b(suisse|switzerland|schweiz|svizzera|france|allemagne|germany|deutschland|italie|italy|espagne|spain|belgique|belgium|autriche|austria|luxembourg|royaume-uni|uk|usa|états-unis|etats-unis|canada|portugal|pays-bas|netherlands)\b/i.test(query);
        const country = placeInQuery && /^[A-Z]{2}$/.test(countryRaw) ? countryRaw : null;
        const sectorRaw = clean(raw.sector, 60);
        const sector = REGISTRY_SECTORS.includes(sectorRaw) ? sectorRaw : null;
        // Recherche des candidates : des mots seuls, sans mots vides ni ville.
        const terms = Array.from(new Set([
            ...(Array.isArray(raw.terms) ? raw.terms : []).map((t: unknown) => clean(t, 40).toLowerCase()),
            ...requirements.flatMap((r) => r.terms),
        ].flatMap((t) => t.split(/[\s,]+/))
            .filter((w) => w.length >= 4 && !STOP_WORDS.has(w) && !cityWords.has(w) && !GENERIC.has(w)))).slice(0, 12);
        if (terms.length === 0 && !city) return fallbackIntent(query);
        return { terms, requirements, city, country, sector, source: 'llm' };
    } catch (err) {
        console.warn('[aya/ask] parse fallback:', (err as Error)?.message);
        return fallbackIntent(query);
    }
}
