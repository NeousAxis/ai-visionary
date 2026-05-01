import { NextRequest, NextResponse } from 'next/server';
import { isLocalPgConfigured, localPgGetEntities } from '@/lib/db-local-pg';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { trackAyaCall } from '@/lib/aya/api-tracker';

export const dynamic = 'force-dynamic';

const CACHE_HEADERS = {
    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
};

const MAX_LIMIT = 5000;
const DEFAULT_LIMIT = 1000;

export async function GET(req: NextRequest) {
    const rateLimited = checkRateLimit(req, 'aya-local-live', RATE_LIMITS.default);
    if (rateLimited) return rateLimited;
    trackAyaCall(req, 'local-live');

    if (!isLocalPgConfigured()) {
        return NextResponse.json(
            { error: 'VPS Postgres not configured', source: 'aya-local' },
            { status: 503 }
        );
    }

    const limitParam  = parseInt(req.nextUrl.searchParams.get('limit')  ?? String(DEFAULT_LIMIT), 10);
    const offsetParam = parseInt(req.nextUrl.searchParams.get('offset') ?? '0', 10);
    const search      = req.nextUrl.searchParams.get('search') ?? undefined;
    const sort        = (req.nextUrl.searchParams.get('sort') ?? 'default') as
        'default' | 'alpha' | 'score' | 'country' | 'certified';

    const limit  = Math.min(Math.max(limitParam, 1), MAX_LIMIT);
    const offset = Math.max(offsetParam, 0);

    try {
        const { data, total } = await localPgGetEntities({ limit, offset, search, sort });

        return NextResponse.json(
            { source: 'aya-local', total, n: data.length, offset, limit, data },
            { headers: CACHE_HEADERS }
        );
    } catch (err) {
        console.error('[aya-local/live] error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
