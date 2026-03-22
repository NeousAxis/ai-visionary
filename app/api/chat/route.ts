// Force static for reliability? No, dynamic for streaming.
export const dynamic = 'force-dynamic';

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { Resend } from 'resend';
import { scanUrlForAioSignals } from '@/lib/aio-scanner';
import { db } from '@/lib/db';
// registerOrUpdateEntity imported on-demand from '@/lib/aya/registry'
import { getSystemPrompt } from '@/lib/ayo-system-prompt';
import { createLogger, generateCorrelationId } from '@/lib/logger';
import { sanitizeForPrompt } from '@/lib/sanitize';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import crypto from 'crypto';
import Stripe from 'stripe';

// Multi-Agents imports
import {
    scanStateDocId,
    loadScanState,
    formatScanForGreffier,
} from '@/lib/agents/scanner';
import {
    encodeClientReference,
    STRIPE_LINKS,
} from '@/lib/agents/vendeur';
import {
    formatScoreMessage,
    AyoState,
    deriveState,
    type ConversationSignals,
} from '@/lib/agents/ayo-router';
import {
    analyseScore,
} from '@/lib/agents/analyste';
import {
    buildContinuePrompt,
    buildValidationQuestion,
    fieldRequiresEvidence,
    EVIDENCE_REQUIRED_FIELDS,
} from '@/lib/agents/greffier';
import {
    validateEmail,
    isStrictEmail,
    isConfirmationOnly as qcIsConfirmationOnly,
    sanitizeLlmFields,
    downgradeFieldQuality,
    EMAIL_CAPTURE_REGEX as QC_EMAIL_CAPTURE_REGEX,
} from '@/lib/agents/controle-qualite';
import {
    buildStructureRecommendations,
    formatRecommendationsForChat,
    getExtractionRulesForPrompt,
} from '@/lib/agents/architecte';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// Initialize Resend
const resendApiKey = process.env.RESEND_API_KEY;
if (!resendApiKey) {
    console.warn('RESEND_API_KEY is not set — email features will be disabled');
}
const resend = resendApiKey ? new Resend(resendApiKey) : null;

// Initialize Stripe lazily to avoid build-time crash when env var is missing
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
    if (!_stripe) {
        _stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_placeholder', {
            apiVersion: '2025-01-27.acacia' as any,
        });
    }
    return _stripe;
}



import { AyoExtract } from '@/lib/aio-score-engine';

