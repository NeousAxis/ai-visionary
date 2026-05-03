import { NextRequest, NextResponse } from 'next/server';
import { isLocalPgConfigured, localPgGetCountries } from '@/lib/db-local-pg';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { trackAyaCall } from '@/lib/aya/api-tracker';

export const dynamic = 'force-dynamic';

const CACHE_HEADERS = {
    'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=120',
};

/**
 * GET /api/aya-local/countries
 *
 * Returns: { source, countries: [{ country, count }] }
 *
 * VPS-side equivalent of db.getAyaCountries().
 * Called internally by getAyaCountriesAggregated() in lib/db.ts.
 */
export async function GET(req: NextRequest) {
    const rateLimited = checkRateLimit(req, 'aya-local-countries', RATE_LIMITS.default);
    if (rateLimited) return rateLimited;
    trackAyaCall(req, 'local-countries');

    if (!isLocalPgConfigured()) {
        return NextResponse.json(
            { error: 'VPS Postgres not configured', source: 'aya-local' },
            { status: 503 }
        );
    }

    try {
        const countries = await localPgGetCountries();
        return NextResponse.json(
            { source: 'aya-local', n: countries.length, countries },
            { headers: CACHE_HEADERS }
        );
    } catch (err) {
        console.error('[aya-local/countries] error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
