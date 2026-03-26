import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createLogger, generateCorrelationId } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * CRON: Expire Entities — Daily at 2 AM CET
 * Deactivates certified entities whose valid_until date has passed.
 * Sets payment_completed = false (drops from active certified registry).
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

    logger.info('start', 'Expire entities cron started');

    try {
        const expiredIds = await db.markEntitiesExpired();

        if (expiredIds.length === 0) {
            logger.info('done', 'No entities to expire');
            return NextResponse.json({
                success: true,
                expired: 0,
                message: 'No entities to expire',
            });
        }

        // Log each expiration individually for traceability
        for (const entityId of expiredIds) {
            logger.info('expired', `Entity ${entityId} marked as expired`, { entityId });
        }

        logger.info('done', `Expire entities complete: ${expiredIds.length} expired`);

        return NextResponse.json({
            success: true,
            expired: expiredIds.length,
            entityIds: expiredIds,
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.critical('crash', `Expire entities cron crashed: ${msg}`);
        return NextResponse.json({ error: 'Internal error', message: msg }, { status: 500 });
    }
}
