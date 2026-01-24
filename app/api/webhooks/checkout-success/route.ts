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
        let event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as Stripe.Checkout.Session;

            // 1. EXTRACTION EMAIL ULTRA-AGRESSIVE
            let email = session.customer_details?.email ||
                session.customer_email ||
                session.metadata?.customer_email ||
                "";

            // Fallback sur le client_reference_id
            if (!email && session.client_reference_id) {
                try {
                    const decoded = JSON.parse(Buffer.from(session.client_reference_id, 'base64').toString());
                    email = decoded.e;
                } catch (e) { }
            }

            console.log(`📡 WEBHOOK: Processing for email [${email}]`);

            if (!email || !email.includes('@')) {
                console.error("❌ NO VALID EMAIL FOUND");
                return NextResponse.json({ received: true });
            }

            // 2. DATA
            const url = session.metadata?.analyzed_url || "votre-site.com";
            const dbAnalysis = await db.getLatestAnalysisByEmail(email);
            const analysisData = {
                score: dbAnalysis?.score || 75,
                extract: dbAnalysis?.data?.fields || { identite: { name: { value: "Client AI Visionary" } } },
                url: url
            };

            // 3. GÉNÉRATION
            const packType = session.metadata?.pack_type === 'PRO' ? 'PRO' : 'ESSENTIAL';
            const asrObject = await generateRealAsrJson(analysisData.extract, analysisData.score, new Date().toISOString(), session.id, packType);
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

            // 4. ENVOI EMAIL
            // Note: on utilise des Buffers pour les pièces jointes, c'est ce que Resend préfère.
            const { error } = await resend.emails.send({
                from: 'AI Visionary <hello@ai-visionary.com>',
                to: email,
                bcc: ['hello@ai-visionary.com'],
                subject: `Votre Pack AIO ${packType} est prêt !`,
                html: `
                    <div style="font-family: sans-serif; padding: 20px;">
                        <h2>Merci pour votre commande !</h2>
                        <p>Votre analyse pour <b>${analysisData.url}</b> est terminée.</p>
                        <p>Score : <b>${analysisData.score}/100</b></p>
                        <p>Les fichiers <b>asr.json</b> et <b>external_context.json</b> sont en pièces jointes.</p>
                        <hr/>
                        <p style="font-size: 10px; color: #999;">Commande: ${session.id}</p>
                    </div>
                `,
                attachments: [
                    { filename: 'asr.json', content: Buffer.from(asrJson) },
                    { filename: 'external_context.json', content: Buffer.from(externalContextJson) }
                ]
            });

            if (error) console.error("❌ RESEND ERROR:", error);
            else console.log("✅ EMAIL DELIVERED TO RESEND QUEUE");
        }

        return NextResponse.json({ received: true });

    } catch (err: any) {
        console.error("❌ WEBHOOK CRITICAL ERROR:", err.message);
        return NextResponse.json({ received: true }); // Toujours 200 pour Stripe
    }
}
