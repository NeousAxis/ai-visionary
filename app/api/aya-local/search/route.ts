import { NextRequest, NextResponse } from 'next/server';
import { isLocalPgConfigured, localPgSearch } from '@/lib/db-local-pg';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { trackAyaCall } from '@/lib/aya/api-tracker';

export const dynamic = 'force-dynamic';

const CACHE_HEADERS = {
    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
};

export async function GET(req: NextRequest) {
    const rateLimited = checkRateLimit(req, 'aya-local-search', RATE_LIMITS.default);
    if (rateLimited) return rateLimited;
    trackAyaCall(req, 'local-search');

    if (!isLocalPgConfigured()) {
        return NextResponse.json(
            { error: 'VPS Postgres not configured', source: 'aya-local' },
            { status: 503 }
        );
    }

    const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
    const limitParam = parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10);
    const limit = Math.min(Math.max(limitParam, 1), 200);

    if (!q) {
        return NextResponse.json({ error: 'Missing required parameter: q' }, { status: 400 });
    }

    try {
        const entities = await localPgSearch(q, limit);

        const results = entities.map((e) => ({
            entity_id: e.entity_id,
            name:      e.display_name ?? e.legal_name ?? '',
            domain:    e.website
                ? e.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]
                : '',
            country:   e.country_legal ?? '',
            sector:    e.sector_macro  ?? '',
            score:     e.asr_score     ?? 0,
            certified: e.payment_completed === true,
            url:       `https://ai-visionary.xyz/aya/e/${e.entity_id}`,
        }));

        return NextResponse.json(
            { q, n: results.length, source: 'aya-local', results },
            { headers: CACHE_HEADERS }
        );
    } catch (err) {
        console.error('[aya-local/search] error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
