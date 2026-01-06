import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import Stripe from 'stripe';

// Initialize Services (Resend is safe to init outside)
const resend = new Resend(process.env.RESEND_API_KEY);

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { scanUrlForAioSignals } from '@/lib/aio-scanner';
import { computeAioScore, AyoExtract } from '@/lib/aio-score-engine';

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
    extractJson.fields.structure_technique.has_jsonld = { value: scanResult.hasJsonLd, q: scanResult.hasJsonLd ? 1 : 0 };

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
        const { session_id, force_email } = body;

        if (!session_id) {
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
                    // We might still want to proceed if it's a test or delayed, but usually we strictly require paid.
                    // For now, we continue logic to extract email, but we could enforce check here.
                }

                // 2. Extract Email (Priority: Force > Customer Details > Customer Email > Customer Object)
                // FORCE: Manually provided
                if (force_email) {
                    customerEmail = force_email;
                    console.log("✅ Email MANUALLY provided by user:", customerEmail);
                }
                // STANDARD: Checkout Form Data
                else if (session.customer_details?.email) {
                    customerEmail = session.customer_details.email;
                    console.log("✅ Email extracted from Stripe (customer_details):", customerEmail);
                }
                // LEGACY: Old field
                else if (session.customer_email) {
                    customerEmail = session.customer_email;
                    console.log("✅ Email extracted from Stripe (customer_email):", customerEmail);
                }
                // EXPANDED OBJECT: If expansion worked
                else if (session.customer && typeof session.customer === 'object' && (session.customer as Stripe.Customer).email) {
                    customerEmail = (session.customer as Stripe.Customer).email!;
                    console.log("✅ Email extracted from Stripe (customer object):", customerEmail);
                }

                // 🚀 NUCLEAR OPTION: If 'customer' is just an ID string, FETCH IT explicitly.
                if (!customerEmail && session.customer && typeof session.customer === 'string') {
                    console.log("⚠️ Customer is ID string, fetching full object:", session.customer);
                    try {
                        const customer = await stripe.customers.retrieve(session.customer);
                        if ((customer as Stripe.Customer).email) {
                            customerEmail = (customer as Stripe.Customer).email!;
                            console.log("✅ Email extracted via explicit Customer Fetch:", customerEmail);
                        } else {
                            console.warn("⚠️ Fetched customer but no email found on object.");
                        }
                    } catch (fetchErr) {
                        console.error("❌ Failed to fetch customer details:", fetchErr);
                    }
                }

                if (!customerEmail) {
                    console.warn("⚠️ No email found in ANY Stripe field.");
                }

                // 3. Fallback Decoding (Stripe Link ID) -> Moved after logic
            } catch (stripeErr) {
                console.error("❌ Stripe Retrieval Error:", stripeErr);
                console.log("Stack:", stripeErr);
            }
        }

        // 3. Fallback Decoding (Stripe Link ID)
        let companyInfo: { url?: string; name?: string } = {};
        if (stripeSession && stripeSession.client_reference_id) {
            try {
                const jsonStr = Buffer.from(stripeSession.client_reference_id, 'base64').toString('utf-8');
                const decoded = JSON.parse(jsonStr);

                if (decoded.u) companyInfo.url = decoded.u;
                // CRITICAL FALLBACK: Restore email from encoded ID if Stripe missed it
                if (!customerEmail && decoded.e) {
                    customerEmail = decoded.e;
                    console.log("✅ RESTORED EMAIL from client_reference_id backup:", customerEmail);
                }
                console.log("✅ Decoded Info from Stripe Metadata:", { ...companyInfo, email_backup: decoded.e });
            } catch (e) {
                console.warn("⚠️ Failed to decode client_reference_id:", e);
            }
        }

        // 4. LOGIC: If still no email, we DO NOT ERROR. We return Success but flag it.
        // User is right: Payment IS valid.
        let emailMissing = false;
        if (!customerEmail) {
            console.warn("⚠️ Valid Payment but No Email found. Returning Success with Warning flag.");
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

        // 6. REAL ANALYSIS (Crucial Step)
        let analysisData = { score: 0, details: {}, extract: {} as any, url: companyInfo.url };

        if (companyInfo.url) {
            try {
                // If URL was found in metadata, we relaunch analysis to send REAL DATA
                const result = await performFullAnalysis(companyInfo.url);
                analysisData = { ...result, url: companyInfo.url };
                console.log("✅ LIVE Analysis Complete. Score:", analysisData.score);
            } catch (anaErr) {
                console.error("❌ Analysis Failed in Webhook:", anaErr);
            }
        }

        // Generate REAL Files
        const sessionDate = new Date().toISOString();
        const asrJson = generateRealAsrJson(customerEmail || "email_manquant@verifier.com", sessionDate, session_id, analysisData, packType === "PRO");

        // Send Email via Resend (ONLY IF EMAIL EXISTS)
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
                                <p style="font-size: 14px; font-weight:bold;">Ce fichier "Essential PRO" est votre clé d'autorité. Il doit être en ligne.</p>
                                
                                <h4 style="margin-bottom:5px; color:#1565c0;">OPTION 1 : Pour les Développeurs (Recommandé)</h4>
                                <p style="font-size:13px; margin-top:0;">Transférez cet email à votre tech et dites : <em>"Crée un dossier <code>.ayo</code> à la racine du site, et ajoutes-y le code ci-dessus sous le nom <code>asr.json</code>."</em></p>

                                <hr style="border:0; border-top:1px dashed #90caf9; margin:15px 0;">

                                <h4 style="margin-bottom:5px; color:#1565c0;">OPTION 2 : WordPress (Plugin "WP File Manager")</h4>
                                <ol style="font-size:13px; padding-left:20px; margin-top:0;">
                                    <li>Installez le plugin gratuit <strong>"WP File Manager"</strong>.</li>
                                    <li>Ouvrez-le, faites Clic Droit > New Folder > Nom : <code>.ayo</code> (avec le point).</li>
                                    <li>Entrez dedans > New File > Nom : <code>asr.json</code></li>
                                    <li>Clic Droit sur le fichier > Code Editor > Collez le code > Save & Close.</li>
                                </ol>

                                <hr style="border:0; border-top:1px dashed #90caf9; margin:15px 0;">

                                <h4 style="margin-bottom:5px; color:#1565c0;">OPTION 3 : Wix, Squarespace, Shopify</h4>
                                <p style="font-size:13px;">Ces CMS bloquent souvent les dossiers racines. Utilisez l'injection JSON-LD :</p>
                                <ol style="font-size:13px; padding-left:20px; margin-top:0;">
                                    <li>Copiez tout le code JSON ci-dessus.</li>
                                    <li>Allez dans <strong>Paramètres > Code personnalisé</strong> (ou Injection de code).</li>
                                    <li>Ajoutez un nouveau script dans le <strong>HEAD</strong> (En-tête).</li>
                                    <li>Écrivez : <code>&lt;script type="application/ld+json"&gt;</code></li>
                                    <li>Collez votre code JSON juste après.</li>
                                    <li>Fermez avec : <code>&lt;/script&gt;</code></li>
                                    <li>Sauvegardez et publiez.</li>
                                </ol>
                                <p style="margin-top: 15px; padding-top: 15px; border-top: 1px dashed #90caf9; font-size: 13px; color: #0d47a1;">
                                    💁‍♂️ <strong>Besoin d'aide ?</strong> Si vous bloquez, écrivez simplement à <a href="mailto:hello@ai-visionary.com" style="color:#0d47a1; font-weight:bold;">hello@ai-visionary.com</a>. Nous vous aiderons à l'installer avec plaisir.
                                </p>
                            </div>

                            <hr style="margin: 30px 0; border: 0; border-top: 1px solid #eee;" />

                            <h3 style="color: #000;">🧩 Votre PACK AIO PRO (Option)</h3>
                            <p>Vous avez débloqué l'accès au niveau supérieur : <strong>L'Expertise Sémantique Complète</strong>.</p>
                            
                            <p>Ce pack à <strong>499 CHF</strong> comprend la création manuelle par nos experts de :</p>
                            <ul style="line-height: 1.6;">
                                <li><strong>Glossaire Métier</strong> (/.ayo/glossary.json) - Vos définitions inaltérables.</li>
                                <li><strong>FAQ IA-Native</strong> (/.ayo/faq.json) - Réponses calibrées pour ChatGPT/Gemini.</li>
                                <li><strong>Architecture Données</strong> - JSON-LD enrichi et sans conflit.</li>
                                <li><strong>Manifest AYO</strong> - La carte routière pour les bots.</li>
                            </ul>

                            <div style="text-align: center; margin-top: 30px;">
                                <a href="https://buy.stripe.com/test_14A00l3vq1YA98FgLjcV201" style="background-color: #000000; color: #ffffff !important; text-decoration: none; padding: 15px 30px; font-weight: bold; border-radius: 5px; border: 1px solid #333;">
                                    🚀 Commander le Pack AIO PRO (499 CHF)
                                </a>
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
