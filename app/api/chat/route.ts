// Force static for reliability? No, dynamic for streaming.
export const dynamic = 'force-dynamic';

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import fs from 'fs';
import path from 'path';
import { Resend } from 'resend';
import { scanUrlForAioSignals } from '@/lib/aio-scanner';
import { db } from '@/lib/db';
import crypto from 'crypto';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY || 're_build_placeholder');

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
const getSystemPrompt = (realAsrId: string, realIsoDate: string, targetUrl: string = "", targetEmail: string = "") => {
    // Generate Stripe Params with Metadata (Client Reference ID)
    // CRITICAL FIX: We MUST encode URL/Email in the ID because we are Stateless (Serverless).
    // DB persistence on /tmp does not work across Vercel lambdas.
    let stripeSuffix = "";

    if (targetUrl || targetEmail) {
        try {
            const payload: any = {};
            if (targetUrl) payload.u = targetUrl;
            if (targetEmail) payload.e = targetEmail;

            // Compact JSON + Base64
            const jsonStr = JSON.stringify(payload);
            const b64 = Buffer.from(jsonStr).toString('base64');

            // Stripe limit is 255 chars.
            if (b64.length <= 250) {
                stripeSuffix = `?client_reference_id=${b64}`;
                if (targetEmail) {
                    stripeSuffix += `&prefilled_email=${encodeURIComponent(targetEmail)}`;
                }
            } else {
                console.warn("Payload too long for Stripe client_reference_id, stripping email");
                // Retry with just URL
                if (targetUrl) {
                    const smallPayload = JSON.stringify({ u: targetUrl });
                    const smallB64 = Buffer.from(smallPayload).toString('base64');
                    stripeSuffix = `?client_reference_id=${smallB64}`;
                }
            }
        } catch (e) {
            console.error("Stripe Param Encoding Error", e);
        }
    }

    return `
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

📍 ÉTAT 1 : COLLECTE SIMPLE
1. "Je vais établir votre Diagnostic de Visibilité IA (Gratuit).
   Pour cela, indiquez-moi simplement l'URL principale de votre site."
   (Si l'utilisateur donne l'URL, extraire le Nom et le Pays automatiquement si possible, sinon on s'en passe).

2. Une fois l'URL reçue :
   - Lance l'analyse immédiatement (ÉTAT 2).

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

👉 **Entrez votre email professionnel de l'entreprise :**
⚠️ *Important : Seuls les emails du domaine analysé sont acceptés pour des raisons de sécurité.*
(Ex: si vous analysez example.com, utilisez contact@example.com)
(Envoi immédiat et sécurisé)."

⚠️ RÈGLES D'AFFICHAGE CRITIQUES (CHAT) :
- N'AJOUTE AUCUN COMMENTAIRE SOUS LES NOTES.
- AFFICHE JUSTE : "🔎 Titre : Note/20". RIEN D'AUTRE.
- GARDE LES EXPLICATIONS POUR L'EMAIL.

📍 ÉTAT 3 : VÉRIFICATION EMAIL & DÉLIVRANCE
[LOGIQUE : Si email valide et correspond au domaine]
  "✅ **Email validé.**
  
  📨 **Envoi en cours vers [EMAIL_USER]...**
  Le système d'envoi sécurisé AYO a pris en charge votre dossier (Rapport + ASR Light).
  (Vérifiez vos spams).

  ---
  
  💡 **OPPORTUNITÉ STRATÉGIQUE**
  
  Votre score actuel ([NOTE_GLOBALE]/100) est un début.
  Mais pour garantir votre intégrité identitaire sur les IA (ChatGPT, Gemini), la Certification Cryptographique serait beaucoup plus efficace.
  
  Je peux sécuriser immédiatement votre Nom de Domaine Sémantique avec la version Essential (99 CHF) ?
  
  👉 **[🛡 Obtenir mon ID ASR (Essential - 99 CHF)](https://buy.stripe.com/test_dRm5kFc1W1YA1GdfHfcV200${stripeSuffix})**
   (Certification ASR Essential + Analyse détaillée & Envoi par email)

   👉 **[🚀 Obtenir mon ASR PRO (499 CHF)](https://buy.stripe.com/test_14A00l3vq1YA98FgLjcV201${stripeSuffix})**
   (Certification ASR PRO + Analyse complète + Glossaire Sémantique + Fichiers AI-Native)

   👉 **[Cliquer sur 'LIGHT'](https://ai-visionary.com/api/light-report?email=${encodeURIComponent(targetEmail)})** (Analyse détaillée + Certification ASR simple)"

📍 ÉTAT 4 : UPGRADE & PAIEMENT
SI OUI :
  "Excellent choix.
  Here is the secure link to activate your ASR Essential:
  👉 [🛡 Activer la Certification (99 CHF)](https://buy.stripe.com/test_dRm5kFc1W1YA1GdfHfcV200${stripeSuffix}) (ID Test Stripe)

  Une fois le paiement confirmé, vos fichiers seront automatiquement envoyés par email (sous quelques minutes)."

SI PACK PRO :
  "🏆 **Choix Visionnaire.**
  
  Vous passez directement au niveau **Expert**.
  
  Voici votre lien sécurisé pour activer le **Pack AIO Ultimate (Pro)** :
  👉 [🚀 **Activer le Pack PRO (499 CHF)**](https://buy.stripe.com/test_14A00l3vq1YA98FgLjcV201${stripeSuffix})
  
  *(Inclut : Audit Complet + Certification ASR Pro + Architectures AI-Native + Glossaire Sémantique)*
  
  Une fois le paiement confirmé, vos fichiers seront automatiquement envoyés par email (sous quelques minutes)."

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
}

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
        // FIXED REGEX: Robust URL detection
        const urlRegex = /(?:https?:\/\/)?(?:www\.)?[-a-zA-Z0-9]{1,256}\.[a-zA-Z]{2,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;

        const rawUrlMatch = lastMessage.content.match(urlRegex);

        // CHECK IF IT IS AN EMAIL (Priority: If Email -> It's NOT a URL for analysis)
        const triggerEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const isTriggerEmail = lastMessage.content.trim().match(triggerEmailRegex);

        const userUrlMatch = isTriggerEmail ? null : rawUrlMatch;

        let finalResponseText = "";
        let isAnalysisRun = false;

        // IF USER GIVES A URL -> TRIGGER DETERMINISTIC ANALYSIS ENGINE
        if (lastMessage.role === 'user' && userUrlMatch) {
            console.log("🚀 TRIGGERING DETERMINISTIC AIO ENGINE...");
            isAnalysisRun = true;
            let urlToScan = userUrlMatch[0];

            // Normalize URL: Ensure https://
            if (!urlToScan.startsWith('http')) {
                urlToScan = 'https://' + urlToScan;
            }

            // 1. SCANNING (Technical Truth)
            const scanResult = await scanUrlForAioSignals(urlToScan);

            // 2. EXTRACTION (Semantic Perception via LLM)
            const EXTRACTION_PROMPT = `
Tu es un moteur d'extraction de données AIO (Artificial Intelligence Optimization).
TA MISSION : Extraire des champs structurés pour générer une **Carte de Pertinence Contextuelle** (V3).
INTERDICTION FORMELLE DE CALCULER UN SCORE. Tu ne notes rien. Tu extrais seulement.

RÈGLE DE QUALITÉ (q) :
1 = Information explicite, claire, structurée.
0.5 = Information présente mais floue.
0 = Absent.

RÈGLES V3 "CONTEXT & SIMULATION" :
1. **Contextual Relevance** : Définis pour quels intents utilisateurs ce site est pertinent (ex: "Local Search", "B2B Query").
2. **AI Simulation** : Simule 3 requêtes (Local, Expert, Specifique) et décide si une IA recommanderait ce site AUJOURD'HUI.
3. **Selection Conditions** : Qu'est-ce qui manque pour être sélectionné ? (ex: address missing).

FORMAT DE SORTIE JSON OBLIGATOIRE (Strictement "AYO-EXTRACT-3.0") :
{
  "version": "AYO-EXTRACT-3.0",
  "source": { "url": "${urlToScan}", "scan": {} },
  "fields": {
    "identite": {
      "name": { "value": "Nom", "q": 0, "evidence": [] },
      "legal_name": { "value": "", "q": 0, "evidence": [] },
      "business_type": { "value": "Type Schema.org", "q": 0, "evidence": [] },
      "city": { "value": "", "q": 0, "evidence": [] },
      "country": { "value": "Pays", "q": 0, "evidence": [] },
      "contact_email": { "value": "", "q": 0, "evidence": [] },
      "contact_phone": { "value": "", "q": 0, "evidence": [] }
    },
    "offre": {
      "services": { "value": [], "q": 0, "evidence": [] },
      "products": { "value": [], "q": 0, "evidence": [] },
      "use_cases": { "value": [], "q": 0, "evidence": [] },
      "target_audience": { "value": "", "q": 0, "evidence": [] },
      "pricing_indication": { "value": "", "q": 0, "evidence": [] }
    },
    "processus_methodes": {
      "process_steps": { "value": [], "q": 0, "evidence": [] },
      "delivery_mode": { "value": "", "q": 0, "evidence": [] },
      "geographies_served": { "value": "", "q": 0, "evidence": [] },
      "quality_assurance": { "value": "", "q": 0, "evidence": [] }
    },
    "engagements_conformite": {
      "policies": { "value": [], "q": 0, "evidence": [] },
      "frameworks": { "value": [], "q": 0, "evidence": [] },
      "certifications": { "value": [], "q": 0, "evidence": [] },
      "security_measures": { "value": [], "q": 0, "evidence": [] }
    },
    "indicateurs": {
      "key_indicators": { "value": [], "q": 0, "evidence": [] },
      "last_review_date": { "value": "", "q": 0, "evidence": [] }
    },
    "contextual_signals": {
      "pricing_level": { "value": "premium/standard/undisclosed", "q": 0, "evidence": [] },
      "access_mode": { "value": "public/membersOnly", "q": 0, "evidence": [] },
      "service_mode": { "value": ["onSite", "online"], "q": 0, "evidence": [] },
      "schedule_type": { "value": ["businessHours"], "q": 0, "evidence": [] }
    },
    "contenus_pedagogiques": {
      "has_faq": { "value": false, "q": 0, "evidence": [] },
      "has_glossary": { "value": false, "q": 0, "evidence": [] },
      "has_documentation": { "value": false, "q": 0, "evidence": [] }
    },
    "structure_technique": {
      "has_asr": { "value": false, "q": 0, "evidence": [] },
      "has_jsonld": { "value": false, "q": 0, "evidence": [] },
      "has_sitemap": { "value": null, "q": 0, "evidence": [] },
      "mobile_optimized": { "value": true, "q": 1, "evidence": ["Assumed"] }
    },
    "recommandation": {
        "contextual_relevance": { "value": [
            { "userIntent": "Ex: Recherche Salle Sport", "queryExamples": ["gym near me"], "decisionCriteria": ["proximity", "pricing"], "status": "eligible/uncertain" }
        ], "q": 1, "evidence": [] },
        "selection_conditions": { "value": {
            "required": ["Ex: Pricing", "Location"],
            "exclusion": ["Ex: No City Found"]
        }, "q": 1, "evidence": [] },
        "ai_simulation": { "value": [
            { "query": "Ex: Centre en ville", "result": "✅/⚠️/❌", "reason": "Address found." }
        ], "q": 1, "evidence": [] }
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
                    version: "AYO-EXTRACT-3.0",
                    source: { url: urlToScan, scan: {} },
                    fields: {
                        identite: { name: { value: "Fallback", q: 0 } },
                        offre: {},
                        processus_methodes: {},
                        engagements_conformite: {},
                        indicateurs: {},
                        contextual_signals: {},
                        contenus_pedagogiques: {},
                        structure_technique: {},
                        recommandation: {
                            contextual_relevance: { value: [], q: 0 },
                            selection_conditions: { value: { required: [], exclusion: [] }, q: 0 },
                            ai_simulation: { value: [], q: 0 }
                        }
                    }
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

            // 4b. GENERATE STRUCTURED ANALYSIS (CLEAN DB STORAGE)
            const structuredAnalysis: any = {
                identite: { score: scoreResult.blocks.identite, max: 10, label: "Identité & Ancrage" },
                offre: { score: scoreResult.blocks.offre, max: 20, label: "Clarté de l'Offre" },
                processus: { score: scoreResult.blocks.processus_methodes, max: 15, label: "Processus & Méthodes" },
                confiance: { score: scoreResult.blocks.engagements_conformite, max: 15, label: "Confiance & Conformité" },
                technique: { score: scoreResult.blocks.structure_technique, max: 10, label: "Socle Technique" }
            };

            // Add Observations logic
            // 1. Identité
            if (structuredAnalysis.identite.score < 8) {
                structuredAnalysis.identite.status = "error";
                structuredAnalysis.identite.observation = "Manque d'éléments d'ancrage (Logo, Siret ou Description officielle).";
            } else {
                structuredAnalysis.identite.status = "success";
                structuredAnalysis.identite.observation = "Identité numérique validée.";
            }

            // 2. Offre
            if (structuredAnalysis.offre.score < 10) {
                structuredAnalysis.offre.status = "error";
                structuredAnalysis.offre.observation = "Sémantique floue. L'IA ne comprend pas clairement vos services.";
            } else if (structuredAnalysis.offre.score < 18) {
                structuredAnalysis.offre.status = "warning";
                structuredAnalysis.offre.observation = "Offre détectée mais manque de précision technique (Mots-clés).";
            } else {
                structuredAnalysis.offre.status = "success";
                structuredAnalysis.offre.observation = "Architecture de l'offre validée.";
            }

            // 3. Technique (Critical)
            const techMisses = [];
            if (!scanResult.hasJsonLd) techMisses.push("JSON-LD");
            if (!scanResult.hasAsrFile) techMisses.push("Fichier ASR");

            if (techMisses.length > 0) {
                structuredAnalysis.technique.status = "error";
                structuredAnalysis.technique.observation = `Lacunes critiques : ${techMisses.join(', ')}.`;
            } else {
                structuredAnalysis.technique.status = "success";
                structuredAnalysis.technique.observation = "Infrastructure compatible IA.";
            }

            // Default others
            structuredAnalysis.processus.status = structuredAnalysis.processus.score < 8 ? "warning" : "success";
            structuredAnalysis.processus.observation = structuredAnalysis.processus.score < 8 ? "Processus métier peu détaillés." : "Méthodologie claire.";

            structuredAnalysis.confiance.status = structuredAnalysis.confiance.score < 8 ? "warning" : "success";
            structuredAnalysis.confiance.observation = structuredAnalysis.confiance.score < 8 ? "Signaux de réassurance (RSE, Mentions) faibles." : "Niveau de confiance élevé.";


            //💾 SAVE COMPLETE ANALYSIS TO DB (Source of Truth for Webhook)
            console.log(`🔥 DEBUG: About to save analysis. SessionID: ${sessionAsrId}, Score: ${scoreResult.total}`);
            try {
                console.log(`🔥 DEBUG: Calling db.saveAnalysis...`);
                await db.saveAnalysis(sessionAsrId, {
                    id: sessionAsrId,
                    url: urlToScan,
                    email: null, // Will be updated when user provides email
                    score: scoreResult.total,
                    data: {
                        fields: extractJson.fields,
                        blocks: scoreResult.blocks,
                        scan: scanResult,
                        analysis_blocks: structuredAnalysis // <--- NEW STRUCTURED DATA
                    }
                });
                console.log(`💾 ANALYSIS SAVED TO DB: ${sessionAsrId}, Score: ${scoreResult.total}`);
            } catch (dbErr: any) {
                console.error("❌ Failed to save analysis to DB:", dbErr);
                console.error("❌ Error details:", dbErr.message, dbErr.stack);
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

ℹ️ *Note : L'analyse IA peut présenter de légères variations d'un scan à l'autre. Cette marge normale n'affecte pas la conformité technique du certificat ASR délivré.*

🔒 RÉSULTAT DÉTAILLÉ VERROUILLÉ
(Les explications critiques et les correctifs ont été générés mais sont masqués).

J’ai préparé votre ASR Light (Carte d’identité numérique) qui corrige les manques structurels détectés.

👉 Entrez votre email professionnel :`;

        } else {
            // 📧 REAL EMAIL LOGIC (ASR LIGHT & ESSENTIAL) - CONSOLIDATED
            // Relaxed Regex to find email anywhere in the message
            const emailCaptureRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/;
            const userContent = lastMessage.content.trim();
            const emailMatch = userContent.match(emailCaptureRegex);

            console.log("DEBUG: Checking for email in: ", userContent);
            console.log("DEBUG: RESEND_API_KEY present:", !!process.env.RESEND_API_KEY);

            // SCENARIO 1 : User provides Email (Update DB & Offer Payment)
            if (lastMessage.role === 'user' && emailMatch) {
                const userEmail = emailMatch[0];
                console.log(`📧 DETECTED EMAIL: ${userEmail}. Updating Analysis Record...`);

                // 1. Find the URL created in previous steps from history
                const historyUrlRegex = /(?:https?:\/\/)?(?:www\.)?[-a-zA-Z0-9]{1,256}\.[a-zA-Z]{2,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;

                // Find the user message that contained the URL (and was NOT an email)
                const historyUrlMatchMsg = messages.find((m: any) => {
                    const isMsgEmail = m.content.trim().match(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+$/);
                    return m.role === 'user' && m.content.match(historyUrlRegex) && !isMsgEmail;
                });

                let detectedUrl = "";
                if (historyUrlMatchMsg) {
                    const match = historyUrlMatchMsg.content.match(historyUrlRegex);
                    if (match) detectedUrl = match[0];
                    if (detectedUrl && !detectedUrl.startsWith('http')) detectedUrl = 'https://' + detectedUrl;
                }

                let analysisFound = false;

                if (detectedUrl) {
                    console.log(`🔍 Linking Email ${userEmail} to URL ${detectedUrl}...`);
                    // 2. RETRIEVE ANALYSIS FROM DB (Stateless Link)
                    try {
                        const existingAnalysis = await db.getLatestAnalysisByUrl(detectedUrl);

                        if (existingAnalysis) {
                            analysisFound = true;
                            // 3. UPDATE RECORD WITH EMAIL
                            await db.saveAnalysis(existingAnalysis.id, {
                                email: userEmail
                            });
                            console.log(`✅ DB UPDATED: ${userEmail} linked to Analysis ${existingAnalysis.id}`);

                            // Update context for Stripe generation later
                            // But we generate links manually below for clarity
                        } else {
                            console.warn(`⚠️ No existing analysis found in DB for ${detectedUrl}`);
                        }
                    } catch (dbErr) {
                        console.error("❌ Failed to link email to analysis:", dbErr);
                    }
                }

                // 4. VALIDATE EMAIL DOMAIN (Security Check)
                let emailDomainValid = false;
                let domainMismatchMessage = "";

                if (detectedUrl) {
                    try {
                        const urlObj = new URL(detectedUrl);
                        const analyzedDomain = urlObj.hostname.replace(/^www\./, '');
                        const emailDomain = userEmail.split('@')[1]?.toLowerCase();

                        // 🔒 SECURITY STRICT MODE: Only allow domain match
                        if (emailDomain === analyzedDomain) {
                            emailDomainValid = true;
                        } else {
                            // (Code reachable if mismatch)
                            domainMismatchMessage = `❌ **Email Refusé**

L'email \`${userEmail}\` ne correspond pas au domaine de votre site (\`${analyzedDomain}\`).

⚠️ **Pour des raisons de sécurité, seuls les emails professionnels de l'entreprise analysée sont acceptés.**
Ces fichiers contiennent des informations sensibles de votre organisation.

👉 **Veuillez entrer un email du domaine \`${analyzedDomain}\`**
(Ex: contact@${analyzedDomain} ou hello@${analyzedDomain})`;
                        }
                    } catch (e) {
                        console.error("Domain validation error:", e);
                        emailDomainValid = true; // Fallback: accept if URL parsing fails
                    }
                }

                // If email domain doesn't match, reject and ask again
                if (!emailDomainValid && domainMismatchMessage) {
                    finalResponseText = domainMismatchMessage;
                } else {
                    // 5. GENERATE STRIPE LINKS (Using Payload)
                    // We encode the URL and Email so Webhook can retrieve them regardless of DB state fallback
                    let stripeSuffix = "";
                    try {
                        const payload = { u: detectedUrl || "unknown", e: userEmail };
                        const jsonStr = JSON.stringify(payload);
                        const b64 = Buffer.from(jsonStr).toString('base64');
                        // Ensure < 255 chars
                        if (b64.length <= 250) {
                            stripeSuffix = `?client_reference_id=${b64}&prefilled_email=${encodeURIComponent(userEmail)}`;
                        }
                    } catch (e) { console.error("Stripe Param Error", e); }


                    // 6. RESPOND WITH PAYMENT OPTIONS (No Email Sent)
                    // v2.1 Strict No-Email Flow
                    finalResponseText = `✅ **Email enregistré.**

(Votre dossier est en cours de préparation, il vous sera envoyé quelques minutes après le paiement).

Choisissez votre niveau d'activation pour recevoir votre **Certification ASR** et les documents techniques :


👉 **[🛡 Obtenir mon ID ASR (Essential - 99 CHF)](https://buy.stripe.com/test_dRm5kFc1W1YA1GdfHfcV200${stripeSuffix})**
(Certification ASR Essential + Analyse détaillée & Envoi par email)

👉 **[🚀 Obtenir mon ASR PRO (499 CHF)](https://buy.stripe.com/test_14A00l3vq1YA98FgLjcV201${stripeSuffix})**
(Certification ASR PRO + Analyse complète + Glossaire Sémantique + Fichiers AI-Native)

👉 **[Cliquer sur 'LIGHT'](https://ai-visionary.com/api/light-report?email=${encodeURIComponent(userEmail)})** (Analyse détaillée + Certification ASR simple)`;
                }

            }
        } // END OF ELSE BLOCK (Email Logic)

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
        // Find URL in history to pass to Stripe (Robust Regex)
        const robustHistoryUrlRegex = /(?:https?:\/\/)?(?:www\.)?[-a-zA-Z0-9]{1,256}\.[a-zA-Z]{2,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;
        const historyUrlMatch = messages.find((m: any) => m.content.match(robustHistoryUrlRegex));
        let detectedUrl = historyUrlMatch ? historyUrlMatch.content.match(robustHistoryUrlRegex)[0] : "";

        // Normalize
        if (detectedUrl && !detectedUrl.startsWith('http')) detectedUrl = 'https://' + detectedUrl;

        // Find Email in history to pass to Stripe (Robust Backup)
        const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/;
        const historyEmailMatch = messages.slice().reverse().find((m: any) => m.role === 'user' && m.content.match(emailRegex));
        const detectedEmail = historyEmailMatch ? historyEmailMatch.content.match(emailRegex)[0] : "";

        let finalSystemPrompt = getSystemPrompt(sessionAsrId, sessionDate, detectedUrl, detectedEmail);

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

        // NEW: CRITICAL SAVE TO DB FOR SOURCE OF TRUTH
        if (jsonMatch) {
            const extractedJson = jsonMatch[1].trim();
            try {
                const parsed = JSON.parse(extractedJson);
                // Extract score if available
                let score = 0;
                if (parsed['ayo:score'] && parsed['ayo:score'].value) {
                    if (typeof parsed['ayo:score'].value === 'string') {
                        score = parseInt(parsed['ayo:score'].value) || 0;
                    } else {
                        score = parsed['ayo:score'].value;
                    }
                }

                // SAVE EXACT ANALYSIS TO DB (Source of Truth)
                await db.saveAnalysis(sessionAsrId, {
                    id: sessionAsrId,
                    url: parsed.url,
                    email: null,
                    score: score,
                    data: parsed
                });
                console.log(`💾 ANALYSIS SOURCE OF TRUTH SAVED: ${sessionAsrId}`);
            } catch (e) {
                console.error("❌ Failed to save source of truth to DB:", e);
            }
        }



        // REMOVED: "Fait" logic - Payment confirmation is now handled ONLY by Stripe Webhook
        // This prevents users from bypassing payment by simply typing "Fait" in the chat

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
