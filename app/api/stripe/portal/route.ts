import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/lib/db';
import { createLogger, generateCorrelationId } from '@/lib/logger';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

// Force dynamic because we use request headers
export const dynamic = 'force-dynamic';

// Initialize Stripe lazily to avoid build-time crash
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
    if (!_stripe) {
        _stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_placeholder', {
            apiVersion: '2025-01-27.acacia' as any,
        });
    }
    return _stripe;
}

export async function POST(req: NextRequest) {
    // Rate limit: 5 requests/min per IP
    const rateLimited = checkRateLimit(req, 'stripe-portal', RATE_LIMITS.checkout);
    if (rateLimited) return rateLimited;

    const logger = createLogger(generateCorrelationId(), 'stripe');

    try {
        const body = await req.json();
        const { detectedUrl, sessionToken } = body;

        if (!detectedUrl) {
            return NextResponse.json({ error: "No URL provided." }, { status: 400 });
        }

        // AUTH CHECK: Require a valid OTP session token
        // The sessionToken proves the user authenticated via OTP for this URL
        if (!sessionToken) {
            logger.warn('PORTAL_NO_AUTH', `Portal access attempt without token for ${detectedUrl}`);
            return NextResponse.json({ error: "Authentication requise. Veuillez vous authentifier via OTP." }, { status: 401 });
        }

        logger.info('PORTAL_START', `Portal request for ${detectedUrl}`);

        // 1. Retrieve the Client Entity from DB
        // @ts-ignore
        const client = await db.getAyaEntityByUrl(detectedUrl);

        if (!client) {
            logger.warn('PORTAL_CLIENT_NOT_FOUND', `Client not found for ${detectedUrl}`);
            return NextResponse.json({ error: "Client not found." }, { status: 404 });
        }

        // 2. We need a Stripe Customer ID
        // It should be stored in the 'aya_registry' collection or 'analyses' collection.
        // Let's assume it's in the client object as `stripe_customer_id`.

        let customerId = client.stripe_customer_id;

        // Fallback: If not in DB, try to find in Stripe via Email
        if (!customerId && client.contact_email) {
            logger.info('PORTAL_STRIPE_LOOKUP', `Searching Stripe by email for ${detectedUrl}`);
            const customers = await getStripe().customers.list({
                email: client.contact_email,
                limit: 1,
            });

            if (customers.data.length > 0) {
                customerId = customers.data[0].id;
                logger.info('PORTAL_CUSTOMER_FOUND', `Found customer in Stripe`);

                // TODO: Save this ID back to DB for future speed?
            }
        }

        if (!customerId) {
            logger.error('PORTAL_NO_CUSTOMER', `No Stripe customer ID for ${detectedUrl}`);
            return NextResponse.json({
                error: "No Billing Account found. Please contact support manually.",
                is_legacy: true // Flag to tell frontend to show mailto fallback
            }, { status: 404 });
        }

        // 3. Create the Portal Session
        // This generates a short-lived URL where the customer can manage billing
        const session = await getStripe().billingPortal.sessions.create({
            customer: customerId,
            return_url: `https://www.ai-visionary.com`, // Where to go after "Done"
        });

        logger.info('PORTAL_CREATED', `Portal session created for ${detectedUrl}`);

        return NextResponse.json({
            success: true,
            url: session.url
        });

    } catch (error: any) {
        logger.error('PORTAL_ERROR', error.message || 'Unknown error');
        return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
    }
}
