import { NextResponse } from 'next/server';
import { createLogger, generateCorrelationId } from '@/lib/logger';
import { runAgentFarm } from '@/lib/agent-farm/run';

/**
 * CRON: Agent farm — fait tourner périodiquement nos agents IA sur AYA.
 *
 * Bootstrap du côté demande : génère une demande réelle et continue sur le registre
 * (« des agents interrogent AYA »), exerce le cashback, prouve la boucle.
 * Coût borné : `AGENT_FARM_COUNT` agents par exécution (défaut 10), 2 appels Infomaniak
 * chacun. Mettre `AGENT_FARM_ENABLED=false` pour suspendre.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: Request) {
    const correlationId = generateCorrelationId();
    const logger = createLogger(correlationId, 'cron');

    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get('authorization');
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        logger.warn('auth', 'Unauthorized agent-farm cron request');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (process.env.AGENT_FARM_ENABLED === 'false') {
        return NextResponse.json({ success: true, skipped: true, reason: 'AGENT_FARM_ENABLED=false' });
    }

    const count = Math.min(Math.max(Number(process.env.AGENT_FARM_COUNT || '10'), 1), 50);
    logger.info('start', `Agent farm cron started (count=${count})`);
    try {
        const summary = await runAgentFarm({ count });
        logger.info('done', `Agent farm: ran=${summary.ran} picks=${summary.with_picks} cashback=${summary.with_cashback} errors=${summary.errors}`);
        return NextResponse.json({ success: true, ...summary, sample: undefined });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.critical('crash', `Agent farm cron crashed: ${msg}`);
        return NextResponse.json({ error: 'Internal error', message: msg }, { status: 500 });
    }
}
