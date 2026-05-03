/**
 * LLM-friendly page content builders for AYA sector and country pages.
 * Produces JSON-LD ItemList (enriched with description), plain entity rows,
 * and FAQ structured data — optimised for RAG/crawler ingestion.
 *
 * Anti-marketing: strips interpretive superlatives before outputting descriptions.
 */

// ─── Anti-marketing filter ────────────────────────────────────────────────────

const MARKETING_RE =
    /\b(leader|leading|best[- ]in[- ]class|premier|top[- ]tier|world[- ]class|award[- ]winning|cutting[- ]edge|state[- ]of[- ]the[- ]art|revolutionary|unparalleled|exceptional|outstanding|premium|unrivaled|most trusted|#1|number one|numero uno)\b/gi;

export function stripMarketing(s: string): string {
    return s.replace(MARKETING_RE, '').replace(/\s{2,}/g, ' ').trim();
}

// ─── Escape HTML ──────────────────────────────────────────────────────────────

export function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ─── Entity description extraction ───────────────────────────────────────────

/**
 * Returns the best 1-2 sentence description for an entity, locale-aware.
 * Priority: gemini_description > services > meta_description > fallback.
 */
export function entityDescription(entity: any, locale: 'en' | 'fr'): string {
    const enrichment = entity.asr_payload?.enrichment || {};
    const raw = entity.asr_payload?.data;
    const asr: any = raw
        ? typeof raw === 'string'
            ? (() => { try { return JSON.parse(raw); } catch { return {}; } })()
            : raw
        : {};

    let desc =
        (locale === 'fr'
            ? enrichment.gemini_description_fr || enrichment.gemini_description || ''
            : enrichment.gemini_description || enrichment.gemini_description_fr || '');

    if (!desc || desc.length < 10) {
        const services: string[] = Array.isArray(asr.offre?.services?.value)
            ? asr.offre.services.value
            : [];
        if (services.length > 0) {
            desc = services.slice(0, 3).join(', ');
        }
    }

    if (!desc || desc.length < 10) {
        desc = asr.identite?.description?.value || asr.source?.meta_description || '';
    }

    if (!desc) return '';

    // Truncate to 200 chars, clean marketing
    desc = stripMarketing(desc.trim());
    if (desc.length > 200) {
        const cut = desc.lastIndexOf(' ', 200);
        desc = (cut > 0 ? desc.slice(0, cut) : desc.slice(0, 200)) + '...';
    }
    if (desc && !desc.endsWith('.') && !desc.endsWith('...')) desc += '.';
    return desc;
}

// ─── Entity name extraction ───────────────────────────────────────────────────

const GENERIC_NAMES = new Set(['Unknown', 'Entity', 'Unknown Entity', 'Entreprise Inconnue', 'Homepage', 'Welcome']);

export function entityDisplayName(entity: any): string {
    const raw = entity.display_name || entity.legal_name || '';
    if (raw && !GENERIC_NAMES.has(raw)) return raw;
    if (entity.website) {
        return entity.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
    }
    return 'Unknown';
}

// ─── JSON-LD ItemList (enriched) ─────────────────────────────────────────────

export interface ItemListJsonLdOptions {
    listName: string;
    listDescription: string;
    listUrl: string;
    entities: any[];
    locale: 'en' | 'fr';
    /** Position offset for pagination (0-based, added to position) */
    offset?: number;
}

/**
 * Build a Schema.org ItemList with Organization items including description.
 * Used server-side; result is serialised into <script type="application/ld+json">.
 */
export function buildItemListJsonLd(opts: ItemListJsonLdOptions): object {
    const { listName, listDescription, listUrl, entities, locale, offset = 0 } = opts;

    const itemListElement = entities.slice(0, 50).map((e: any, i: number) => {
        const name = entityDisplayName(e);
        const desc = entityDescription(e, locale);
        return {
            '@type': 'ListItem',
            position: offset + i + 1,
            item: {
                '@type': 'Organization',
                name,
                ...(e.website ? { url: e.website } : {}),
                ...(desc ? { description: desc } : {}),
            },
        };
    });

    return {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: listName,
        description: listDescription,
        url: listUrl,
        numberOfItems: itemListElement.length,
        itemListElement,
    };
}

// ─── FAQ JSON-LD ─────────────────────────────────────────────────────────────

export interface FaqEntry {
    question: string;
    answer: string;
}

/**
 * Build a Schema.org FAQPage JSON-LD object from a list of Q&A pairs.
 */
export function buildFaqJsonLd(faqs: FaqEntry[]): object {
    return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map(({ question, answer }) => ({
            '@type': 'Question',
            name: question,
            acceptedAnswer: {
                '@type': 'Answer',
                text: answer,
            },
        })),
    };
}

