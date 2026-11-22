import { NextResponse } from 'next/server';
import { createLogger, generateCorrelationId } from '@/lib/logger';
import { runOutreachBatch } from '@/lib/outreach/run';

/**
 * CRON: Outreach warmup — envoi quotidien d'une petite fournee.
 *
 * INERTE PAR DEFAUT : runOutreachBatch force le dry-run tant que
 * OUTREACH_ENABLED !== 'true' OU que l'identite SMTP dediee n'est pas configuree.
 * Pour armer reellement : creer la boite outreach@, definir OUTREACH_SMTP_*,
 * puis OUTREACH_ENABLED=true (voir NEOUSBOT-OUTREACH-RUNBOOK.md).
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: Request) {
    const correlationId = generateCorrelationId();
    const logger = createLogger(correlationId, 'cron');

    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get('authorization');
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        logger.warn('auth', 'Unauthorized outreach cron request');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const campaign = process.env.OUTREACH_CAMPAIGN || 'default';
    logger.info('start', `Outreach cron started (campaign=${campaign})`);

    try {
        const summary = await runOutreachBatch({ campaign });
        logger.info('done', `Outreach cron done: sent=${summary.sent} failed=${summary.failed} skipped=${summary.skipped} dryRun=${summary.dryRun}`);
        // On ne renvoie pas les details (emails) dans la reponse cron.
        return NextResponse.json({
            success: true,
            campaign: summary.campaign,
            sent: summary.sent,
            failed: summary.failed,
            skipped: summary.skipped,
            attempted: summary.attempted,
            dryRun: summary.dryRun,
            enabled: summary.enabled,
            senderConfigured: summary.senderConfigured,
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.critical('crash', `Outreach cron crashed: ${msg}`);
        return NextResponse.json({ error: 'Internal error', message: msg }, { status: 500 });
    }
}
