import { NextRequest, NextResponse } from 'next/server';
import { getLiveEntities } from '@/lib/aya/registry';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createLogger, generateCorrelationId } from '@/lib/logger';

export const dynamic = 'force-dynamic'; // Prevent Vercel from caching the empty list

export async function GET(req: NextRequest) {
    // Rate limit: 30 requests/min per IP (public API)
    const rateLimited = checkRateLimit(req, 'aya-live', RATE_LIMITS.default);
    if (rateLimited) return rateLimited;

    const logger = createLogger(generateCorrelationId(), 'system');

    try {
        const entities = await getLiveEntities();

        return NextResponse.json({
            success: true,
            data: entities
        });
    } catch (err) {
        logger.error('AYA_LIVE_ERROR', err instanceof Error ? err.message : 'Unknown error');
        return NextResponse.json({
            success: false,
            error: 'Internal Server Error'
        }, { status: 500 });
    }
}
