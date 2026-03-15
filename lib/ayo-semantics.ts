import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { AyoExtract } from './aio-score-engine';
import { createLogger, generateCorrelationId } from './logger';

/**
 * MODULE AYO-SEMANTICS (LE CERVEAU)
 * Responsabilité : Transformer la donnée brute du scanner en actifs IA riches et rédigés.
 * Entrée : AyoExtract (JSON brut) + Contexte optionnel
 * Sortie : Objets JSON pour Manifeste, FAQ, Glossaire, External Contexte
 */

// SECURITY: Single env var for Gemini API key (B6 fix)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

// Timeout for Gemini API calls (H11 fix)
const GEMINI_TIMEOUT_MS = 30_000; // 30 seconds

// Fail-safe model init
const getModel = () => {
    if (!GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY env var");
    const google = createGoogleGenerativeAI({ apiKey: GEMINI_API_KEY });
    return google('gemini-1.5-flash');
};

export interface SemanticAssets {
    manifest: Record<string, unknown>;
    faq: Record<string, unknown>;
    glossary: Record<string, unknown>;
    external_context: Record<string, unknown>;
}

/**
 * Fonction principale : Orchestre la génération de tous les actifs
 */
export async function generateSemanticAssets(extract: AyoExtract): Promise<SemanticAssets> {
    const logger = createLogger(generateCorrelationId(), 'system');
    logger.info('SEMANTICS_START', 'Starting Intelligence Layer');

    try {
        const model = getModel();
        const companyName = extract.fields.identite.name.value;
        const businessType = extract.fields.identite.business_type.value;

        // Construction du Prompt "Architecte Sémantique"
        const SYSTEM_PROMPT = `
        Tu es l'Architecte de Données AYO.
        TA MISSION : Créer la "Vérité Sémantique" d'une entreprise à partir de données brutes.
        Pour ce client (${companyName} - ${businessType}), tu dois générer 4 fichiers clés AU FORMAT JSON STRICT.

        1. **MANIFESTE IA** : Déclare les droits d'accès, la mission et les sources.
        2. **FAQ STRUCTURÉE** : 5 questions/réponses ultra-pertinentes qui anticipent les besoins utilisateurs.
        3. **GLOSSAIRE MÉTIER** : 5 définitions précises du vocabulaire de l'entreprise.
        4. **CONTEXTE EXTERNE** : Signaux de réputation et d'écosystème.

        DONNÉES BRUTES DU SCANNER :
        ${JSON.stringify(extract.fields).substring(0, 15000)}

        FORMAT DE SORTIE ATTENDU (JSON STRICT, pas de markdown, pas de commentaires) :
        {
            "manifest": { ...structure standard... },
            "faq": [ { "q": "...", "a": "..." } ],
            "glossary": [ { "term": "...", "def": "..." } ],
            "external_context": { "ecosystem": [], "intent_keywords": [] }
        }

        RÈGLES DE RÉDACTION :
        - Ton : Professionnel, factuel, "No-Fluff" (Zéro marketing vide).
        - FAQ : Doit répondre à "Combien ça coûte ?", "Comment ça marche ?", "Quelle garantie ?".
        - Glossaire : Définir les termes techniques ou spécifiques à l'offre.
        - Manifeste : Doit autoriser explicitement les bots "Bienveillants" (Google, Bing, Perplexity) et rejeter les scrapers malveillants par défaut.
        - IMPORTANT : Retourne UNIQUEMENT du JSON valide. Pas de texte avant ou après.
        `;

        // H11 fix: AbortController with 30s timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

        const result = await generateText({
            model: model,
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: "Génère les actifs sémantiques maintenant." }],
            temperature: 0.2,
            abortSignal: controller.signal,
        });

        clearTimeout(timeoutId);

        // H10 fix: Validate JSON before parsing
        const rawJson = result.text.replace(/```json/g, '').replace(/```/g, '').trim();

        let assets: Record<string, unknown>;
        try {
            assets = JSON.parse(rawJson);
        } catch (parseError) {
            logger.error('SEMANTICS_JSON_INVALID', 'Gemini returned invalid JSON', {
                rawLength: rawJson.length,
                first200: rawJson.substring(0, 200),
            });
            // Return empty assets instead of crashing — but log it as critical
            logger.critical('SEMANTICS_EMPTY_FALLBACK', 'Returning empty assets due to invalid Gemini JSON');
            return { manifest: {}, faq: {}, glossary: {}, external_context: {} };
        }

        // Validate expected structure
        if (!assets || typeof assets !== 'object') {
            logger.critical('SEMANTICS_EMPTY_FALLBACK', 'Gemini returned non-object — empty assets returned');
            return { manifest: {}, faq: {}, glossary: {}, external_context: {} };
        }

        logger.info('SEMANTICS_SUCCESS', `Generated assets for ${companyName}`);
        return {
            manifest: (assets.manifest as Record<string, unknown>) || {},
            faq: formatFaqSchema(assets.faq as Array<{ q: string; a: string }>),
            glossary: formatGlossarySchema(assets.glossary as Array<{ term: string; def: string }>, companyName),
            external_context: (assets.external_context as Record<string, unknown>) || {}
        };

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        const isTimeout = message.includes('abort') || message.includes('timeout');
        logger.critical('SEMANTICS_FAILURE', isTimeout ? 'Gemini timeout (30s)' : message);
        // Fallback vide (ne casse pas le flux) — logged as critical for monitoring
        return { manifest: {}, faq: {}, glossary: {}, external_context: {} };
    }
}

/**
 * Helpers de formatage pour respecter les standards Schema.org
 */

function formatFaqSchema(faqPairs: Array<{ q: string; a: string }> = []): Record<string, unknown> {
    if (!Array.isArray(faqPairs)) return {};
    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": faqPairs.map((item) => ({
            "@type": "Question",
            "name": item.q,
            "acceptedAnswer": {
                "@type": "Answer",
                "text": item.a
            }
        }))
    };
}

function formatGlossarySchema(terms: Array<{ term: string; def: string }> = [], companyName: string): Record<string, unknown> {
    if (!Array.isArray(terms)) return {};
    return {
        "@context": "https://schema.org",
        "@type": "DefinedTermSet",
        "name": `Glossaire Officiel - ${companyName}`,
        "hasDefinedTerm": terms.map((item) => ({
            "@type": "DefinedTerm",
            "name": item.term,
            "description": item.def
        }))
    };
}
