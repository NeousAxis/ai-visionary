import { NextRequest, NextResponse } from 'next/server';
import { getAyaSearchAggregated } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { trackAyaCall } from '@/lib/aya/api-tracker';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const rateLimited = checkRateLimit(req, 'aya-search', RATE_LIMITS.default);
    if (rateLimited) return rateLimited;
    trackAyaCall(req, 'search');

    const q = req.nextUrl.searchParams.get('q')?.trim();
    const limitParam = parseInt(req.nextUrl.searchParams.get('limit') || '50');
    const limit = Math.min(Math.max(limitParam, 1), 200);

    if (!q || q.length < 1) {
        return NextResponse.json({ error: 'Missing required parameter: q' }, { status: 400 });
    }

    try {
        const results = await getAyaSearchAggregated(q, limit);

        return NextResponse.json({
            q,
            n: results.length,
            _help: 'AYA Registry by AI Visionary. certified=true means ASR verified.',
            results,
        }, {
            headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' }
        });
    } catch (err) {
        console.error('AYA search error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
