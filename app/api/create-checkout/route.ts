import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createLogger, generateCorrelationId } from '@/lib/logger';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { emailSchema, urlSchema } from '@/lib/validators';

export const dynamic = 'force-dynamic';

// SECURITY: Stripe Price IDs from env vars (no hardcoded secrets)
// ┌──────────────────────────────────────────────────────────────┐
// │ Produit Stripe         │ Tarif         │ Env var             │
// ├──────────────────────────────────────────────────────────────┤
// │ PACK PLATEFORME        │ 19 CHF/mois   │ STRIPE_PRICE_AYA   │
// │ PACK PRO               │ 499 CHF       │ STRIPE_PRICE_PRO   │
// └──────────────────────────────────────────────────────────────┘
// packType côté frontend : 'AYA_SUB' → PACK PLATEFORME, 'PRO' → PACK PRO
// Payment Links Stripe :
//   PACK PLATEFORME : https://buy.stripe.com/cNidR860342e3KS7zC18c01
//   PACK PRO        : https://buy.stripe.com/4gM4gydsvgP04OWf2418c00
const PRICE_AYA = process.env.STRIPE_PRICE_AYA || process.env.STRIPE_PRICE_AYA_SUB || '';
const PRICE_PRO = process.env.STRIPE_PRICE_PRO || '';

/**
 * 🛒 CREATE STRIPE CHECKOUT SESSION
 *
 * 2 produits uniquement :
 *   - PACK PLATEFORME (19 CHF/mois, subscription) — packType='AYA_SUB'
 *   - PACK PRO (499 CHF one-shot, payment) — packType='PRO'
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
    const analysisId = searchParams.get('aid');

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

        const payload: Record<string, string> = { u: url, e: email };
        if (analysisId) payload.aid = analysisId;
        const clientReferenceId = Buffer.from(JSON.stringify(payload)).toString('base64');

        let priceId = '';
        let mode: Stripe.Checkout.SessionCreateParams.Mode = 'payment';

        if (packType === 'AYA_SUB') {
            priceId = PRICE_AYA;
            mode = 'subscription';
        } else if (packType === 'PRO') {
            priceId = PRICE_PRO;
            mode = 'payment';
        } else {
            // Unknown pack type — reject
            logger.warn('CHECKOUT_UNKNOWN_PACK', `Unknown packType: ${packType}`);
            return new Response('Pack inconnu', { status: 400 });
        }

        if (!priceId) {
            logger.error('CHECKOUT_NO_PRICE', `Missing STRIPE_PRICE env var for pack: ${packType}`);
            return new Response('Configuration error', { status: 500 });
        }

        const session = await stripe.checkout.sessions.create({
            mode: mode,
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: `https://ai-visionary.com?session_id={CHECKOUT_SESSION_ID}&pack=${packType === 'PRO' ? 'pro' : 'plateforme'}`,
            cancel_url: 'https://ai-visionary.com',
            client_reference_id: clientReferenceId,
            customer_email: email,
            allow_promotion_codes: true,
            metadata: { pack_type: packType, analyzed_url: url, analysis_id: analysisId || '' }
        });

        return NextResponse.redirect(session.url!);
    } catch (_e: any) {
        return new Response('Erreur lors de la creation du paiement', { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    // Rate limit: 5 requests/min per IP
    const rateLimited = checkRateLimit(req, 'checkout', RATE_LIMITS.checkout);
    if (rateLimited) return rateLimited;

    const logger = createLogger(generateCorrelationId(), 'checkout');

    try {
        const { email, url, packType, analysisId: aid } = await req.json();

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

        // Encode URL + Email + AnalysisId in Base64 for client_reference_id
        const payload: Record<string, string> = { u: url, e: email };
        if (aid) payload.aid = aid;
        const clientReferenceId = Buffer.from(JSON.stringify(payload)).toString('base64');

        // Only 2 products: AYA_SUB (19 CHF/mois) and PRO (499 CHF)
        let priceId = '';
        let mode: Stripe.Checkout.SessionCreateParams.Mode = 'payment';

        if (packType === 'AYA_SUB') {
            priceId = PRICE_AYA;
            mode = 'subscription';
        } else if (packType === 'PRO') {
            priceId = PRICE_PRO;
            mode = 'payment';
        } else {
            // Unknown pack type — reject
            logger.warn('CHECKOUT_UNKNOWN_PACK', `Unknown packType: ${packType}`);
            return NextResponse.json({ error: 'Pack inconnu' }, { status: 400 });
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
            success_url: `https://ai-visionary.com?session_id={CHECKOUT_SESSION_ID}&pack=${packType === 'PRO' ? 'pro' : 'plateforme'}`,
            cancel_url: 'https://ai-visionary.com',
            client_reference_id: clientReferenceId,
            customer_email: email,
            allow_promotion_codes: true,
            metadata: {
                pack_type: packType, // 'AYA_SUB' | 'PRO'
                analyzed_url: url,
                analysis_id: aid || '',
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
