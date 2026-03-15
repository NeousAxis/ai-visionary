import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createLogger, generateCorrelationId } from '@/lib/logger';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { emailSchema, urlSchema } from '@/lib/validators';

export const dynamic = 'force-dynamic';

// SECURITY: All Stripe Price IDs from env vars (no hardcoded secrets)
const PRICE_AYA_SUB = process.env.STRIPE_PRICE_AYA_SUB || '';
const PRICE_PRO = process.env.STRIPE_PRICE_PRO || '';
const PRICE_ESSENTIAL = process.env.STRIPE_PRICE_ESSENTIAL || '';

/**
 * 🛒 CREATE STRIPE CHECKOUT SESSION (Dynamic)
 * 
 * Cette API crée une session Stripe et encode l'URL + Email dans client_reference_id
 */

export async function GET(req: NextRequest) {
    // Rate limit: 5 requests/min per IP
    const rateLimited = checkRateLimit(req, 'checkout', RATE_LIMITS.checkout);
    if (rateLimited) return rateLimited;

    const logger = createLogger(generateCorrelationId(), 'checkout');
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    const url = searchParams.get('url');
    const packType = searchParams.get('packType');

    if (!email || !url) {
        return new Response('Email and URL are required', { status: 400 });
    }

    // Validate inputs
    const emailParsed = emailSchema.safeParse(email);
    const urlParsed = urlSchema.safeParse(url);
    if (!emailParsed.success || !urlParsed.success) {
        logger.warn('CHECKOUT_INVALID_INPUT', 'Invalid email or URL', { email, url });
        return new Response('Invalid email or URL', { status: 400 });
    }

    logger.info('CHECKOUT_GET_START', `Creating checkout for ${email}`, { packType });

    try {
        const stripeKey = process.env.STRIPE_SECRET_KEY;
        if (!stripeKey) throw new Error('Stripe not configured');
        const stripe = new Stripe(stripeKey);

        const payload = { u: url, e: email };
        const clientReferenceId = Buffer.from(JSON.stringify(payload)).toString('base64');

        let priceId = '';
        let mode: Stripe.Checkout.SessionCreateParams.Mode = 'payment';

        if (packType === 'AYA_SUB') {
            priceId = PRICE_AYA_SUB;
            mode = 'subscription';
        } else if (packType === 'PRO') {
            priceId = PRICE_PRO;
            mode = 'payment';
        } else {
            priceId = PRICE_ESSENTIAL;
            mode = 'payment';
        }

        if (!priceId) {
            logger.error('CHECKOUT_NO_PRICE', `Missing STRIPE_PRICE env var for pack: ${packType}`);
            return new Response('Configuration error', { status: 500 });
        }

        const session = await stripe.checkout.sessions.create({
            mode: mode,
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: `https://ai-visionary.com?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: 'https://ai-visionary.com',
            client_reference_id: clientReferenceId,
            customer_email: email,
            allow_promotion_codes: true,
            metadata: { pack_type: packType || "UNKNOWN", analyzed_url: url }
        });

        return NextResponse.redirect(session.url!);
    } catch (e: any) {
        return new Response('Erreur lors de la creation du paiement', { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    // Rate limit: 5 requests/min per IP
    const rateLimited = checkRateLimit(req, 'checkout', RATE_LIMITS.checkout);
    if (rateLimited) return rateLimited;

    const logger = createLogger(generateCorrelationId(), 'checkout');

    try {
        const { email, url, packType } = await req.json();

        if (!email || !url) {
            return NextResponse.json({ error: 'Missing email or url' }, { status: 400 });
        }

        // Validate inputs
        const emailParsed = emailSchema.safeParse(email);
        const urlParsed = urlSchema.safeParse(url);
        if (!emailParsed.success || !urlParsed.success) {
            logger.warn('CHECKOUT_INVALID_INPUT', 'Invalid email or URL', { email, url });
            return NextResponse.json({ error: 'Invalid email or URL' }, { status: 400 });
        }

        logger.info('CHECKOUT_POST_START', `Creating checkout for ${email}`, { packType });

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
            priceId = PRICE_AYA_SUB;
            mode = 'subscription';
        } else if (packType === 'PRO') {
            priceId = PRICE_PRO;
            mode = 'payment';
        } else {
            priceId = PRICE_ESSENTIAL;
            mode = 'payment';
        }

        if (!priceId) {
            logger.error('CHECKOUT_NO_PRICE', `Missing STRIPE_PRICE env var for pack: ${packType}`);
            return NextResponse.json({ error: 'Configuration error' }, { status: 500 });
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
                // SECURITY: email NOT stored in metadata (already in customer_email field)
                mode: mode // 'subscription' | 'payment'
            }
        });

        logger.info('CHECKOUT_CREATED', `Session ${session.id} for ${email}`);

        return NextResponse.json({
            url: session.url,
            sessionId: session.id
        });

    } catch (error: any) {
        logger.error('CHECKOUT_ERROR', error.message || 'Unknown error');
        return NextResponse.json({
            error: 'Erreur lors de la creation du paiement'
        }, { status: 500 });
    }
}
