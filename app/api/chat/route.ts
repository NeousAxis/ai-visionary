import { openai } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import fs from 'fs';
import path from 'path';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// Load the "Brain" (Context & Rules)
const dataSectorsPath = path.join(process.cwd(), 'public', 'AYO_SECTORS_V1.json');
let contextSectors = "";

try {
    if (fs.existsSync(dataSectorsPath)) {
        contextSectors = fs.readFileSync(dataSectorsPath, 'utf8');
    }
} catch (error) {
    console.warn("AYO Brain Warning: Could not load JSON context files.", error);
}

// [SYSTEM PROMPT UPDATE]
const SYSTEM_PROMPT = `
TU ES "AYO", L'IA DE "AI VISIONARY".
Tu es un assistant strict qui suit un SCRIPT PRÉCIS étape par étape.
Ton but est d'éduquer et de vendre la structuration de données (ASR).

⚠️ RÈGLES DE FORME :
- **AÈRE TON TEXTE !** Fais des sauts de ligne doubles entre chaque bloc.
- Pas de pavés indigestes.
- Zéro Markdown complexe (pas de tableaux).
- Utilise des émojis pour guider la lecture.
- **IMPORTANT** : Quand tu affiches l'ANALYSE (ÉTAT 2), utilise le séparateur "|||" pour couper ta réponse en 3 parties distinctes.

--- SCRIPT À SUIVRE ---

📍 ÉTAT 0 : ACCUEIL
(Déjà géré par le message d'accueil fixe. Si l'utilisateur dit "Bonjour", passe à l'État 1 ou rappelle le contexte).

📍 ÉTAT 1 : COLLECTE (Pose les questions 1 par 1)
1. "Quel est le NOM de votre entreprise ?"
2. "Quelle est l’URL principale de votre site ?"
3. "Dans quel pays êtes-vous basé ?"

📍 ÉTAT 2 : ANALYSE (Après la 3ème réponse)
[Pas de délai serveur, génère la réponse complète avec séparateurs]

"🔎 ANALYSE TERMINÉE.

1️⃣ BLOC IDENTITÉ
Nom détecté : ✅ [Nom]
Localisation : ✅ [Pays]
Forme Juridique : [Si identifiée : SA, SARL, Association...]
Secteur d’Activité : [Cœur de métier : RSE, BTP, Commerce... Ne pas confondre avec le statut] (Confiance 90%)
|||
2️⃣ STRUCTURE TECHNIQUE
JSON-LD : ⚠️ Absent ou incomplet
Sitemap : ⚠️ Partiel
Pages clés : Détectées

|||
3️⃣ LISIBILITÉ IA ESTIMÉE
🟠 MOYENNE / 🔴 FAIBLE
(Pas de score chiffré).
- Aucun "Signal ASR" (fiche d'identité IA) détecté"

|||

📍 ÉTAT 2.5 : CAPTURE LEAD (MOMENT CADEAU)
Enchaîne TOUT DE SUITE (dans le même message ou juste après) :

"

🎁 CADEAU IMMÉDIAT

[Logique Sémantique : Si JSON-LD est ABSENT, écris : "Je peux créer votre Identité Numérique dès maintenant gratuitement."]
[Logique Sémantique : Si JSON-LD est PRÉSENT, écris : "Je peux corriger votre Identité Numérique dès maintenant gratuitement."]

Je vous propose de générer votre "ASR Light" (Carte d'identité IA) pour que vous existiez aux yeux des robots.


👉 Entrez votre email professionnel pour recevoir ce fichier :"

📍 ÉTAT 2.6 : ENVOI EMAIL & TRANSITION EDUCATIVE
(L'utilisateur donne son email).
"✅ Bien reçu. Votre ASR Light arrive dans votre boîte mail.

💡 MAIS ATTENTION :

L'ASR Light corrige votre identité, mais ne suffit pas pour VENDRE.

Pourquoi structurer l'ensemble de vos données ?
Cela empêche les IA (comme ChatGPT, Google, etc.) d'inventer des informations erronées ou de mal interpréter votre mission.
"Surtout, la compréhension de vos données permet aux IA de correctement comprendre votre activité et de vous proposer dans les réponses apporter aux utilisateurs. C'est là que vous allez obtenir des clients et de la vraie visibilité."

L'IA change totalement la manière dont on utilise internet. Ne soyez pas spectateur.

👉 Pour connaitre tous les avantages de nous laisser structurer vos données et connaître nos tarifs, envoyez AIO."

📍 ÉTAT 3 : LA SOLUTION COMPLÈTE (PAYWALL)
Si l'utilisateur envoie **"AIO"** (ou demande les prix/tarifs), affiche ALORS les options :

"VOICI MON PLAN D'ACTION AIO POUR [ELEMENT_NOM_ENTREPRISE] :

Qu'est-ce que l'AIO (Artificial Intelligence Optimization) ?
C'est l'optimisation pour les Intelligences Artificielles. C'est l'art de traduire votre métier dans la langue native des robots (le code sémantique) pour qu'ils vous recommandent en priorité.


🔹 Option A — ASR Essential (490 CHF)
👉 "Pour EXISTER aux yeux des robots."

Ce pack installe les fondations techniques indispensables pour [ELEMENT_ACTIVITE] :
- Le "Fichier JSON-LD" : C'est le passeport technique exigé par Google et les moteurs de recherche.
- Le "Fichier ASR" (AYO Singular Record) : C'est votre déclaration officielle. Elle empêche les IA d'halluciner ou d'inventer des informations fausses sur votre entreprise.

💳 Paiement unique.


🔹 Option B — ASR Pro (690 CHF)
👉 "Pour que les robots COMPRENNENT votre expertise."

En plus de l'identité, nous structurons votre savoir-faire spécifique :
- Le "Glossaire Métier" : Il impose VOS définitions exactes aux Chatbots.
- La "FAQ Structurée" : Elle permet aux IA de répondre directement et correctement aux questions que vos futurs clients posent sur vos services.

💳 Paiement unique.


👉 Quelle stratégie AIO choisissez-vous pour [ELEMENT_NOM_ENTREPRISE] ? (Essential ou Pro)"

(Si l'utilisateur pose des questions, réponds en expliquant l'impact technique simple).

📍 ÉTAT 4 : PAIEMENT
// TODO: Intégrer ici la sauvegarde du lead (Email + Choix) dans la base de données (Supabase/Firebase) pour relance commerciale.
"Paiement confirmé (Simulation).
Génération des standards en cours..."

📍 ÉTAT 5 : LIVRAISON
"✅ Votre dossier AIO est prêt.
📦 Contenu :
- Audit & Score AIO
- JSON-LD prêt à copier-coller
- Fichier ASR (AYO Singular Record)

👉 [Lien fictif de téléchargement]"

📍 ÉTAT 6 : ACTIVATION
"Pour activer votre visibilité, hébergez votre fichier ici :
https://[URL]/.ayo/asr.json

Une fois fait, donnez-moi l'URL de vérification."

📍 ÉTAT 7 : VALIDATION
"✅ ASR détecté.
Votre entreprise dispose maintenant d'une source de vérité pour les IA.
Vous êtes prêt pour le web de demain."

FIN DU SCRIPT.
`;

