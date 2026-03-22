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
    // Clean trailing "..." (truncation markers)
    let cleaned = str.replace(/\.{3,}$/g, '').replace(/\.{3,}\s*\)$/g, ')');
    // Remove orphan closing brackets at the end (e.g. "Ernie...)")
    // by tracking balance
    const openers = ['(', '[', '{'];
    const closers = [')', ']', '}'];
    // First pass: remove orphan closers (no matching opener)
    const result: string[] = [];
    const stack: number[] = []; // indices of unmatched openers
    for (let i = 0; i < cleaned.length; i++) {
        const ch = cleaned[i];
        const oi = openers.indexOf(ch);
        if (oi !== -1) {
            stack.push(result.length);
            result.push(ch);
        } else {
            const ci = closers.indexOf(ch);
            if (ci !== -1) {
                if (stack.length > 0) {
                    stack.pop(); // matched
                    result.push(ch);
                }
                // else: orphan closer, skip it
            } else {
                result.push(ch);
            }
        }
    }
    // Second pass: close any remaining open brackets
    let finalStr = result.join('');
    const stack2: string[] = [];
    for (const ch of finalStr) {
        const oi = openers.indexOf(ch);
        if (oi !== -1) stack2.push(closers[oi]);
        else {
            const ci = closers.indexOf(ch);
            if (ci !== -1 && stack2.length > 0 && stack2[stack2.length - 1] === ch) stack2.pop();
        }
    }
    return finalStr + stack2.reverse().join('');
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
    return toArray(val).map(s => fixUnmatchedBrackets(cleanText(s)));
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

/**
 * Bug 8: Nettoie les doubles ponctuations (ex: "demandées.." → "demandées.")
 */
export function cleanDoublePunctuation(s: string): string {
    if (!s || typeof s !== 'string') return s || "";
    return s
        .replace(/([.!?;,:])\1+/g, '$1')  // "demandées.." → "demandées."
        .replace(/\s([.!?;,:])/g, '$1')    // espace avant ponctuation
        .replace(/([.!?])\s*([.!?])/g, '$1') // "text. ." → "text."
        .trim();
}

/**
 * Bug 4 & 9: Fusionne les noms d'IA (Gemini, Claude, Mistral, Llama, Ernie) dans un seul cas d'usage.
 * Si un use_case mentionne "ChatGPT", tous les noms d'IA sont regroupés dans celui-ci.
 */
const AI_NAMES_RE = /\b(ChatGPT|Gemini|Claude|Mistral|Llama|Ernie|GPT[-\s]?4|Perplexity|Copilot)\b/i;
const ALL_AI_NAMES = ["ChatGPT", "Gemini", "Claude", "Mistral", "Llama", "Ernie"];

export function mergeAiNamesInUseCases(useCases: string[]): string[] {
    if (!useCases || useCases.length === 0) return useCases;

    // Find if any use case mentions an AI name
    const aiUseCaseIndex = useCases.findIndex(uc => AI_NAMES_RE.test(uc));
    if (aiUseCaseIndex === -1) return useCases;

    // Collect all AI names mentioned across all use cases
    const mentionedAiNames = new Set<string>();
    const nonAiUseCases: string[] = [];
    let primaryAiUseCase = "";

    for (let i = 0; i < useCases.length; i++) {
        const uc = useCases[i];
        // Check if this use case is ONLY an AI name (e.g. "Gemini", "Claude")
        const isOnlyAiName = ALL_AI_NAMES.some(name => uc.trim().toLowerCase() === name.toLowerCase());
        if (isOnlyAiName) {
            mentionedAiNames.add(uc.trim());
            continue;
        }
        // Check if it mentions an AI name as part of a real use case
        if (AI_NAMES_RE.test(uc)) {
            if (!primaryAiUseCase) {
                primaryAiUseCase = uc;
                // Extract AI names mentioned in this use case
                for (const name of ALL_AI_NAMES) {
                    if (uc.toLowerCase().includes(name.toLowerCase())) {
                        mentionedAiNames.add(name);
                    }
                }
            } else {
                // Secondary AI use case — extract names and skip
                for (const name of ALL_AI_NAMES) {
                    if (uc.toLowerCase().includes(name.toLowerCase())) {
                        mentionedAiNames.add(name);
                    }
                }
            }
        } else {
            nonAiUseCases.push(uc);
        }
    }

    if (!primaryAiUseCase && mentionedAiNames.size > 0) {
        // All were standalone AI names — create meaningful use cases instead of listing names
        const aiList = ALL_AI_NAMES.filter(n => mentionedAiNames.has(n));
        for (const name of ALL_AI_NAMES) {
            if (!aiList.includes(name)) aiList.push(name);
        }
        const aiListStr = aiList.join(", ");
        // Return 3 meaningful use cases instead of just one with AI names
        return [
            `Être visible et recommandé par les IA génératives (${aiListStr})`,
            "Structurer les informations d'une entité pour les agents IA",
            "Créer une identité sémantique exploitable par les assistants IA",
            ...nonAiUseCases
        ];
    } else if (primaryAiUseCase && mentionedAiNames.size > 0) {
        // Ensure all AI names are in the primary use case
        const allAiList = ALL_AI_NAMES.filter(n =>
            mentionedAiNames.has(n) || primaryAiUseCase.toLowerCase().includes(n.toLowerCase())
        );
        // Add missing AI names that weren't mentioned
        for (const name of ALL_AI_NAMES) {
            if (!allAiList.includes(name)) allAiList.push(name);
        }
        // Replace the AI names part in the primary use case
        const aiListStr = allAiList.join(", ");
        // Try to find existing parenthetical with AI names and replace it
        const parenMatch = primaryAiUseCase.match(/\([^)]*(?:ChatGPT|Gemini|Claude)[^)]*\)/i);
        if (parenMatch) {
            primaryAiUseCase = primaryAiUseCase.replace(parenMatch[0], `(${aiListStr})`);
        } else {
            // Append AI names
            primaryAiUseCase = primaryAiUseCase.replace(/\.?\s*$/, ` (${aiListStr})`);
        }
    }

    const result = primaryAiUseCase ? [primaryAiUseCase, ...nonAiUseCases] : nonAiUseCases;
    return result;
}

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
    // Limite élargie à 300 chars pour ne pas tronquer les audiences riches
    // (ex: "PME innovantes, acteurs engagés RSE/ESG, établissements publics")
    if (trimmed.length >= 295) {
        return fixUnmatchedBrackets(truncateOnSeparator(trimmed, 300));
    }
    // Toujours fermer les parenthèses/crochets non fermés
    return fixUnmatchedBrackets(trimmed);
}

