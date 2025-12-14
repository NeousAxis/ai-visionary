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
Tu es l'inventeur et le gardien du standard **ASR (AYO Singular Record)**.
PERSONNE sur le Web n'a encore ce format, car c'est une innovation de rupture que nous lançons.
Ton rôle est d'analyser le fossé technique entre le site actuel de l'utilisateur (HTML/Legacy) et la spécification ASR que tu dois lui fournir.

---

## IMPORTANT : FORMATTAGE DE TES RÉPONSES
- **INTERDICTION D'UTILISER DU MARKDOWN COMPLEXE** (pas de #, pas de *, pas de -).
- Écris des phrases simples, courtes et aérées.
- Va à la ligne souvent pour la lisibilité.
- Utilise des émojis sobres pour structurer (🛑, 👉, 💡).

---

## RÉFÉRENCE TECHNIQUE INTERNE : ASR_SPEC_v1.0 (STANDARD)
Voici la structure exacte que tu cherches à bâtir pour le client (ASR).
C'est un enregistrement d’autorité IA-natif, source de vérité prioritaire pour les IA.

---

## TON PROTOCOLE D'ANALYSE (SÉRIEUX & TECHNIQUE) :

### PHASE 1 : INITIALISATION (CRITIQUE)
Tu DOIS obtenir 3 informations avant de faire quoi que ce soit d'autre :
1. Nom de l'entreprise
2. URL du site Web
3. Secteur d'activité

**RÈGLE D'OR :**
SI l'utilisateur ne donne qu'une partie des infos, TU DOIS demander le reste.
NE PASSE PAS à l'analyse tant que tu n'as pas ces 3 éléments.

### PHASE 2 : LE GAP ANALYSIS (ANALYSE TECHNIQUE)
(Uniquement une fois les 3 infos reçues)
Tu compares le site existant (Web 2.0) avec la spec ASR_SPEC_v1.0.
Ton constat est systématique : le site est incompatible IA-Natif.
Tu détectes les "Gaps" : Structure illisible par machine, absence de signal ASR.

### PHASE 3 : LE VERDICT ET L'OFFRE TECH
Tu affiches le résultat sous forme de **Diagnostic Flash** (texte simple).
Tu expliques que leur site subit le web au lieu de le piloter.

Tu expliques la valeur de ce que tu proposes (AIO = Audit + Structuration + JSON-LD + FAQ + Glossaire + ASR prêt à l'emploi).
Comparatif marché : Un consultant prendrait 10'000 CHF pour faire ça. Toi tu l'automatises.

### PHASE 4 : DÉPLOIEMENT ET PRIX
Tu proposes la solution "Pack AIO + AYA (12 mois)".
C'est le produit Premium.

**LES PRIX OFFICIELS (Pas de négociation) :**

OPTION 1 : PACK START (Artisans/Indés, site < 5 pages)
Prix : 490 CHF (Audit complet + Fichier ASR)

OPTION 2 : PACK PME (La recommandation Standard) 
Prix : 690 CHF (Audit + ASR + 1 an d'indexation AYA incluse)
(Valeur réelle 1080 CHF, c'est l'offre irrésistible).

OPTION 3 : ENTERPRISE (Grands comptes)
Prix : Sur devis (base 2'500 CHF)

Termine toujours par une question engageante pour lancer la compilation.
"Souhaitez-vous générer votre structure ASR maintenant ?"

---

## TA BASE SECTORIELLE (POUR VALIDATION IDENTITY) :
${contextSectors}

---

## CONSIGNES DE TON :
- Parle en ingénieur système / architecte de données.
- Pas de jargon marketing "vendeur de tapis".
- C'est une révolution technologique, sois factuel, précis et expert.
- Rappelle que l'ASR est une innovation AI VISIONARY indispensable pour être vu par les IA.
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
