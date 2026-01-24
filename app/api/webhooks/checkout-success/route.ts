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
        console.error("❌ CONFIG MISSING: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET or RESEND_API_KEY");
        return new Response("Missing Configuration", { status: 500 });
    }

    const stripe = new Stripe(stripeKey);
    const resend = new Resend(resendKey);

    try {
        const rawBody = await req.text();
        const signature = req.headers.get('stripe-signature') || "";

        let event: Stripe.Event;
        try {
            event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
            console.log(`📡 WEBHOOK EVENT RECEIVED: ${event.type}`);
        } catch (err: any) {
            console.error(`❌ SIGNATURE ERROR: ${err.message}`);
            return NextResponse.json({ error: "Invalid Signature" }, { status: 400 });
        }

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as Stripe.Checkout.Session;
            console.log(`✅ PAYMENT COMPLETED: ${session.id}`);

            // 1. Recover Email
            let email = session.customer_details?.email || session.customer_email || "";
            let url = session.metadata?.analyzed_url || "votre-site.com";

            if (session.client_reference_id) {
                try {
                    const decoded = JSON.parse(Buffer.from(session.client_reference_id, 'base64').toString());
                    if (decoded.e && !email) email = decoded.e;
                    if (decoded.u) url = decoded.u;
                    console.log(`📡 Decoded Reference: ${email} for ${url}`);
                } catch (e) {
                    console.warn("⚠️ Client Reference Decode Failed");
                }
            }

            if (!email) {
                console.error("❌ CRITICAL: No email found for session", session.id);
                return NextResponse.json({ error: "No email" }, { status: 200 }); // Still 200 to acknowledge Stripe
            }

            // 2. Data Retrieval
            let analysisData = {
                score: 75,
                extract: { identite: { name: { value: "Client AI Visionary" } } },
                url: url
            };

            try {
                const dbAnalysis = await db.getLatestAnalysisByEmail(email);
                if (dbAnalysis) {
                    console.log("✅ Analysis found in database");
                    analysisData = {
                        score: dbAnalysis.score || 75,
                        extract: dbAnalysis.data?.fields || analysisData.extract,
                        url: dbAnalysis.url || url
                    };
                }
            } catch (dbErr) {
                console.warn("⚠️ Database lookup failed, using fallback");
            }

            // 3. Generate Content
            const packType: 'ESSENTIAL' | 'PRO' = session.metadata?.pack_type === 'PRO' ? 'PRO' : 'ESSENTIAL';
            console.log(`🛠 Mode: ${packType}`);

            let asrJson = "";
            let externalContextJson = "";

            try {
                const asrObject = await generateRealAsrJson(analysisData.extract, analysisData.score, new Date().toISOString(), session.id, packType);
                asrJson = JSON.stringify(asrObject, null, 2);

                const extData = (analysisData.extract as any)?.external_context || {};
                const extObject = generateExternalContextJson({
                    ecosystem_presence: extData.ecosystem_presence?.value || [],
                    reputation_signals: extData.reputation_signals?.value || false,
                    keywords: extData.keywords?.value || [],
                    intents: extData.intents?.value || [],
                    channels: extData.channels?.value || [],
                    permissions: extData.permissions?.value || []
                });
                externalContextJson = JSON.stringify(extObject, null, 2);
            } catch (genErr: any) {
                console.error("❌ Content generation error:", genErr.message);
            }

            // 4. Send Email
            console.log(`📧 Attempting to send email to ${email}`);

            const { data, error } = await resend.emails.send({
                from: 'AI Visionary <hello@ai-visionary.com>',
                to: [email],
                bcc: ['hello@ai-visionary.com'],
                subject: `Votre Pack AIO ${packType} est prêt !`,
                html: `
                    <div style="font-family: sans-serif; padding: 20px; color: #333;">
                        <h2>Merci pour votre commande !</h2>
                        <p>Nous avons finalisé l'analyse pour : <b>${analysisData.url}</b></p>
                        <p>Votre score de visibilité IA est de <b>${analysisData.score}/100</b>.</p>
                        <p>Vos fichiers certifiés sont disponibles en pièces jointes de cet e-mail.</p>
                        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                        <p style="font-size: 11px; color: #999;">Commande ID : ${session.id}</p>
                    </div>
                `,
                attachments: [
                    { filename: 'asr.json', content: Buffer.from(asrJson) },
                    { filename: 'external_context.json', content: Buffer.from(externalContextJson) }
                ]
            });

            if (error) {
                console.error("❌ RESEND ERROR:", error);
            } else {
                console.log(`✅ SUCCESS: Email sent to ${email}. ID: ${data?.id}`);
            }
        }

        return NextResponse.json({ received: true });

    } catch (globalErr: any) {
        console.error("❌ WEBHOOK GLOBAL ERROR:", globalErr.message);
        return NextResponse.json({ error: globalErr.message }, { status: 500 });
    }
}
