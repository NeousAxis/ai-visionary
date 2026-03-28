import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { buildLlmSummary } from '@/lib/aya/llm-format';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ domain: string }> }) {
    const rateLimited = checkRateLimit(req, 'aya-llm', RATE_LIMITS.default);
    if (rateLimited) return rateLimited;

    const { domain } = await params;
    if (!domain || domain.length < 3) {
        return NextResponse.json({ error: 'Missing or invalid domain parameter' }, { status: 400 });
    }

    try {
        // Efficient O(1) lookup via website_normalized column
        let entity = await db.getAyaEntityByUrl(`https://${domain}`);
        if (!entity) {
            entity = await db.getAyaEntityByUrl(`https://www.${domain}`);
        }

        if (!entity) {
            return NextResponse.json({ error: 'Entity not found', domain }, { status: 404 });
        }

        const langParam = req.nextUrl.searchParams.get('lang');
        const lang: 'fr' | 'en' = langParam === 'fr' ? 'fr' : 'en';
        const summary = buildLlmSummary(entity, lang);

        return NextResponse.json(summary, {
            headers: {
                'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
            },
        });
    } catch (err) {
        console.error('AYA LLM endpoint error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
