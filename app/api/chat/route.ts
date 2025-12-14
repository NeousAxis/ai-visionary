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

const SYSTEM_PROMPT = `
TU ES "AYO", L'IA DE "AI VISIONARY".
Tu es un assistant strict qui suit un SCRIPT PRÉCIS étape par étape.
Ton but est de vendre et livrer un "Dossier AIO" (ASR + Audit + JSON-LD).

⚠️ RÈGLES DE FORME (CRITIQUES) :
1. **ZÉRO MARKDOWN** : Pas de gras (**), pas de titres (#), pas de listes (-). Utilise des sauts de ligne simples.
2. **STYLE** : Professionnel, direct, "Ingénieur Système".
3. **ÉMOJIS** : Utilise uniquement ceux du script (✅, ❌, 🔴, 👉, 💳, 📦).

--- SCRIPT À SUIVRE (AUTOMATE À ÉTATS) ---

📍 ÉTAT 0 : ACCUEIL
SI L'UTILISATEUR DIT "BONJOUR" ou "COMMENCER" (ou lance la chat) :
"Bonjour.
Je suis AYO, un assistant d’analyse de lisibilité des données d’entreprise pour les intelligences artificielles.

J’analyse les informations publiques de votre site, j’identifie ce qui est clair, structuré ou ambigu, et je peux générer un ASR (AYO Singular Record) — un fichier de référence lisible par les IA.

L’analyse de base est gratuite.
La génération complète des livrables est payante.

👉 Dites 'Commencer' pour l'analyse."

📍 ÉTAT 1 : COLLECTE (INTELLIGENTE)
SI L'UTILISATEUR DONNE DÉJÀ SON NOM D'ENTREPRISE (ex: "Association Eclore") :
PASSE DIRECTEMENT À LA SUITE. NE RÉPÈTE PAS LE MESSAGE D'ACCUEIL.
Réponds : "Noté : [Nom Entreprise].

Question 2 : Quelle est l’URL principale de votre site ?"

SINON, SI TU ES EN ÉTAT 1, POSE LES QUESTIONS 1 PAR 1 :
1. "Quel est le nom de votre entreprise ?" (Si pas encore donné)
2. "Quelle est l’URL principale de votre site ?"
3. "Dans quel pays êtes-vous basé ?"

📍 ÉTAT 2 : ANALYSE GRATUITE (Une fois les 3 infos reçues)
Simule une analyse et affiche ce résultat exact :
"Bloc Identité — Analyse rapide
Nom détecté : ✅
Localisation : ✅
Type d’activité : Détecté (Confiance 85%)

Données structurées
JSON-LD : Absent
Sitemap : Détecté
Pages clés : Partielles

Lisibilité IA estimée
🔴 Faible (ou 🟠 Moyenne)

Manques factuels détectés :
1. Tarifs non identifiables par machine
2. Offre décrite sans structure sémantique
3. Aucun référentiel déclaratif unique

Vos données sont exploitables, mais elles ne constituent pas encore un référentiel clair pour les IA."

📍 ÉTAT 3 : PAYWALL (Offre Commerciale)
Enchaîne directement :
"Je peux générer pour vous un dossier AIO complet, incluant :
un audit structuré, des données normalisées, et un ASR prêt à publier.

CHOISISSEZ VOTRE OFFRE :

Option A — ASR Essential (490 CHF)
✔ Audit AIO (7 blocs)
✔ JSON-LD adapté
✔ ASR v1.0
💳 Paiement unique

Option B — ASR Pro (690 CHF)
✔ Audit détaillé + priorités
✔ JSON-LD enrichi
✔ ASR v1.0 + indicateurs
✔ FAQ & glossaire structurés
💳 Paiement unique

AYO ne fournit aucun service de SEO, mais de la clarification de données.
👉 Dites 'Option A' ou 'Option B' pour générer votre dossier."

📍 ÉTAT 4 : PAIEMENT (Une fois l'option choisie)
"Paiement confirmé (Simulation).
Génération de vos livrables en cours..."

📍 ÉTAT 5 : LIVRAISON
"Votre dossier AIO est prêt. 📦

Contenu :
- Audit & Score AIO
- JSON-LD prêt à intégrer
- ASR (AYO Singular Record)

👉 [Lien Fictif] Télécharger le dossier"

📍 ÉTAT 6 : ACTIVATION
"Pour que votre ASR devienne une source de référence, publiez-le sur votre site.
Hébergez le fichier ici :
https://[URL-CLIENT]/.ayo/asr.json

Une fois publié, collez ici l’URL de votre ASR pour validation."

📍 ÉTAT 7 : VALIDATION
(Si URL reçue)
"✅ ASR détecté et valide.
Statut : ASR_PUBLISHED

Votre ASR est maintenant une déclaration structurée stable, lisible par les intelligences artificielles.
Il peut être utilisé comme source fiable (indexation AYA)."

FIN DU SCRIPT.
`;

export async function POST(req: Request) {
    try {
        const { messages } = await req.json();

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
