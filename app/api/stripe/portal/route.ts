import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db, supabase } from '@/lib/db';
import { createLogger, generateCorrelationId } from '@/lib/logger';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { verifyUpdateToken } from '@/lib/update-token';

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
        const { entityId, token } = body;

        // --- Validate ---
        if (!entityId || typeof entityId !== 'string') {
            return NextResponse.json({ error: 'entityId requis' }, { status: 400 });
        }

        // --- Auth: HMAC token (stateless, survives Firestore→Supabase→Infomaniak) ---
        if (!token || !verifyUpdateToken(token, entityId)) {
            logger.warn('PORTAL_INVALID_TOKEN', `Invalid token for entity ${entityId}`);
            return NextResponse.json(
                { error: 'Token invalide ou expire. Rechargez la page.' },
                { status: 401 }
            );
        }

        // --- Fetch entity ---
        const client = await db.getAyaEntityById(entityId);
        if (!client) {
            logger.warn('PORTAL_ENTITY_NOT_FOUND', `Entity not found: ${entityId}`);
            return NextResponse.json({ error: 'Entite introuvable' }, { status: 404 });
        }

        const stripe = getStripe();
        let customerId: string | null = client.stripe_customer_id || null;

        // --- Persist new customer ID to DB (1-row update, ownership proven by HMAC token) ---
        const persistCustomerId = async (cid: string) => {
            try {
                if (supabase) {
                    await supabase
                        .from('aya_registry')
                        .update({ stripe_customer_id: cid })
                        .eq('entity_id', entityId);
                    logger.info('PORTAL_CUSTOMER_PERSISTED', `Updated stripe_customer_id for entity ${entityId}`);
                }
            } catch (e: any) {
                logger.warn('PORTAL_PERSIST_FAILED', `Failed to persist customer ID: ${e?.message}`);
            }
        };

        // --- Attempt 1: stored customer ID (may be legacy TEST in LIVE mode) ---
        if (customerId) {
            try {
                const session = await stripe.billingPortal.sessions.create({
                    customer: customerId,
                    return_url: 'https://ai-visionary.xyz',
                });
                logger.info('PORTAL_CREATED', `Portal created for entity ${entityId}`);
                return NextResponse.json({ success: true, url: session.url });
            } catch (e: any) {
                // Stored ID is invalid (e.g. cus_test_... in LIVE mode after 11 April 2026)
                logger.warn('PORTAL_INVALID_CUSTOMER', `Stored customer ID rejected: ${e?.code || e?.type || 'unknown'}`);
                customerId = null;
            }
        }

        // --- Attempt 2: lookup by email in current Stripe mode (auto-migrate TEST→LIVE) ---
        if (!customerId && client.contact_email) {
            try {
                const customers = await stripe.customers.list({ email: client.contact_email, limit: 1 });
                if (customers.data.length > 0) {
                    customerId = customers.data[0].id;
                    logger.info('PORTAL_CUSTOMER_FOUND_BY_EMAIL', `Found customer for ${client.contact_email}`);
                    await persistCustomerId(customerId);
                }
            } catch (e: any) {
                logger.warn('PORTAL_LOOKUP_FAILED', `Email lookup failed: ${e?.message}`);
            }
        }

        // --- No customer found anywhere ---
        if (!customerId) {
            logger.warn('PORTAL_NO_CUSTOMER', `No Stripe customer for entity ${entityId}`);
            return NextResponse.json(
                {
                    error: 'Aucun compte de facturation trouve. Contactez hello@ai-visionary.xyz.',
                    is_legacy: true,
                },
                { status: 404 }
            );
        }

        // --- Retry portal session creation with newly resolved customer ID ---
        try {
            const session = await stripe.billingPortal.sessions.create({
                customer: customerId,
                return_url: 'https://ai-visionary.xyz',
            });
            logger.info('PORTAL_CREATED', `Portal created for entity ${entityId} (after email lookup)`);
            return NextResponse.json({ success: true, url: session.url });
        } catch (e: any) {
            logger.error('PORTAL_CREATE_FAILED', e?.message || 'Unknown error');
            return NextResponse.json(
                { error: 'Erreur creation portail Stripe' },
                { status: 500 }
            );
        }
    } catch (error: any) {
        logger.error('PORTAL_ERROR', error?.message || 'Unknown error');
        return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
    }
}
