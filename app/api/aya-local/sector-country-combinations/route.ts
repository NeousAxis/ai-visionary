import { NextRequest, NextResponse } from 'next/server';
import { isLocalPgConfigured, localPgGetSectorCountryCombinations } from '@/lib/db-local-pg';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { trackAyaCall } from '@/lib/aya/api-tracker';

export const dynamic = 'force-dynamic';

const CACHE_HEADERS = {
    'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=120',
};

/**
 * GET /api/aya-local/sector-country-combinations
 *
 * Returns: { source, combinations: [{ sector, country, count }] }
 *
 * VPS-side equivalent of db.getAyaSectorCountryCombinations().
 * Called internally by getAyaSectorCountryCombinationsAggregated() in lib/db.ts.
 */
export async function GET(req: NextRequest) {
    const rateLimited = checkRateLimit(req, 'aya-local-sector-country-combinations', RATE_LIMITS.default);
    if (rateLimited) return rateLimited;
    trackAyaCall(req, 'local-sector-country-combinations');

    if (!isLocalPgConfigured()) {
        return NextResponse.json(
            { error: 'VPS Postgres not configured', source: 'aya-local' },
            { status: 503 }
        );
    }

    try {
        const combinations = await localPgGetSectorCountryCombinations();
        return NextResponse.json(
            { source: 'aya-local', n: combinations.length, combinations },
            { headers: CACHE_HEADERS }
        );
    } catch (err) {
        console.error('[aya-local/sector-country-combinations] error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
