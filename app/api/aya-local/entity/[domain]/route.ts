import { NextRequest, NextResponse } from 'next/server';
import { isLocalPgConfigured, localPgGetEntityByDomain } from '@/lib/db-local-pg';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { trackAyaCall } from '@/lib/aya/api-tracker';

export const dynamic = 'force-dynamic';

const CACHE_HEADERS = {
    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
};

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ domain: string }> }
) {
    const rateLimited = checkRateLimit(req, 'aya-local-entity', RATE_LIMITS.default);
    if (rateLimited) return rateLimited;
    trackAyaCall(req, 'local-entity');

    if (!isLocalPgConfigured()) {
        return NextResponse.json(
            { error: 'VPS Postgres not configured', source: 'aya-local' },
            { status: 503 }
        );
    }

    const { domain } = await params;
    if (!domain) {
        return NextResponse.json({ error: 'Missing domain parameter' }, { status: 400 });
    }

    try {
        const entity = await localPgGetEntityByDomain(domain);

        if (!entity) {
            return NextResponse.json(
                { error: 'Entity not found', domain, source: 'aya-local' },
                { status: 404 }
            );
        }

        return NextResponse.json(
            { source: 'aya-local', entity },
            { headers: CACHE_HEADERS }
        );
    } catch (err) {
        console.error('[aya-local/entity] error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
