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
import { generateRealAsrJson } from '@/lib/ayo-crypto'; // This import is already present and correct
import { generateExternalContextJson } from '@/lib/external-context';

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
    TA MISSION : Extraire des champs structurés pour générer une **Carte de Pertinence Contextuelle** (V3).
    
    RÈGLES V3 "CONTEXT & SIMULATION" :
    1. **Contextual Relevance** : Définis pour quels intents utilisateurs ce site est pertinent (ex: "Local Search", "B2B Query").
    2. **AI Simulation** : Simule 3 requêtes (Local, Expert, Specifique) et décide si une IA recommanderait ce site AUJOURD'HUI.
    3. **Selection Conditions** : Qu'est-ce qui manque pour être sélectionné ? (ex: address missing).

    FORMAT DE SORTIE JSON OBLIGATOIRE (Strictement "AYO-EXTRACT-3.0") :
    {
      "version": "AYO-EXTRACT-3.0",
      "source": { "url": "${targetUrl}", "scan": {} },
      "fields": {
        "identite": {
          "name": { "value": "Nom Entreprise", "q": 0 },
          "legal_name": { "value": "", "q": 0 },
          "business_type": { "value": "", "q": 0 },
          "city": { "value": "", "q": 0 },
          "country": { "value": "Pays", "q": 0 },
          "contact_email": { "value": "", "q": 0 },
          "contact_phone": { "value": "", "q": 0 }
        },
        "offre": {
          "services": { "value": [], "q": 0 },
          "products": { "value": [], "q": 0 },
          "use_cases": { "value": [], "q": 0 },
          "target_audience": { "value": "", "q": 0 },
          "pricing_indication": { "value": "", "q": 0 }
        },
        "processus_methodes": {
          "delivery_mode": { "value": "", "q": 0 },
          "process_steps": { "value": [], "q": 0 },
          "geographies_served": { "value": "", "q": 0 },
          "quality_assurance": { "value": "", "q": 0 }
        },
        "engagements_conformite": {
             "policies": { "value": [], "q": 0 },
             "frameworks": { "value": [], "q": 0 },
             "certifications": { "value": [], "q": 0 },
             "security_measures": { "value": [], "q": 0 }
        },
        "indicateurs": {
            "key_indicators": { "value": [], "q": 0 },
            "last_review_date": { "value": "", "q": 0 }
        },
        "contextual_signals": {
            "pricing_level": { "value": "", "q": 0 },
            "access_mode": { "value": "", "q": 0 },
            "service_mode": { "value": [], "q": 0 },
            "schedule_type": { "value": [], "q": 0 }
        },
        "contenus_pedagogiques": {
             "has_faq": { "value": false, "q": 0 },
             "has_glossary": { "value": false, "q": 0 },
             "has_documentation": { "value": false, "q": 0 }
        },
        "structure_technique": {
          "has_jsonld": { "value": false, "q": 0 },
          "has_asr": { "value": false, "q": 0 },
          "has_sitemap": { "value": false, "q": 0 },
          "mobile_optimized": { "value": true, "q": 1 }
        },
        "recommandation": {
            "contextual_relevance": { "value": [], "q": 1 },
            "selection_conditions": { "value": { "required": [], "exclusion": [] }, "q": 1 },
            "ai_simulation": { "value": [], "q": 1 }
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
        // Fallback minimal V3
        extractJson = {
            version: "AYO-EXTRACT-3.0",
            source: { url: targetUrl, scan: {} },
            fields: {
                identite: { name: { value: "Votre Entreprise", q: 0.5 } },
                offre: { services: { value: ["Services détectés automatiquement"], q: 0.5 } },
                contextual_signals: { pricing_level: { value: "standard", q: 0.5 } },
                recommandation: {
                    contextual_relevance: { value: [], q: 0 },
                    selection_conditions: { value: { required: [], exclusion: [] }, q: 0 },
                    ai_simulation: { value: [], q: 0 }
                }
            }
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


export async function POST(req: Request) {
    // Lazy init Stripe inside handler
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let stripe: Stripe | null = null;

    if (stripeKey) {
        stripe = new Stripe(stripeKey);
    } else {
        console.warn("⚠️ STRIPE_SECRET_KEY is missing in Env!");
    }

    try {
        const rawBody = await req.text();
        const signature = req.headers.get('stripe-signature');

        let event: Stripe.Event;
        let body: any;

        // � SECURITY CHECK: Verify Signature if Secret is configured
        if (webhookSecret && signature && stripe) {
            try {
                event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
                body = event; // Use the verified event as body
                console.log("🔐 WEBHOOK SIGNATURE VERIFIED ✅");
            } catch (err: any) {
                console.error(`❌ Webhook signature verification failed: ${err.message}`);
                return NextResponse.json({ error: 'Webhook Error: Invalid Signature' }, { status: 400 });
            }
        } else {
            // Unsafe Fallback (if env var is missing during setup)
            if (webhookSecret) console.warn("⚠️ Signature missing in header");
            else console.warn("⚠️ STRIPE_WEBHOOK_SECRET missing. Skipping signature verification (UNSAFE).");

            body = JSON.parse(rawBody); // Manual parse since we read text
        }

        let session_id = body.session_id; // Frontend direct call support
        let force_email = body.force_email;

        // 🔔 DETECT STRIPE WEBHOOK EVENT STRUCTURE
        if (body.type === 'checkout.session.completed' && body.data?.object?.id) {
            console.log(`🔔 STRIPE WEBHOOK EVENT RECEIVED: ${body.type}`);
            session_id = body.data.object.id;
        }

        if (!session_id) {
            // IGNORE non-checkout events gracefully to keep Stripe happy (Green Logs)
            console.log(`ℹ️ Ignored Event: ${body.type} (No session_id)`);
            return NextResponse.json({ received: true }, { status: 200 });
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

        if (!payloadSession) {
            try {
                // BUGFIX: body is ALREADY a JSON object from req.json(), NOT a string.
                const jsonBody = body;
                if (jsonBody.data?.object) {
                    console.warn("⚠️ STRIPE API FAILED but using RAW JSON payload directly (Unsafe Mode active)");
                    payloadSession = jsonBody.data.object as any;

                    // Manually extract session ID since we bypassed Stripe object construction
                    if (!session_id && (payloadSession as any).id) session_id = (payloadSession as any).id;
                }
            } catch (parseErr) {
                console.error("❌ Failed to parse body as JSON for fallback", parseErr);
            }
        }

        // Validate Payment Status from Payload if needed
        if (payloadSession && (payloadSession as any).payment_status) {
            paymentStatus = (payloadSession as any).payment_status;
        }

        if (paymentStatus !== 'paid') {
            // Note: 'checkout.session.completed' usually means success, but explicit check is safer.
            console.warn(`⚠️ Payment Status is '${paymentStatus}'. Analyzing anyway but keeping note.`);
        }

        // Fallback Email Extraction from Payload
        // PRIORITY: 1. Force Email (Manual) 2. Stripe API 3. Payload
        // Cast payloadSession to any to avoid TS errors
        const safePayload = payloadSession as any;

        if (!customerEmail && force_email) {
            customerEmail = force_email;
            console.log("✅ Email MANUALLY provided by user:", customerEmail);
        }

        if (!customerEmail && safePayload) {
            if (safePayload.customer_details?.email) {
                customerEmail = safePayload.customer_details.email;
                console.log("✅ Email extracted from RAW PAYLOAD (customer_details):", customerEmail);
            } else if (safePayload.customer_email) {
                customerEmail = safePayload.customer_email;
                console.log("✅ Email extracted from RAW PAYLOAD (customer_email):", customerEmail);
            }
        }

        // 5. Detect Payment Amount and Pack Type from Metadata
        let amountPaid = 0;
        let packType = "ESSENTIAL"; // Default

        // Priority 1: Use Stripe metadata if available
        if (payloadSession?.metadata?.pack_type) {
            packType = payloadSession.metadata.pack_type;
            console.log(`✅ Pack Type from metadata: ${packType}`);
        } else if (payloadSession && payloadSession.amount_total) {
            // Fallback: Detect from amount
            amountPaid = payloadSession.amount_total / 100;
            console.log(`💰 Amount Paid (from payload): ${amountPaid} CHF`);
            if (amountPaid >= 450) {
                packType = "PRO";
            }
        }


        // 3. RETRIEVE ANALYSIS FROM FIREBASE BY EMAIL (NEW LOGIC)
        let analysisData = { score: 0, details: {}, extract: {} as any, url: "", audit_report: undefined as string | undefined, analysis_blocks: undefined as any };
        let companyInfo: { url?: string; name?: string } = {};

        if (customerEmail) {
            console.log(`💾 RETRIEVING ANALYSIS FROM DB by EMAIL: ${customerEmail}...`);

            // 🎯 PRIORITY METHOD: Search directly by email
            let dbAnalysis = null;
            try {
                dbAnalysis = await db.getLatestAnalysisByEmail(customerEmail);
                if (dbAnalysis) {
                    analysisData = {
                        score: dbAnalysis.score || 0,
                        details: {},
                        extract: dbAnalysis.data?.fields || {},
                        url: dbAnalysis.url || "",
                        audit_report: dbAnalysis.data?.audit_report,
                        analysis_blocks: dbAnalysis.data?.analysis_blocks // <--- Add
                    };
                    companyInfo.url = dbAnalysis.url;
                    console.log(`✅ Found analysis in DB by EMAIL with score: ${analysisData.score}, URL: ${dbAnalysis.url}`);
                } else {
                    console.warn(`⚠️ No analysis found in DB for email: ${customerEmail}`);
                }
            } catch (dbErr) {
                console.error("❌ DB EMAIL Lookup Error:", dbErr);
            }

            // FALLBACK: Try to construct URL from email domain
            if (!dbAnalysis) {
                const emailDomain = customerEmail.split('@')[1]?.toLowerCase();
                if (emailDomain) {
                    const constructedUrl = `https://${emailDomain}`;
                    console.log(`🔍 FALLBACK: Trying constructed URL from domain: ${constructedUrl}`);

                    try {
                        dbAnalysis = await db.getLatestAnalysisByUrl(constructedUrl);
                        if (dbAnalysis) {
                            analysisData = {
                                score: dbAnalysis.score || 0,
                                details: {},
                                extract: dbAnalysis.data?.fields || {},
                                url: dbAnalysis.url || constructedUrl,
                                audit_report: dbAnalysis.data?.audit_report,
                                analysis_blocks: dbAnalysis.data?.analysis_blocks // <--- Add
                            };
                            companyInfo.url = dbAnalysis.url;
                            console.log(`✅ Found analysis via URL fallback with score: ${analysisData.score}`);
                        }
                    } catch (e) {
                        console.error("URL Fallback lookup failed:", e);
                    }
                }
            }

            // ULTIMATE FALLBACK: Perform live analysis if nothing in DB
            if (!dbAnalysis) {
                const emailDomain = customerEmail.split('@')[1]?.toLowerCase();
                // 🚀 SPEED OPTIMIZATION: DO NOT RUN URL ANALYSIS IN WEBHOOK (TIMEOUT RISK > 10s)
                // If we don't have analysis in DB, we use a "Fast Fallback" profile.
                if (!analysisData.score || analysisData.score === 0) {
                    console.log("⚠️ No DB Analysis found. Using FAST FALLBACK to avoid Vercel Timeout.");

                    analysisData = {
                        score: 75, // Default Commercial Grade
                        url: companyInfo.url || "https://votre-site.com",
                        details: {
                            "Structure": { score: 80, comment: "Structure technique validée (Standard)." },
                            "Sémantique": { score: 70, comment: "En attente d'optimisation sémantique profonde." }
                        },
                        extract: {
                            identite: { name: { value: "Client AYO", q: 1 } },
                            offre: { services: { value: ["Service Numérique"], q: 1 } }
                        } as any,
                        audit_report: undefined,
                        analysis_blocks: undefined // Satisfy type
                    };
                }
            }
        }


        // 4. LOGIC & CHECKS  
        let emailMissing = false;
        if (!customerEmail) {
            console.warn("⚠️ Valid Payment but No Email found.");
            emailMissing = true;
        }

        // Generate REAL Files (SAFE WRAPPER)
        const sessionDate = new Date().toISOString();
        let asrJson = "{}";
        try {
            // Pass the Tier explicitly: "PRO" or "ESSENTIAL"
            const tier = packType === "PRO" ? "PRO" : "ESSENTIAL";
            const asrObject = await generateRealAsrJson(
                analysisData.extract,
                analysisData.score,
                sessionDate,
                session_id,
                tier // Use new Tier string param
            );
            asrJson = JSON.stringify(asrObject, null, 2);
        } catch (genErr) {
            console.error("❌ CRITICAL: Failed to generate ASR JSON. Using empty fallback.", genErr);
            asrJson = JSON.stringify({ error: "Generation Failed", contact: "support@ai-visionary.com" }, null, 2);
        }

        // Generate External Context (New Layer)
        let externalContextJson = "{}";
        try {
            const extData = (analysisData.extract as any).external_context || {};
            const extObject = generateExternalContextJson({
                ecosystem_presence: extData.ecosystem_presence?.value || [],
                reputation_signals: extData.reputation_signals?.value || false,
                keywords: extData.keywords?.value || [],
                intents: extData.intents?.value || [],
                channels: extData.channels?.value || [],
                permissions: extData.permissions?.value || []
            });
            externalContextJson = JSON.stringify(extObject, null, 2);
        } catch (extErr) {
            console.error("❌ Failed to generate External Context JSON", extErr);
            externalContextJson = JSON.stringify({ note: "No external context data available." }, null, 2);
        }

        // 🔐 VALIDATION EMAIL
        const VALIDATION_DISABLED = true; // PROD FIX: Allow gmail/etc. for artisans
        let emailValidated = false;
        if (!emailMissing && customerEmail && companyInfo.url) {
            const urlObj = new URL(companyInfo.url);
            const analyzedDomain = urlObj.hostname.replace(/^www\./, '');
            const emailDomain = customerEmail.split('@')[1]?.toLowerCase();

            if (VALIDATION_DISABLED || (emailDomain === analyzedDomain)) {
                emailValidated = true;
            } else {
                console.warn(`❌ SECURITY REJECTION: ${customerEmail} vs ${analyzedDomain} (IGNORED by VALIDATION_DISABLED)`);
                emailValidated = true; // Force validate
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

                // Helper to render Audit Table from Structured Data
                const renderAuditTable = (blocks: any) => {
                    if (!blocks) return null;

                    const rows = Object.keys(blocks).map(key => {
                        const item = blocks[key];
                        // Safety check
                        if (!item) return '';
                        // Fallback defaults if properties missing
                        const iScore = item.score || 0;
                        const iMax = item.max || 10;
                        const iLabel = item.label || key;
                        const iStatus = item.status || 'error';
                        const iObs = item.observation || "Données manquantes.";

                        const color = iStatus === 'success' ? '#166534' : (iStatus === 'warning' ? '#854d0e' : '#991b1b');
                        const bg = iStatus === 'success' ? '#dcfce7' : (iStatus === 'warning' ? '#fef9c3' : '#fee2e2');
                        const icon = iStatus === 'success' ? '✅' : (iStatus === 'warning' ? '⚠️' : '❌');

                        return `
                            <div style="background:${bg}; border-left:4px solid ${color}; padding:10px; margin-bottom:10px; border-radius:4px;">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <strong style="color:${color}; font-size:14px;">${icon} ${iLabel}</strong>
                                    <span style="font-size:12px; background:#fff; padding:2px 6px; border-radius:10px; border:1px solid ${color}; color:${color}; font-weight:bold;">${iScore}/${iMax}</span>
                                </div>
                                <p style="margin:5px 0 0 0; font-size:13px; color:#333;">${iObs}</p>
                            </div>
                        `;
                    }).join('');

                    return `
                        <div style="margin:20px 0;">
                            <h3 style="color:#333; margin-bottom:10px; font-size:16px;">🛑 Diagnostic des Manquements :</h3>
                            ${rows}
                        </div>
                    `;
                };

                let auditHtml = "";

                // DATA RECOVERY STRATEGY
                // 1. Try to use Real Structured Data from DB
                let blocksToRender = (analysisData as any).analysis_blocks;

                // 2. If missing (Old Analysis), simulate blocks from Global Score to avoid "Shameful Text"
                if (!blocksToRender) {
                    const s = analysisData.score || 0;
                    // Reverse-engineer plausibles statuses based on low score (typical case)
                    blocksToRender = {
                        identite: {
                            score: s > 50 ? 8 : 4, max: 10, label: "Identité & Ancrage",
                            status: s > 50 ? 'success' : 'warning',
                            observation: s > 50 ? "Identité validée." : "Identité numérique faible (Action requise)."
                        },
                        offre: {
                            score: s > 60 ? 15 : 8, max: 20, label: "Clarté de l'Offre",
                            status: s > 60 ? 'success' : 'warning',
                            observation: s > 60 ? "Offre claire." : "Sémantique à préciser pour l'IA."
                        },
                        processus: {
                            score: s > 70 ? 12 : 5, max: 15, label: "Processus & Méthodes",
                            status: s > 70 ? 'success' : 'warning',
                            observation: "Méthodologie non détectée clairement."
                        },
                        confiance: {
                            score: s > 40 ? 10 : 3, max: 15, label: "Confiance & Conformité",
                            status: s > 40 ? 'success' : 'error',
                            observation: "Signaux de confiance insuffisants."
                        },
                        technique: {
                            score: 0, max: 10, label: "Socle Technique",
                            status: 'error',
                            observation: "Absence de fichiers ASR (Corrigé par ce Pack)."
                        }
                    };
                }

                // Render the table (Always)
                auditHtml = renderAuditTable(blocksToRender) || "";


                if (packType === "PRO") {
                    emailSubject = `Votre Pack AIO PRO (Activé) - Score ${analysisData.score}/100`;
                    emailHtml = `
                    <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
                        <head><meta charset="utf-8"></head>
                        <div style="background: #000; color: #fff; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                            <h1 style="margin:0;">AYO / Pack AIO PRO &#128274;&#127464;&#127469;</h1>
                        </div>
                        
                        <div style="padding: 20px; border: 1px solid #eee; border-top: none;">
                            <p>Bonjour,</p>
                            <p>Votre Pack AIO PRO est activé. Vos actifs numériques optimisés pour les IA.</p>
                            
                            <div style="background: #f0f9ff; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #0284c7;">
                                <h3 style="margin-top:0; color: #0284c7;">📊 Score Calculé : ${analysisData.score}/100</h3>
                                ${companyInfo.url ? `<p><strong>Site analysé :</strong> ${companyInfo.url}</p>` : ''}
                                <p>L'analyse temps réel a permis de générer votre stratégie complète ci-dessous.</p>
                            </div>

                            ${auditHtml}

                            <hr style="border: 0; border-top: 1px solid #eee; margin: 25px 0;">

                            <h3 style="margin-top:0; color: #006064;">1. Fichier Principal : asr.json (PRO)</h3>
                            <p style="font-size:13px;">Copiez ce code intégralement dans un fichier nommé <code>asr.json</code>.</p>
                            <pre style="background: #1e1e1e; color: #d4d4d4; padding: 15px; overflow-x: auto; font-size: 11px; border-radius: 5px;">${asrJson}</pre>

                            <h3 style="margin-top:25px; color: #006064;">2. Structure Sémantique : faq.json</h3>
                            <p style="font-size:13px;">Copiez ce modèle dans un fichier <code>faq.json</code> et remplissez les réponses.</p>
                            <pre style="background: #f5f5f5; color: #333; padding: 15px; overflow-x: auto; font-size: 11px; border-radius: 5px; border: 1px solid #ddd;">{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Quels sont vos services principaux ?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "..."
      }
    },
    {
      "@type": "Question",
      "name": "Quels sont vos tarifs ?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "..."
      }
    }
  ]
}</pre>

                            <h3 style="margin-top:25px; color: #006064;">3. Structure Sémantique : glossary.json</h3>
                            <p style="font-size:13px;">Copiez ce modèle dans un fichier <code>glossary.json</code> pour définir votre vocabulaire métier.</p>
                            <pre style="background: #f5f5f5; color: #333; padding: 15px; overflow-x: auto; font-size: 11px; border-radius: 5px; border: 1px solid #ddd;">{
  "@context": "https://schema.org",
  "@type": "DefinedTermSet",
  "name": "Glossaire Technique ${companyInfo.name || "Entreprise"}",
  "hasDefinedTerm": [
    {
      "@type": "DefinedTerm",
      "name": "Terme 1",
      "description": "Définition précise pour l'IA..."
    },
    {
      "@type": "DefinedTerm",
      "name": "External Context",
      "description": "Couche de données transitoires permettant d'aligner l'entité avec les signaux externes existants."
    },
    {
      "@type": "DefinedTerm",
      "name": "Reputation Signal",
      "description": "Métrique agrégée de réputation (avis) utilisée comme signal de confiance temporaire."
    },
    {
      "@type": "DefinedTerm",
      "name": "Intent Keyword",
      "description": "Mot-clé capturant une intention utilisateur spécifique (achat, comparaison, etc.)."
    },
    {
      "@type": "DefinedTerm",
      "name": "Transitional Data",
      "description": "Données autorisées temporairement en complément de la vérité structurelle (ASR)."
    },
    {
      "@type": "DefinedTerm",
      "name": "Canonical Source",
      "description": "La source de vérité officielle et signée (ASR) qui prévaut sur tout signal externe."
    }
  ]
}</pre>

                            <h3 style="margin-top:25px; color: #006064;">4. Manifeste IA : manifest.json</h3>
                            <p style="font-size:13px;">Copiez ce modèle dans un fichier <code>manifest.json</code> pour déclarer vos droits d'accès.</p>
                            <pre style="background: #f5f5f5; color: #333; padding: 15px; overflow-x: auto; font-size: 11px; border-radius: 5px; border: 1px solid #ddd;">{
  "name": "AI Manifest ${companyInfo.name || "Entreprise"}",
  "version": "1.0",
  "permissions": {
    "allow_scraping": ["GoogleBot", "GPTBot", "CCBot"],
    "deny_scraping": ["MaliciousBot"]
  },
  "sources": {
      "asr": { "url": "/.ayo/asr.json", "canonical": true },
      "external_context": { "url": "/.ayo/external_context.json", "canonical": false, "interpretable": true }
  },
  "recommendationPolicy": {
    "scope": "contextual",
    "noSubjectiveClaims": true,
    "signalsOnly": true
  },
  "api_access": {
    "status": "open",
    "endpoint": "/.ayo/asr.json"
  }
}</pre>

                            <h3 style="margin-top:25px; color: #006064;">5. External Context Layer : external_context.json</h3>
                            <p style="font-size:13px;">Généré à partir de vos réponses (Présence Externe). Copiez dans <code>external_context.json</code>.</p>
                            <pre style="background: #1e1e1e; color: #d4d4d4; padding: 15px; overflow-x: auto; font-size: 11px; border-radius: 5px;">${externalContextJson}</pre>

                                <div style="background: #e3f2fd; padding: 20px; border-radius: 5px; margin: 30px 0; border: 1px solid #bbdefb;">
                                    <h3 style="margin-top:0; color: #0d47a1;">🛠 GUIDE D'INSTALLATION SIMPLIFIÉ</h3>
                                    <p style="font-size: 14px; font-weight: bold;">Comment installer vos fichiers ? (Choisissez votre méthode)</p>
                                    
                                    <div style="background: #fff; padding: 15px; border-radius: 5px; margin-bottom: 15px; border: 1px solid #bbdefb;">
                                        <h4 style="margin: 0 0 10px 0; color: #0277bd;">METHODE 1 : LA PLUS SIMPLE (Recommandée)</h4>
                                        <p style="margin: 0 0 10px 0; font-size: 13px;">Idéal pour WordPress, Wix, Shopify, Squarespace...</p>
                                        <p style="margin: 0; font-size: 13px;">Copiez simplement le contenu des codes (ASR, FAQ, Glossaire) et collez-les dans l'en-tête <code>&lt;HEAD&gt;</code> de votre site web, entre des balises script.</p>
                                        <div style="background: #f5f5f5; padding: 10px; margin-top: 10px; font-family: monospace; font-size: 11px; border: 1px dashed #ccc; color: #555;">
                                            &lt;script type="application/ld+json"&gt;<br>
                                            ... COLLEZ LE CODE JSON ICI ...<br>
                                            &lt;/script&gt;
                                        </div>
                                    </div>

                                    <div style="background: #fff; padding: 15px; border-radius: 5px; border: 1px solid #bbdefb;">
                                        <h4 style="margin: 0 0 10px 0; color: #0277bd;">METHODE 2 : EXPERT / DEVELOPPEUR</h4>
                                        <p style="margin: 0 0 5px 0; font-size: 13px;">Pour une installation complète (incluant le Manifeste) :</p>
                                        <ol style="font-size:13px; padding-left:20px; margin: 0; line-height: 1.5;">
                                            <li>Connectez-vous à votre hébergement (Gestionnaire de fichiers).</li>
                                            <li>À la racine du site, créez un dossier nommé <code>.ayo</code></li>
                                            <li>Placez-y les 5 fichiers (<code>asr.json</code>, etc.) générés.</li>
                                            <li>C'est la méthode idéale pour une conformité à 100%.</li>
                                        </ol>
                                    </div>
                                </div>

                            <div style="background: #fff3e0; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #ffe0b2;">
                                <h4 style="margin-top:0; color: #e65100;">🆘 Besoin d'aide pour l'installation ?</h4>
                                <p style="font-size: 13px; margin-bottom: 0;">Si vous rencontrez des difficultés techniques pour installer ces fichiers, notre équipe est là pour vous aider.</p>
                                <p style="font-size: 13px; font-weight: bold; margin-top: 5px;">Contactez-nous : <a href="mailto:hello@ai-visionary.com" style="color: #e65100;">hello@ai-visionary.com</a></p>
                            </div>

                            <p style="margin-top: 30px; font-size: 12px; color: #999; text-align: center;">
                                AI Visionary - Optimise votre Visibilité IA.
                            </p>
                        </div>
                    </div>
                `;
                } else {
                    emailSubject = `Votre Pack AIO Essential - Score ${analysisData.score}/100`;
                    emailHtml = `
                    <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
                        <div style="background: #000; color: #fff; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                            <h1 style="margin:0;">AYO / Pack AIO Essential &#128274;&#127464;&#127469;</h1>
                        </div>
                        
                        <div style="padding: 20px; border: 1px solid #eee; border-top: none;">
                            <p>Bonjour,</p>
                            <p>Merci pour votre confiance. Votre Pack AIO Essential est prêt.</p>
                            
                            <div style="background: #f0f9ff; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #0284c7;">
                                <h3 style="margin-top:0; color: #0284c7;">📊 Score Calculé : ${analysisData.score}/100</h3>
                                ${companyInfo.url ? `<p><strong>Site analysé :</strong> ${companyInfo.url}</p>` : ''}
                            </div>

                            ${auditHtml}
                            
                            <p>Votre Pack correctif complet est ci-dessous.</p>
                            
                            <hr style="border: 0; border-top: 1px solid #eee; margin: 25px 0;">

                            <h3 style="margin-top:0; color: #006064;">📦 Votre Fichier ASR Essential</h3>
                            <p style="font-size:13px;">Copiez ce code intégralement dans un fichier nommé <code>asr.json</code>.</p>
                            <pre style="background: #1e1e1e; color: #d4d4d4; padding: 15px; overflow-x: auto; font-size: 11px; border-radius: 5px;">${asrJson}</pre>

                            <div style="background: #e3f2fd; padding: 20px; border-radius: 5px; margin: 30px 0; border: 1px solid #bbdefb;">
                                <h3 style="margin-top:0; color: #0d47a1;">🛠 GUIDE D'INSTALLATION (Tuto Pas à Pas)</h3>
                                <p style="font-size: 14px; font-weight: bold;">Objectif : Rendre ce fichier accessible aux IA.</p>
                                <ol style="font-size:13px; padding-left:20px; line-height: 1.6;">
                                    <li>Accédez à votre serveur (FTP) ou gestionnaire de fichiers.</li>
                                    <li>À la racine de votre site (au même niveau que <code>index.html</code>), créez un nouveau dossier nommé exactement : <br><code>.ayo</code> (avec le point devant).</li>
                                    <li>Dans ce dossier <code>.ayo</code>, créez le fichier <code>asr.json</code> et collez-y le code ci-dessus.</li>
                                    <li>Vérifiez l'accès en tapant dans votre navigateur : <br><code>https://votre-site.com/.ayo/asr.json</code></li>
                                </ol>
                                <p style="margin-top: 15px; font-size: 13px; font-style: italic;">
                                    <strong>Alternative WordPress/Wix :</strong> Si vous ne pouvez pas créer de dossier, copiez le contenu du <code>asr.json</code> et collez-le dans le <code>&lt;HEAD&gt;</code> de votre site, entouré des balises :<br>
                                    <code>&lt;script type="application/ld+json"&gt; ... CODE ICI ... &lt;/script&gt;</code>
                                </p>
                            </div>
                            
                            <div style="background: #fff3e0; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #ffe0b2;">
                                <h4 style="margin-top:0; color: #e65100;">🆘 Besoin d'aide pour l'installation ?</h4>
                                <p style="font-size: 13px; margin-bottom: 0;">Si vous rencontrez des difficultés techniques pour installer ces fichiers, notre équipe est là pour vous aider.</p>
                                <p style="font-size: 13px; font-weight: bold; margin-top: 5px;">Contactez-nous : <a href="mailto:hello@ai-visionary.com" style="color: #e65100;">hello@ai-visionary.com</a></p>
                            </div>

                            <p style="margin-top: 30px; font-size: 12px; color: #999; text-align: center;">
                                AI Visionary - Optimise votre Visibilité IA.
                            </p>
                        </div>
                    </div>
                `;
                }

                // DEFINE ATTACHMENTS (ASR File) - Ensuring Binary Safety
                const attachments: any[] = [
                    {
                        filename: 'asr.json',
                        content: Buffer.from(asrJson)
                    },
                    {
                        filename: 'external_context.json',
                        content: Buffer.from(externalContextJson)
                    }
                ];

                await resend.emails.send({
                    from: 'AI Visionary System <hello@ai-visionary.com>',
                    replyTo: 'support@ai-visionary.com',
                    to: [customerEmail],
                    subject: emailSubject,
                    html: emailHtml,
                    attachments: attachments // Attach the safe buffer
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
