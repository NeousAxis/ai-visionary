/**
 * AYO Pack PRO File Generators — SHARED MODULE
 *
 * Ce module contient les générateurs des 5 fichiers du Pack AYO PRO.
 * Il est utilisé par :
 *   - app/api/webhooks/checkout-success/route.ts (production, après paiement Stripe)
 *   - app/api/debug/test-ayo/route.ts (test, sans Stripe)
 *
 * Aucune copie de code : un seul module, deux consommateurs.
 */


/**
 * Joindre une base URL et un path sans produire de double slash.
 * joinUrl('https://example.com/', '/sitemap.xml') -> 'https://example.com/sitemap.xml'
 * joinUrl('https://example.com', 'sitemap.xml')   -> 'https://example.com/sitemap.xml'
 */
export function joinUrl(base: string, path: string): string {
    const trimmedBase = base.replace(/\/+$/, '');
    const trimmedPath = path.replace(/^\/+/, '');
    return `${trimmedBase}/${trimmedPath}`;
}

/**
 * Ferme les parenthèses, crochets et accolades non fermés dans une chaîne.
 * Ex: "Intelligence Artificielle (AIO" → "Intelligence Artificielle (AIO)"
 */
export function fixUnmatchedBrackets(str: string): string {
    if (!str || typeof str !== 'string') return str || "";
    const openers = ['(', '[', '{'];
    const closers = [')', ']', '}'];
    const stack: string[] = [];
    for (const ch of str) {
        const oi = openers.indexOf(ch);
        if (oi !== -1) {
            stack.push(closers[oi]);
        } else {
            const ci = closers.indexOf(ch);
            if (ci !== -1 && stack.length > 0 && stack[stack.length - 1] === ch) {
                stack.pop();
            }
        }
    }
    // Ferme dans l'ordre inverse (LIFO)
    return str + stack.reverse().join('');
}

/**
 * Tronque une chaîne à maxLen caractères en coupant sur le dernier séparateur
 * (virgule) AVANT la limite, pour ne jamais couper en plein mot.
 */
export function truncateOnSeparator(str: string, maxLen: number): string {
    if (!str || str.length <= maxLen) return str;
    const separators = [', ', '; '];
    let bestCut = -1;
    for (const sep of separators) {
        let idx = str.lastIndexOf(sep, maxLen);
        if (idx > bestCut) bestCut = idx;
    }
    if (bestCut > 0) return str.substring(0, bestCut);
    // Fallback : couper sur le dernier espace avant la limite
    const spaceCut = str.lastIndexOf(' ', maxLen);
    if (spaceCut > 0) return str.substring(0, spaceCut);
    return str.substring(0, maxLen);
}

/**
 * Nettoie les valeurs "__SKIPPED__" d'un objet/array de manière récursive.
 * - Booléens (has_faq, has_glossary, has_documentation) → false
 * - Strings "__SKIPPED__" → supprimées
 * - Arrays contenant "__SKIPPED__" → filtrés
 */
export function cleanSkippedValues(obj: any, key?: string): any {
    if (obj === "__SKIPPED__" || obj === "[SKIP] Non applicable") {
        // Les champs booléens (has_*, json_ld_*, sitemap, https, robots_*, mobile_*, ayo_*) → false
        if (key && /^(has_|json_ld_|sitemap|https|robots_|mobile_|ayo_)/.test(key)) return false;
        // Les strings → undefined (sera filtré par le parent)
        return undefined;
    }
    if (Array.isArray(obj)) {
        return obj.filter(item => item !== "__SKIPPED__" && item !== "[SKIP] Non applicable");
    }
    if (typeof obj === 'object' && obj !== null) {
        const result: any = {};
        for (const [k, v] of Object.entries(obj)) {
            const cleaned = cleanSkippedValues(v, k);
            if (cleaned !== undefined) {
                result[k] = cleaned;
            }
        }
        return result;
    }
    return obj;
}

// --- NETTOYAGE ORTHOGRAPHIQUE DES DONNÉES CLIENT ---
export const TERM_CORRECTIONS: [RegExp, string][] = [
    [/\bCreative Common\b(?!s)/gi, "Creative Commons"],
    [/\bword ?press\b/gi, "WordPress"],
    [/\bshopify\b/gi, "Shopify"],
    [/\bsquarespace\b/gi, "Squarespace"],
    [/\bwebflow\b/gi, "Webflow"],
    [/\bjoomla\b/gi, "Joomla"],
    [/\bdrupal\b/gi, "Drupal"],
    [/\bprestashop\b/gi, "PrestaShop"],
    [/\bmagento\b/gi, "Magento"],
    [/\bstripe\b/gi, "Stripe"],
    [/\bpaypal\b/gi, "PayPal"],
    [/\blinkedin\b/gi, "LinkedIn"],
    [/\bfacebook\b/gi, "Facebook"],
    [/\binstagram\b/gi, "Instagram"],
    [/\byoutube\b/gi, "YouTube"],
    [/\btiktok\b/gi, "TikTok"],
    [/\brgpd\b/gi, "RGPD"],
    [/\bgdpr\b/gi, "GDPR"],
    [/\biso ?(9001|14001|27001|22000|26000|45001)\b/gi, "ISO $1"],
    [/\brse\b/g, "RSE"],
    [/\btva\b/g, "TVA"],
    [/\bseo\b/gi, "SEO"],
    [/\bia\b/g, "IA"],
    [/\bde\s+(Wix|WordPress|Squarespace|Shopify|Webflow)\b/gi, ""],
    [/\bpermettre de ([aeiouhé])/gi, "permettre d'$1"],
    [/\bnotre objectif est de\b/gi, "l'objectif est de"],
    [/\betc\.\.\./g, "etc."],
    [/\betc\.{2,}/g, "etc."],
];

