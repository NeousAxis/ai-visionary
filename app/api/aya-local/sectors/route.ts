import { NextRequest, NextResponse } from 'next/server';
import { isLocalPgConfigured, localPgGetSectors } from '@/lib/db-local-pg';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { trackAyaCall } from '@/lib/aya/api-tracker';

export const dynamic = 'force-dynamic';

const CACHE_HEADERS = {
    'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=120',
};

/**
 * GET /api/aya-local/sectors
 *
 * Returns: { source, sectors: [{ sector, count }] }
 *
 * VPS-side equivalent of db.getAyaSectors().
 * Called internally by getAyaSectorsAggregated() in lib/db.ts.
 */
export async function GET(req: NextRequest) {
    const rateLimited = checkRateLimit(req, 'aya-local-sectors', RATE_LIMITS.default);
    if (rateLimited) return rateLimited;
    trackAyaCall(req, 'local-sectors');

    if (!isLocalPgConfigured()) {
        return NextResponse.json(
            { error: 'VPS Postgres not configured', source: 'aya-local' },
            { status: 503 }
        );
    }

    try {
        const sectors = await localPgGetSectors();
        return NextResponse.json(
            { source: 'aya-local', n: sectors.length, sectors },
            { headers: CACHE_HEADERS }
        );
    } catch (err) {
        console.error('[aya-local/sectors] error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
