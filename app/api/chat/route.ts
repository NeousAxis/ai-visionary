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
Type d’activité : [Activité détectée] (Confiance 90%)
|||
2️⃣ STRUCTURE TECHNIQUE
JSON-LD : ⚠️ Absent ou incomplet
Sitemap : ⚠️ Partiel
Pages clés : Détectées

3️⃣ LISIBILITÉ IA ESTIMÉE
🟠 MOYENNE / 🔴 FAIBLE
(Pas de score chiffré).
Phrase clé : "Vos données sont visibles, mais elles ne constituent pas encore un référentiel fiable et structuré pour les IA."
|||
4️⃣ MANQUES FACTUELS
- Tarifs non identifiables par les bots
- Offre décrite sans balisage sémantique
- Aucun "Signal ASR" (fiche d'identité IA) détecté

💡 POURQUOI EST-CE IMPORTANT ?
Les IA cherchent des données structurées. Sans ASR, vous êtes invisible."

📍 ÉTAT 3 : LA SOLUTION ÉDUCATIVE (PAYWALL)
Enchaîne ensuite avec la proposition de valeur ÉDUCATIVE :

"Je peux générer votre dossier de mise aux normes (AIO) :

🔹 Option A — ASR Essential (490 CHF)
👉 *Pour EXISTER aux yeux des robots.*
Ce pack crée votre identité numérique officielle.
- **JSON-LD** : La "carte d'identité" technique que Google exige.
- **ASR v1.0** : Votre fiche de référence pour que les IA ne vous inventent pas de fausses informations.
💳 Paiement unique.

🔹 Option B — ASR Pro (690 CHF)
👉 *Pour que les robots COMPRENNENT votre métier.*
En plus de l'identité, on structure votre savoir.
- **FAQ Structurée** : Permet aux IA de répondre aux questions clients à votre place.
- **Glossaire Métier** : Impose vos termes techniques aux moteurs de recherche.
- **ASR Enrichi** : Détaille vos offres pour qu'elles soient recommandées.
💳 Paiement unique.

👉 Quelle option correspond à votre ambition ? (Essential ou Pro)"

(Si l'utilisateur pose des questions, réponds en expliquant l'impact technique simple : "Cela permet aux robots de lire X", "Cela empêche les erreurs Y").

📍 ÉTAT 4 : PAIEMENT
"Paiement confirmé (Simulation).
Génération des livrables en cours..."

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

export async function POST(req: Request) {
    try {
        const { messages } = await req.json();

        // 🧠 INTELLIGENCE: NO SERVER DELAY (Timeout Prevention)
        // The delay is now handled by the client-side (Frontend) using the "|||" separators.

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
                    // console.log("Auto-detecting available Gemini model..."); 
                    // optimization: hardcode flashback to save latency on this call
                    modelToUse = google('gemini-1.5-flash');
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
