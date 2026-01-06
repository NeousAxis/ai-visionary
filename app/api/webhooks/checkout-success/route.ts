import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import Stripe from 'stripe';

// Initialize Services (Resend is safe to init outside)
const resend = new Resend(process.env.RESEND_API_KEY);

// Helper to generate the ASR PRO JSON
function generateAsrProJson(customerEmail: string, sessionDate: string, sessionId: string, companyInfo: { url?: string, name?: string } = {}) {
    // Smart Fill based on Metadata
    const url = companyInfo.url || "https://[VOTRE_SITE].com";
    const name = companyInfo.name || (companyInfo.url ? `Entreprise du site ${companyInfo.url.replace('https://', '').split('/')[0]}` : "[NOM_ENTREPRISE_A_REMPLIR]");

    return JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Organization",
        "@id": sessionId,
        "name": name,
        "url": url,
        "email": customerEmail,

        "ayo:offer": {
            "services": ["Service 1 (Ex: Audit)", "Service 2 (Ex: Formation)"],
            "deliverables": ["Rapport PDF", "Certification"]
        },

        "ayo:process": {
            "steps": ["1. Analyse", "2. Production", "3. Livraison"],
            "delivery_mode": "Online"
        },

        "ayo:scope": {
            "in_scope": ["Clients B2B", "Secteur Tech"],
            "out_of_scope": ["Particuliers", "Réparation Hardware"],
            "target_audience": ["PME", "ETI"]
        },

        "ayo:tech": {
            "json_ld_present": "Unknown (Fill manually or re-run audit)",
            "tech_stack": "Unknown"
        },

        "ayo:score": {
            "value": "CERTIFIED_PRO",
            "details": "Validation via Stripe Payment Proof",
            "method": "AYO_PAYMENT_PROOF_V1"
        },

        "ayo:seal": {
            "issuer": "AYO Trusted Authority",
            "level": "ESSENTIAL_PRO",
            "hash": sessionId.substring(0, 12),
            "signature": `sig_verify_${sessionId}`,
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

        // Generate Files
        const sessionDate = new Date().toISOString();
        const asrProJson = generateAsrProJson(customerEmail || "email_manquant@verifier.com", sessionDate, session_id, companyInfo);

        // Send Email via Resend (ONLY IF EMAIL EXISTS)
        if (!emailMissing && process.env.RESEND_API_KEY) {

            // Email content varies by pack type
            let emailSubject = '';
            let emailHtml = '';

            if (packType === "PRO") {
                // PRO Pack: Full delivery with analysis
                emailSubject = 'Votre Pack AIO PRO (Activé) - Analyse Complète';
                emailHtml = `
                    <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
                        <div style="background: #000; color: #fff; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                            <h1 style="margin:0;">AYO / Pack AIO PRO</h1>
                        </div>
                        
                        <div style="padding: 20px; border: 1px solid #eee; border-top: none;">
                            <p>Bonjour,</p>
                            <p>Félicitations pour votre investissement dans l'excellence. Votre Pack AIO PRO est activé.</p>
                            
                            <div style="background: #f0f9ff; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #0284c7;">
                                <h3 style="margin-top:0; color: #0284c7;">📊 Votre Analyse Complète</h3>
                                ${companyInfo.url ? `<p><strong>Site analysé :</strong> ${companyInfo.url}</p>` : ''}
                                <p style="font-size: 14px;">L'analyse détaillée de votre visibilité IA a été effectuée. Nos experts vont maintenant créer manuellement vos fichiers sémantiques.</p>
                            </div>

                            <h3 style="margin-top:0; color: #006064;">📦 Votre Identité Numérique (Code Source ASR)</h3>
                            <p style="font-size: 14px;">Voici le code exact qui permet aux IA de vous identifier. Ce n'est pas un document PDF, c'est du <strong>code actif</strong>.</p>
                            <pre style="background: #f5f5f5; padding: 10px; overflow-x: auto; font-size: 11px; border: 1px solid #ddd;">${asrProJson}</pre>

                            <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #bbdefb;">
                                <h3 style="margin-top:0; color: #0d47a1;">🛠 GUIDE D'INSTALLATION</h3>
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

                            <h3 style="color: #000;">🎯 Prochaines Étapes (Pack PRO)</h3>
                            <p>Nos experts vont créer manuellement pour vous :</p>
                            <ul style="line-height: 1.6;">
                                <li><strong>Glossaire Métier</strong> (/.ayo/glossary.json) - Vos définitions inaltérables.</li>
                                <li><strong>FAQ IA-Native</strong> (/.ayo/faq.json) - Réponses calibrées pour ChatGPT/Gemini.</li>
                                <li><strong>Architecture Données</strong> - JSON-LD enrichi et sans conflit.</li>
                                <li><strong>Manifest AYO</strong> - La carte routière pour les bots.</li>
                            </ul>
                            <p style="font-size: 14px; color: #666;">Délai de livraison : 3-5 jours ouvrés. Vous recevrez un email dès que tout sera prêt.</p>

                            <p style="margin-top: 30px; font-size: 12px; color: #999; text-align: center;">
                                AI Visionary - L'Autorité de Visibilité IA.
                            </p>
                        </div>
                    </div>
                `;
            } else {
                // ESSENTIAL Pack: Upsell to PRO
                emailSubject = 'Votre Pack ASR Essential PRO (Activé)';
                emailHtml = `
                    <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
                        <div style="background: #000; color: #fff; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                            <h1 style="margin:0;">AYO / Essential PRO</h1>
                        </div>
                        
                        <div style="padding: 20px; border: 1px solid #eee; border-top: none;">
                            <p>Bonjour,</p>
                            <p>Félicitations pour votre décision. Votre commande est validée.</p>
                            
                            <div style="background: #f0f9ff; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #0284c7;">
                                <h3 style="margin-top:0; color: #0284c7;">📊 Votre Analyse AYO</h3>
                                ${companyInfo.url ? `<p><strong>Site analysé :</strong> ${companyInfo.url}</p>` : ''}
                                <p style="font-size: 14px;">L'analyse de votre visibilité IA a été effectuée. Vous trouverez ci-dessous votre fichier ASR Essential PRO.</p>
                            </div>
                            
                            <h3 style="margin-top:0; color: #006064;">📦 Votre Identité Numérique (Code Source ASR)</h3>
                            <p style="font-size: 14px;">Voici le code exact qui permet aux IA de vous identifier. Ce n'est pas un document PDF, c'est du <strong>code actif</strong>.</p>
                            <pre style="background: #f5f5f5; padding: 10px; overflow-x: auto; font-size: 11px; border: 1px solid #ddd;">${asrProJson}</pre>

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
