
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { AyoExtract } from './aio-score-engine';

/**
 * MODULE AYO-SEMANTICS (LE CERVEAU)
 * Responsabilité : Transformer la donnée brute du scanner en actifs IA riches et rédigés.
 * Entrée : AyoExtract (JSON brut) + Contexte optionnel
 * Sortie : Objets JSON pour Manifeste, FAQ, Glossaire, External Contexte
 */

const googleKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

// Fail-safe model init
const getModel = () => {
    if (!googleKey) throw new Error("Missing Gemini Key in ayo-semantics");
    const google = createGoogleGenerativeAI({ apiKey: googleKey });
    // Utiliser un modèle capable de reasoning (Flash est le bon compromis rapidité/intelligence)
    return google('gemini-1.5-flash');
};

export interface SemanticAssets {
    manifest: any;
    faq: any;
    glossary: any;
    external_context: any;
}

/**
 * Fonction principale : Orchestre la génération de tous les actifs
 */
export async function generateSemanticAssets(extract: AyoExtract): Promise<SemanticAssets> {
    console.log("🧠 AYO-SEMANTICS: Starting Intelligence Layer...");

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

        FORMAT DE SORTIE ATTENDU :
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
        `;

        const result = await generateText({
            model: model,
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: "Génère les actifs sémantiques maintenant." }],
            temperature: 0.2 // Très déterministe
        });

        // Nettoyage et Parsing
        const rawJson = result.text.replace(/```json/g, '').replace(/```/g, '').trim();
        const assets = JSON.parse(rawJson);

        console.log("🧠 AYO-SEMANTICS: Success!");
        return {
            manifest: assets.manifest || {},
            faq: formatFaqSchema(assets.faq),
            glossary: formatGlossarySchema(assets.glossary, companyName),
            external_context: assets.external_context || {}
        };

    } catch (error) {
        console.error("❌ AYO-SEMANTICS FAILURE:", error);
        // Fallback vide (ne casse pas le flux)
        return {
            manifest: {},
            faq: {},
            glossary: {},
            external_context: {}
        };
    }
}

/**
 * Helpers de formatage pour respecter les standards Schema.org
 */

function formatFaqSchema(faqPairs: any[] = []): any {
    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": faqPairs.map((item: any) => ({
            "@type": "Question",
            "name": item.q,
            "acceptedAnswer": {
                "@type": "Answer",
                "text": item.a
            }
        }))
    };
}

function formatGlossarySchema(terms: any[] = [], companyName: string): any {
    return {
        "@context": "https://schema.org",
        "@type": "DefinedTermSet",
        "name": `Glossaire Officiel - ${companyName}`,
        "hasDefinedTerm": terms.map((item: any) => ({
            "@type": "DefinedTerm",
            "name": item.term,
            "description": item.def
        }))
    };
}