/**
 * Sanitize keywords: filter out items that are full sentences (>60 chars)
 * Keywords should be short phrases, not full descriptions
 */
export function sanitizeKeywords(items: string[], maxLen: number = 80): string[] {
    return items.filter(k => k.length <= maxLen && !/[a-zA-Z0-9-]+\.(com|org|net|io|fr|ch)/i.test(k));
}

// --- DATA QUALITY HELPERS ---

/** Bug 1: Filter out garbage array entries like "Etc.", "etc.", "...", "" */
const GARBAGE_ENTRY_RE = /^(etc\.?|\.{2,}|\s*)$/i;
export function filterGarbageEntries(arr: string[]): string[] {
    return arr.filter(s => {
        const trimmed = s.trim();
        if (GARBAGE_ENTRY_RE.test(trimmed)) return false;
        // Filter out corrupted/truncated fragments (less than 3 chars, unless it's an acronym like "IA")
        if (trimmed.length < 3 && !/^[A-Z]{2,}$/.test(trimmed)) return false;
        return true;
    });
}

/** Bug 2: Normalize ALL CAPS strings to Title Case. "MONDE" → "Monde entier", "FOO BAR" → "Foo bar" */
export function normalizeCase(str: string): string {
    if (!str || typeof str !== 'string') return str || "";
    const trimmed = str.trim();
    // Special case: "MONDE" → "International"
    if (/^MONDE$/i.test(trimmed) && trimmed === trimmed.toUpperCase()) return "International";
    // Only transform if the string is ALL CAPS (at least 4 chars, ignoring numbers/symbols)
    const letters = trimmed.replace(/[^a-zA-ZÀ-ÿ]/g, '');
    if (letters.length >= 4 && letters === letters.toUpperCase()) {
        // Capitalize first letter, lowercase the rest
        return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
    }
    return trimmed;
}

/** Bug 3: Strip leading numbered prefixes like "1. ", "2. ", "10. " */
export function stripNumberedPrefix(str: string): string {
    if (!str || typeof str !== 'string') return str || "";
    return str.replace(/^\d+\.\s+/, '').trim();
}

/** Bug 4: Truncate security_measures entries to max 100 chars, cut at last period or comma */
export function truncateSecurity(str: string, maxLen: number = 100): string {
    if (!str || str.length <= maxLen) return str;
    const sub = str.substring(0, maxLen);
    // Find last period or comma before the limit
    const lastPeriod = sub.lastIndexOf('.');
    const lastComma = sub.lastIndexOf(',');
    const cutAt = Math.max(lastPeriod, lastComma);
    if (cutAt > 0) return sub.substring(0, cutAt + 1).trim();
    // Fallback: cut at last space
    const lastSpace = sub.lastIndexOf(' ');
    if (lastSpace > 0) return sub.substring(0, lastSpace).trim();
    return sub.trim();
}

