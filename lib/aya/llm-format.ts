/**
 * LLM-friendly format utilities for AYA entities.
 * Shared by: /api/aya/llm/[domain], certificate page, GitHub export.
 */

// ─── Types ───────────────────────────────────────────────────
export interface LlmSummary {
    name: string;
    what_it_does: string;
    for_who: string;
    category: string;
    location: string;
}

// ─── Mappings ────────────────────────────────────────────────
export const COUNTRY_LABELS: Record<string, string> = {
    CH: 'Switzerland', FR: 'France', DE: 'Germany', US: 'United States',
    GB: 'United Kingdom', IT: 'Italy', ES: 'Spain', NL: 'Netherlands',
    BE: 'Belgium', AT: 'Austria', LU: 'Luxembourg', CA: 'Canada',
    AU: 'Australia', JP: 'Japan', KR: 'South Korea', CN: 'China',
    SG: 'Singapore', HK: 'Hong Kong', IN: 'India', BR: 'Brazil',
    SE: 'Sweden', NO: 'Norway', DK: 'Denmark', FI: 'Finland',
    IE: 'Ireland', PT: 'Portugal', PL: 'Poland', CZ: 'Czech Republic',
    IL: 'Israel', AE: 'United Arab Emirates', SA: 'Saudi Arabia',
    RU: 'Russia', MX: 'Mexico', AR: 'Argentina', ZA: 'South Africa',
    MA: 'Morocco', TH: 'Thailand', VN: 'Vietnam', ID: 'Indonesia',
    TW: 'Taiwan', PH: 'Philippines', NZ: 'New Zealand', RO: 'Romania',
    UA: 'Ukraine', TR: 'Turkey', EE: 'Estonia', LT: 'Lithuania',
    LV: 'Latvia', HR: 'Croatia', BG: 'Bulgaria', GR: 'Greece',
    KY: 'Cayman Islands', PA: 'Panama', BM: 'Bermuda',
};

export const SECTOR_LABELS: Record<string, string> = {
    'Technologie & SaaS': 'Technology & SaaS',
    'Finance & Assurance': 'Finance & Insurance',
    'Santé & Pharma': 'Healthcare & Pharma',
    'Alimentation & Boissons': 'Food & Beverage',
    'Commerce & Retail': 'Retail & E-commerce',
    'Éducation & Formation': 'Education & Training',
    'Énergie & Environnement': 'Energy & Environment',
    'Consulting & Services': 'Consulting & Services',
    'Média & Communication': 'Media & Communication',
    'Transport & Logistique': 'Transport & Logistics',
    'Industrie & Manufacture': 'Industry & Manufacturing',
    'Immobilier & Construction': 'Real Estate & Construction',
    'Télécommunications': 'Telecommunications',
    'Administration & Gouvernement': 'Government & Public Sector',
    'ONG & Associations': 'Non-profit & NGO',
    'Loisirs & Tourisme': 'Leisure & Tourism',
    'Blockchain & Web3': 'Blockchain & Web3',
    'Intelligence Artificielle': 'Artificial Intelligence',
    'General': 'General',
};

const SECTOR_AUDIENCE_FALLBACK: Record<string, string> = {
    'Technology & SaaS': 'Businesses and developers.',
    'Finance & Insurance': 'Financial institutions and consumers.',
    'Healthcare & Pharma': 'Healthcare professionals and patients.',
    'Retail & E-commerce': 'Consumers and retail businesses.',
    'Education & Training': 'Students, educators, and institutions.',
    'Consulting & Services': 'Businesses seeking expert guidance.',
    'Media & Communication': 'Media professionals and audiences.',
    'Blockchain & Web3': 'Web3 developers and crypto communities.',
    'Artificial Intelligence': 'AI researchers and enterprise teams.',
};

// ─── Helpers ─────────────────────────────────────────────────
function extractAsrData(entity: any): any {
    const raw = entity.asr_payload?.data;
    if (!raw) return {};
    if (typeof raw === 'string') {
        try { return JSON.parse(raw); } catch { return {}; }
    }
    return raw;
}