// ─── Sector FAQ builder ───────────────────────────────────────────────────────

const SECTOR_DEFINITIONS: Record<string, { en: string; fr: string }> = {
    'Technology & SaaS': {
        en: 'The Technology & SaaS sector covers companies that develop and distribute software products delivered as cloud services (Software-as-a-Service), as well as hardware and IT infrastructure providers.',
        fr: 'Le secteur Technologie & SaaS regroupe les entreprises qui développent et distribuent des logiciels en mode cloud (Software-as-a-Service), ainsi que les fournisseurs de matériel et d\'infrastructure informatique.',
    },
    'Finance & Insurance': {
        en: 'The Finance & Insurance sector includes banks, insurance companies, investment firms, fintech startups, and other organisations that manage money, risk, and financial assets.',
        fr: 'Le secteur Finance & Assurance inclut les banques, compagnies d\'assurance, sociétés d\'investissement, fintechs et autres organisations gérant l\'argent, le risque et les actifs financiers.',
    },
    'Healthcare & Pharma': {
        en: 'The Healthcare & Pharma sector covers hospitals, clinics, pharmaceutical manufacturers, biotech firms, and medical device companies focused on human health and life sciences.',
        fr: 'Le secteur Santé & Pharma couvre les hôpitaux, cliniques, fabricants pharmaceutiques, biotechs et fabricants de dispositifs médicaux axés sur la santé humaine et les sciences de la vie.',
    },
    'Consulting & Services': {
        en: 'The Consulting & Services sector includes management consultancies, professional service firms, and outsourcing providers that deliver expert advisory and execution services to businesses.',
        fr: 'Le secteur Conseil & Services inclut les cabinets de conseil en management, les sociétés de services professionnels et les prestataires d\'externalisation offrant expertise et exécution aux entreprises.',
    },
    'Retail & E-commerce': {
        en: 'The Retail & E-commerce sector covers companies that sell goods directly to consumers, whether through physical stores, online platforms, or both.',
        fr: 'Le secteur Commerce & Retail regroupe les entreprises vendant des biens directement aux consommateurs, via des magasins physiques, des plateformes en ligne ou les deux.',
    },
    'Education & Training': {
        en: 'The Education & Training sector includes schools, universities, online learning platforms, corporate training providers, and ed-tech companies focused on knowledge transfer.',
        fr: 'Le secteur Éducation & Formation inclut les écoles, universités, plateformes d\'apprentissage en ligne, organismes de formation professionnelle et ed-techs centrés sur la transmission de connaissances.',
    },
    'Artificial Intelligence': {
        en: 'The Artificial Intelligence sector covers companies building AI models, tools, and applications — including machine learning, natural language processing, computer vision, and AI-powered products.',
        fr: 'Le secteur Intelligence Artificielle regroupe les entreprises développant des modèles, outils et applications IA — notamment le machine learning, le traitement du langage naturel, la vision par ordinateur et les produits propulsés par l\'IA.',
    },
    'Media & Communication': {
        en: 'The Media & Communication sector includes news organisations, publishers, advertising agencies, PR firms, and digital content platforms.',
        fr: 'Le secteur Média & Communication inclut les agences de presse, éditeurs, agences de publicité, cabinets de relations publiques et plateformes de contenu numérique.',
    },
    'Energy & Environment': {
        en: 'The Energy & Environment sector covers energy producers and distributors, renewable energy companies, environmental services firms, and cleantech innovators.',
        fr: 'Le secteur Énergie & Environnement couvre les producteurs et distributeurs d\'énergie, les entreprises d\'énergies renouvelables, les sociétés de services environnementaux et les innovateurs cleantech.',
    },
    'Real Estate & Construction': {
        en: 'The Real Estate & Construction sector includes property developers, construction companies, architecture firms, and real estate agents.',
        fr: 'Le secteur Immobilier & Construction inclut les promoteurs immobiliers, entreprises de construction, cabinets d\'architecture et agents immobiliers.',
    },
    'Transport & Logistics': {
        en: 'The Transport & Logistics sector covers freight carriers, shipping companies, logistics providers, and mobility platforms that move goods and people.',
        fr: 'Le secteur Transport & Logistique couvre les transporteurs de fret, compagnies maritimes, prestataires logistiques et plateformes de mobilité qui déplacent marchandises et personnes.',
    },
    'Blockchain & Web3': {
        en: 'The Blockchain & Web3 sector includes cryptocurrency exchanges, decentralised finance (DeFi) protocols, NFT platforms, and companies building on blockchain infrastructure.',
        fr: 'Le secteur Blockchain & Web3 inclut les exchanges de cryptomonnaies, protocoles de finance décentralisée (DeFi), plateformes NFT et entreprises développant sur des infrastructures blockchain.',
    },
};