/** Split security_measures entries longer than 80 chars into concise items at natural breakpoints */
export function splitLongSecurityEntries(entries: string[]): string[] {
    const result: string[] = [];
    for (const entry of entries) {
        if (entry.length <= 80) {
            result.push(entry);
            continue;
        }
        // Split at commas or periods, keep items that are meaningful (>10 chars)
        const parts = entry.split(/[,.]/).map(s => s.trim()).filter(s => s.length > 10);
        if (parts.length > 1) {
            for (const part of parts) {
                // Capitalize first letter
                const capitalized = part.charAt(0).toUpperCase() + part.slice(1);
                result.push(capitalized.length > 80 ? truncateSecurity(capitalized, 80) : capitalized);
            }
        } else {
            // No natural breakpoint: truncate on word boundary at 80 chars
            result.push(truncateSecurity(entry, 80));
        }
    }
    return result;
}

/** Bug 5: Filter out standalone AI model names from contextualRelevance */
const AI_MODEL_NAMES_RE = /^(Gemini|Claude|Mistral|Llama|Ernie|ChatGPT|GPT|Perplexity)$/i;
export function filterAiModelNames(arr: string[]): string[] {
    return arr.filter(s => !AI_MODEL_NAMES_RE.test(s.trim()));
}

/** Bug 7: Filter out glossary terms where name is "Etc." or similar */
export function isGarbageGlossaryTerm(term: string): boolean {
    return GARBAGE_ENTRY_RE.test(term.trim());
}

/** Bug 8: Fix ASR glossary term description */
const ASR_CANONICAL_DESCRIPTION = "AI Singular Record — fichier JSON-LD structuré et signé cryptographiquement constituant l'identité sémantique officielle d'une entité auprès des agents IA.";

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

