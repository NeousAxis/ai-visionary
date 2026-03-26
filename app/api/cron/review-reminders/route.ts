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
            const name = entity.display_name || entity.legal_name || 'Votre entreprise';

            if (!email) {
                logger.warn('skip', `No email for entity ${entityId} — skipping`);
                continue;
            }

            try {
                if (resend) {
                    const updateUrl = `${BASE_URL}/update/${entityId}`;
                    await resend.emails.send({
                        from: 'AI Visionary <hello@ai-visionary.com>',
                        to: email,
                        subject: `${name} — Vos données AYA ont plus d'un an`,
                        html: buildReviewEmailHtml({ name, entityId, updateUrl }),
                    });
                }

                // Mark as reminded
                await db.updateEntityLifecycle(entityId, {
                    renewal_reminder_sent: true,
                    renewal_reminder_sent_at: new Date().toISOString(),
                });

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

function buildReviewEmailHtml(params: { name: string; entityId: string; updateUrl: string }): string {
    const { name, entityId, updateUrl } = params;
    return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
    <div style="background: linear-gradient(135deg, #212E53, #4A919E); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Mise a jour annuelle</h1>
        <p style="color: #BED3C3; margin: 8px 0 0; font-size: 14px;">Registre AYA — AI Visionary</p>
    </div>
    <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p>Bonjour,</p>
        <p>Les donnees de <strong>${name}</strong> dans le registre AYA ont plus d'un an.
        Pour maintenir votre visibilite aupres des IA (ChatGPT, Claude, Gemini, Perplexity...),
        nous vous recommandons de mettre a jour vos informations.</p>
        <p>Une mise a jour reguliere garantit que les assistants IA disposent de donnees fraiches
        et vous recommandent correctement.</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="${updateUrl}" style="background: #4A919E; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">Mettre a jour mes donnees</a>
        </div>
        <p style="font-size: 13px; color: #6b7280;">Identifiant entite : ${entityId}</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="font-size: 12px; color: #9ca3af; text-align: center;">AI Visionary — Geneve, Suisse<br>hello@ai-visionary.com</p>
    </div>
</body>
</html>`;
}
