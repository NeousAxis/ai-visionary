import { NextRequest, NextResponse } from 'next/server';
import { getAyaLiveAggregated } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createLogger, generateCorrelationId } from '@/lib/logger';
import { trackAyaCall } from '@/lib/aya/api-tracker';

export const dynamic = 'force-dynamic'; // Prevent Vercel from caching the empty list

export async function GET(req: NextRequest) {
    // Rate limit: 30 requests/min per IP (public API)
    const rateLimited = checkRateLimit(req, 'aya-live', RATE_LIMITS.default);
    if (rateLimited) return rateLimited;
    trackAyaCall(req, 'live');

    const logger = createLogger(generateCorrelationId(), 'system');

    try {
        const limitParam = parseInt(req.nextUrl.searchParams.get('limit') || '5000');
        const offsetParam = parseInt(req.nextUrl.searchParams.get('offset') || '0');
        const limit = Math.min(Math.max(limitParam, 1), 10000);
        const offset = Math.max(offsetParam, 0);

        const result = await getAyaLiveAggregated(limit, offset);

        return NextResponse.json(result, {
            headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' }
        });
    } catch (err) {
        logger.error('AYA_LIVE_ERROR', err instanceof Error ? err.message : 'Unknown error');
        return NextResponse.json({
            success: false,
            error: 'Internal Server Error'
        }, { status: 500 });
    }
}
