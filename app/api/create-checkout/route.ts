import { NextResponse } from 'next/server';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

/**
 * 🛒 CREATE STRIPE CHECKOUT SESSION (Dynamic)
 * 
 * Cette API crée une session Stripe et encode l'URL + Email dans client_reference_id
 */

export async function POST(req: Request) {
    try {
        const { email, url, packType } = await req.json();

        if (!email || !url) {
            return NextResponse.json({ error: 'Missing email or url' }, { status: 400 });
        }

        const stripeKey = process.env.STRIPE_SECRET_KEY;
        if (!stripeKey) {
            return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
        }

        const stripe = new Stripe(stripeKey);

        // Encode URL + Email in Base64 for client_reference_id
        const payload = { u: url, e: email };
        const clientReferenceId = Buffer.from(JSON.stringify(payload)).toString('base64');

        // Product IDs (from your Stripe dashboard)
        const priceId = packType === 'PRO'
            ? 'price_1SlM9iPkCQYUm8hQKqOV8eqU'  // PRO 499 CHF
            : 'price_1SlM8kPkCQYUm8hQJU6kvMMa'; // Essential 99 CHF

        // Create Checkout Session
        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            success_url: `https://ai-visionary-gl96adesh-neous-axis-projects.vercel.app/?payment_success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: 'https://ai-visionary.com',
            client_reference_id: clientReferenceId,
            customer_email: email,
            metadata: {
                pack_type: packType,
                analyzed_url: url,
                customer_email: email
            }
        });

        console.log(`✅ Checkout Session created: ${session.id} for ${email}`);

        return NextResponse.json({
            url: session.url,
            sessionId: session.id
        });

    } catch (error: any) {
        console.error('❌ Checkout Creation Error:', error);
        return NextResponse.json({
            error: error.message
        }, { status: 500 });
    }
}
