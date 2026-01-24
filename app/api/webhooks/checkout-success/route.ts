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
        return new Response("Config Missing", { status: 500 });
    }

    const stripe = new Stripe(stripeKey);
    const resend = new Resend(resendKey);

    try {
        const rawBody = await req.text();
        const signature = req.headers.get('stripe-signature');
        let event = stripe.webhooks.constructEvent(rawBody, signature!, webhookSecret);

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as Stripe.Checkout.Session;
            console.log(`✅ PAYMENT RECEIVED: ${session.id}`);

            // --- LOGIQUE DE GÉNÉRATION AUTONOME ---

            // 1. Extraction Email
            let customerEmail = session.customer_details?.email || session.customer_email || "";
            if (session.client_reference_id && !customerEmail) {
                try {
                    const payload = JSON.parse(Buffer.from(session.client_reference_id, 'base64').toString());
                    customerEmail = payload.e;
                } catch (e) { }
            }

            // 2. Récupération Analyse
            const dbAnalysis = await db.getLatestAnalysisByEmail(customerEmail);
            const analysisData = {
                score: dbAnalysis?.score || 75,
                extract: dbAnalysis?.data?.fields || { identite: { name: { value: "Client AI Visionary" } } },
                url: dbAnalysis?.url || "votre-site.com"
            };

            // 3. Génération Fichiers
            const packType = session.metadata?.pack_type || "ESSENTIAL";
            const asrObject = await generateRealAsrJson(analysisData.extract, analysisData.score, new Date().toISOString(), session.id, packType);
            const asrJson = JSON.stringify(asrObject, null, 2);

            const extData = analysisData.extract?.external_context || {};
            const extObject = generateExternalContextJson({
                ecosystem_presence: extData.ecosystem_presence?.value || [],
                reputation_signals: extData.reputation_signals?.value || false,
                keywords: extData.keywords?.value || [],
                intents: extData.intents?.value || [],
                channels: extData.channels?.value || [],
                permissions: extData.permissions?.value || []
            });
            const externalContextJson = JSON.stringify(extObject, null, 2);

            // 4. Envoi Email (HTML Riche pour éviter Spam)
            await resend.emails.send({
                from: 'AI Visionary <hello@ai-visionary.com>',
                to: [customerEmail],
                bcc: ['hello@ai-visionary.com'],
                subject: `Votre Pack AIO ${packType} est prêt !`,
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px; overflow: hidden;">
                        <div style="background: #000; color: #fff; padding: 25px; text-align: center;"><h1>AI VISIONARY</h1></div>
                        <div style="padding: 25px;">
                            <p>Bonjour,</p>
                            <p>Merci pour votre confiance. Votre pack de fichiers ASR est prêt pour <b>${analysisData.url}</b>.</p>
                            <div style="background: #f4f4f4; padding: 15px; border-radius: 5px; margin: 20px 0;">
                                <b>Score : ${analysisData.score}/100</b>
                            </div>
                            <p>Les fichiers sont en pièces jointes de cet email.</p>
                            <p>Besoin d'aide ? Répondez simplement à cet email.</p>
                        </div>
                    </div>
                `,
                attachments: [
                    { filename: 'asr.json', content: Buffer.from(asrJson) },
                    { filename: 'external_context.json', content: Buffer.from(externalContextJson) }
                ]
            });

            console.log(`📨 Email envoyé avec succès à ${customerEmail}`);
        }

        return NextResponse.json({ received: true });

    } catch (error: any) {
        console.error("❌ Webhook Error:", error.message);
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
