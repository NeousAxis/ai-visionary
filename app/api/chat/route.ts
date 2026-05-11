// Force static for reliability? No, dynamic for streaming.
export const dynamic = 'force-dynamic';

import { llmJson, llmText } from '@/lib/llm-provider';
import { sendEmail } from '@/lib/mailer';
import { scanUrlForAioSignals } from '@/lib/aio-scanner';
import { db } from '@/lib/db';
// registerOrUpdateEntity imported on-demand from '@/lib/aya/registry'
import { getSystemPrompt, type Locale } from '@/lib/ayo-system-prompt';
import { createLogger, generateCorrelationId } from '@/lib/logger';
import { sanitizeForPrompt } from '@/lib/sanitize';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import crypto from 'crypto';
import Stripe from 'stripe';

// Multi-Agents imports
import {
    scanStateDocId,
    loadScanState,
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
    buildValidationQuestion,
    buildEnrichmentQuestion,
    TEXT_INPUT_FIELD_NAMES,
    BOOLEAN_FIELD_NAMES,
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
import { classifySite } from '@/lib/site-classifier';
import {
    buildEvidenceQueue,
    buildEvidenceQuestionBlock,
    evaluateEvidence,
    EVIDENCE_TEMPLATES,
} from '@/lib/question-engine';
import type { QuestionContext } from '@/lib/evidence-types';

// V4 Evidence-Based mode (default OFF)
const V4_EVIDENCE_MODE = process.env.AYO_V4_EVIDENCE === 'true';

// Allow streaming responses up to 120 seconds (Vercel Pro supports up to 300s)
// Scoring + Gemini extraction can take 45-90s under load
export const maxDuration = 120;

// SMTP email availability check (mailer handles credentials internally)

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
    let locale: Locale = 'en'; // default EN, overridden by body.locale

    try {
        const body = await req.json();
        const { messages } = body;
        locale = body.locale === 'en' ? 'en' : 'fr';
        const lastMessage = messages[messages.length - 1];
        logger.info('CHAT_START', `New chat request, ${messages.length} messages, locale=${locale}`);


        // LLM provider is selected centrally in lib/llm-provider.ts.
        // Infomaniak AI (Apertus-70B, Swiss-hosted) if INFOMANIAK_AI_TOKEN is set,
        // otherwise falls back to Gemini. All call sites in this file use llmJson/llmText.

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
        const hasFinalScore = assistantMessages.some((m: any) =>
            m.content.includes("SCORE FINAL AIO") ||
            m.content.includes("FINAL AIO SCORE") ||
            m.content.includes("Score Final AIO") ||
            m.content.includes("score final aio") ||
            m.content.includes("SCORE FINAL") ||
            m.content.includes("FINAL SCORE") ||
            m.content.includes("pack_intention") ||
            m.content.includes("confirm_subscription") ||
            m.content.includes("confirm_pro")
        );

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
                if (lower.match(/(débile|inutile|concerne pas|pas envie|sert a rien|non pertinent|stupide|pfff|n'importe quoi|ca me regarde pas|useless|stupid|none of your business|don't care)/)) return false;

                // DETECTION: Why/How/Explain (FR + EN)
                if (lower.match(/^(pourquoi|comment|expli|quel est l'interet|a quoi ca sert|c'est quoi|non je veux dire|attends|why|how|explain|what is the point|what does|wait)/)) return true;
                if (lower.includes('?') && lower.length < 60 && !lower.includes('non') && !lower.includes('oui') && !lower.includes('no') && !lower.includes('yes')) return true;
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
        const isSalesIntent_sm = !!(lowText_sm.match(/(abonnement|pack pro|valider|upgrader|passer en|subscription|subscribe|s'abonner|upgrade|validate|obtenir le|get pro)/));
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
            locale,
        };

        // 🎯 STATE MACHINE: Derive state from conversation signals
        let ayoState = deriveState(conversationSignals);

        // Special case: main_menu with scan in progress → continue questionnaire
        if (lastMessage.content.startsWith("main_menu|") && hasScanInHistory && !hasFinalScore) {
            ayoState = AyoState.QUESTIONNAIRE;
        }

        console.log(`🎯 AYO STATE: ${ayoState} | URL: ${detectedUrl} | Steps: ${stepsCompleted} | HasScan: ${hasScanInHistory}`);

        // V4: Function-scoped variables for evidence-based flow
        let v4Classification: any = null;
        let v4EvidenceQueue: any[] = [];

        // 🛡️ HANDLER: EXISTING_CLIENT (Immediate Recognition)
        // Ensure we are NOT in an OTP flow (send_otp or 6 digits)
        const isOtpFlow = lastMessage.content.startsWith("send_otp") || lastMessage.content.match(/^\d{6}$/);

        if ((ayoState === AyoState.EXISTING_CLIENT || lastMessage.content === "EXISTING_CLIENT") && !isOtpFlow) {
            const ec_url = urlInLastMessage || detectedUrl || "";
            const client = await db.getAyaEntityByUrl(ec_url);

            if (!client) {
                // Fallback if URL lost: Asks user to re-identify or go to home
                return new Response(JSON.stringify({
                    text: locale === 'en'
                        ? `🔒 **Session Expired.**\n\nI cannot find your session URL. Please enter your URL to access your client area.`
                        : `🔒 **Session Expirée.**\n\nJe ne retrouve pas votre URL de session. Veuillez entrer votre URL pour accéder à votre espace client.`,
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
                    text: locale === 'en'
                        ? `🎉 **CONGRATULATIONS! YOU ARE ALREADY AN AYA CLIENT.**\n\nThe entity **${client.display_name || client.legal_name}** is registered and certified in the AYA Registry.\n\nWould you like to:`
                        : `🎉 **BRAVO ! VOUS ÊTES DÉJÀ CLIENT AYA.**\n\nL'entité **${client.display_name || client.legal_name}** est bien enregistrée et certifiée dans le Registre AYA.\n\nSouhaitez-vous :`,
                    buttons: [
                        { label: locale === 'en' ? "Update my profile 🔄" : "Mettre à jour ma fiche 🔄", action: `update_profile|${ec_url}` },
                        { label: locale === 'en' ? "View my certificate 📜" : "Voir mon certificat 📜", action: "view_certificate", url: client.aya_entity_id ? `https://ai-visionary.xyz/aya/e/${client.aya_entity_id}` : undefined },
                        { label: locale === 'en' ? "Manage my subscription ⚙️" : "Gérer mon abonnement ⚙️", action: "manage_subscription" }
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
                text: locale === 'en'
                    ? `🔒 **Security Required**\n\nTo access confidential data for **${detectedUrl}**, I need to verify that you are the administrator.\n\nI can send a temporary code to the known email (**${maskedEmail}**).`
                    : `🔒 **Sécurité Requise**\n\nPour accéder aux données confidentielles de **${detectedUrl}**, je dois vérifier que vous êtes bien l'administrateur.\n\nJe peux envoyer un code temporaire à l'email connu (**${maskedEmail}**).`,
                buttons: [
                    { label: locale === 'en' ? "Send security code 📨" : "Envoyer le code de sécurité 📨", action: `send_otp|${detectedUrl}` },
                    { label: locale === 'en' ? "Cancel" : "Annuler", action: `main_menu|${detectedUrl}` }
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
            // SAFEST: Direct DB/SMTP call here or assume user will type code.

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

                if (!process.env.SMTP_USER) {
                    return new Response(JSON.stringify({ error: 'Email service not configured' }), { status: 500 });
                }
                const { error } = await sendEmail({
                    from: 'AI Visionary Security <security@ai-visionary.xyz>',
                    to: [targetEmail],
                    subject: locale === 'en'
                        ? `🔒 Your security code: ${code}`
                        : `🔒 Votre code de sécurité : ${code}`,
                    html: locale === 'en'
                        ? `
                    <div style="font-family: sans-serif; padding: 20px; color: #333;">
                        <h2>AYO Security Code</h2>
                        <p>Here is your verification code for <strong>${targetUrl}</strong>:</p>
                        <div style="background-color: #f3f4f6; padding: 15px; font-size: 24px; letter-spacing: 5px; font-weight: bold; text-align: center; border-radius: 8px; margin: 20px 0;">
                            ${code}
                        </div>
                        <p style="font-size: 12px; color: #666;">Valid for 10 minutes. Do not share it.</p>
                    </div>
                    `
                        : `
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

                if (error) console.error("Email send error", error);

                return new Response(JSON.stringify({
                    text: locale === 'en'
                        ? `✅ **Code Sent!**\n\nPlease check the mailbox **${targetEmail.substring(0, 3)}***@...**\n\n👉 **Enter the 6-digit code below:**`
                        : `✅ **Code Envoyé !**\n\nVeuillez consulter la boîte mail **${targetEmail.substring(0, 3)}***@...**\n\n👉 **Entrez le code à 6 chiffres ci-dessous :**`,
                    buttons: []
                }), { status: 200, headers: { 'Content-Type': 'application/json' } });

            } else {
                console.error(`❌ OTP Error: No email found for ${targetUrl}`);
                return new Response(JSON.stringify({
                    text: locale === 'en'
                        ? `❌ **Error:** No administrator email found for this site.\n\nWe cannot verify your identity automatically.`
                        : `❌ **Erreur :** Aucun email administrateur trouvé pour ce site.\n\nNous ne pouvons pas vérifier votre identité automatiquement.`,
                    buttons: [{ label: locale === 'en' ? "Contact Support 📧" : "Contacter le Support 📧", url: locale === 'en' ? "mailto:hello@ai-visionary.xyz?subject=OTP Authentication Issue" : "mailto:hello@ai-visionary.xyz?subject=Problème Authentification OTP" }]
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
                            return_url: `https://ai-visionary.xyz`,
                        });
                        successUrl = session.url;
                    }

                    return new Response(JSON.stringify({
                        text: locale === 'en'
                            ? `🔓 **Identity Confirmed.**\n\nYou now have temporary secure access to your management area.`
                            : `🔓 **Identité Confirmée.**\n\nVous avez maintenant un accès sécurisé temporaire à votre espace de gestion.`,
                        buttons: [
                            { label: locale === 'en' ? "Access Client Portal 🔒" : "Accéder au Portail Client 🔒", url: successUrl },
                            { label: locale === 'en' ? "Update my profile 🔄" : "Mettre à jour ma fiche 🔄", action: `update_profile|${detectedUrl}` },
                            { label: locale === 'en' ? "Back to Menu" : "Retour Menu", action: `main_menu|${detectedUrl}` }
                        ]
                    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

                } else {
                    return new Response(JSON.stringify({
                        text: locale === 'en'
                            ? `⛔ **Incorrect or Expired Code.**\n\nPlease try again or request a new code.`
                            : `⛔ **Code Incorrect ou Expiré.**\n\nVeuillez réessayer ou demander un nouveau code.`,
                        buttons: [
                            { label: locale === 'en' ? "Resend a code 📨" : "Renvoyer un code 📨", action: `send_otp|${detectedUrl}` }
                        ]
                    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
                }
            }
        }

        // 🛡️ HANDLER: PEDAGOGICAL (TRUTH & CONSISTENCY)
        // GUARD: Only trigger when NOT in active questionnaire to prevent hijacking mid-interview
        if (!hasScanInHistory && lowText.match(/(men[st]|mentir|fausse|fake|triche|vérité|honnête|lying|cheat|truth|honest)/)) {
            return new Response(JSON.stringify({
                text: locale === 'en'
                    ? `💡 **Excellent question.**\n\nTechnically, if you lie, AYO will generate your ASR file with the provided information (so your technical certification will be valid).\n\n⚠️ **BUT this is a dangerous strategy.**\nAIs (ChatGPT, Gemini) work through **Evidence Cross-Referencing**:\n\n1. They read your **Declaration (ASR)**.\n2. They compare it to your **Observable Reality** (Website, Reviews, Databases).\n\nIf there is a contradiction (e.g.: you declare "World Leader" but your site is empty), the AI will detect a **Critical Inconsistency**.\n\n🛑 **Result:** Instead of being recommended, you will be classified as an "Unreliable Source" (Probable Hallucination). AYO is designed to structure your truth, not to fabricate it.`
                    : `💡 **Excellente question.**\n\nTechniquement, si vous mentez, AYO génèrera votre fichier ASR avec les informations fournies (donc votre certification technique sera valide).\n\n⚠️ **MAIS c'est une stratégie dangereuse.**\nLes IA (ChatGPT, Gemini) fonctionnent par **Recoupement de Preuves** :\n\n1. Elles lisent votre **Déclaration (ASR)**.\n2. Elles la comparent à votre **Réalité Observable** (Site Web, Avis, Base de données).\n\nS'il y a contradiction (ex: vous déclarez "Leader Mondial" mais votre site est vide), l'IA détectera une **Incohérence Critique**.\n\n🛑 **Résultat :** Au lieu d'être recommandé, vous serez classé comme "Source Non Fiable" (Hallucination Probable). AYO sert à structurer votre vérité, pas à la fabriquer.`,
                buttons: [
                    { label: locale === 'en' ? "Understood, let's continue ✅" : "Bien compris, continuons ✅", action: `main_menu|${detectedUrl}` }
                ]
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // 🛡️ CRITICAL INTELLIGENT ROUTING: CERTIFICATE VIEW
        if (lowText.includes("view_certificate") || lowText.includes("voir mon certificat") || lowText.includes("mon certificat") || lowText.includes("my certificate") || lowText.includes("view certificate")) {
            return new Response(JSON.stringify({
                text: locale === 'en'
                    ? `📜 **Your AIO Compliance Certificate**\n\nYour certificate is publicly accessible at the following address:\n👉 **[View my Official Certificate](https://ai-visionary.xyz/aya)**\n\nIt certifies your AI-compatible data structure.`
                    : `📜 **Votre Certificat AIO Compliance**\n\nVotre certificat est accessible publiquement à l'adresse suivante :\n👉 **[Voir mon Certificat Officiel](https://ai-visionary.xyz/aya)**\n\nIl atteste de votre structure de donnée compatible IA.`,
                buttons: [{ label: locale === 'en' ? "Back" : "Retour", action: "back" }]
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
            lowText.includes("passer en") || lowText.includes("upgrader") ||
            lowText.includes("subscription") || lowText.includes("upgrade") ||
            lowText.includes("validate") || lowText.includes("confirm"))) {
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
                finalResponseText = locale === 'en'
                    ? `❌ **Site Not Found**\n\nUnable to access **${urlToScan}**.\n\n**Possible causes:**\n- The domain does not exist\n- The site is offline\n- The URL is malformed\n\nPlease check the URL and try again.`
                    : `❌ **Site Introuvable**\n\nImpossible d'accéder à **${urlToScan}**.\n\n**Causes possibles :**\n- Le domaine n'existe pas\n- Le site est hors ligne\n- L'URL est mal formatée\n\nVeuillez vérifier l'URL et réessayer.`;
                return new Response(JSON.stringify({ text: finalResponseText }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            logger.info('URL_VALIDATE', `URL validated: ${urlToScan}`);

            // 1. DEEP SCAN to get ALL possible data
            console.log(`📡 Deep scanning ${urlToScan}...`);
            const deepScanResult = await scanUrlForAioSignals(urlToScan);

            // V4: Classify site type if evidence mode is enabled
            if (V4_EVIDENCE_MODE && deepScanResult.isReachable) {
                v4Classification = classifySite(deepScanResult);
                console.log(`🏷️ V4 Site Classification: ${v4Classification.type} (confidence: ${v4Classification.confidence})`);
            }

            // 2. ATTEMPT TO ANSWER the 25 critical questions via LLM extraction
            const EXTRACTION_ATTEMPT_PROMPT = locale === 'en' ? `
You are AYO. You just scanned the site: ${urlToScan}

SCAN DATA:
- Title: "${sanitizeForPrompt(deepScanResult.metaTitle || 'Not detected', 200)}"
- Description: "${sanitizeForPrompt(deepScanResult.metaDescription || 'Not detected', 500)}"
- H1: ${sanitizeForPrompt(deepScanResult.h1?.join(', ') || 'None', 300)}
- JSON-LD: ${deepScanResult.hasJsonLd ? 'YES' : 'NO'}
- Extracted text: "${sanitizeForPrompt(deepScanResult.text || 'Empty', 15000)}"

YOU ARE AN EXPERT IN WEB DATA EXTRACTION.

CONFIDENCE STRATEGY (ANTI-BULLSHIT FILTER):

1. **HIGH CONFIDENCE = TECHNICAL & LEGAL FACTS**
   You trust 100% (confidence: "high") IF AND ONLY IF the information is FACTUAL, TECHNICAL or LEGAL, even in plain text.
   - Examples: "Creative Commons License", "VAT ID...", "Price: $0", "Free", "Tel: +1...", "Address: New York".
   - Examples: "LLC", "Inc.", "Copyright 2024".
   - WHY: These are enforceable commitments, not marketing fluff.

2. **LOW CONFIDENCE = MARKETING PROMISES & VAGUE CLAIMS**
   You systematically doubt (confidence: "low") if the information is a SUBJECTIVE CLAIM, a PROMISE or a GENERIC SEO KEYWORD.
   - Examples: "World leader", "Innovative solution", "Best service", "Unique expertise".
   - Examples: A list of keywords without context ("AI, Blockchain, Crypto...").
   - WHY: This is often SEO "noise" that needs human validation.

3. **UNKNOWN (unknown)**: Information completely not found.

CRITICAL TERMINOLOGY:
ASR = "AI Singular Record" (NEVER "AYO Singular Record"). AYO is the AI assistant name, ASR is the file name.

YOUR MISSION:
Try to answer the 25 critical questions to build an ASR.

THE 25 CRITICAL QUESTIONS:
1. Exact name (Commercial identity)
2. Country of establishment (Main location)
3. Legal name (Registered name, company ID)
4. Business type (Precise sector)
5. City of headquarters
6. Public contact email
7. Contact phone
8. Target audience (B2B, B2C, Government)
9. List of services
10. List of products (physical or digital)
11. Pricing (REAL AMOUNTS with currency, e.g.: "19 CHF/month", "499 CHF one-shot", "from $50/h". ALWAYS include numbers, currency and frequency. NEVER respond only with categories like "Subscription" or "Fixed price".)
12. Use cases (Why do people look for you? User intents)
13. Methodology (Process, support steps)
14. Delivery mode (Online, on-site, hybrid, workshops, training)
15. Geographic area served
16. Trust signals (Reviews, Guarantees, Quality)
17. Certifications (Labels, Diplomas, Certs)
18. Networks & federations (Trade associations, professional organizations)
19. Security measures (Privacy, GDPR)
20. Policies (Terms & conditions links or legal mentions)
21. Success indicators (KPIs: Number of clients, tons CO2, revenue, measurable results)
22. Last update date (Data freshness)
23. Educational materials (White papers, FAQ, Platform, Documentation) — WARNING: do not confuse marketing EXAMPLES or illustrations (e.g.: "When a user asks 'Emergency plumber NYC'...") with real documentation. An example cited to illustrate a concept IS NOT documentation. Look for REAL guides, tutorials, white papers, "How to..." pages
24. Search keywords (How your customers find you)
25. Typical search intents (Queries your customers type on Google/AI)

CRITICAL PRICING RULE (question 11):
- Look for AMOUNTS in numbers in the extracted text (e.g.: "19 CHF", "499€", "$99/month").
- ALWAYS include amount + currency + frequency.
- NEVER return only categories without associated amounts.
- Look for prices in ALL visible text on the page.
- If amounts are visible on the page, confidence = "high".

EXPECTED JSON FORMAT:
{
  "answers": [
    {"question_id": 1, "answer": "Your answer or null", "confidence": "high|low|unknown"},
    {"question_id": 2, "answer": "...", "confidence": "..."},
    ...
    {"question_id": 25, "answer": "...", "confidence": "..."}
  ]
}

GENERATE THIS JSON NOW:
` : `
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

            // Parse extraction result
            let extractedAnswers: any[] = [];
            try {
                const extractionResult = await Promise.race([
                    llmJson({
                        temperature: 0.1,
                        system: EXTRACTION_ATTEMPT_PROMPT,
                        messages: [{ role: 'user', content: locale === 'en' ? `Extract the answers from the scan of ${urlToScan}` : `Extrait les réponses du scan de ${urlToScan}` }],
                        abortSignal: AbortSignal.timeout(50000),
                    }),
                    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('EXTRACTION_TIMEOUT')), 50000))
                ]);

                const jsonMatch = extractionResult.text.match(/\{[\s\S]*"answers"[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    extractedAnswers = parsed.answers || [];
                }
            } catch (e) {
                console.warn("⚠️ LLM extraction timeout/failure at scan phase. Continuing with empty answers.", e);
                // FALLBACK: Continue with empty extractedAnswers — the questionnaire
                // flow will collect answers directly from the user instead.
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

            const questionLabels = locale === 'en' ? [
                // Identity (7)
                "Name", "Country", "Legal name", "Sector", "City", "Email", "Phone",
                // Offer (5)
                "Audience", "Services", "Products", "Pricing", "Use cases",
                // Processes (4)
                "Methodology", "Delivery mode", "Service area", "Quality",
                // Compliance (4)
                "Certifications", "Networks & federations", "Security", "Policies",
                // Indicators (2)
                "Indicators", "Last update",
                // Educational (3)
                "FAQ", "Glossary", "Documentation",
                // External context (2)
                "Keywords", "Search intents"
            ] : [
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

                    if (conf >= 70) {
                        // Threshold lowered from 90 to 70 (29 mars 2026)
                        // Data with confidence >= 70 is auto-validated (no Yes/No question)
                        // Rollback: change back to >= 90 for HIGH, add >= 70 for LOW
                        scanState.high_confidence_keys.push(key);
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
            // Helper: normalize detected value to array (scan returns strings, scoring expects arrays)
            const toArray = (val: any): string[] => {
                if (!val) return [];
                if (Array.isArray(val)) return val;
                if (typeof val === 'string') return val.split(/[,;]\s*/).map((s: string) => s.trim()).filter(Boolean);
                return [String(val)];
            };
            const toVal = (field: string) => scanState.detected?.[field] || '';
            const qOf = (field: string) => scanState.confidence?.[field] >= 70 ? 1 : scanState.confidence?.[field] > 0 ? 0.5 : 0;

            // V4: Set products na=true for non-e-commerce sites (service companies don't have "products")
            const isEcommerce = v4Classification?.type === 'e-commerce';

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
                        name: { value: toVal('identite.name'), q: qOf('identite.name'), evidence: [] },
                        legal_name: { value: toVal('identite.legal_name'), q: qOf('identite.legal_name'), evidence: [] },
                        business_type: { value: toVal('identite.business_type'), q: qOf('identite.business_type'), evidence: [] },
                        city: { value: toVal('identite.city'), q: qOf('identite.city'), evidence: [] },
                        country: { value: toVal('identite.country'), q: qOf('identite.country'), evidence: [] },
                        contact_email: { value: toVal('identite.contact_email'), q: qOf('identite.contact_email'), evidence: [] },
                        contact_phone: { value: toVal('identite.contact_phone'), q: qOf('identite.contact_phone'), evidence: [] },
                    },
                    offre: {
                        services: { value: toArray(scanState.detected?.["offre.services"]), q: qOf('offre.services'), evidence: [] },
                        products: isEcommerce
                            ? { value: toArray(scanState.detected?.["offre.products"]), q: qOf('offre.products'), evidence: [] }
                            : { value: [], q: 0, evidence: [], na: true },  // Service company → products not applicable
                        use_cases: { value: toArray(scanState.detected?.["offre.use_cases"]), q: qOf('offre.use_cases'), evidence: [] },
                        target_audience: { value: toVal('offre.target_audience'), q: qOf('offre.target_audience'), evidence: [] },
                        pricing_indication: { value: toVal('offre.pricing_indication'), q: qOf('offre.pricing_indication'), evidence: [] },
                    },
                    processus_methodes: {
                        process_steps: { value: toArray(scanState.detected?.["processus_methodes.process_steps"]), q: qOf('processus_methodes.process_steps'), evidence: [] },
                        delivery_mode: { value: toVal('processus_methodes.delivery_mode'), q: qOf('processus_methodes.delivery_mode'), evidence: [] },
                        geographies_served: { value: toVal('processus_methodes.geographies_served'), q: qOf('processus_methodes.geographies_served'), evidence: [] },
                        quality_assurance: { value: toVal('processus_methodes.quality_assurance'), q: qOf('processus_methodes.quality_assurance'), evidence: [] },
                    },
                    engagements_conformite: {
                        policies: { value: toArray(scanState.detected?.["engagements_conformite.policies"]), q: qOf('engagements_conformite.policies'), evidence: [] },
                        frameworks: { value: toArray(scanState.detected?.["engagements_conformite.frameworks"]), q: qOf('engagements_conformite.frameworks'), evidence: [] },
                        certifications: { value: toArray(scanState.detected?.["engagements_conformite.certifications"]), q: qOf('engagements_conformite.certifications'), evidence: [] },
                        security_measures: { value: toArray(scanState.detected?.["engagements_conformite.security_measures"]), q: qOf('engagements_conformite.security_measures'), evidence: [] },
                    },
                    indicateurs: {
                        key_indicators: { value: toArray(scanState.detected?.["indicateurs.key_indicators"]), q: qOf('indicateurs.key_indicators'), evidence: [] },
                        last_review_date: { value: toVal('indicateurs.last_review_date'), q: qOf('indicateurs.last_review_date'), evidence: [] },
                    },
                    contenus_pedagogiques: {
                        has_faq: { value: scanState.detected["contenus_pedagogiques.has_faq"] || deepScanResult.hasFaqContent || false, q: scanState.confidence["contenus_pedagogiques.has_faq"] >= 70 ? 1 : (deepScanResult.hasFaqContent ? 1 : (scanState.confidence["contenus_pedagogiques.has_faq"] > 0 ? 0.5 : 0)), evidence: [] },
                        has_glossary: { value: scanState.detected["contenus_pedagogiques.has_glossary"] || false, q: scanState.confidence["contenus_pedagogiques.has_glossary"] >= 70 ? 1 : scanState.confidence["contenus_pedagogiques.has_glossary"] > 0 ? 0.5 : 0, evidence: [] },
                        has_documentation: { value: scanState.detected["contenus_pedagogiques.has_documentation"] || false, q: scanState.confidence["contenus_pedagogiques.has_documentation"] >= 70 ? 1 : scanState.confidence["contenus_pedagogiques.has_documentation"] > 0 ? 0.5 : 0, evidence: [] },
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
                        keywords: { value: scanState.detected["external_context.keywords"] || [], q: scanState.confidence["external_context.keywords"] >= 70 ? 1 : scanState.confidence["external_context.keywords"] > 0 ? 0.5 : 0, evidence: [] },
                        intents: { value: scanState.detected["external_context.intents"] || [], q: scanState.confidence["external_context.intents"] >= 70 ? 1 : scanState.confidence["external_context.intents"] > 0 ? 0.5 : 0, evidence: [] },
                        channels: { value: [], q: 0, evidence: [] },
                        permissions: { value: [], q: 0, evidence: [] },
                    },
                }
            } as AyoExtract;

            // V4: Apply downgrades to initial extract (structured absence, reliability capping)
            if (V4_EVIDENCE_MODE && initialExtract.fields) {
                downgradeFieldQuality(initialExtract.fields as any);
            }

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

            const isEn = locale === 'en';
            let transparencySummary = isEn ? `🛰️ SCAN COMPLETE\n\n` : `🛰️ SCAN TERMINÉ\n\n`;

            if (detectedInfos.length > 0) {
                transparencySummary += isEn
                    ? `✅ ${detectedInfos.length} INFORMATION(S) DETECTED:\n\n`
                    : `✅ ${detectedInfos.length} INFORMATIONS DÉTECTÉES :\n\n`;
                detectedInfos.forEach((info) => {
                    const label = questionLabels[info.question_id - 1] || `Info ${info.question_id}`;
                    let value = info.answer && info.answer !== 'null'
                        ? (info.answer.length > 50 ? info.answer.substring(0, 50) + '...' : info.answer)
                        : (isEn ? 'Detected' : 'Détecté');

                    // Only show "(To validate)" if confidence is truly uncertain
                    // With threshold at 70, LOW confidence fields are auto-validated
                    // so no marker needed (they won't be asked)
                    if (info.confidence !== 'high' && info.confidence !== 'low') {
                        value += isEn ? ' (To validate)' : ' (À valider)';
                    }

                    transparencySummary += `• ${label} : ${value}\n`;
                });
                transparencySummary += `\n`;
            }

            // Add initial 7-bloc score display (from AYO Router formatScoreMessage)
            transparencySummary += formatScoreMessage(initialScore, 'initial', locale) + '\n\n';

            const blockLabelsMap: Record<string, Record<string, string>> = {
                en: { identite: 'Identity & Anchoring', offre: 'Offer Clarity', processus_methodes: 'Processes & Methods', engagements_conformite: 'Trust & Compliance', indicateurs: 'Social Proof & Metrics', contenus_pedagogiques: 'Educational Content', structure_technique: 'AIO Technical Foundation' },
                fr: { identite: 'Identité & Ancrage', offre: 'Clarté de l\'Offre', processus_methodes: 'Processus & Méthodes', engagements_conformite: 'Confiance & Conformité', indicateurs: 'Preuve Sociale & Métriques', contenus_pedagogiques: 'Pédagogie & Supports', structure_technique: 'Socle Technique AIO' },
            };
            const weakBlocks = Object.entries(initialScore.audit || {})
                .filter(([, v]: [string, any]) => v.status === 'error' || v.status === 'warning')
                .map(([k]: [string, any]) => blockLabelsMap[locale]?.[k] || k);

            if (weakBlocks.length > 0) {
                transparencySummary += isEn
                    ? `⚠️ **BLOCKS TO IMPROVE**: ${weakBlocks.join(', ')}\n`
                    : `⚠️ **BLOCS À AMÉLIORER** : ${weakBlocks.join(', ')}\n`;
            }

            if (isEn) {
                transparencySummary += `\n**What this means:**\n`;
                transparencySummary += `Your business has information, but it is not structured in a way that is readable by AIs (ChatGPT, Gemini, Claude...). As a result, these AIs can neither clearly identify you nor recommend you.\n\n`;
                transparencySummary += `**What we will do:**\n`;
                transparencySummary += `I will ask you several targeted questions. Your answers will allow me to create structured files (ASR) that will make your business **readable**, thus **visible**, and consequently **recommendable** by AIs.\n\n`;
                transparencySummary += `➡️ But first...`;
            } else {
                transparencySummary += `\n**Ce que cela signifie :**\n`;
                transparencySummary += `Votre entreprise possède des informations, mais elles ne sont pas structurées de manière lisible par les IA (ChatGPT, Gemini, Claude...). Résultat : ces IA ne peuvent ni vous identifier clairement, ni vous recommander.\n\n`;
                transparencySummary += `**Ce que nous allons faire :**\n`;
                transparencySummary += `Je vais vous poser plusieurs questions ciblées. Vos réponses me permettront de créer des fichiers structurés (ASR) qui rendront votre entreprise **lisible**, donc **visible**, et en conséquence **recommandable** par les IA.\n\n`;
                transparencySummary += `➡️ Mais avant tout...`;
            }

            // 4. First question: Ownership validation
            // Include scan_state in the response for CONTINUE_QUESTIONING to use
            if (missingInfos.length === 0) {
                console.log("🎯 All questions auto-answered! Triggering FINAL_ANALYSIS...");
                finalResponseText = JSON.stringify({
                    type: "question_block",
                    intro: transparencySummary + (isEn ? "\n\n✅ **All information has been collected!**" : "\n\n✅ **Toutes les informations ont été collectées !**"),
                    questions: [{
                        id: "ownership_confirm",
                        text: isEn ? "Do you confirm that this website belongs to you or that you are authorized to analyze it?" : "Confirmez-vous que ce site vous appartient ou que vous êtes autorisé(e) à l'analyser ?",
                        options: isEn ? ["Yes, it's my site", "No"] : ["Oui, c'est mon site", "Non"],
                        allowCustom: false
                    }]
                });
            } else {
                finalResponseText = JSON.stringify({
                    type: "question_block",
                    intro: transparencySummary + (isEn
                        ? `\n\n⚠️ **Important**: AYO is designed to structure your truth, not to fabricate it. AIs verify your declarations through cross-referencing. Any inconsistency would classify you as an "Unreliable Source".`
                        : `\n\n⚠️ **Important** : AYO sert à structurer votre vérité, pas à la fabriquer. Les IA vérifient vos déclarations par recoupement. Toute incohérence vous classerait comme "Source Non Fiable".`),
                    questions: [{
                        id: "ownership_confirm",
                        text: isEn ? "Do you confirm that this website belongs to you and that the data is accurate?" : "Confirmez-vous que ce site vous appartient et que les données sont exactes ?",
                        options: isEn ? ["✅ Yes, it's my site", "No"] : ["✅ Oui, c'est mon site", "Non"],
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
                if (lastUserMsg.includes('non') || lastUserMsg === 'non' || lastUserMsg === 'no') {
                    finalResponseText = locale === 'en'
                        ? `❌ **Analysis interrupted**\n\nI cannot continue this analysis.\n\n**Compliance rule**: Only authorized persons from the analyzed company can run an AYO diagnostic.\n\nIf you think this is an error, please restart a new analysis with the correct URL.`
                        : `❌ **Analyse interrompue**\n\nJe ne peux pas continuer cette analyse.\n\n**Règle de conformité** : Seules les personnes responsables ou autorisées de l'entreprise analysée peuvent réaliser un diagnostic AYO.\n\nSi vous pensez qu'il s'agit d'une erreur, veuillez relancer une nouvelle analyse avec la bonne URL.`;

                    // Return immediately, stop the flow
                    return new Response(JSON.stringify({ text: finalResponseText }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                // If user said YES, continue with WARNING Block instead of questions directly
                console.log("✅ Ownership confirmed. Showing WARNING Block...");

                // NEW BLOCK: Educational Warning before proceeding
                const truthIntro = locale === 'en'
                    ? `💡 **Excellent decision.**

Technically, if you lie, AYO will generate your ASR file with the provided information (so your technical certification will be valid).

⚠️ **BUT this is a dangerous strategy.** AIs (ChatGPT, Gemini) work through **Evidence Cross-Referencing**:
1. They read your Declaration (ASR).
2. They compare it to your Observable Reality (Website, Reviews).
3. If there is a contradiction (e.g.: you declare "World Leader" but your site is empty), the AI will detect a **Critical Inconsistency**.

🛑 **Result:** Instead of being recommended, you will be classified as an "Unreliable Source" (Probable Hallucination). AYO is designed to structure your truth, not to fabricate it.`
                    : `💡 **Excellente décision.**

Techniquement, si vous mentez, AYO génèrera votre fichier ASR avec les informations fournies (donc votre certification technique sera valide).

⚠️ **MAIS c'est une stratégie dangereuse.** Les IA (ChatGPT, Gemini) fonctionnent par **Recoupement de Preuves** :
1. Elles lisent votre Déclaration (ASR).
2. Elles la comparent à votre Réalité Observable (Site Web, Avis).
3. S'il y a contradiction (ex: vous déclarez "Leader Mondial" mais votre site est vide), l'IA détectera une **Incohérence Critique**.

🛑 **Résultat :** Au lieu d'être recommandé, vous serez classé comme "Source Non Fiable" (Hallucination Probable). AYO sert à structurer votre vérité, pas à la fabriquer.`;

                finalResponseText = JSON.stringify({
                    type: "question_block",
                    intro: truthIntro,
                    questions: [{
                        id: "truth_confirmation",
                        text: locale === 'en' ? "Do you understand the importance of declaring accurate information?" : "Avez-vous bien compris l'importance de déclarer des informations exactes ?",
                        options: locale === 'en' ? ["✅ I understand, let's continue", "❌ Cancel"] : ["✅ J'ai compris, je poursuis l'analyse", "❌ Annuler"],
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
                if (userChoice.includes("annuler") || userChoice.includes("cancel")) {
                    finalResponseText = locale === 'en'
                        ? `❌ **Analysis cancelled.**\n\nYou can restart an analysis at any time by providing your website URL.`
                        : `❌ **Analyse annulée.**\n\nVous pouvez relancer une analyse à tout moment en indiquant l'URL de votre site.`;
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
                    // V4: Classify site from context scan if not already classified
                    if (V4_EVIDENCE_MODE && !v4Classification && contextScanResult?.isReachable) {
                        v4Classification = classifySite(contextScanResult);
                        console.log(`🏷️ V4 Site Classification (re-scan): ${v4Classification.type} (confidence: ${v4Classification.confidence})`);
                    }
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
                const value = detectedValues[key] || (locale === 'en' ? "Detected" : "Détecté");
                highConfidenceData += locale === 'en'
                    ? `- ${key} : "${value}" (HIGH CONFIDENCE - DO NOT RE-ASK)\n`
                    : `- ${key} : "${value}" (HAUTE CONFIANCE - NE PAS REDEMANDER)\n`;
            });

            lowConfidenceKeys.forEach((key: string) => {
                const value = detectedValues[key] || (locale === 'en' ? "Detected" : "Détecté");
                lowConfidenceData += locale === 'en'
                    ? `- ${key} : "${value}" (LOW CONFIDENCE - TO VALIDATE)\n`
                    : `- ${key} : "${value}" (BASSE CONFIANCE - À VALIDER)\n`;
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

            let validationQueue: string[] = [];
            let enrichmentQueue: string[] = [];
            let combinedQueue: string[] = [];

            if (V4_EVIDENCE_MODE && v4Classification) {
                // V4: Build evidence queue from question engine
                const confidenceMap: Record<string, number> = {};
                for (const key of highConfidenceKeys) confidenceMap[key] = 90;
                for (const key of lowConfidenceKeys) confidenceMap[key] = 70;
                // unknownKeys stay at 0 (default)

                const ctx: QuestionContext = {
                    detected: confidenceMap,
                    siteType: v4Classification.type,
                    suggestedSkips: v4Classification.suggestedSkips,
                    locale,
                };
                v4EvidenceQueue = buildEvidenceQueue(ctx, v4Classification);
                // Map to field paths for compatibility with existing queue logic
                combinedQueue = v4EvidenceQueue.map(q => q.field);
                console.log(`🎯 V4 Evidence Queue: ${combinedQueue.length} questions (was ~${allBlockNames.length} fields)`);
            } else {
                // V3: Original queue building
                validationQueue = allBlockNames.filter(b =>
                  lowConfidenceKeys.includes(b) && !ENRICHMENT_ONLY_FIELDS.includes(b)
                );
                enrichmentQueue = allBlockNames.filter(b =>
                  (unknownKeys.includes(b) && !lowConfidenceKeys.includes(b)) ||
                  (lowConfidenceKeys.includes(b) && ENRICHMENT_ONLY_FIELDS.includes(b))
                );
                combinedQueue = [...validationQueue, ...enrichmentQueue];
            }

            // SMART SKIP: Remove redundant questions when a related field already has data
            // Rollback: set RELATED_FIELD_SKIP_RULES = [] to disable instantly
            const RELATED_FIELD_SKIP_RULES: Array<{ source: string; target: string }> = [
                { source: 'offre.services', target: 'offre.products' },
                { source: 'offre.products', target: 'offre.services' },
            ];

            const hasData = (field: string) => highConfidenceKeys.includes(field) || lowConfidenceKeys.includes(field);
            const fieldsToSkip = new Set<string>();
            for (const rule of RELATED_FIELD_SKIP_RULES) {
                if (hasData(rule.source) && !hasData(rule.target) && combinedQueue.includes(rule.target)) {
                    fieldsToSkip.add(rule.target);
                    console.log(`🔗 SMART SKIP: ${rule.target} skipped (covered by ${rule.source})`);
                }
            }
            if (fieldsToSkip.size > 0) {
                const before = combinedQueue.length;
                const filtered = combinedQueue.filter(f => !fieldsToSkip.has(f));
                combinedQueue.length = 0;
                combinedQueue.push(...filtered);
                console.log(`🔗 SMART SKIP: ${before - combinedQueue.length} question(s) removed`);
            }

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
                if (V4_EVIDENCE_MODE && combinedQueue.length > 0) {
                    // V4: find the FIRST queue item that hasn't been asked yet
                    // Check both V4 IDs (evidence_*) and V3 IDs (q_*, validation_*)
                    let foundNext = false;
                    for (let i = 0; i < combinedQueue.length; i++) {
                        const field = combinedQueue[i];
                        const v4Id = `evidence_${field.replace('.', '_')}`;
                        const v3Id1 = `q_${field.replace('.', '_')}`;
                        const v3Id2 = `validation_${field.replace('.', '_')}`;
                        if (!seenQuestionIds.has(v4Id) && !seenQuestionIds.has(v3Id1) && !seenQuestionIds.has(v3Id2)) {
                            queueIndex = i;
                            nextBlockName = field;
                            foundNext = true;
                            break;
                        }
                    }
                    if (!foundNext) {
                        nextBlockName = "FINALISATION";
                        queueIndex = combinedQueue.length;
                    }
                } else {
                    queueIndex = Math.max(0, questionsAskedCount - 3);
                    if (queueIndex >= combinedQueue.length) {
                        nextBlockName = "FINALISATION";
                    } else {
                        nextBlockName = combinedQueue[queueIndex];
                    }
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
                                if (!answer.match(/^(oui|non|ok|d'accord|exact|parfait|je confirme|c'est bon|yes|no|correct|perfect|i confirm|that's right)/i) || answer.length > 30) {
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
                        text: locale === 'en'
                            ? "Could you describe your business in a few sentences (500 characters max)?\nThis will help me better calibrate the following questions."
                            : "Pourriez-vous décrire votre activité en quelques phrases (500 caractères max) ?\nCela m'aidera à mieux calibrer les questions suivantes.",
                        options: [],
                        allowCustom: true,
                        allowMultiple: false,
                        customLabel: locale === 'en' ? "Business activity..." : "Activité..."
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

                // Règle 0 : bloquer les questions parasites de confirmation/transition
                const parasitePatterns = [
                    'êtes-vous prêt', 'etes-vous pret', 'voulez-vous continuer',
                    'souhaitez-vous poursuivre', 'confirmez-vous ces informations',
                    'prêt à générer', 'pret a generer', 'générer votre fichier',
                    'lancer la génération', 'passer à la génération',
                    'évaluez', 'evaluez', 'qualité de cet échange', 'qualite de cet echange',
                    'feedback', 'satisfaction', 'notez', 'noter cet échange',
                    'noter cet echange', 'comment trouvez-vous',
                    // Block vague "already detected" questions that don't list the data
                    'ont été détectés. y a-t-il', 'ont été détectées. y a-t-il',
                    'ont ete detectes', 'ont ete detectees',
                    'd\'autres services importants', 'd\'autres produits importants',
                    // EN parasites
                    'are you ready', 'do you want to continue', 'shall we proceed',
                    'ready to generate', 'generate your file', 'rate this exchange',
                    'how do you find', 'were detected. are there',
                    'other important services', 'other important products',
                ];
                const qTextCheck = (q.text || '').toLowerCase();
                const qIdCheck = (q.id || '').toLowerCase();
                // BUG FIX: Also detect parasites by ID (e.g. feedback_quality, satisfaction_score)
                const parasiteIdPatterns = ['feedback', 'satisfaction', 'rating', 'nps_score'];
                if (parasitePatterns.some(p => qTextCheck.includes(p)) ||
                    parasiteIdPatterns.some(p => qIdCheck.includes(p))) {
                    console.warn(`⚠️ VALIDATOR: Question parasite détectée: id="${q.id}" text="${q.text}". Suppression.`);
                    parsed.questions = [];
                    return;
                }

                // Règle 2 : au moins 2 options, jamais seulement "Autre"
                // SAUF pour les champs texte libre (email, téléphone, etc.)
                // TEXT_INPUT_FIELD_NAMES derived from ENRICHMENT_TEMPLATES (imported)
                // Plus additional detail suffix patterns handled below
                const qIdLower = (q.id || '').toLowerCase();
                const qTextLower = (q.text || '').toLowerCase();

                // BUG FIX: Simple Oui/Non boolean questions must NEVER be detected as text input fields.
                // Questions like has_faq, has_glossary, has_documentation are boolean presence checks,
                // not URL or free-text fields. The LLM sometimes generates text containing "lien" or
                // "url" in the question body, causing false positive detection.
                // BOOLEAN_FIELD_NAMES derived from ENRICHMENT_TEMPLATES (imported)
                // Plus extra patterns not in templates
                const BOOLEAN_FIELD_PATTERNS_EXTRA = ['has_sitemap', 'has_robots'];
                // Questions starting with "Avez-vous", "Disposez-vous", "Possédez-vous" are YES/NO questions
                const isYesNoQuestion = qTextLower.match(/^(avez-vous|disposez-vous|possédez-vous|avez vous|disposez vous|possédez vous|do you have|does your|is there|are there)/);
                const isBooleanField = BOOLEAN_FIELD_NAMES.some(p => qIdLower.includes(p)) || BOOLEAN_FIELD_PATTERNS_EXTRA.some(p => qIdLower.includes(p)) || !!isYesNoQuestion;

                // URL questions: only if no good options already exist (evidence questions have "Je n'ai pas de lien" etc.)
                const hasEvidenceOptions = (q.options || []).some((o: string) => {
                    const lo = o.toLowerCase();
                    return lo.includes('pas de lien') || lo.includes('no link') ||
                        lo.includes('non applicable') || lo.includes('not applicable') ||
                        lo.includes('fournir un lien') || lo.includes('provide a link');
                });
                // BUG FIX: Detect URL follow-up questions that show Oui/Non instead of text input.
                // These are generated by the LLM after "Fournir un lien" with IDs like lien_xxx, url_xxx
                // and should be forced to text input mode.
                const hasOuiNonOptions = (q.options || []).length === 2 &&
                    (q.options || []).some((o: string) => o.toLowerCase() === 'oui' || o.toLowerCase() === 'yes') &&
                    (q.options || []).some((o: string) => o.toLowerCase() === 'non' || o.toLowerCase() === 'no');
                const isUrlIdPattern = !isBooleanField && qIdLower.match(/^(url_|lien_)|(_url|_lien)(_input)?$/);
                const isUrlTextPattern = !isBooleanField && (qTextLower.includes('url') || qTextLower.includes('lien'));
                const isUrlFollowUp = !isBooleanField && !hasEvidenceOptions && (isUrlIdPattern || (isUrlTextPattern && hasOuiNonOptions));
                const isUrlQuestion = !isBooleanField && (isUrlFollowUp || (!hasEvidenceOptions && (
                    qTextLower.includes('collez l') ||
                    qTextLower.includes('coller l') || qTextLower.includes('saisissez l'))));
                // Detect detail/description fields by suffix patterns (LLM often generates _details, _description, _specifics)
                const isDetailField = !isBooleanField && qIdLower.match(/_(details|description|specifics|precisions|complement)$/);
                const isTextInputField = !isBooleanField && (isUrlQuestion || isDetailField || TEXT_INPUT_FIELD_NAMES.some(f => qIdLower.includes(f)) ||
                    qTextLower.includes('email') || qTextLower.includes('téléphone') ||
                    qTextLower.includes('phone') || qTextLower.includes('zone géographique') ||
                    qTextLower.includes('nom légal') || qTextLower.includes('raison sociale') ||
                    qTextLower.includes('collez') || qTextLower.includes('saisissez') ||
                    qTextLower.includes('décrivez') || qTextLower.includes('détaillez') ||
                    qTextLower.includes('précisez') || qTextLower.includes('expliquez') ||
                    qTextLower.includes('geographic area') || qTextLower.includes('legal name') ||
                    qTextLower.includes('paste') || qTextLower.includes('enter your') ||
                    qTextLower.includes('describe') || qTextLower.includes('specify') ||
                    qTextLower.includes('explain'));

                // Pour les champs texte libre, TOUJOURS forcer inputType text
                // (même si le LLM a généré des options comme "contact@ai-visionary.xyz")
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
                            qTextLower.includes('describe') || qTextLower.includes('detail') ||
                            qTextLower.includes('methodology') || qTextLower.includes('explain') ||
                            qIdLower.includes('process_steps') || qIdLower.includes('key_indicators');
                        if (isDescriptionQuestion) q.customLabel = locale === 'en' ? "Describe here..." : "Décrivez ici...";
                        else if (qTextLower.includes('email')) q.customLabel = locale === 'en' ? "Enter your email..." : "Saisissez votre email...";
                        else if (qTextLower.includes('téléphone') || qTextLower.includes('phone')) q.customLabel = locale === 'en' ? "Enter your number..." : "Saisissez votre numéro...";
                        else if (qTextLower.includes('géographi') || qTextLower.includes('geograph')) q.customLabel = locale === 'en' ? "Enter the geographic area..." : "Saisissez la zone géographique...";
                        else if (isUrlQuestion && !isDescriptionQuestion) q.customLabel = locale === 'en' ? "Paste the URL here..." : "Collez l'URL ici...";
                        else q.customLabel = locale === 'en' ? "Enter your answer..." : "Saisissez votre réponse...";
                    }
                    console.warn("⚠️ VALIDATOR: champ texte → inputType text (pas de boutons)");
                } else if (hasEvidenceOptions) {
                    // Questions de preuve : garder les options + forcer allowCustom + bon label
                    q.allowCustom = true;
                    if (!q.customLabel) q.customLabel = locale === 'en' ? "Other method / Specify..." : "Autre méthode / Préciser...";
                    console.warn("⚠️ VALIDATOR: question de preuve → options gardées + allowCustom");
                } else if (isYesNoQuestion && (!q.options || q.options.length < 2 || !q.options.some((o: string) => o.toLowerCase().includes('non') || o.toLowerCase().includes('no')))) {
                    // Questions Avez-vous/Disposez-vous DOIVENT avoir Oui + Non
                    q.options = locale === 'en' ? ["Yes", "No"] : ["Oui", "Non"];
                    q.allowCustom = true;
                    console.warn("⚠️ VALIDATOR: question Oui/Non forcée (Avez-vous...)");
                } else if (!q.options || q.options.length === 0) {
                    q.options = locale === 'en' ? ["Yes", "No"] : ["Oui", "Non"];
                    q.allowCustom = true;
                    console.warn("⚠️ VALIDATOR: 0 options → fallback Oui/Non");
                } else if (q.options.length === 1) {
                    const singleOpt = q.options[0].toLowerCase();
                    if (singleOpt.includes('autre') || singleOpt.includes('préciser') || singleOpt.includes('ajouter') || singleOpt.includes('other') || singleOpt.includes('specify') || singleOpt.includes('add')) {
                        q.options = locale === 'en' ? ["Yes", "No"] : ["Oui", "Non"];
                        q.allowCustom = true;
                        console.warn("⚠️ VALIDATOR: seule option → fallback Oui/Non");
                    }
                }
            }

            // ONLY GENERATE A NEW QUESTION IF WE ARE STILL IN QUESTIONING MODE
            if (ayoState === AyoState.QUESTIONNAIRE || ayoState === AyoState.OWNERSHIP || ayoState === AyoState.TRUTH_WARNING) {

                if (V4_EVIDENCE_MODE && v4EvidenceQueue.length > 0) {
                    // V4: Use evidence question engine
                    const evidenceQ = v4EvidenceQueue.find(q => q.field === nextBlockName);
                    if (evidenceQ) {
                        finalResponseText = JSON.stringify(buildEvidenceQuestionBlock(evidenceQ, locale));
                        console.log(`🎯 V4 EVIDENCE question for ${nextBlockName} (type: ${evidenceQ.evidenceType})`);
                    } else {
                        // Fallback to V3 enrichment question
                        const enFieldName = nextBlockName.split('.')[1] || nextBlockName;
                        const enBlockName = nextBlockName.split('.')[0] || nextBlockName;
                        finalResponseText = buildEnrichmentQuestion(enBlockName, enFieldName, locale);
                        console.log(`⚠️ V4 fallback to V3 enrichment for ${nextBlockName}`);
                    }
                } else {
                // V3: Original question generation
                // 🆕 VALIDATION STATIQUE : Si le prochain bloc est lowConfidence, question Oui/Non sans LLM
                if (validationQueue.includes(nextBlockName)) {
                    const fieldName = nextBlockName.split('.')[1] || nextBlockName;
                    const detectedValue = detectedValues[nextBlockName] || (locale === 'en' ? 'Detected information' : 'Information détectée');
                    finalResponseText = buildValidationQuestion(
                        nextBlockName.split('.')[0],
                        fieldName,
                        detectedValue,
                        locale
                    );
                    console.log(`✅ VALIDATION STATIQUE pour ${nextBlockName} (pas de LLM)`);
                } else {
                // 🆕 ENRICHISSEMENT STATIQUE — plus de LLM pour les questions
                const enFieldName = nextBlockName.split('.')[1] || nextBlockName;
                const enBlockName = nextBlockName.split('.')[0] || nextBlockName;
                finalResponseText = buildEnrichmentQuestion(
                    enBlockName,
                    enFieldName,
                    locale,
                );
                console.log(`✅ ENRICHISSEMENT STATIQUE pour ${nextBlockName} (pas de LLM)`);

                } // fin du else (ENRICHISSEMENT STATIQUE)
                } // fin du else (V3 original)

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
                        m.content.includes("INFORMATION(S) DETECTED") ||
                        m.content.includes("scan_state") ||
                        m.content.includes("Analyse Préliminaire Effectuée") ||
                        m.content.includes("SCAN TERMINÉ") ||
                        m.content.includes("SCAN COMPLETE")
                    )
                );
                // Filter out pure confirmation messages that carry no data
                // Délégué à l'agent Contrôle Qualité (qcIsConfirmationOnly)
                const isConfirmationOnly = qcIsConfirmationOnly;

                // OPTIMIZED: Extract only Q&A pairs (question text + user answer), skip long JSON blocks
                // This keeps the context compact to avoid Gemini timeouts on Vercel
                let userAnswersContext = "";
                const startIdx = scanMsgIndex !== -1 ? scanMsgIndex : 0;
                const postScanMessages = messages.slice(startIdx);
                const qaPairs: string[] = [];
                for (let i = 0; i < postScanMessages.length; i++) {
                    const msg = postScanMessages[i];
                    if (msg.role === 'user') {
                        if (isConfirmationOnly(msg.content)) continue;
                        // Find the question this answer responds to
                        let questionText = "";
                        if (i > 0 && postScanMessages[i-1].role === 'assistant') {
                            const prevContent = postScanMessages[i-1].content;
                            // Extract question text from question_block JSON
                            const textMatch = prevContent.match(/"text"\s*:\s*"([^"]{5,150})"/);
                            if (textMatch) questionText = textMatch[1];
                        }
                        const answer = msg.content.substring(0, 500); // Cap answer length
                        if (questionText) {
                            qaPairs.push(`Q: ${questionText}\nA: ${answer}`);
                        } else {
                            qaPairs.push(`USER: ${answer}`);
                        }
                    }
                }
                userAnswersContext = qaPairs.join('\n\n');
                // Safety: cap total context to 8000 chars
                if (userAnswersContext.length > 8000) {
                    userAnswersContext = userAnswersContext.substring(0, 8000);
                }
                console.log(`📋 USER CONTEXT LENGTH: ${userAnswersContext.length} chars (${qaPairs.length} Q&A pairs, from msgIndex ${startIdx})`);

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
q=0 : Information ABSENTE ou INCONNUE (l'utilisateur ne sait pas ou n'a pas répondu).
  Exemples q=0 : "non", "nous n'avons pas de glossaire", champ laissé vide, réponse évasive sans détail
  ⚠️ ATTENTION : "pas de produit car nous ne vendons que des services" = na:true, PAS q=0

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

⚠️ RÈGLE N/A EXPLICITE : Si l'utilisateur déclare que ce champ ne s'applique PAS à son activité
(ex: "nous ne vendons pas de produits", "nous ne faisons que des services", "pas de produit", "[SKIP] Non applicable",
"pas applicable à notre activité", "nous ne proposons pas X", "notre association n'a pas de X"),
cela signifie que ce champ est HORS PÉRIMÈTRE — ce n'est pas un manque, c'est une réalité déclarée.
Dans ce cas : { "value": null, "q": 0, "na": true }.
NE PAS CONFONDRE avec "je ne sais pas" ou "information manquante" (= q=0 SANS na).
"na": true signifie "déclaré non applicable", pas "inconnu".

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
      "name": { "value": "", "q": 0, "evidence": [] },
      "legal_name": { "value": "", "q": 0, "evidence": [] },
      "business_type": { "value": "", "q": 0, "evidence": [] },
      "city": { "value": "", "q": 0, "evidence": [] },
      "country": { "value": "", "q": 0, "evidence": [] },
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

                // CALL LLM FOR EXTRACTION ONLY (WITH TIMEOUT & FALLBACK)
                console.log("... Extracting Signals via LLM (Timeout: 90s) ...");

                let extractionResultText = "";
                try {
                    // Timeout promise
                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error("LLM_TIMEOUT")), 90000)
                    );

                    // LLM extraction promise (with AbortSignal as belt-and-suspenders)
                    const extractionPromise = llmJson({
                        temperature: 0,
                        system: EXTRACTION_PROMPT,
                        abortSignal: AbortSignal.timeout(90000),
                        messages: [
                            { role: 'user', content: locale === 'en'
                                ? "Extract JSON now. Do not forget to set q=1 when information is found, especially from USER CONTEXT."
                                : "Extract JSON now. N'oublie pas de mettre q=1 si l'information est trouvée, particulièrement depuis le USER CONTEXT." },
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
                    const obs = locale === 'en' ? "Standard analysis." : "Analyse standard.";
                    structuredAnalysis = {
                        identite: { score: scoreResult.blocks.identite, max: 10, label: locale === 'en' ? "Identity & Anchoring" : "Identité & Ancrage", status: "warning", observation: obs },
                        offre: { score: scoreResult.blocks.offre, max: 20, label: locale === 'en' ? "Offer Clarity" : "Clarté de l'Offre", status: "warning", observation: obs },
                        processus: { score: scoreResult.blocks.processus_methodes, max: 15, label: locale === 'en' ? "Processes & Methods" : "Processus & Méthodes", status: "warning", observation: obs },
                        confiance: { score: scoreResult.blocks.engagements_conformite, max: 15, label: locale === 'en' ? "Trust & Compliance" : "Confiance & Conformité", status: "warning", observation: obs },
                        technique: { score: scoreResult.blocks.structure_technique, max: 10, label: locale === 'en' ? "Technical Foundation" : "Socle Technique", status: "warning", observation: obs }
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

                // 🔄 V4: DIRECT INJECTION from conversation history (bypass DB)
                // Read V4 evidence answers directly from messages — no DB dependency
                if (V4_EVIDENCE_MODE && extractJson?.fields) {
                    const fields = extractJson.fields as any;
                    let lastEvidenceId = '';
                    for (const msg of messages) {
                        if (msg.role === 'assistant' && typeof msg.content === 'string') {
                            const idMatch = msg.content.match(/"id"\s*:\s*"(evidence_[^"]+)"/);
                            if (idMatch) lastEvidenceId = idMatch[1];
                        } else if (msg.role === 'user' && lastEvidenceId) {
                            let answer = (msg.content as string).trim();
                            // Strip concatenated label suffix from frontend: "{answer}{customLabel}\u00a0:"
                            // The frontend appends the input field label to the user's answer
                            const matchingTpl = EVIDENCE_TEMPLATES.find(t => `evidence_${t.block}_${t.fieldName}` === lastEvidenceId);
                            if (matchingTpl) {
                                const labels = [matchingTpl.customLabel_en, matchingTpl.customLabel_fr].filter(Boolean);
                                for (const label of labels) {
                                    if (!label) continue;
                                    // Strip label with various separators: "answerLabel :", "answerLabel:", "answerLabel\u00a0:"
                                    const labelClean = label.replace(/\.{3}$/, '').trim(); // remove trailing "..."
                                    const suffixRE = new RegExp(`${labelClean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\u00a0]*:?\\s*$`, 'i');
                                    answer = answer.replace(suffixRE, '').trim();
                                }
                            }
                            // Skip confirmations and setup answers
                            if (!answer || /^(oui|yes|ok|non|no)[\s!.]*$/i.test(answer)) { lastEvidenceId = ''; continue; }
                            // Map evidence ID to field path: evidence_block_field → block.field
                            const parts = lastEvidenceId.replace('evidence_', '').split('_');
                            // Find the right block.field split (block names can have underscores)
                            let bloc = '', fieldName = '';
                            for (let i = 1; i < parts.length; i++) {
                                const tryBloc = parts.slice(0, i).join('_');
                                const tryField = parts.slice(i).join('_');
                                if (fields[tryBloc] && fields[tryBloc][tryField] !== undefined) {
                                    bloc = tryBloc; fieldName = tryField; break;
                                }
                            }
                            if (!bloc) {
                                // Try known blocks
                                for (const knownBloc of ['identite', 'offre', 'processus_methodes', 'engagements_conformite', 'indicateurs', 'contenus_pedagogiques', 'external_context']) {
                                    const prefix = knownBloc + '_';
                                    if (lastEvidenceId.replace('evidence_', '').startsWith(prefix.replace('.', '_'))) {
                                        bloc = knownBloc;
                                        fieldName = lastEvidenceId.replace('evidence_', '').substring(prefix.length);
                                        break;
                                    }
                                }
                            }
                            if (bloc && fields[bloc]) {
                                // Evaluate evidence
                                const matchingTemplate = EVIDENCE_TEMPLATES.find(t => `evidence_${t.block}_${t.fieldName}` === lastEvidenceId);
                                let qValue: any = 1;
                                let evidenceUrl: string | undefined;
                                if (matchingTemplate) {
                                    const evaluation = evaluateEvidence(matchingTemplate, answer);
                                    qValue = evaluation.q;
                                    evidenceUrl = evaluation.evidenceUrl;
                                }
                                // Check for N/A / skip
                                const isSkip = /\[SKIP\]|not applicable|non applicable|n\/a/i.test(answer);
                                if (isSkip) {
                                    fields[bloc][fieldName] = { value: '', q: 0, evidence: ['user_skipped'], na: true };
                                    console.log(`🎯 V4 DIRECT: ${bloc}.${fieldName} → SKIPPED (na:true)`);
                                } else {
                                    const trail = evidenceUrl ? ['questionnaire_answer', evidenceUrl] : ['questionnaire_answer'];
                                    fields[bloc][fieldName] = { value: answer, q: qValue, evidence: trail };
                                    console.log(`🎯 V4 DIRECT: ${bloc}.${fieldName} → q=${qValue}${evidenceUrl ? ' URL:' + evidenceUrl : ''}`);
                                }
                            }
                            lastEvidenceId = '';
                        }
                    }
                }

                // 🔄 INJECT QUESTIONNAIRE ANSWERS: Recover answers from intermediate saves (V3 fallback)
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
                            QUESTION_TO_FIELD[`evidence_${suffix}`] = fieldPath;     // V4: evidence_identite_contact_email
                            QUESTION_TO_FIELD[suffix] = fieldPath;                   // identite_contact_email (fallback)
                        }

                        let injectedCount = 0;
                        for (const [qId, rawAnswer] of Object.entries(savedAnswers)) {
                            const fieldPath = QUESTION_TO_FIELD[qId];
                            if (!fieldPath || !rawAnswer || typeof rawAnswer !== 'string') continue;
                            // Strip concatenated label suffix from frontend
                            let answer = rawAnswer.trim();
                            const tplForClean = EVIDENCE_TEMPLATES.find(t => `evidence_${t.block}_${t.fieldName}` === qId);
                            if (tplForClean) {
                                for (const lbl of [tplForClean.customLabel_en, tplForClean.customLabel_fr].filter(Boolean)) {
                                    if (!lbl) continue;
                                    const lblClean = lbl.replace(/\.{3}$/, '').trim();
                                    const re = new RegExp(`${lblClean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\u00a0]*:?\\s*$`, 'i');
                                    answer = answer.replace(re, '').trim();
                                }
                            }
                            // Skip confirmation-only answers
                            if (answer.match(/^(oui|non|ok|exact|parfait|je confirme|c'est bon|yes|no|correct|perfect|i confirm|that's right)$/i)) continue;

                            const [bloc, field] = fieldPath.split('.');
                            if (!bloc || !field || !fields[bloc]) continue;

                            // V4: User answers ALWAYS override scan data (user > scan)
                            // V3: Only inject if field is empty (backward compat)
                            const existing = fields[bloc][field];
                            const isEmpty = !existing || existing.value === '' || existing.value === null ||
                                (Array.isArray(existing.value) && existing.value.length === 0) ||
                                (existing.q === 0);
                            const isV4Answer = V4_EVIDENCE_MODE && qId.startsWith('evidence_');

                            if (isEmpty || isV4Answer) {
                                let qValue = 1 as any;
                                let evidenceUrl: string | undefined;
                                if (isV4Answer) {
                                    const matchingTemplate = EVIDENCE_TEMPLATES.find(t => `evidence_${t.block}_${t.fieldName}` === qId);
                                    if (matchingTemplate) {
                                        const evaluation = evaluateEvidence(matchingTemplate, answer);
                                        qValue = evaluation.q;
                                        evidenceUrl = evaluation.evidenceUrl;
                                        console.log(`🎯 V4 evaluateEvidence: ${fieldPath} → q=${qValue}${evidenceUrl ? ` (URL: ${evidenceUrl})` : ''}`);
                                    }
                                }
                                const evidenceTrail = evidenceUrl
                                    ? ["questionnaire_answer", evidenceUrl]
                                    : ["questionnaire_answer"];
                                fields[bloc][field] = { value: answer, q: qValue, evidence: evidenceTrail };
                                console.log(`🔄 INJECT from questionnaire: ${fieldPath} = ${answer.substring(0, 60)} (q=${qValue})`);
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

                // 4c. CLEAN OUTPUT LAYER — apply reliability capping after all injections
                // NOTE: sanitizeLlmFields already ran once on the LLM output (before injections).
                // We do NOT re-run it here because questionnaire answers (evaluated by evaluateEvidence)
                // and scan_state data are already clean. Re-sanitizing would wrongly zero out
                // legitimate user answers whose text matches QUESTION_LEAK_RE patterns.
                // Only downgradeFieldQuality runs here for reliability-level capping.
                if (extractJson?.fields) {
                    const cleanDowngradeLogs = downgradeFieldQuality(extractJson.fields);
                    for (const log of cleanDowngradeLogs) {
                        logger.info('POST_INJECT_CLEAN', `${log.field}: ${log.reason}`);
                    }
                }

                // 4d. V4: Handle indicateurs before scoring
                // - If user answered with data → keep as-is (questionnaire injection handled it)
                // - If user said "not applicable" / skip → set na:true (excluded from scoring)
                // - If no answer and no data → structured absence (q=0.5, neutral)
                if (V4_EVIDENCE_MODE && extractJson?.fields) {
                    if (!extractJson.fields.indicateurs) (extractJson.fields as any).indicateurs = {};
                    const ind = (extractJson.fields as any).indicateurs;

                    // Check if user explicitly skipped (N/A) via questionnaire answers
                    const savedAnswers = await db.getAnalysis(sessionAsrId).then(a => a?.data?.questionnaire_answers).catch(() => null);
                    const skippedIndicators = savedAnswers && Object.entries(savedAnswers).some(
                        ([k, v]) => k.includes('key_indicators') && typeof v === 'string' &&
                        /not applicable|non applicable|\[SKIP\]|n\/a/i.test(v)
                    );

                    if (skippedIndicators) {
                        // User said N/A → exclude from scoring (na:true)
                        ind.key_indicators = { value: '', q: 0, evidence: ['user_skipped'], na: true };
                        ind.last_review_date = { value: '', q: 0, evidence: ['user_skipped'], na: true };
                        console.log('🏷️ INDICATEURS: user skipped → na:true (excluded from scoring)');
                    } else {
                        // No skip: apply structured absence if still empty
                        if (!ind.key_indicators || (ind.key_indicators.q === 0 && !ind.key_indicators.na)) {
                            ind.key_indicators = { value: ind.key_indicators?.value || '', q: 0.5, evidence: ['structured_absence'] };
                            console.log('🏷️ STRUCTURED ABSENCE: indicateurs.key_indicators → q=0.5');
                        }
                        if (!ind.last_review_date || (ind.last_review_date.q === 0 && !ind.last_review_date.na)) {
                            ind.last_review_date = { value: ind.last_review_date?.value || '', q: 0.5, evidence: ['structured_absence'] };
                            console.log('🏷️ STRUCTURED ABSENCE: indicateurs.last_review_date → q=0.5');
                        }
                    }
                }

                // RECOMPUTE SCORE after all injections + cleaning + structured absence
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
                        // BUG FIX: Extract email from questionnaire answers to top-level column.
                        // The contact_email field is captured during the Q&A flow and stored in
                        // data.fields.identite.contact_email but was never promoted to the top-level
                        // `email` column, leaving it null until the sales funnel email capture.
                        email: extractJson?.fields?.identite?.contact_email?.value || detectedEmail || null,
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
                const architecteRecommendations = buildStructureRecommendations(extractJson, scoreResult, locale);
                const architecteText = formatRecommendationsForChat(architecteRecommendations, locale);
                logger.info('ARCHITECTE_RECOMMENDATIONS', `Architecte: ${architecteRecommendations.recommendations.length} recs, gain estimé +${architecteRecommendations.estimatedScoreGain}pts`, {
                    criticalFiles: architecteRecommendations.recommendations.filter(r => r.priority === 1).length,
                    estimatedGain: architecteRecommendations.estimatedScoreGain,
                });

                const isEnFinal = locale === 'en';
                const blockLabelsForFinal = isEnFinal
                    ? { identite: 'Identity & Anchoring', offre: 'Offer Clarity', processus_methodes: 'Processes & Methods', engagements_conformite: 'Trust & Compliance', indicateurs: 'Social Proof & Metrics', contenus_pedagogiques: 'Educational Content', structure_technique: 'AIO Technical Foundation' }
                    : { identite: 'Identité & Ancrage', offre: 'Offre', processus_methodes: 'Processus & Méthodes', engagements_conformite: 'Engagements & Conformité', indicateurs: 'Indicateurs', contenus_pedagogiques: 'Contenus pédagogiques', structure_technique: 'Structure technique' };
                const capText = scoreResult.capApplied
                    ? (isEnFinal
                        ? `\n⚠️ **Cap applied**: ${scoreResult.capReason} (raw score: ${scoreResult.rawTotal}/100)`
                        : `\n⚠️ **Plafond appliqué** : ${scoreResult.capReason} (score brut : ${scoreResult.rawTotal}/100)`)
                    : '';
                const lockedText = isEnFinal
                    ? `🔒 DETAILED RESULTS LOCKED\n(Critical explanations and corrections have been generated but are hidden).`
                    : `🔒 RÉSULTAT DÉTAILLÉ VERROUILLÉ\n(Les explications critiques et les correctifs ont été générés mais sont masqués).`;

                finalResponseText = `${isEnFinal ? '✅ AI Visibility Audit complete.' : '✅ Audit de Visibilité IA terminé.'}
${isEnFinal ? 'Calculating score...' : 'Calcul du score en cours...'}
|||
🔎 ${blockLabelsForFinal.identite} : ${scoreResult.blocks.identite}/10
|||
🔎 ${blockLabelsForFinal.offre} : ${scoreResult.blocks.offre}/20
|||
🔎 ${blockLabelsForFinal.processus_methodes} : ${scoreResult.blocks.processus_methodes}/15
|||
🔎 ${blockLabelsForFinal.engagements_conformite} : ${scoreResult.blocks.engagements_conformite}/15
|||
🔎 ${blockLabelsForFinal.indicateurs} : ${scoreResult.blocks.indicateurs}/20
|||
🔎 ${blockLabelsForFinal.contenus_pedagogiques} : ${scoreResult.blocks.contenus_pedagogiques}/10
|||
🔎 ${blockLabelsForFinal.structure_technique} : ${scoreResult.blocks.structure_technique}/10
|||
📊 ${isEnFinal ? 'FINAL AIO SCORE' : 'SCORE FINAL AIO'} : ${scoreResult.total} / 100
${capText}

${lockedText}
|||
${architecteText}
|||
${(() => {
                        // BUG FIX: Build pack question JSON separately to ensure clean serialization.
                        // The pack question must be the last |||‐separated chunk so the client renders it
                        // as an interactive question_block.
                        // CRITICAL: The intro text MUST NOT contain patterns that match the client-side
                        // sanitizeDisplayText JSON_LEAK regex (e.g. "word": or { or }).
                        // Strip any JSON-triggering chars from the summary to prevent sanitizer from
                        // destroying the intro, which causes the whole question_block to fail silently.
                        const safeSummary = (architecteRecommendations.summary || '')
                            .replace(/[{}[\]"]/g, '')
                            .replace(/\s*:\s*/g, ' - ');
                        const packIntro = isEnFinal
                            ? `NEXT STEP\n\n${safeSummary}\n\nChoose your certification level`
                            : `PROCHAINE ETAPE\n\n${safeSummary}\n\nChoisissez votre niveau de certification`;
                        const packQuestion = {
                            type: "question_block",
                            intro: packIntro,
                            questions: [{
                                id: "pack_intention",
                                text: isEnFinal ? "Select your Pack to activate your recommendation" : "Selectionnez votre Pack pour activer votre recommandation",
                                options: isEnFinal ? ["AYA Subscription - 19 CHF/month", "PRO Pack - 499 CHF (Ownership)"] : ["Abonnement AYA - 19 CHF/mois", "Pack PRO - 499 CHF (Propriete)"],
                                allowCustom: false,
                                allowMultiple: false
                            }]
                        };
                        console.log("PACK_QUESTION_JSON:", JSON.stringify(packQuestion).substring(0, 200));
                        return JSON.stringify(packQuestion);
                    })()}`;


            } catch (err: unknown) {
                const errMsg = err instanceof Error ? err.message : 'Unknown error';
                logger.critical('FINAL_ANALYSIS_ERROR', errMsg, { stack: err instanceof Error ? err.stack : undefined });
                finalResponseText = locale === 'en'
                    ? `⚠️ An error occurred during the analysis finalization.\n\nPlease try again or contact hello@ai-visionary.xyz.`
                    : `⚠️ Une erreur est survenue lors de la finalisation de l'analyse.\n\nVeuillez réessayer ou contacter hello@ai-visionary.xyz.`;
            }
        } else if (!finalResponseText) {
            // 🎯 PACK SELECTION & SALES FUNNEL LOGIC
            const userContent = lastMessage.content.trim().toLowerCase();
            // Email capture — délégué à l'agent Contrôle Qualité
            const emailMatch = userContent.match(QC_EMAIL_CAPTURE_REGEX);

            logger.info('SALES_FUNNEL', `User content: ${userContent.substring(0, 100)}`);

            // 1. INTENTION DETECTION & CONFIRMATION
            // 🔄 CASE: ABONNEMENT AYA (19 CHF / MOIS)
            if (userContent.includes("abonnement") || userContent.includes("subscription") || userContent.includes("subscribe") || userContent.includes("s'abonner") || (userContent.includes("aya") && userContent.includes("19"))) {
                console.log("🎯 Selection: Abonnement AYA");
                if (userContent.includes("valider") || userContent.includes("confirmer") || userContent.includes("validate") || userContent.includes("confirm") || userContent.includes("subscribe to") || userContent.includes("s'abonner au")) {
                    // Confirmation recue → demander l'email
                    finalResponseText = locale === 'en'
                        ? `🔄 **Valid Choice: AYA SUBSCRIPTION (19 CHF/month).**\nYou activate your priority presence in the AYA Registry.\n\n👉 **Enter your professional email to finalize the subscription:**\nEX: hello@your-domain.com`
                        : `🔄 **Choix Valide : ABONNEMENT AYA (19 CHF/mois).**\nVous activez votre presence prioritaire dans le Registre AYA.\n\n👉 **Entrez votre email professionnel pour finaliser l'abonnement :**\nEX : hello@votre-domaine.com`;
                } else {
                    // Premiere selection → confirmation + explication + possibilite de changer
                    finalResponseText = JSON.stringify({
                        type: "question_block",
                        intro: locale === 'en'
                            ? "AI-NATIVE VISIBILITY (SUBSCRIPTION)\n\nThe AYA Subscription is designed for businesses that want results without technical complexity.\n\nImmediate Benefits -\nActive AYA Registry, Hosted Data, Anti-Hallucination, Scalable.\n\nPrice - 19 CHF / month (No commitment)"
                            : "VISIBILITE IA-NATIVE (ABONNEMENT)\n\nL'Abonnement AYA est concu pour les entreprises qui veulent des resultats sans complexite technique.\n\nBenefices Immediats -\nRegistre AYA Actif, Donnees Hebergees, Anti-Hallucination, Evolutif.\n\nTarif - 19 CHF / mois (Sans engagement)",
                        questions: [{
                            id: "confirm_subscription",
                            text: locale === 'en' ? "Your decision" : "Votre decision",
                            options: locale === 'en'
                                ? ["Subscribe to AYA Registry (19 CHF/mo)", "Switch to PRO PACK (499 CHF)"]
                                : ["S'abonner au Registre AYA (19 CHF/mois)", "Changer pour le PACK PRO (499 CHF)"],
                            allowCustom: false
                        }]
                    });
                }
            }
            // 🚀 CASE: PACK PRO (499 CHF)
            else if (userContent.includes("pro") || userContent.includes("499") || userContent.includes("propriété") || userContent.includes("ownership")) {
                console.log("🎯 Selection: Pack PRO");
                if (userContent.includes("valider") || userContent.includes("confirmer") || userContent.includes("passer") || userContent.includes("upgrader") || userContent.includes("validate") || userContent.includes("confirm") || userContent.includes("upgrade") || userContent.includes("get pro") || userContent.includes("obtenir le")) {
                    finalResponseText = locale === 'en'
                        ? `🚀 **Valid Choice: PRO PACK (Ownership).**\nTotal Ownership of your semantic assets. 3 years of Registry included.\n\n👉 **Enter your professional email to finalize the order (499 CHF):**`
                        : `🚀 **Choix Validé : PACK PRO (Propriété).**\nPropriété Totale de vos actifs sémantiques. 3 ans de Registre inclus.\n\n👉 **Entrez votre email professionnel pour finaliser la commande (499 CHF) :**`;
                } else {
                    // CHECK IF CLIENT IS EXISTING TO ADAPT BUTTON TEXT (Using detectedUrl)
                    let isExisting = false;
                    if (detectedUrl) {
                        const client = await db.getAyaEntityByUrl(detectedUrl);
                        if (client) isExisting = true;
                    }

                    // Fallback check in messages
                    if (!isExisting) {
                        isExisting = messages.some((m: any) => m.content.includes("DÉJÀ CLIENT") || m.content.includes("ALREADY AN AYA CLIENT"));
                    }

                    const isEn = locale === 'en';
                    finalResponseText = JSON.stringify({
                        type: "question_block",
                        intro: isEn
                            ? `**BECOME A REFERENCE (PRO PACK)**

You give your business the real opportunity to be visible and recommendable by AIs with total ownership of your assets.

**Your 5 PRO files:**
- 👑 **ASR-Protocol.json** → Advanced AI context & criteria (signed).
- ⚙️ **manifest.json** → Strict recommendation policy.
- 💬 **faq.json** → Contextual answers for LLMs.
- 📖 **glossary.json** → Precise business vocabulary.
- 🌐 **external_context.json** → Reviews and encapsulated signals.
- 📄 **3 YEARS of AYA Registry included**.

**Price: 499 CHF (One-time purchase)**`
                            : `**DEVENIR UNE RÉFÉRENCE (PACK PRO)**

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
                            text: isEn ? "Your final decision:" : "Votre décision finale :",
                            options: isEn
                                ? ["Get PRO PACK (499 CHF)", isExisting ? "Keep my subscription" : "Subscribe to AYA Registry (19 CHF/mo)"]
                                : ["Obtenir le PACK PRO (499 CHF)", isExisting ? "Rester sur mon abonnement" : "S'abonner au Registre AYA (19 CHF/mois)"],
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
                // Read locale from NEXT_LOCALE cookie (set by i18n toggle)
                const cookieHeader = req.headers.get('cookie') || '';
                const localeMatch = cookieHeader.match(/NEXT_LOCALE=(fr|en)/);
                const chatLocale = localeMatch ? localeMatch[1] : 'fr';
                const clientRef = encodeClientReference({
                    url: detectedUrl || "unknown",
                    email: userEmail,
                    analysisId: sessionAsrId,
                    locale: chatLocale,
                });
                const stripeSuffix = `?client_reference_id=${clientRef}&prefilled_email=${encodeURIComponent(userEmail)}`;
                logger.info('STRIPE_LINK', `Stripe link generated with aid=${sessionAsrId}, email=${userEmail}`);

                const actionLink = (selectedPlan === "PRO"
                    ? `${STRIPE_LINKS.PRO}${stripeSuffix}`
                    : `${STRIPE_LINKS.AYA_SUB}${stripeSuffix}`).replace(/\s/g, '');

                if (selectedPlan === "PRO") {
                    finalResponseText = locale === 'en'
                        ? `✅ **Email registered.**

🚀 **Finalize my PRO PACK - Ownership (499 CHF)**

**Your 5 PRO files:**
👑 **ASR-Protocol.json** (signed)
⚙️ **manifest.json**
💬 **faq.json**
📖 **glossary.json**
🌐 **external_context.json**
📜 + **3 Years of AYA Registry** included

👉 [Buy my ASR files](${actionLink})

*You will be redirected to our secure payment platform.*`
                        : `✅ **Email enregistré.**

🚀 **Finaliser mon PACK PRO - Propriété (499 CHF)**

**Vos 5 fichiers PRO :**
👑 **ASR-Protocol.json** (signé)
⚙️ **manifest.json**
💬 **faq.json**
📖 **glossary.json**
🌐 **external_context.json**
📜 + **3 Ans de Registre AYA** inclus

👉 [Acheter mes fichiers ASR](${actionLink})

*Vous serez redirigé vers notre plateforme de paiement sécurisée.*`;
                } else {
                    finalResponseText = locale === 'en'
                        ? `✅ **Email registered.**

🔄 **Finalize my AYA SUBSCRIPTION (19 CHF/month)**

**Your privileged access:**
📡 **Active Presence** in the AYA Registry
🛡 **Anti-Hallucination** (Verified Data)
⚡ **AI recommendation priority**
🔄 **Unlimited updates**

👉 [Activate my Subscription now](${actionLink})

*You will be redirected to our secure payment platform.*`
                        : `✅ **Email enregistré.**

🔄 **Finaliser mon ABONNEMENT AYA (19 CHF/mois)**

**Votre accès privilège :**
📡 **Présence Active** dans le Registre AYA
🛡 **Anti-Hallucination** (Données vérifiées)
⚡ **Priorité de recommandation** IA
🔄 **Mises à jour illimitées**

👉 [Activer mon Abonnement maintenant](${actionLink})

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

        const finalSystemPrompt = getSystemPrompt(sessionAsrId, sessionDate, detectedUrl, detectedEmail, false, locale);

        // -----------------------------------------------------------------------
        // FINAL FALLBACK: GENERIC CHAT (INTELLIGENT REPLIES)
        // -----------------------------------------------------------------------
        if (!finalResponseText) {
            console.log("🧠 NO TRIGGER MATCHED -> Standard Chat Generation...");

            const chatResult = await llmText({
                temperature: 0.7, // More creative for chat
                system: finalSystemPrompt + (locale === 'en'
                    ? "\n\n⚠️ IMPORTANT: Stay focused on the AYO mission. If the user has not provided a URL, politely ask for it."
                    : "\n\n⚠️ IMPORTANT : Reste concentré sur la mission AYO. Si l'utilisateur n'a pas donné d'URL, demande-la poliment."),
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
        return new Response(JSON.stringify({ error: locale === 'en' ? 'Internal server error.' : 'Erreur interne du serveur.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
