import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { db } from '@/lib/db';
import { createLogger, generateCorrelationId } from '@/lib/logger';
import { buildExpiryReminderEmail } from '@/lib/email-templates';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const resend = process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ai-visionary.xyz';

// Reminder thresholds in days before expiration
const REMINDER_THRESHOLDS = [90, 30, 7] as const;

/**
 * CRON: Expiry Reminders — Daily at 9 AM CET
 * Sends reminder emails at J-90, J-30, J-7 before certificate expiration.
 */
export async function GET(request: Request) {
    const correlationId = generateCorrelationId();
    const logger = createLogger(correlationId, 'system');

    // Verify CRON_SECRET
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        logger.warn('auth', 'Unauthorized cron request');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info('start', 'Expiry reminders cron started');

    let processed = 0;
    let errors = 0;
    const errorDetails: string[] = [];
    const summary: Record<string, number> = {};

    try {
        for (const days of REMINDER_THRESHOLDS) {
            const entities = await db.getExpiringEntities(days);
            const label = `J-${days}`;
            summary[label] = 0;

            logger.info('query', `Found ${entities.length} entities expiring within ${days} days`);

            for (const entity of entities) {
                const entityId = entity.entity_id;
                const email = entity.contact_email || entity.email;
                const entityLocale: 'fr' | 'en' = (entity as any).locale === 'fr' ? 'fr' : 'en';
                const name = entity.display_name || entity.legal_name || (entityLocale === 'en' ? 'Your business' : 'Votre entreprise');

                if (!email) {
                    logger.warn('skip', `No email for entity ${entityId} — skipping`);
                    continue;
                }

                // Locale: from entity metadata or default 'en'
                const locale: 'fr' | 'en' = (entity as any).locale === 'fr' ? 'fr' : 'en';
                const en = locale === 'en';

                // Check if we already sent this specific reminder tier
                const alreadySent =
                    (days === 90 && entity.expiry_reminder_90d_sent === true) ||
                    (days === 30 && entity.expiry_reminder_30d_sent === true) ||
                    (days === 7 && entity.expiry_reminder_7d_sent === true);

                if (alreadySent) {
                    continue;
                }

                try {
                    // Persist flag FIRST to avoid duplicate emails on retry
                    const now = new Date().toISOString();
                    if (days === 90) {
                        await db.updateEntityLifecycle(entityId, { expiry_reminder_90d_sent: true, expiry_reminder_90d_sent_at: now });
                    } else if (days === 30) {
                        await db.updateEntityLifecycle(entityId, { expiry_reminder_30d_sent: true, expiry_reminder_30d_sent_at: now });
                    } else if (days === 7) {
                        await db.updateEntityLifecycle(entityId, { expiry_reminder_7d_sent: true, expiry_reminder_7d_sent_at: now });
                    }

                    if (resend) {
                        const renewUrl = `${BASE_URL}/dashboard/${entityId}`;
                        const daysPlural = days > 1;

                        await resend.emails.send({
                            from: 'AI Visionary <hello@ai-visionary.com>',
                            to: email,
                            subject: en
                                ? `${name} — Your AYA certificate expires ${days <= 7 ? 'in ' + days + ' day' + (daysPlural ? 's' : '') : 'soon'}`
                                : `${name} — Votre certificat AYA expire ${days <= 7 ? 'dans ' + days + ' jours' : 'bientot'}`,
                            html: buildExpiryReminderEmail(name, days, renewUrl, locale),
                        });
                    }

                    processed++;
                    summary[label]++;
                    logger.info('sent', `Expiry reminder (${label}) sent to ${email} for ${entityId}`);
                } catch (err) {
                    errors++;
                    const msg = err instanceof Error ? err.message : String(err);
                    errorDetails.push(`${entityId} (${label}): ${msg}`);
                    logger.error('send-fail', `Failed to send expiry reminder to ${email}`, { entityId, days, error: msg });
                }
            }
        }

        logger.info('done', `Expiry reminders complete: ${processed} sent, ${errors} errors`);

        return NextResponse.json({
            success: true,
            processed,
            errors,
            summary,
            ...(errorDetails.length > 0 && { errorDetails }),
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.critical('crash', `Expiry reminders cron crashed: ${msg}`);
        return NextResponse.json({ error: 'Internal error', message: msg }, { status: 500 });
    }
}
