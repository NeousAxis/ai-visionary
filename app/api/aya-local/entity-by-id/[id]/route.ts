import { NextRequest, NextResponse } from 'next/server';
import { isLocalPgConfigured, localPgGetEntityById } from '@/lib/db-local-pg';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { trackAyaCall } from '@/lib/aya/api-tracker';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const rateLimited = checkRateLimit(req, 'aya-local-entity-by-id', RATE_LIMITS.default);
    if (rateLimited) return rateLimited;
    trackAyaCall(req, 'local-entity-by-id');

    if (!isLocalPgConfigured()) {
        return NextResponse.json({ error: 'VPS Postgres not configured', source: 'aya-local' }, { status: 503 });
    }

    const { id } = await params;
    if (!id || id.length < 4) {
        return NextResponse.json({ error: 'Invalid id', source: 'aya-local' }, { status: 400 });
    }

    const entity = await localPgGetEntityById(id);
    if (!entity) {
        return NextResponse.json({ error: 'Entity not found', id, source: 'aya-local' }, { status: 404 });
    }

    return NextResponse.json({ source: 'aya-local', entity }, {
        headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' }
    });
}
