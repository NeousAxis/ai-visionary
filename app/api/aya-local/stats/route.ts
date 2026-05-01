import { NextRequest, NextResponse } from 'next/server';
import { isLocalPgConfigured, localPgGetStats } from '@/lib/db-local-pg';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { trackAyaCall } from '@/lib/aya/api-tracker';

export const dynamic = 'force-dynamic';

const CACHE_HEADERS = {
    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
};

export async function GET(req: NextRequest) {
    const rateLimited = checkRateLimit(req, 'aya-local-stats', RATE_LIMITS.default);
    if (rateLimited) return rateLimited;
    trackAyaCall(req, 'local-stats');

    if (!isLocalPgConfigured()) {
        return NextResponse.json(
            { error: 'VPS Postgres not configured', source: 'aya-local' },
            { status: 503 }
        );
    }

    try {
        const stats = await localPgGetStats();

        return NextResponse.json(
            {
                source: 'aya-local',
                total_entities: stats.total,
                scores:         stats.scores,
                sectors:        stats.sectors,
                countries:      stats.countries,
                last_updated:   new Date().toISOString(),
            },
            { headers: CACHE_HEADERS }
        );
    } catch (err) {
        console.error('[aya-local/stats] error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
