import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import Stripe from 'stripe';

// Initialize Services (Resend is safe to init outside)
const resend = new Resend(process.env.RESEND_API_KEY);

// Helper to generate the ASR PRO JSON
function generateAsrProJson(customerEmail: string, sessionDate: string, sessionId: string) {
    return JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Organization",
        "@id": sessionId,
        "name": "[NOM_ENTREPRISE_A_REMPLIR]",
        "url": "[URL_A_REMPLIR]",
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
        const { session_id } = body;

        if (!session_id) {
            return NextResponse.json({ error: 'Missing session_id' }, { status: 400 });
        }

        console.log(`Processing Success for Session: ${session_id}`);

        let customerEmail = "";
        let paymentStatus = "unknown";

        if (stripe) {
            try {
                console.log("Retrieving Stripe Session...");
                const session = await stripe.checkout.sessions.retrieve(session_id);
                console.log("Stripe Session Retrieved. Customer Details:", session.customer_details);

                if (session.customer_details?.email) {
                    customerEmail = session.customer_details.email;
                    paymentStatus = session.payment_status;
                    console.log("✅ Email extracted from Stripe (customer_details):", customerEmail);
                } else if (session.customer_email) {
                    customerEmail = session.customer_email;
                    paymentStatus = session.payment_status;
                    console.log("✅ Email extracted from Stripe (customer_email):", customerEmail);
                } else {
                    console.warn("⚠️ No email found in Stripe Session.");
                }
            } catch (stripeErr) {
                console.error("❌ Stripe Retrieval Error:", stripeErr);
                console.log("Stack:", stripeErr); // Extended debug
            }
        }

        // CRITICAL CHECK: No Email = No Delivery
        if (!customerEmail) {
            console.error("❌ FATAL: Could not retrieve any email address from Session. Delivery aborted.");
            return NextResponse.json({ error: 'No email found in transaction' }, { status: 400 });
        }

        // Generate Files
        const sessionDate = new Date().toISOString();
        const asrProJson = generateAsrProJson(customerEmail, sessionDate, session_id);

        // Send Email via Resend
        if (process.env.RESEND_API_KEY) {
            await resend.emails.send({
                from: 'AYO <hello@ai-visionary.com>',
                to: [customerEmail],
                subject: 'Votre Pack ASR Essential PRO (Activé)',
                html: `
                    <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
                        <div style="background: #000; color: #fff; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                            <h1 style="margin:0;">AYO / Essential PRO</h1>
                        </div>
                        
                        <div style="padding: 20px; border: 1px solid #eee; border-top: none;">
                            <p>Bonjour,</p>
                            <p>Félicitations pour votre décision. Votre commande est validée.</p>
                            
                                <h3 style="margin-top:0; color: #006064;">📦 Votre Identité Numérique (Code Source ASR)</h3>
                                <p style="font-size: 14px;">Voici le code exact qui permet aux IA de vous identifier. Ce n'est pas un document PDF, c'est du <strong>code actif</strong>.</p>
                                <pre style="background: #fff; padding: 10px; overflow-x: auto; font-size: 11px;">${asrProJson}</pre>
                            </div>

                            <div style="background: #fff3e0; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #ffe0b2;">
                                <h3 style="margin-top:0; color: #e65100;">🛠 COMMENT L'INSTALLER (Tutoriel Simple)</h3>
                                <p style="font-size: 14px; font-weight:bold;">Ce code doit être mis sur votre site internet pour être vu par Google et les IA.</p>
                                
                                <h4 style="margin-bottom:5px;">OPTION 1 : Vous avez un Webmaster / Développeur</h4>
                                <p style="font-size:13px; margin-top:0;">Envoyez-lui cet email et dites : <em>"Peux-tu créer un fichier nommé <code>asr.json</code>, coller ce code dedans, et le mettre dans un dossier nommé <code>.ayo</code> à la racine du site ?"</em></p>

                                <hr style="border:0; border-top:1px dashed #ccc; margin:15px 0;">

                                <h4 style="margin-bottom:5px;">OPTION 2 : Vous utilisez WordPress</h4>
                                <ol style="font-size:13px; padding-left:20px; margin-top:0;">
                                    <li>Copiez le code ci-dessus (tout le texte dans la case blanche).</li>
                                    <li>Installez le plugin gratuit <strong>"WP File Manager"</strong>.</li>
                                    <li>Ouvrez le File Manager, faites un Clic Droit > Nouveau Dossier > Nommez-le <code>.ayo</code></li>
                                    <li>Entrez dans ce dossier, Clic Droit > Nouveau Fichier TXT > Nommez-le <code>asr.json</code></li>
                                    <li>Clic Droit sur ce fichier > Code Editor > Collez le code > Sauvegardez.</li>
                                    <li>C'est fini !</li>
                                </ol>

                                <hr style="border:0; border-top:1px dashed #ccc; margin:15px 0;">

                                <h4 style="margin-bottom:5px;">OPTION 3 : Vous utilisez WIX, Squarespace ou Shopify</h4>
                                <p style="font-size:13px;">Ces plateformes bloquent souvent les fichiers. Utilisez cette astuce :</p>
                                <ol style="font-size:13px; padding-left:20px; margin-top:0;">
                                    <li>Copiez le code ci-dessus.</li>
                                    <li>Allez dans les <strong>Paramètres</strong> > <strong>Code personnalisé</strong> (ou Injection de code).</li>
                                    <li>Ajoutez un nouveau script dans l'En-tête (Head).</li>
                                    <li>Écrivez ceci : <code>&lt;script type="application/ld+json"&gt;</code></li>
                                    <li>Collez votre code juste après.</li>
                                    <li>Fermez avec : <code>&lt;/script&gt;</code></li>
                                    <li>Sauvegardez. Les IA pourront le lire.</li>
                                </ol>
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
                `
            });
            console.log(`✅ Success Email sent to ${customerEmail}`);
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("Webhook Error", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
