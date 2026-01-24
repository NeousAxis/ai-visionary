import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import Stripe from 'stripe';
import { generateRealAsrJson } from '@/lib/ayo-crypto';
import { generateExternalContextJson } from '@/lib/external-context';

export async function POST(req: Request) {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const resendKey = process.env.RESEND_API_KEY;

    if (!stripeKey || !webhookSecret || !resendKey) return new Response("Error", { status: 500 });

    const stripe = new Stripe(stripeKey);
    const resend = new Resend(resendKey);

    try {
        const rawBody = await req.text();
        const signature = req.headers.get('stripe-signature') || "";
        const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as Stripe.Checkout.Session;

            // ⚡️ RÉCUPÉRATION ULTRA-RAPIDE (Depuis Metadata)
            const email = session.customer_details?.email || session.metadata?.customer_email || "";
            const url = session.metadata?.analyzed_url || "votre-site.com";
            const packType = session.metadata?.pack_type === 'PRO' ? 'PRO' : 'ESSENTIAL';

            if (!email) {
                console.error("❌ Email manquant dans Stripe");
                return NextResponse.json({ received: true });
            }

            // ⚡️ GÉNÉRATION SANS ATTENTE DB (Données de base sécurisées)
            const asrObject = await generateRealAsrJson(
                { identite: { name: { value: "Propriétaire de " + url } } },
                75,
                new Date().toISOString(),
                session.id,
                packType
            );

            const extObject = generateExternalContextJson({
                ecosystem_presence: [],
                reputation_signals: false,
                keywords: [],
                intents: [],
                channels: [],
                permissions: []
            }); // Version légère pour rapidité

            // ⚡️ ENVOI IMMÉDIAT
            await resend.emails.send({
                from: 'AI Visionary <hello@ai-visionary.com>',
                to: email,
                bcc: ['hello@ai-visionary.com'],
                subject: `Livrable de votre commande - ${url}`,
                text: `Votre pack AIO ${packType} est prêt. Command ID: ${session.id}`,
                html: `
                    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                        <h1 style="color: #000;">AI VISIONARY</h1>
                        <p>Merci pour votre commande pour <b>${url}</b>.</p>
                        <p>Vos certificats ASR sont en pièces jointes de cet email.</p>
                        <hr/>
                        <p style="font-size: 11px; color: #999;">Réf: ${session.id}</p>
                    </div>
                `,
                attachments: [
                    { filename: 'asr.json', content: Buffer.from(JSON.stringify(asrObject, null, 2)) },
                    { filename: 'external_context.json', content: Buffer.from(JSON.stringify(extObject, null, 2)) }
                ]
            });

            console.log(`✅ Email expédié à : ${email}`);
        }

        return NextResponse.json({ received: true });

    } catch (err: any) {
        console.error("❌ Erreur Webhook:", err.message);
        return NextResponse.json({ received: true }); // Toujours 200 pour Stripe
    }
}
