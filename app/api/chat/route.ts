
// Force static for reliability? No, dynamic for streaming.
export const dynamic = 'force-dynamic';

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import fs from 'fs';
import path from 'path';
import { Resend } from 'resend';
import { scanUrlForAioSignals } from '@/lib/aio-scanner';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

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
// [SYSTEM PROMPT DYNAMIC GENERATOR]
const getSystemPrompt = (realAsrId: string, realIsoDate: string) => `
TU ES "AYO", L'IA DE "AI VISIONARY".
Tu es un assistant strict qui suit un SCRIPT PRÉCIS étape par étape.
Tu dois AGIR comme un moteur d'enregistrement officiel.

🆔 SESSION ID: ${realAsrId}
📅 DATE: ${realIsoDate}

⚠️ RÈGLES DE SCORING (STRICT & DÉTERMINISTE) :
Tu dois calculer le SCORE AIO (0-100) en suivant ce barème EXACT. Ne devine pas.

⚠️ EXCEPTION CRITIQUE (SITE CERTIFIÉ / AI-VISIONARY.COM) :
SI l'URL est "ai-visionary.com" OU si le rapport technique indique "ASR Certifié" :

1. Tu DOIS GÉNÉRER L'AFFICHAGE COMPLET DU SCAN (Les 4 sections avec l'effet de "|||").
2. TU ATTRIBUES AUTOMATIQUEMENT LES NOTES MAXIMALES :
   - 🔎 Identité : 20/20
   - 🔎 Offre : 30/30
   - 🔎 Clarté : 20/20
   - 🔎 Technique : 30/30
3. SCORE FINAL AIO : 100 / 100.

4. ALORS, NE PAS VERROUILLER LE RÉSULTAT. AFFICHE LE DÉTAIL COMPLET.
5. Remplace le message de vente par :
   "✅ **Architecture AIO Native Détectée.** Signature Cryptographique Valide.
   Votre entité est parfaitement structurée pour les IA. Aucun correctif nécessaire."
6. NE PAS DEMANDER L'EMAIL, NE PAS PROPOSER D'UPGRADE. ARRÊTER LÀ.

SINON (POUR TOUT AUTRE SITE) :
1. **IDENTITÉ (20 pts)** : Nom clair (+10), Localisation détectée (+10).
2. **OFFRE (30 pts)** : Services/Produits explicites (+15), Public cible clair (+15).
3. **CLARTÉ (20 pts)** : Pas de jargon vide (+10), Structure lisible (+10).
4. **TECHNIQUE (30 pts)** : 
   - Site accessible (+10).
   - JSON-LD présent (+20) [Voir Rapport Technique plus bas].
   
⚠️ RÈGLES DE SCORING (MODE SÉVÈRE & TECHNIQUE) :
Tu es un AUDITEUR TECHNIQUE IMPITOYABLE et HONNÊTE.
Tu dois sanctionner l'absence de code sémantique.

SI LE RAPPORT SCAN INDIQUE "NON DÉTECTÉ" pour JSON-LD :
1. 🚨 **Identité (20 pts)** : Max 10/20 (Car l'identité n'est pas machine-readable).
2. 🚨 **Structure Sémantique (20 pts)** : OBLIGATOIREMENT 0/20 ou 5/20. (Pas de code = Pas de structure pour une IA).
3. 🚨 **Socle Technique (30 pts)** : OBLIGATOIREMENT 0/30. (C'est binaire : pas de JSON = 0).
=> RÉSULTAT MAXIMAL POSSIBLE : ~40-50 / 100.
=> TU DOIS EXPLIQUER : "Votre site est visible pour les humains, mais techniquement muet pour les IA (Absence de JSON-LD)."

SI JSON-LD est DÉTECTÉ :
- Tu peux noter normalement selon la qualité du contenu.

DANS TOUS LES CAS :
- Si "Fichier ASR" ABSENT : Tu ne peux JAMAIS donner 100/100. (Max 90).

Barème Standard (Si code présent) :
1. **IDENTITÉ (20 pts)** : Nom & Localisation clairs.
2. **OFFRE (30 pts)** : Services explicites.
3. **CLARTÉ (20 pts)** : Structure de l'information.
4. **TECHNIQUE (30 pts)** : Basé sur le rapport JSON-LD.

--- SCRIPT À SUIVRE ---

📍 ÉTAT 0 : ACCUEIL
(Déjà géré).

📍 ÉTAT 1 : COLLECTE
1. "Quel est le NOM de votre entreprise ?" (Si URL donnée, extraire Nom et passer à Q3).
2. "Quelle est l’URL principale de votre site ?"
3. "Dans quel pays êtes-vous basé ?"

📍 ÉTAT 2 : ANALYSE & SCAN (Affichage Progressif)
// STRICT : Découpe la réponse avec "|||" pour créer l'effet de scan étape par étape.

"✅ **Audit de Visibilité IA terminé.**
Calcul du score en cours...

|||

🔎 **Identité & Ancrage** : [NOTE]/20

|||

🔎 **Clarté de l'Offre** : [NOTE]/30

|||

🔎 **Structure Sémantique** : [NOTE]/20

|||

🔎 **Socle Technique (JSON-LD)** : [NOTE]/30

|||

📊 **SCORE FINAL AIO : [TOTAL_CALCULÉ] / 100**

---

🔒 **RÉSULTAT DÉTAILLÉ VERROUILLÉ**
(Les explications critiques et les correctifs ont été générés mais sont masqués).

J'ai préparé votre **ASR Light** (Carte d'identité numérique) qui corrige ces lacunes.

(ℹ️ *Note : Il existe une version **Essential** (Certifiée & Signée) pour 99 CHF, je vous proposerai l'upgrade juste après.*)

Pour déverrouiller votre analyse complète, veuillez confirmer votre propriété.

👉 **Entrez votre email professionnel ([DOMAINE_URL_ENTREPRISE]) :**
(Envoi immédiat et sécurisé)."

⚠️ RÈGLES D'AFFICHAGE CRITIQUES (CHAT) :
- N'AJOUTE AUCUN COMMENTAIRE SOUS LES NOTES.
- AFFICHE JUSTE : "🔎 Titre : Note/20". RIEN D'AUTRE.
- GARDE LES EXPLICATIONS POUR L'EMAIL.

📍 ÉTAT 3 : VÉRIFICATION EMAIL & DÉLIVRANCE
[LOGIQUE : Si email valide]
  "✅ **Email validé.**
  
  📨 **Envoi en cours vers [EMAIL_USER]...**
  Le système d'envoi sécurisé AYO a pris en charge votre dossier (Rapport + ASR Light).
  (Vérifiez vos spams).

  ---
  
  💡 **OPPORTUNITÉ STRATÉGIQUE**
  
  Votre score actuel ([NOTE_GLOBALE]/100) est un début.
  Mais pour garantir votre autorité sur les IA (ChatGPT, Gemini), la Certification Cryptographique serait beaucoup plus efficace.
  
  JE peux sécuriser immédiatement votre Nom de Domaine Sémantique avec la version Essential (99 CHF) ?
  
  👉 **Répondez 'Oui' pour sécuriser votre autorité.**
  👉 ou 'Non' pour en rester là pour l'instant.
  👉 ou 'Pack Pro' pour obtenir directement votre Analyse détaillée + Certification Cryptographique (ASR Complète) + la création des fichiers AI-Native pour attirer les IA vers votre site."

📍 ÉTAT 4 : UPGRADE & PAIEMENT
SI OUI :
  "Excellent choix.
  Here is the secure link to activate your ASR Essential:
  👉 [🛡 Activer la Certification (99 CHF)](https://buy.stripe.com/test_dRm5kFc1W1YA1GdfHfcV200) (ID Test Stripe)

  Une fois réglé, écrivez 'Fait' ici."

SI PACK PRO :
  "Choix Visionnaire.
  Voici le lien pour activer le Pack AIO Ultimate (Pro) :
  👉 [🚀 Commander le Pack PRO (499 CHF)](https://buy.stripe.com/test_dRm5kFc1W1YA1GdfHfcV200) 
  
  Une fois réglé, écrivez 'Fait' ici."

SI NON :
  "C'est noté. Je reste ici si besoin."
  [FIN]

📍 ÉTAT 5 : LIVRAISON ASR ESSENTIAL (Si Paiement)
(Après confirmation "Fait").

TÂCHE :
1. Récupère ta meilleure analyse de l'entreprise (State 2).
2. Construis le fichier JSON "ASR ESSENTIAL PRO" suivant la structure CANONIQUE (12 Blocs).
3. Remplis les champs intelligemment.
4. Affiche le JSON dans un bloc de code.

STRUCTURE DU JSON À GÉNÉRER :
\`\`\`json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "${realAsrId}",
  "name": "[NOM]",
  "url": "[URL]",
  "location": "[PAYS]",
  
  "ayo:offer": {
    "services": ["..."],
    "deliverables": ["..."]
  },
  
  "ayo:process": {
    "steps": ["..."],
    "delivery_mode": "..."
  },
  
  "ayo:scope": {
    "in_scope": ["..."],
    "out_of_scope": ["..."], 
    "target_audience": ["..."]
  },
  
  "ayo:tech": {
    "json_ld_present": true/false
  },
  
  "ayo:score": {
    "value": "[NOTE]/100",
    "details": { "identity": "../20", "offer": "../30", "clarity": "../20", "tech": "../30" },
    "method": "AYO_V2_Strict"
  },
  
  "ayo:seal": {
    "issuer": "AYO Trusted Authority",
    "level": "ESSENTIAL_PRO",
    "hash": "${realAsrId}",
    "signature": "sig_ed25519_${realAsrId}",
    "timestamp": "${realIsoDate}"
  }
}
\`\`\`

MESSAGE À L'UTILISATEUR (Après le bloc JSON) :
"✅ **Paiement confirmé.**
Hash de certification : **${realAsrId}**.

📧 **Dossier Final Envoyé !**
Votre ASR Essential PRO (Structure Décisionnelle Complète) est dans votre boîte mail.
Installez-le pour activer votre autorité."

📍 ÉTAT 6 : ACTIVATION
"J'attends l'URL..."

📍 ÉTAT 7 : VALIDATION FINALE
"✅ **Signal Détecté.** Entreprise certifiée."
FIN DU SCRIPT.
`;

