import { NextResponse } from 'next/server';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const email = searchParams.get('email');
        const url = searchParams.get('url');
        const pack = searchParams.get('pack'); // 'ESSENTIAL' or 'PRO'

        if (!email || !url || !pack) {
            return new Response("Missing parameters (email, url, pack)", { status: 400 });
        }

        const stripeKey = process.env.STRIPE_SECRET_KEY;
        if (!stripeKey) {
            return new Response("Stripe not configured", { status: 500 });
        }

        const stripe = new Stripe(stripeKey);

        // Encode Client Ref
        const payload = { u: url, e: email };
        const clientReferenceId = Buffer.from(JSON.stringify(payload)).toString('base64');

        // Price Mapping (Hardcoded for Safety based on your previous file)
        const priceId = pack === 'PRO'
            ? 'price_1SlM9iPkCQYUm8hQKqOV8eqU'  // PRO 499 CHF
            : 'price_1SlM8kPkCQYUm8hQJU6kvMMa'; // Essential 99 CHF

        // DETERMINE BASE URL (Dynamic for Vercel)
        const host = req.headers.get('host') || 'ai-visionary.com';
        const protocol = host.includes('localhost') ? 'http' : 'https';
        const baseUrl = `${protocol}://${host}`;

        // Create Checkout Session with FORCED SUCCESS URL
        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            // LA CLEF DU SUCCÈS : On redirige vers NOTRE page dédiée
            success_url: `${baseUrl}/order/success?payment_success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${baseUrl}`,
            client_reference_id: clientReferenceId,
            customer_email: email,
            metadata: {
                pack_type: pack,
                analyzed_url: url,
                customer_email: email
            }
        });

        // REDIRECT USER TO STRIPE
        if (session.url) {
            return NextResponse.redirect(session.url);
        } else {
            return new Response("Stripe Session Creation Failed", { status: 500 });
        }

    } catch (error: any) {
        console.error('❌ Checkou Start Error:', error);
        return new Response(`Error: ${error.message}`, { status: 500 });
    }
}
