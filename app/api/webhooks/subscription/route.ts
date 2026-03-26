import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { Resend } from 'resend';
import { db } from '@/lib/db';
import { createLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const resend = new Resend(process.env.RESEND_API_KEY || 're_build_placeholder');

const HANDLED_EVENTS = new Set([
    'customer.subscription.updated',
    'invoice.payment_failed',
    'customer.subscription.deleted',
]);

// --- EMAIL TEMPLATES ---

function buildPaymentFailedEmail(entityName: string, portalUrl: string): string {
    return `<div style="font-family: 'Helvetica Neue', Arial, sans-serif; color: #333; max-width: 640px; margin: 0 auto;">
    <div style="background: linear-gradient(135deg, #991b1b 0%, #CE6A6B 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: #fff; margin: 0; font-size: 22px;">&#9888;&#65039; Paiement échoué</h1>
        <p style="color: #fecaca; margin: 10px 0 0; font-size: 14px;">Votre abonnement AYA nécessite une action</p>
    </div>
    <div style="background: #fff; padding: 25px; border: 1px solid #e5e7eb;">
        <p>Bonjour,</p>
        <p>Le dernier paiement pour l'abonnement AYA de <strong>${entityName}</strong> a échoué.</p>
        <p>Sans action de votre part, votre inscription au registre AYA sera suspendue et les IA ne pourront plus consulter votre fiche certifiée.</p>
        <div style="text-align: center; margin: 25px 0;">
            <a href="${portalUrl}" style="background: #4A919E; color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px;">Mettre à jour mon moyen de paiement</a>
        </div>
        <p style="font-size: 13px; color: #6b7280;">Si vous avez des questions, répondez directement à cet email.</p>
    </div>
    <div style="background: #f9fafb; padding: 15px; border-radius: 0 0 12px 12px; text-align: center; border: 1px solid #e5e7eb; border-top: 0;">
        <p style="font-size: 12px; color: #9ca3af; margin: 0;">
            <a href="https://ai-visionary.com" style="color: #4A919E; text-decoration: none;">AI Visionary</a> — Rendez votre entreprise visible par les IA
        </p>
    </div>
</div>`;
}

function buildCancelledEmail(entityName: string, diagnosticUrl: string): string {
    return `<div style="font-family: 'Helvetica Neue', Arial, sans-serif; color: #333; max-width: 640px; margin: 0 auto;">
    <div style="background: linear-gradient(135deg, #212E53 0%, #4A919E 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: #fff; margin: 0; font-size: 22px;">Abonnement AYA annulé</h1>
        <p style="color: #BED3C3; margin: 10px 0 0; font-size: 14px;">Nous sommes tristes de vous voir partir</p>
    </div>
    <div style="background: #fff; padding: 25px; border: 1px solid #e5e7eb;">
        <p>Bonjour,</p>
        <p>Votre abonnement AYA pour <strong>${entityName}</strong> a été annulé.</p>
        <p>Votre fiche sera retirée du registre certifié AYA. Les assistants IA (ChatGPT, Claude, Gemini, Perplexity...) ne pourront plus consulter votre certificat AYA.</p>
        <p>Vous pouvez vous réinscrire à tout moment en relançant un diagnostic :</p>
        <div style="text-align: center; margin: 25px 0;">
            <a href="${diagnosticUrl}" style="background: #4A919E; color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px;">Relancer un diagnostic</a>
        </div>
        <p style="font-size: 13px; color: #6b7280;">Merci d'avoir fait partie du registre AYA.</p>
    </div>
    <div style="background: #f9fafb; padding: 15px; border-radius: 0 0 12px 12px; text-align: center; border: 1px solid #e5e7eb; border-top: 0;">
        <p style="font-size: 12px; color: #9ca3af; margin: 0;">
            <a href="https://ai-visionary.com" style="color: #4A919E; text-decoration: none;">AI Visionary</a> — Rendez votre entreprise visible par les IA
        </p>
    </div>
</div>`;
}

// --- MAIN HANDLER ---

export async function POST(req: NextRequest) {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
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
            const customerEmail = entity.email || invoice.customer_email;
            if (customerEmail) {
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
            } else {
                logger.warn('PAYMENT_FAILED_NO_EMAIL', `No email for entity ${entity.entity_id}, cannot send payment failed notification`, { entityId: entity.entity_id });
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
            const customerEmail = entity.email || (subscription.customer as Stripe.Customer)?.email;
            if (customerEmail) {
                const diagnosticUrl = 'https://ai-visionary.com/diagnostic';
                try {
                    await resend.emails.send({
                        from: 'registry@ai-visionary.com',
                        to: customerEmail,
                        subject: `Abonnement AYA annulé — ${entity.display_name || 'votre entreprise'}`,
                        html: buildCancelledEmail(
                            entity.display_name || 'votre entreprise',
                            diagnosticUrl,
                        ),
                    });
                    logger.info('SUB_CANCELLED_EMAIL_SENT', `Cancellation email sent to ${customerEmail}`, { entityId: entity.entity_id });
                } catch (emailErr: unknown) {
                    const emailMessage = emailErr instanceof Error ? emailErr.message : 'Unknown email error';
                    logger.error('SUB_CANCELLED_EMAIL_ERROR', `Failed to send cancellation email: ${emailMessage}`, { entityId: entity.entity_id });
                }
            } else {
                logger.warn('SUB_CANCELLED_NO_EMAIL', `No email for entity ${entity.entity_id}, cannot send cancellation notification`, { entityId: entity.entity_id });
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
