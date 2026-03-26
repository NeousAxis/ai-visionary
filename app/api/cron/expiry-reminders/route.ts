import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { db } from '@/lib/db';
import { createLogger, generateCorrelationId } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const resend = process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://ai-visionary.com';

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
                const name = entity.display_name || entity.legal_name || 'Votre entreprise';
                const validUntil = entity.valid_until;

                if (!email) {
                    logger.warn('skip', `No email for entity ${entityId} — skipping`);
                    continue;
                }

                // Check if we already sent this specific reminder tier
                const alreadySent =
                    (days === 90 && entity.expiry_reminder_90d_sent === true) ||
                    (days === 30 && entity.expiry_reminder_30d_sent === true) ||
                    (days === 7 && entity.expiry_reminder_7d_sent === true);

                if (alreadySent) {
                    continue;
                }

                try {
                    if (resend) {
                        const renewUrl = `${BASE_URL}/renew/${entityId}`;
                        const expiryDate = validUntil
                            ? new Date(validUntil).toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })
                            : 'bientot';

                        await resend.emails.send({
                            from: 'AI Visionary <hello@ai-visionary.com>',
                            to: email,
                            subject: `${name} — Votre certificat AYA expire ${days <= 7 ? 'dans ' + days + ' jours' : 'bientot'}`,
                            html: buildExpiryEmailHtml({ name, entityId, renewUrl, expiryDate, daysLeft: days }),
                        });
                    }

                    // Mark this reminder tier as sent
                    const now = new Date().toISOString();
                    if (days === 90) {
                        await db.updateEntityLifecycle(entityId, { expiry_reminder_90d_sent: true, expiry_reminder_90d_sent_at: now });
                    } else if (days === 30) {
                        await db.updateEntityLifecycle(entityId, { expiry_reminder_30d_sent: true, expiry_reminder_30d_sent_at: now });
                    } else if (days === 7) {
                        await db.updateEntityLifecycle(entityId, { expiry_reminder_7d_sent: true, expiry_reminder_7d_sent_at: now });
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

function buildExpiryEmailHtml(params: {
    name: string;
    entityId: string;
    renewUrl: string;
    expiryDate: string;
    daysLeft: number;
}): string {
    const { name, entityId, renewUrl, expiryDate, daysLeft } = params;
    const urgencyColor = daysLeft <= 7 ? '#991b1b' : daysLeft <= 30 ? '#854d0e' : '#4A919E';
    const urgencyBg = daysLeft <= 7 ? '#fee2e2' : daysLeft <= 30 ? '#fef9c3' : '#f0fdfa';

    return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
    <div style="background: linear-gradient(135deg, #212E53, #4A919E); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Renouvellement AYA</h1>
        <p style="color: #BED3C3; margin: 8px 0 0; font-size: 14px;">Registre AYA — AI Visionary</p>
    </div>
    <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p>Bonjour,</p>
        <div style="background: ${urgencyBg}; border-left: 4px solid ${urgencyColor}; padding: 16px; border-radius: 4px; margin: 20px 0;">
            <strong style="color: ${urgencyColor};">Le certificat AYA de ${name} expire le ${expiryDate}.</strong>
            <p style="margin: 8px 0 0; color: #4b5563;">Il reste <strong>${daysLeft} jours</strong> avant l'expiration.</p>
        </div>
        <p>Sans renouvellement, votre entreprise ne sera plus visible comme "certifiee" dans le registre AYA
        et les assistants IA ne pourront plus verifier votre statut.</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="${renewUrl}" style="background: #4A919E; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Renouveler mon certificat</a>
        </div>
        <p style="font-size: 13px; color: #6b7280;">Identifiant entite : ${entityId}</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="font-size: 12px; color: #9ca3af; text-align: center;">AI Visionary — Geneve, Suisse<br>hello@ai-visionary.com</p>
    </div>
</body>
</html>`;
}