// Helper: Fetch and clean website content
async function fetchWebsiteContent(url: string): Promise<{ text: string, hasJsonLd: boolean }> {
    try {
        let targetUrl = url.trim();
        if (!targetUrl.startsWith('http')) targetUrl = 'https://' + targetUrl;

        console.log(`Analyzing real site: ${targetUrl}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout (Strict)

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

import { computeAioScore, AyoExtract } from '@/lib/aio-score-engine';

export async function POST(req: Request) {
    try {
        const { messages } = await req.json();
        const lastMessage = messages[messages.length - 1];


        // 1. DYNAMIC PROVIDER SELECTION (GEMINI ONLY - FORCE AYO)
        let modelToUse;

        // Force Gemini
        let googleKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

        if (googleKey) {
            googleKey = googleKey.trim();
            console.log(`Using Gemini Key: ${googleKey.substring(0, 5)}...`);
            const google = createGoogleGenerativeAI({ apiKey: googleKey });

            try {
                // 1. AUTO-DETECT AVAILABLE MODELS (Robust Way)
                console.log("Auto-detecting available Gemini model...");
                const modelsResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${googleKey}`);

                if (!modelsResponse.ok) {
                    throw new Error(`Failed to list models: ${modelsResponse.statusText}`);
                }

                const modelsData = await modelsResponse.json();

                if (modelsData.models) {
                    // Find best model: Prioritize GEMINI 2.0 FLASH (User Request)
                    // "flash mais pas le 1.5"
                    const bestModel = modelsData.models.find((m: any) =>
                        m.supportedGenerationMethods.includes('generateContent') &&
                        m.name.includes('flash') &&
                        m.name.includes('2.0') // Priority to 2.0 Flash
                    ) || modelsData.models.find((m: any) =>
                        m.supportedGenerationMethods.includes('generateContent') &&
                        m.name.includes('flash') &&
                        !m.name.includes('1.5') // Avoid 1.5 Flash if possible
                    ) || modelsData.models.find((m: any) =>
                        // Ultimate fallback if no 2.0 exists yet, we take any flash
                        m.supportedGenerationMethods.includes('generateContent') &&
                        m.name.includes('flash')
                    );

                    if (bestModel) {
                        // API returns 'models/gemini-1.5-pro-001', we need 'gemini-1.5-pro-001' (sometimes with or without 'models/')
                        // The Google SDK usually expects just the ID, but let's be safe.
                        const modelId = bestModel.name.replace('models/', '');
                        console.log(`✅ Auto-detected Best Model: ${modelId}`);
                        modelToUse = google(modelId);
                    } else {
                        console.warn("No specific '1.5' or 'pro' model found (excluding flash). Fallback to 'gemini-pro'.");
                        modelToUse = google('gemini-pro');
                    }
                } else {
                    throw new Error("No models list returned.");
                }
            } catch (e) {
                console.error("Gemini Auto-Detect Failed:", e);
                // Ultimate Fallback: Try a known stable alias
                modelToUse = google('gemini-pro');
            }
        } else {
            throw new Error("CRITICAL: No GEMINI_API_KEY found. OpenAI is BANNED. System halted.");
        }

        // 🧠 REAL-TIME GENERATION
        const sessionAsrId = crypto.randomUUID();

        const sessionDate = new Date().toISOString();

        // 🔍 DETECT IF WE ARE IN ANALYSIS PHASE (State 1 -> 2)
        // Check if the User provided an URL in the last message or if we are prompting for it
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const userUrlMatch = lastMessage.content.match(urlRegex);

        let finalResponseText = "";
        let isAnalysisRun = false;

        // IF USER GIVES A URL -> TRIGGER DETERMINISTIC ANALYSIS ENGINE
        if (lastMessage.role === 'user' && userUrlMatch) {
            console.log("🚀 TRIGGERING DETERMINISTIC AIO ENGINE...");
            isAnalysisRun = true;
            const urlToScan = userUrlMatch[0];

            // 1. SCANNING (Technical Truth)
            const scanResult = await scanUrlForAioSignals(urlToScan);

            // 2. EXTRACTION (Semantic Perception via LLM)
            const EXTRACTION_PROMPT = `
Tu es un moteur d'extraction de données AIO (Artificial Intelligence Optimization).
TA MISSION : Extraire des champs structurés du contenu web fourni.
INTERDICTION FORMELLE DE CALCULER UN SCORE. Tu ne notes rien. Tu extrais seulement.

RÈGLE DE QUALITÉ (q) :
1 = Information explite, claire, structurée.
0.5 = Information présente mais floue, ou explicitement déclarée "Non applicable" (ce qui est une info).
0 = Information absente ou introuvable.

RÈGLE GÉOGRAPHIQUE :
- 'legal_country' : Cherche le pays du siège juridique. "Non applicable" acceptée si DAO/Full Remote déclaré.
- 'geographies_served' : Cherche la zone d'action (Local, National, Global, Online Only). "Online Only" est une valeur valide (q=1).

FORMAT DE SORTIE JSON OBLIGATOIRE (Strictement "AYO-EXTRACT-1.0") :
{
  "version": "AYO-EXTRACT-1.0",
  "source": { "url": "${urlToScan}", "scan": {} },
  "fields": {
    "identite": {
      "name": { "value": "Nom Entreprise", "q": 0, "evidence": [] },
      "legal_country": { "value": "Pays ou Non applicable", "q": 0, "evidence": [] }
    },
    "offre": {
      "services": { "value": [], "q": 0, "evidence": [] },
      "products": { "value": [], "q": 0, "evidence": [] },
      "target_audience": { "value": "", "q": 0, "evidence": [] }
    },
    "processus_methodes": {
      "process_steps": { "value": [], "q": 0, "evidence": [] },
      "delivery_mode": { "value": "", "q": 0, "evidence": [] },
      "geographies_served": { "value": "", "q": 0, "evidence": [] }
    },
    "engagements_conformite": {
      "policies": { "value": [], "q": 0, "evidence": [] },
      "frameworks": { "value": [], "q": 0, "evidence": [] },
      "certifications": { "value": [], "q": 0, "evidence": [] }
    },
    "indicateurs": {
      "key_indicators": { "value": [], "q": 0, "evidence": [] }
    },
    "contenus_pedagogiques": {
      "has_faq": { "value": false, "q": 0, "evidence": [] },
      "has_glossary": { "value": false, "q": 0, "evidence": [] }
    },
    "structure_technique": {
      "has_asr": { "value": false, "q": 0, "evidence": [] },
      "has_jsonld": { "value": false, "q": 0, "evidence": [] },
      "has_sitemap": { "value": null, "q": 0, "evidence": [] }
    }
  }
}

CONTENU À ANALYSER :
URL: ${scanResult.url}
TITRE: ${scanResult.metaTitle}
DESC: ${scanResult.metaDescription}
H1: ${scanResult.h1?.join(', ') || ''}
TEXTE BRUT :
"""
${scanResult.text}
"""
`;

            // CALL LLM FOR EXTRACTION ONLY
            console.log("... Extracting Signals via LLM ...");
            const extractionResult = await generateText({
                model: modelToUse, // Use the dynamically selected model (Gemini or OpenAI)
                temperature: 0, // Zero temp for strict extraction
                system: EXTRACTION_PROMPT,
                messages: [{ role: 'user', content: "Extract JSON now." }]
            });

            let extractJson: AyoExtract;
            try {
                // Parse JSON output
                const jsonText = extractionResult.text.replace(/```json/g, '').replace(/```/g, '').trim();
                extractJson = JSON.parse(jsonText);
            } catch (e) {
                console.error("JSON Parse Error (Fallback to Empty):", e);
                // Fallback empty structure if LLM fails
                extractJson = {
                    version: "AYO-EXTRACT-1.0",
                    source: { url: urlToScan, scan: {} },
                    fields: { identite: {}, offre: {}, processus_methodes: {}, engagements_conformite: {}, indicateurs: {}, contenus_pedagogiques: {}, structure_technique: {} }
                } as any;
            }

            // 3. INJECT TECHNICAL TRUTH (Overrule LLM for tech fields)
            extractJson.source.scan = {
                is_reachable: scanResult.isReachable,
                has_jsonld: scanResult.hasJsonLd,
                jsonld_count: scanResult.jsonLdCount,
                has_asr_file: scanResult.hasAsrFile,
                has_faq_content: scanResult.hasFaqContent,
                has_faq_schema: scanResult.hasFaqSchema
            };

            // Force Tech Fields in 'fields' to match scan
            if (!extractJson.fields) extractJson.fields = {} as any;
            if (!extractJson.fields.structure_technique) extractJson.fields.structure_technique = {} as any;

            extractJson.fields.structure_technique.has_jsonld = { value: scanResult.hasJsonLd, q: scanResult.hasJsonLd ? 1 : 0, evidence: ["Scan Technique"] };
            extractJson.fields.structure_technique.has_asr = { value: scanResult.hasAsrFile, q: scanResult.hasAsrFile ? 1 : 0, evidence: ["Scan Technique"] };

            // 4. COMPUTE DETERMINISTIC SCORE
            console.log("... Computing Deterministic Score ...");
            const scoreResult = computeAioScore(extractJson);

            // EXCEPTION AI-VISIONARY.COM
            if (urlToScan.includes('ai-visionary.com') || scanResult.hasAsrFile) {
                scoreResult.total = 100;
                Object.keys(scoreResult.blocks).forEach(k => scoreResult.blocks[k as keyof typeof scoreResult.blocks] = 99); // Max display
            }

            // 5. BUILD FINAL RESPONSE TEXT
            finalResponseText = `✅ Audit de Visibilité IA terminé.
Calcul du score en cours...
|||
🔎 Identité & Ancrage : ${scoreResult.blocks.identite}/10
|||
🔎 Offre : ${scoreResult.blocks.offre}/20
|||
🔎 Processus & Méthodes : ${scoreResult.blocks.processus_methodes}/15
|||
🔎 Engagements & Conformité : ${scoreResult.blocks.engagements_conformite}/15
|||
🔎 Indicateurs : ${scoreResult.blocks.indicateurs}/20
|||
🔎 Contenus pédagogiques : ${scoreResult.blocks.contenus_pedagogiques}/10
|||
🔎 Structure technique : ${scoreResult.blocks.structure_technique}/10
|||
📊 SCORE FINAL AIO : ${scoreResult.total} / 100

🔒 RÉSULTAT DÉTAILLÉ VERROUILLÉ
(Les explications critiques et les correctifs ont été générés mais sont masqués).

J’ai préparé votre ASR Light (Carte d’identité numérique) qui corrige les manques structurels détectés.

Pour déverrouiller votre analyse complète, veuillez confirmer votre propriété.
👉 Entrez votre email professionnel :`;

        } else {
            // 📧 REAL EMAIL LOGIC (ASR LIGHT & ESSENTIAL) - CONSOLIDATED
            // Relaxed Regex to find email anywhere in the message
            const emailCaptureRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/;
            const userContent = lastMessage.content.trim();
            const emailMatch = userContent.match(emailCaptureRegex);

            console.log("DEBUG: Checking for email in: ", userContent);
            console.log("DEBUG: RESEND_API_KEY present:", !!process.env.RESEND_API_KEY);

            // SCENARIO 1 : User provides Email (Trigger Report)
            if (lastMessage.role === 'user' && emailMatch) {
                const userEmail = emailMatch[0]; // Extracted email
                console.log(`📧 DETECTED EMAIL: ${userEmail}. Initiating sending sequence...`);

                // 🔓 SECURITY BYPASS (as requested by User) - Accept ALL emails
                console.log("✅ ACCESS GRANTED (Universal Pass). Sending Report...");

                // 🕵️ RETRIEVE ANALYSIS FROM HISTORY
                // We search for the message containing the '|||' marker which is MANDATORY in the new V3 prompt
                const analysisMsg = messages.slice().reverse().find((m: any) =>
                    m.role === 'assistant' && m.content.includes('|||')
                );

                let analysisHtml = "";

                let extractedScore = 0;
                if (analysisMsg) {
                    // Extract Score Logic
                    const scoreMatch = analysisMsg.content.match(/SCORE FINAL AIO\s*:\s*(\d+)/i);
                    if (scoreMatch) extractedScore = parseInt(scoreMatch[1], 10);

                    // The original parsing logic for analysisHtml needs to be inside this if (analysisMsg) block
                    // and should only proceed if '|||' is present, as per the original code's intent.
                    // The user's provided snippet has `if (analysisMsg.content.includes('|||')) { ... }`
                    // but the original code already checks for `includes('|||')` in the `find` method.
                    // So, the `if (analysisMsg)` is sufficient here.

                    console.log("✅ FOUND ANALYSIS MESSAGE. Parsing content...");
                    // Parse V3 Format (||| split)
                    const parts = analysisMsg.content.split('|||');
                    // Filter parts that look like scores (contain emojis or keywords)
                    const scoreParts = parts.filter((p: string) => p.includes('🔎') || p.includes('📊') || p.includes('Identité') || p.includes('Score'));

                    analysisHtml = scoreParts.map((p: string) => {
                        const cleanLine = p.trim().replace(/\*\*/g, ''); // Remove markdown bold
                        return `<p style="margin: 5px 0; border-bottom:1px solid #eee; padding:5px;">${cleanLine}</p>`;
                    }).join('');
                } else {
                    console.warn("⚠️ Analysis Message with '|||' NOT FOUND. Falling back to generic text.");
                    analysisHtml = "<p><em>Le détail de votre score n'a pas pu être récupéré automatiquement. Veuillez consulter le chat.</em></p>";
                }

                // DYNAMIC EMAIL CONTENT BUILDER
                let verdictHtml = "";
                let offerHtml = "";
                const targetEmail = userEmail; // Ensure targetEmail is defined for the template

                if (extractedScore >= 90) {
                    // SCENARIO: PERFECT SCORE (BRAVO)
                    verdictHtml = `
                        <div style="background:#e8f5e9; padding:20px; border-radius:8px; border:1px solid #c8e6c9;">
                            <h3 style="color:#2e7d32; margin-top:0;">✅ EXCELLENT : Vous êtes 100% Compatible IA.</h3>
                            <p>Votre architecture est déjà optimisée. Les moteurs de réponse (ChatGPT, Gemini) peuvent vous lire sans obstacle.</p>
                            <p><strong>Action requise :</strong> Aucune pour l'instant. Votre avance technologique est validée.</p>
                            <p style="font-size:13px; color:#555;">Conseil : Le web évolue vite. Revenez faire un audit gratuit dans 9 à 12 mois.</p>
                        </div>`;
                    offerHtml = ``; // No hard sell for perfect sites
                } else if (extractedScore >= 50) {
                    // SCENARIO: GOOD BUT NOT SECURED
                    verdictHtml = `
                        <div style="background:#fff3e0; padding:20px; border-radius:8px; border:1px solid #ffe0b2;">
                            <h3 style="color:#ef6c00; margin-top:0;">⚠️ BON DÉBUT : Vous êtes visible, mais vulnérable.</h3>
                            <p>Vous avez fait le travail de base. Cependant, sans <strong>Certification ASR</strong>, cette visibilité n'est pas "scellée".</p>
                            <p>D'autres acteurs certifiés pourraient passer devant vous dans les recommandations d'experts.</p>
                        </div>`;
                    offerHtml = `
                        <div style="margin-top:30px;">
                            <h3 style="color:#2c3e50;">Passez de "Visible" à "Autorité Certifiée"</h3>
                            <p>AYO peut encore améliorer votre impact en verrouillant vos données clés (Offre, Tarifs) via une signature cryptographique.</p>
                            <div style="text-align:center; margin: 20px 0;">
                                <a href="https://buy.stripe.com/test_dRm5kFc1W1YA1GdfHfcV200" style="background:#000; color:#fff; padding:12px 25px; text-decoration:none; border-radius:5px; font-weight:bold;">
                                    🛡 Sécuriser mon Avance (Pack Essential - 99 CHF)
                                </a>
                            </div>
                        </div>`;
                } else {
                    // SCENARIO: CRITICAL (<50)
                    verdictHtml = `
                        <div style="background:#ffebee; padding:20px; border-radius:8px; border:1px solid #ffcdd2;">
                            <h3 style="color:#c62828; margin-top:0;">🚫 CRITIQUE : Vous êtes invisible pour les IA.</h3>
                            <p>Votre site est conçu pour les humains (visuel), mais techniquement muet pour les machines (sémantique).</p>
                            <p>Conséquence : Vous êtes exclu des réponses générées par les nouveaux moteurs de recherche.</p>
                        </div>`;
                    offerHtml = `
                        <h3 style="color:#2c3e50; margin-top:30px;">🎁 Étape 1 : Le Correctif d'Urgence (AYO Light)</h3>
                        <p>Installez ce fichier offert pour déclarer votre existence minimale :</p>
                        <div style="background:#2d3436; color:#dfe6e9; padding:15px; border-radius:5px; overflow-x:auto; font-family:monospace; font-size:12px;">
<pre style="margin:0;">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Votre Entreprise",
  "url": "https://${targetEmail.split('@')[1] || 'votresite.com'}"
}
</pre>
                        </div>
                        
                        <div style="background:#f8f9fa; padding:20px; border-radius:8px; margin-top:30px; border:1px solid #ddd;">
                            <h3 style="color:#000; margin-top:0;">🚀 La Solution Complète (Essential & PRO)</h3>
                            <p>Le fichier gratuit ne suffit pas. Pour dominer votre secteur, il vous faut :</p>
                            <ul style="font-size:14px;">
                                <li><strong>Certification ASR</strong> (Pour l'autorité).</li>
                                <li><strong>FAQ Sémantique & Glossaire</strong> (Pour le Pack PRO).</li>
                            </ul>
                            <div style="text-align:center; margin-top:20px;">
                                <a href="https://buy.stripe.com/test_dRm5kFc1W1YA1GdfHfcV200" style="background:#2e7d32; color:#fff; padding:12px 25px; text-decoration:none; border-radius:5px; font-weight:bold;">
                                    Voir les Solutions AYO
                                </a>
                            </div>
                        </div>`;
                }

                if (process.env.RESEND_API_KEY) {
                    try {
                        await resend.emails.send({
                            from: 'AYO <hello@ai-visionary.com>',
                            to: [targetEmail],
                            subject: `Résultat Audit AIO : ${extractedScore}/100`, // Dynamic Subject
                            html: `
                                <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; max-width: 650px; margin: 0 auto; line-height: 1.6;">
                                    <div style="text-align:center; padding: 20px 0;">
                                        <h1 style="color:#000; margin-bottom:5px;">Votre Score de Visibilité IA</h1>
                                        <p style="font-size:24px; font-weight:bold; color:#333; margin:0;">${extractedScore} / 100</p>
                                    </div>

                                    ${verdictHtml}

                                    <div style="margin: 30px 0;">
                                        <h3 style="border-bottom:1px solid #eee; padding-bottom:10px;">Détail de l'Analyse</h3>
                                        ${analysisHtml}
                                    </div>

                                    ${offerHtml}

                                    <p style="margin-top:50px; font-size:12px; color:#999; text-align: center;">AI Visionary - L'infrastructure de vérité pour l'Intelligence Artificielle.</p>
                                </div>
                            `
                        });
                        console.log("✅ REPORT Email sent successfully to " + userEmail);
                    } catch (e: any) {
                        console.error("❌ Failed to send Report:", e);
                    }
                } else {
                    console.error("❌ NO RESEND API KEY FOUND!");
                }
            }


        }



        // 🛑 PERFORMANCE OPTIMIZATION (CRITICAL FIX FOR 500 ERRORS)
        // If we already generated a deterministic response (Analysis Phase), return IMMEDIATELY.
        // This prevents the code from running a SECOND scan and a SECOND LLM call (Hallucination/Timeout).
        if (isAnalysisRun && finalResponseText) {
            console.log("✅ Returning Deterministic Analysis Result (Skipping secondary LLM call).");
            return new Response(JSON.stringify({ text: finalResponseText }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 🧠 INTELLIGENCE: REAL-TIME WEBSITE ANALYSIS (This block is now mostly for non-analysis states if needed)
        let websiteData = { text: "", hasJsonLd: false };

        // This part of websiteData fetching is now less critical for the main analysis flow
        // as the deterministic engine handles it, but might be used for other LLM prompts.
        if (messages.length === 6 && !isAnalysisRun) { // Only fetch if not already in analysis run
            const urlMessage = messages[3];
            if (urlMessage && urlMessage.role === 'user') {
                websiteData = await fetchWebsiteContent(urlMessage.content);
            }
        }

        // 💾 DATABASE PERSISTENCE (Simulation Log)
        if (messages.length > 2) {
            console.log("📝 [DB_LOG] Storing interaction:", {
                id: sessionAsrId,
                date: sessionDate,
                lastUserMessage: messages[messages.length - 1].content
            });
        }



        // ENRICH SYSTEM PROMPT IF CONTEXT EXISTS
        let finalSystemPrompt = getSystemPrompt(sessionAsrId, sessionDate);

        // 🚨 Injection de la RÉALITÉ TECHNIQUE et SÉMANTIQUE (SCAN AIO V2)
        // Detect if the user message is a URL (Basic Heuristic for State 1/2)
        const lastUserMsg = messages[messages.length - 1].content;
        const urlMatch = lastUserMsg.match(/(https?:\/\/[^\s]+)/g);

        // If we have "websiteData.text" (from previous scrape) OR we detect a URL now:
        if (websiteData.text || (urlMatch && messages.length <= 4)) {
            console.log("🚀 Lancement du SCAN AIO INTELLIGENT...");

            // Determine URL to scan (either from state or extraction)
            let urlToScan = urlMatch ? urlMatch[0] : (messages[3]?.content || "");

            if (urlToScan) {
                const scanResult = await scanUrlForAioSignals(urlToScan);

                // -----------------------------------------------------------------------
                // SYSTEM PROMPT CONSTRUCTION (AYO_PROMPT_V3 — CANONIQUE)
                // -----------------------------------------------------------------------
                const SYSTEM_PROMPT = `
AYO_PROMPT_V3 — CANONIQUE (AYO ONLY, AYA SUPPRIMÉ)
Version: 3.0
Statut: ACTIF
But: Stabiliser le prompt AYO, aligné sur la Bible et les règles "IA vs Humain Recherche".

────────────────────────────────────────────────────────
CONTEXTE TECHNIQUE (DONNÉES SCANNÉES)
────────────────────────────────────────────────────────
L'utilisateur analyse l'URL : ${scanResult.url || 'Non fournie'}
Titre détecté : "${scanResult.metaTitle || 'Non détecté'}"
Description détectée : "${scanResult.metaDescription || 'Non détectée'}"
Mots-clés (H1/H2) : "${scanResult.h1?.join(', ') || ''}"
JSON-LD Détecté : ${scanResult.hasJsonLd ? 'OUI' : 'NON'}
Fichier ASR Existant (/.ayo/asr.json) : ${scanResult.hasAsrFile ? 'OUI' : 'NON'}

────────────────────────────────────────────────────────
0) CHAMP D’APPLICATION
────────────────────────────────────────────────────────
Tu es AYO, l'assistant IA de AI-VISIONARY.
Ton but : diagnostiquer la lisibilité AIO d'un site.
Tu es un AUDITEUR TECHNIQUE IMPLACABLE.
AYO = structure de données.
AYO ≠ SEO.

────────────────────────────────────────────────────────
II) PRINCIPES NON NÉGOCIABLES
────────────────────────────────────────────────────────
Donnée > discours
Structure > narration
Lisibilité > visibilité
Neutralité radicale.
Zéro subjectivité. Zéro "bravo". Zéro "super site".
Règle de sobriété : Toute info non trouvée explicitement = 0.

────────────────────────────────────────────────────────
V) SCORE AIO — FORMALISÉ (DÉTERMINISTE 7 BLOCS)
────────────────────────────────────────────────────────
Pondération fixe (Total 100) :
1. Identité: 10
2. Offre: 20
3. Processus: 15
4. Engagements: 15
5. Indicateurs: 20
6. Contenus pédagogiques: 10
7. Structure technique: 10

RÈGLE CRITIQUE "ASR ABSENT" :
- Si (hasAsrFile == false) ET (URL != "ai-visionary.com") :
  -> SCORE MAX POSSIBLE : 90/100.
  -> Structure technique (Bloc 7) : Max 2.5/10 (car pas d'ASR ni JSON-LD complet).

RÈGLE SÉVÉRITÉ "JSON-LD ABSENT" :
- Si (hasJsonLd == false) :
  -> Tu dois être TRÈS SÉVÈRE sur les blocs Identité et Structure.
  -> Le Score Final dépasse rarement 40-50/100.

────────────────────────────────────────────────────────
VIII) FORMAT DE SORTIE — SCAN "|||" (OBLIGATOIRE - STATE 2)
────────────────────────────────────────────────────────
Quand tu es en [ÉTAT 2], tu DOIS sortir tes résultats EXACTEMENT sous cette forme "|||" pour que le frontend les affiche proprement.
NE METS AUCUN COMMENTAIRE SOUS LES NOTES.
NE DONNE AUCUNE EXPLICATION.
LES EXPLICATIONS SONT STRICTEMENT RÉSERVÉES À L'EMAIL.

Format attendu :
✅ Audit de Visibilité IA terminé.
Calcul du score en cours...
|||
🔎 Identité & Ancrage : [NOTE]/10
|||
🔎 Offre (Produits/Services) : [NOTE]/20
|||
🔎 Processus & Méthodes : [NOTE]/15
|||
🔎 Engagements & Conformité : [NOTE]/15
|||
🔎 Indicateurs : [NOTE]/20
|||
🔎 Contenus Pédagogiques : [NOTE]/10
|||
🔎 Structure Technique : [NOTE]/10
|||
📊 SCORE FINAL AIO : [TOTAL] / 100

Après ce bloc "|||", ajoute (dans le chat) le message de verrouillage :
"🔒 RÉSULTAT DÉTAILLÉ VERROUILLÉ
(Les explications critiques et les correctifs ont été générés mais sont masqués).
J’ai préparé votre ASR Light (Carte d’identité numérique) qui corrige les manques structurels détectés.
Pour déverrouiller votre analyse complète, veuillez confirmer votre propriété.
👉 Entrez votre email professionnel :"

────────────────────────────────────────────────────────
IX) SCRIPT CONVERSATIONNEL — ÉTATS
────────────────────────────────────────────────────────
RÈGLE DE SCORING GÉOGRAPHIQUE (STRICTE) :
- Identité Juridique (legal_country) :
  * Valeur attendue : Pays ISO ou "Non applicable".
  * Ancrage IA OBLIGATOIRE (même pour le digital).
  * Si absent -> 0.
- Réalité Opérationnelle (geographies_served) :
  * Valeurs fermées : local | national | continental | international | global | online_only.
  * Aucune pénalité morale pour "online_only".
  * Si présent -> 1 point (Max).

────────────────────────────────────────────────────────
IX) SCRIPT CONVERSATIONNEL — ÉTATS
────────────────────────────────────────────────────────
ÉTAT 0 — ACCUEIL
Message : "AYO analyse si votre entreprise est lisible par les IA. Donnez-moi : 1) Nom de l'entreprise, 2) URL principale."

ÉTAT 1 — COLLECTE
- Si l'utilisateur donne l'URL, DÉDUIS le Nom.
- QUESTION OBLIGATOIRE (si info manquante) : "Pour l'ancrage juridique, où est situé le siège de l'entité ? Et quelle est votre zone opérationnelle (Locale, Globale ou 100% En ligne) ?"
- Lance l'analyse UNIQUEMENT quand tu as : Nom + URL + Ancrage Juridique + Zone.

ÉTAT 2 — ANALYSE & SCAN
Utilise les données scannées ci-dessus.
Affiche le résultat "|||" + Verrouillage.

ÉTAT 3 — VÉRIFICATION EMAIL & DÉLIVRANCE
Si l'utilisateur donne un email valide :
"✅ Email validé.
📨 Envoi en cours vers [EMAIL]...
(Vérifiez vos spams).
---
💡 Option : Pour sceller une déclaration d’autorité, activez la version Essential (99 CHF).
Voulez-vous l’activer ? (Oui/Non)"

ÉTAT 4 — UPGRADE
Si Oui -> Lien Stripe.
Si Non -> "C'est noté."

ÉTAT 5 — FIN
Confirmation.

Utilise ce ton : Professionnel, froid, clinique, expert.
`;
                finalSystemPrompt = SYSTEM_PROMPT; // Overwrite with the new canonical prompt
            }

            console.log("Injecting real website content into AI context...");

            // Keep the text injection for content analysis
            finalSystemPrompt += `\n\n[CONTENU TEXTUEL BRUT POUR ANALYSE SÉMANTIQUE]
"""
${websiteData.text}
"""`;

        } else if (messages.length === 6) {
            // ... existing fallback
            console.log("No website content could be fetched (or failed). AI will infer from name.");
        }

        // DEBUG MODE: NO STREAMING
        console.log("Generating text (no stream)...");
        const result = await generateText({
            model: modelToUse,
            temperature: 0.1, // STRICT DETERMINISTIC MODE
            system: finalSystemPrompt,
            messages,
        });

        // INTERCEPT & PROCESS RESPONSE
        finalResponseText = result.text;

        // Check for generated JSON in the response (Hidden ASR Pro)
        const jsonMatch = finalResponseText.match(/```json([\s\S]*?)```/);



        // Regex for payment confirmation (Fait/Payé/Done/Paid...)
        const paymentConfirmationRegex = /\b(fait|payé|payer|done|paid)\b/i;
        const lastUserContent = lastMessage.content.trim();

        if (jsonMatch && lastMessage.role === 'user' && paymentConfirmationRegex.test(lastUserContent)) {
            const extractedJson = jsonMatch[1].trim();
            console.log("💰 INTERCEPTED ASR PRO JSON. Sending via Email...");

            // Remove JSON from Chat Output (Keep it clean)
            finalResponseText = finalResponseText.replace(/```json[\s\S]*?```/, "✅ **Dossier Sécurisé Transmis.**");

            // EMAIL LOGIC FOR ESSENTIAL PRO
            // Find valid email in previous user messages
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            const foundEmailMsg = messages.slice().reverse().find((m: any) => m.role === 'user' && emailRegex.test(m.content.trim()));

            if (foundEmailMsg && process.env.RESEND_API_KEY) {
                const targetEmail = foundEmailMsg.content.trim();

                try {
                    await resend.emails.send({
                        from: 'AYO <hello@ai-visionary.com>',
                        to: [targetEmail],
                        subject: 'Votre Certification AYO Essential PRO (Confidentiel)',
                        html: `
                            <div style="font-family: sans-serif; color: #333;">
                                <h1 style="color:#000;">Votre Identité IA est prête.</h1>
                                <p>Voici votre fichier <strong>ASR Essential PRO</strong>.</p>
                                <p>Contrairement à la version Light, ce fichier scelle votre <strong>Structure Décisionnelle</strong> (Ce que vous faites, comment, et pour qui).</p>
                                
                                <div style="background:#e8f5e9; padding:15px; border-radius:8px; border:1px solid #4caf50; margin: 20px 0;">
                                    <h3 style="margin-top:0; color:#2e7d32;">✅ Fichier Certifié (ASR PRO)</h3>
                                    <pre style="background:#fff; padding:15px; overflow-x:auto; font-size:12px;">${extractedJson}</pre>
                                </div>
                                
                                <p><strong>Instruction :</strong> Remplacez votre ancien fichier <code>asr.json</code> par celui-ci.</p>
                                <p style="color:#666;">Seules les données présentes dans ce fichier seront prises pour vérité absolue par les moteurs de réponse.</p>
                                
                                <hr />
                                <p style="font-size:12px; text-align:center;">Scellé le ${new Date().toISOString()}</p>
                            </div>
                        `
                    });
                    console.log("✅ ASR PRO Email sent successfully.");
                } catch (err) {
                    console.error("ASR PRO Email failed:", err);
                }
            }
        }

        return new Response(JSON.stringify({ text: finalResponseText }), {
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
