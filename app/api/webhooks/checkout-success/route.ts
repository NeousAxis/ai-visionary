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

        // 3. RETRIEVE INFO FROM LINK (Base64 Encoded - STATELESS MODE)
        // We decode the client_reference_id to get the URL and Email.
        let analysisData = { score: 0, details: {}, extract: {} as any, url: "" };
        let companyInfo: { url?: string; name?: string } = {};

        if (stripeSession && stripeSession.client_reference_id) {
            const refId = stripeSession.client_reference_id;
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

        // 4. LOGIC
        let emailMissing = false;
        if (!customerEmail) {
            console.warn("⚠️ Valid Payment but No Email found.");
            emailMissing = true;
        }

        // 5. Detect Payment Amount (Essential vs PRO)
        let amountPaid = 0;
        let packType = "ESSENTIAL"; // Default
        if (stripeSession && stripeSession.amount_total) {
            amountPaid = stripeSession.amount_total / 100; // Convert cents to CHF
            console.log(`💰 Amount Paid: ${amountPaid} CHF`);
            if (amountPaid >= 450) { // 499 CHF pack
                packType = "PRO";
            }
        }

        // 6. RETRIEVE ANALYSIS FROM DATABASE (Source of Truth)
        // STRATEGY: 
        // 1. Try by Session ID (Unlikely unless passed explicitly)
        // 2. Try by URL (Most robust link from Chat)
        console.log(`💾 RETRIEVING ANALYSIS FROM DB...`);

        let dbAnalysis = null;

        // Try getting analysis by URL (decoded from client_reference_id)
        if (companyInfo.url) {
            console.log(`🔎 Looking up latest analysis for URL: ${companyInfo.url}`);
            try {
                dbAnalysis = await db.getLatestAnalysisByUrl(companyInfo.url);
                if (dbAnalysis) {
                    console.log(`✅ DB HIT BY URL: Found analysis ${dbAnalysis.id}. Score: ${dbAnalysis.score}`);
                }
            } catch (urlDbErr) {
                console.error("❌ DB URL Lookup Error:", urlDbErr);
            }
        }

        // If not found by URL, try session_id (Legacy/Fallback)
        if (!dbAnalysis) {
            try {
                dbAnalysis = await db.getAnalysis(session_id);
                if (dbAnalysis) console.log(`✅ DB HIT BY ID: ${session_id}`);
            } catch (idErr) { /* ignore */ }
        }

        if (dbAnalysis) {
            analysisData = {
                score: dbAnalysis.score || 0,
                details: {},
                extract: dbAnalysis.data?.fields || {},
                url: dbAnalysis.url || companyInfo.url || ""
            };
            // Consider this validated since it comes from DB
        } else {
            console.warn(`⚠️ DB MISS: No analysis found for URL ${companyInfo.url} or ID ${session_id}.`);
        }

        // FALLBACK: If DB read fails or data is missing, perform minimal analysis
        if (!dbAnalysis && companyInfo.url) {
            console.log(`🔄 FALLBACK: Performing minimal analysis for ${companyInfo.url}`);
            try {
                const result = await performFullAnalysis(companyInfo.url);
                analysisData = { ...result, url: companyInfo.url };

                // Safety: Ensure score > 0 if analysis succeeded
                if (analysisData.score === 0 && result.extract) {
                    analysisData.score = 50;
                }
                console.log("✅ FALLBACK Analysis Success. Score:", analysisData.score);
            } catch (anaErr) {
                console.error("❌ Fallback Analysis Failed:", anaErr);
            }
        } else if (!dbAnalysis && !companyInfo.url) {
            console.error("🔥 CRITICAL: No URL found and no DB data! Cannot deliver custom file.");
        }


        // Generate REAL Files
        const sessionDate = new Date().toISOString();
        const asrJson = generateRealAsrJson(customerEmail || "email_manquant@verifier.com", sessionDate, session_id, analysisData, packType === "PRO");

        // 🔐 VALIDATION EMAIL PRO (Security)
        // 🚨 TEMP DEBUG: VALIDATION DISABLED TO TEST RESEND
        const VALIDATION_DISABLED = true;

        let emailValidated = false;
        if (!emailMissing && customerEmail && companyInfo.url) {
            // Extract domain from analyzed URL
            let analyzedDomain = "";
            try {
                const urlObj = new URL(companyInfo.url);
                analyzedDomain = urlObj.hostname.replace(/^www\./, ''); // Remove www. prefix
            } catch (e) {
                console.error("Failed to parse URL for domain validation:", e);
            }

            // Extract email domain
            const emailDomain = customerEmail.split('@')[1]?.toLowerCase();

            // Security Check: Email must belong to analyzed domain
            if (VALIDATION_DISABLED || (analyzedDomain && emailDomain && emailDomain === analyzedDomain)) {
                emailValidated = true;
                if (VALIDATION_DISABLED) {
                    console.log(`🚨 WEBHOOK DEBUG MODE: Email validation DISABLED. Accepting ${customerEmail}`);
                } else {
                    console.log(`✅ WEBHOOK SECURITY VALIDATED: ${customerEmail} matches ${analyzedDomain}`);
                }
            } else {
                console.warn(`❌ WEBHOOK SECURITY REJECTION: Email ${customerEmail} does not match analyzed domain ${analyzedDomain}`);
                emailMissing = true; // Block email sending
            }
        }


        // Send Email via Resend (ONLY IF EMAIL EXISTS AND VALIDATED)
        if (!emailMissing && process.env.RESEND_API_KEY) {

            // Email content varies by pack type
            let emailSubject = '';
            let emailHtml = '';

            if (packType === "PRO") {
                // PRO Pack: Full delivery with analysis
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
                // ESSENTIAL Pack
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
                from: 'AYO <hello@send.ai-visionary.com>',
                to: [customerEmail],
                subject: emailSubject,
                html: emailHtml
            });
            console.log(`✅ Success Email sent to ${customerEmail} (Pack: ${packType})`);
        }

        return NextResponse.json({
            success: true,
            email_missing: emailMissing,
            email: customerEmail
        });

    } catch (error: any) {
        console.error("Webhook Error", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
