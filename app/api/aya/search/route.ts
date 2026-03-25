import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const rateLimited = checkRateLimit(req, 'aya-search', RATE_LIMITS.default);
    if (rateLimited) return rateLimited;

    const q = req.nextUrl.searchParams.get('q')?.trim();
    const limitParam = parseInt(req.nextUrl.searchParams.get('limit') || '50');
    const limit = Math.min(Math.max(limitParam, 1), 200);

    if (!q || q.length < 1) {
        return NextResponse.json({ error: 'Missing required parameter: q' }, { status: 400 });
    }

    try {
        const allEntities = await db.getAyaEntities();
        const qLower = q.toLowerCase();
        // Split query into individual words for multi-word matching
        const stopWords = new Set(['le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'en', 'à', 'a', 'au', 'aux', 'dans', 'pour', 'sur', 'par', 'avec', 'the', 'of', 'in', 'and', 'for', 'on', 'at', 'to', 'is', 'an']);
        const words = qLower.split(/\s+/).filter(w => w.length >= 2 && !stopWords.has(w));

        // Score each entity by relevance (how many words match)
        const scored = allEntities
            .map((e: any) => {
                const basicText = [
                    e.display_name, e.legal_name, e.website,
                    e.sector_macro, e.country_legal, e.contact_email
                ].filter(Boolean).join(' ').toLowerCase();

                let payloadText = '';
                if (e.asr_payload) {
                    payloadText = typeof e.asr_payload === 'string'
                        ? e.asr_payload.toLowerCase()
                        : JSON.stringify(e.asr_payload).toLowerCase();
                }

                const fullText = basicText + ' ' + payloadText;

                // Count how many query words match
                const matchCount = words.filter(word => fullText.includes(word)).length;
                // Bonus for certified entities
                const certBonus = e.payment_completed ? 0.5 : 0;

                return { entity: e, matchCount, score: matchCount + certBonus };
            })
            .filter(item => item.matchCount > 0) // At least 1 word must match
            .sort((a, b) => b.score - a.score) // Best matches first
            .slice(0, limit)
            .map(item => item.entity);

        const results = scored.map((e: any) => ({
            name: e.display_name || e.legal_name || '',
            country: e.country_legal || '',
            sector: e.sector_macro || '',
            score: e.asr_score ?? 0,
            certified: e.payment_completed === true,
            url: `https://ai-visionary.com/aya/e/${e.entity_id || ''}`,
        }));

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