const SECTOR_DEFINITIONS_FALLBACK = {
    en: (sector: string) =>
        `The ${sector} sector covers companies operating in ${sector.toLowerCase()}-related fields.`,
    fr: (sector: string) =>
        `Le secteur ${sector} regroupe les entreprises opérant dans les domaines liés au ${sector.toLowerCase()}.`,
};

export function buildSectorFaqs(opts: {
    sectorLabel: string;
    total: number;
    topNames: string[];
    locale: 'en' | 'fr';
}): FaqEntry[] {
    const { sectorLabel, total, topNames, locale } = opts;
    const defObj = SECTOR_DEFINITIONS[sectorLabel];
    const def = defObj
        ? defObj[locale]
        : SECTOR_DEFINITIONS_FALLBACK[locale](sectorLabel);

    const namesSample = topNames.slice(0, 5).join(', ');

    if (locale === 'fr') {
        return [
            {
                question: `Qu'est-ce que le secteur ${sectorLabel} ?`,
                answer: def,
            },
            {
                question: `Quelles entreprises sont indexées dans le secteur ${sectorLabel} dans AYA ?`,
                answer: namesSample
                    ? `Parmi les entreprises indexées dans le secteur ${sectorLabel} : ${namesSample}. Le registre AYA en compte ${total} au total dans ce secteur.`
                    : `Le registre AYA indexe ${total} entreprises dans le secteur ${sectorLabel}.`,
            },
            {
                question: `Combien d'entreprises du secteur ${sectorLabel} sont dans le registre AYA ?`,
                answer: `Le registre AYA indexe actuellement ${total} entreprises dans le secteur ${sectorLabel}.`,
            },
            {
                question: 'Qu\'est-ce que le registre AYA ?',
                answer: 'AYA est un index public structuré d\'entreprises, conçu pour la lisibilité par les IA. Les données sont générées automatiquement à partir de sources publiques et vérifiées par score AIO.',
            },
        ];
    }

    return [
        {
            question: `What is the ${sectorLabel} sector?`,
            answer: def,
        },
        {
            question: `Which ${sectorLabel} companies are indexed in AYA?`,
            answer: namesSample
                ? `Among the ${sectorLabel} companies indexed in AYA: ${namesSample}. The AYA registry counts ${total} companies in this sector in total.`
                : `The AYA registry indexes ${total} companies in the ${sectorLabel} sector.`,
        },
        {
            question: `How many ${sectorLabel} companies are in the AYA registry?`,
            answer: `The AYA registry currently indexes ${total} companies in the ${sectorLabel} sector.`,
        },
        {
            question: 'What is the AYA registry?',
            answer: 'AYA is a structured public index of companies, built for AI readability. Data is automatically generated from public sources and verified by AIO score.',
        },
    ];
}

