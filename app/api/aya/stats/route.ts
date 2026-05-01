import { NextRequest, NextResponse } from 'next/server';
import { getAyaStatsAggregated } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { trackAyaCall } from '@/lib/aya/api-tracker';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const rateLimited = checkRateLimit(req, 'aya-stats', RATE_LIMITS.default);
    if (rateLimited) return rateLimited;
    trackAyaCall(req, 'stats');

    try {
        const stats = await getAyaStatsAggregated();

        return NextResponse.json({
            ...stats,
            source: 'aggregated',
        }, {
            headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=60' }
        });
    } catch (err) {
        console.error('AYA stats error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
