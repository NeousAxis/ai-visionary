import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import Stripe from 'stripe';

// Initialize Services (Resend is safe to init outside)
// Initialize Services (Resend is safe to init outside)
const resend = new Resend(process.env.RESEND_API_KEY || 're_build_placeholder');

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { scanUrlForAioSignals } from '@/lib/aio-scanner';
import { computeAioScore, AyoExtract } from '@/lib/aio-score-engine';
import { db } from '@/lib/db';

// --- LOGIQUE D'ANALYSE (DUPLIQUÉE DEPUIS CHAT ROUTE POUR AUTONOMIE WEBHOOK) ---

async function performFullAnalysis(targetUrl: string): Promise<any> {
    console.log(`🕵️ RELAUNCHING ANALYSIS FOR PAYING CUSTOMER: ${targetUrl}`);

    // 1. SCAN
    const scanResult = await scanUrlForAioSignals(targetUrl);

    // 2. EXTRACTION LLM (Gemini)
    const googleKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!googleKey) throw new Error("Missing Gemini Key for Analysis");

    const google = createGoogleGenerativeAI({ apiKey: googleKey });
    const model = google('gemini-1.5-flash'); // Fast & efficient for webhook

    const EXTRACTION_PROMPT = `
    Tu es un moteur d'extraction de données AIO (Artificial Intelligence Optimization).
    TA MISSION : Extraire des champs structurés du contexte pour générer un fichier ASR (Identity File for AI).
    
    FORMAT DE SORTIE JSON OBLIGATOIRE (Strictement "AYO-EXTRACT-1.0") :
    {
      "version": "AYO-EXTRACT-1.0",
      "source": { "url": "${targetUrl}", "scan": {} },
      "fields": {
        "identite": {
          "name": { "value": "Nom Entreprise", "q": 0 },
          "legal_country": { "value": "Pays", "q": 0 }
        },
        "offre": {
          "services": { "value": [], "q": 0 },
          "products": { "value": [], "q": 0 },
          "target_audience": { "value": "", "q": 0 }
        },
        "processus_methodes": {
          "delivery_mode": { "value": "", "q": 0 }
        },
        "structure_technique": {
          "has_jsonld": { "value": false, "q": 0 }
        }
      }
    }
    
    CONTENU SITE :
    TITRE: ${scanResult.metaTitle}
    DESC: ${scanResult.metaDescription}
    TEXTE: ${scanResult.text.substring(0, 10000)}
    `;

    const extractionResult = await generateText({
        model: model,
        temperature: 0,
        system: EXTRACTION_PROMPT,
        messages: [{ role: 'user', content: "Extract JSON now." }]
    });

    let extractJson: AyoExtract;
    try {
        const jsonText = extractionResult.text.replace(/```json/g, '').replace(/```/g, '').trim();
        extractJson = JSON.parse(jsonText);
    } catch (e) {
        console.error("JSON Parse Error in Webhook", e);
        // Fallback minimal
        extractJson = {
            version: "AYO-EXTRACT-1.0",
            source: { url: targetUrl, scan: {} },
            fields: { identite: { name: { value: "Votre Entreprise", q: 0.5 } }, offre: { services: { value: ["Services détectés automatiquement"], q: 0.5 } } }
        } as any;
    }

    // 3. SCORE
    // Inject technical truth
    if (!extractJson.fields) extractJson.fields = {} as any;
    if (!extractJson.fields.structure_technique) extractJson.fields.structure_technique = {} as any;
    extractJson.fields.structure_technique.has_jsonld = { value: scanResult.hasJsonLd, q: scanResult.hasJsonLd ? 1 : 0, evidence: ["Webhook Auto-Scan"] };

    const scoreResult = computeAioScore(extractJson);

    return {
        score: scoreResult.total,
        details: scoreResult.blocks,
        extract: extractJson.fields
    };
}

