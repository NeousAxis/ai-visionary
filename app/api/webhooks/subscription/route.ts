import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { Resend } from 'resend';
import { db } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import { buildPaymentFailedEmail, buildCancellationEmail } from '@/lib/email-templates';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Bug 3 fix: conditional Resend init (no placeholder fallback)
const resend = process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

const HANDLED_EVENTS = new Set([
    'customer.subscription.updated',
    'invoice.payment_failed',
    'customer.subscription.deleted',
]);

// --- MAIN HANDLER ---

export async function POST(req: NextRequest) {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    // Bug 2 fix: dedicated subscription webhook secret with fallback
    const webhookSecret = process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET || '';
    let stripe: Stripe | null = null;

    if (stripeKey) stripe = new Stripe(stripeKey);

    const logger = createLogger('webhook', 'stripe');

    try {
        const rawBody = await req.text();
        const signature = req.headers.get('stripe-signature');

        // SECURITY: Stripe webhook signature verification is MANDATORY
        if (!webhookSecret || !signature || !stripe) {
            logger.error('SUB_WEBHOOK_CONFIG_MISSING', 'Missing Stripe config for subscription webhook');
            return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
        }

        let event: Stripe.Event;
        try {
            event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown signature error';
            logger.error('SUB_WEBHOOK_SIG_FAIL', message);
            return NextResponse.json({ error: 'Signature invalide' }, { status: 400 });
        }

        // Only handle subscription-related events
        if (!HANDLED_EVENTS.has(event.type)) {
            return NextResponse.json({ received: true });
        }

        logger.info('SUB_WEBHOOK_START', `Received ${event.type}`, { event_type: event.type, event_id: event.id });

        // --- 1. customer.subscription.updated ---
        if (event.type === 'customer.subscription.updated') {
            const subscription = event.data.object as Stripe.Subscription;
            const subscriptionId = subscription.id;
            const status = subscription.status;

            logger.info('SUB_UPDATED', `Subscription ${subscriptionId} status: ${status}`, { subscriptionId, status });

            const entity = await db.getEntityBySubscriptionId(subscriptionId);
            if (!entity) {
                logger.warn('SUB_ENTITY_NOT_FOUND', `No entity found for subscription ${subscriptionId}`, { subscriptionId });
                return NextResponse.json({ received: true, warning: 'entity_not_found' });
            }

            await db.updateEntityLifecycle(entity.entity_id, {
                subscription_status: status,
            });

            if (status === 'past_due') {
                logger.warn('SUB_PAST_DUE', `Subscription ${subscriptionId} is past_due for entity ${entity.entity_id}`, {
                    subscriptionId,
                    entityId: entity.entity_id,
                    entityName: entity.display_name,
                });
            }

            logger.info('SUB_UPDATED_OK', `Entity ${entity.entity_id} subscription_status updated to ${status}`);
            return NextResponse.json({ received: true, status });
        }

        // --- 2. invoice.payment_failed ---
        if (event.type === 'invoice.payment_failed') {
            const invoice = event.data.object as Stripe.Invoice;
            // Stripe v20+ types: subscription may be string | Subscription | null
            const rawSub = (invoice as any).subscription;
            const subscriptionId = typeof rawSub === 'string'
                ? rawSub
                : rawSub?.id;

            if (!subscriptionId) {
                logger.warn('SUB_NO_SUBSCRIPTION_ID', 'invoice.payment_failed without subscription ID', { invoiceId: invoice.id });
                return NextResponse.json({ received: true, warning: 'no_subscription_id' });
            }

            logger.info('PAYMENT_FAILED', `Payment failed for subscription ${subscriptionId}`, { subscriptionId, invoiceId: invoice.id });

            const entity = await db.getEntityBySubscriptionId(subscriptionId);
            if (!entity) {
                logger.warn('SUB_ENTITY_NOT_FOUND', `No entity found for subscription ${subscriptionId}`, { subscriptionId });
                return NextResponse.json({ received: true, warning: 'entity_not_found' });
            }

            await db.updateEntityLifecycle(entity.entity_id, {
                subscription_status: 'past_due',
            });

            // Send payment failed email
            // Bug 11 fix: use entity email only (no Stripe customer cast)
            const customerEmail = entity.contact_email || entity.email || invoice.customer_email;
            if (customerEmail && resend) {
                const portalUrl = 'https://ai-visionary.com/diagnostic';
                try {
                    await resend.emails.send({
                        from: 'registry@ai-visionary.com',
                        to: customerEmail,
                        subject: `Paiement échoué — ${entity.display_name || 'votre abonnement AYA'}`,
                        html: buildPaymentFailedEmail(
                            entity.display_name || 'votre entreprise',
                            portalUrl,
                        ),
                    });
                    logger.info('PAYMENT_FAILED_EMAIL_SENT', `Payment failed email sent to ${customerEmail}`, { entityId: entity.entity_id });
                } catch (emailErr: unknown) {
                    const emailMessage = emailErr instanceof Error ? emailErr.message : 'Unknown email error';
                    logger.error('PAYMENT_FAILED_EMAIL_ERROR', `Failed to send payment failed email: ${emailMessage}`, { entityId: entity.entity_id });
                }
            } else if (!customerEmail) {
                logger.warn('PAYMENT_FAILED_NO_EMAIL', `No email for entity ${entity.entity_id}, cannot send payment failed notification`, { entityId: entity.entity_id });
            } else if (!resend) {
                logger.warn('PAYMENT_FAILED_NO_RESEND', 'Resend not configured, skipping payment failed email', { entityId: entity.entity_id });
            }

            return NextResponse.json({ received: true, action: 'payment_failed_processed' });
        }

        // --- 3. customer.subscription.deleted ---
        if (event.type === 'customer.subscription.deleted') {
            const subscription = event.data.object as Stripe.Subscription;
            const subscriptionId = subscription.id;

            logger.info('SUB_DELETED', `Subscription ${subscriptionId} cancelled`, { subscriptionId });

            const entity = await db.getEntityBySubscriptionId(subscriptionId);
            if (!entity) {
                logger.warn('SUB_ENTITY_NOT_FOUND', `No entity found for subscription ${subscriptionId}`, { subscriptionId });
                return NextResponse.json({ received: true, warning: 'entity_not_found' });
            }

            await db.updateEntityLifecycle(entity.entity_id, {
                subscription_status: 'canceled',
                payment_completed: false,
            });

            // Send cancellation email
            // Bug 11 fix: use entity email only (no Stripe customer cast)
            const customerEmail = entity.contact_email || entity.email;
            if (customerEmail && resend) {
                const diagnosticUrl = 'https://ai-visionary.com/diagnostic';
                try {
                    await resend.emails.send({
                        from: 'registry@ai-visionary.com',
                        to: customerEmail,
                        subject: `Abonnement AYA annulé — ${entity.display_name || 'votre entreprise'}`,
                        html: buildCancellationEmail(
                            entity.display_name || 'votre entreprise',
                            diagnosticUrl,
                        ),
                    });
                    logger.info('SUB_CANCELLED_EMAIL_SENT', `Cancellation email sent to ${customerEmail}`, { entityId: entity.entity_id });
                } catch (emailErr: unknown) {
                    const emailMessage = emailErr instanceof Error ? emailErr.message : 'Unknown email error';
                    logger.error('SUB_CANCELLED_EMAIL_ERROR', `Failed to send cancellation email: ${emailMessage}`, { entityId: entity.entity_id });
                }
            } else if (!customerEmail) {
                logger.warn('SUB_CANCELLED_NO_EMAIL', `No email for entity ${entity.entity_id}, cannot send cancellation notification`, { entityId: entity.entity_id });
            } else if (!resend) {
                logger.warn('SUB_CANCELLED_NO_RESEND', 'Resend not configured, skipping cancellation email', { entityId: entity.entity_id });
            }

            logger.info('SUB_DELETED_OK', `Entity ${entity.entity_id} marked as canceled, payment_completed=false`);
            return NextResponse.json({ received: true, action: 'subscription_deleted_processed' });
        }

        // Fallback for any unhandled event that passed the filter
        return NextResponse.json({ received: true });

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('SUB_WEBHOOK_FATAL', `Subscription webhook fatal error: ${message}`);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