function cleanText(s: string): string {
    return s.replace(/\s+/g, ' ').replace(/["""]/g, '').trim();
}

function truncate(s: string, max: number): string {
    if (s.length <= max) return s;
    const cut = s.lastIndexOf(' ', max);
    return (cut > 0 ? s.slice(0, cut) : s.slice(0, max)) + '...';
}

function domainFromUrl(url: string): string {
    try {
        return url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
    } catch {
        return url;
    }
}

// ─── Garbage filter ──────────────────────────────────────────
// These words are detected by the bot scraper from HTML tags/meta and are NOT real services
const GARBAGE_SERVICES = new Set([
    // HTML/tech noise
    'api', 'app', 'application', 'cloud', 'service', 'services', 'platform',
    'solution', 'solutions', 'product', 'products', 'tool', 'tools',
    'software', 'website', 'web', 'online', 'digital', 'data', 'system',
    'technology', 'tech', 'information', 'management', 'support',
    // Navigation noise
    'login', 'contact', 'about', 'home', 'privacy', 'terms', 'blog',
    'news', 'press', 'media', 'resources', 'help', 'faq', 'careers',
    'jobs', 'pricing', 'features', 'enterprise', 'business', 'company',
    // Generic noise
    'delivery', 'conditions', 'compliance', 'security', 'analytics',
    'integration', 'mobile', 'desktop', 'download', 'sign', 'register',
    'restaurant', 'hotel', 'shop', 'store', 'market', 'group', 'global',
    'network', 'portal', 'hub', 'center', 'centre', 'agency', 'office',
    'consulting', 'advisory', 'search', 'find', 'explore', 'discover',
    'share', 'connect', 'create', 'build', 'learn', 'start', 'join',
    'subscribe', 'free', 'premium', 'pro', 'plus', 'basic', 'standard',
    'account', 'profile', 'dashboard', 'settings', 'menu', 'navigation',
    'content', 'access', 'customer', 'clients', 'partner', 'partners',
    'community', 'forum', 'feedback', 'review', 'reviews', 'rating',
    // French generic noise (bot scrapes FR sites too)
    'offre', 'offres', 'accueil', 'connexion', 'inscription', 'recherche',
    'actualités', 'actualites', 'emploi', 'recrutement', 'contact',
    'mentions', 'légales', 'legales', 'confidentialité', 'confidentialite',
    'boutique', 'catalogue', 'espace', 'client', 'particulier', 'professionnel',
    'particuliers', 'professionnels', 'entreprises', 'decouvrir', 'découvrir',
    // German generic noise
    'angebot', 'angebote', 'startseite', 'kontakt', 'impressum', 'datenschutz',
    'produkte', 'leistungen', 'unternehmen', 'karriere', 'presse',
]);

function filterGarbageServices(services: string[]): string[] {
    // Keep compound phrases (e.g. "payment processing", "cloud computing") — those are real services
    // Only filter single generic words that the scraper picks up from HTML noise
    const filtered = services.filter(s => {
        const lower = s.toLowerCase().trim();
        if (lower.length <= 3) return false;
        // Multi-word phrases are likely real services (e.g. "payment processing")
        if (lower.includes(' ') && lower.split(' ').length >= 2) return true;
        // Single words: filter if generic
        return !GARBAGE_SERVICES.has(lower);
    });
    // If ALL services got filtered out, the original data was garbage → return empty
    // If SOME survived, we have real data → return the filtered list
    return filtered;
}

// ─── Shared entity data extraction ──────────────────────────

interface EntityFields {
    name: string;
    category: string;
    countryCode: string;
    location: string;
    services: string[];
    businessType: string;
    geminiDesc: string;
    metaDesc: string;
    rawAudience: string;
}

const GENERIC_NAMES = ['Unknown', 'Entity', 'Unknown Entity', 'Entreprise Inconnue', 'Homepage', 'Welcome'];

/** Extract all commonly-needed fields from an entity, locale-aware. */
function extractEntityFields(entity: any, locale: 'fr' | 'en'): EntityFields {
    const asr = extractAsrData(entity);

    const rawName = entity.display_name || entity.legal_name || '';
    const name = (rawName && !GENERIC_NAMES.includes(rawName))
        ? rawName
        : (entity.website ? domainFromUrl(entity.website) : 'Unknown');

    const sectorRaw = entity.sector_macro || 'General';
    const category = SECTOR_LABELS[sectorRaw] || sectorRaw;

    const countryCode = entity.country_legal || 'XX';
    const countryMap = locale === 'fr' ? COUNTRY_LABELS_FR : COUNTRY_LABELS;
    const location = countryMap[countryCode] || (countryCode === 'XX' ? 'Global' : countryCode);

    const rawServices: string[] = Array.isArray(asr.offre?.services?.value) ? asr.offre.services.value : [];
    const services = filterGarbageServices(rawServices);
    const businessType: string = asr.identite?.business_type?.value || '';

    const enrichment = entity.asr_payload?.enrichment || asr.enrichment || {};
    const geminiDescFr: string = enrichment.gemini_description_fr || '';
    const geminiDescEn: string = enrichment.gemini_description || '';
    const geminiDesc = locale === 'fr' ? (geminiDescFr || geminiDescEn) : geminiDescEn;

    const metaDesc: string = asr.identite?.description?.value || asr.source?.meta_description || '';

    const rawAudience: string = Array.isArray(asr.offre?.target_audience?.value)
        ? asr.offre.target_audience.value.join(', ')
        : (asr.offre?.target_audience?.value || '');

    return { name, category, countryCode, location, services, businessType, geminiDesc, metaDesc, rawAudience };
}

// ─── Core functions ──────────────────────────────────────────

/**
 * Build ultra-simple 5-field summary for LLM consumption.
 * @param locale 'en' (default, backward-compat) or 'fr'
 */
export function buildLlmSummary(entity: any, locale: 'fr' | 'en' = 'en'): LlmSummary {
    const f = extractEntityFields(entity, locale);

    let whatItDoes = '';
    if (f.geminiDesc && f.geminiDesc.length > 10) {
        whatItDoes = cleanText(f.geminiDesc);
        if (!whatItDoes.endsWith('.')) whatItDoes += '.';
    } else if (f.services.length > 0) {
        const svcText = f.services.slice(0, 3).join(', ');
        whatItDoes = f.businessType
            ? `${f.businessType} providing ${svcText.toLowerCase()}.`
            : `Provides ${svcText.toLowerCase()}.`;
    } else if (f.metaDesc && f.metaDesc.length > 20 && f.metaDesc.length < 200) {
        whatItDoes = cleanText(f.metaDesc);
        if (!whatItDoes.endsWith('.')) whatItDoes += '.';
    } else if (f.businessType) {
        whatItDoes = `${f.businessType} based in ${f.location}.`;
    } else {
        whatItDoes = `${f.category} company.`;
    }
    whatItDoes = truncate(cleanText(whatItDoes), 200);

    let forWho = '';
    if (f.rawAudience && f.rawAudience.length > 3) {
        forWho = truncate(cleanText(f.rawAudience), 150);
        if (!forWho.endsWith('.')) forWho += '.';
    } else {
        forWho = SECTOR_AUDIENCE_FALLBACK[f.category] || 'Businesses and professionals.';
    }

    return { name: f.name, what_it_does: whatItDoes, for_who: forWho, category: f.category, location: f.location };
}

// French country names for certificate page descriptions
export const COUNTRY_LABELS_FR: Record<string, string> = {
    CH: 'Suisse', FR: 'France', DE: 'Allemagne', US: 'États-Unis',
    GB: 'Royaume-Uni', IT: 'Italie', ES: 'Espagne', NL: 'Pays-Bas',
    BE: 'Belgique', AT: 'Autriche', LU: 'Luxembourg', CA: 'Canada',
    AU: 'Australie', JP: 'Japon', KR: 'Corée du Sud', CN: 'Chine',
    SG: 'Singapour', HK: 'Hong Kong', IN: 'Inde', BR: 'Brésil',
    SE: 'Suède', NO: 'Norvège', DK: 'Danemark', FI: 'Finlande',
    IE: 'Irlande', PT: 'Portugal', PL: 'Pologne', CZ: 'Tchéquie',
    IL: 'Israël', AE: 'Émirats arabes unis', SA: 'Arabie saoudite',
    MX: 'Mexique', AR: 'Argentine', ZA: 'Afrique du Sud', MA: 'Maroc',
    TW: 'Taïwan', NZ: 'Nouvelle-Zélande', RO: 'Roumanie', TR: 'Turquie',
    GR: 'Grèce', EE: 'Estonie',
};

// French prepositions for countries ("en France", "aux États-Unis", "au Japon")
function countryPreposition(cc: string): string {
    const aux = ['US', 'AE', 'NL', 'PH', 'EAU'];
    const au = ['JP', 'CA', 'BR', 'MX', 'PT', 'DK', 'LU', 'MA', 'RO', 'VN'];
    if (aux.includes(cc)) return 'aux';
    if (au.includes(cc)) return 'au';
    return 'en';
}

/**
 * Build 2-4 sentence plain text description for certificate pages.
 * Uses extractEntityFields to avoid re-extracting data already available.
 * @param locale 'fr' (default, backward-compat) or 'en'
 */
export function buildPlainTextDescription(entity: any, locale: 'fr' | 'en' = 'fr'): string {
    const f = extractEntityFields(entity, locale);

    let phrase1 = '';
    let phrase2 = '';
    let phrase3 = '';

    // Phrase 1: identity + what it does (priority: gemini > services > meta > businessType > sector)
    const hasGemini = f.geminiDesc && f.geminiDesc.length > 10;
    const hasMeta = f.metaDesc && f.metaDesc.length > 20 && f.metaDesc.length < 200;

    if (locale === 'fr') {
        const locationFr = COUNTRY_LABELS_FR[f.countryCode] || (f.countryCode === 'XX' ? '' : f.countryCode);
        const prep = countryPreposition(f.countryCode);

        if (hasGemini) {
            phrase1 = `${f.name} : ${cleanText(f.geminiDesc)}`;
            if (!phrase1.endsWith('.')) phrase1 += '.';
        } else if (f.services.length > 0) {
            const svcFr = f.services.slice(0, 3).join(', ');
            phrase1 = f.businessType
                ? `${f.name} est ${addArticle(f.businessType)} qui propose ${svcFr.toLowerCase()}.`
                : `${f.name} propose ${svcFr.toLowerCase()}.`;
        } else if (hasMeta) {
            phrase1 = `${f.name} : ${cleanText(f.metaDesc)}`;
            if (!phrase1.endsWith('.')) phrase1 += '.';
        } else if (f.businessType) {
            phrase1 = `${f.name} est ${addArticle(f.businessType)}.`;
        } else {
            phrase1 = `${f.name} est une entreprise du secteur ${f.category}.`;
        }

        phrase2 = f.rawAudience && f.rawAudience.length > 3
            ? `Elle s'adresse principalement ${f.rawAudience.startsWith('aux') || f.rawAudience.startsWith('à') ? '' : 'à '}${f.rawAudience.toLowerCase()}.`
            : '';

        phrase3 = locationFr ? `Basée ${prep} ${locationFr}.` : '';
    } else {
        const locationEn = COUNTRY_LABELS[f.countryCode] || (f.countryCode === 'XX' ? '' : f.countryCode);

        if (hasGemini) {
            phrase1 = `${f.name}: ${cleanText(f.geminiDesc)}`;
            if (!phrase1.endsWith('.')) phrase1 += '.';
        } else if (f.services.length > 0) {
            const svcEn = f.services.slice(0, 3).join(', ');
            phrase1 = f.businessType
                ? `${f.name} is a ${f.businessType.toLowerCase()} that provides ${svcEn.toLowerCase()}.`
                : `${f.name} provides ${svcEn.toLowerCase()}.`;
        } else if (hasMeta) {
            phrase1 = `${f.name}: ${cleanText(f.metaDesc)}`;
            if (!phrase1.endsWith('.')) phrase1 += '.';
        } else if (f.businessType) {
            phrase1 = `${f.name} is a ${f.businessType.toLowerCase()}.`;
        } else {
            phrase1 = `${f.name} is a ${f.category} company.`;
        }

        phrase2 = f.rawAudience && f.rawAudience.length > 3
            ? `It primarily serves ${f.rawAudience.toLowerCase()}.`
            : '';

        phrase3 = locationEn ? `Based in ${locationEn}.` : '';
    }

    return [phrase1, phrase2, phrase3].filter(Boolean).join(' ');
}

/** Add French indefinite article before business type ("une agence", "un cabinet") */
function addArticle(bt: string): string {
    const lower = bt.toLowerCase();
    const feminine = ['agence', 'entreprise', 'société', 'association', 'organisation', 'fondation', 'plateforme', 'banque', 'compagnie', 'marque'];
    const article = feminine.some(f => lower.startsWith(f)) ? 'une' : 'un';
    return `${article} ${lower}`;
}