export async function POST(req: Request) {
    // Rate limit: 15 requests/min per IP
    const rateLimited = checkRateLimit(req as any, 'chat', RATE_LIMITS.chat);
    if (rateLimited) return rateLimited;

    const correlationId = generateCorrelationId();
    const logger = createLogger(correlationId, 'chat');

    try {
        const { messages } = await req.json();
        const lastMessage = messages[messages.length - 1];
        logger.info('CHAT_START', `New chat request, ${messages.length} messages`);


        // 1. DYNAMIC PROVIDER SELECTION (GEMINI ONLY - FORCE AYO)
        let modelToUse;

        // Force Gemini
        let googleKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

        if (googleKey) {
            googleKey = googleKey.trim();
            // Gemini key loaded
            const google = createGoogleGenerativeAI({ apiKey: googleKey });

            try {
                // 1. AUTO-DETECT AVAILABLE MODELS (Robust Way)
                // Auto-detecting available Gemini model
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
                        // Model selected: logged via structured logger
                        modelToUse = google(modelId);
                    } else {
                        // Fallback to gemini-pro
                        modelToUse = google('gemini-pro');
                    }
                } else {
                    throw new Error("No models list returned.");
                }
            } catch (e) {
                logger.warn('GEMINI_DETECT_FAIL', e instanceof Error ? e.message : 'Unknown');
                // Ultimate Fallback: Try a known stable alias
                modelToUse = google('gemini-pro');
            }
        } else {
            throw new Error("CRITICAL: No GEMINI_API_KEY found. OpenAI is BANNED. System halted.");
        }

        // 🧠 REAL-TIME GENERATION
        // 🧠 SESSION & ANALYSIS ID (Stable logic — MUST be stable across all API calls for same session)
        // Recovery priority: 1) AYO_SID marker in any assistant message, 2) client_reference_id, 3) new UUID
        let sessionAsrId = "";
        for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            if (msg.role !== 'assistant') continue;
            // Priority 1: Look for embedded session marker (most reliable)
            const sidMatch = msg.content.match(/\[AYO_SID:([a-f0-9-]{36})\]/);
            if (sidMatch) {
                sessionAsrId = sidMatch[1];
                console.log("♻️ RECOVERED SESSION ID FROM AYO_SID MARKER:", sessionAsrId);
                break;
            }
            // Priority 2: Look for client_reference_id in Stripe links
            const idMatch = msg.content.match(/client_reference_id=([a-zA-Z0-9+/=]+)/);
            if (idMatch) {
                try {
                    const decoded = JSON.parse(Buffer.from(idMatch[1], 'base64').toString('utf-8'));
                    if (decoded.aid) {
                        sessionAsrId = decoded.aid;
                        console.log("♻️ RECOVERED SESSION ID FROM STRIPE LINK:", sessionAsrId);
                        break;
                    }
                } catch (_e) { }
            }
        }
        if (!sessionAsrId) {
            sessionAsrId = crypto.randomUUID();
            console.log("🆕 NEW SESSION ID GENERATED:", sessionAsrId);
        }

        const sessionDate = new Date().toISOString();

        // 🔍 DETECT IF WE ARE IN ANALYSIS PHASE (State 1 -> 2)
        // Check if the User provided an URL in the last message or if we are prompting for it
        // FIXED REGEX: Robust URL detection (V4.1 Permissive)
        const urlRegex = /[a-zA-Z0-9.-]+\.[a-zA-Z]{2,10}/gi;

        const rawUrlMatch = lastMessage.content.match(urlRegex);
        logger.info('URL_PARSE', `Parsed URL Match: ${rawUrlMatch}`);

        // CHECK IF IT IS AN EMAIL (Priority: If Email -> It's NOT a URL for analysis)
        // Délégué à l'agent Contrôle Qualité (isStrictEmail)
        const isTriggerEmail = isStrictEmail(lastMessage.content);

        let userUrlMatch = isTriggerEmail ? null : rawUrlMatch;

        let finalResponseText = "";
        let isAnalysisRun = false;

        // SMART TRIGGER LOGIC (V5 - ROBUST): 
        // Use findLastIndex to find the MOST RECENT URL provided by the user
        const urlMsgIndex = [...messages].reverse().findIndex((m: any) => m.role === 'user' && m.content.match(urlRegex));
        const hasUrlHistory = urlMsgIndex !== -1;
        const actualUrlMsgIndex = hasUrlHistory ? (messages.length - 1 - urlMsgIndex) : -1;

        logger.info('URL_TRIGGER', `hasUrlHistory=${hasUrlHistory}, actualUrlMsgIndex=${actualUrlMsgIndex}`);
        if (hasUrlHistory) {
            logger.info('URL_FOUND', `URL Message: "${messages[actualUrlMsgIndex].content}"`);
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

        logger.info('PROTOCOL_STATE', `Steps: ${stepsCompleted}/16, hasFinalScore=${hasFinalScore}, hasQuestionBlockSent=${hasQuestionBlockSent}`);

        // 🎯 TARGET URL IDENTIFICATION
        const urlInLastMessage = userUrlMatch ? userUrlMatch[0] : null;

        console.log(`🎯 TRIGGER ANALYSIS: urlInLastMessage=${urlInLastMessage}, stepsCompleted=${stepsCompleted}, hasFinalScore=${hasFinalScore}`);


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

        // Email Detection — délégué à l'agent Contrôle Qualité
        const detectedEmailResult = validateEmail(lastMessage.content);
        if (detectedEmailResult) {
            detectedEmail = detectedEmailResult;

            // 💾 SYNC EMAIL TO DB RECORD (Crucial for Webhook Recovery)
            if (sessionAsrId) {
                console.log(`📧 Syncing email to DB for session ${sessionAsrId}: ${detectedEmail}`);
                db.saveAnalysis(sessionAsrId, { email: detectedEmail }).catch(e => console.warn("Email Sync Failed", e));
            }
        }

        // 🛡️ RECOVER COMPOSITE ACTION (update_profile|https://...)
        // If the user clicked a button with a piped payload
        if (lastMessage.content.startsWith("update_profile|")) {
            const parts = lastMessage.content.split('|');
            if (parts.length > 1 && parts[1].startsWith('http')) {
                userUrlMatch = [parts[1]]; // Mock Regex Match to trick downstream logic
                detectedUrl = parts[1];
                console.log(`🔄 RECOVERED URL FROM ACTION: ${detectedUrl}`);
            }
        }

        if (lastMessage.content.startsWith("main_menu|")) {
            const parts = lastMessage.content.split('|');
            if (parts.length > 1 && parts[1].startsWith('http')) {
                userUrlMatch = [parts[1]];
                detectedUrl = parts[1];
                console.log(`🔄 RECOVERED URL FROM MAIN_MENU ACTION: ${detectedUrl}`);
            }
        }

        // 🔍 DETERMINISTIC TRIGGER CALCULATOR (via AYO State Machine)
        // CRITICAL: We check if a scan has ALREADY been performed in this conversation.
        // Check for "SCAN TERMINÉ" in assistant messages (scan_state is no longer embedded in client messages)
        const hasScanInHistory = messages.some((m: any) => m.role === 'assistant' && (
            m.content.includes('SCAN TERMIN') || m.content.includes('ownership_confirm')
        ));

        // Pre-compute signals for state machine
        const lastAssistantMsg_sm = assistantMessages[assistantMessages.length - 1];
        const lastAssistantHasOwnership = !!(lastAssistantMsg_sm && lastAssistantMsg_sm.content.includes('ownership_confirm'));
        const lastAssistantHasTruth = !!(lastAssistantMsg_sm && lastAssistantMsg_sm.content.includes('truth_confirmation'));
        const questionsAskedCountEarly = assistantMessages.filter((m: any) =>
            m.content.includes('"type": "question_block"') || m.content.includes('question_block')
        ).length;

        // Check if client is in AYA registry
        let isExistingClient_sm = false;
        if (urlInLastMessage && !hasFinalScore) {
            const existingClient = await db.getAyaEntityByUrl(urlInLastMessage);
            if (existingClient) isExistingClient_sm = true;
        }
        // main_menu returns also check for existing client
        if (lastMessage.content.startsWith("main_menu|") && !hasScanInHistory) {
            isExistingClient_sm = true;
        }

        const lowText_sm = lastMessage.content.toLowerCase();
        const isSalesIntent_sm = !!(lowText_sm.match(/(abonnement|pack pro|valider|upgrader|passer en)/));
        const isUpdateProfile_sm = lowText_sm.includes("update_profile");

        // Build conversation signals for state machine
        const conversationSignals: ConversationSignals = {
            hasUrlInLastMessage: !!urlInLastMessage,
            hasUrlInHistory: hasUrlHistory,
            hasScanInHistory,
            hasFinalScore,
            questionsAskedCount: questionsAskedCountEarly,
            stepsCompleted,
            isExistingClient: isExistingClient_sm,
            lastAssistantHasOwnership,
            lastAssistantHasTruth,
            isEmail: !!isTriggerEmail,
            isSalesIntent: isSalesIntent_sm,
            isUpdateProfile: isUpdateProfile_sm,
            totalQueueBlocks: 0, // Updated later in CONTINUE_QUESTIONING when queue is built
            queueIndex: Math.max(0, questionsAskedCountEarly - 3),
        };

        // 🎯 STATE MACHINE: Derive state from conversation signals
        let ayoState = deriveState(conversationSignals);

        // Special case: main_menu with scan in progress → continue questionnaire
        if (lastMessage.content.startsWith("main_menu|") && hasScanInHistory && !hasFinalScore) {
            ayoState = AyoState.QUESTIONNAIRE;
        }

        console.log(`🎯 AYO STATE: ${ayoState} | URL: ${detectedUrl} | Steps: ${stepsCompleted} | HasScan: ${hasScanInHistory}`);

        // 🛡️ HANDLER: EXISTING_CLIENT (Immediate Recognition)
        // Ensure we are NOT in an OTP flow (send_otp or 6 digits)
        const isOtpFlow = lastMessage.content.startsWith("send_otp") || lastMessage.content.match(/^\d{6}$/);

        if ((ayoState === AyoState.EXISTING_CLIENT || lastMessage.content === "EXISTING_CLIENT") && !isOtpFlow) {
            const ec_url = urlInLastMessage || detectedUrl || "";
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

            // 🛡️ SECURITY STEP: Don't give portal URL yet. Challenge with OTP first.
            // UNLESS already authenticated (Token in history? Hard in stateless).

            // 🛡️ SECURITY BLOCK: If manual click, force security check unless already authenticated (hard to detect stateless)
            // Retrieve Email to mask it properly
            // STRATEGY: Try Registry first, then Analysis (Fallback)
            let emailToUse = "";
            let clientSec: any = null;

            // 1. Registry Lookup
            clientSec = await db.getAyaEntityByUrl(detectedUrl);
            if (clientSec && clientSec.contact_email) {
                emailToUse = clientSec.contact_email;
            }

            // 2. Analysis Fallback (If registry empty or no email)
            if (!emailToUse) {
                console.log(`ℹ️ Email not in Registry, trying Analysis DB for ${detectedUrl}...`);
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
            const clientSec = await db.getAyaEntityByUrl(targetUrl);
            if (clientSec && clientSec.contact_email) {
                targetEmail = clientSec.contact_email;
            }

            // B. Analysis Fallback
            if (!targetEmail) {
                const analysis = await db.getLatestAnalysisByUrl(targetUrl);
                if (analysis && analysis.email) {
                    targetEmail = analysis.email;
                }
            }

            if (targetEmail) {
                const code = Math.floor(100000 + Math.random() * 900000).toString();
                await db.saveOTP(targetEmail, code);

                if (!resend) {
                    return new Response(JSON.stringify({ error: 'Email service not configured' }), { status: 500 });
                }
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

            const clientVerif = await db.getAyaEntityByUrl(detectedUrl);
            let emailToVerify = "";

            if (clientVerif && clientVerif.contact_email) {
                emailToVerify = clientVerif.contact_email;
            }
            if (!emailToVerify) {
                const analysis = await db.getLatestAnalysisByUrl(detectedUrl);
                if (analysis && analysis.email) emailToVerify = analysis.email;
            }

            if (emailToVerify) {
                const isValid = await db.verifyOTP(emailToVerify, code);

                if (isValid) {
                    // 🎉 SUCCESS: GENERATE PORTAL LINK NOW
                    let successUrl = "";
                    // Need Stripe ID logic again or ensure it's in clientVerif
                    let stripeId = clientVerif?.stripe_customer_id;

                    if (!stripeId && emailToVerify) {
                        // Fallback look up via Stripe API
                        const customers = await getStripe().customers.list({ email: emailToVerify, limit: 1 });
                        if (customers.data.length > 0) stripeId = customers.data[0].id;
                    }

                    if (process.env.STRIPE_SECRET_KEY && stripeId) {
                        const session = await getStripe().billingPortal.sessions.create({
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

        // 🚀 SALES FUNNEL & UPDATES OVERRIDE (via state machine)
        // CRITICAL: Only trigger AFTER scoring phase (not during questionnaire!)
        // Otherwise, user messages containing "abonnement" or "pack pro" during Q&A
        // would skip the entire questionnaire.
        const isPostScore = ayoState === AyoState.PACK_SELECT || ayoState === AyoState.CAPTURE_EMAIL || ayoState === AyoState.PAIEMENT_EN_COURS || ayoState === AyoState.LIVRE;
        const isScoreShown = messages.some((m: any) => typeof m.content === 'string' && m.content.includes('SCORE FINAL AIO'));
        if ((isPostScore || isScoreShown) && (
            lowText.includes("abonnement") || lowText.includes("pack pro") ||
            lowText.includes("valider") || lowText.includes("je reste") ||
            lowText.includes("passer en") || lowText.includes("upgrader"))) {
            ayoState = AyoState.PACK_SELECT;
        }
        if (lowText.includes("update_profile")) {
            console.log(`🔄 AYO STATE → ${AyoState.SCAN_EN_COURS}: FORCING PROFILE UPDATE`);
            ayoState = AyoState.SCAN_EN_COURS;
        }

        if (ayoState === AyoState.SCAN_EN_COURS) {
            console.log("🚀 TRIGGERING PHASE 1: INTELLIGENT EXTRACTION (V8)...");

            // CRITICAL: Extract URL from last user message
            let urlToScan = userUrlMatch ? userUrlMatch[0] : "";

            // FALLBACK TO DETECTED URL FROM HISTORY IF USER JUST CLICKED "UPDATE PROFILE"
            if (!urlToScan && detectedUrl) {
                console.log(`🔄 Using Detected URL from history for scan: ${detectedUrl}`);
                urlToScan = detectedUrl;
            }
            // Normalisation intelligente : essayer plusieurs variantes (https, http, www, sans www)
            if (!urlToScan.startsWith('http')) {
                urlToScan = 'https://' + urlToScan;
            }

            // 🔒 VALIDATION: Try URL variants until one works
            logger.info('URL_VALIDATE', `Validating URL accessibility: ${urlToScan}`);
            const urlObj = new URL(urlToScan);
            const domain = urlObj.hostname;
            const path = urlObj.pathname;
            const variants: string[] = [urlToScan];
            // Add protocol variant
            if (urlToScan.startsWith('https://')) {
                variants.push(urlToScan.replace('https://', 'http://'));
            } else {
                variants.push(urlToScan.replace('http://', 'https://'));
            }
            // Add www variants
            if (!domain.startsWith('www.')) {
                variants.push(`https://www.${domain}${path}`);
                variants.push(`http://www.${domain}${path}`);
            } else {
                variants.push(`https://${domain.replace('www.', '')}${path}`);
                variants.push(`http://${domain.replace('www.', '')}${path}`);
            }

            let urlValidated = false;
            for (const variant of variants) {
                try {
                    const urlCheck = await fetch(variant, {
                        method: 'HEAD',
                        redirect: 'follow',
                        signal: AbortSignal.timeout(5000)
                    });
                    if (urlCheck.ok || urlCheck.status === 405) {
                        urlToScan = variant;
                        urlValidated = true;
                        break;
                    }
                } catch {
                    // Try next variant
                }
            }

            if (!urlValidated) {
                finalResponseText = `❌ **Site Introuvable**\n\nImpossible d'accéder à **${urlToScan}**.\n\n**Causes possibles :**\n- Le domaine n'existe pas\n- Le site est hors ligne\n- L'URL est mal formatée\n\nVeuillez vérifier l'URL et réessayer.`;
                return new Response(JSON.stringify({ text: finalResponseText }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            logger.info('URL_VALIDATE', `URL validated: ${urlToScan}`);

            // 1. DEEP SCAN to get ALL possible data
            console.log(`📡 Deep scanning ${urlToScan}...`);
            const deepScanResult = await scanUrlForAioSignals(urlToScan);

            // 2. ATTEMPT TO ANSWER the 16 critical questions via LLM extraction
            const EXTRACTION_ATTEMPT_PROMPT = `
Tu es AYO. Tu viens de scanner le site : ${urlToScan}

DONNÉES DU SCAN :
- Titre : "${sanitizeForPrompt(deepScanResult.metaTitle || 'Non détecté', 200)}"
- Description : "${sanitizeForPrompt(deepScanResult.metaDescription || 'Non détectée', 500)}"
- H1 : ${sanitizeForPrompt(deepScanResult.h1?.join(', ') || 'Aucun', 300)}
- JSON-LD : ${deepScanResult.hasJsonLd ? 'OUI' : 'NON'}
- Texte extrait : "${sanitizeForPrompt(deepScanResult.text || 'Vide', 15000)}"

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

TERMINOLOGIE CRITIQUE :
ASR = "AI Singular Record" (JAMAIS "AYO Singular Record"). AYO est le nom de l'assistant IA, ASR est le nom du fichier. Ne confonds pas.

TA MISSION :
Essaie de répondre aux 27 questions critiques pour construire un ASR.

LES 25 QUESTIONS CRITIQUES :
1. Nom exact (Identité commerciale)
2. Pays d'établissement (Localisation principale)
3. Dénomination sociale (Nom légal, Kbis, IDE, SIREN)
4. Type d'activité (Secteur précis)
5. Ville du siège
6. Email de contact public
7. Téléphone de contact
8. Public cible (Audience B2B, B2C, Collectivités)
9. Liste des services
10. Liste des produits (physiques ou numériques)
11. Tarification (MONTANTS RÉELS avec devise, ex: "19 CHF/mois", "499 CHF one-shot", "à partir de 50€/h". TOUJOURS inclure les chiffres, la devise et la fréquence. Ne JAMAIS répondre uniquement par des catégories comme "Abonnement" ou "Prix fixe".)
12. Cas d'usage (Pourquoi on vous cherche ? Intentions utilisateur)
13. Méthodologie (Processus, étapes d'accompagnement)
14. Mode de livraison (En ligne, sur site, hybride, ateliers, formations)
15. Zone géographique servie
16. Signaux de confiance (Avis, Garanties, Qualité)
17. Certifications (Labels, Diplômes, Certifs)
18. Réseaux & fédérations (Faîtières, associations professionnelles)
19. Mesures de sécurité (Confidentialité, RGPD)
20. Politiques (Lien CGV ou mention légale)
21. Indicateurs de succès (KPIs: Nombre de clients, tonnes CO2, CA, Résultats mesurables)
22. Date de dernière mise à jour (Fraîcheur des données)
23. Supports pédagogiques (Livre blanc, FAQ, Plateforme, Documentation) — ATTENTION : ne confonds pas les EXEMPLES ou illustrations marketing (ex: "Quand un utilisateur demande 'Plombier urgence Lyon'...") avec de la vraie documentation. Un exemple cité pour illustrer un concept N'EST PAS de la documentation. Cherche des VRAIS guides, tutoriels, livres blancs, pages de type "Comment faire..."
24. Mots-clés de recherche (Comment vos clients vous trouvent)
25. Intentions de recherche typiques (Requêtes que vos clients tapent sur Google/IA)

RÈGLE CRITIQUE POUR LA TARIFICATION (question 11) :
- Cherche les MONTANTS en chiffres dans le texte extrait du site (ex: "19 CHF", "499€", "$99/month").
- Inclus TOUJOURS le montant + la devise + la fréquence (ex: "Abonnement AYA : 19 CHF/mois, Pack PRO : 499 CHF achat unique").
- Ne retourne JAMAIS uniquement des catégories ("Abonnement", "Prix fixe", "Sur devis") sans les montants associés.
- Cherche les prix dans TOUT le texte visible de la page (pas seulement les meta-données ou JSON-LD).
- Si des montants sont visibles sur la page, confidence = "high".

FORMAT JSON ATTENDU :
{
  "answers": [
    {"question_id": 1, "answer": "Ta réponse ou null", "confidence": "high|low|unknown"},
    {"question_id": 2, "answer": "...", "confidence": "..."},
    ...
    {"question_id": 25, "answer": "...", "confidence": "..."}
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
                // Identité (7)
                "identite.name", "identite.country", "identite.legal_name", "identite.business_type",
                "identite.city", "identite.contact_email", "identite.contact_phone",
                // Offre (5)
                "offre.target_audience", "offre.services", "offre.products", "offre.pricing_indication", "offre.use_cases",
                // Processus & Méthodes (4)
                "processus_methodes.process_steps", "processus_methodes.delivery_mode",
                "processus_methodes.geographies_served", "processus_methodes.quality_assurance",
                // Conformité (4)
                "engagements_conformite.certifications", "engagements_conformite.frameworks",
                "engagements_conformite.security_measures", "engagements_conformite.policies",
                // Indicateurs (2)
                "indicateurs.key_indicators", "indicateurs.last_review_date",
                // Pédagogie (3)
                "contenus_pedagogiques.has_faq", "contenus_pedagogiques.has_glossary", "contenus_pedagogiques.has_documentation",
                // Contexte externe (2)
                "external_context.keywords", "external_context.intents"
            ];

            const questionLabels = [
                // Identité (7)
                "Nom", "Pays", "Nom légal", "Secteur", "Ville", "Email", "Téléphone",
                // Offre (5)
                "Audience", "Services", "Produits", "Tarifs", "Cas d'usage",
                // Processus (4)
                "Méthodologie", "Mode de livraison", "Zone d'intervention", "Qualité",
                // Conformité (4)
                "Certifications", "Réseaux & fédérations", "Sécurité", "Politiques",
                // Indicateurs (2)
                "Indicateurs", "Date mise à jour",
                // Pédagogie (3)
                "FAQ", "Glossaire", "Documentation",
                // Contexte externe (2)
                "Mots-clés", "Intentions de recherche"
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
                // Match by question_id first (more robust), fallback to index
                const answer = extractedAnswers.find((a: any) => a.question_id === index + 1) || extractedAnswers[index];

                if (answer && answer.answer && answer.answer !== 'null' && answer.confidence !== 'unknown') {
                    const conf = answer.confidence === 'high' ? 90 : (answer.confidence === 'low' ? 70 : 0);
                    scanState.detected[key] = answer.answer;
                    scanState.confidence[key] = conf;

                    if (conf >= 90) {
                        scanState.high_confidence_keys.push(key);
                    } else if (conf >= 70) {
                        // Low confidence: data found but uncertain.
                        // Accepted as-is (not re-asked) but tracked separately.
                        scanState.low_confidence_keys.push(key);
                    } else {
                        scanState.unknown_keys.push(key);
                    }
                } else {
                    scanState.unknown_keys.push(key);
                    scanState.confidence[key] = 0;
                }
            });

            // 🛡️ POST-LOOP SAFETY: Ensure critical fields with empty/absent values are in unknown_keys
            // This catches edge cases where the LLM returns misaligned indices or skips questions
            blockKeys.forEach((key) => {
                const value = scanState.detected[key];
                const conf = scanState.confidence[key] ?? 0;
                const isEmpty = !value || (Array.isArray(value) && value.length === 0) || value === 'null' || value === '';
                if (isEmpty && conf === 0) {
                    // Ensure it's in unknown_keys and NOT in high/low confidence
                    if (!scanState.unknown_keys.includes(key)) {
                        scanState.unknown_keys.push(key);
                    }
                    scanState.high_confidence_keys = scanState.high_confidence_keys.filter(k => k !== key);
                    scanState.low_confidence_keys = scanState.low_confidence_keys.filter(k => k !== key);
                }
            });

            // Determine next block to ask (first unknown, then first low confidence)
            scanState.next_block_key = scanState.unknown_keys[0] || scanState.low_confidence_keys[0] || "";

            logger.info('SCAN_STATE_CREATED', `Scan state built for ${urlToScan}`, {
                high: scanState.high_confidence_keys.length,
                low: scanState.low_confidence_keys.length,
                unknown: scanState.unknown_keys.length
            });

            // 🔧 Persist scan_state in DB (instead of embedding in chat messages)
            try {
                await db.saveScanState(urlToScan, {
                    ...scanState,
                    created_at: new Date().toISOString(),
                    url: urlToScan,
                });
                logger.info('SCAN_STATE_SAVED', `Saved scan_state for ${urlToScan}`);
            } catch (saveErr) {
                console.error("Failed to save scan_state:", saveErr);
            }

            // 2b. COMPUTE INITIAL SCORE (Bible 7-bloc engine)
            // Build a partial AyoExtract from scan data + extracted answers
            const initialExtract: AyoExtract = {
                version: "AYO-EXTRACT-3.0",
                source: {
                    url: urlToScan,
                    scan: {
                        is_reachable: true,
                        has_jsonld: deepScanResult.hasJsonLd ?? false,
                        jsonld_count: deepScanResult.jsonLdCount ?? 0,
                        has_asr_file: deepScanResult.hasAsrFile ?? false,
                        has_faq_content: deepScanResult.hasFaqContent ?? false,
                        has_faq_schema: deepScanResult.hasFaqSchema ?? false,
                        is_aya_registered: deepScanResult.isAyaRegistered ?? false,
                    }
                },
                fields: {
                    identite: {
                        name: { value: scanState.detected["identite.name"] || "", q: scanState.confidence["identite.name"] >= 85 ? 1 : scanState.confidence["identite.name"] > 0 ? 0.5 : 0, evidence: [] },
                        legal_name: { value: scanState.detected["identite.legal_name"] || "", q: scanState.confidence["identite.legal_name"] >= 85 ? 1 : scanState.confidence["identite.legal_name"] > 0 ? 0.5 : 0, evidence: [] },
                        business_type: { value: scanState.detected["identite.business_type"] || "", q: scanState.confidence["identite.business_type"] >= 85 ? 1 : scanState.confidence["identite.business_type"] > 0 ? 0.5 : 0, evidence: [] },
                        city: { value: scanState.detected["identite.city"] || "", q: scanState.confidence["identite.city"] >= 85 ? 1 : scanState.confidence["identite.city"] > 0 ? 0.5 : 0, evidence: [] },
                        country: { value: scanState.detected["identite.country"] || "", q: scanState.confidence["identite.country"] >= 85 ? 1 : scanState.confidence["identite.country"] > 0 ? 0.5 : 0, evidence: [] },
                        contact_email: { value: scanState.detected["identite.contact_email"] || "", q: scanState.confidence["identite.contact_email"] >= 85 ? 1 : scanState.confidence["identite.contact_email"] > 0 ? 0.5 : 0, evidence: [] },
                        contact_phone: { value: scanState.detected["identite.contact_phone"] || "", q: scanState.confidence["identite.contact_phone"] >= 85 ? 1 : scanState.confidence["identite.contact_phone"] > 0 ? 0.5 : 0, evidence: [] },
                    },
                    offre: {
                        services: { value: [], q: scanState.confidence["offre.services"] >= 85 ? 1 : scanState.confidence["offre.services"] > 0 ? 0.5 : 0, evidence: [] },
                        products: { value: [], q: scanState.confidence["offre.products"] >= 85 ? 1 : scanState.confidence["offre.products"] > 0 ? 0.5 : 0, evidence: [] },
                        use_cases: { value: [], q: scanState.confidence["offre.use_cases"] >= 85 ? 1 : scanState.confidence["offre.use_cases"] > 0 ? 0.5 : 0, evidence: [] },
                        target_audience: { value: scanState.detected["offre.target_audience"] || "", q: scanState.confidence["offre.target_audience"] >= 85 ? 1 : scanState.confidence["offre.target_audience"] > 0 ? 0.5 : 0, evidence: [] },
                        pricing_indication: { value: scanState.detected["offre.pricing_indication"] || "", q: scanState.confidence["offre.pricing_indication"] >= 85 ? 1 : scanState.confidence["offre.pricing_indication"] > 0 ? 0.5 : 0, evidence: [] },
                    },
                    processus_methodes: {
                        process_steps: { value: [], q: scanState.confidence["processus_methodes.process_steps"] >= 85 ? 1 : scanState.confidence["processus_methodes.process_steps"] > 0 ? 0.5 : 0, evidence: [] },
                        delivery_mode: { value: scanState.detected["processus_methodes.delivery_mode"] || "", q: scanState.confidence["processus_methodes.delivery_mode"] >= 85 ? 1 : scanState.confidence["processus_methodes.delivery_mode"] > 0 ? 0.5 : 0, evidence: [] },
                        geographies_served: { value: scanState.detected["processus_methodes.geographies_served"] || "", q: scanState.confidence["processus_methodes.geographies_served"] >= 85 ? 1 : scanState.confidence["processus_methodes.geographies_served"] > 0 ? 0.5 : 0, evidence: [] },
                        quality_assurance: { value: scanState.detected["processus_methodes.quality_assurance"] || "", q: scanState.confidence["processus_methodes.quality_assurance"] >= 85 ? 1 : scanState.confidence["processus_methodes.quality_assurance"] > 0 ? 0.5 : 0, evidence: [] },
                    },
                    engagements_conformite: {
                        policies: { value: [], q: scanState.confidence["engagements_conformite.policies"] >= 85 ? 1 : scanState.confidence["engagements_conformite.policies"] > 0 ? 0.5 : 0, evidence: [] },
                        frameworks: { value: [], q: scanState.confidence["engagements_conformite.frameworks"] >= 85 ? 1 : scanState.confidence["engagements_conformite.frameworks"] > 0 ? 0.5 : 0, evidence: [] },
                        certifications: { value: [], q: scanState.confidence["engagements_conformite.certifications"] >= 85 ? 1 : scanState.confidence["engagements_conformite.certifications"] > 0 ? 0.5 : 0, evidence: [] },
                        security_measures: { value: [], q: scanState.confidence["engagements_conformite.security_measures"] >= 85 ? 1 : scanState.confidence["engagements_conformite.security_measures"] > 0 ? 0.5 : 0, evidence: [] },
                    },
                    indicateurs: {
                        key_indicators: { value: [], q: scanState.confidence["indicateurs.key_indicators"] >= 85 ? 1 : scanState.confidence["indicateurs.key_indicators"] > 0 ? 0.5 : 0, evidence: [] },
                        last_review_date: { value: scanState.detected["indicateurs.last_review_date"] || "", q: scanState.confidence["indicateurs.last_review_date"] >= 85 ? 1 : scanState.confidence["indicateurs.last_review_date"] > 0 ? 0.5 : 0, evidence: [] },
                    },
                    contenus_pedagogiques: {
                        has_faq: { value: scanState.detected["contenus_pedagogiques.has_faq"] || deepScanResult.hasFaqContent || false, q: scanState.confidence["contenus_pedagogiques.has_faq"] >= 85 ? 1 : (deepScanResult.hasFaqContent ? 1 : (scanState.confidence["contenus_pedagogiques.has_faq"] > 0 ? 0.5 : 0)), evidence: [] },
                        has_glossary: { value: scanState.detected["contenus_pedagogiques.has_glossary"] || false, q: scanState.confidence["contenus_pedagogiques.has_glossary"] >= 85 ? 1 : scanState.confidence["contenus_pedagogiques.has_glossary"] > 0 ? 0.5 : 0, evidence: [] },
                        has_documentation: { value: scanState.detected["contenus_pedagogiques.has_documentation"] || false, q: scanState.confidence["contenus_pedagogiques.has_documentation"] >= 85 ? 1 : scanState.confidence["contenus_pedagogiques.has_documentation"] > 0 ? 0.5 : 0, evidence: [] },
                    },
                    structure_technique: {
                        has_asr: { value: deepScanResult.hasAsrFile ?? false, q: deepScanResult.hasAsrFile ? 1 : 0, evidence: [] },
                        has_jsonld: { value: deepScanResult.hasJsonLd ?? false, q: deepScanResult.hasJsonLd ? 1 : 0, evidence: [] },
                        has_sitemap: { value: null, q: 0, evidence: [] },
                        mobile_optimized: { value: true, q: 1, evidence: ["Assumed responsive"] },
                    },
                    contextual_signals: {
                        pricing_level: { value: "undisclosed", q: 0, evidence: [] },
                        access_mode: { value: "public", q: 0.5, evidence: [] },
                        service_mode: { value: [], q: 0, evidence: [] },
                        schedule_type: { value: [], q: 0, evidence: [] },
                    },
                    recommandation: {
                        contextual_relevance: { value: [], q: 0, evidence: [] },
                        selection_conditions: { value: { required: [], exclusion: [] }, q: 0, evidence: [] },
                        ai_simulation: { value: [], q: 0, evidence: [] },
                    },
                    external_context: {
                        ecosystem_presence: { value: [], q: 0, evidence: [] },
                        reputation_signals: { value: false, q: 0, evidence: [] },
                        keywords: { value: [], q: scanState.confidence["external_context.keywords"] >= 85 ? 1 : scanState.confidence["external_context.keywords"] > 0 ? 0.5 : 0, evidence: [] },
                        intents: { value: [], q: scanState.confidence["external_context.intents"] >= 85 ? 1 : scanState.confidence["external_context.intents"] > 0 ? 0.5 : 0, evidence: [] },
                        channels: { value: [], q: 0, evidence: [] },
                        permissions: { value: [], q: 0, evidence: [] },
                    },
                }
            } as AyoExtract;

            const initialScore = analyseScore(initialExtract);
            logger.info('INITIAL_SCORE', `Initial AIO score for ${urlToScan}: ${initialScore.total}/100`, {
                total: initialScore.total,
                blocks: initialScore.blocks,
                capApplied: initialScore.capApplied,
                capReason: initialScore.capReason,
            });

            // 2c. SAVE INITIAL ANALYSIS TO DB (Source of Truth for Webhook)
            try {
                await db.saveAnalysis(sessionAsrId, {
                    id: sessionAsrId,
                    url: urlToScan,
                    email: null,
                    score: initialScore.total,
                    data: {
                        fields: initialExtract.fields,
                        blocks: initialScore.blocks,
                        scan: deepScanResult,
                        analysis_blocks: initialScore.audit
                    }
                });
                logger.info('INITIAL_SAVE', `Analysis saved to DB: ${sessionAsrId}, Score: ${initialScore.total}`);
            } catch (dbErr) {
                logger.error('INITIAL_SAVE_ERROR', dbErr instanceof Error ? dbErr.message : 'DB save failed');
            }

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

            // Add initial 7-bloc score display (from AYO Router formatScoreMessage)
            transparencySummary += formatScoreMessage(initialScore, 'initial') + '\n\n';

            const weakBlocks = Object.entries(initialScore.audit || {})
                .filter(([, v]: [string, any]) => v.status === 'error' || v.status === 'warning')
                .map(([, v]: [string, any]) => v.label);

            if (weakBlocks.length > 0) {
                transparencySummary += `⚠️ **BLOCS À AMÉLIORER** : ${weakBlocks.join(', ')}\n`;
            }

            transparencySummary += `\n**Ce que cela signifie :**\n`;
            transparencySummary += `Votre entreprise possède des informations, mais elles ne sont pas structurées de manière lisible par les IA (ChatGPT, Gemini, Claude...). Résultat : ces IA ne peuvent ni vous identifier clairement, ni vous recommander.\n\n`;
            transparencySummary += `**Ce que nous allons faire :**\n`;
            transparencySummary += `Je vais vous poser plusieurs questions ciblées. Vos réponses me permettront de créer des fichiers structurés (ASR) qui rendront votre entreprise **lisible**, donc **visible**, et en conséquence **recommandable** par les IA.\n\n`;
            transparencySummary += `➡️ Mais avant tout...`;

            // 4. First question: Ownership validation
            // Include scan_state in the response for CONTINUE_QUESTIONING to use
            if (missingInfos.length === 0) {
                console.log("🎯 All questions auto-answered! Triggering FINAL_ANALYSIS...");
                finalResponseText = JSON.stringify({
                    type: "question_block",
                    intro: transparencySummary + "\n\n✅ **Toutes les informations ont été collectées !**",
                    // scan_state persisted in Firestore (not sent to client)
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
                    intro: transparencySummary + `\n\n⚠️ **Important** : AYO sert à structurer votre vérité, pas à la fabriquer. Les IA vérifient vos déclarations par recoupement. Toute incohérence vous classerait comme "Source Non Fiable".`,
                    // scan_state persisted in Firestore (not sent to client)
                    questions: [{
                        id: "ownership_confirm",
                        text: "Confirmez-vous que ce site vous appartient et que les données sont exactes ?",
                        options: ["✅ Oui, c'est mon site", "Non"],
                        allowCustom: false
                    }]
                });
            }

        }

        // 🛑 EARLY RETURN for SCAN (prevent email check)
        if (ayoState === AyoState.SCAN_EN_COURS && finalResponseText) {
            console.log("✅ Returning SCAN result (skipping email logic)");
            // Inject SID marker so subsequent calls can recover it
            try {
                const parsed = JSON.parse(finalResponseText);
                parsed._sid = sessionAsrId;
                parsed.intro = (parsed.intro || "") + `\n[AYO_SID:${sessionAsrId}]`;
                finalResponseText = JSON.stringify(parsed);
            } catch { finalResponseText += `\n[AYO_SID:${sessionAsrId}]`; }
            return new Response(JSON.stringify({ text: finalResponseText }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (ayoState === AyoState.OWNERSHIP || ayoState === AyoState.TRUTH_WARNING || ayoState === AyoState.QUESTIONNAIRE || ayoState === AyoState.CALIBRATION) {
            console.log(`🚀 TRIGGERING PHASE 2: SEQUENTIAL QUESTIONING (V5 Context-Aware) | AyoState=${ayoState}`);
            console.log("Asking NEXT Block...");

            // Check if the LAST assistant message was the ownership question (one-shot guard)
            const lastAssistantMsgOwn = messages.filter((m: any) => m.role === 'assistant').pop();
            const isOwnershipResponse = lastAssistantMsgOwn && lastAssistantMsgOwn.content.includes('ownership_confirm');

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
                    intro: `💡 **Excellente décision.**
                    
Techniquement, si vous mentez, AYO génèrera votre fichier ASR avec les informations fournies (donc votre certification technique sera valide).

⚠️ **MAIS c'est une stratégie dangereuse.** Les IA (ChatGPT, Gemini) fonctionnent par **Recoupement de Preuves** :
1. Elles lisent votre Déclaration (ASR).
2. Elles la comparent à votre Réalité Observable (Site Web, Avis).
3. S'il y a contradiction (ex: vous déclarez "Leader Mondial" mais votre site est vide), l'IA détectera une **Incohérence Critique**.

🛑 **Résultat :** Au lieu d'être recommandé, vous serez classé comme "Source Non Fiable" (Hallucination Probable). AYO sert à structurer votre vérité, pas à la fabriquer.`,
                    questions: [{
                        id: "truth_confirmation",
                        text: "Avez-vous bien compris l'importance de déclarer des informations exactes ?",
                        options: ["✅ J'ai compris, je poursuis l'analyse", "❌ Annuler"],
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

                // If user wants to CANCEL
                if (userChoice.includes("annuler")) {
                    finalResponseText = `❌ **Analyse annulée.**\n\nVous pouvez relancer une analyse à tout moment en indiquant l'URL de votre site.`;
                    return new Response(JSON.stringify({ text: finalResponseText }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

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

            // 🔧 ARCHITECTURAL FIX: Read scan_state from Firestore via Scanner agent
            let scanState: any = null;

            if (historyUrlMatch) {
                let urlForState = historyUrlMatch.content.match(historyUrlRegex)?.[0] || "";
                if (urlForState && !urlForState.startsWith('http')) {
                    urlForState = 'https://' + urlForState;
                }
                scanState = await loadScanState(urlForState);
                if (scanState) {
                    console.log("✅ SCAN_STATE LOADED FROM FIRESTORE for:", urlForState);
                } else {
                    console.warn("⚠️ No scan_state found in Firestore for:", urlForState);
                }
            }

            // Fallback: try reading from message history (backward compat)
            if (!scanState) {
                const scanStateMsg = [...messages].reverse().find((m: any) => {
                    if (m.role !== 'assistant') return false;
                    try {
                        const parsed = JSON.parse(m.content);
                        return parsed.scan_state !== undefined;
                    } catch (_e) {
                        return false;
                    }
                });
                if (scanStateMsg) {
                    try {
                        scanState = JSON.parse(scanStateMsg.content).scan_state;
                        console.log("✅ SCAN_STATE LOADED FROM HISTORY (fallback)");
                    } catch (e) {
                        console.error("❌ Failed to parse scan_state from message:", e);
                    }
                } else {
                    console.warn("⚠️ No scan_state found anywhere. Using empty state.");
                }
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
                // Identité (7)
                "identite.name", "identite.country", "identite.legal_name", "identite.business_type",
                "identite.city", "identite.contact_email", "identite.contact_phone",
                // Offre (5)
                "offre.target_audience", "offre.services", "offre.products", "offre.pricing_indication", "offre.use_cases",
                // Processus & Méthodes (4)
                "processus_methodes.process_steps", "processus_methodes.delivery_mode",
                "processus_methodes.geographies_served", "processus_methodes.quality_assurance",
                // Conformité (4)
                "engagements_conformite.certifications", "engagements_conformite.frameworks",
                "engagements_conformite.security_measures", "engagements_conformite.policies",
                // Indicateurs (2)
                "indicateurs.key_indicators", "indicateurs.last_review_date",
                // Pédagogie (3)
                "contenus_pedagogiques.has_faq", "contenus_pedagogiques.has_glossary", "contenus_pedagogiques.has_documentation",
                // Contexte externe (2)
                "external_context.keywords", "external_context.intents"
            ];

            // 🧮 ORDERED QUEUE — SÉPARÉE EN 2 TYPES :
            // 1. validationQueue = données scannées lowConfidence → question statique Oui/Non (pas de LLM)
            // 2. enrichmentQueue = données inconnues → question LLM via Greffier

            // Champs qui nécessitent TOUJOURS une réponse ouverte (jamais Oui/Non)
            const ENRICHMENT_ONLY_FIELDS = [
              'identite.contact_email',
              'identite.contact_phone',
              'identite.legal_name',
              'identite.city',
              'processus_methodes.geographies_served',
              'processus_methodes.process_steps',
              'engagements_conformite.certifications',
              'engagements_conformite.security_measures',
              'indicateurs.key_indicators',
              'indicateurs.testimonials',
              'indicateurs.certifications_count',
            ];

            const validationQueue = allBlockNames.filter(b =>
              lowConfidenceKeys.includes(b) && !ENRICHMENT_ONLY_FIELDS.includes(b)
            );
            const enrichmentQueue = allBlockNames.filter(b =>
              (unknownKeys.includes(b) && !lowConfidenceKeys.includes(b)) ||
              (lowConfidenceKeys.includes(b) && ENRICHMENT_ONLY_FIELDS.includes(b))
            );
            // Validation d'abord, enrichissement ensuite
            const combinedQueue = [...validationQueue, ...enrichmentQueue];

            // BUG FIX: Critical identity fields MUST always be in the queue even if scan missed them
            // This prevents contact_email from being silently dropped
            const MANDATORY_FIELDS = ['identite.contact_email', 'identite.legal_name', 'identite.contact_phone'];
            for (const field of MANDATORY_FIELDS) {
                if (!combinedQueue.includes(field) && !highConfidenceKeys.includes(field)) {
                    combinedQueue.push(field);
                    console.log(`📋 QUEUE FIX: Added mandatory field ${field} (was missing from both queues)`);
                }
            }

            // Prioritize Country (identite.country)
            const countryIndex = combinedQueue.indexOf("identite.country");
            if (countryIndex > 0) {
                combinedQueue.splice(countryIndex, 1);
                combinedQueue.unshift("identite.country");
            }

            console.log(`📋 QUEUE: ${combinedQueue.length} items to process`);

            // 🎯 NEW ROBUST INDEXING (V3):
            // We count how many "question blocks" the assistant has ALREADY sent.
            // This is immune to user multiple messages or "pedagogical" interruptions.
            // Count UNIQUE question IDs only — repeated/looped questions don't consume queue slots
            const seenQuestionIds = new Set<string>();
            for (const m of assistantMessages) {
                if (m.content.includes('question_block')) {
                    const idMatch = m.content.match(/"id"\s*:\s*"([^"]+)"/);
                    if (idMatch) {
                        const qId = idMatch[1];
                        // BUG FIX: Exclude fallback/error IDs from counting — they don't represent real questions
                        if (qId === 'parsing_error_fallback' || qId.startsWith('q_fallback_')) continue;
                        seenQuestionIds.add(qId);
                    } else {
                        seenQuestionIds.add(`_anon_${seenQuestionIds.size}`);
                    }
                }
            }
            const questionsAskedCount = seenQuestionIds.size;

            let nextBlockName = "";
            let queueIndex = -1;

            // 🎯 STATE MACHINE: Re-derive with queue info for precise routing
            if (stepsCompleted <= 2 && questionsAskedCount < 3) {
                nextBlockName = "activity_calibration";
                ayoState = AyoState.CALIBRATION;
                console.log(`🎯 AYO STATE (refined): ${AyoState.CALIBRATION}`);
            } else {
                // The first 3 question_blocks are: ownership_confirm, truth_confirmation, calibration.
                // queueIndex = how many data questions we've already asked (after the 3 setup questions)
                queueIndex = Math.max(0, questionsAskedCount - 3);
                // Safety: clamp to queue size
                if (queueIndex >= combinedQueue.length) {
                    nextBlockName = "FINALISATION";
                } else {
                    nextBlockName = combinedQueue[queueIndex];
                }
            }
            console.log(`📋 QUEUE DEBUG: questionsAsked=${questionsAskedCount}, queueIdx=${queueIndex}, queueLen=${combinedQueue.length}, next=${nextBlockName}`);

            console.log(`➡️ PROGRESS: Turn=${stepsCompleted} | QueueIdx=${queueIndex} | NextBlock=${nextBlockName}`);

            if (nextBlockName === "FINALISATION") {
                console.log(`🏁 AYO STATE → ${AyoState.SCORING}: All blocks covered. Triggering FINAL_ANALYSIS...`);
                ayoState = AyoState.SCORING;
            }

            // 📎 EVIDENCE LINKS: Extract URLs from user answers for proof-required fields
            // Scan recent user messages for links provided as evidence
            const evidenceLinks: Record<string, { field: string; url: string; timestamp: string }[]> = {};
            const urlEvidenceRegex = /https?:\/\/[^\s,)"'<>]+/gi;
            const recentUserMessages = messages
                .filter((m: any) => m.role === 'user')
                .slice(-6); // Look at recent answers

            for (const msg of recentUserMessages) {
                const content = (msg as any).content || '';
                const foundUrls = content.match(urlEvidenceRegex);
                if (foundUrls && foundUrls.length > 0) {
                    // Determine which field this evidence relates to based on the previous block
                    const prevBlockIdx = Math.max(0, queueIndex - 1);
                    const relatedBlock = combinedQueue[prevBlockIdx] || nextBlockName;
                    if (!evidenceLinks[relatedBlock]) {
                        evidenceLinks[relatedBlock] = [];
                    }
                    for (const url of foundUrls) {
                        evidenceLinks[relatedBlock].push({
                            field: relatedBlock,
                            url: url,
                            timestamp: new Date().toISOString(),
                        });
                    }
                    console.log(`📎 EVIDENCE LINK detected for ${relatedBlock}: ${foundUrls.join(', ')}`);
                }
            }

            // 💾 INTERMEDIATE SAVE: Persist questionnaire progress AND user answers after each answer
            // This prevents data loss if the flow is interrupted before FINAL_SAVE
            if (sessionAsrId && stepsCompleted > 2 && queueIndex > 0) {
                try {
                    // Collect ALL user answers since the scan (not just last 3)
                    const scanMsgIdx = messages.findIndex((m: any) =>
                        m.role === 'assistant' && (
                            m.content.includes("INFORMATIONS DÉTECTÉES") ||
                            m.content.includes("SCAN TERMINÉ") ||
                            m.content.includes("ownership_confirm")
                        )
                    );
                    const allUserAnswers: Record<string, string> = {};
                    if (scanMsgIdx !== -1) {
                        const msgsAfterScan = messages.slice(scanMsgIdx);
                        let lastQuestionBlockField = '';
                        for (const msg of msgsAfterScan) {
                            if (msg.role === 'assistant') {
                                // Extract the field name from question_block
                                // BUG FIX: Use regex fallback when JSON.parse fails (LLM wraps JSON in text)
                                let extractedId = '';
                                try {
                                    const parsed = JSON.parse(msg.content);
                                    if (parsed?.questions?.[0]?.id) {
                                        extractedId = parsed.questions[0].id;
                                    }
                                } catch {
                                    // Fallback: regex extraction when message isn't pure JSON
                                    if (msg.content.includes('question_block')) {
                                        const idMatch = msg.content.match(/"id"\s*:\s*"([^"]+)"/);
                                        if (idMatch) {
                                            extractedId = idMatch[1];
                                        }
                                    }
                                }
                                // Skip fallback/error question IDs — they carry no real data
                                if (extractedId && extractedId !== 'parsing_error_fallback' && !extractedId.startsWith('q_fallback_')) {
                                    lastQuestionBlockField = extractedId;
                                }
                            } else if (msg.role === 'user' && lastQuestionBlockField) {
                                const answer = msg.content.trim();
                                // Skip pure confirmations like "Oui c'est exact"
                                if (!answer.match(/^(oui|non|ok|d'accord|exact|parfait|je confirme|c'est bon)/i) || answer.length > 30) {
                                    allUserAnswers[lastQuestionBlockField] = answer;
                                }
                            }
                        }
                    }

                    const hasEvidenceLinks = Object.keys(evidenceLinks).length > 0;
                    await db.saveAnalysis(sessionAsrId, {
                        data: {
                            questionnaire_progress: {
                                step: stepsCompleted,
                                queueIndex,
                                nextBlock: nextBlockName,
                                timestamp: new Date().toISOString(),
                            },
                            questionnaire_answers: allUserAnswers,
                            ...(hasEvidenceLinks ? { evidence_links: evidenceLinks } : {}),
                        }
                    } as any);
                    console.log(`💾 INTERMEDIATE SAVE: step=${stepsCompleted}, queueIdx=${queueIndex}, answers=${Object.keys(allUserAnswers).length}, session=${sessionAsrId}${hasEvidenceLinks ? ', with evidence_links' : ''}`);
                } catch (e) {
                    console.warn('⚠️ Intermediate save failed (non-blocking):', e);
                }
            }

            // 🆕 HANDLER FOR CALIBRATION STEP
            if (ayoState === AyoState.CALIBRATION) {
                console.log("🛠️ SENDING CALIBRATION QUESTION (Static)");
                finalResponseText = JSON.stringify({
                    type: "question_block",
                    intro: "",
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

            // 🛡️ VALIDATEUR POST-LLM : Vérifie que le JSON respecte les règles métier (mutation in-place)
            function validateQuestionBlock(parsed: any): void {
                if (!parsed.questions || !Array.isArray(parsed.questions)) return;

                // Règle 1 : garder uniquement la première question (pas 2 en 1)
                if (parsed.questions.length > 1) {
                    console.warn(`⚠️ VALIDATOR: ${parsed.questions.length} questions reçues, on garde la première`);
                    parsed.questions = [parsed.questions[0]];
                }

                const q = parsed.questions[0];
                if (!q) return;

                // Règle 2 : au moins 2 options, jamais seulement "Autre"
                // SAUF pour les champs texte libre (email, téléphone, etc.)
                const TEXT_INPUT_FIELDS = [
                    'contact_email', 'contact_phone', 'geographies_served',
                    'legal_name', 'city', 'process_steps', 'key_indicators',
                    'services_details', 'target_audience_details', 'products_details',
                    'use_cases_details', 'pricing_details', 'delivery_mode_details',
                    'quality_assurance_details', 'certifications_details',
                    'frameworks_details', 'security_measures_details', 'policies_details',
                ];
                const qIdLower = (q.id || '').toLowerCase();
                const qTextLower = (q.text || '').toLowerCase();
                // URL questions: only if no good options already exist (evidence questions have "Je n'ai pas de lien" etc.)
                const hasEvidenceOptions = (q.options || []).some((o: string) =>
                    o.toLowerCase().includes('pas de lien') || o.toLowerCase().includes('non applicable'));
                const isUrlQuestion = !hasEvidenceOptions && (
                    qTextLower.includes('collez l') ||
                    qTextLower.includes('coller l') || qTextLower.includes('saisissez l'));
                // Detect detail/description fields by suffix patterns (LLM often generates _details, _description, _specifics)
                const isDetailField = qIdLower.match(/_(details|description|specifics|precisions|complement)$/);
                const isTextInputField = isUrlQuestion || isDetailField || TEXT_INPUT_FIELDS.some(f => qIdLower.includes(f)) ||
                    qTextLower.includes('email') || qTextLower.includes('téléphone') ||
                    qTextLower.includes('phone') || qTextLower.includes('zone géographique') ||
                    qTextLower.includes('nom légal') || qTextLower.includes('raison sociale') ||
                    qTextLower.includes('collez') || qTextLower.includes('saisissez') ||
                    qTextLower.includes('décrivez') || qTextLower.includes('détaillez') ||
                    qTextLower.includes('précisez') || qTextLower.includes('expliquez');

                // Pour les champs texte libre, TOUJOURS forcer inputType text
                // (même si le LLM a généré des options comme "contact@ai-visionary.com")
                if (isTextInputField) {
                    q.options = [];
                    q.allowCustom = true;
                    q.inputType = "text";
                    if (!q.customLabel) {
                        // Priority: description fields > URL > other
                        const isDescriptionQuestion = isDetailField ||
                            qTextLower.includes('décri') || qTextLower.includes('détail') ||
                            qTextLower.includes('processus') || qTextLower.includes('méthodologie') ||
                            qTextLower.includes('expliquez') || qTextLower.includes('précisez') ||
                            qIdLower.includes('process_steps') || qIdLower.includes('key_indicators');
                        if (isDescriptionQuestion) q.customLabel = "Décrivez ici...";
                        else if (qTextLower.includes('email')) q.customLabel = "Saisissez votre email...";
                        else if (qTextLower.includes('téléphone') || qTextLower.includes('phone')) q.customLabel = "Saisissez votre numéro...";
                        else if (qTextLower.includes('géographi')) q.customLabel = "Saisissez la zone géographique...";
                        else if (isUrlQuestion && !isDescriptionQuestion) q.customLabel = "Collez l'URL ici...";
                        else q.customLabel = "Saisissez votre réponse...";
                    }
                    console.warn("⚠️ VALIDATOR: champ texte → inputType text (pas de boutons)");
                } else if (hasEvidenceOptions) {
                    // Questions de preuve : garder les options + forcer allowCustom + bon label
                    q.allowCustom = true;
                    if (!q.customLabel) q.customLabel = "Autre méthode / Préciser...";
                    console.warn("⚠️ VALIDATOR: question de preuve → options gardées + allowCustom");
                } else if (!q.options || q.options.length === 0) {
                    q.options = ["Oui", "Non"];
                    q.allowCustom = true;
                    console.warn("⚠️ VALIDATOR: 0 options → fallback Oui/Non");
                } else if (q.options.length === 1) {
                    const singleOpt = q.options[0].toLowerCase();
                    if (singleOpt.includes('autre') || singleOpt.includes('préciser')) {
                        q.options = ["Oui", "Non"];
                        q.allowCustom = true;
                        console.warn("⚠️ VALIDATOR: seule option 'Autre' → fallback Oui/Non");
                    }
                }
            }

            // ONLY GENERATE A NEW QUESTION IF WE ARE STILL IN QUESTIONING MODE
            if (ayoState === AyoState.QUESTIONNAIRE || ayoState === AyoState.OWNERSHIP || ayoState === AyoState.TRUTH_WARNING) {

                // 🆕 VALIDATION STATIQUE : Si le prochain bloc est lowConfidence, question Oui/Non sans LLM
                if (validationQueue.includes(nextBlockName)) {
                    const fieldName = nextBlockName.split('.')[1] || nextBlockName;
                    const detectedValue = detectedValues[nextBlockName] || 'Information détectée';
                    finalResponseText = buildValidationQuestion(
                        nextBlockName.split('.')[0],
                        fieldName,
                        detectedValue
                    );
                    console.log(`✅ VALIDATION STATIQUE pour ${nextBlockName} (pas de LLM)`);
                } else {
                // 🤖 AGENT GREFFIER — génère le prompt pour la prochaine question (ENRICHISSEMENT)
                const scanInfo = contextScanResult ? formatScanForGreffier({
                    ...contextScanResult,
                    hasSitemap: contextScanResult.hasSitemap ?? (detectedValues['engagements_conformite.policies'] || '').toLowerCase().includes('sitemap'),
                    hasRobotsTxt: contextScanResult.hasRobotsTxt ?? (detectedValues['engagements_conformite.policies'] || '').toLowerCase().includes('robot'),
                    detectedPolicies: contextScanResult.detectedPolicies ?? [],
                }) : 'Scan non disponible';

                const CONTINUE_PROMPT = buildContinuePrompt({
                    nextBlockName,
                    scanInfo,
                    highConfidenceData: highConfidenceData || 'Aucun',
                    lowConfidenceData: lowConfidenceData || 'Aucun',
                });

                const continueResult = await generateText({
                    model: modelToUse,
                    temperature: 0, // Force determinism for protocol
                    system: CONTINUE_PROMPT + "\n\n⚠️ IMPORTANT : RÉPONDS UNIQUEMENT AVEC LE JSON. PAS DE TEXTE AVANT OU APRÈS. TU NE DOIS JAMAIS RENVOYER UN TABLEAU DE QUESTIONS VIDE.\n⚠️ Le champ \"intro\" et le champ \"text\" doivent contenir UNIQUEMENT du texte humain lisible. JAMAIS de JSON, guillemets, crochets ou accolades dans ces champs.",
                    messages: messages
                });

                const rawResponse = continueResult.text;
                // ROBUST JSON EXTRACTION via REGEX (Handles text before/after)
                const jsonRegex = /({[\s\S]*})/;
                const jsonMatch = rawResponse.match(jsonRegex);

                if (jsonMatch) {
                    // We found a JSON-like block
                    const potentialJson = jsonMatch[0];
                    finalResponseText = potentialJson;

                    try {
                        const parsedResponse = JSON.parse(potentialJson);

                        // 🛡️ Valider les règles métier
                        validateQuestionBlock(parsedResponse);

                        // 🔒 DETERMINISTIC ONLY: LLM cannot trigger FINAL_ANALYSIS.
                        // Only the queue-based progression (nextBlockName === "FINALISATION") can end the questionnaire.
                        // SANITY CHECK: If LLM screwed up and sent empty questions array, fallback immediately
                        if (!parsedResponse.questions || parsedResponse.questions.length === 0) {
                            throw new Error("LLM returned empty questions array");
                        }

                        // 🧹 SANITIZER: Strip raw JSON fragments from user-facing text fields
                        // The LLM sometimes leaks JSON syntax into the "intro" or question "text" fields.
                        // Patterns: `","`, `"questions":[`, `"}]`, `"type":"`, `"id":"`, `[{"`
                        const JSON_LEAK_PATTERNS = /(","|"\w+":\s*[\[{"]|\}\]|^\s*\{|"\s*:\s*")/;

                        if (parsedResponse.intro && JSON_LEAK_PATTERNS.test(parsedResponse.intro)) {
                            console.warn("⚠️ SANITIZER: Raw JSON detected in intro field. Cleaning...");
                            // Extract only the human-readable part before JSON artifacts
                            // Strategy: take text before first JSON-like pattern, or fallback to empty
                            let cleanIntro = parsedResponse.intro
                                // Remove anything that looks like JSON key-value pairs
                                .replace(/"[a-zA-Z_]+"\s*:\s*[\[{"]/g, '')
                                // Remove JSON array/object closures
                                .replace(/[}\]]+\s*$/g, '')
                                // Remove orphaned JSON punctuation
                                .replace(/[{}\[\]]+/g, '')
                                // Remove consecutive commas and orphaned quotes
                                .replace(/"{2,}/g, '')
                                .replace(/,{2,}/g, ',')
                                // Remove trailing/leading commas and whitespace
                                .replace(/^[\s,]+|[\s,]+$/g, '')
                                .trim();

                            // If cleaning left nothing meaningful, use a generic transition
                            if (!cleanIntro || cleanIntro.length < 5) {
                                cleanIntro = "Continuons l'analyse.";
                            }
                            parsedResponse.intro = cleanIntro;
                        }

                        // Sanitize question text fields too
                        if (parsedResponse.questions && Array.isArray(parsedResponse.questions)) {
                            parsedResponse.questions.forEach((q: any) => {
                                if (q.text && JSON_LEAK_PATTERNS.test(q.text)) {
                                    console.warn(`⚠️ SANITIZER: Raw JSON detected in question text (id=${q.id}). Cleaning...`);
                                    q.text = q.text
                                        .replace(/"[a-zA-Z_]+"\s*:\s*[\[{"]/g, '')
                                        .replace(/[}\]]+\s*$/g, '')
                                        .replace(/[{}\[\]]+/g, '')
                                        .replace(/"{2,}/g, '')
                                        .replace(/,{2,}/g, ',')
                                        .replace(/^[\s,]+|[\s,]+$/g, '')
                                        .trim();
                                    if (!q.text || q.text.length < 5) {
                                        q.text = `Concernant ${nextBlockName}, pourriez-vous préciser ?`;
                                    }
                                }
                            });
                        }

                        // Re-serialize the sanitized response
                        finalResponseText = JSON.stringify(parsedResponse);
                    } catch (e) {
                        console.warn("❌ JSON Parse Failed despite Regex match. Using deterministic fallback for:", nextBlockName, e);
                        // BUG FIX: Instead of a generic error, generate the ACTUAL next question deterministically
                        // This prevents wasting queue slots and re-asking the same broken question
                        const fbFieldName = nextBlockName.split('.')[1] || nextBlockName;
                        const fbBlockName = nextBlockName.split('.')[0] || nextBlockName;
                        finalResponseText = buildValidationQuestion(
                            fbBlockName,
                            fbFieldName,
                            'Information non disponible — merci de préciser'
                        );
                        console.log(`✅ DETERMINISTIC FALLBACK for ${nextBlockName} (no LLM needed)`);
                    }
                } else if (rawResponse.match(/```json/)) {
                    // Fallback for markdown blocks if indices failed for some reason
                    const jsonMatch = rawResponse.match(/```json([\s\S]*?)```/);
                    if (jsonMatch) finalResponseText = jsonMatch[1];
                } else {
                    // 🔒 DETERMINISTIC ONLY: LLM cannot trigger FINAL_ANALYSIS.
                    // Disabled to prevent premature questionnaire termination by LLM hallucination.
                    if (false) { /* DISABLED: LLM-triggered finalization removed */
                        ayoState = AyoState.SCORING;
                        finalResponseText = "";
                    } else {
                        console.warn(`⚠️ LLM Failed to output JSON in Step ${stepsCompleted}. Using deterministic fallback for: ${nextBlockName}`);
                        // BUG FIX: Generate the ACTUAL next question deterministically from the queue
                        const fb2FieldName = nextBlockName.split('.')[1] || nextBlockName;
                        const fb2BlockName = nextBlockName.split('.')[0] || nextBlockName;
                        finalResponseText = buildValidationQuestion(
                            fb2BlockName,
                            fb2FieldName,
                            'Information non disponible — merci de préciser'
                        );
                        console.log(`✅ DETERMINISTIC FALLBACK (no JSON) for ${nextBlockName}`);
                    }
                }

                } // fin du else (ENRICHISSEMENT LLM)

            }
        } // End of conditional questioning block (OWNERSHIP | TRUTH_WARNING | QUESTIONNAIRE | CALIBRATION)

        // 🛡️ BUG FIX: Safety net — if we're post-scan, pre-score, and no response was generated,
        // it means the queue was exhausted but SCORING wasn't triggered properly.
        // Force transition to SCORING to prevent empty responses.
        if (!finalResponseText && hasScanInHistory && !hasFinalScore && ayoState !== AyoState.SCORING) {
            console.warn(`⚠️ SAFETY NET: No response generated in state ${ayoState}. Forcing SCORING.`);
            ayoState = AyoState.SCORING;
        }

        if (ayoState === AyoState.SCORING) {
            try {
                logger.info('AIO_ENGINE', `Triggering deterministic AIO engine, ayoState=${ayoState}`);
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
                // Filter out pure confirmation messages that carry no data
                // Délégué à l'agent Contrôle Qualité (qcIsConfirmationOnly)
                const isConfirmationOnly = qcIsConfirmationOnly;

                let userAnswersContext = "";
                if (scanMsgIndex !== -1) {
                    // Capture ALL messages after the scan (questions + answers)
                    // BUT FILTER OUT pure confirmation messages from users
                    const subsequentMessages = messages.slice(scanMsgIndex).filter((m: any) => {
                        if (m.role === 'user' && isConfirmationOnly(m.content)) {
                            return false; // Skip "oui c'est correct" etc.
                        }
                        return true;
                    });
                    userAnswersContext = subsequentMessages.map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
                } else {
                    // SAFETY NET: If no scan marker found, include ALL user messages after the URL
                    const urlMsgIdx = messages.findIndex((m: any) => m.role === 'user' && m.content.match(/https?:\/\/|www\./));
                    if (urlMsgIdx !== -1) {
                        const allAfterUrl = messages.slice(urlMsgIdx).filter((m: any) => {
                            if (m.role === 'user' && isConfirmationOnly(m.content)) return false;
                            return true;
                        });
                        userAnswersContext = allAfterUrl.map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
                    } else {
                        userAnswersContext = messages.filter((m: any) => m.role === 'user' && !isConfirmationOnly(m.content)).map((m: any) => m.content).join('\n');
                    }
                }
                console.log(`📋 USER CONTEXT LENGTH: ${userAnswersContext.length} chars (from msgIndex ${scanMsgIndex})`);

                // 2. EXTRACTION (Semantic Perception via LLM)
                const EXTRACTION_PROMPT = `
Tu es un moteur d'extraction de données AIO (Artificial Intelligence Optimization).
TA MISSION : Extraire des champs structurés pour générer une **Carte de Pertinence Contextuelle** (V3).
INTERDICTION FORMELLE DE CALCULER UN SCORE. Tu ne notes rien. Tu extrais seulement.

⚠️ RÈGLE CRITIQUE : PRIORISE LES RÉPONSES DU QUESTIONNAIRE (USER CONTEXT) PAR-DESSUS LE CONTENU DU SITE.
Les réponses utilisateur font FOI pour la valeur extraite — mais la QUALITÉ (q) dépend de la SUBSTANCE de la réponse.

⚠️ RÈGLE ANTI-CONFIRMATION : IGNORE les messages de CONFIRMATION PURE de l'utilisateur.
Les phrases comme "Oui c'est correct", "Exact", "C'est bon", "Parfait", "Je confirme", "Ok", "D'accord"
NE SONT PAS DES VALEURS DE CHAMP. Ce sont des acquittements. JAMAIS stocker une confirmation comme valeur.
Si l'utilisateur dit "Oui c'est correct" après qu'on lui montre "Type: API de glossaires", la valeur est "API de glossaires", PAS "Oui c'est correct".

RÈGLE DE QUALITÉ (q) — SOIS STRICT ET HONNÊTE :
q=1 : Information SPÉCIFIQUE, VÉRIFIABLE et EXPLOITABLE par une IA.
  Exemples q=1 : "ISO 27001", "12 communes accompagnées", "3 étapes : audit, stratégie, implémentation", "RGPD + politique de confidentialité publiée"
q=0.5 : Information PRÉSENTE mais VAGUE, GÉNÉRIQUE ou NON-VÉRIFIABLE.
  Exemples q=0.5 : "satisfaction client" (pas de chiffre), "RGPD" (mentionné seul sans preuve), "en phase de reconditionnement" (pas encore en place), "sur devis" (pas informatif), "bouche à oreille" (pas mesurable), "oui" sans détail
q=0 : Information ABSENTE, NIÉE ou EXPLICITEMENT REFUSÉE.
  Exemples q=0 : "non", "nous n'avons pas de glossaire", "pas applicable", champ laissé vide

RÈGLES SPÉCIFIQUES PAR CHAMP :
- indicateurs.key_indicators : q=1 UNIQUEMENT si l'utilisateur donne des CHIFFRES CONCRETS ou des métriques mesurables (ex: "450 tonnes CO2 évitées", "500 clients", "12 communes"). Des termes vagues comme "satisfaction client", "bouche à oreille", "recommandabilité" = q=0.5 maximum.
- engagements_conformite.certifications : q=1 UNIQUEMENT pour des certifications NOMMÉES et RECONNUES (ex: "ISO 27001", "B Corp", "label RGE"). Mentionner "RGPD" seul = q=0.5 (c'est une obligation légale, pas une certification).
- engagements_conformite.policies : q=1 UNIQUEMENT si une politique EST en place et documentée. "En phase de reconditionnement", "en cours", "prévu" = q=0.5 maximum (pas encore effectif).
- engagements_conformite.frameworks : q=1 UNIQUEMENT pour des frameworks NOMMÉS et IDENTIFIABLES (ex: "Agile Scrum", "ITIL", "ISO 14001"). Des réponses vagues = q=0.5.
- engagements_conformite.security_measures : q=1 UNIQUEMENT pour des mesures SPÉCIFIQUES (ex: "chiffrement AES-256", "audits trimestriels par X"). "Audits de sécurité" seul = q=0.5.
- contenus_pedagogiques.has_glossary : q=0 si l'utilisateur dit "non" ou "pas de glossaire". Ne PAS inverser un refus explicite.
- contenus_pedagogiques.has_documentation : q=0 si l'utilisateur dit "non" ou nie la présence de documentation. Ne PAS inverser un refus explicite.
- offre.pricing_indication : "sur devis" = q=0.5 (c'est mieux que rien mais pas informatif). q=1 nécessite des MONTANTS RÉELS avec devise (ex: "19 CHF/mois", "499 CHF"). Des catégories seules ("Abonnement", "Prix fixe") sans montants = q=0.5 maximum.
- processus_methodes.process_steps : q=1 UNIQUEMENT si au moins 3 étapes distinctes et concrètes sont décrites.
- indicateurs.last_review_date : q=1 UNIQUEMENT si une date est explicitement mentionnée. "Première soumission" ou "jamais" = q=0.

⚠️ RÈGLE "[SKIP] Non applicable" : Si l'utilisateur répond "[SKIP] Non applicable" à une question, cela signifie que ce champ n'est PAS PERTINENT pour son activité.
Dans ce cas : value = "__SKIPPED__", q = 0. NE PAS interpréter comme "aucun" ou "non". C'est un skip volontaire.

MAPPING DES RÉPONSES UTILISATEUR :
- KPIs avec chiffres concrets -> indicateurs.key_indicators (q selon règles ci-dessus)
- Méthodologie avec étapes détaillées -> processus_methodes.process_steps (q selon règles)
- Mode de livraison (en ligne, sur site, hybride) -> processus_methodes.delivery_mode (q=1 si clair)
- Produits nommés -> offre.products (q=1)
- Certifications nommées reconnues -> engagements_conformite.certifications (q selon règles)
- Réseaux/associations/fédérations nommés -> engagements_conformite.frameworks (q selon règles)
- FAQ confirmée sur le site -> contenus_pedagogiques.has_faq (q=1)
- Glossaire confirmé -> contenus_pedagogiques.has_glossary (q=1 si oui, q=0 si non)
- Documentation/guides confirmés -> contenus_pedagogiques.has_documentation (q=1 si oui, q=0 si non)
- Politiques de sécurité effectives -> engagements_conformite.security_measures (q selon règles)
- Date de mise à jour explicite -> indicateurs.last_review_date (q=1 si date précise)
- Mots-clés pertinents -> external_context.keywords (q=1)
- Intentions de recherche -> external_context.intents (q=1)

${getExtractionRulesForPrompt()}

RÈGLES V3 "CONTEXT & SIMULATION" :
1. **Contextual Relevance** : Définis pour quels intents utilisateurs ce site est pertinent (ex: "Local Search", "B2B Query").
2. **AI Simulation** : Simule 3 requêtes (Local, Expert, Specifique) et décide si une IA recommanderait ce site AUJOURD'HUI.
3. **Selection Conditions** : Qu'est-ce qui manque pour être sélectionné ? (ex: address missing).

⚠️ TRÈS IMPORTANT : Dans le template JSON ci-dessous, TOUTES les valeurs "q" sont à 0 par défaut.
TU DOIS OBLIGATOIREMENT CHANGER "q": 0 en "q": 1 (ou 0.5) dès que tu extrais une information valide !
C'EST CRITIQUE POUR LE CALCUL DU SCORE. Si tu laisses "q": 0 alors qu'il y a une valeur, le score sera de 0.

FORMAT DE SORTIE JSON OBLIGATOIRE (Strictement "AYO-EXTRACT-3.0") :
{
  "version": "AYO-EXTRACT-3.0",
  "source": { "url": "${urlToScan}", "scan": {} },
  "fields": {
    "identite": {
      "name": { "value": "Nom", "q": 0, "evidence": [] },
      "legal_name": { "value": "", "q": 0, "evidence": [] },
      "business_type": { "value": "", "q": 0, "evidence": [] },
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
      "quality_assurance": { "value": [], "q": 0, "evidence": [] }
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
      "pricing_level": { "value": "", "q": 0, "evidence": [] },
      "access_mode": { "value": "", "q": 0, "evidence": [] },
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
        "contextual_relevance": { "value": [], "q": 0, "evidence": [] },
        "selection_conditions": { "value": { "required": [], "exclusion": [] }, "q": 0, "evidence": [] },
        "ai_simulation": { "value": [], "q": 0, "evidence": [] }
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
TITRE: ${sanitizeForPrompt(scanResult.metaTitle || '', 200)}
DESC: ${sanitizeForPrompt(scanResult.metaDescription || '', 500)}
H1: ${sanitizeForPrompt(scanResult.h1?.join(', ') || '', 300)}
TEXTE BRUT :
"""
${sanitizeForPrompt(scanResult.text || '', 15000)}
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
                            { role: 'user', content: "Extract JSON now. N'oublie pas de mettre q=1 si l'information est trouvée, particulièrement depuis le USER CONTEXT." },
                            { role: 'user', content: `USER CONTEXT (ANSWERS TO QUESTIONNAIRE) - PRIORITIZE THIS INFO AND SET q=1:\n"${userAnswersContext}"` }
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
                            },
                            external_context: {
                                ecosystem_presence: { value: [], q: 0 },
                                reputation_signals: { value: false, q: 0 },
                                keywords: { value: [], q: 0 },
                                intents: { value: [], q: 0 },
                                channels: { value: [], q: 0 },
                                permissions: { value: [], q: 0 }
                            }
                        }
                    });
                }

                // Mock object to match previous variable name logic (so next lines work)
                const extractionResult = { text: extractionResultText };

                let extractJson: AyoExtract;
                try {
                    // Parse JSON output recursively finding the first {
                    let jsonText = extractionResult.text;
                    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        jsonText = jsonMatch[0];
                    }
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

                // 2a. POST-LLM SANITIZATION — Délégué à l'agent Contrôle Qualité
                // Nettoie les placeholders de template et les phrases de confirmation copiées comme valeurs
                if (extractJson?.fields) {
                    const sanitizeLogs = sanitizeLlmFields(extractJson.fields);
                    for (const log of sanitizeLogs) {
                        const tag = log.reason === 'confirmation_phrase' ? 'CONFIRMATION_SANITIZE' : 'TEMPLATE_SANITIZE';
                        logger.info(tag, `${log.field}: ${log.reason}${log.originalValue ? ` (was: "${String(log.originalValue).substring(0, 50)}")` : ''}`);
                    }
                }

                // 2b. POST-LLM VALIDATION — Délégué à l'agent Contrôle Qualité
                // Downgrade les q-values quand les règles métier ne sont pas respectées
                if (extractJson?.fields) {
                    const downgradeLogs = downgradeFieldQuality(extractJson.fields);
                    for (const log of downgradeLogs) {
                        logger.info('Q_DOWNGRADE', `${log.field}: ${log.reason}`);
                    }
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

                // 4. COMPUTE DETERMINISTIC SCORE (Bible 7-bloc engine + semantic validation via Analyste)
                logger.info('FINAL_SCORE_COMPUTE', `Computing deterministic AIO score for ${urlToScan}`);
                const scoreResult = analyseScore(extractJson);
                logger.info('FINAL_SCORE_RESULT', `Final score: ${scoreResult.total}/100`, {
                    blocks: scoreResult.blocks,
                    capApplied: scoreResult.capApplied,
                    capReason: scoreResult.capReason,
                    rawTotal: scoreResult.rawTotal,
                });

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


                // 🔄 INJECT SCAN_STATE DATA: Enrich extractJson with detected values from scan
                // The LLM extraction often misses fields like business_type, contact_email, keywords, intents
                // The scan_state has these from the initial scan — inject them if missing in extractJson
                try {
                    const scanState = await db.getScanState(urlToScan);
                    if (scanState?.detected) {
                        const fields = extractJson.fields as any;
                        for (const [key, val] of Object.entries(scanState.detected)) {
                            const [bloc, field] = key.split('.');
                            if (!bloc || !field || !fields[bloc]) continue;
                            // Inject if field is empty OR if scan value is longer (LLM often truncates)
                            const existing = fields[bloc][field];
                            const isEmpty = !existing || existing.value === '' || existing.value === null ||
                                (Array.isArray(existing.value) && existing.value.length === 0);
                            const scanValStr = typeof val === 'string' ? val : '';
                            const existingStr = typeof existing?.value === 'string' ? existing.value : '';
                            const isScanLonger = scanValStr.length > existingStr.length + 5; // scan has significantly more data
                            if ((isEmpty || isScanLonger) && val) {
                                const conf = scanState.confidence?.[key] || 0;
                                fields[bloc][field] = { value: val, q: conf >= 70 ? 1 : conf >= 40 ? 0.5 : 0, evidence: ["scan_detected"] };
                                console.log(`🔄 INJECT from scan_state: ${key} = ${String(val).substring(0, 60)}`);
                            }
                        }
                    }
                } catch (scanErr) {
                    console.warn('⚠️ scan_state injection failed:', scanErr instanceof Error ? scanErr.message : scanErr);
                }

                // 🔄 INJECT QUESTIONNAIRE ANSWERS: Recover answers from intermediate saves
                // If the LLM extraction missed user-provided data, the progressive saves have it
                try {
                    const existingAnalysis = await db.getAnalysis(sessionAsrId);
                    const savedAnswers = existingAnalysis?.data?.questionnaire_answers;
                    if (savedAnswers && typeof savedAnswers === 'object') {
                        const fields = extractJson.fields as any;
                        // Map question IDs to field paths
                        // BUG FIX: Map ALL possible question ID formats to field paths:
                        // - q_bloc_field (LLM-generated)
                        // - validation_bloc_field (buildValidationQuestion-generated)
                        // - bloc_field (direct field reference from deterministic fallback)
                        const QUESTION_TO_FIELD: Record<string, string> = {};
                        const FIELD_ENTRIES: [string, string][] = [
                            ['identite_contact_email', 'identite.contact_email'],
                            ['identite_contact_phone', 'identite.contact_phone'],
                            ['identite_legal_name', 'identite.legal_name'],
                            ['identite_city', 'identite.city'],
                            ['identite_country', 'identite.country'],
                            ['identite_name', 'identite.name'],
                            ['identite_business_type', 'identite.business_type'],
                            ['offre_services', 'offre.services'],
                            ['offre_products', 'offre.products'],
                            ['offre_target_audience', 'offre.target_audience'],
                            ['offre_pricing_indication', 'offre.pricing_indication'],
                            ['offre_use_cases', 'offre.use_cases'],
                            ['processus_methodes_process_steps', 'processus_methodes.process_steps'],
                            ['processus_methodes_delivery_mode', 'processus_methodes.delivery_mode'],
                            ['processus_methodes_geographies_served', 'processus_methodes.geographies_served'],
                            ['processus_methodes_quality_assurance', 'processus_methodes.quality_assurance'],
                            ['engagements_conformite_certifications', 'engagements_conformite.certifications'],
                            ['engagements_conformite_frameworks', 'engagements_conformite.frameworks'],
                            ['engagements_conformite_policies', 'engagements_conformite.policies'],
                            ['engagements_conformite_security_measures', 'engagements_conformite.security_measures'],
                            ['indicateurs_key_indicators', 'indicateurs.key_indicators'],
                            ['indicateurs_last_review_date', 'indicateurs.last_review_date'],
                            ['contenus_pedagogiques_has_faq', 'contenus_pedagogiques.has_faq'],
                            ['contenus_pedagogiques_has_glossary', 'contenus_pedagogiques.has_glossary'],
                            ['contenus_pedagogiques_has_documentation', 'contenus_pedagogiques.has_documentation'],
                            ['external_context_keywords', 'external_context.keywords'],
                            ['external_context_intents', 'external_context.intents'],
                            ['external_context_channels', 'external_context.channels'],
                        ];
                        for (const [suffix, fieldPath] of FIELD_ENTRIES) {
                            QUESTION_TO_FIELD[`q_${suffix}`] = fieldPath;           // q_identite_contact_email
                            QUESTION_TO_FIELD[`validation_${suffix}`] = fieldPath;   // validation_identite_contact_email
                            QUESTION_TO_FIELD[suffix] = fieldPath;                   // identite_contact_email (fallback)
                        }

                        let injectedCount = 0;
                        for (const [qId, answer] of Object.entries(savedAnswers)) {
                            const fieldPath = QUESTION_TO_FIELD[qId];
                            if (!fieldPath || !answer || typeof answer !== 'string') continue;
                            // Skip confirmation-only answers
                            if (answer.match(/^(oui|non|ok|exact|parfait|je confirme|c'est bon)$/i)) continue;

                            const [bloc, field] = fieldPath.split('.');
                            if (!bloc || !field || !fields[bloc]) continue;

                            const existing = fields[bloc][field];
                            const isEmpty = !existing || existing.value === '' || existing.value === null ||
                                (Array.isArray(existing.value) && existing.value.length === 0) ||
                                (existing.q === 0);

                            if (isEmpty) {
                                fields[bloc][field] = { value: answer, q: 1, evidence: ["questionnaire_answer"] };
                                console.log(`🔄 INJECT from questionnaire: ${fieldPath} = ${answer.substring(0, 60)}`);
                                injectedCount++;
                            }
                        }
                        if (injectedCount > 0) {
                            console.log(`✅ Injected ${injectedCount} questionnaire answers into extract`);
                        }
                    }
                } catch (qaErr) {
                    console.warn('⚠️ Questionnaire answers injection failed:', qaErr instanceof Error ? qaErr.message : qaErr);
                }

                // 4c. RECOMPUTE SCORE after all injections (scan_state + questionnaire answers)
                // The initial scoreResult was computed before injections, so we need to recalculate
                const enrichedScoreResult = analyseScore(extractJson);
                logger.info('ENRICHED_SCORE_RESULT', `Enriched score after injections: ${enrichedScoreResult.total}/100 (was ${scoreResult.total}/100)`, {
                    blocks: enrichedScoreResult.blocks,
                    capApplied: enrichedScoreResult.capApplied,
                });
                // Use enriched score for display and save
                Object.assign(scoreResult, enrichedScoreResult);
                // Update structured analysis with recomputed audit
                structuredAnalysis = enrichedScoreResult.audit || structuredAnalysis;

                // 📎 FINAL EVIDENCE LINKS: Extract all URLs from user answers as proof evidence
                const finalEvidenceLinks: Record<string, { field: string; url: string; timestamp: string }[]> = {};
                const finalUrlRegex = /https?:\/\/[^\s,)"'<>]+/gi;
                const allUserMsgs = messages.filter((m: any) => m.role === 'user');
                for (const msg of allUserMsgs) {
                    const content = (msg as any).content || '';
                    const foundUrls = content.match(finalUrlRegex);
                    if (foundUrls) {
                        for (const url of foundUrls) {
                            // Skip the original scanned URL
                            if (url === urlToScan) continue;
                            if (!finalEvidenceLinks['user_provided']) {
                                finalEvidenceLinks['user_provided'] = [];
                            }
                            finalEvidenceLinks['user_provided'].push({
                                field: 'user_provided',
                                url,
                                timestamp: new Date().toISOString(),
                            });
                        }
                    }
                }
                const hasAnyEvidence = Object.keys(finalEvidenceLinks).length > 0;

                //💾 SAVE COMPLETE ANALYSIS TO DB (Source of Truth for Webhook)
                logger.info('FINAL_SAVE_START', `Saving final analysis: ${sessionAsrId}, Score: ${scoreResult.total}`);
                try {
                    await db.saveAnalysis(sessionAsrId, {
                        id: sessionAsrId,
                        url: urlToScan,
                        email: null, // Will be updated when user provides email
                        score: scoreResult.total,
                        data: {
                            fields: extractJson.fields,
                            blocks: scoreResult.blocks,
                            scan: scanResult,
                            analysis_blocks: structuredAnalysis, // <--- NEW STRUCTURED DATA
                            ...(hasAnyEvidence ? { evidence_links: finalEvidenceLinks } : {}),
                        }
                    });
                    logger.info('FINAL_SAVE_OK', `Analysis saved: ${sessionAsrId}`);

                } catch (dbErr: unknown) {
                    const dbErrMsg = dbErr instanceof Error ? dbErr.message : 'Unknown DB error';
                    logger.error('FINAL_SAVE_ERROR', dbErrMsg);
                }

                // 5. BUILD FINAL RESPONSE TEXT (via Agent Architecte)
                // L'Architecte analyse les lacunes et génère des recommandations personnalisées
                const architecteRecommendations = buildStructureRecommendations(extractJson, scoreResult);
                const architecteText = formatRecommendationsForChat(architecteRecommendations);
                logger.info('ARCHITECTE_RECOMMENDATIONS', `Architecte: ${architecteRecommendations.recommendations.length} recs, gain estimé +${architecteRecommendations.estimatedScoreGain}pts`, {
                    criticalFiles: architecteRecommendations.recommendations.filter(r => r.priority === 1).length,
                    estimatedGain: architecteRecommendations.estimatedScoreGain,
                });

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
${scoreResult.capApplied ? `\n⚠️ **Plafond appliqué** : ${scoreResult.capReason} (score brut : ${scoreResult.rawTotal}/100)` : ''}

🔒 RÉSULTAT DÉTAILLÉ VERROUILLÉ
(Les explications critiques et les correctifs ont été générés mais sont masqués).
|||
${architecteText}
|||
${JSON.stringify({
                        type: "question_block",
                        intro: `💡 **PROCHAINE ÉTAPE** :
${architecteRecommendations.summary}

Choisissez votre niveau de certification :`,
                        questions: [{
                            id: "pack_intention",
                            text: "Sélectionnez votre Pack pour activer votre recommandation :",
                            options: ["🔄 Abonnement AYA — 19 CHF/mois", "🚀 Pack PRO — 499 CHF (Propriété)"],
                            allowCustom: false,
                            allowMultiple: false
                        }]
                    })}`;


            } catch (err: unknown) {
                const errMsg = err instanceof Error ? err.message : 'Unknown error';
                logger.critical('FINAL_ANALYSIS_ERROR', errMsg, { stack: err instanceof Error ? err.stack : undefined });
                finalResponseText = `⚠️ Une erreur est survenue lors de la finalisation de l'analyse.

Veuillez réessayer ou contacter hello@ai-visionary.com.`;
            }
        } else if (!finalResponseText) {
            // 🎯 PACK SELECTION & SALES FUNNEL LOGIC
            const userContent = lastMessage.content.trim().toLowerCase();
            // Email capture — délégué à l'agent Contrôle Qualité
            const emailMatch = userContent.match(QC_EMAIL_CAPTURE_REGEX);

            logger.info('SALES_FUNNEL', `User content: ${userContent.substring(0, 100)}`);

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

**Vos 5 fichiers PRO :**
- 👑 **ASR-Protocol.json** → Contexte & critères IA avancés (signé).
- ⚙️ **manifest.json** → Politique de recommandation stricte.
- 💬 **faq.json** → Réponses contextuelles pour LLMs.
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
                    // Vérifie que le message n'est pas un email pur — délégué à l'agent Contrôle Qualité
                    const isMsgEmail = isStrictEmail(m.content);
                    return m.role === 'user' && m.content.match(historyUrlRegex) && !isMsgEmail;
                });

                let detectedUrl = "";
                if (historyUrlMatchMsg) {
                    const match = historyUrlMatchMsg.content.match(historyUrlRegex);
                    if (match) detectedUrl = match[0];
                    if (detectedUrl && !detectedUrl.startsWith('http')) detectedUrl = 'https://' + detectedUrl;
                }

                // 🔥 CRITICAL FIX: Ensure the analysis document has BOTH email AND enriched data
                // Problem: sessionAsrId may differ from the one used during INITIAL_SCAN/FINAL_ANALYSIS
                // Solution: Look for existing analysis by URL with real data, and use its ID or copy its data
                try {
                    // First check if current sessionAsrId document already has data
                    const currentDoc = await db.getAnalysis(sessionAsrId);
                    const hasData = currentDoc && (currentDoc.score > 0 || (currentDoc.data?.fields && Object.keys(currentDoc.data.fields).some((k: string) => currentDoc.data.fields[k] && Object.keys(currentDoc.data.fields[k]).length > 0)));

                    if (hasData) {
                        // Good — just add the email
                        await db.saveAnalysis(sessionAsrId, { email: userEmail, url: detectedUrl || undefined } as any);
                        console.log(`💾 ANALYSIS UPDATED WITH EMAIL: ${userEmail} (Session: ${sessionAsrId}, has data ✅)`);
                    } else {
                        // Current doc has no enriched data — find the real one by URL
                        let realAnalysis = null;
                        if (detectedUrl) {
                            realAnalysis = await db.getLatestAnalysisByUrl(detectedUrl);
                        }
                        if (realAnalysis && realAnalysis.score > 0 && realAnalysis.id) {
                            // Found the enriched analysis under a different ID — switch to it
                            console.log(`🔄 SWITCHING SESSION ID: ${sessionAsrId} → ${realAnalysis.id} (has score ${realAnalysis.score})`);
                            sessionAsrId = realAnalysis.id;
                            await db.saveAnalysis(sessionAsrId, { email: userEmail } as any);
                            console.log(`💾 REAL ANALYSIS UPDATED WITH EMAIL: ${userEmail} (Session: ${sessionAsrId})`);
                        } else {
                            // No enriched analysis found — save email anyway (webhook will fallback to scan_state)
                            await db.saveAnalysis(sessionAsrId, { email: userEmail, url: detectedUrl || undefined } as any);
                            console.warn(`⚠️ NO ENRICHED ANALYSIS FOUND BY URL. Email saved to empty doc: ${sessionAsrId}`);
                        }
                    }
                } catch (dbUpdateErr) {
                    console.error(`❌ Failed to update analysis with email:`, dbUpdateErr);
                }

                // Identify plan from context
                const lastAssistantMsg = messages[messages.length - 2]?.content || "";
                let selectedPlan = "AYA_SUB"; // Default to sub if unsure
                if (lastAssistantMsg.includes("PRO") || lastAssistantMsg.includes("499")) selectedPlan = "PRO";

                console.log(`🎯 TARGET PLAN: ${selectedPlan}`);

                // Generate Redirect Link (via Vendeur agent)
                const clientRef = encodeClientReference({
                    url: detectedUrl || "unknown",
                    email: userEmail,
                    analysisId: sessionAsrId,
                });
                const stripeSuffix = `?client_reference_id=${clientRef}&prefilled_email=${encodeURIComponent(userEmail)}`;
                logger.info('STRIPE_LINK', `Stripe link generated with aid=${sessionAsrId}, email=${userEmail}`);

                const actionLink = selectedPlan === "PRO"
                    ? `${STRIPE_LINKS.PRO}${stripeSuffix}`
                    : `${STRIPE_LINKS.AYA_SUB}${stripeSuffix}`;

                if (selectedPlan === "PRO") {
                    finalResponseText = `✅ **Email enregistré.**

🚀 **Finaliser mon PACK PRO - Propriété (499 CHF)**

**Vos 5 fichiers PRO :**
👑 **ASR-Protocol.json** (signé)
⚙️ **manifest.json**
💬 **faq.json**
📖 **glossary.json**
🌐 **external_context.json**
📜 + **3 Ans de Registre AYA** inclus

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

        // 🏷️ INJECT SESSION ID MARKER into response (so subsequent calls can recover it)
        if (finalResponseText && sessionAsrId) {
            const sidMarker = `[AYO_SID:${sessionAsrId}]`;
            if (!finalResponseText.includes(sidMarker)) {
                try {
                    const parsed = JSON.parse(finalResponseText);
                    if (!parsed._sid) {
                        parsed._sid = sessionAsrId;
                        if (parsed.intro && !parsed.intro.includes('AYO_SID')) {
                            parsed.intro += `\n${sidMarker}`;
                        }
                        finalResponseText = JSON.stringify(parsed);
                    }
                } catch {
                    // Not JSON — append as text
                    finalResponseText += `\n${sidMarker}`;
                }
            }
        }

        // 🛑 PERFORMANCE OPTIMIZATION (CRITICAL FIX FOR 500 ERRORS)
        // If we already generated a deterministic response (Analysis Phase), return IMMEDIATELY.
        if (isAnalysisRun && finalResponseText) {
            console.log("✅ Returning Deterministic Analysis Result (Skipping secondary LLM call).");
            return new Response(JSON.stringify({ text: finalResponseText }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 🛑 CRITICAL FIX: Return immediately if a response was generated (Sales Tunnel, Analysis, or Questioning)
        if (finalResponseText) {
            console.log("✅ Returning Generated Response (Skipping fallback LLM call). Content start: " + finalResponseText.substring(0, 50));
            return new Response(JSON.stringify({ text: finalResponseText }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Normalize detectedUrl if found
        if (detectedUrl && !detectedUrl.startsWith('http')) {
            detectedUrl = 'https://' + detectedUrl;
        }

        const finalSystemPrompt = getSystemPrompt(sessionAsrId, sessionDate, detectedUrl, detectedEmail);

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


    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('CHAT_FATAL', message, { stack: error instanceof Error ? error.stack : undefined });
        return new Response(JSON.stringify({ error: 'Erreur interne du serveur.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