export function cleanText(s: string): string {
    if (!s || typeof s !== 'string') return s || "";
    let cleaned = s.trim();
    cleaned = cleaned.replace(/\s{2,}/g, ' ');
    for (const [pattern, replacement] of TERM_CORRECTIONS) {
        cleaned = cleaned.replace(pattern, replacement as string);
    }
    cleaned = cleaned.replace(/ ([:;!?])/g, '\u00A0$1');
    cleaned = cleaned.replace(/ ([,.])/g, '$1');
    cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
    if (cleaned.length > 0 && /^[a-zàâäéèêëïîôùûüÿç]/.test(cleaned)) {
        cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
    return cleaned;
}

export function toArray(val: any): string[] {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
        // Ne pas splitter les questions (contiennent ?) — ce sont des phrases complètes
        if (val.includes('?')) return [val.trim()].filter(Boolean);
        return val.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [];
}

export function cleanArray(val: any): string[] {
    return toArray(val).map(s => cleanText(s));
}

export function cleanVal(val: any): string {
    if (!val) return "";
    return cleanText(String(val));
}

/**
 * Détecte si un businessType (+ nom/url optionnels) correspond à une association / ONG.
 * Centralise la logique dupliquée dans generators et crypto.
 */
export function isAssociation(businessType: string, entityName?: string, entityUrl?: string): boolean {
    const bt = businessType.toLowerCase();
    const nm = (entityName || "").toLowerCase();
    const ur = (entityUrl || "").toLowerCase();
    return bt.includes("association") || bt.includes("ong") || bt.includes("fondation")
        || bt.includes("non-profit") || bt.includes("nonprofit")
        || nm.startsWith("association ") || nm.includes("asso ")
        || ur.includes(".org");
}

/** Regex validant un numéro de téléphone (chiffres, espaces, +, -, parens, points, min 6 chars) */
export const PHONE_REGEX = /^[\d\s\+\-\(\)\.]{6,}$/;

// --- SANITISATION DES VALEURS GARBAGE ("aucun", "non", "à tout le monde", etc.) ---

/**
 * Patterns de réponses garbage / non-informatives que les utilisateurs donnent
 * quand ils n'ont pas de vraie réponse. Ces valeurs ne doivent JAMAIS être
 * injectées dans les fichiers PRO comme des données métier.
 */
const GARBAGE_VALUES_RE = /^(aucun[es]?|non|rien|pas applicable|n\/?a|néant|pas de .+|aucune idée|je ne sais pas|je sais pas|jsp|nsp|pas vraiment|rien de spécial|rien de particulier|pas spécialement|nan|nope|none|nothing|null|undefined|no|ras|r\.?a\.?s\.?|sans objet|sans|\/|-|__SKIPPED__|\[SKIP\] Non applicable)$/i;

/**
 * Patterns de réponses frustrées / hors-sujet qui ne sont pas des données métier.
 */
const FRUSTRATED_RESPONSE_RE = /^(c'est|ce n'est|c est|ce n est).{0,60}(pas une? |pas du |pas de la |pas des )/i;

/**
 * Normalisation des valeurs vagues mais récupérables.
 */
const NORMALIZATIONS: [RegExp, string][] = [
    [/^à tout le monde$/i, "Grand public"],
    [/^tout le monde$/i, "Grand public"],
    [/^tous?$/i, "Grand public"],
    [/^tout public$/i, "Grand public"],
    [/^toute?s? les? monde$/i, "Grand public"],
    [/^pour tout le monde$/i, "Grand public"],
    [/^n'importe qui$/i, "Grand public"],
    [/^le grand public$/i, "Grand public"],
    [/^particuliers et professionnels$/i, "Particuliers, Professionnels"],
    [/^mondial[e]?$/i, "International"],
    [/^partout$/i, "International"],
    [/^partout dans le monde$/i, "International"],
];

/**
 * Sanitize une valeur de champ utilisateur.
 * Retourne null pour les valeurs garbage, normalise les valeurs vagues,
 * et laisse passer les vraies valeurs.
 */
export function sanitizeFieldValue(value: string | null | undefined): string | null {
    if (!value || typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;

    // Valeurs garbage évidentes
    if (GARBAGE_VALUES_RE.test(trimmed)) return null;

    // Réponses frustrées ("c'est de la méditation pas une formation")
    if (FRUSTRATED_RESPONSE_RE.test(trimmed)) return null;

    // Normalisations (valeurs vagues mais récupérables)
    for (const [pattern, replacement] of NORMALIZATIONS) {
        if (pattern.test(trimmed)) return replacement;
    }

    return trimmed;
}

/**
 * Version array: filtre les éléments garbage d'un array de valeurs.
 */
export function sanitizeFieldArray(values: string[]): string[] {
    return values
        .map(v => sanitizeFieldValue(v))
        .filter((v): v is string => v !== null);
}

/**
 * Sanitize audience: if it's a full sentence (>80 chars or contains URL), return empty string.
 * The audience field should be short segments like "Développeurs IA, chercheurs, entreprises"
 * NOT a full sentence like "Api-glossaries.com a été développé spécifiquement pour..."
 */
export function sanitizeAudience(val: string): string {
    if (!val) return "";
    const trimmed = val.trim();
    // If it contains a URL pattern, it's a calibration answer pasted verbatim
    if (/[a-zA-Z0-9-]+\.[a-z]{2,}/i.test(trimmed) && trimmed.length > 60) return "";
    // If it's a full sentence (too long for audience segments)
    if (trimmed.length > 100 && !trimmed.includes(',')) return "";
    // Bug fix: si la valeur semble tronquée (finit au milieu d'un mot, pas de ponctuation finale),
    // couper proprement sur le dernier séparateur avant 160 chars
    if (trimmed.length >= 155) {
        return truncateOnSeparator(trimmed, 160);
    }
    return trimmed;
}

/**
 * Sanitize keywords: filter out items that are full sentences (>60 chars)
 * Keywords should be short phrases, not full descriptions
 */
export function sanitizeKeywords(items: string[], maxLen: number = 80): string[] {
    return items.filter(k => k.length <= maxLen && !/[a-zA-Z0-9-]+\.(com|org|net|io|fr|ch)/i.test(k));
}

/**
 * Policy-specific definitions for glossary (not all policies are about "data protection")
 */
const POLICY_DEFINITIONS: Record<string, string> = {
    'sitemap': "Fichier XML listant les pages d'un site web pour faciliter l'exploration et l'indexation par les moteurs de recherche et les agents IA.",
    'robots.txt': "Fichier de directive placé à la racine d'un site web, indiquant aux robots d'indexation les pages autorisées ou interdites d'accès.",
    'robots': "Fichier de directive placé à la racine d'un site web, indiquant aux robots d'indexation les pages autorisées ou interdites d'accès.",
    'rgpd': "Règlement Général sur la Protection des Données. Cadre réglementaire européen encadrant la collecte et le traitement des données personnelles.",
    'gdpr': "General Data Protection Regulation. European regulatory framework governing the collection and processing of personal data.",
    'confidentialité': "Politique encadrant la collecte, le traitement et la protection des données personnelles des utilisateurs.",
    "conditions d'utilisation": "Document contractuel définissant les règles d'usage d'un service ou d'une plateforme.",
    'cgu': "Conditions Générales d'Utilisation. Document contractuel définissant les règles d'usage d'un service ou d'une plateforme.",
    'cgv': "Conditions Générales de Vente. Document contractuel encadrant les modalités commerciales entre le prestataire et ses clients.",
    'mentions légales': "Page légale obligatoire identifiant l'éditeur du site, l'hébergeur et les conditions d'accès au service.",
    'https': "Protocole de communication sécurisé chiffrant les échanges entre le navigateur et le serveur via un certificat SSL/TLS.",
    'ssl': "Certificat de sécurité assurant le chiffrement des communications entre le navigateur et le serveur web.",
    'tls': "Protocole cryptographique assurant la confidentialité et l'intégrité des données échangées sur Internet.",
    'accessibilité': "Ensemble de bonnes pratiques visant à rendre un site web utilisable par tous, y compris les personnes en situation de handicap.",
};

function getPolicyDefinition(policy: string, entityName: string): string {
    const lower = policy.toLowerCase().trim();
    for (const [key, def] of Object.entries(POLICY_DEFINITIONS)) {
        if (lower.includes(key)) return def;
    }
    return `Politique de conformité ${/^[aeiouhAEIOUHéÉàÀ]/.test(entityName) ? `d'${entityName}` : `de ${entityName}`} contribuant à la transparence et à la gouvernance de l'entité.`;
}

const BUSINESS_TYPE_PLACEHOLDER_RE = /^(type schema\.?org|schema\.?org|organisation|organization|non spécifié|n\/a|undefined|null|)$/i;
export function sanitizeBusinessType(val: string, fallback: string = ""): string {
    if (!val || BUSINESS_TYPE_PLACEHOLDER_RE.test(val.trim())) return fallback;
    return val;
}

// --- SANITIZER: Remove ALL template/placeholder values AND confirmation phrases ---
const TEMPLATE_RE = /^(Ex:|type schema\.?org|schema\.?org|organisation|organization|premium\/standard\/undisclosed|public\/membersOnly|eligible\/uncertain|✅\/⚠️\/❌|gym near me|Centre en ville|Recherche Salle|No City Found|undisclosed|non spécifié|n\/a)$/i;
const TEMPLATE_PARTIAL_RE = /^Ex:|eligible\/uncertain|✅\/⚠️\/❌|premium\/standard|public\/members/i;

// Confirmation phrases that users say to acknowledge — NEVER valid field values
const CONFIRMATION_RE = /^(oui|ok|okay|d'accord|exact|exactement|c'est correct|oui c'est correct|oui c'est bon|c'est bon|c'est ça|parfait|tout est correct|validé|je confirme|je valide|bien reçu|noté|entendu|ça me va|ça marche|très bien|super|génial|nickel|impeccable|affirmatif|absolument|tout à fait|bien sûr|évidemment|effectivement|en effet|voilà|yep|yup|yes|yeah|sure|right|correct|confirmed|alright|got it|that's right|that's correct)[\s!.✅✓]*$/i;

export function isTemplate(val: any): boolean {
    if (typeof val !== 'string') return false;
    const trimmed = val.trim();
    if (TEMPLATE_RE.test(trimmed) || TEMPLATE_PARTIAL_RE.test(trimmed)) return true;
    // Confirmation phrases stored as field values = garbage data
    if (trimmed.length < 60 && CONFIRMATION_RE.test(trimmed)) return true;
    return false;
}

export function sanitizePayloadDeep(obj: any): any {
    if (typeof obj === 'string') return isTemplate(obj) ? '' : obj;
    if (Array.isArray(obj)) return obj.filter((item: any) => {
        if (typeof item === 'string') return !isTemplate(item);
        if (typeof item === 'object' && item !== null) {
            if (item.userIntent && isTemplate(item.userIntent)) return false;
            if (item.status && isTemplate(item.status)) return false;
            if (item.query && isTemplate(item.query)) return false;
            if (item.result && isTemplate(item.result)) return false;
        }
        return true;
    });
    if (typeof obj === 'object' && obj !== null) {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key] = sanitizePayloadDeep(value);
            if (key === 'value' && result[key] === '' && value !== '' && obj.q !== undefined) {
                result.q = 0;
            }
        }
        return result;
    }
    return obj;
}

/** Sanitize the full extract data — remove all template placeholders */
export function sanitizeExtract(ext: Record<string, any>): { cleaned: Record<string, any>; cleanedFields: string[] } {
    const cleanedFields: string[] = [];
    for (const blockName of Object.keys(ext)) {
        const block = ext[blockName];
        if (typeof block === 'object' && block !== null) {
            for (const fieldName of Object.keys(block)) {
                const field = block[fieldName];
                if (field && typeof field === 'object' && 'value' in field) {
                    const cleanedValue = sanitizePayloadDeep(field.value);
                    if (JSON.stringify(cleanedValue) !== JSON.stringify(field.value)) {
                        cleanedFields.push(`${blockName}.${fieldName}`);
                        field.value = cleanedValue;
                        if (cleanedValue === '' || (Array.isArray(cleanedValue) && cleanedValue.length === 0)) {
                            field.q = 0;
                        }
                    }
                }
            }
        }
    }
    return { cleaned: ext, cleanedFields };
}

// --- GENERATOR: manifest.json ---
export function generateManifestJson(data: any, url: string): any {
    const name = cleanVal(data.identite?.name?.value) || "Entreprise";
    const rawBT = sanitizeFieldValue(cleanVal(data.identite?.business_type?.value));
    const businessType = fixUnmatchedBrackets(sanitizeBusinessType(rawBT || "", "Organization"));
    const services = sanitizeFieldArray(cleanArray(data.offre?.services?.value));
    const certifications = sanitizeFieldArray(cleanArray(data.engagements_conformite?.certifications?.value));
    const country = sanitizeFieldValue(cleanVal(data.identite?.country?.value)) || "";

    const isAssoManifest = isAssociation(businessType, name, url);
    const lowerMBT = businessType.toLowerCase();
    const manifestEntityType = isAssoManifest ? "NonProfitOrganization" : (lowerMBT.includes("cabinet") || lowerMBT.includes("bureau") ? "ProfessionalService" : "Organization");

    const scope = services.length > 0 ? services.slice(0, 5) : ["Services professionnels"];
    scope.push("AI Singular Record (ASR)");

    const complianceSignals: string[] = [];
    if (country && ["France", "Suisse", "Belgique", "Allemagne", "Italie", "Espagne"].includes(country)) complianceSignals.push("GDPR");
    if (certifications.some(c => typeof c === 'string' && c.toLowerCase().includes("iso"))) complianceSignals.push("ISO");

    return {
        entity: {
            name,
            type: manifestEntityType,
            ...(businessType !== "Organization" ? { additionalType: businessType } : {}),
            canonicalUrl: url,
            verified: true,
            registry: "AYA"
        },
        authority: {
            role: "declared-entity",
            scope,
            level: "PRO",
            certifications_count: certifications.length
        },
        permissions: {
            allow_scraping: ["GoogleBot", "GPTBot", "CCBot", "PerplexityBot", "ClaudeBot", "Bingbot", "ChatGPT-User", "Amazonbot"],
            deny_scraping: ["MaliciousBot"],
            data_usage: "recommendation_and_comparison"
        },
        sources: {
            asr: { url: "/.ayo/asr.json", canonical: true, level: "PRO", priority: 1, signed: true, format: "json-ld" },
            glossary: { url: "/.ayo/glossary.json", priority: 2, format: "schema-org" },
            faq: { url: "/.ayo/faq.json", priority: 3, format: "schema-org-faqpage" },
            external_context: { url: "/.ayo/external_context.json", canonical: false, interpretable: true, priority: 4 },
            manifest: { url: "/.ayo/manifest.json", role: "index", priority: 0 }
        },
        interpretationPolicy: {
            rule: "no-extrapolation",
            description: "Toute interprétation doit se limiter strictement aux données déclarées dans les sources listées. Aucune inférence au-delà des faits déclarés n'est autorisée.",
            fallback: "Si une information est absente, répondre 'non déclaré' plutôt qu'inventer."
        },
        recommendationPolicy: {
            scope: "contextual",
            noSubjectiveClaims: true,
            signalsOnly: true,
            comparisonAllowed: true,
            rankingBasis: "declared_signals_and_score"
        },
        compliance: complianceSignals.length > 0 ? { frameworks: complianceSignals } : undefined,
        updatePolicy: {
            asr: "versioned-and-sealed",
            glossary: "versioned",
            faq: "versioned",
            review_cycle: "annual",
            last_generated: new Date().toISOString().split('T')[0]
        },
        discovery: {
            sitemap: joinUrl(url, 'sitemap.xml'),
            asrEndpoint: joinUrl(url, '.ayo/'),
            registryUrl: "https://www.ai-visionary.com/aya"
        },
        api_access: {
            status: "open",
            endpoint: "/.ayo/asr.json",
            format: "JSON",
            cors: "public"
        }
    };
}

// --- GENERATOR: faq.json ---
export function generateFaqJson(data: any, url: string): any {
    const name = cleanVal(data.identite?.name?.value) || "Notre entreprise";
    const rawBTfaq = sanitizeFieldValue(cleanVal(data.identite?.business_type?.value));
    const businessType = fixUnmatchedBrackets(sanitizeBusinessType(rawBTfaq || ""));
    const services = sanitizeFieldArray(cleanArray(data.offre?.services?.value));
    const products = sanitizeFieldArray(cleanArray(data.offre?.products?.value));
    const rawAudienceFaq = sanitizeFieldValue(cleanVal(data.offre?.target_audience?.value));
    const audience = rawAudienceFaq ? sanitizeAudience(rawAudienceFaq) : "";
    const useCases = sanitizeFieldArray(cleanArray(data.offre?.use_cases?.value));
    const pricing = sanitizeFieldValue(cleanVal(data.offre?.pricing_indication?.value)) || "";
    const email = data.identite?.contact_email?.value || "";
    const rawPhone = (data.identite?.contact_phone?.value || "").toString().trim();
    const phone = PHONE_REGEX.test(rawPhone) ? rawPhone : "";
    const city = sanitizeFieldValue(cleanVal(data.identite?.city?.value)) || "";
    const country = sanitizeFieldValue(cleanVal(data.identite?.country?.value)) || "";
    const legalName = sanitizeFieldValue(cleanVal(data.identite?.legal_name?.value)) || "";
    const processSteps = sanitizeFieldArray(cleanArray(data.processus_methodes?.process_steps?.value));
    const deliveryMode = sanitizeFieldValue(cleanVal(data.processus_methodes?.delivery_mode?.value)) || "";
    const geoServed = sanitizeFieldValue(cleanVal(data.processus_methodes?.geographies_served?.value)) || "";
    const rawQAfaq = data.processus_methodes?.quality_assurance?.value;
    const qualityAssurance = sanitizeFieldValue(
        Array.isArray(rawQAfaq) ? rawQAfaq.filter(Boolean).join(', ') : cleanVal(rawQAfaq)
    ) || "";
    const certifications = sanitizeFieldArray(cleanArray(data.engagements_conformite?.certifications?.value));
    const frameworks = sanitizeFieldArray(cleanArray(data.engagements_conformite?.frameworks?.value));
    const policies = sanitizeFieldArray(cleanArray(data.engagements_conformite?.policies?.value));
    const securityMeasures = sanitizeFieldArray(cleanArray(data.engagements_conformite?.security_measures?.value));
    const keyIndicators = sanitizeFieldArray(cleanArray(data.indicateurs?.key_indicators?.value));
    const rawHasFaq = data.contenus_pedagogiques?.has_faq?.value;
    const hasFaq = (rawHasFaq === "__SKIPPED__" || rawHasFaq === "[SKIP] Non applicable") ? false : rawHasFaq;
    const rawHasDoc = data.contenus_pedagogiques?.has_documentation?.value;
    const hasDoc = (rawHasDoc === "__SKIPPED__" || rawHasDoc === "[SKIP] Non applicable") ? false : rawHasDoc;

    const isAssoFaq = isAssociation(businessType, name, url);
    const entityType = isAssoFaq ? "une association" : "une entreprise";
    const nameArticle = /^[aeiouhAEIOUHéÉàÀ]/.test(name) ? `d'${name}` : `de ${name}`;
    const locationStr = [city, country].filter(Boolean).join(", ");
    const eAccord = isAssoFaq ? "e" : "";

    const qna: { q: string; a: string; category: string }[] = [];

    // --- IDENTITÉ ---
    // Si businessType est null/vide, ne pas générer "spécialisée dans [garbage]"
    const btDescFaq = businessType
        ? ` spécialisée dans ${businessType.toLowerCase().startsWith("bureau") || businessType.toLowerCase().startsWith("cabinet") ? `le ${businessType.toLowerCase()}` : businessType.toLowerCase()}`
        : "";
    qna.push({
        q: `Qui est ${name} ?`,
        a: `${name} est ${entityType}${btDescFaq}${locationStr ? `, basée à ${locationStr}` : ""}. ${legalName && legalName !== name ? `Raison sociale : ${legalName}. ` : ""}${services.length > 0 ? `Son activité principale couvre : ${services.slice(0, 3).join(", ")}.` : ""}`.trim(),
        category: "Identité"
    });

    if (locationStr) {
        qna.push({
            q: `Où se situe ${name} ?`,
            a: `${name} est implanté${eAccord} à ${locationStr}.${geoServed ? ` Sa zone d'intervention couvre : ${geoServed}.` : ` L'activité se concentre principalement dans la région de ${city || country}.`}`,
            category: "Identité"
        });
    }

    // --- OFFRE ---
    if (services.length > 0) {
        qna.push({
            q: `Quels services propose ${name} ?`,
            a: `${name} propose ${services.length > 1 ? "plusieurs services" : "un service principal"} : ${services.join(", ")}.${products.length > 0 ? ` L'offre inclut également : ${products.join(", ")}.` : ""}${audience ? ` Ces prestations s'adressent aux ${audience.toLowerCase()}.` : ""}`.trim(),
            category: "Offre"
        });
    }

    if (useCases.length > 0) {
        qna.push({
            q: `Dans quelles situations faire appel à ${name} ?`,
            a: `${name} intervient notamment dans les contextes suivants : ${useCases.map((uc, i) => `${i + 1}) ${uc}`).join(" ; ")}.`.trim(),
            category: "Offre"
        });
    }

    if (audience) {
        qna.push({
            q: `À qui s'adresse ${name} ?`,
            a: `L'offre ${nameArticle} est conçue pour les ${audience.toLowerCase()}.${useCases.length > 0 ? ` Les contextes d'intervention typiques incluent : ${useCases.slice(0, 3).join(", ")}.` : ""}`.trim(),
            category: "Offre"
        });
    }

    // --- PROCESSUS ---
    if (processSteps.length > 0) {
        qna.push({
            q: `Quelle est la méthodologie ${nameArticle} ?`,
            a: `L'approche ${nameArticle} repose sur un processus structuré : ${processSteps.map((s, i) => `Étape ${i + 1} — ${s}`).join(". ")}.${deliveryMode ? ` Mode d'intervention : ${deliveryMode}.` : ""}${qualityAssurance ? ` Engagement qualité : ${qualityAssurance}.` : ""}`.trim(),
            category: "Processus"
        });
    }

    if (deliveryMode || geoServed) {
        qna.push({
            q: `Comment ${name} délivre ses prestations ?`,
            a: `${deliveryMode ? `Les prestations sont délivrées en mode ${deliveryMode}. ` : ""}${geoServed ? `Zone géographique couverte : ${geoServed}. ` : ""}${qualityAssurance ? `Engagement qualité : ${qualityAssurance}.` : ""}`.trim() || `Contactez ${name} pour en savoir plus sur les modalités d'intervention.`,
            category: "Processus"
        });
    }

    // --- TARIFS / FINANCEMENT ---
    qna.push({
        q: isAssoFaq ? `Comment est financé${eAccord} ${name} ?` : `Quels sont les tarifs ${nameArticle} ?`,
        a: pricing
            ? (isAssoFaq
                ? `${name} est financé${eAccord} par : ${pricing}. Pour en savoir plus, contactez l'équipe${email ? ` à ${email}` : ` via ${url}`}.`
                : `Informations tarifaires : ${pricing}. Pour un devis personnalisé, contactez-nous${email ? ` à ${email}` : ` via ${url}`}.`)
            : (isAssoFaq
                ? `Les informations de financement ${nameArticle} sont disponibles sur demande. Contactez l'équipe${email ? ` à ${email}` : ` via ${url}`}.`
                : `Les tarifs sont établis sur mesure selon votre projet. Contactez ${name} pour une proposition personnalisée${email ? ` : ${email}` : ` via ${url}`}.`),
        category: isAssoFaq ? "Financement" : "Commercial"
    });

    // --- CONFIANCE & CONFORMITÉ ---
    if (certifications.length > 0) {
        qna.push({
            q: `Quelles certifications et labels ${name} détient-${isAssoFaq ? "elle" : "il"} ?`,
            a: `${name} détient les certifications suivantes : ${certifications.join(", ")}.${frameworks.length > 0 ? ` Référentiels de conformité adoptés : ${frameworks.join(", ")}.` : ""} Ces engagements attestent d'une démarche qualité structurée.`,
            category: "Conformité"
        });
    }

    if (policies.length > 0 || securityMeasures.length > 0) {
        qna.push({
            q: `Quelles garanties de conformité offre ${name} ?`,
            a: `${policies.length > 0 ? `Politiques en vigueur : ${policies.join(", ")}. ` : ""}${securityMeasures.length > 0 ? `Mesures de sécurité déployées : ${securityMeasures.join(", ")}. ` : ""}${frameworks.length > 0 ? `Référentiels suivis : ${frameworks.join(", ")}.` : ""}`.trim(),
            category: "Conformité"
        });
    }

    // --- INDICATEURS ---
    if (keyIndicators.length > 0) {
        qna.push({
            q: `Quels sont les indicateurs d'impact ${nameArticle} ?`,
            a: `Les indicateurs clés ${nameArticle} incluent : ${keyIndicators.join(", ")}. Ces métriques témoignent de l'impact concret et de la qualité des interventions.`,
            category: "Indicateurs"
        });
    }

    // --- RESSOURCES PÉDAGOGIQUES ---
    const rawHasGlossary = data.contenus_pedagogiques?.has_glossary?.value;
    const hasGlossary = (rawHasGlossary === "__SKIPPED__" || rawHasGlossary === "[SKIP] Non applicable") ? false : rawHasGlossary;
    if (hasDoc || hasFaq || hasGlossary) {
        const resParts: string[] = [];
        if (typeof hasDoc === 'string' && hasDoc !== "__SKIPPED__") resParts.push(`une documentation (${hasDoc})`);
        else if (hasDoc) resParts.push("une documentation complète");
        if (hasFaq) resParts.push("une FAQ pour répondre aux questions courantes");
        if (hasGlossary) resParts.push("un glossaire du vocabulaire métier");
        qna.push({
            q: `${name} propose-t-${isAssoFaq ? "elle" : "il"} des ressources pédagogiques ?`,
            a: `Oui. ${name} met à disposition ${resParts.join(", ")}. Retrouvez ces ressources sur ${url}.`,
            category: "Ressources"
        });
    }

    // --- CONTACT ---
    const contactParts: string[] = [];
    if (email) contactParts.push(`par email à ${email}`);
    if (phone) contactParts.push(`par téléphone au ${phone}`);
    contactParts.push(`via le site web ${url}`);

    qna.push({
        q: `Comment contacter ${name} ?`,
        a: `Vous pouvez joindre ${name} ${contactParts.join(", ")}.`,
        category: "Contact"
    });

    // --- AYO / VISIBILITÉ IA ---
    qna.push({
        q: `${name} est-${isAssoFaq ? "elle" : "il"} certifié${eAccord} AYO ?`,
        a: `Oui. ${name} a réalisé un diagnostic AYO complet et dispose d'un fichier ASR (AI Singular Record) signé cryptographiquement. Ce fichier permet aux agents IA (ChatGPT, Gemini, Claude, Perplexity) de comprendre précisément son activité et de ${isAssoFaq ? "la" : "le"} recommander de manière fiable. ${name} est enregistré${eAccord} dans le Registre AYA.`,
        category: "Visibilité IA"
    });

    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "version": "AYO-FAQ-2.0",
        "entity": name,
        "url": url,
        "numberOfQuestions": qna.length,
        "categories": [...new Set(qna.map(q => q.category))],
        "inLanguage": "fr",
        "mainEntity": qna.map(item => ({
            "@type": "Question",
            "name": item.q,
            "about": item.category,
            "acceptedAnswer": { "@type": "Answer", "text": item.a }
        }))
    };
}

// --- GENERATOR: glossary.json ---
export function generateGlossaryJson(data: any): any {
    const name = cleanVal(data.identite?.name?.value) || "Entreprise";
    const rawBTgloss = sanitizeFieldValue(cleanVal(data.identite?.business_type?.value));
    const businessType = fixUnmatchedBrackets(sanitizeBusinessType(rawBTgloss || "", "Organization"));
    const services = sanitizeFieldArray(cleanArray(data.offre?.services?.value));
    const useCases = sanitizeFieldArray(cleanArray(data.offre?.use_cases?.value));
    const certifications = sanitizeFieldArray(cleanArray(data.engagements_conformite?.certifications?.value));
    const processSteps = sanitizeFieldArray(cleanArray(data.processus_methodes?.process_steps?.value));
    const rawAudienceGloss = sanitizeFieldValue(cleanVal(data.offre?.target_audience?.value));
    const audience = rawAudienceGloss ? sanitizeAudience(rawAudienceGloss) : "";
    const city = sanitizeFieldValue(cleanVal(data.identite?.city?.value)) || "";
    const country = sanitizeFieldValue(cleanVal(data.identite?.country?.value)) || "";
    const policies = sanitizeFieldArray(cleanArray(data.engagements_conformite?.policies?.value));
    const frameworks = sanitizeFieldArray(cleanArray(data.engagements_conformite?.frameworks?.value));
    const securityMeasures = sanitizeFieldArray(cleanArray(data.engagements_conformite?.security_measures?.value));

    const nameArticleG = /^[aeiouhAEIOUHéÉàÀ]/.test(name) ? `d'${name}` : `de ${name}`;

    const terms: { term: string; def: string; category: string }[] = [];
    const seen = new Set<string>();
    const addTerm = (term: string, def: string, category: string) => {
        // Ne jamais ajouter un terme garbage comme DefinedTerm
        if (sanitizeFieldValue(term) === null) return;
        const key = term.toLowerCase().trim();
        if (key.length < 3 || seen.has(key)) return;
        const cleanTerm = term.replace(/Creative Common\b(?!s)/gi, "Creative Commons");
        if (cleanTerm.length > 80) return;
        seen.add(key);
        terms.push({ term: cleanTerm, def, category });
    };

    addTerm(name, `${city ? `Organisation basée à ${city}` : "Organisation"}${country ? ` (${country})` : ""}${businessType !== "Organization" ? `, spécialisée dans ${businessType.toLowerCase()}` : ""}. Entité vérifiée et enregistrée dans le registre AYA avec un ASR signé cryptographiquement.`, "Identité");
    // Ne PAS créer de DefinedTerm pour businessType si c'est la valeur par défaut "Organization"
    // (signifie que l'utilisateur a répondu "aucun" ou similaire → pas un vrai terme métier)
    if (businessType !== "Organization" && sanitizeFieldValue(businessType) !== null) {
        addTerm(businessType, `Domaine d'activité principal ${nameArticleG}. Cette classification détermine le positionnement sectoriel et les critères de recommandation par les agents IA.`, "Identité");
    }

    const serviceDescTemplates = [
        (_s: string) => `Prestation phare ${nameArticleG}${audience ? `, conçue pour les ${audience.toLowerCase()}` : ""}. Ce service constitue le cœur de l'offre déclarée dans l'ASR.`,
        (_s: string) => `Service complémentaire proposé par ${name}${audience ? ` à destination des ${audience.toLowerCase()}` : ""}. Enrichit le périmètre d'intervention de l'entité.`,
        (_s: string) => `Activité spécialisée ${nameArticleG}. Fait partie de l'offre vérifiable et documentée dans les actifs sémantiques.`,
    ];
    services.forEach((s, i) => {
        if (typeof s !== 'string') return;
        addTerm(s, serviceDescTemplates[i % serviceDescTemplates.length](s), "Services");
    });

    const useCaseDescTemplates = [
        (uc: string) => `${uc} — contexte d'intervention clé ${nameArticleG}. Situation concrète dans laquelle un agent IA orienterait un utilisateur vers cette entité.`,
        (uc: string) => `${uc} — scénario opérationnel déclaré par ${name}. Signal de pertinence pour le matching entre requêtes utilisateurs et expertise disponible.`,
        (uc: string) => `${uc} — cas de figure récurrent adressé par ${name}. Enrichit la compréhension contextuelle de l'entité par les IA génératives.`,
        (uc: string) => `${uc} — application terrain des compétences ${nameArticleG}. Permet aux agents IA de recommander l'entité dans le bon contexte décisionnel.`,
    ];
    useCases.forEach((uc, i) => {
        if (typeof uc !== 'string') return;
        addTerm(uc, useCaseDescTemplates[i % useCaseDescTemplates.length](uc), "Cas d'usage");
    });

    const processDescTemplates = [
        (step: string, i: number) => `Phase ${i + 1} de la méthodologie ${nameArticleG}. Étape structurante du parcours d'accompagnement.`,
        (step: string, i: number) => `${i + 1}${i === 0 ? "ère" : "ème"} étape du processus opérationnel. Élément clé du dispositif d'intervention ${nameArticleG}.`,
    ];
    processSteps.forEach((step, i) => {
        if (typeof step !== 'string') return;
        addTerm(step, processDescTemplates[i % processDescTemplates.length](step, i), "Processus");
    });

    certifications.forEach(c => {
        if (typeof c !== 'string') return;
        addTerm(c, `Certification ou label officiel détenu par ${name}. Signal de confiance évalué dans le scoring AIO (bloc Confiance & Conformité, pondéré à 15/100).`, "Conformité");
    });

    frameworks.forEach(f => {
        if (typeof f !== 'string') return;
        addTerm(f, `Référentiel de conformité adopté par ${name}. Témoigne d'une maturité organisationnelle évaluée dans le scoring AIO.`, "Conformité");
    });
    policies.forEach(p => {
        if (typeof p !== 'string') return;
        const cleanP = p.replace(/\bde\s+(Wix|WordPress|Squarespace|Shopify|Webflow)\b/gi, "").trim();
        addTerm(cleanP, getPolicyDefinition(cleanP, name), "Conformité");
    });

    securityMeasures.forEach(sm => {
        if (typeof sm !== 'string') return;
        const cleanSm = sm.replace(/\bde\s+(Wix|WordPress|Squarespace|Shopify|Webflow)\b/gi, "").trim();
        addTerm(cleanSm, `Mesure de sécurité déployée par ${name} pour la protection des données et des systèmes. Signal de fiabilité technique.`, "Sécurité");
    });

    if (audience) {
        // Bug fix: UNE SEULE entrée "Public cible" qui liste tous les segments,
        // au lieu d'une entrée par segment individuel
        const segments = audience.split(',').map(s => s.trim()).filter(Boolean);
        addTerm("Public cible", `${name} s'adresse aux ${segments.join(", ")}. Ces segments déterminent les contextes de recommandation IA pertinents (recherche locale, matching expert, comparaison sectorielle).`, "Audience");
    }

    addTerm("ASR (AI Singular Record)", "Fichier JSON-LD structuré et signé cryptographiquement (Ed25519) qui constitue l'identité sémantique officielle d'une entité. L'ASR est le document de référence consulté par les agents IA pour recommander, comparer ou présenter une organisation de manière fiable.", "Écosystème AYO");
    addTerm("AIO (Artificial Intelligence Optimization)", "Score de 0 à 100 mesurant la lisibilité sémantique d'une entité par les IA génératives. Calculé sur 7 blocs pondérés : Identité (10), Offre (20), Processus (15), Conformité (15), Indicateurs (20), Pédagogie (10), Technique (10).", "Écosystème AYO");
    addTerm("AYA (AYO Authority Registry)", "Registre officiel des entités certifiées AYO. L'inscription AYA atteste qu'une entité a été analysée, scorée, et que son ASR est authentique, signé et à jour.", "Écosystème AYO");
    addTerm("Pack AYO PRO", "Ensemble de 5 fichiers sémantiques (ASR, manifest, FAQ, glossaire, contexte externe) livrés à une entité pour optimiser sa visibilité auprès des agents IA. Inclut 3 ans d'inscription au registre AYA.", "Écosystème AYO");

    return {
        "@context": "https://schema.org",
        "@type": "DefinedTermSet",
        name: `Glossaire Officiel - ${name}`,
        version: "AYO-GLOSSARY-2.0",
        description: `Vocabulaire métier officiel ${nameArticleG}, utilisé comme référence par les agents IA pour interpréter les données sémantiques de cette entité.`,
        inLanguage: "fr",
        numberOfTerms: terms.length,
        hasDefinedTerm: terms.map(item => ({
            "@type": "DefinedTerm",
            name: item.term,
            description: item.def,
            inDefinedTermSet: item.category
        }))
    };
}

// --- GENERATOR: external_context.json ---
export function generateExternalContextJsonLocal(data: any, url?: string): any {
    const name = cleanVal(data.identite?.name?.value) || "Entreprise";
    const rawBTec = sanitizeFieldValue(cleanVal(data.identite?.business_type?.value));
    const businessType = fixUnmatchedBrackets(sanitizeBusinessType(rawBTec || "", "Activité non spécifiée"));
    const useCases = sanitizeFieldArray(cleanArray(data.offre?.use_cases?.value));
    const products = sanitizeFieldArray(cleanArray(data.offre?.products?.value));
    const rawAudienceEC = sanitizeFieldValue(cleanVal(data.offre?.target_audience?.value));
    const audience = rawAudienceEC ? sanitizeAudience(rawAudienceEC) : "";
    const city = sanitizeFieldValue(cleanVal(data.identite?.city?.value)) || "";
    const country = sanitizeFieldValue(cleanVal(data.identite?.country?.value)) || "";
    const email = data.identite?.contact_email?.value || "";
    const rawPhoneExt = (data.identite?.contact_phone?.value || "").toString().trim();
    const phone = PHONE_REGEX.test(rawPhoneExt) ? rawPhoneExt : "";
    const certifications = sanitizeFieldArray(cleanArray(data.engagements_conformite?.certifications?.value));
    const frameworks = sanitizeFieldArray(cleanArray(data.engagements_conformite?.frameworks?.value));
    const policies = sanitizeFieldArray(cleanArray(data.engagements_conformite?.policies?.value));
    const processSteps = sanitizeFieldArray(cleanArray(data.processus_methodes?.process_steps?.value));
    const deliveryMode = sanitizeFieldValue(cleanVal(data.processus_methodes?.delivery_mode?.value)) || "";
    const geographies = sanitizeFieldValue(cleanVal(data.processus_methodes?.geographies_served?.value)) || "";
    const rawQAec = data.processus_methodes?.quality_assurance?.value;
    const qualityAssuranceRaw: string[] = Array.isArray(rawQAec)
        ? rawQAec.filter((s: any) => typeof s === 'string' && s.trim()).map((s: string) => s.trim())
        : (typeof rawQAec === 'string' && rawQAec.trim())
            ? rawQAec.split(',').map((s: string) => s.trim()).filter(Boolean)
            : [];
    const qualityAssurance = sanitizeFieldArray(qualityAssuranceRaw);
    const keyIndicators = sanitizeFieldArray(cleanArray(data.indicateurs?.key_indicators?.value));
    const rawHasFaqEC = data.contenus_pedagogiques?.has_faq?.value;
    const hasFaq = (rawHasFaqEC === "__SKIPPED__" || rawHasFaqEC === "[SKIP] Non applicable") ? false : rawHasFaqEC;
    const rawHasDocEC = data.contenus_pedagogiques?.has_documentation?.value;
    const hasDoc = (rawHasDocEC === "__SKIPPED__" || rawHasDocEC === "[SKIP] Non applicable") ? false : rawHasDocEC;
    const rawHasGlossaryEC = data.contenus_pedagogiques?.has_glossary?.value;
    const hasGlossaryEC = (rawHasGlossaryEC === "__SKIPPED__" || rawHasGlossaryEC === "[SKIP] Non applicable") ? false : rawHasGlossaryEC;

    const declaredKeywords = toArray(data.external_context?.keywords?.value).filter((k: any) => k !== "__SKIPPED__");
    const declaredIntents = toArray(data.external_context?.intents?.value).filter((i: any) => i !== "__SKIPPED__");

    const addUnique = (arr: string[], val: string) => {
        if (typeof val !== 'string' || val.length < 2) return;
        // Ne pas ajouter de valeurs garbage comme keywords
        if (sanitizeFieldValue(val) === null) return;
        const lower = val.toLowerCase().trim();
        if (!arr.some(existing => existing.toLowerCase().trim() === lower)) arr.push(val.trim());
    };

    const discoveryKeywords: string[] = [];
    declaredKeywords.slice(0, 15).forEach(k => {
        if (typeof k !== 'string') return;
        if (k.includes(',')) {
            k.split(',').map(s => s.trim()).filter(Boolean).forEach(sub => addUnique(discoveryKeywords, sub));
        } else {
            addUnique(discoveryKeywords, k);
        }
    });
    // Products as keywords (short names only — long descriptions are NOT keywords)
    products.slice(0, 10).forEach(p => {
        if (typeof p === 'string' && p.length <= 50) addUnique(discoveryKeywords, p);
    });
    // Audience segments as keywords (split by comma, short segments only)
    if (audience) {
        audience.split(',').map((s: string) => s.trim()).filter(Boolean).forEach(seg => {
            if (seg.length <= 50) addUnique(discoveryKeywords, seg);
        });
    }
    if (city) addUnique(discoveryKeywords, city);
    // Business type as keyword
    if (businessType && businessType.length <= 60) addUnique(discoveryKeywords, businessType);

    const intentKeywords: string[] = [];
    declaredIntents.slice(0, 15).forEach(i => {
        if (typeof i !== 'string') return;
        // Ne PAS splitter les questions (contiennent ?) — ce sont des intents complets
        if (i.includes('?')) {
            addUnique(intentKeywords, i);
        } else if (i.includes(',')) {
            i.split(',').map(s => s.trim()).filter(Boolean).forEach(sub => addUnique(intentKeywords, sub));
        } else {
            addUnique(intentKeywords, i);
        }
    });
    useCases.slice(0, 10).forEach(uc => addUnique(intentKeywords, uc));

    const primaryChannels: string[] = ["Site web"];
    const secondaryChannels: string[] = [];
    if (email) secondaryChannels.push("Email");
    if (phone) secondaryChannels.push("Telephone");
    if (deliveryMode) {
        const dm = deliveryMode.toLowerCase();
        if (dm.includes("ligne") || dm.includes("remote") || dm.includes("digital") || dm.includes("visio") || dm.includes("web") || dm.includes("plateforme") || dm.includes("online")) primaryChannels.push("En ligne");
        if (dm.includes("site") || dm.includes("presen") || dm.includes("atelier")) primaryChannels.push("Sur site");
    }

    const reputationEnabled = certifications.length > 0 || qualityAssurance.length > 0 || keyIndicators.length > 0;
    const reputationSources: string[] = [];
    if (certifications.length > 0) reputationSources.push("certifications_declared");
    if (qualityAssurance.length > 0) reputationSources.push("quality_assurance_declared");
    if (keyIndicators.length > 0) reputationSources.push("performance_indicators");
    if (policies.length > 0) reputationSources.push("compliance_policies");

    const geoContext: any = {};
    if (city || country) {
        geoContext.primary_market = `${city}${city && country ? ", " : ""}${country}`.trim();
    }
    if (geographies) geoContext.served_areas = geographies;
    // Si delivery_mode est en ligne mais geographies ne mentionne pas "International", ajouter une note
    const dmLower = deliveryMode.toLowerCase();
    const isOnline = dmLower.includes("ligne") || dmLower.includes("online") || dmLower.includes("remote") || dmLower.includes("digital") || dmLower.includes("web");
    if (isOnline) {
        const geoLower = (geographies || "").toLowerCase();
        if (!geoLower.includes("international") && !geoLower.includes("mondial") && !geoLower.includes("world")) {
            geoContext.delivery_note = "Service disponible en ligne — portée potentiellement internationale";
        }
    }

    return {
        meta: {
            layer: "external_context",
            version: "2.0",
            status: "active",
            generated_at: new Date().toISOString().split('T')[0],
            source: "ayo-chatbot",
            entity: name,
            canonical_url: url || ""
        },
        ecosystem_presence: {
            business_type: businessType,
            platform_types: (() => {
                const types: string[] = ["web"];
                const dm = deliveryMode.toLowerCase();
                if (dm.includes("mobile") || dm.includes("app")) types.push("mobile");
                if (dm.includes("saas") || dm.includes("plateforme") || dm.includes("platform")) types.push("SaaS");
                if (dm.includes("api")) types.push("API");
                if (dm.includes("presen") || dm.includes("site") || dm.includes("atelier") || dm.includes("physique")) types.push("sur site");
                if (dm.includes("visio") || dm.includes("remote") || dm.includes("ligne") || dm.includes("online") || dm.includes("digital")) types.push("en ligne");
                return [...new Set(types)];
            })(),
            geographic_context: geoContext,
            declared_by_client: true
        },
        reputation_signals: {
            enabled: reputationEnabled,
            trust_indicators: {
                certifications: certifications,
                quality_assurance: qualityAssurance,
                key_metrics: keyIndicators,
                compliance_frameworks: frameworks
            },
            sources: reputationSources,
            policy: "declared_metrics_only"
        },
        content_signals: {
            has_faq: !!hasFaq,
            has_glossary: !!hasGlossaryEC,
            has_documentation: !!hasDoc,
            educational_content: (hasFaq || hasGlossaryEC || hasDoc) ? "available" : "minimal",
            process_transparency: (processSteps.length > 0 || deliveryMode) ? "documented" : "undisclosed"
        },
        keywords_context: {
            discovery_keywords: sanitizeKeywords(discoveryKeywords),
            intent_keywords: sanitizeKeywords(intentKeywords),
            audience_segments: audience ? audience.split(",").map((s: string) => s.trim()).filter(Boolean) : [],
            source: "declared + analysis"
        },
        access_channels: {
            primary: primaryChannels,
            secondary: secondaryChannels,
            delivery_modes: deliveryMode
                ? deliveryMode.split(/[,;\/]/).map((m: string) => m.trim()).filter(Boolean)
                : []
        },
        usage_permissions: {
            allow_listing: true,
            allow_comparison: true,
            allow_best_of: true,
            allow_intent_matching: true,
            allow_geographic_targeting: !!city || !!country,
            data_freshness: "quarterly_review"
        },
        sunset_policy: {
            removable: true,
            retention: "3_years_aya_registration",
            review_cycle: "annual"
        }
    };
}