/** Strip diacritics so "mentions legales" matches "mentions légales" */
function stripAccents(s: string): string {
    return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function getPolicyDefinition(policy: string, entityName: string): string {
    const lower = stripAccents(policy.toLowerCase().trim());
    for (const [key, def] of Object.entries(POLICY_DEFINITIONS)) {
        if (lower.includes(stripAccents(key))) return def;
    }
    return `Politique de conformité ${/^[aeiouhAEIOUHéÉàÀ]/.test(entityName) ? `d'${entityName}` : `de ${entityName}`} contribuant à la transparence et à la gouvernance de l'entité.`;
}

/**
 * Security-measure-specific definitions for glossary.
 * Each common security measure gets a unique, specific description.
 */
const SECURITY_DEFINITIONS: Record<string, string> = {
    'charte ethique': "Document formalisant les engagements éthiques et déontologiques de l'entité, notamment en matière d'usage responsable de l'IA, de transparence algorithmique et de respect des droits des utilisateurs.",
    'charte éthique': "Document formalisant les engagements éthiques et déontologiques de l'entité, notamment en matière d'usage responsable de l'IA, de transparence algorithmique et de respect des droits des utilisateurs.",
    'mesures de securite informatique': "Ensemble de dispositifs techniques et organisationnels (pare-feu, chiffrement, contrôle d'accès, audits réguliers) déployés pour protéger les systèmes d'information contre les cybermenaces et les accès non autorisés.",
    'mesures de sécurité informatique': "Ensemble de dispositifs techniques et organisationnels (pare-feu, chiffrement, contrôle d'accès, audits réguliers) déployés pour protéger les systèmes d'information contre les cybermenaces et les accès non autorisés.",
    'donnees publiques uniquement': "Engagement à ne collecter et traiter que des données accessibles publiquement, sans recours à des données personnelles privées ni à des techniques d'extraction non consenties.",
    'données publiques uniquement': "Engagement à ne collecter et traiter que des données accessibles publiquement, sans recours à des données personnelles privées ni à des techniques d'extraction non consenties.",
    'chiffrement': "Technique de sécurité transformant les données en un format illisible sans clé de déchiffrement, assurant la confidentialité des informations stockées et transmises.",
    'pare-feu': "Dispositif de sécurité réseau filtrant le trafic entrant et sortant selon des règles prédéfinies afin de bloquer les accès non autorisés.",
    'firewall': "Dispositif de sécurité réseau filtrant le trafic entrant et sortant selon des règles prédéfinies afin de bloquer les accès non autorisés.",
    'sauvegarde': "Procédure de copie régulière des données et systèmes permettant la restauration en cas d'incident, de panne ou de cyberattaque.",
    'backup': "Procédure de copie régulière des données et systèmes permettant la restauration en cas d'incident, de panne ou de cyberattaque.",
    'authentification': "Mécanisme de vérification de l'identité d'un utilisateur avant l'accès aux ressources, pouvant inclure des facteurs multiples (mot de passe, biométrie, token).",
    'audit': "Évaluation systématique et documentée de la conformité et de l'efficacité des mesures de sécurité, réalisée périodiquement pour identifier les vulnérabilités.",
    'anonymisation': "Processus irréversible de suppression des informations identifiantes dans un jeu de données, rendant impossible la ré-identification des personnes concernées.",
    'pseudonymisation': "Technique de protection des données remplaçant les identifiants directs par des pseudonymes, réduisant les risques tout en permettant certains traitements.",
};

function getSecurityDefinition(measure: string, entityName: string): string {
    const lower = stripAccents(measure.toLowerCase().trim());
    for (const [key, def] of Object.entries(SECURITY_DEFINITIONS)) {
        if (lower.includes(stripAccents(key))) return def;
    }
    return `Mesure de sécurité déployée par ${entityName} pour la protection des données et des systèmes. Signal de fiabilité technique dans le cadre de l'évaluation AIO.`;
}

const BUSINESS_TYPE_PLACEHOLDER_RE = /^(type schema\.?org|schema\.?org|organisation|organization|non spécifié|activité non spécifiée|n\/a|undefined|null|)$/i;
export function sanitizeBusinessType(val: string, fallback: string = ""): string {
    if (!val || BUSINESS_TYPE_PLACEHOLDER_RE.test(val.trim())) return fallback;
    return val;
}

// --- SANITIZER: Remove ALL template/placeholder values AND confirmation phrases ---
const TEMPLATE_RE = /^(Ex:|type schema\.?org|schema\.?org|organisation|organization|activité non spécifiée|premium\/standard\/undisclosed|public\/membersOnly|eligible\/uncertain|✅\/⚠️\/❌|gym near me|Centre en ville|Recherche Salle|No City Found|undisclosed|non spécifié|n\/a)$/i;
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

/**
 * Champs protégés : ne JAMAIS les supprimer via sanitizePayloadDeep
 * s'ils contiennent une valeur non-placeholder.
 * business_type est critique — des valeurs comme "Optimisation pour l'Intelligence Artificielle (AIO)"
 * sont légitimes et ne doivent pas être traitées comme du garbage.
 */
const PROTECTED_FIELDS = new Set([
    'business_type',
    'name',
    'contact_email',
    'contact_phone',
    'city',
    'country',
]);

/** Sanitize the full extract data — remove all template placeholders */
export function sanitizeExtract(ext: Record<string, any>): { cleaned: Record<string, any>; cleanedFields: string[] } {
    const cleanedFields: string[] = [];
    for (const blockName of Object.keys(ext)) {
        const block = ext[blockName];
        if (typeof block === 'object' && block !== null) {
            for (const fieldName of Object.keys(block)) {
                const field = block[fieldName];
                if (field && typeof field === 'object' && 'value' in field) {
                    // Champs protégés : on ne les nettoie que s'ils sont vides ou strictement placeholder
                    if (PROTECTED_FIELDS.has(fieldName)) {
                        const val = field.value;
                        // Seules les valeurs strictement vides ou placeholder reconnues sont nettoyées
                        if (typeof val === 'string' && val.trim() !== '' && !isTemplate(val)) {
                            continue; // valeur légitime → on ne touche pas
                        }
                    }
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
    const dataFrameworks = sanitizeFieldArray(cleanArray(data.engagements_conformite?.frameworks?.value));
    const dataPolicies = sanitizeFieldArray(cleanArray(data.engagements_conformite?.policies?.value));
    const country = sanitizeFieldValue(cleanVal(data.identite?.country?.value)) || "";

    const isAssoManifest = isAssociation(businessType, name, url);
    const lowerMBT = businessType.toLowerCase();
    const manifestEntityType = isAssoManifest ? "NonProfitOrganization" : (lowerMBT.includes("cabinet") || lowerMBT.includes("bureau") ? "ProfessionalService" : "Organization");

    const scope = services.length > 0 ? services.slice(0, 5) : ["Services professionnels"];
    scope.push("AI Singular Record (ASR)");

    // Build compliance frameworks from actual data instead of hardcoding
    const complianceSignals: string[] = [];
    // 1. Use frameworks declared in the ASR data
    if (dataFrameworks.length > 0) {
        complianceSignals.push(...dataFrameworks);
    } else {
        // 2. Infer GDPR only if policies mention RGPD or Confidentialité
        const policiesLower = dataPolicies.map((p: string) => p.toLowerCase()).join(' ');
        if (policiesLower.includes('rgpd') || policiesLower.includes('confidentialit')) {
            complianceSignals.push("GDPR");
        }
    }
    if (certifications.some(c => typeof c === 'string' && c.toLowerCase().includes("iso"))) complianceSignals.push("ISO");

    // Bug 14: If user declared certifications (q > 0) but provided no proof, set count to 0
    const certQ = data.engagements_conformite?.certifications?.q ?? 0;
    const certCount = certifications.length;
    const certCountFinal = (certCount === 0 && certQ > 0) ? 0 : certCount;

    return {
        entity: {
            name,
            type: manifestEntityType,
            ...(businessType !== "Organization" ? { additionalType: businessType } : {}),
            canonicalUrl: url,
            verified: "self_declared",
            registry: "AYA"
        },
        authority: {
            role: "declared-entity",
            scope,
            level: "PRO",
            certifications_count: certCountFinal,
            ...(certCount === 0 && certQ > 0 ? { certifications_declared_without_proof: true } : {})
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
        trustPolicy: {
            evidence_level: "self_declared_structured",
            third_party_audit: false,
            interpretation_mode: "signals_only"
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
            registryUrl: joinUrl(url, "aya")
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
    const useCases = mergeAiNamesInUseCases(sanitizeFieldArray(cleanArray(data.offre?.use_cases?.value)));
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
    const securityMeasures = filterGarbageEntries(sanitizeFieldArray(cleanArray(data.engagements_conformite?.security_measures?.value))
        .map(truncateSecurity));
    const NO_DATA_PHRASES_FAQ = /^(pas encore|aucun|non applicable|pas de|n\/a|rien|néant|none|pas disponible|je n'ai pas|nous n'avons pas)/i;
    const keyIndicators = filterGarbageEntries(sanitizeFieldArray(cleanArray(data.indicateurs?.key_indicators?.value))
        .filter((ind: string) => !NO_DATA_PHRASES_FAQ.test(ind.trim()))
        .map(normalizeCase));
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
        ? (() => {
            const btLower = businessType.toLowerCase();
            // "le bureau/cabinet X"
            if (btLower.startsWith("bureau") || btLower.startsWith("cabinet")) return ` spécialisée dans le ${btLower}`;
            // Already has article: "la formation", "le conseil", "les services"
            if (/^(la |le |les |l')/.test(btLower)) return ` spécialisée dans ${btLower}`;
            // Vowel-starting: "optimisation" → "l'optimisation"
            if (/^[aeiouhéèêëàâäôöùûüîïœæ]/i.test(btLower)) return ` spécialisée dans l'${btLower}`;
            // Consonant-starting: add "le" as generic article
            return ` spécialisée dans le ${btLower}`;
        })()
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
            a: `${name} propose ${services.length > 1 ? "plusieurs services" : "un service principal"} : ${services.join(", ")}.${products.length > 0 ? ` L'offre inclut également : ${products.join(", ")}.` : ""}`.trim(),
            category: "Offre"
        });
    }

    if (useCases.length > 0) {
        // Filter out "Etc." and reformulate naturally
        const cleanUseCases = useCases.filter(uc => !/^etc\.?$/i.test(uc.trim()));
        const activity = businessType && businessType !== "Organization" ? businessType.toLowerCase() : "son activité";
        qna.push({
            q: `Dans quelles situations faire appel à ${name} ?`,
            a: `${name} peut accompagner une entité qui souhaite ${cleanUseCases.length > 0 ? cleanUseCases.map(uc => uc.charAt(0).toLowerCase() + uc.slice(1)).join(", ") : `améliorer sa lisibilité auprès des IA, structurer ses informations en format sémantique et renforcer sa présence dans le registre AYA`}.`.trim(),
            category: "Offre"
        });
    }

    if (audience) {
        const segments = audience.split(',').map(s => s.trim()).filter(Boolean);
        qna.push({
            q: `À qui s'adresse ${name} ?`,
            a: segments.length > 1
                ? `L'offre ${nameArticle} cible ${segments.length} segments : ${segments.join(", ")}.`
                : `L'offre ${nameArticle} est conçue pour les ${audience.toLowerCase()}.`,
            category: "Offre"
        });
    }

    // --- PROCESSUS ---
    if (processSteps.length > 0) {
        qna.push({
            q: `Quelle est la méthodologie ${nameArticle} ?`,
            a: `Le processus se déroule en ${processSteps.length} étapes : ${processSteps.join(", puis ")}.${deliveryMode ? ` Mode d'intervention : ${deliveryMode}.` : ""}${qualityAssurance ? ` Engagement qualité : ${qualityAssurance}.` : ""}`.trim(),
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
            a: `${policies.length > 0 ? `Politiques en vigueur : ${policies.join(", ")}. ` : ""}${securityMeasures.length > 0 ? `Mesures de sécurité déployées : ${securityMeasures.join(", ")}.` : ""}`.trim(),
            category: "Conformité"
        });
    }

    // --- INDICATEURS ---
    if (keyIndicators.length > 0) {
        // Check if indicators have concrete numeric values
        const hasConcreteValuesFaq = keyIndicators.some(ind => /\d/.test(ind));
        qna.push({
            q: `Quels sont les indicateurs d'impact ${nameArticle} ?`,
            a: hasConcreteValuesFaq
                ? `Les indicateurs clés ${nameArticle} incluent : ${keyIndicators.join(", ")}. Ces métriques témoignent de l'impact concret et de la qualité des interventions.`
                : `${name} déclare suivre ${keyIndicators.length > 1 ? "les indicateurs suivants" : "l'indicateur suivant"} : ${keyIndicators.join(", ")}. La valeur publique n'est pas précisée dans les sources actuelles.`,
            category: "Indicateurs"
        });
    }

    // --- RESSOURCES PÉDAGOGIQUES ---
    const rawHasGlossary = data.contenus_pedagogiques?.has_glossary?.value;
    const hasGlossary = (rawHasGlossary === "__SKIPPED__" || rawHasGlossary === "[SKIP] Non applicable") ? false : rawHasGlossary;
    if (hasDoc || hasFaq || hasGlossary) {
        // When all 3 resources are available (PRO pack), use concise formulation tied to activity
        const allThreeAvailable = hasFaq && hasGlossary && hasDoc;
        const activityRef = businessType && businessType !== "Organization"
            ? businessType.toLowerCase()
            : "son activité";
        let resourceAnswer: string;
        if (allThreeAvailable) {
            resourceAnswer = `Oui. ${name} met à disposition une FAQ, un glossaire métier et une documentation liée à ${activityRef}.`;
        } else {
            const resParts: string[] = [];
            if (typeof hasDoc === 'string' && hasDoc !== "__SKIPPED__") resParts.push(`une documentation (${hasDoc})`);
            else if (hasDoc) resParts.push("une documentation complète");
            if (hasFaq) resParts.push("une FAQ pour répondre aux questions courantes");
            if (hasGlossary) resParts.push("un glossaire du vocabulaire métier");
            resourceAnswer = `Oui. ${name} met à disposition ${resParts.join(", ")}. Retrouvez ces ressources sur ${url}.`;
        }
        qna.push({
            q: `${name} propose-t-${isAssoFaq ? "elle" : "il"} des ressources pédagogiques ?`,
            a: resourceAnswer,
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
        a: `Contactez ${name} ${contactParts.join(", ")}.`,
        category: "Contact"
    });

    // --- AYO / VISIBILITÉ IA ---
    qna.push({
        q: `${name} est-${isAssoFaq ? "elle" : "il"} certifié${eAccord} AYO ?`,
        a: `Oui. ${name} a réalisé un diagnostic AYO complet et dispose d'un fichier ASR (AI Singular Record) signé cryptographiquement. Ce fichier permet aux agents IA (ChatGPT, Gemini, Claude, Perplexity) de comprendre précisément son activité et de ${isAssoFaq ? "la" : "le"} recommander de manière fiable. ${name} est enregistré${eAccord} dans le Registre AYA.`,
        category: "Visibilité IA"
    });

    // Bug 8: Clean double punctuation in all FAQ answers
    // Bug 9: merge AI names in use_cases for FAQ text (already merged via useCases variable)
    const mainEntity = qna.map(item => ({
        "@type": "Question",
        "name": item.q,
        "about": item.category,
        "acceptedAnswer": { "@type": "Answer", "text": cleanDoublePunctuation(item.a) }
    }));

    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "version": "AYO-FAQ-2.0",
        "entity": name,
        "url": url,
        "numberOfQuestions": mainEntity.length,
        "categories": [...new Set(qna.map(q => q.category))],
        "inLanguage": "fr",
        "mainEntity": mainEntity
    };
}

// --- GENERATOR: glossary.json ---
export function generateGlossaryJson(data: any): any {
    const name = cleanVal(data.identite?.name?.value) || "Entreprise";
    const rawBTgloss = sanitizeFieldValue(cleanVal(data.identite?.business_type?.value));
    const businessType = fixUnmatchedBrackets(sanitizeBusinessType(rawBTgloss || "", "Organization"));
    const services = sanitizeFieldArray(cleanArray(data.offre?.services?.value));
    const useCases = mergeAiNamesInUseCases(sanitizeFieldArray(cleanArray(data.offre?.use_cases?.value)));
    const certifications = sanitizeFieldArray(cleanArray(data.engagements_conformite?.certifications?.value));
    const processSteps = sanitizeFieldArray(cleanArray(data.processus_methodes?.process_steps?.value));
    const rawAudienceGloss = sanitizeFieldValue(cleanVal(data.offre?.target_audience?.value));
    const audience = rawAudienceGloss ? sanitizeAudience(rawAudienceGloss) : "";
    const city = sanitizeFieldValue(cleanVal(data.identite?.city?.value)) || "";
    const country = sanitizeFieldValue(cleanVal(data.identite?.country?.value)) || "";
    const policies = sanitizeFieldArray(cleanArray(data.engagements_conformite?.policies?.value));
    const frameworks = sanitizeFieldArray(cleanArray(data.engagements_conformite?.frameworks?.value));
    const securityMeasures = filterGarbageEntries(sanitizeFieldArray(cleanArray(data.engagements_conformite?.security_measures?.value))
        .map(truncateSecurity));

    const nameArticleG = /^[aeiouhAEIOUHéÉàÀ]/.test(name) ? `d'${name}` : `de ${name}`;

    const terms: { term: string; def: string; category: string }[] = [];
    const seen = new Set<string>();
    // Bug 11: AI names should NOT be separate glossary entries
    const AI_NAME_GLOSSARY_RE = /^(ChatGPT|Gemini|Claude|Mistral|Llama|Ernie|GPT[-\s]?4|Perplexity|Copilot)$/i;
    const addTerm = (term: string, def: string, category: string) => {
        // Ne jamais ajouter un terme garbage comme DefinedTerm
        if (sanitizeFieldValue(term) === null) return;
        // Bug 11: Skip standalone AI names as glossary terms
        if (AI_NAME_GLOSSARY_RE.test(term.trim())) return;
        // Bug 7: Skip "Etc.", "etc.", "..." garbage terms
        if (isGarbageGlossaryTerm(term)) return;
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

    // Bug 10: Each service MUST have a UNIQUE description — use the service name contextually
    const serviceDescTemplates = [
        (s: string) => `${s} est la prestation phare ${nameArticleG}. Ce service constitue le cœur de l'offre déclarée dans l'ASR et détermine le positionnement principal de l'entité.`,
        (s: string) => `${s} : service complémentaire proposé par ${name}. Cette prestation enrichit le périmètre d'intervention et la couverture fonctionnelle de l'entité.`,
        (s: string) => `${s} — activité spécialisée ${nameArticleG}. Ce volet de l'offre est documenté et vérifiable dans les actifs sémantiques AYO.`,
        (s: string) => `${s} fait partie de l'expertise déclarée par ${name}. Ce service permet de répondre à des besoins spécifiques identifiés dans le cadre de l'analyse AIO.`,
        (s: string) => `Prestation de ${s.toLowerCase()} assurée par ${name}. Ce service contribue à la diversification et à la complétude de l'offre globale de l'entité.`,
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
        // If the step is or contains "ASR", use the canonical ASR description
        if (/^ASR$/i.test(step.trim()) || /^Génération du fichier ASR/i.test(step.trim())) {
            addTerm(step, ASR_CANONICAL_DESCRIPTION, "Processus");
        } else {
            addTerm(step, processDescTemplates[i % processDescTemplates.length](step, i), "Processus");
        }
    });

    certifications.forEach(c => {
        if (typeof c !== 'string') return;
        const cLower = c.toLowerCase();
        // "Conformité RGPD" / "GDPR" is a declarative signal, not a certification/label
        if (cLower.includes('rgpd') || cLower.includes('gdpr') || cLower.includes('protection des données')) {
            addTerm(c, `Signal déclaratif de conformité relatif à la protection des données personnelles. Élément pris en compte dans l'évaluation de la lisibilité et de la confiance.`, "Conformité");
        } else {
            addTerm(c, `Certification ou label officiel détenu par ${name}. Signal de confiance évalué dans le scoring AIO (bloc Confiance & Conformité, pondéré à 15/100).`, "Conformité");
        }
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
        addTerm(cleanSm, getSecurityDefinition(cleanSm, name), "Sécurité");
    });

    if (audience) {
        // Bug fix: UNE SEULE entrée "Public cible" qui liste tous les segments,
        // au lieu d'une entrée par segment individuel
        const segments = audience.split(',').map(s => s.trim()).filter(Boolean);
        addTerm("Public cible", `${name} s'adresse aux ${segments.join(", ")}. Ces segments déterminent les contextes de recommandation IA pertinents (recherche locale, matching expert, comparaison sectorielle).`, "Audience");
    }

    addTerm("ASR (AI Singular Record)", "Fichier JSON-LD structuré et signé cryptographiquement (Ed25519) qui constitue l'identité sémantique officielle d'une entité. L'ASR est le document de référence consulté par les agents IA pour recommander, comparer ou présenter une organisation de manière fiable.", "Écosystème AYO");
    addTerm("AIO", "Artificial Intelligence Optimization — discipline qui consiste à optimiser la lisibilité d'une entité pour les IA génératives.", "Écosystème AYO");
    addTerm("AIO Score", "Score de 0 à 100 mesurant la lisibilité sémantique d'une entité par les IA génératives. Calculé sur 7 blocs pondérés : Identité, Offre, Processus, Conformité, Indicateurs, Pédagogie, Technique.", "Écosystème AYO");
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
        hasDefinedTerm: terms
            .filter(item => !isGarbageGlossaryTerm(item.term))
            .map(item => {
                // Bug 8: Fix bare "ASR" term with generic description
                let def = item.def;
                if (/^ASR$/i.test(item.term.trim()) && !item.def.includes("JSON-LD")) {
                    def = ASR_CANONICAL_DESCRIPTION;
                }
                return {
                    "@type": "DefinedTerm",
                    name: item.term,
                    description: def,
                    inDefinedTermSet: item.category
                };
            })
    };
}

// --- GENERATOR: external_context.json ---
export function generateExternalContextJsonLocal(data: any, url?: string): any {
    const name = cleanVal(data.identite?.name?.value) || "Entreprise";
    const rawBTec = sanitizeFieldValue(cleanVal(data.identite?.business_type?.value));
    const businessType = fixUnmatchedBrackets(sanitizeBusinessType(rawBTec || "", "Organisation"));
    const useCases = mergeAiNamesInUseCases(sanitizeFieldArray(cleanArray(data.offre?.use_cases?.value)));
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
    const NO_DATA_PHRASES_EC = /^(pas encore|aucun|non applicable|pas de|n\/a|rien|néant|none|pas disponible|je n'ai pas|nous n'avons pas)/i;
    const keyIndicators = filterGarbageEntries(sanitizeFieldArray(cleanArray(data.indicateurs?.key_indicators?.value))
        .filter((ind: string) => !NO_DATA_PHRASES_EC.test(ind.trim()))
        .map(normalizeCase));
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

    // Discovery keywords: qualité > quantité — max 10 keywords focalisés
    // Priorité : déclarés d'abord, puis 2-3 produits clés, puis ville
    // NE PAS ajouter tous les segments audience comme keywords individuels
    const MAX_DISCOVERY_KEYWORDS = 10;
    const discoveryKeywords: string[] = [];
    declaredKeywords.slice(0, 15).forEach(k => {
        if (typeof k !== 'string' || discoveryKeywords.length >= MAX_DISCOVERY_KEYWORDS) return;
        if (k.includes(',')) {
            k.split(',').map(s => s.trim()).filter(Boolean).forEach(sub => {
                if (discoveryKeywords.length < MAX_DISCOVERY_KEYWORDS) addUnique(discoveryKeywords, sub);
            });
        } else {
            addUnique(discoveryKeywords, k);
        }
    });
    // Products as keywords (2-3 clés max, short names only)
    products.slice(0, 3).forEach(p => {
        if (typeof p === 'string' && p.length <= 50 && discoveryKeywords.length < MAX_DISCOVERY_KEYWORDS) addUnique(discoveryKeywords, p);
    });
    // Ville comme keyword géographique
    if (city && discoveryKeywords.length < MAX_DISCOVERY_KEYWORDS) addUnique(discoveryKeywords, city);
    // Business type as keyword (skip generic fallback "Organisation")
    if (businessType && businessType !== "Organisation" && businessType.length <= 60 && discoveryKeywords.length < MAX_DISCOVERY_KEYWORDS) addUnique(discoveryKeywords, businessType);
    // Bug 12: Ensure minimum 8 discovery_keywords — complete with services and sector terms
    const MIN_DISCOVERY_KEYWORDS = 8;
    if (discoveryKeywords.length < MIN_DISCOVERY_KEYWORDS) {
        // Add remaining services as keywords
        const services = sanitizeFieldArray(cleanArray(data.offre?.services?.value));
        for (const svc of services) {
            if (discoveryKeywords.length >= MIN_DISCOVERY_KEYWORDS) break;
            if (typeof svc === 'string' && svc.length <= 60) addUnique(discoveryKeywords, svc);
        }
    }
    if (discoveryKeywords.length < MIN_DISCOVERY_KEYWORDS) {
        // Add use cases as keywords
        for (const uc of useCases) {
            if (discoveryKeywords.length >= MIN_DISCOVERY_KEYWORDS) break;
            if (typeof uc === 'string' && uc.length <= 60) addUnique(discoveryKeywords, uc);
        }
    }
    if (discoveryKeywords.length < MIN_DISCOVERY_KEYWORDS && country) {
        addUnique(discoveryKeywords, country);
    }
    if (discoveryKeywords.length < MIN_DISCOVERY_KEYWORDS && name) {
        addUnique(discoveryKeywords, name);
    }

    // Bug 13: Filter out generic intents like "Vendre des produits/services"
    const GENERIC_INTENT_RE = /^(vendre des produits|vendre des services|vendre des produits\/services|acheter|vente de produits|vente de services)$/i;
    const intentKeywords: string[] = [];
    declaredIntents.slice(0, 15).forEach(i => {
        if (typeof i !== 'string') return;
        if (GENERIC_INTENT_RE.test(i.trim())) return; // Skip generic intents
        // Ne PAS splitter les questions (contiennent ?) — ce sont des intents complets
        if (i.includes('?')) {
            addUnique(intentKeywords, i);
        } else if (i.includes(',')) {
            i.split(',').map(s => s.trim()).filter(Boolean).forEach(sub => {
                if (!GENERIC_INTENT_RE.test(sub.trim())) addUnique(intentKeywords, sub);
            });
        } else {
            addUnique(intentKeywords, i);
        }
    });
    // Bug 13: Use real use_cases as intents instead of generic "Vendre des produits/services"
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
            source: "ayo-structured-analysis",
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
            trust_level: "self_declared_structured",
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
            discovery_keywords: filterGarbageEntries(sanitizeKeywords(discoveryKeywords.map(stripNumberedPrefix))),
            intent_keywords: filterGarbageEntries(sanitizeKeywords(intentKeywords).map(stripNumberedPrefix)),
            audience_segments: filterGarbageEntries(audience ? audience.split(",").map((s: string) => s.trim()).filter(Boolean) : []),
            source: "declared_plus_structured_normalization"
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
