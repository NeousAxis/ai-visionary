// Force static for reliability? No, dynamic for streaming.
export const dynamic = 'force-dynamic';

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import fs from 'fs';
import path from 'path';
import { Resend } from 'resend';
import Link from 'next/link';
import { scanUrlForAioSignals } from '@/lib/aio-scanner';
import { db } from '@/lib/db';
import { registerOrUpdateEntity } from '@/lib/aya/registry'; // Logic Registry
import { AYO_BUSINESS_CATEGORIES, getScanSystemPrompt } from '@/lib/ayo-categories';
import crypto from 'crypto';
import Stripe from 'stripe';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY || 're_build_placeholder');

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    // @ts-ignore
    apiVersion: '2025-01-27.acacia', // Use latest API version compatible
});

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
const getSystemPrompt = (realAsrId: string, realIsoDate: string, targetUrl: string = "", targetEmail: string = "", isAyaRegisteredByScanner: boolean = false) => {
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
🏠 REGISTRE AYA: ${isAyaRegisteredByScanner ? "CERTIFIÉ" : "NON PRÉSENT"}

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

3. 2. Une fois l'URL reçue :
   - 🛑 STOP. Ne donne PAS le résultat tout de suite.
   - Lance le PROTOCOLE DE QUESTIONNEMENT JSON (Question 1 sur le PAYS).
   - FORMAT : JSON UNIQUEMENT.
   - 🚫 INTERDICTION DE POSER DES QUESTIONS EN TEXTE LIBRE.
   - 🚫 INTERDICTION DE POSER PLUSIEURS QUESTIONS.

⚠️ RÈGLE UNIVERSELLE :
Si tu dois poser une question, tu dois utiliser le format JSON "question_block".
Si tu poses une question en texte brut, LE SYSTÈME CRASHERA.
 UNE SEULE QUESTION À LA FOIS.
    // STRICT : Découpe la réponse avec "|||" pour créer l'effet de scan étape par étape.

    ✅ **Audit de Visibilité IA terminé.**
Calcul du score en cours...

|||

🔎 ** Identité & Ancrage ** : [NOTE] / 20

    |||

🔎 ** Clarté de l'Offre** : [NOTE]/30

    |||

🔎 ** Structure Sémantique ** : [NOTE] / 20

    |||

🔎 ** Socle Technique(JSON - LD) ** : [NOTE] / 30

    |||

📊 ** SCORE FINAL AIO: [TOTAL_CALCULÉ] / 100 **

    ---

🔒 ** RÉSULTAT DÉTAILLÉ VERROUILLÉ **
    (Les explications critiques et les correctifs ont été générés mais sont masqués).

J'ai analysé votre présence numérique et identifié les lacunes critiques.

(ℹ️ *Note : Il existe un **Abonnement AYA** (19 CHF) ou un **Pack PRO** (499 CHF) pour activer votre visibilité réelle.*)

Pour déverrouiller votre analyse complète, veuillez confirmer votre propriété.

👉 ** Entrez votre email professionnel de l'entreprise :**
⚠️ * Important : Seuls les emails du domaine analysé sont acceptés pour des raisons de sécurité.*
    (Ex: si vous analysez example.com, utilisez contact@example.com)
    (Envoi immédiat et sécurisé)."

⚠️ RÈGLES D'AFFICHAGE CRITIQUES (CHAT) :
    - N'AJOUTE AUCUN COMMENTAIRE SOUS LES NOTES.
        - AFFICHE JUSTE: "🔎 Titre : Note/20".RIEN D'AUTRE.
            - GARDE LES EXPLICATIONS POUR L'EMAIL.

📍 ÉTAT 3 : VÉRIFICATION EMAIL & DÉLIVRANCE
[LOGIQUE : Si email valide et correspond au domaine]
"✅ **Email validé.**
  
  📨 **Envoi en cours vers [EMAIL_USER]...**
    Le système d'analyse AYO a finalisé votre dossier.
    
  ---
  
  💡 **OPPORTUNITÉ STRATÉGIQUE**

    Votre score actuel ([NOTE_GLOBALE]/100) montre que vous avez des bases, mais pour garantir votre intégrité et votre priorité sur les IA (ChatGPT, Gemini), vous devez activer votre présence officielle.
  
  Je vous propose deux options :
  
  👉 **[💎 S'abonner au Registre AYA (19 CHF/mois)](https://buy.stripe.com/test_8x228t6HCcDegB7amVcV202${stripeSuffix})**
        (Location de visibilité : Registre AYA Actif + Priorité IA + Mises à jour incluses)

  👉 **[🚀 Acheter mes Actifs PRO (499 CHF One-Shot)](https://buy.stripe.com/test_14A00l3vq1YA98FgLjcV201${stripeSuffix})**
        (Propriété Totale + Fichiers Sources + 3 ANS de Registre offerts)"

📍 ÉTAT 4 : UPGRADE & PAIEMENT
SI ABONNEMENT AYA :
    "Excellent choix pour démarrer sans risque. Votre entité rejoindra le registre AYA immédiatement après validation."

SI PACK PRO :
    "🏆 **Choix Visionnaire.** Vous passez directement au niveau **Propriétaire**."

SI NON :
                    "C'est noté. Je reste ici si besoin."
                    [FIN]

📍 ÉTAT 5 : LIVRAISON ASR ESSENTIAL(Si Paiement)
                    (Après confirmation "Fait").

                    TÂCHE :
                    1. Récupère ta meilleure analyse de l'entreprise (State 2).
2. Construis le fichier JSON "ASR ESSENTIAL PRO" suivant la structure CANONIQUE(12 Blocs).
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
                    const bestModel = modelsData.models.find((m: any) =>
                        m.supportedGenerationMethods.includes('generateContent') &&
                        m.name.includes('flash') &&
                        m.name.includes('2.0') // Priority 1: Gemini 2.0 Flash (Speed/Smart)
                    ) || modelsData.models.find((m: any) =>
                        m.supportedGenerationMethods.includes('generateContent') &&
                        m.name.includes('pro') &&
                        m.name.includes('1.5') // Priority 2: Gemini 1.5 Pro (Fallback)
                    ) || modelsData.models.find((m: any) =>
                        m.supportedGenerationMethods.includes('generateContent') &&
                        m.name.includes('flash') // Priority 3: Any Flash
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
        // FIXED REGEX: Robust URL detection (V4.1 Permissive)
        const urlRegex = /[a-zA-Z0-9.-]+\.[a-zA-Z]{2,10}/gi;

        const rawUrlMatch = lastMessage.content.match(urlRegex);
        console.log("🔍 DEBUG V4.1: Parsed URL Match:", rawUrlMatch);

        // CHECK IF IT IS AN EMAIL (Priority: If Email -> It's NOT a URL for analysis)
        const triggerEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const isTriggerEmail = lastMessage.content.trim().match(triggerEmailRegex);

        let userUrlMatch = isTriggerEmail ? null : rawUrlMatch;

        let finalResponseText = "";
        let isAnalysisRun = false;

        // SMART TRIGGER LOGIC (V5 - ROBUST): 
        // Use findLastIndex to find the MOST RECENT URL provided by the user
        const urlMsgIndex = [...messages].reverse().findIndex((m: any) => m.role === 'user' && m.content.match(urlRegex));
        const hasUrlHistory = urlMsgIndex !== -1;
        const actualUrlMsgIndex = hasUrlHistory ? (messages.length - 1 - urlMsgIndex) : -1;

        console.log(`🔍 DEBUG TRIGGER: hasUrlHistory=${hasUrlHistory}, actualUrlMsgIndex=${actualUrlMsgIndex}`);
        if (hasUrlHistory) {
            console.log(`🔍 URL Message found: "${messages[actualUrlMsgIndex].content}"`);
        }

        const assistantMessages = messages.filter((m: any) => m.role === 'assistant');
        const hasFinalScore = assistantMessages.some((m: any) => m.content.includes("SCORE FINAL AIO"));

        // NEW: Check if we already sent a question_block (JSON format)
        const hasQuestionBlockSent = assistantMessages.some((m: any) =>
            m.content.includes('"type": "question_block"') || m.content.includes('question_block')
        );

        // ROBUST STEP COUNTING (V7 - SMART INTERRUPTIONS):
        // We filter out "Pedagogical Requests" (Why? How?) so they don't count as steps.
        // This prevents skipping questions when the user asks for clarification.
        let stepsCompleted = 0;
        if (hasUrlHistory) {
            const msgsAfterUrl = messages.slice(actualUrlMsgIndex + 1);

            const isPedagogicalRequest = (content: string) => {
                const lower = content.toLowerCase().trim();
                // EXCLUSION: Refusals ARE answers (should increment step/index)
                if (lower.match(/(débile|inutile|concerne pas|pas envie|sert a rien|non pertinent|stupide|pfff|n'importe quoi|ca me regarde pas)/)) return false;

                // DETECTION: Why/How/Explain
                if (lower.match(/^(pourquoi|comment|expli|quel est l'interet|a quoi ca sert|c'est quoi|non je veux dire|attends)/)) return true;
                if (lower.includes('?') && lower.length < 60 && !lower.includes('non') && !lower.includes('oui')) return true;
                return false;
            };

            stepsCompleted = msgsAfterUrl.filter((m: any) => m.role === 'user' && !isPedagogicalRequest(m.content)).length;
        }

        const hasQuestionBlock = stepsCompleted > 0; // Virtual indicator

        console.log(`DEBUG: Protocol Steps Completed (User Turns): ${stepsCompleted}/16`);
        console.log(`DEBUG: hasFinalScore=${hasFinalScore}`);
        console.log(`DEBUG: hasQuestionBlockSent=${hasQuestionBlockSent}`);

        // 🎯 TARGET URL IDENTIFICATION
        const urlInLastMessage = userUrlMatch ? userUrlMatch[0] : null;

        console.log(`🎯 TRIGGER ANALYSIS: urlInLastMessage=${urlInLastMessage}, stepsCompleted=${stepsCompleted}, hasFinalScore=${hasFinalScore}`);

        let triggerMode = "CHAT";

        // 🏗️ CONTEXT INITIALIZATION
        let detectedUrl = "";
        let detectedEmail = "";

        // URL Detection from current turn or history
        if (userUrlMatch) {
            detectedUrl = userUrlMatch[0];
        } else if (hasUrlHistory) {
            const histUrlMatch = messages[actualUrlMsgIndex].content.match(urlRegex);
            if (histUrlMatch) detectedUrl = histUrlMatch[0];
        }

        // Email Detection
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
        const emailMatch = lastMessage.content.match(emailRegex);
        if (emailMatch) {
            detectedEmail = emailMatch[0].toLowerCase();
        }

        // 🛡️ RECOVER COMPOSITE ACTION (update_profile|https://...)
        // If the user clicked a button with a piped payload
        if (lastMessage.content.startsWith("update_profile|")) {
            const parts = lastMessage.content.split('|');
            if (parts.length > 1 && parts[1].startsWith('http')) {
                // @ts-ignore
                userUrlMatch = [parts[1]]; // Mock Regex Match to trick downstream logic
                detectedUrl = parts[1];
                console.log(`🔄 RECOVERED URL FROM ACTION: ${detectedUrl}`);
            }
        }

        if (lastMessage.content.startsWith("main_menu|")) {
            const parts = lastMessage.content.split('|');
            if (parts.length > 1 && parts[1].startsWith('http')) {
                // @ts-ignore
                userUrlMatch = [parts[1]];
                detectedUrl = parts[1];
                console.log(`🔄 RECOVERED URL FROM MAIN_MENU ACTION: ${detectedUrl}`);
            }
        }

        // Prompt Context Initialization
        let promptScanResult: any = { url: detectedUrl, metaTitle: '', metaDescription: '', h1: [], hasJsonLd: false, hasAsrFile: false, isAyaRegistered: false };

        // 🔍 DETERMINISTIC TRIGGER CALCULATOR
        // CRITICAL: We check if a scan has ALREADY been performed in this conversation.
        const hasScanInHistory = messages.some((m: any) => m.role === 'assistant' && m.content.includes('scan_state'));

        // PRIORITY 1: REGISTRY RECOGNITION (Existing Clients)
        if (urlInLastMessage && !hasFinalScore) {
            // @ts-ignore
            const existingClient = await db.getAyaEntityByUrl(urlInLastMessage);
            if (existingClient) {
                triggerMode = "EXISTING_CLIENT";
            } else if (!hasScanInHistory) {
                // Not in registry AND no scan in history -> FORCE START SCAN
                triggerMode = "SCAN_AND_QUESTION";
            } else {
                // URL repeated but scan already done -> Continue
                triggerMode = "CONTINUE_QUESTIONING";
            }
        }
        // PRIORITY 2: SALES FUNNEL (Update Profile or Packs)
        else if (lastMessage.content.toLowerCase().match(/(abonnement|pack pro|update_profile)/)) {
            triggerMode = lastMessage.content.toLowerCase().includes("update_profile") ? "SCAN_AND_QUESTION" : "SALES_FUNNEL";
        }
        // PRIORITY 2.5: MAIN MENU RETURN
        else if (lastMessage.content.startsWith("main_menu|")) {
            // If a scan is already in progress, continue the questionnaire instead of going to client menu
            if (hasScanInHistory && !hasFinalScore) {
                triggerMode = "CONTINUE_QUESTIONING";
            } else {
                triggerMode = "EXISTING_CLIENT";
            }
        }
        // PRIORITY 3: SEQUENTIAL QUESTIONING (If URL in history)
        else if (hasUrlHistory && !hasFinalScore) {
            if (stepsCompleted < 18) {
                triggerMode = "CONTINUE_QUESTIONING";
            } else {
                triggerMode = "FINAL_ANALYSIS";
            }
        }
        // PRIORITY 4: CHAT FALLBACK
        else {
            triggerMode = "CHAT";
        }

        console.log(`🎯 TRIGGER MODE: ${triggerMode} | URL: ${detectedUrl} | Steps: ${stepsCompleted} | HasScan: ${hasScanInHistory}`);

        console.log(`🎯 TRIGGER MODE CALCULATED: "${triggerMode}"`);

        // 🛡️ HANDLER: EXISTING_CLIENT (Immediate Recognition)
        // CRITICAL FIX: Handle case where triggerMode is set manualy to EXISTING_CLIENT
        // AND ensure we are NOT in an OTP flow (send_otp or 6 digits)
        const isOtpFlow = lastMessage.content.startsWith("send_otp") || lastMessage.content.match(/^\d{6}$/);

        if ((triggerMode === "EXISTING_CLIENT" || lastMessage.content === "EXISTING_CLIENT") && !isOtpFlow) {
            const ec_url = urlInLastMessage || detectedUrl || "";
            // @ts-ignore
            const client = await db.getAyaEntityByUrl(ec_url);

            if (!client) {
                // Fallback if URL lost: Asks user to re-identify or go to home
                return new Response(JSON.stringify({
                    text: `🔒 **Session Expirée.**\n\nJe ne retrouve pas votre URL de session. Veuillez entrer votre URL pour accéder à votre espace client.`,
                    buttons: []
                }), { status: 200 });
            }

            // FORCE RESET FOR UPDATE PROFILE
            const isUpdate = lastMessage.content.includes("update_profile");
            if (isUpdate) {
                console.log("🔄 UPDATE PROFILE TRIGGERED: FORCING RESCAN");
                // Do NOT return. Let it fall through to SCAN logic.
            } else {
                return new Response(JSON.stringify({
                    text: `🎉 **BRAVO ! VOUS ÊTES DÉJÀ CLIENT AYA.**\n\nL'entité **${client.display_name || client.legal_name}** est bien enregistrée et certifiée dans le Registre AYA.\n\nSouhaitez-vous :`,
                    buttons: [
                        { label: "Mettre à jour ma fiche 🔄", action: `update_profile|${ec_url}` },
                        { label: "Voir mon certificat 📜", action: "view_certificate", url: client.aya_entity_id ? `https://www.ai-visionary.com/aya/e/${client.aya_entity_id}` : undefined },
                        { label: "Gérer mon abonnement ⚙️", action: "manage_subscription" }
                    ]
                }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            }
        }

        // 🛡️ HANDLER: SUBSCRIPTION & CERTIFICATE (Quick Actions)
        const lowText = lastMessage.content.toLowerCase();
        if (lowText.includes("manage_subscription") || lowText.includes("résilier")) {

            let portalUrl = "";
            let messageText = `⚙️ **Gestion de votre Abonnement**\n\nAccédez à votre espace sécurisé pour gérer vos factures, votre moyen de paiement ou résilier votre abonnement en toute autonomie.`;

            // STRIPE PORTAL GENERATION
            if (process.env.STRIPE_SECRET_KEY && detectedUrl) {
                try {
                    console.log(`🔐 GENERATING PORTAL LINK for ${detectedUrl}...`);
                    // 1. Get Client from DB to find Stripe ID
                    // @ts-ignore
                    const clientSub = await db.getAyaEntityByUrl(detectedUrl);
                    let customerId = clientSub?.stripe_customer_id;

                    // 2. Fallback: Search Stripe by Email if ID missing in DB
                    if (!customerId && clientSub?.contact_email) {
                        const customers = await stripe.customers.list({ email: clientSub.contact_email, limit: 1 });
                        if (customers.data.length > 0) {
                            customerId = customers.data[0].id;
                            console.log(`✅ FOUND Stripe Customer ID via Email: ${customerId}`);
                        }
                    }

                    // 3. Create Portal Session
                    if (customerId) {
                        const session = await stripe.billingPortal.sessions.create({
                            customer: customerId,
                            return_url: `https://www.ai-visionary.com`, // Return to home after management
                        });
                        portalUrl = session.url;
                    } else {
                        console.warn("⚠️ No Stripe Customer ID found for portal generation.");
                    }
                } catch (e) {
                    console.error("🔥 Stripe Portal Error:", e);
                }
            }
            // 🛡️ SECURITY STEP: Don't give portal URL yet. Challenge with OTP first.
            // UNLESS already authenticated (Token in history? Hard in stateless).

            // 🛡️ SECURITY BLOCK: If manual click, force security check unless already authenticated (hard to detect stateless)
            // Retrieve Email to mask it properly
            // STRATEGY: Try Registry first, then Analysis (Fallback)
            let emailToUse = "";
            let clientSec: any = null;

            // 1. Registry Lookup
            // @ts-ignore
            clientSec = await db.getAyaEntityByUrl(detectedUrl);
            if (clientSec && clientSec.contact_email) {
                emailToUse = clientSec.contact_email;
            }

            // 2. Analysis Fallback (If registry empty or no email)
            if (!emailToUse) {
                console.log(`ℹ️ Email not in Registry, trying Analysis DB for ${detectedUrl}...`);
                // @ts-ignore
                const analysis = await db.getLatestAnalysisByUrl(detectedUrl);
                if (analysis && analysis.email) {
                    emailToUse = analysis.email;
                    console.log(`✅ Email found in Analysis: ${emailToUse}`);
                }
            }

            let maskedEmail = "admin@...";
            if (emailToUse) {
                const parts = emailToUse.split('@');
                if (parts.length === 2) {
                    const namePart = parts[0];
                    const domainPart = parts[1];
                    // Smart Masking: Show first 2 chars if len > 2, else 1 char
                    const showLen = namePart.length > 2 ? 2 : 1;
                    maskedEmail = `${namePart.substring(0, showLen)}***@${domainPart}`;
                }
            } else {
                console.warn(`⚠️ No email found for ${detectedUrl} in DB.`);
                // If we really can't find it, we shouldn't even offer the button ideally, but let's keep flow.
                maskedEmail = "inconnu (contactez le support)";
            }

            return new Response(JSON.stringify({
                text: `🔒 **Sécurité Requise**\n\nPour accéder aux données confidentielles de **${detectedUrl}**, je dois vérifier que vous êtes bien l'administrateur.\n\nJe peux envoyer un code temporaire à l'email connu (**${maskedEmail}**).`,
                buttons: [
                    { label: "Envoyer le code de sécurité 📨", action: `send_otp|${detectedUrl}` },
                    { label: "Annuler", action: `main_menu|${detectedUrl}` }
                ]
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // 🛡️ HANDLER: SEND OTP ACTION
        if (lastMessage.content.startsWith("send_otp|")) {
            const parts = lastMessage.content.split('|');
            const targetUrl = parts[1] || detectedUrl;

            console.log(`📧 SENDING OTP to owner of ${targetUrl}...`);

            // Call our internal API (Internal fetch)
            // We can't easily fetch internal localhost in Vercel Edge/Serverless sometimes without full URL.
            // Better to import logic? No, modularity. Let's try direct DB call or fetch absolute URL.
            // SAFEST: Direct DB/Resend call here or assume user will type code.

            // Simplest: Just simulate the API call here to ensure reliability
            // 1. Get Email (Robust Strategy: Registry -> Analysis)
            let targetEmail = "";

            // A. Registry
            // @ts-ignore
            const clientSec = await db.getAyaEntityByUrl(targetUrl);
            if (clientSec && clientSec.contact_email) {
                targetEmail = clientSec.contact_email;
            }

            // B. Analysis Fallback
            if (!targetEmail) {
                // @ts-ignore
                const analysis = await db.getLatestAnalysisByUrl(targetUrl);
                if (analysis && analysis.email) {
                    targetEmail = analysis.email;
                }
            }

            if (targetEmail) {
                const code = Math.floor(100000 + Math.random() * 900000).toString();
                // @ts-ignore
                await db.saveOTP(targetEmail, code);

                const { error } = await resend.emails.send({
                    from: 'AI Visionary Security <security@ai-visionary.com>',
                    to: [targetEmail],
                    subject: `🔒 Votre code de sécurité : ${code}`,
                    html: `
                    <div style="font-family: sans-serif; padding: 20px; color: #333;">
                        <h2>Code de Sécurité AYO</h2>
                        <p>Voici votre code de vérification pour <strong>${targetUrl}</strong> :</p>
                        <div style="background-color: #f3f4f6; padding: 15px; font-size: 24px; letter-spacing: 5px; font-weight: bold; text-align: center; border-radius: 8px; margin: 20px 0;">
                            ${code}
                        </div>
                        <p style="font-size: 12px; color: #666;">Valide 10 minutes. Ne le partagez pas.</p>
                    </div>
                    `
                });

                if (error) console.error("Resend Error", error);

                return new Response(JSON.stringify({
                    text: `✅ **Code Envoyé !**\n\nVeuillez consulter la boîte mail **${targetEmail.substring(0, 3)}***@...**\n\n👉 **Entrez le code à 6 chiffres ci-dessous :**`,
                    buttons: []
                }), { status: 200, headers: { 'Content-Type': 'application/json' } });

            } else {
                console.error(`❌ OTP Error: No email found for ${targetUrl}`);
                return new Response(JSON.stringify({
                    text: `❌ **Erreur :** Aucun email administrateur trouvé pour ce site.\n\nNous ne pouvons pas vérifier votre identité automatiquement.`,
                    buttons: [{ label: "Contacter le Support 📧", url: "mailto:hello@ai-visionary.com?subject=Problème Authentification OTP" }]
                }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            }
        }

        // 🛡️ HANDLER: VERIFY OTP CODE (Regex Detection)
        // If message is EXACTLY 6 digits
        if (lastMessage.content.trim().match(/^\d{6}$/)) {
            const code = lastMessage.content.trim();
            console.log(`🔐 VERIFYING CODE: ${code} for ${detectedUrl}`);

            // @ts-ignore
            const clientVerif = await db.getAyaEntityByUrl(detectedUrl);
            let emailToVerify = "";

            if (clientVerif && clientVerif.contact_email) {
                emailToVerify = clientVerif.contact_email;
            }
            if (!emailToVerify) {
                // @ts-ignore
                const analysis = await db.getLatestAnalysisByUrl(detectedUrl);
                if (analysis && analysis.email) emailToVerify = analysis.email;
            }

            if (emailToVerify) {
                // @ts-ignore
                const isValid = await db.verifyOTP(emailToVerify, code);

                if (isValid) {
                    // 🎉 SUCCESS: GENERATE PORTAL LINK NOW
                    let successUrl = "";
                    // Need Stripe ID logic again or ensure it's in clientVerif
                    let stripeId = clientVerif?.stripe_customer_id;

                    if (!stripeId && emailToVerify) {
                        // Fallback look up via Stripe API
                        const customers = await stripe.customers.list({ email: emailToVerify, limit: 1 });
                        if (customers.data.length > 0) stripeId = customers.data[0].id;
                    }

                    if (process.env.STRIPE_SECRET_KEY && stripeId) {
                        const session = await stripe.billingPortal.sessions.create({
                            customer: stripeId,
                            return_url: `https://www.ai-visionary.com`,
                        });
                        successUrl = session.url;
                    }

                    return new Response(JSON.stringify({
                        text: `🔓 **Identité Confirmée.**\n\nVous avez maintenant un accès sécurisé temporaire à votre espace de gestion.`,
                        buttons: [
                            { label: "Accéder au Portail Client 🔒", url: successUrl },
                            { label: "Mettre à jour ma fiche 🔄", action: `update_profile|${detectedUrl}` },
                            { label: "Retour Menu", action: `main_menu|${detectedUrl}` }
                        ]
                    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

                } else {
                    return new Response(JSON.stringify({
                        text: `⛔ **Code Incorrect ou Expiré.**\n\nVeuillez réessayer ou demander un nouveau code.`,
                        buttons: [
                            { label: "Renvoyer un code 📨", action: `send_otp|${detectedUrl}` }
                        ]
                    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
                }
            }
        }

        // 🛡️ HANDLER: PEDAGOGICAL (TRUTH & CONSISTENCY)
        // GUARD: Only trigger when NOT in active questionnaire to prevent hijacking mid-interview
        if (!hasScanInHistory && lowText.match(/(men[st]|mentir|fausse|fake|triche|vérité|honnête)/)) {
            return new Response(JSON.stringify({
                text: `💡 **Excellente question.**\n\nTechniquement, si vous mentez, AYO génèrera votre fichier ASR avec les informations fournies (donc votre certification technique sera valide).\n\n⚠️ **MAIS c'est une stratégie dangereuse.**\nLes IA (ChatGPT, Gemini) fonctionnent par **Recoupement de Preuves** :\n\n1. Elles lisent votre **Déclaration (ASR)**.\n2. Elles la comparent à votre **Réalité Observable** (Site Web, Avis, Base de données).\n\nS'il y a contradiction (ex: vous déclarez "Leader Mondial" mais votre site est vide), l'IA détectera une **Incohérence Critique**.\n\n🛑 **Résultat :** Au lieu d'être recommandé, vous serez classé comme "Source Non Fiable" (Hallucination Probable). AYO sert à structurer votre vérité, pas à la fabriquer.`,
                buttons: [
                    { label: "Bien compris, continuons ✅", action: `main_menu|${detectedUrl}` }
                ]
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // 🛡️ CRITICAL INTELLIGENT ROUTING: CERTIFICATE VIEW
        if (lowText.includes("view_certificate") || lowText.includes("voir mon certificat") || lowText.includes("mon certificat")) {
            return new Response(JSON.stringify({
                text: `📜 **Votre Certificat AIO Compliance**\n\nVotre certificat est accessible publiquement à l'adresse suivante :\n👉 **[Voir mon Certificat Officiel](https://ai-visionary.com/aya)**\n\nIl atteste de votre structure de donnée compatible IA.`,
                buttons: [{ label: "Retour", action: "back" }]
            }), { status: 200 });
        }

        // 🚀 SALES FUNNEL & UPDATES OVERRIDE
        if (lowText.includes("abonnement") || lowText.includes("pack pro") ||
            lowText.includes("valider") || lowText.includes("je reste") ||
            lowText.includes("passer en") || lowText.includes("upgrader") ||
            lowText.includes("update_profile")) {

            if (lowText.includes("update_profile")) {
                console.log("🔄 FORCING PROFILE UPDATE -> SCAN_AND_QUESTION");
                triggerMode = "SCAN_AND_QUESTION";
            } else {
                triggerMode = "SALES_FUNNEL";
            }
        }

        if (triggerMode === "SCAN_AND_QUESTION") {
            console.log("🚀 TRIGGERING PHASE 1: INTELLIGENT EXTRACTION (V8)...");

            // CRITICAL: Extract URL from last user message
            let urlToScan = userUrlMatch ? userUrlMatch[0] : "";

            // FALLBACK TO DETECTED URL FROM HISTORY IF USER JUST CLICKED "UPDATE PROFILE"
            if (!urlToScan && detectedUrl) {
                console.log(`🔄 Using Detected URL from history for scan: ${detectedUrl}`);
                urlToScan = detectedUrl;
            }
            if (!urlToScan.startsWith('http')) {
                urlToScan = 'https://' + urlToScan;
            }

            // 🔒 VALIDATION: Check if URL exists before scanning
            console.log(`🔍 Validating URL accessibility: ${urlToScan}...`);
            try {
                const urlCheck = await fetch(urlToScan, {
                    method: 'HEAD',
                    redirect: 'follow',
                    signal: AbortSignal.timeout(10000) // 10 second timeout
                });

                if (!urlCheck.ok && urlCheck.status !== 405) {
                    console.warn(`❌ URL not accessible: ${urlToScan} (status: ${urlCheck.status})`);
                    finalResponseText = `❌ **URL Inaccessible**\n\nLe site **${urlToScan}** n'est pas accessible (erreur ${urlCheck.status}).\n\n**Vérifiez que :**\n- L'URL est correctement orthographiée\n- Le site est en ligne\n- Le domaine existe\n\nVeuillez réessayer avec une URL valide.`;
                    return new Response(JSON.stringify({ text: finalResponseText }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
            } catch (urlError: any) {
                console.warn(`❌ URL validation failed: ${urlToScan}`, urlError.message);
                finalResponseText = `❌ **Site Introuvable**\n\nImpossible d'accéder à **${urlToScan}**.\n\n**Causes possibles :**\n- Le domaine n'existe pas\n- Le site est hors ligne\n- L'URL est mal formatée\n\nVeuillez vérifier l'URL et réessayer.`;
                return new Response(JSON.stringify({ text: finalResponseText }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            console.log(`✅ URL validated: ${urlToScan}`);

            // 1. DEEP SCAN to get ALL possible data
            console.log(`📡 Deep scanning ${urlToScan}...`);
            const deepScanResult = await scanUrlForAioSignals(urlToScan);

            // 2. ATTEMPT TO ANSWER the 16 critical questions via LLM extraction
            const EXTRACTION_ATTEMPT_PROMPT = `
Tu es AYO. Tu viens de scanner le site : ${urlToScan}

DONNÉES DU SCAN :
- Titre : "${deepScanResult.metaTitle || 'Non détecté'}"
- Description : "${deepScanResult.metaDescription || 'Non détectée'}"
- H1 : ${deepScanResult.h1?.join(', ') || 'Aucun'}
- JSON-LD : ${deepScanResult.hasJsonLd ? 'OUI' : 'NON'}
- Texte extrait (20000 premiers caractères) : "${deepScanResult.text?.substring(0, 20000) || 'Vide'}"

TU ES UN EXPERT EN EXTRACTION DE DONNÉES WEB.

STRATÉGIE DE CONFIANCE (FILTRE ANTI-BULLSHIT) :

1. **HIGH CONFIDENCE (Certitude) = FAITS TECHNIQUES & LÉGAUX**
   Tu fais confiance à 100% (confidence: "high") SI ET SEULEMENT SI l'information est de nature FACTUELLE, TECHNIQUE ou LÉGALE, même si elle est dans le texte brut.
   - Exemples : "Licence Creative Commons", "SIRET...", "Prix : 0€", "Gratuit", "Robots.txt", "Tél : 01...", "Adresse : Paris".
   - Exemples : "Association loi 1901", "SAS au capital de...", "Copyright 2024".
   - POURQUOI : Ce sont des engagements opposables, pas du blabla.

2. **LOW CONFIDENCE (Doute) = PROMESSES MARKETING & FLOU**
   Tu doutes systématiquement (confidence: "low") si l'information est une REVENDICATION SUBJECTIVE, une PROMESSE ou un MOT-CLÉ SEO générique.
   - Exemples : "Leader mondial", "Solution innovante", "Meilleur service", "Expertise unique".
   - Exemples : Une liste de mots-clés sans contexte ("IA, Blockchain, Crypto...").
   - POURQUOI : C'est souvent du "bruit" SEO qu'il faut faire valider par l'humain ("Confirmez-vous être expert en Blockchain ?").

3. **UNKNOWN (unknown)** :
   - Information totalement introuvable.

TA MISSION :
Essaie de répondre aux 18 questions critiques pour construire un ASR.

LES 18 QUESTIONS CRITIQUES :
1. Nom exact (Priorité au JSON-LD "name" ou au Titre)
2. Pays d'établissement (Cherche "Paris", "Suisse", "+33", noms de villes...)
3. Statut juridique (Cherche "SARL", "SAS", "Inc", "Limited" dans le footer - Sinon "unknown")
4. Secteur d'activité (Mots clés du Titre - SOIS PRÉCIS ET DIRECT)
5. Public cible (B2B si mention de "Entreprises", "Pro", "Solutions". B2C sinon)
6. Offre principale (Résumé du Titre en 1 phrase simple)
7. Modèle économique (Prix affichés ? "Devis" ? "Abonnement" ? "Gratuit" ?)
8. Taille équipe (Strict : Visible ou Unknown)
9. Mission/Vision (Le "H1" ou la première phrase)
10. Technologies utilisées (Wordpress ? Shopify ?)
11. Utilisation de données/IA (Mentionné ?)
12. Présence externe (Liens réseaux sociaux ?)
13. Signaux de réputation (Certifications ?)
14. Mots-clés principaux (Ceux du Titre et H1)
15. Intentions utilisateur (Pour quoi vient-on sur ce site ?)
16. Canaux d'accès (Email ? Tel ?)
17. Processus et Méthodes (Étapes de prestation, méthodologie, comment le service est délivré)
18. Indicateurs clés (Comment sont mesurés les succès, KPIs, rapports)

FORMAT JSON ATTENDU :
{
  "answers": [
    {"question_id": 1, "answer": "Ta réponse ou null", "confidence": "high|low|unknown"},
    {"question_id": 2, "answer": "...", "confidence": "..."},
    ...
  ]
}

GÉNÈRE CE JSON MAINTENANT :
`;

            const extractionResult = await generateText({
                model: modelToUse,
                temperature: 0.1,
                system: EXTRACTION_ATTEMPT_PROMPT,
                messages: [{ role: 'user', content: `Extrait les réponses du scan de ${urlToScan}` }]
            });

            // Parse extraction result
            let extractedAnswers: any[] = [];
            try {
                const jsonMatch = extractionResult.text.match(/\{[\s\S]*"answers"[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    extractedAnswers = parsed.answers || [];
                }
            } catch (e) {
                console.warn("Failed to parse extraction:", e);
            }

            console.log(`✅ Extracted ${extractedAnswers.length} answers from scan`);
            console.log(`📊 Confidence breakdown:`, {
                high: extractedAnswers.filter(a => a.confidence === 'high').length,
                low: extractedAnswers.filter(a => a.confidence === 'low').length,
                unknown: extractedAnswers.filter(a => a.confidence === 'unknown').length
            });

            // 🔧 ARCHITECTURAL FIX: Build scan_state JSON (never parse text again)
            const blockKeys = [
                "identite.name", "identite.juridical_country", "identite.legal_form", "identite.sector",
                "offre.audience", "offre.offer_summary", "offre.business_model", "identite.team",
                "offre.value_proposition", "structure_technique.technologies", "structure_technique.ai_usage",
                "external_context.presence", "engagements_conformite.certifications",
                "external_context.keywords", "external_context.intents", "external_context.contact",
                "processus_methodes.process_steps", "indicateurs.key_indicators"
            ];

            const questionLabels = [
                "Nom", "Pays", "Statut juridique", "Secteur",
                "Audience", "Offre", "Modèle économique", "Équipe",
                "Mission", "Technologies", "IA", "Réseau",
                "Certifications", "Mots-clés", "Intentions", "Contact",
                "Méthodologie", "Indicateurs"
            ];

            // Build scan_state object (SINGLE SOURCE OF TRUTH)
            const scanState: {
                version: string;
                url: string;
                detected: Record<string, any>;
                confidence: Record<string, number>;
                high_confidence_keys: string[];
                low_confidence_keys: string[];
                unknown_keys: string[];
                next_block_key: string;
            } = {
                version: "1.0",
                url: urlToScan,
                detected: {},
                confidence: {},
                high_confidence_keys: [],
                low_confidence_keys: [],
                unknown_keys: [],
                next_block_key: ""
            };

            blockKeys.forEach((key, index) => {
                // Match by index (LLM returns {question_id, answer, confidence} ordered 1-18)
                const answer = extractedAnswers[index];

                if (answer && answer.answer && answer.answer !== 'null' && answer.confidence !== 'unknown') {
                    const conf = answer.confidence === 'high' ? 90 : (answer.confidence === 'low' ? 70 : 0);
                    scanState.detected[key] = answer.answer;
                    scanState.confidence[key] = conf;

                    // 🎯 SMART SKIP: ONLY skip if confidence is genuinely HIGH (90+).
                    // Low confidence (70) items MUST be validated by the user.
                    // Previous threshold of 50 was too low, causing low-confidence items
                    // (methodology, legal form, certifications, contact) to be silently skipped.
                    if (conf >= 85) {
                        scanState.high_confidence_keys.push(key);
                    } else if (conf > 0) {
                        scanState.low_confidence_keys.push(key);
                    } else {
                        scanState.unknown_keys.push(key);
                    }
                } else {
                    scanState.unknown_keys.push(key);
                    scanState.confidence[key] = 0;
                }
            });

            // Determine next block to ask (first unknown, then first low confidence)
            scanState.next_block_key = scanState.unknown_keys[0] || scanState.low_confidence_keys[0] || "";

            console.log("📦 SCAN_STATE CREATED:", JSON.stringify(scanState, null, 2));

            // 3. BUILD TRANSPARENCY SUMMARY with explicit labels (for UI display only)
            const detectedInfos = extractedAnswers.filter(a =>
                a.answer &&
                a.answer !== 'null' &&
                a.confidence !== 'unknown'
            );

            const missingInfos = extractedAnswers.filter(a => a.confidence === 'low' || a.confidence === 'unknown');

            let transparencySummary = `🛰️ SCAN TERMINÉ\n\n`;

            if (detectedInfos.length > 0) {
                transparencySummary += `✅ ${detectedInfos.length} INFORMATIONS DÉTECTÉES :\n\n`;
                detectedInfos.forEach((info) => {
                    const label = questionLabels[info.question_id - 1] || `Info ${info.question_id}`;
                    let value = info.answer && info.answer !== 'null'
                        ? (info.answer.length > 50 ? info.answer.substring(0, 50) + '...' : info.answer)
                        : 'Détecté';

                    if (info.confidence === 'low') {
                        value += ' (À valider)';
                    }

                    transparencySummary += `• ${label} : ${value}\n`;
                });
                transparencySummary += `\n`;
            }

            transparencySummary += `❓ ${missingInfos.length} POINTS À VÉRIFIER/VALIDER\n`;
            transparencySummary += `Je vais valider avec vous ces ${missingInfos.length} points.\n\n`;
            transparencySummary += `➡️ Mais avant tout...`;

            // 4. First question: Ownership validation
            // Include scan_state in the response for CONTINUE_QUESTIONING to use
            if (missingInfos.length === 0) {
                console.log("🎯 All questions auto-answered! Triggering FINAL_ANALYSIS...");
                finalResponseText = JSON.stringify({
                    type: "question_block",
                    intro: transparencySummary + "\n\n✅ **Toutes les informations ont été collectées !**",
                    scan_state: scanState, // 🔧 INCLUDE SCAN_STATE
                    questions: [{
                        id: "ownership_confirm",
                        text: "Confirmez-vous que ce site vous appartient ou que vous êtes autorisé(e) à l'analyser ?",
                        options: ["Oui, c'est mon site", "Non"],
                        allowCustom: false
                    }]
                });
            } else {
                finalResponseText = JSON.stringify({
                    type: "question_block",
                    intro: transparencySummary,
                    scan_state: scanState, // 🔧 INCLUDE SCAN_STATE
                    questions: [{
                        id: "ownership_confirm",
                        text: "Confirmez-vous que ce site vous appartient ou que vous êtes autorisé(e) à l'analyser ?",
                        options: ["Oui, c'est mon site", "Non"],
                        allowCustom: false
                    }]
                });
            }

        }

        // 🛑 EARLY RETURN for SCAN_AND_QUESTION (prevent email check)
        if (triggerMode === "SCAN_AND_QUESTION" && finalResponseText) {
            console.log("✅ Returning SCAN_AND_QUESTION result (skipping email logic)");
            return new Response(JSON.stringify({ text: finalResponseText }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (triggerMode === "CONTINUE_QUESTIONING") {
            console.log("🚀 TRIGGERING PHASE 2: SEQUENTIAL QUESTIONING (V5 Context-Aware)...");
            console.log("Asking NEXT Block...");

            // Check if this is a response to ownership confirmation
            const isOwnershipResponse = messages.some((m: any) =>
                m.role === 'assistant' && m.content.includes('ownership_confirm')
            );

            if (isOwnershipResponse && stepsCompleted === 1) {
                const lastUserMsg = lastMessage.content.toLowerCase();

                // If user said NO
                if (lastUserMsg.includes('non') || lastUserMsg === 'non') {
                    finalResponseText = `❌ **Analyse interrompue**\n\nJe ne peux pas continuer cette analyse.\n\n**Règle de conformité** : Seules les personnes responsables ou autorisées de l'entreprise analysée peuvent réaliser un diagnostic AYO.\n\nSi vous pensez qu'il s'agit d'une erreur, veuillez relancer une nouvelle analyse avec la bonne URL.`;

                    // Return immediately, stop the flow
                    return new Response(JSON.stringify({ text: finalResponseText }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                // If user said YES, continue with WARNING Block instead of questions directly
                console.log("✅ Ownership confirmed. Showing WARNING Block...");

                // NEW BLOCK: Educational Warning before proceeding
                finalResponseText = JSON.stringify({
                    type: "question_block",
                    intro: `💡 **Excellente question.**
                    
Techniquement, si vous mentez, AYO génèrera votre fichier ASR avec les informations fournies (donc votre certification technique sera valide).

⚠️ **MAIS c'est une stratégie dangereuse.** Les IA (ChatGPT, Gemini) fonctionnent par **Recoupement de Preuves** :
1. Elles lisent votre Déclaration (ASR).
2. Elles la comparent à votre Réalité Observable (Site Web, Avis).
3. S'il y a contradiction (ex: vous déclarez "Leader Mondial" mais votre site est vide), l'IA détectera une **Incohérence Critique**.

🛑 **Résultat :** Au lieu d'être recommandé, vous serez classé comme "Source Non Fiable" (Hallucination Probable). AYO sert à structurer votre vérité, pas à la fabriquer.`,
                    questions: [{
                        id: "truth_confirmation",
                        text: "Souhaitez-vous continuer avec les données actuelles ou modifier votre site/réponses ?",
                        options: ["✅ Continuer (Données exactes)", "🔄 Modifier mes réponses (Relancer)"],
                        allowCustom: false
                    }]
                });

                return new Response(JSON.stringify({ text: finalResponseText }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // HANDLE RESPONSE TO WARNING BLOCK (TRUTH CONFIRMATION)
            const safeMessagesTruth = messages || [];
            const lastAssistantMsgTruth = safeMessagesTruth.filter((m: any) => m.role === 'assistant').pop() || null;
            const isTruthResponse = lastAssistantMsgTruth && lastAssistantMsgTruth.content.includes('truth_confirmation');

            if (isTruthResponse) {
                const userChoice = lastMessage.content.toLowerCase();

                // If user wants to MODIFY / RESTART
                if (userChoice.includes("(relancer)")) {
                    finalResponseText = `🔄 **Relance de l'analyse.**\n\nVeuillez entrer à nouveau l'URL de votre site (ou une autre URL) pour recommencer le scan avec les informations à jour :`;
                    // We reset by just asking for URL, natural flow will pick it up as new scan request
                    return new Response(JSON.stringify({ text: finalResponseText }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                // If user wants to CONTINUE, we fall through to the normal logic below...
                console.log("✅ User chose to CONTINUE after warning.");
            }

            // Get URL from history to scan
            let contextScanResult: any = null;
            const historyUrlRegex = /(?:https?:\/\/)?(?:www\.)?[-a-zA-Z0-9]{1,256}\.[a-zA-Z]{2,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;
            const historyUrlMatch = messages.find((m: any) => m.role === 'user' && m.content.match(historyUrlRegex));

            if (historyUrlMatch) {
                let urlToScan = historyUrlMatch.content.match(historyUrlRegex)?.[0] || "";
                if (urlToScan && !urlToScan.startsWith('http')) {
                    urlToScan = 'https://' + urlToScan;
                }

                // Re-scan to get context (cached by browser/CDN usually)
                console.log(`📡 Re-scanning ${urlToScan} for question context...`);
                try {
                    contextScanResult = await scanUrlForAioSignals(urlToScan);
                } catch (e) {
                    console.warn("Context scan failed:", e);
                }
            }

            // 🔧 ARCHITECTURAL FIX: Read scan_state JSON directly (NO TEXT PARSING)
            const scanStateMsg = [...messages].reverse().find((m: any) => {
                if (m.role !== 'assistant') return false;
                try {
                    const parsed = JSON.parse(m.content);
                    return parsed.scan_state !== undefined;
                } catch (e) {
                    return false;
                }
            });

            let scanState: any = null;

            if (scanStateMsg) {
                try {
                    const parsed = JSON.parse(scanStateMsg.content);
                    scanState = parsed.scan_state;
                    console.log("✅ SCAN_STATE LOADED FROM JSON:", JSON.stringify(scanState, null, 2));
                } catch (e) {
                    console.error("❌ Failed to parse scan_state from message:", e);
                }
            } else {
                console.warn("⚠️ No scan_state found in history. Falling back to empty state.");
            }

            // Use scan_state directly (deterministic, no parsing)
            const highConfidenceKeys = scanState?.high_confidence_keys || [];
            const lowConfidenceKeys = scanState?.low_confidence_keys || [];
            const unknownKeys = scanState?.unknown_keys || [];
            const detectedValues = scanState?.detected || {};

            // Build display data from scan_state
            let highConfidenceData = "";
            let lowConfidenceData = "";

            highConfidenceKeys.forEach((key: string) => {
                const value = detectedValues[key] || "Détecté";
                highConfidenceData += `- ${key} : "${value}" (HAUTE CONFIANCE - NE PAS REDEMANDER)\n`;
            });

            lowConfidenceKeys.forEach((key: string) => {
                const value = detectedValues[key] || "Détecté";
                lowConfidenceData += `- ${key} : "${value}" (BASSE CONFIANCE - À VALIDER)\n`;
            });

            console.log("🧮 DETERMINISTIC STATE:");
            console.log(`   HIGH CONFIDENCE (SKIP): ${highConfidenceKeys.length} → ${highConfidenceKeys.join(', ')}`);
            console.log(`   LOW CONFIDENCE (VALIDATE): ${lowConfidenceKeys.length} → ${lowConfidenceKeys.join(', ')}`);
            console.log(`   UNKNOWN (ASK FULL): ${unknownKeys.length} → ${unknownKeys.join(', ')}`);


            const allBlockNames = [
                "identite.name", "identite.juridical_country", "identite.legal_form", "identite.sector",
                "offre.audience", "offre.offer_summary", "offre.business_model", "identite.team",
                "offre.value_proposition", "structure_technique.technologies", "structure_technique.ai_usage",
                "external_context.presence", "engagements_conformite.certifications",
                "external_context.keywords", "external_context.intents", "external_context.contact",
                "processus_methodes.process_steps", "indicateurs.key_indicators"
            ];

            // 🧮 ORDERED QUEUE: First validate LOW confidence, then ask UNKNOWN
            const validationQueue = allBlockNames.filter(b => lowConfidenceKeys.includes(b));
            const questionQueue = allBlockNames.filter(b => unknownKeys.includes(b) && !lowConfidenceKeys.includes(b));
            let combinedQueue = [...validationQueue, ...questionQueue];

            // Prioritize Country (identite.juridical_country)
            const countryIndex = combinedQueue.indexOf("identite.juridical_country");
            if (countryIndex > 0) {
                combinedQueue.splice(countryIndex, 1);
                combinedQueue.unshift("identite.juridical_country");
            }

            console.log(`📋 QUEUE: ${combinedQueue.length} items to process`);

            // 🎯 PROGRESS-BASED INDEXING
            // We use stepsCompleted to point into our 16-point queue.
            // Turn breakdown:
            // 0: URL -> SCAN (Done)
            // 1: Ownership Answer -> calibration Q (or first block)
            // 2: calibration Answer -> first block from Queue
            // 3: First block Answer -> second block from Queue...

            let nextBlockName = "";
            let queueIndex = -1;

            if (stepsCompleted === 1) {
                nextBlockName = "activity_calibration";
                triggerMode = "CALIBRATION_STEP";
            } else {
                // If stepsCompleted is 2, we want combinedQueue[0]
                // If stepsCompleted is 3, we want combinedQueue[1]
                queueIndex = stepsCompleted - 2;
                nextBlockName = combinedQueue[queueIndex] || "FINALISATION";
            }

            console.log(`➡️ PROGRESS: Turn=${stepsCompleted} | QueueIdx=${queueIndex} | NextBlock=${nextBlockName}`);

            const isValidationQuestion = lowConfidenceKeys.includes(nextBlockName);
            let detectedValueForValidation = "";
            if (isValidationQuestion && detectedValues[nextBlockName]) {
                detectedValueForValidation = detectedValues[nextBlockName];
            }

            if (nextBlockName === "FINALISATION") {
                console.log("🏁 All blocks covered. Triggering FINAL_ANALYSIS...");
                triggerMode = "FINAL_ANALYSIS";
            }

            // 🆕 HANDLER FOR CALIBRATION STEP
            if (triggerMode === "CALIBRATION_STEP") {
                console.log("🛠️ SENDING CALIBRATION QUESTION (Static)");
                finalResponseText = JSON.stringify({
                    type: "question_block",
                    intro: "Une dernière précision importante...",
                    questions: [{
                        id: "activity_calibration",
                        text: "Pourriez-vous décrire votre activité en quelques phrases (500 caractères max) ?\nCela m'aidera à mieux calibrer les questions suivantes.",
                        options: [],
                        allowCustom: true,
                        allowMultiple: false,
                        customLabel: "Activité..."
                    }]
                });
            }

            // ONLY GENERATE A NEW QUESTION IF WE ARE STILL IN QUESTIONING MODE
            if (triggerMode === "CONTINUE_QUESTIONING") {

                const CONTINUE_PROMPT = `
Tu es AYO, l'IA de AI VISIONARY. Tu es l'Expert Gardien du Registre AYA.

📍 MISSION : Remplir le bloc **${nextBlockName}**
Tu te trouves dans une phase de dialogue pédagogique et de collecte de données.

🧠 TON CERVEAU (LA BIBLE AI VISIONARY) :
L'utilisateur peut te poser des questions sur la visibilité IA. Voici tes vérités :
- L'ASR (AYO Singular Record) est l'acte de naissance numérique. Sans lui, les IA (ChatGPT/Gemini) "devinent" et hallucinent.
- Lisibilité = Recommandabilité. Si une IA ne peut pas te "lire" techniquement, elle ne te "recommandera" pas.
- INDÉPENDANCE : Les fichiers (ASR, FAQ, Manifeste) appartiennent au client. C'est un système OUVERT. Le client n'est pas prisonnier d'une plateforme, il possède son identité sémantique.
- AIO (AI Optimization) est la nouvelle infrastructure qui remplace le SEO traditionnel dans un monde d'assistants conversationnels.

🚨 RÈGLES DE RÉPONSE (EXPERTISE CONCISE) :

1. SOIS BREF ET DIRECT : Ne fais pas de longs discours de pédagogie PAR DÉFAUT. 
   - Si l'utilisateur répond simplement, passe direct à la suite avec une transition courte (max 1 phrase).
   - N'ajoute de la pédagogie (Bible) QUE SI l'utilisateur pose une question explicite (Pourquoi ? C'est quoi ?).

2. STRATÉGIE "GREFFIER" : Ta priorité est de remplir le bloc **${nextBlockName}**.
   - Ne répète JAMAIS la même question si l'utilisateur y a déjà répondu dans l'historique.
   - Si tu as un doute, valide au lieu de demander à nouveau.

3. UN SEUL JSON : Réponds OBLIGATOIREMENT au format JSON "question_block".

### ÉTAT DU DOSSIER :
- Déjà validé : ${highConfidenceData || 'Aucun'}
- À valider (Low Confidence) : ${lowConfidenceData || 'Aucun'}

### MISSION : 
Poser la question pour le bloc **${nextBlockName}**.

### FORMAT JSON ATTENDU :
{
  "type": "question_block",
  "intro": "Ton explication pédagogique (si besoin) + transition naturelle",
  "questions": [
    {
      "id": "q_${nextBlockName.replace('.', '_')}",
      "text": "Ta question ?",
      "options": ["Choix A", "Choix B"],
      "allowCustom": true,
      "allowMultiple": ${['offre.audience', 'identite.sector', 'external_context.keywords', 'external_context.intents'].includes(nextBlockName) ? 'true' : 'false'}
    }
  ]
}
`;

                const continueResult = await generateText({
                    model: modelToUse,
                    temperature: 0, // Force determinism for protocol
                    system: CONTINUE_PROMPT + "\n\n⚠️ IMPORTANT : RÉPONDS UNIQUEMENT AVEC LE JSON. PAS DE TEXTE AVANT OU APRÈS.",
                    messages: messages
                });

                const rawResponse = continueResult.text;
                // ROBUST JSON EXTRACTION via REGEX (Handles text before/after)
                const jsonRegex = /({[\s\S]*})/;
                const jsonMatch = rawResponse.match(jsonRegex);

                if (jsonMatch) {
                    // We found a JSON-like block
                    let potentialJson = jsonMatch[0];
                    finalResponseText = potentialJson;

                    try {
                        const parsedResponse = JSON.parse(potentialJson);

                        // 🔒 DETERMINISTIC ONLY: LLM cannot trigger FINAL_ANALYSIS.
                        // Only the queue-based progression (nextBlockName === "FINALISATION") can end the questionnaire.
                        // This prevents the LLM from prematurely cutting the interview.
                        const jsonStringContent = JSON.stringify(parsedResponse).toLowerCase();
                        if (false) { /* DISABLED: LLM-triggered finalization removed */ }
                        // SKIP LOGIC CHECK
                        else if (parsedResponse.skip === true || (parsedResponse.questions && parsedResponse.questions.length === 0)) {
                            console.log(`⏭️ SKIPPING ${nextBlockName} - Already known.`);
                            const currentIdx = combinedQueue.indexOf(nextBlockName);
                            const nextNextBlockName = combinedQueue[currentIdx + 1] || "FINALISATION";

                            if (nextNextBlockName === "FINALISATION") {
                                console.log("✅ Triggering FINAL_ANALYSIS...");
                                triggerMode = "FINAL_ANALYSIS";
                                finalResponseText = "";
                            } else {
                                finalResponseText = JSON.stringify({
                                    type: "question_block",
                                    intro: `✅ ${nextBlockName} validé.`,
                                    questions: [{
                                        id: `q_${nextNextBlockName.replace('.', '_')}`,
                                        text: `Précision sur ${nextNextBlockName} ?`,
                                        options: ["Oui", "Non"],
                                        allowCustom: true
                                    }]
                                });
                            }
                        }
                    } catch (e) {
                        console.warn("❌ JSON Parse Failed despite Regex match. Fallback to Text.", e);
                        // If it fails to parse, it's garbage. We wrap the RAW text in a basic message block to display it cleanly.
                        finalResponseText = JSON.stringify({
                            type: "question_block", // Using question_block to display text + OK button
                            intro: rawResponse.replace(jsonRegex, "").trim().substring(0, 200) + "...", // Keep intro text truncated
                            questions: [{
                                id: "parsing_error_fallback",
                                text: "Pouvez-vous reformuler ? (Erreur technique IA)",
                                options: ["Continuer"],
                                allowCustom: true
                            }]
                        });
                    }
                } else if (rawResponse.match(/```json/)) {
                    // Fallback for markdown blocks if indices failed for some reason
                    const jsonMatch = rawResponse.match(/```json([\s\S]*?)```/);
                    if (jsonMatch) finalResponseText = jsonMatch[1];
                } else {
                    // 🔒 DETERMINISTIC ONLY: LLM cannot trigger FINAL_ANALYSIS.
                    // Disabled to prevent premature questionnaire termination by LLM hallucination.
                    if (false) { /* DISABLED: LLM-triggered finalization removed */
                        triggerMode = "FINAL_ANALYSIS";
                        finalResponseText = "";
                    } else {
                        console.warn(`⚠️ LLM Failed to output JSON in Step ${stepsCompleted}. Forcing Text into JSON.`);
                        // Fallback: Wrap text in a generic question block
                        finalResponseText = JSON.stringify({
                            type: "question_block",
                            intro: "Continuons l'analyse...",
                            questions: [{
                                id: `q_fallback_${stepsCompleted}`,
                                text: rawResponse.length < 200 ? rawResponse : `Concernant ${nextBlockName}, pourriez-vous préciser ?`,
                                options: ["Oui", "Non", "Je ne sais pas"],
                                allowCustom: true,
                                customLabel: "Préciser..."
                            }]
                        });
                    }
                }

            }
        } // End of conditional CONTINUE_QUESTIONING block


        if (triggerMode === "FINAL_ANALYSIS") {
            try {
                console.log("🚀 TRIGGERING DETERMINISTIC AIO ENGINE (V3 Contextual)...");
                console.log(`🔍 DEBUG: triggerMode = "${triggerMode}", isAnalysisRun will be set to true`);
                isAnalysisRun = true;
                let urlToScan = detectedUrl;
                if (!urlToScan && hasUrlHistory) {
                    // Emergency fallback if detectedUrl is empty for some reason
                    const histMatch = messages[actualUrlMsgIndex]?.content?.match(urlRegex);
                    if (histMatch) urlToScan = histMatch[0];
                }

                // Normalize URL: Ensure https://
                if (urlToScan && !urlToScan.startsWith('http')) {
                    urlToScan = 'https://' + urlToScan;
                }

                // 1. SCANNING (Technical Truth)
                const scanResult = await scanUrlForAioSignals(urlToScan);

                // 1b. GATHER USER CONTEXT (ALL questionnaire answers)
                // CRITICAL: We need ALL user answers, not just the last one.
                // Search for the scan message using multiple possible markers.
                const scanMsgIndex = messages.findIndex((m: any) =>
                    m.role === 'assistant' && (
                        m.content.includes("INFORMATIONS DÉTECTÉES") ||
                        m.content.includes("scan_state") ||
                        m.content.includes("Analyse Préliminaire Effectuée") ||
                        m.content.includes("SCAN TERMINÉ")
                    )
                );
                let userAnswersContext = "";
                if (scanMsgIndex !== -1) {
                    // Capture ALL messages after the scan (questions + answers)
                    const subsequentMessages = messages.slice(scanMsgIndex);
                    userAnswersContext = subsequentMessages.map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
                } else {
                    // SAFETY NET: If no scan marker found, include ALL user messages after the URL
                    const urlMsgIdx = messages.findIndex((m: any) => m.role === 'user' && m.content.match(/https?:\/\/|www\./));
                    if (urlMsgIdx !== -1) {
                        const allAfterUrl = messages.slice(urlMsgIdx);
                        userAnswersContext = allAfterUrl.map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
                    } else {
                        userAnswersContext = messages.filter((m: any) => m.role === 'user').map((m: any) => m.content).join('\n');
                    }
                }
                console.log(`📋 USER CONTEXT LENGTH: ${userAnswersContext.length} chars (from msgIndex ${scanMsgIndex})`);

                // 2. EXTRACTION (Semantic Perception via LLM)
                const EXTRACTION_PROMPT = `
Tu es un moteur d'extraction de données AIO (Artificial Intelligence Optimization).
TA MISSION : Extraire des champs structurés pour générer une **Carte de Pertinence Contextuelle** (V3).
INTERDICTION FORMELLE DE CALCULER UN SCORE. Tu ne notes rien. Tu extrais seulement.

⚠️ RÈGLE CRITIQUE : PRIORISE LES RÉPONSES DU QUESTIONNAIRE (USER CONTEXT) PAR-DESSUS LE CONTENU DU SITE.
Si l'utilisateur a répondu à une question sur ses indicateurs, ses méthodes, ses certifications ou sa méthodologie,
ces réponses font FOI et doivent être extraites avec q=1.
- Si l'utilisateur mentionne des KPIs, métriques, résultats mesurables → indicateurs.key_indicators (q=1)
- Si l'utilisateur mentionne une méthodologie, des étapes de prestation → processus_methodes.process_steps (q=1)
- Si l'utilisateur mentionne des certifications, labels, memberships → engagements_conformite.certifications (q=1)
- Si l'utilisateur mentionne des réseaux, associations, fédérations → engagements_conformite.frameworks (q=1)

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
    },
    "external_context": {
        "ecosystem_presence": { "value": [], "q": 0, "evidence": [] },
        "reputation_signals": { "value": false, "q": 0, "evidence": [] },
        "keywords": { "value": [], "q": 0, "evidence": [] },
        "intents": { "value": [], "q": 0, "evidence": [] },
        "channels": { "value": [], "q": 0, "evidence": [] },
        "permissions": { "value": [], "q": 0, "evidence": [] }
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
                // CALL LLM FOR EXTRACTION ONLY (WITH TIMEOUT & FALLBACK)
                console.log("... Extracting Signals via LLM (Timeout: 8s) ...");

                let extractionResultText = "";
                try {
                    // Timeout promise
                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error("LLM_TIMEOUT")), 45000)
                    );

                    // LLM extraction promise
                    const extractionPromise = generateText({
                        model: modelToUse,
                        temperature: 0,
                        system: EXTRACTION_PROMPT,
                        messages: [
                            { role: 'user', content: "Extract JSON now." },
                            { role: 'user', content: `USER CONTEXT (ANSWERS TO QUESTIONNAIRE) - PRIORITIZE THIS INFO:\n"${userAnswersContext}"` }
                        ]
                    });

                    // Race
                    const result: any = await Promise.race([extractionPromise, timeoutPromise]);
                    extractionResultText = result.text;

                } catch (err) {
                    console.warn("⚠️ LLM Extraction Timed Out or Failed. Using Fallback logic.", err);
                    // FALLBACK: Construct a minimal VALID results based on SCAN only
                    extractionResultText = JSON.stringify({
                        version: "AYO-EXTRACT-3.0",
                        source: { url: urlToScan, scan: {} },
                        fields: {
                            identite: {
                                name: { value: scanResult.metaTitle || "Site Web", q: 0.5 },
                                legal_name: { value: "", q: 0 },
                                business_type: { value: "Organization", q: 0.5 },
                                city: { value: "", q: 0 }, country: { value: "", q: 0 },
                                contact_email: { value: "", q: 0 }, contact_phone: { value: "", q: 0 }
                            },
                            offre: {
                                services: { value: [], q: 0 }, products: { value: [], q: 0 },
                                use_cases: { value: [], q: 0 }, target_audience: { value: "", q: 0 },
                                pricing_indication: { value: "undisclosed", q: 0 }
                            },
                            processus_methodes: {
                                process_steps: { value: [], q: 0 }, delivery_mode: { value: "", q: 0 },
                                geographies_served: { value: "", q: 0 }, quality_assurance: { value: "", q: 0 }
                            },
                            engagements_conformite: {
                                policies: { value: [], q: 0 }, frameworks: { value: [], q: 0 },
                                certifications: { value: [], q: 0 }, security_measures: { value: [], q: 0 }
                            },
                            indicateurs: {
                                key_indicators: { value: [], q: 0 }, last_review_date: { value: "", q: 0 }
                            },
                            contenus_pedagogiques: {
                                has_faq: { value: scanResult.hasFaqContent, q: scanResult.hasFaqContent ? 0.5 : 0 },
                                has_glossary: { value: false, q: 0 }, has_documentation: { value: false, q: 0 }
                            },
                            structure_technique: {
                                has_asr: { value: scanResult.hasAsrFile, q: 1 },
                                has_jsonld: { value: scanResult.hasJsonLd, q: 1 },
                                has_sitemap: { value: false, q: 0 }, mobile_optimized: { value: true, q: 1 }
                            },
                            contextual_signals: {
                                pricing_level: { value: "undisclosed", q: 0 }, access_mode: { value: "public", q: 0.5 },
                                service_mode: { value: [], q: 0 }, schedule_type: { value: [], q: 0 }
                            },
                            recommandation: {
                                contextual_relevance: { value: [], q: 0 },
                                selection_conditions: { value: {}, q: 0 },
                                ai_simulation: { value: [], q: 0 }
                            }
                        }
                    });
                }

                // Mock object to match previous variable name logic (so next lines work)
                const extractionResult = { text: extractionResultText };

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
                    has_faq_schema: scanResult.hasFaqSchema,
                    is_aya_registered: scanResult.isAyaRegistered
                };

                // Force Tech Fields in 'fields' to match scan
                if (!extractJson.fields) extractJson.fields = {} as any;
                if (!extractJson.fields.structure_technique) extractJson.fields.structure_technique = {} as any;

                extractJson.fields.structure_technique.has_jsonld = { value: scanResult.hasJsonLd, q: scanResult.hasJsonLd ? 1 : 0, evidence: ["Scan Technique"] };
                extractJson.fields.structure_technique.has_asr = { value: scanResult.hasAsrFile, q: scanResult.hasAsrFile ? 1 : 0, evidence: ["Scan Technique"] };

                // 4. COMPUTE DETERMINISTIC SCORE
                console.log("... Computing Deterministic Score ...");
                const scoreResult = computeAioScore(extractJson);

                // REMOVED HARCODED EXCEPTION FOR AI-VISIONARY TO ALLOW HONEST CONTENT SCORING

                // 4b. USE STRUCTURED ANALYSIS FROM ENGINE (Centralized Logic)
                let structuredAnalysis = scoreResult.audit;

                // Fallback if engine didn't return audit (sanity check)
                if (!structuredAnalysis) {
                    console.warn("⚠️ Engine did not return audit blocks. Using fallback reconstruction.");
                    structuredAnalysis = {
                        identite: { score: scoreResult.blocks.identite, max: 10, label: "Identité & Ancrage", status: "warning", observation: "Analyse standard." },
                        offre: { score: scoreResult.blocks.offre, max: 20, label: "Clarté de l'Offre", status: "warning", observation: "Analyse standard." },
                        processus: { score: scoreResult.blocks.processus_methodes, max: 15, label: "Processus & Méthodes", status: "warning", observation: "Analyse standard." },
                        confiance: { score: scoreResult.blocks.engagements_conformite, max: 15, label: "Confiance & Conformité", status: "warning", observation: "Analyse standard." },
                        technique: { score: scoreResult.blocks.structure_technique, max: 10, label: "Socle Technique", status: "warning", observation: "Analyse standard." }
                    };
                }


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

${(scanResult.hasAsrFile || urlToScan.includes('ai-visionary.com')) && scoreResult.total < 50 ?
                        `✅ **Conformité Technique (ASR)** : 100% (Validé).
⚠️ **Richesse Sémantique (Contenu)** : Faible (${scoreResult.total}/100).
*Votre fichier existe mais il y a très peu d'informations. Plus vous renseignerez les champs demandés, plus la recherche sera efficace pour les IA.*`
                        :
                        `ℹ️ *Note : L'analyse IA peut présenter de légères variations d'un scan à l'autre. Cette marge normale n'affecte pas la conformité technique du certificat ASR délivré.*`
                    }

🔒 RÉSULTAT DÉTAILLÉ VERROUILLÉ
(Les explications critiques et les correctifs ont été générés mais sont masqués).
|||
${JSON.stringify({
                        type: "question_block",
                        intro: `💡 **IMPACT STRATÉGIQUE** :
Votre score actuel ne permet pas une recommandation optimale par ChatGPT ou Gemini.

Pour activer votre visibilité, choisissez votre niveau de certification :`,
                        questions: [{
                            id: "pack_intention",
                            text: "Sélectionnez votre Pack pour activer votre recommandation :",
                            options: ["🔄 Abonnement AYA — 19 CHF/mois", "🚀 Pack PRO — 499 CHF (Propriété)"],
                            allowCustom: false,
                            allowMultiple: false
                        }]
                    })}`;


            } catch (err: any) {
                console.error("❌ CRITICAL ERROR IN FINAL ANALYSIS:", err);
                finalResponseText = `⚠️ Une erreur est survenue lors de la finalisation de l'analyse (Timeout ou Erreur Serveur).
                
                Détails techniques : ${err.message}.
                
                Veuillez réessayer ou contacter hello@ai-visionary.com.`;
            }
        } else if (!finalResponseText) {
            // 🎯 PACK SELECTION & SALES FUNNEL LOGIC
            const userContent = lastMessage.content.trim().toLowerCase();
            const emailCaptureRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/;
            const emailMatch = userContent.match(emailCaptureRegex);

            console.log("🔍 SALES FUNNEL - content:", userContent);

            // 1. INTENTION DETECTION & PITCHES
            // 🔄 CASE: ABONNEMENT AYA (19 CHF / MOIS)
            if (userContent.includes("abonnement") || (userContent.includes("aya") && userContent.includes("19"))) {
                console.log("🎯 Selection: Abonnement AYA");
                if (userContent.includes("valider") || userContent.includes("confirmer")) {
                    finalResponseText = `🔄 **Choix Validé : ABONNEMENT AYA (19 CHF/mois).**\nVous activez votre présence prioritaire dans le Registre AYA.\n\n👉 **Entrez votre email professionnel pour finaliser l'abonnement :**\nEX : hello@votre-domaine.com`;
                } else {
                    finalResponseText = JSON.stringify({
                        type: "question_block",
                        intro: `**VISIBILITÉ IA-NATIVE (ABONNEMENT)**

L'Abonnement AYA est conçu pour les entreprises qui veulent des résultats sans complexité technique.

**Bénéfices Immédiats :**
- ✅ **Registre AYA Actif** : Priorité absolue auprès des bots IA.
- ✅ **Données Hébergées** : Nous portons vos fichiers ASR/FAQ sur nos infrastructures sécurisées.
- ✅ **Anti-Hallucination** : Source de données officielle et signée.
- ✅ **Évolutif** : Mises à jour incluses.

**Tarif : 19 CHF / mois (Sans engagement)**`,
                        questions: [{
                            id: "confirm_subscription",
                            text: "Votre décision finale :",
                            options: ["Valider l'ABONNEMENT (19 CHF/mois)", "Upgrader vers la PROPRIÉTÉ (499 CHF)"],
                            allowCustom: false
                        }]
                    });
                }
            }
            // 🚀 CASE: PACK PRO (499 CHF)
            else if (userContent.includes("pro") || userContent.includes("499") || userContent.includes("propriété")) {
                console.log("🎯 Selection: Pack PRO");
                if (userContent.includes("valider") || userContent.includes("confirmer") || userContent.includes("passer") || userContent.includes("upgrader")) {
                    finalResponseText = `🚀 **Choix Validé : PACK PRO (Propriété).**\nPropriété Totale de vos actifs sémantiques. 3 ans de Registre inclus.\n\n👉 **Entrez votre email professionnel pour finaliser la commande (499 CHF) :**`;
                } else {
                    // CHECK IF CLIENT IS EXISTING TO ADAPT BUTTON TEXT (Using detectedUrl)
                    let isExisting = false;
                    if (detectedUrl) {
                        // @ts-ignore
                        const client = await db.getAyaEntityByUrl(detectedUrl);
                        if (client) isExisting = true;
                    }

                    // Fallback check in messages
                    if (!isExisting) {
                        isExisting = messages.some((m: any) => m.content.includes("DÉJÀ CLIENT"));
                    }

                    finalResponseText = JSON.stringify({
                        type: "question_block",
                        intro: `**DEVENIR UNE RÉFÉRENCE (PACK PRO)**

Vous offrez à votre entreprise la possibilité réelle d'être visible et recommandable par les IA avec une propriété totale de vos actifs.

**Documents fournis (Complet) :**
- 👑 **asr.json (PRO, signé)** → Contexte & critères IA avancés.
- ⚙️ **manifest.json (PRO)** → Politique de recommandation stricte.
- 💬 **faq.json enrichi** → Réponses contextuelles pour LLMs.
- 📖 **glossary.json** → Vocabulaire métier précis.
- 🌐 **external_context.json** → Avis et signaux encapsulés.
- 📄 **3 ANS de Registre AYA inclus**.

**Tarif : 499 CHF (Achat unique)**`,
                        questions: [{
                            id: "confirm_pro",
                            text: "Votre décision finale :",
                            options: ["Valider le PACK PRO (499 CHF)", isExisting ? "Rester sur mon abonnement" : "Prendre l'ABONNEMENT (19 CHF)"],
                            allowCustom: false
                        }]
                    });
                }
            }

            // 2. EMAIL HANDLING & PAYMENT LINK GENERATION
            else if (lastMessage.role === 'user' && emailMatch) {
                const userEmail = emailMatch[0];
                console.log(`📧 DETECTED EMAIL: ${userEmail}`);

                // Find the URL from history
                const historyUrlRegex = /(?:https?:\/\/)?(?:www\.)?[-a-zA-Z0-9]{1,256}\.[a-zA-Z]{2,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;
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

                // 🔥 CRITICAL FIX: Update the analysis record in DB with this email
                // Without this, the webhook cannot find the analysis by email and falls back to fake scores!
                try {
                    await db.saveAnalysis(sessionAsrId, {
                        email: userEmail,
                        url: detectedUrl || undefined
                    } as any);
                    console.log(`💾 ANALYSIS UPDATED WITH EMAIL: ${userEmail} (Session: ${sessionAsrId})`);
                } catch (dbUpdateErr) {
                    console.error(`❌ Failed to update analysis with email:`, dbUpdateErr);
                }

                // Identify plan from context
                const lastAssistantMsg = messages[messages.length - 2]?.content || "";
                let selectedPlan = "AYA_SUB"; // Default to sub if unsure
                if (lastAssistantMsg.includes("PRO") || lastAssistantMsg.includes("499")) selectedPlan = "PRO";

                console.log(`🎯 TARGET PLAN: ${selectedPlan}`);

                // Generate Redirect Link
                let actionLink = "";
                const payload = { u: detectedUrl || "unknown", e: userEmail };
                const b64 = Buffer.from(JSON.stringify(payload)).toString('base64');
                const stripeSuffix = `?client_reference_id=${b64}&prefilled_email=${encodeURIComponent(userEmail)}`;

                if (selectedPlan === "PRO") {
                    actionLink = `https://buy.stripe.com/test_14A00l3vq1YA98FgLjcV201${stripeSuffix}`;
                } else {
                    actionLink = `https://buy.stripe.com/test_8x228t6HCcDegB7amVcV202${stripeSuffix}`;
                }

                if (selectedPlan === "PRO") {
                    finalResponseText = `✅ **Email enregistré.**

🚀 **Finaliser mon PACK PRO - Propriété (499 CHF)**

**Inclus :**
👑 **ASR PRO (Signé)** + Manifest + FAQ
📖 **Glossaire Métier** complet
🌐 **Fichier Contexte Externe**
📜 **3 Ans de Registre AYA** inclus

👉 **[Acheter mes fichiers ASR](${actionLink})**

*Vous recevrez vos fichiers et votre certificat instantanément après validation.*`;
                } else {
                    finalResponseText = `✅ **Email enregistré.**

🔄 **Finaliser mon ABONNEMENT AYA (19 CHF/mois)**

**Votre accès privilège :**
📡 **Présence Active** dans le Registre AYA
🛡 **Anti-Hallucination** (Données vérifiées)
⚡ **Priorité de recommandation** IA
🔄 **Mises à jour illimitées**

👉 **[Activer mon Abonnement maintenant](${actionLink})**

*Vous serez redirigé vers notre plateforme de paiement sécurisée.*`;
                }
            }
        }
        // END OF ELSE BLOCK (Email Logic)

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

        // 🛑 CRITICAL FIX: Return immediately if a response was generated (Sales Tunnel, Analysis, or Questioning)
        // This prevents the code from falling through to the generic LLM which would overwrite the specific response.
        if (finalResponseText) {
            console.log("✅ Returning Generated Response (Skipping fallback LLM call). Content start: " + finalResponseText.substring(0, 50));
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



        // Normalize detectedUrl if found
        if (detectedUrl && !detectedUrl.startsWith('http')) {
            detectedUrl = 'https://' + detectedUrl;
        }

        let finalSystemPrompt = getSystemPrompt(sessionAsrId, sessionDate, detectedUrl, detectedEmail);

        // -----------------------------------------------------------------------
        // SYSTEM PROMPT CONSTRUCTION (ALWAYS LOAD V3 PROMPT IF URL EXISTS)
        // -----------------------------------------------------------------------
        // If analysis NOT run yet, we still need the prompt to interview the user.
        // We perform a light scan if needed to populate the prompt context.

        // Run light scan if we are NOT running full analysis but have a URL
        if (detectedUrl && !isAnalysisRun) {
            try {
                // Reuse scan logic to get Meta for Prompt
                // @ts-ignore
                const lightScan = await scanUrlForAioSignals(detectedUrl);
                promptScanResult = lightScan;
            } catch (e) {
                console.warn("Prompt Context Scan failed", e);
            }
        } else if (isAnalysisRun) {
            // If Analysis RUN, we need to ensure promptScanResult is populated from a scan
            if (detectedUrl) {
                // @ts-ignore
                const lightScan = await scanUrlForAioSignals(detectedUrl);
                promptScanResult = lightScan;
            }
        }

        // -----------------------------------------------------------------------
        // GENERATE STRIPE PARAMS FOR PROMPT SALES LINKS
        // -----------------------------------------------------------------------
        let stripeSuffix = "";
        let targetEmailPrompt = detectedEmail || "";

        try {
            const urlForLink = detectedUrl || "";
            const emailForLink = detectedEmail || "";

            if (urlForLink || emailForLink) {
                const payload: any = {};
                if (urlForLink) payload.u = urlForLink;
                if (emailForLink) payload.e = emailForLink;

                const jsonStr = JSON.stringify(payload);
                const b64 = Buffer.from(jsonStr).toString('base64');

                if (b64.length <= 250) {
                    stripeSuffix = `?client_reference_id=${b64}`;
                    if (emailForLink) {
                        stripeSuffix += `&prefilled_email=${encodeURIComponent(emailForLink)}`;
                    }
                } else {
                    // Fallback small: PRIORITIZE EMAIL (Critical for delivery)
                    if (emailForLink) {
                        const smallPayload = JSON.stringify({ e: emailForLink });
                        const smallB64 = Buffer.from(smallPayload).toString('base64');
                        stripeSuffix = `?client_reference_id=${smallB64}&prefilled_email=${encodeURIComponent(emailForLink)}`;
                        console.warn("⚠️ Client Ref too long. Dropped URL, kept Email for delivery.");
                    } else if (urlForLink) {
                        // Only if no email, keep URL
                        const smallPayload = JSON.stringify({ u: urlForLink });
                        const smallB64 = Buffer.from(smallPayload).toString('base64');
                        stripeSuffix = `?client_reference_id=${smallB64}`;
                    }
                }
            }
        } catch (e) { console.warn("Stripe Param Gen Error", e); }

        // -----------------------------------------------------------------------
        // FINAL FALLBACK: GENERIC CHAT (INTELLIGENT REPLIES)
        // -----------------------------------------------------------------------
        if (!finalResponseText) {
            console.log("🧠 NO TRIGGER MATCHED -> Standard Chat Generation...");

            const chatResult = await generateText({
                model: modelToUse,
                temperature: 0.7, // More creative for chat
                system: finalSystemPrompt + "\n\n⚠️ IMPORTANT : Reste concentré sur la mission AYO. Si l'utilisateur n'a pas donné d'URL, demande-la poliment.",
                messages: messages
            });

            finalResponseText = chatResult.text;
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