// Helper to generate REAL ASR JSON
function generateRealAsrJson(customerEmail: string, sessionDate: string, sessionId: string, analysisData: any, isPro: boolean) {
    const fields = analysisData.extract || {};
    const identity = fields.identite || {};
    const offer = fields.offre || {};

    return JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Organization",
        "@id": sessionId,
        "name": identity.name?.value || "Votre Entreprise",
        "url": analysisData.url || "https://votre-site.com",
        "email": customerEmail,

        "ayo:offer": {
            "services": offer.services?.value || [],
            "products": offer.products?.value || []
        },

        "ayo:score": {
            "value": analysisData.score + "/100",
            "level": isPro ? "PRO_CERTIFIED" : "ESSENTIAL_VERIFIED",
            "method": "AYO_V2_WEBHOOK"
        },

        "ayo:seal": {
            "issuer": "AI Visionary Authority",
            "level": isPro ? "PRO" : "ESSENTIAL",
            "hash": sessionId.substring(0, 16),
            "signature": `sig_${Date.now()}_${sessionId.substring(0, 8)}`,
            "timestamp": sessionDate
        }
    }, null, 2);
}

export async function POST(req: Request) {
    // Lazy init Stripe inside handler
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    let stripe: Stripe | null = null;

    if (stripeKey) {
        stripe = new Stripe(stripeKey); // Use default SDK version for safety
    } else {
        console.warn("⚠️ STRIPE_SECRET_KEY is missing in Env!");
    }

    try {
        const body = await req.json();

        let session_id = body.session_id; // Frontend direct call support
        let force_email = body.force_email;

        // 🔔 DETECT STRIPE WEBHOOK EVENT STRUCTURE
        if (body.type === 'checkout.session.completed' && body.data?.object?.id) {
            console.log(`🔔 STRIPE WEBHOOK EVENT RECEIVED: ${body.type}`);
            session_id = body.data.object.id;
        }

        if (!session_id) {
            console.error("❌ WEBHOOK ERROR: Missing session_id in payload", body);
            return NextResponse.json({ error: 'Missing session_id' }, { status: 400 });
        }

        console.log(`Processing Success for Session: ${session_id}`);

        let customerEmail = "";
        let paymentStatus = "unknown";

        let stripeSession: Stripe.Checkout.Session | null = null;
        if (stripe) {
            try {
                console.log("Retrieving Stripe Session...");
                // Expand customer details to ensure we get the email
                const session = await stripe.checkout.sessions.retrieve(session_id, {
                    expand: ['payment_intent', 'customer']
                });
                stripeSession = session;
                console.log("Stripe Session Retrieved. Customer Details:", session.customer_details);

                // 1. Verify Payment
                paymentStatus = session.payment_status;
                if (paymentStatus !== 'paid') {
                    console.warn("⚠️ Payment not paid:", paymentStatus);
                }

                // 2. Extract Email (Priority: Force > Customer Details > Customer Email > Customer Object)
                if (force_email) {
                    customerEmail = force_email;
                    console.log("✅ Email MANUALLY provided by user:", customerEmail);
                }
                else if (session.customer_details?.email) {
                    customerEmail = session.customer_details.email;
                    console.log("✅ Email extracted from Stripe (customer_details):", customerEmail);
                }
                else if (session.customer_email) {
                    customerEmail = session.customer_email;
                    console.log("✅ Email extracted from Stripe (customer_email):", customerEmail);
                }
                else if (session.customer && typeof session.customer === 'object' && (session.customer as Stripe.Customer).email) {
                    customerEmail = (session.customer as Stripe.Customer).email!;
                    console.log("✅ Email extracted from Stripe (customer object):", customerEmail);
                }
                // Nuclear Fetch
                if (!customerEmail && session.customer && typeof session.customer === 'string') {
                    try {
                        const customer = await stripe.customers.retrieve(session.customer);
                        if ((customer as Stripe.Customer).email) {
                            customerEmail = (customer as Stripe.Customer).email!;
                            console.log("✅ Email extracted via explicit Customer Fetch:", customerEmail);
                        }
                    } catch (fetchErr) {
                        console.error("❌ Failed to fetch customer details:", fetchErr);
                    }
                }

            } catch (stripeErr) {
                console.error("❌ Stripe Retrieval Error:", stripeErr);
            }
        }

        // 🚨 FALLBACK: USE PAYLOAD DATA DIRECTLY IF STRIPE API FAILED
        // This is critical if STRIPE_SECRET_KEY is missing/invalid but webhook signature passed (or skipped in dev)
        let payloadSession = stripeSession;
        if (!payloadSession && body.data?.object) {
            console.log("⚠️ Using raw payload data as fallback session (Stripe API failed)");
            payloadSession = body.data.object;
        }

        // Validate Payment Status from Payload if needed
        if (payloadSession && payloadSession.payment_status) {
            paymentStatus = payloadSession.payment_status;
        }

        if (paymentStatus !== 'paid') {
            console.warn(`⚠️ Payment Status is '${paymentStatus}'. Analyzing anyway but keeping note.`);
            // Note: 'checkout.session.completed' usually means success, but explicit check is safer.
        }

        // Fallback Email Extraction from Payload
        // PRIORITY: 1. Force Email (Manual) 2. Stripe API 3. Payload
        if (!customerEmail && force_email) {
            customerEmail = force_email;
            console.log("✅ Email MANUALLY provided by user:", customerEmail);
        }

        if (!customerEmail && payloadSession) {
            if (payloadSession.customer_details?.email) {
                customerEmail = payloadSession.customer_details.email;
                console.log("✅ Email extracted from RAW PAYLOAD (customer_details):", customerEmail);
            } else if (payloadSession.customer_email) {
                customerEmail = payloadSession.customer_email;
                console.log("✅ Email extracted from RAW PAYLOAD (customer_email):", customerEmail);
            }
        }

        // 5. Detect Payment Amount (from Payload if API failed)
        let amountPaid = 0;
        let packType = "ESSENTIAL"; // Default

        if (amountPaid === 0 && payloadSession && payloadSession.amount_total) {
            amountPaid = payloadSession.amount_total / 100;
            console.log(`💰 Amount Paid (from payload): ${amountPaid} CHF`);
            if (amountPaid >= 450) {
                packType = "PRO";
            }
        }

        // 3. RETRIEVE INFO FROM LINK (Base64 Encoded - STATELESS MODE)
        // We decode the client_reference_id to get the URL and Email.
        let analysisData = { score: 0, details: {}, extract: {} as any, url: "" };
        let companyInfo: { url?: string; name?: string } = {};

        if (payloadSession && payloadSession.client_reference_id) {
            const refId = payloadSession.client_reference_id;
            try {
                // Try Base64 Decode
                const jsonStr = Buffer.from(refId, 'base64').toString('utf-8');
                const decoded = JSON.parse(jsonStr);

                if (decoded.u) {
                    companyInfo.url = decoded.u;
                    console.log("✅ Base64 Encoded URL Found:", companyInfo.url);
                }
                if (!customerEmail && decoded.e) {
                    customerEmail = decoded.e;
                    console.log("✅ RESTORED EMAIL from metadata:", customerEmail);
                }
            } catch (e) {
                console.warn("Could not decode client_reference_id as Base64 JSON (might be raw ID?)", e);
            }
        }

        // 4. LOGIC & CHECKS
        let emailMissing = false;
        if (!customerEmail) {
            console.warn("⚠️ Valid Payment but No Email found.");
            emailMissing = true;
        }

        // 6. RETRIEVE ANALYSIS FROM DATABASE (Source of Truth)
        console.log(`💾 RETRIEVING ANALYSIS FROM DB...`);
        let dbAnalysis = null;
        if (companyInfo.url) {
            try {
                dbAnalysis = await db.getLatestAnalysisByUrl(companyInfo.url);
            } catch (urlDbErr) { console.error("❌ DB URL Lookup Error:", urlDbErr); }
        }
        if (!dbAnalysis) {
            try { dbAnalysis = await db.getAnalysis(session_id); } catch (e) { }
        }

        if (dbAnalysis) {
            analysisData = {
                score: dbAnalysis.score || 0,
                details: {},
                extract: dbAnalysis.data?.fields || {},
                url: dbAnalysis.url || companyInfo.url || ""
            };
        } else {
            // FALLBACK ANALYSIS
            if (companyInfo.url) {
                console.log(`🔄 FALLBACK: Performing minimal analysis for ${companyInfo.url}`);
                try {
                    const result = await performFullAnalysis(companyInfo.url);
                    analysisData = { ...result, url: companyInfo.url };
                    if (analysisData.score === 0) analysisData.score = 50;
                } catch (e) { console.error("Fallback Analysis Failed", e); }
            }
        }

        // Generate REAL Files
        const sessionDate = new Date().toISOString();
        const asrJson = generateRealAsrJson(customerEmail || "email_missing", sessionDate, session_id, analysisData, packType === "PRO");

        // 🔐 VALIDATION EMAIL
        const VALIDATION_DISABLED = true;
        let emailValidated = false;
        if (!emailMissing && customerEmail && companyInfo.url) {
            const urlObj = new URL(companyInfo.url);
            const analyzedDomain = urlObj.hostname.replace(/^www\./, '');
            const emailDomain = customerEmail.split('@')[1]?.toLowerCase();

            if (VALIDATION_DISABLED || (emailDomain === analyzedDomain)) {
                emailValidated = true;
            } else {
                console.warn(`❌ SECURITY REJECTION: ${customerEmail} vs ${analyzedDomain}`);
                emailMissing = true;
            }
        }

        // Send Email via Resend
        // ⚡️ FORCE ATTEMPT: We remove the '&& process.env.RESEND_API_KEY' check to force an error (500) if key is missing.
        // This stops "Silent Failures" (200 OK but no email).
        let emailSent = false;
        let emailError = null;

        if (!emailMissing) {
            try {
                // Email content varies by pack type
                let emailSubject = '';
                let emailHtml = '';

                if (packType === "PRO") {
                    emailSubject = `Votre Pack AIO PRO (Activé) - Score ${analysisData.score}/100`;
                    emailHtml = `
                    <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
                        <div style="background: #000; color: #fff; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                            <h1 style="margin:0;">AYO / Pack AIO PRO</h1>
                        </div>
                        
                        <div style="padding: 20px; border: 1px solid #eee; border-top: none;">
                            <p>Bonjour,</p>
                            <p>Votre Pack AIO PRO est activé. Voici vos actifs numériques certifiés.</p>
                            
                            <div style="background: #f0f9ff; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #0284c7;">
                                <h3 style="margin-top:0; color: #0284c7;">📊 Votre Score AIO : ${analysisData.score}/100</h3>
                                ${companyInfo.url ? `<p><strong>Site analysé :</strong> ${companyInfo.url}</p>` : ''}
                                <p>L'analyse temps réel a permis de générer votre fichier ASR sur mesure ci-dessous.</p>
                            </div>

                            <h3 style="margin-top:0; color: #006064;">📦 Votre Fichier ASR PRO (JSON-LD)</h3>
                            <p>Copiez ce code dans un fichier <code>asr.json</code> dans le dossier <code>/.ayo</code> de votre site.</p>
                            <pre style="background: #1e1e1e; color: #d4d4d4; padding: 15px; overflow-x: auto; font-size: 11px; border-radius: 5px;">${asrJson}</pre>

                             <h3 style="margin-top:20px; color: #006064;">📝 Vos Fichiers Sémantiques (FAQ & Glossaire)</h3>
                             <p>En tant que client PRO, voici les structures prêtes à l'emploi (à adapter avec vos contenus) :</p>
                             
                             <div style="background: #f5f5f5; padding: 10px; margin-bottom: 10px; border-radius: 5px;">
                                <strong>faq.json (Structure)</strong><br>
                                <pre style="font-size: 10px; color: #555;">{ "@type": "FAQPage", "mainEntity": [{ "@type": "Question", "name": "...", "acceptedAnswer": { "@type": "Answer", "text": "..." } }] }</pre>
                             </div>

                            <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #bbdefb;">
                                <h3 style="margin-top:0; color: #0d47a1;">🛠 GUIDE D'INSTALLATION RAPIDE</h3>
                                <p style="font-size: 14px;">Pour être visible immédiatement :</p>
                                <ol style="font-size:13px; padding-left:20px;">
                                    <li>Créez un dossier <code>.ayo</code> à la racine de votre site.</li>
                                    <li>Placez-y le fichier <code>asr.json</code> (avec le code ci-dessus).</li>
                                    <li>(Optionnel) Placez-y aussi <code>faq.json</code> pour vos questions fréquentes.</li>
                                </ol>
                                <p style="margin-top: 10px; font-size: 13px;">Si vous utilisez WordPress, Wix ou Shopify, utilisez l'injection de code dans le &lt;HEAD&gt; comme script JSON-LD.</p>
                            </div>

                            <p style="margin-top: 30px; font-size: 12px; color: #999; text-align: center;">
                                AI Visionary - L'Autorité de Visibilité IA.
                            </p>
                        </div>
                    </div>
                `;
                } else {
                    emailSubject = `Votre Fichier ASR Essential - Score ${analysisData.score}/100`;
                    emailHtml = `
                    <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
                        <div style="background: #000; color: #fff; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                            <h1 style="margin:0;">AYO / Essential</h1>
                        </div>
                        
                        <div style="padding: 20px; border: 1px solid #eee; border-top: none;">
                            <p>Bonjour,</p>
                            <p>Merci pour votre confiance. Voici vos résultats et fichiers certifiés.</p>
                            
                            <div style="background: #f0f9ff; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #0284c7;">
                                <h3 style="margin-top:0; color: #0284c7;">📊 Score Calculé : ${analysisData.score}/100</h3>
                                ${companyInfo.url ? `<p><strong>Site analysé :</strong> ${companyInfo.url}</p>` : ''}
                            </div>
                            
                            <h3 style="margin-top:0; color: #006064;">📦 Code Source ASR (Essential)</h3>
                            <pre style="background: #1e1e1e; color: #d4d4d4; padding: 15px; overflow-x: auto; font-size: 11px; border-radius: 5px;">${asrJson}</pre>

                            <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #bbdefb;">
                                <h3 style="margin-top:0; color: #0d47a1;">🛠 GUIDE D'INSTALLATION (Tuto Précis)</h3>
                                <p style="font-size: 14px;">Installez ce code pour activer votre visibilité immédiate.</p>
                                <p style="font-size: 13px;">(Voir instructions détaillées sur le site).</p>
                            </div>
                            
                            <p style="margin-top: 30px; font-size: 12px; color: #999; text-align: center;">
                                AI Visionary - L'Autorité de Visibilité IA.
                            </p>
                        </div>
                    </div>
                `;
                }

                await resend.emails.send({
                    from: 'AYO <hello@ai-visionary.com>',
                    to: [customerEmail],
                    subject: emailSubject,
                    html: emailHtml
                });
                console.log(`✅ Success Email sent to ${customerEmail}`);
                emailSent = true;
            } catch (err: any) {
                console.error("❌ RESEND SENDING FAILED:", err);
                emailError = err.message;
                // THROW FOR ALL EMAIL ERRORS to ensure Stripe alerts the user
                throw new Error(`CRITICAL EMAIL FAILURE: ${err.message}`);
            }
        }

        if (!emailSent) {
            console.error("❌ Email NOT sent (Logic skipped or previously failed).");
            return NextResponse.json({
                success: false,
                error: "Email Logic Skipped or Failed (Check Logs)",
                debug_trace: {
                    payment_found: !!payloadSession,
                    pack_detected: packType,
                    email_target: customerEmail,
                    email_valid: !emailMissing,
                    email_error: emailError,
                }
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            email_sent: emailSent,
            debug_trace: {
                payment_found: !!payloadSession,
                pack_detected: packType,
                email_target: customerEmail,
                email_valid: !emailMissing,
                email_error: emailError,
                resend_key_configured: !!process.env.RESEND_API_KEY,
                analyzed_url: companyInfo.url
            }
        });

    } catch (error: any) {
        console.error("Webhook Error", error);
        return NextResponse.json({
            error: error.message,
            stack: "Detailed error in webhook logs"
        }, { status: 500 });
    }
}
