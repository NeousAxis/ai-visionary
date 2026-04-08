import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { db } from '@/lib/db';
import { createLogger, generateCorrelationId } from '@/lib/logger';
import { buildReviewReminderEmail } from '@/lib/email-templates';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const resend = process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ai-visionary.xyz';

/**
 * CRON: Review Reminders — Daily at 9 AM CET
 * Sends email to certified entities whose data is due for annual review.
 */
export async function GET(request: Request) {
    const correlationId = generateCorrelationId();
    const logger = createLogger(correlationId, 'system');

    // Verify CRON_SECRET (Vercel cron auth)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        logger.warn('auth', 'Unauthorized cron request');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info('start', 'Review reminders cron started');

    let processed = 0;
    let errors = 0;
    const errorDetails: string[] = [];

    try {
        const entities = await db.getEntitiesNeedingReview();
        logger.info('query', `Found ${entities.length} entities needing review`);

        for (const entity of entities) {
            const entityId = entity.entity_id;
            const email = entity.contact_email || entity.email;
            // Locale: from entity metadata or default 'en'
            const locale: 'fr' | 'en' = (entity as any).locale === 'fr' ? 'fr' : 'en';
            const en = locale === 'en';
            const name = entity.display_name || entity.legal_name || (en ? 'Your business' : 'Votre entreprise');

            if (!email) {
                logger.warn('skip', `No email for entity ${entityId} — skipping`);
                continue;
            }

            try {
                // Persist flag FIRST to avoid duplicate emails on retry
                await db.updateEntityLifecycle(entityId, {
                    renewal_reminder_sent: true,
                    renewal_reminder_sent_at: new Date().toISOString(),
                });

                if (resend) {
                    const updateUrl = `${BASE_URL}/update/${entityId}`;
                    await resend.emails.send({
                        from: 'AI Visionary <hello@ai-visionary.com>',
                        to: email,
                        subject: en
                            ? `${name} — Your AYA data is over a year old`
                            : `${name} — Vos données AYA ont plus d'un an`,
                        html: buildReviewReminderEmail(name, updateUrl, locale),
                    });
                }

                processed++;
                logger.info('sent', `Review reminder sent to ${email} for ${entityId}`);
            } catch (err) {
                errors++;
                const msg = err instanceof Error ? err.message : String(err);
                errorDetails.push(`${entityId}: ${msg}`);
                logger.error('send-fail', `Failed to send reminder to ${email}`, { entityId, error: msg });
            }
        }

        logger.info('done', `Review reminders complete: ${processed} sent, ${errors} errors`);

        return NextResponse.json({
            success: true,
            processed,
            errors,
            total: entities.length,
            ...(errorDetails.length > 0 && { errorDetails }),
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.critical('crash', `Review reminders cron crashed: ${msg}`);
        return NextResponse.json({ error: 'Internal error', message: msg }, { status: 500 });
    }
}
