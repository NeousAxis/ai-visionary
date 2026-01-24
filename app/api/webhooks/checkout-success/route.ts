import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import Stripe from 'stripe';
import { db } from '@/lib/db';
import { generateRealAsrJson } from '@/lib/ayo-crypto';
import { generateExternalContextJson } from '@/lib/external-context';

export async function POST(req: Request) {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const resendKey = process.env.RESEND_API_KEY;

    if (!stripeKey || !webhookSecret || !resendKey) {
        console.error("❌ CRITICAL: Missing Env Vars");
        return new Response("Config Missing", { status: 500 });
    }

    const stripe = new Stripe(stripeKey);
    const resend = new Resend(resendKey);

    try {
        const rawBody = await req.text();
        const signature = req.headers.get('stripe-signature');

        let event: Stripe.Event;
        try {
            event = stripe.webhooks.constructEvent(rawBody, signature!, webhookSecret);
        } catch (err: any) {
            console.error(`❌ Signature verification failed: ${err.message}`);
            return NextResponse.json({ error: "Invalid Signature" }, { status: 400 });
        }

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as Stripe.Checkout.Session;
            console.log(`✅ Webhook: Completion Received for ${session.id}`);

            // 1. EXTRACT DATA (Robust)
            let email = session.customer_details?.email || session.customer_email || "";
            let url = "votre-site.com";

            // Decode client_reference_id if available
            if (session.client_reference_id) {
                try {
                    const decoded = JSON.parse(Buffer.from(session.client_reference_id, 'base64').toString());
                    if (decoded.e) email = decoded.e;
                    if (decoded.u) url = decoded.u;
                    console.log(`📡 Decoded from ref: ${email}, ${url}`);
                } catch (e) {
                    console.warn("⚠️ Failed to decode client_reference_id");
                }
            }

            if (!email) {
                console.error("❌ No email found for session!");
            }

            // 2. RETRIEVE ANALYSIS FROM DB
            let analysisData = {
                score: 75,
                extract: { identite: { name: { value: "Client AI Visionary" } } },
                url: url
            };

            try {
                if (email) {
                    const dbAnalysis = await db.getLatestAnalysisByEmail(email);
                    if (dbAnalysis) {
                        console.log("✅ DB Analysis found");
                        analysisData = {
                            score: dbAnalysis.score || 75,
                            extract: dbAnalysis.data?.fields || analysisData.extract,
                            url: dbAnalysis.url || url
                        };
                    }
                }
            } catch (dbErr) {
                console.error("⚠️ DB Lookup Error (falling back):", dbErr);
            }

            // 3. GENERATE FILES
            const packTypeRaw = session.metadata?.pack_type || "ESSENTIAL";
            const packType: 'ESSENTIAL' | 'PRO' = packTypeRaw === 'PRO' ? 'PRO' : 'ESSENTIAL';

            console.log(`🛠 Generating files for ${packType}...`);

            const asrObject = await generateRealAsrJson(
                analysisData.extract,
                analysisData.score,
                new Date().toISOString(),
                session.id,
                packType
            );
            const asrJson = JSON.stringify(asrObject, null, 2);

            const extData = (analysisData.extract as any)?.external_context || {};
            const extObject = generateExternalContextJson({
                ecosystem_presence: extData.ecosystem_presence?.value || [],
                reputation_signals: extData.reputation_signals?.value || false,
                keywords: extData.keywords?.value || [],
                intents: extData.intents?.value || [],
                channels: extData.channels?.value || [],
                permissions: extData.permissions?.value || []
            });
            const externalContextJson = JSON.stringify(extObject, null, 2);

            // 4. SEND EMAIL
            if (email && email.includes('@')) {
                console.log(`📧 Sending email to ${email}...`);
                const subject = `Votre Pack AIO ${packType} est prêt !`;

                try {
                    const { data, error } = await resend.emails.send({
                        from: 'AI Visionary <hello@ai-visionary.com>',
                        to: [email],
                        bcc: ['hello@ai-visionary.com'],
                        replyTo: 'support@ai-visionary.com',
                        subject: subject,
                        html: `
                            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
                                <div style="background-color: #000000; color: #ffffff; padding: 30px; text-align: center;">
                                    <h1 style="margin: 0; font-size: 24px; letter-spacing: 2px;">AI VISIONARY</h1>
                                    <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.7;">Artificial Intelligence Optimization</p>
                                </div>
                                <div style="padding: 40px; color: #1e293b; line-height: 1.6;">
                                    <h2 style="margin-top: 0; color: #0f172a;">Votre pack est prêt.</h2>
                                    <p>Bonjour,</p>
                                    <p>Merci pour votre commande. Nous avons finalisé l'analyse de <b>${analysisData.url}</b> et généré vos certificats de visibilité IA.</p>
                                    
                                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center;">
                                        <p style="margin: 0; font-size: 14px; color: #64748b; text-transform: uppercase; font-weight: bold;">Score de Visibilité IA</p>
                                        <p style="margin: 5px 0 0 0; font-size: 32px; font-weight: 800; color: #4a919e;">${analysisData.score}/100</p>
                                    </div>

                                    <p>Vos fichiers <b>asr.json</b> et <b>external_context.json</b> sont joints à cet e-mail.</p>
                                    
                                    <h3 style="color: #0f172a; font-size: 16px; margin-top: 30px;">Prochaines étapes :</h3>
                                    <ol style="padding-left: 20px;">
                                        <li style="margin-bottom: 10px;">Téléchargez les fichiers joints.</li>
                                        <li style="margin-bottom: 10px;">Placez-les à la racine de votre site web (via FTP ou votre gestionnaire de fichiers).</li>
                                        <li style="margin-bottom: 10px;">Lien recommandé : <code>votre-site.com/.ayo/asr.json</code></li>
                                    </ol>

                                    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 40px 0;" />
                                    <p style="font-size: 12px; color: #94a3b8; text-align: center;">
                                        ID Commande : ${session.id}<br/>
                                        Besoin d'assistance ? Contactez-nous sur <a href="mailto:support@ai-visionary.com" style="color: #4a919e;">support@ai-visionary.com</a>
                                    </p>
                                </div>
                            </div>
                        `,
                        attachments: [
                            { filename: 'asr.json', content: Buffer.from(asrJson) },
                            { filename: 'external_context.json', content: Buffer.from(externalContextJson) }
                        ]
                    });

                    if (error) {
                        console.error("❌ Resend API Error:", error);
                    } else {
                        console.log(`✅ Email sent successfully! ID: ${data?.id}`);
                    }
                } catch (emailErr: any) {
                    console.error("❌ Resend Exception:", emailErr.message);
                }
            }
        }

        return NextResponse.json({ received: true });

    } catch (globalErr: any) {
        console.error("❌ WEBHOOK CRITICAL ERROR:", globalErr.message);
        return NextResponse.json({ error: globalErr.message }, { status: 500 });
    }
}
