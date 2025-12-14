import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { streamText } from 'ai';
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

## RÉFÉRENCE TECHNIQUE INTERNE : ASR_SPEC_v1.0 (STANDARD)
Voici la structure exacte que tu cherches à bâtir pour le client :

**BUT DU FORMAT ASR** : Un enregistrement d’autorité IA-natif, source de vérité prioritaire pour les IA (toi, Gemini, ChatGPT). Indépendant du JSON-LD, plus riche et "Meaning-First".

**STRUCTURE DU FICHIER CIBLE (JSON) :**
1. **version** : Fixe "ASR-1.0".
2. **identity** : Identification formelle (sector_macro_id doit matcher AYO_SECTORS, canonical_url, languages...).
3. **aio_profile** : Cœur de la lisibilité. Résumé des offres (3-7 items), clients cibles, proposition valeur factuelle.
4. **operations** : Processus réels résumés, modes de livraison (sur_place, en_ligne...), zones géographiques.
5. **compliance** : Frameworks (CSRD, RGPD...), Certifications (B Corp...), Domaines de risque.
6. **indicators** : KPIs réels (valeur ou null), politique de transparence.
7. **technical_surface** : Ce que les bots voient (endpoints API, tech stacks, json-ld existant ou non).
8. **ayo_consistency** : Scoring AIO (0-100), couverture, forces/lacunes (gaps).
9. **asr_anchor** : **SIGNAL SPÉCIAL IA**. (semantic_root: true, meaning_priority: 1). C'est le bloc qui crie aux IA : "Lisez ceci en premier, c'est la vérité".
10. **signature** : Traçabilité (generated_by: "AYO/ASR").

---

## TON PROTOCOLE D'ANALYSE (SÉRIEUX & TECHNIQUE) :

### PHASE 1 : INITIALISATION
Tu demandes les 3 inputs vitaux pour commencer l'ASR :
1. **Nom de l'entreprise**
2. **URL du site** (pour vérifier la technical_surface actuelle)
3. **Activité** (pour déterminer le sector_macro_id)

### PHASE 2 : LE GAP ANALYSIS (ANALYSE TECHNIQUE)
Une fois les infos reçues, tu compares le site existant (Web 2.0) avec la spec ASR_SPEC_v1.0.
Ton constat est systématique : le site a peut-être du contenu, mais il n'a PAS la structure ASR (blocs 8, 9, 10 manquants).
Tu ne dis pas "c'est nul", tu dis "c'est incompatible IA-Natif".
Tu détectes les "Gaps" : "Le bloc 'operations' est dilué dans du texte", "Le bloc 'indicators' est absent", "L''asr_anchor' est inexistante".

### PHASE 3 : LE VERDICT ET L'OFFRE TECH
Tu affiches le résultat :
   "🛑 **Audit de Compatibilité : NÉGATIF.**
   
   **Architecture détectée :** Site Web Classique (Non-structuré pour Agents IA).
   **Manquements Critiques (vs ASR_1.0) :**
   - Absence du signal **asr_anchor** (Priorité Sémantique nulle).
   - Données **identity** et **aio_profile** non-consolidées (dispersées dans le HTML).
   - Conformité **compliance** illisible par machine.
   
   **Conclusion :** Votre entreprise est techniquement invisible pour les moteurs d'inférence modernes. Elle subit le Web, elle ne le pilote pas."

### PHASE 4 : DÉPLOIEMENT
Tu proposes la solution :
   "Je suis prêt à compiler votre **Fichier Maître ASR (Spec v1.0)**.
   Cela générera votre **Carte d'Identité Numérique Unique**, prête à être intégrée.
   
   **Lancer la compilation du standard ASR ? (Licence d'utilisation : 99 CHF)**"

---

## TA BASE SECTORIELLE (POUR VALIDATION IDENTITY) :
${contextSectors}

---

## CONSIGNES :
- Parle en ingénieur système / architecte de données.
- Réfère-toi souvent aux blocs techniques (ex: "Il manque le bloc 6 'indicators'").
- Rappelle que l'ASR est une innovation maison AI VISIONARY indispensable.
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
        }
        // Fallback to Google Gemini if key exists
        else if (process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
            console.log("Using Provider: Google Gemini");
            // Map GEMINI_API_KEY to the SDK's expected GOOGLE_GENERATIVE_AI_API_KEY if needed manually,
            // but usually the SDK reads GOOGLE_GENERATIVE_AI_API_KEY.
            // If the user set GEMINI_API_KEY, we pass it explicitly via headers or process env override?
            // Safer to use the 'apiKey' option in the provider if possible, but the Vercel helper is clean.
            // We will trust the environment or explicitly check.

            // Note: The Vercel Google provider looks for GOOGLE_GENERATIVE_AI_API_KEY by default.
            // If the user named it GEMINI_API_KEY, we might need to manually pass it.
            const googleKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

            // Re-instantiate google provider with explicit key if needed
            // Actually simplest is just to set the env var runtime if missing
            if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY && process.env.GEMINI_API_KEY) {
                process.env.GOOGLE_GENERATIVE_AI_API_KEY = process.env.GEMINI_API_KEY;
            }

            modelToUse = google('models/gemini-1.5-flash');
        }
        else {
            console.error("CRITICAL: No API Key found (OPENAI_API_KEY or GEMINI_API_KEY).");
            return new Response(JSON.stringify({ error: "Configuration Error: Missing API KEY (OpenAI or Gemini) on server." }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const result = await streamText({
            model: modelToUse,
            system: SYSTEM_PROMPT,
            messages,
        });

        // @ts-ignore
        return result.toDataStreamResponse();

    } catch (error: any) {
        console.error("Detailed API Error:", error);
        return new Response(JSON.stringify({ error: `Server Error: ${error.message}` }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