// ─── Country FAQ builder ──────────────────────────────────────────────────────

export function buildCountryFaqs(opts: {
    countryLabel: string;
    total: number;
    topNames: string[];
    topSectors: string[];
    locale: 'en' | 'fr';
}): FaqEntry[] {
    const { countryLabel, total, topNames, topSectors, locale } = opts;
    const namesSample = topNames.slice(0, 5).join(', ');
    const sectorSample = topSectors.slice(0, 3).join(', ');

    if (locale === 'fr') {
        return [
            {
                question: `Quelles entreprises sont indexées en ${countryLabel} dans AYA ?`,
                answer: namesSample
                    ? `Parmi les entreprises indexées en ${countryLabel} : ${namesSample}. Le registre AYA en compte ${total} au total.`
                    : `Le registre AYA indexe ${total} entreprises basées en ${countryLabel}.`,
            },
            {
                question: `Combien d'entreprises sont indexées en ${countryLabel} dans le registre AYA ?`,
                answer: `Le registre AYA indexe actuellement ${total} entreprises basées en ${countryLabel}.`,
            },
            {
                question: `Dans quels secteurs opèrent les entreprises indexées en ${countryLabel} ?`,
                answer: sectorSample
                    ? `Les secteurs les plus représentés pour les entreprises de ${countryLabel} dans AYA sont : ${sectorSample}.`
                    : `Le registre AYA couvre plusieurs secteurs pour les entreprises de ${countryLabel}.`,
            },
            {
                question: 'Qu\'est-ce que le registre AYA ?',
                answer: 'AYA est un index public structuré d\'entreprises, conçu pour la lisibilité par les IA. Les données sont générées automatiquement à partir de sources publiques et vérifiées par score AIO.',
            },
        ];
    }

    return [
        {
            question: `Which companies based in ${countryLabel} are indexed in AYA?`,
            answer: namesSample
                ? `Among the companies based in ${countryLabel} indexed in AYA: ${namesSample}. The AYA registry counts ${total} companies from ${countryLabel} in total.`
                : `The AYA registry indexes ${total} companies based in ${countryLabel}.`,
        },
        {
            question: `How many companies from ${countryLabel} are in the AYA registry?`,
            answer: `The AYA registry currently indexes ${total} companies based in ${countryLabel}.`,
        },
        {
            question: `What sectors are represented among ${countryLabel} companies in AYA?`,
            answer: sectorSample
                ? `The most represented sectors for ${countryLabel} companies in AYA are: ${sectorSample}.`
                : `The AYA registry covers multiple sectors for companies based in ${countryLabel}.`,
        },
        {
            question: 'What is the AYA registry?',
            answer: 'AYA is a structured public index of companies, built for AI readability. Data is automatically generated from public sources and verified by AIO score.',
        },
    ];
}

// ─── Top sectors extractor ────────────────────────────────────────────────────

/**
 * Returns the top N sector labels (by frequency) from a list of entities.
 */
export function topSectorsFromEntities(
    entities: any[],
    sectorLabels: Record<string, string>,
    locale: 'en' | 'fr',
    n = 3,
): string[] {
    const counts: Record<string, number> = {};
    for (const e of entities) {
        if (!e.sector_macro) continue;
        const label = locale === 'en' ? (sectorLabels[e.sector_macro] || e.sector_macro) : e.sector_macro;
        counts[label] = (counts[label] || 0) + 1;
    }
    return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([label]) => label);
}
