import { NextRequest, NextResponse } from 'next/server';
import { isLocalPgConfigured, localPgGetEntitiesByFilter } from '@/lib/db-local-pg';
import { resolveSectorMacro } from '@/lib/aya/llm-format';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { trackAyaCall } from '@/lib/aya/api-tracker';

export const dynamic = 'force-dynamic';

const CACHE_HEADERS = {
    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
};

const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 50;

/**
 * GET /api/aya-local/by-filter
 *
 * Query params:
 *   sector  — EN label OR FR sector_macro key (resolveSectorMacro handles both)
 *   country — ISO 2-letter code (uppercased automatically)
 *   limit   — default 50, max 500
 *   offset  — default 0
 *
 * Returns: { source, total, n, offset, limit, data }
 *
 * This is the VPS-side equivalent of db.getAyaEntitiesByFilter().
 * It is called internally by getAyaEntitiesByFilterAggregated() in lib/db.ts.
 * Not exposed publicly (AYA_VPS_API_URL is localhost-only in prod).
 */
export async function GET(req: NextRequest) {
    const rateLimited = checkRateLimit(req, 'aya-local-by-filter', RATE_LIMITS.default);
    if (rateLimited) return rateLimited;
    trackAyaCall(req, 'local-by-filter');

    if (!isLocalPgConfigured()) {
        return NextResponse.json(
            { error: 'VPS Postgres not configured', source: 'aya-local' },
            { status: 503 }
        );
    }

    const sp = req.nextUrl.searchParams;

    // sector: accepts EN label or FR key — resolveSectorMacro normalises to FR key
    const rawSector = sp.get('sector') ?? undefined;
    const sector    = rawSector ? resolveSectorMacro(decodeURIComponent(rawSector)) : undefined;
    const country   = sp.get('country')?.toUpperCase() ?? undefined;

    const limitParam  = parseInt(sp.get('limit')  ?? String(DEFAULT_LIMIT), 10);
    const offsetParam = parseInt(sp.get('offset') ?? '0', 10);
    const limit  = Math.min(Math.max(limitParam, 1), MAX_LIMIT);
    const offset = Math.max(offsetParam, 0);

    try {
        const { data, total } = await localPgGetEntitiesByFilter({ sector, country, limit, offset });

        return NextResponse.json(
            { source: 'aya-local', total, n: data.length, offset, limit, data },
            { headers: CACHE_HEADERS }
        );
    } catch (err) {
        console.error('[aya-local/by-filter] error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