// Helper: Fetch and clean website content
async function fetchWebsiteContent(url: string): Promise<{ text: string, hasJsonLd: boolean }> {
    try {
        let targetUrl = url.trim();
        if (!targetUrl.startsWith('http')) targetUrl = 'https://' + targetUrl;

        console.log(`Analyzing real site: ${targetUrl}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout for real analysis

        const res = await fetch(targetUrl, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; AYO-Bot/1.0; +http://ai-visionary.com)',
            }
        });

        clearTimeout(timeoutId);

        if (!res.ok) return { text: "", hasJsonLd: false };

        const html = await res.text();

        // 🕵️ RÉALITÉ TECHNIQUE : DÉTECTION DU JSON-LD
        // On cherche la balise <script type="application/ld+json">
        const hasJsonLd = html.toLowerCase().includes('application/ld+json');

        // Cleanup text for Semantic Analysis
        const noScript = html.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, " ").replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, " ");
        const rawText = noScript.replace(/<[^>]+>/g, " ");
        const cleanText = rawText.replace(/\s+/g, " ").trim().substring(0, 15000);

        return { text: cleanText, hasJsonLd };

    } catch (e) {
        console.error("Analysis Error:", e);
        return { text: "", hasJsonLd: false };
    }
}

export async function POST(req: Request) {
    try {
        const { messages } = await req.json();

        // 🧠 INTELLIGENCE: REAL-TIME WEBSITE ANALYSIS
        let websiteData = { text: "", hasJsonLd: false };

        if (messages.length === 6) {
            const urlMessage = messages[3];
            if (urlMessage && urlMessage.role === 'user') {
                websiteData = await fetchWebsiteContent(urlMessage.content);
            }
        }

        // 1. DYNAMIC PROVIDER SELECTION
        let modelToUse;

        // Priority to OpenAI if key exists
        if (process.env.OPENAI_API_KEY) {
            console.log("Using Provider: OpenAI");
            modelToUse = openai('gpt-4o-mini');
        } else {
            let googleKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

            if (googleKey) {
                // Sanitize key (remove spaces)
                googleKey = googleKey.trim();

                // Debug Log (Masked)
                console.log(`Using Gemini Key: ${googleKey.substring(0, 5)}... (Length: ${googleKey.length})`);

                const google = createGoogleGenerativeAI({ apiKey: googleKey });

                try {
                    console.log("Auto-detecting available Gemini model...");
                    const modelsResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${googleKey}`);
                    const modelsData = await modelsResponse.json();

                    if (modelsData.models) {
                        // Find a model that supports generateContent
                        // ⚠️ CRITICAL: DO NOT USE 'FLASH' MODELS. They are unstable for this project.
                        // We prioritize 'pro' or standard '1.5' versions.
                        const bestModel = modelsData.models.find((m: any) =>
                            m.supportedGenerationMethods.includes('generateContent') &&
                            !m.name.includes('flash') && // 🚫 EXPLICITLY BAN FLASH
                            (m.name.includes('gemini-1.5') || m.name.includes('pro'))
                        );

                        if (bestModel) {
                            const modelId = bestModel.name.replace('models/', '');
                            console.log(`Auto-detected Best Model (NO FLASH): ${modelId}`);
                            modelToUse = google(modelId);
                        } else {
                            console.warn("No ideal 'pro' model found in list, forcing 'gemini-pro'");
                            modelToUse = google('gemini-pro');
                        }
                    } else {
                        throw new Error("Could not list models");
                    }
                } catch (e) {
                    console.error("Model detection failed, using safe fallback 'gemini-pro'.", e);
                    modelToUse = google('gemini-pro');
                }
            } else {
                throw new Error("No API Key found");
            }
        }

        // ENRICH SYSTEM PROMPT IF CONTEXT EXISTS
        let finalSystemPrompt = SYSTEM_PROMPT;

        // 🚨 Injection de la RÉALITÉ TECHNIQUE et SÉMANTIQUE
        if (websiteData.text) {
            console.log("Injecting real website content into AI context...");

            const jsonStatus = websiteData.hasJsonLd ? "✅ DÉTECTÉ (Présent dans le code source)" : "❌ NON DÉTECTÉ (Absent du code source)";

            finalSystemPrompt += `\n\n🚨 [RAPPORT D'ANALYSE TECHNIQUE RÉEL] 🚨
1. CONTENU DU SITE : Voici le texte brut extrait de la page d'accueil (${messages[3]?.content}).
2. ANALYSE TECHNIQUE (FAIT ÉTABLI) :
   - JSON-LD : ${jsonStatus}
   
⚠️ CONSIGNE CRITIQUE :
- Utilise le texte ci-dessous pour déterminer "Forme Juridique" et "Secteur d'Activité".
- Pour la section "STRUCTURE TECHNIQUE", tu reportes STRICTEMENT le statut JSON-LD indiqué ci-dessus ("${jsonStatus}"). NE L'INVENTE PAS.

"""
${websiteData.text}
"""`;
        } else if (messages.length === 6) {
            console.log("No website content could be fetched (or failed). AI will infer from name.");
        }

        // DEBUG MODE: NO STREAMING
        console.log("Generating text (no stream)...");
        const result = await generateText({
            model: modelToUse,
            system: finalSystemPrompt,
            messages,
        });

        console.log("Generation success:", result.text.substring(0, 50) + "...");

        return new Response(JSON.stringify({ text: result.text }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error("Detailed API Error:", error);
        return new Response(JSON.stringify({ error: `Server Error: ${error.message}` }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
