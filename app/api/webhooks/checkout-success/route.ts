import { NextResponse } from 'next/server';
import Stripe from 'stripe';

export async function POST(req: Request) {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripeKey || !webhookSecret) {
        return new Response("Stripe Config Missing", { status: 500 });
    }

    const stripe = new Stripe(stripeKey);

    try {
        const rawBody = await req.text();
        const signature = req.headers.get('stripe-signature');

        let event: Stripe.Event;

        try {
            event = stripe.webhooks.constructEvent(rawBody, signature!, webhookSecret);
        } catch (err: any) {
            console.error(`❌ Webhook Signature Error: ${err.message}`);
            return NextResponse.json({ error: 'Invalid Signature' }, { status: 400 });
        }

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as Stripe.Checkout.Session;
            console.log(`✅ PAYMENT SUCCESS (Webhook): ${session.id}`);
            // Note: We intentionally DO NOT trigger generation here to avoid Vercel timeouts.
            // The client (browser) will trigger /api/generate-order upon seeing the success page.
        }

        // ALWAYS return 200 OK fast to Stripe.
        return NextResponse.json({ received: true }, { status: 200 });

    } catch (error: any) {
        console.error("Webhook Error", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
