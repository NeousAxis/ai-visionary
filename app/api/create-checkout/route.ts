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

        // 🛒 NEW PRICING LOGIC (AYA ABONNEMENT vs AYO ONE-SHOT)
        let priceId = '';
        let mode: Stripe.Checkout.SessionCreateParams.Mode = 'payment';

        if (packType === 'AYA_SUB') {
            // Option 2: Abonnement AYA (19 CHF / mois)
            // Test Price ID: price_1SzazaPkCQYUm8hQJfrKc9EJ (Fourni par user)
            // Prod Price ID: TO BE DEFINED IN ENV
            priceId = process.env.STRIPE_PRICE_AYA_SUB || 'price_1SzazaPkCQYUm8hQJfrKc9EJ';
            mode = 'subscription';
        } else if (packType === 'PRO') {
            // Option 3: Achat AYO Full (499 CHF One-Shot)
            priceId = 'price_1SlM9iPkCQYUm8hQKqOV8eqU';
            mode = 'payment';
        } else {
            // Fallback (Essentiel/Light => Redirige vers Abo ou Pro selon stratégie, ici legacy Essential en fallback)
            // price_1SlM8kPkCQYUm8hQJU6kvMMa (Old 99 CHF)
            priceId = 'price_1SlM8kPkCQYUm8hQJU6kvMMa';
            mode = 'payment';
        }

        // Create Checkout Session
        const session = await stripe.checkout.sessions.create({
            mode: mode,
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            success_url: `https://ai-visionary.com?session_id={CHECKOUT_SESSION_ID}`, // Devrait être dynamique selon env
            cancel_url: 'https://ai-visionary.com',
            client_reference_id: clientReferenceId, // Critical for Webhook Email recovery
            customer_email: email, // Pre-fill email in Stripe Checkout
            allow_promotion_codes: true, // Bonus commercial
            metadata: {
                pack_type: packType, // 'AYA_SUB' | 'PRO' | 'ESSENTIAL'
                analyzed_url: url,
                customer_email: email,
                mode: mode // 'subscription' | 'payment'
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
