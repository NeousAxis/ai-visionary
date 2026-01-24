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
        } catch (err: any) {
            return NextResponse.json({ error: "Invalid Signature" }, { status: 400 });
        }

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as Stripe.Checkout.Session;

            // 1. Data recovery
            let email = session.customer_details?.email || session.customer_email || "";
            let url = session.metadata?.analyzed_url || "votre-site.com";

            if (session.client_reference_id && !email) {
                try {
                    const decoded = JSON.parse(Buffer.from(session.client_reference_id, 'base64').toString());
                    email = decoded.e;
                    url = decoded.u;
                } catch (e) { }
            }

            // 2. Build analysis data
            let analysisData = {
                score: 75,
                extract: { identite: { name: { value: "Client AI Visionary" } } },
                url: url
            };

            try {
                if (email) {
                    const dbAnalysis = await db.getLatestAnalysisByEmail(email);
                    if (dbAnalysis) {
                        analysisData = {
                            score: dbAnalysis.score || 75,
                            extract: dbAnalysis.data?.fields || analysisData.extract,
                            url: dbAnalysis.url || url
                        };
                    }
                }
            } catch (dbErr) { }

            // 3. Generate content
            const packType: 'ESSENTIAL' | 'PRO' = session.metadata?.pack_type === 'PRO' ? 'PRO' : 'ESSENTIAL';

            let asrJson = "{}";
            let externalContextJson = "{}";

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
            } catch (genErr) {
                console.error("Content generation failed, using empty files");
            }

            // 4. Send email
            if (email && email.includes('@')) {
                await resend.emails.send({
                    from: 'AI Visionary <hello@ai-visionary.com>',
                    to: [email],
                    bcc: ['hello@ai-visionary.com'],
                    subject: `Votre Pack AIO ${packType} est prêt !`,
                    html: `
                        <div style="font-family: sans-serif; padding: 20px; color: #333;">
                            <h2>Confirmation de commande</h2>
                            <p>Merci pour votre achat pour le site : <b>${analysisData.url}</b></p>
                            <p>Votre score de visibilité IA : <b>${analysisData.score}/100</b></p>
                            <p>Vos fichiers ASR sont joints à cet e-mail.</p>
                            <br/>
                            <p style="font-size: 11px; color: #999;">Commande ID : ${session.id}</p>
                        </div>
                    `,
                    attachments: [
                        { filename: 'asr.json', content: asrJson },
                        { filename: 'external_context.json', content: externalContextJson }
                    ]
                });
            }
        }

        return NextResponse.json({ received: true });

    } catch (globalErr: any) {
        console.error("Global Webhook Error:", globalErr.message);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
