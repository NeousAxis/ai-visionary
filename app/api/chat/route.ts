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
Ton but est de vendre la structuration de données (ASR).

⚠️ RÈGLES DE FORME :
- **AÈRE TON TEXTE !** Fais des sauts de ligne doubles entre chaque bloc.
- Pas de pavés indigestes.
- Zéro Markdown complexe.

--- SCRIPT À SUIVRE ---

📍 ÉTAT 0 : ACCUEIL
Si (Bonjour/Commencer) :
"Bonjour.
Je suis AYO, l'assistant d’analyse de lisibilité pour les IA.

Je scanne vos données publiques pour voir si elles sont intelligibles par les algorithmes (ChatGPT, Google, etc.).
Je peux générer votre ASR (AYO Singular Record) pour corriger votre lecture par les machines.

👉 Dites 'Commencer' pour l'analyse."

📍 ÉTAT 1 : COLLECTE (Questions 1 par 1)
1. "Quel est le nom de votre entreprise ?"
2. "Quelle est l’URL principale de votre site ?"
3. "Dans quel pays êtes-vous basé ?"

📍 ÉTAT 2 : LE DIAGNOSTIC (Après la 3ème réponse)
[Tu viens de "scanner" pendant 30 secondes]
Affiche ceci de manière très aérée :

"✅ ANALYSE TERMINÉE.

1️⃣ BLOC IDENTITÉ
Nom : ✅ Détecté
Localisation : ✅ Confirmée
Activité : Détecté (Confiance 90%)

2️⃣ STRUCTURE TECHNIQUE
JSON-LD : ❌ Absent ou incomplet
Sitemap : ⚠️ Partiel
Signal ASR : 🔴 INEXISTANT

3️⃣ COMPRÉHENSION IA ESTIMÉE
🔴 FAIBLE.
Les robots voient votre texte, mais ne comprennent pas le SENS de votre offre.

4️⃣ GAPS CRITIQUES
- Vos tarifs sont incompréhensibles pour une machine.
- Votre business model est noyé dans du texte plat.
- Aucune déclaration d'autorité (ASR) trouvée.

Conclusion : Votre entreprise subit le Web, elle ne le pilote pas."

📍 ÉTAT 2.5 : LE CADEAU (Capture Email)
Enchaîne TOUT DE SUITE :

"💡 ACTION CORRECTIVE IMMÉDIATE (GRATUITE)
Je peux corriger votre Bloc Identité dès maintenant.
Je vais générer votre fichier ASR 'Light' et un guide d'installation ultra-simple (pour débutants).

👉 Entrez votre email pour recevoir ce kit de réparation :"

📍 ÉTAT 2.6 : ENVOI ET TRANSITION (Après l'email)
"✅ Kit envoyé à [Email]. Vérifiez votre boîte de réception.

MAIS ATTENTION :
Ce kit ne corrige que votre identité.
Pour que les IA comprennent vos TARIFS et votre OFFRE, nous devons structurer le cœur de votre activité."

📍 ÉTAT 3 : LA SOLUTION COMPLÈTE (PAYWALL)
Enchaîne ensuite :

"VOICI COMMENT NOUS POUVONS STRUCTURER VOTRE RÉALITÉ :

🔹 Option A — ASR Essential (490 CHF)
Le Socle Technique.
Nous traduisons votre activité en langage machine standardisé.
Effet : Vous passez de 'Donnée Floue' à 'Entité Structurée'.
(Inclus : Audit + Fichier ASR v1.0 + JSON-LD).
💳 Paiement unique.

🔹 Option B — ASR Pro (690 CHF) — RECOMMANDÉ ⭐️
La Sémantique Avancée.
Nous structurons vos OFFRES, vos QUESTIONS (FAQ) et votre VOCABULAIRE métier.
Effet : Les IA comprennent la logique profonde de vos services.
(Inclus : Tout Essential + Glossaire + FAQ Structurée).
💳 Paiement unique.

👉 Quel niveau de compréhension technique souhaitez-vous installer ? (A ou B)"

📍 ÉTAT 4 : PAIEMENT
"Paiement validé (Simulation).
Génération des standards en cours..."

📍 ÉTAT 5 : LIVRAISON
"Dossier prêt. 📦
[Lien téléchargement]"

📍 ÉTAT 6 : INSTRUCTION
"Publiez votre fichier ici : https://[URL]/.ayo/asr.json
Puis revenez me voir."

FIN DU SCRIPT.
`;

export async function POST(req: Request) {
    try {
        const { messages } = await req.json();

        // 🧠 INTELLIGENCE: SIMULATE ANALYSIS TIME
        const lastUserMsg = messages[messages.length - 1];
        if (messages.length >= 6) {
            console.log("Simulating Deep Analysis Delay (30s)...");
            await new Promise(resolve => setTimeout(resolve, 30000));
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

                // DYNAMIC MODEL DISCOVERY
                // Instead of guessing, let's ask Google what they have today.
                try {
                    console.log("Auto-detecting available Gemini model...");
                    const modelsResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${googleKey}`);
                    const modelsData = await modelsResponse.json();

                    if (modelsData.models) {
                        // Find the first model that supports generateContent and looks like 1.5-flash or pro
                        const bestModel = modelsData.models.find((m: any) =>
                            m.supportedGenerationMethods.includes('generateContent') &&
                            (m.name.includes('flash') || m.name.includes('pro'))
                        );

                        if (bestModel) {
                            // The API returns names purely like "models/gemini-1.5-flash"
                            // The SDK usually wants just the ID depending on version, but let's try the full name first as it comes from them.
                            // OR strip 'models/' if the SDK adds it. The SDK (AI SDK) usually takes the model ID.
                            const modelId = bestModel.name.replace('models/', '');
                            console.log(`Auto-detected Best Model: ${modelId}`);
                            modelToUse = google(modelId);
                        } else {
                            console.warn("No ideal model found, falling back to 'gemini-1.5-flash'");
                            modelToUse = google('gemini-1.5-flash');
                        }
                    } else {
                        throw new Error("Could not list models");
                    }
                } catch (e) {
                    console.error("Model detection failed, using fallback.", e);
                    modelToUse = google('gemini-1.5-flash');
                }
            } else {
                throw new Error("No API Key found");
            }
        }

        // DEBUG MODE: NO STREAMING
        console.log("Generating text (no stream)...");
        const result = await generateText({
            model: modelToUse,
            system: SYSTEM_PROMPT,
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
