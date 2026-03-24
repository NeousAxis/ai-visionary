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

        const results = allEntities
            .filter((e: any) => {
                // Search in basic fields
                const basicMatch = (
                    (e.display_name && e.display_name.toLowerCase().includes(qLower)) ||
                    (e.legal_name && e.legal_name.toLowerCase().includes(qLower)) ||
                    (e.website && e.website.toLowerCase().includes(qLower)) ||
                    (e.sector_macro && e.sector_macro.toLowerCase().includes(qLower)) ||
                    (e.country_legal && e.country_legal.toLowerCase().includes(qLower)) ||
                    (e.contact_email && e.contact_email.toLowerCase().includes(qLower))
                );
                if (basicMatch) return true;

                // Deep search in ASR payload (description, services, keywords)
                if (e.asr_payload) {
                    const payloadStr = typeof e.asr_payload === 'string'
                        ? e.asr_payload.toLowerCase()
                        : JSON.stringify(e.asr_payload).toLowerCase();
                    return payloadStr.includes(qLower);
                }
                return false;
            })
            .slice(0, limit)
            .map((e: any) => ({
                name: e.display_name || e.legal_name || '',
                domain: e.website?.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] || '',
                website: e.website || '',
                country: e.country_legal || '',
                sector: e.sector_macro || '',
                aio_score: e.asr_score ?? 0,
                asr_status: e.payment_completed ? 'ASR_CERTIFIED' : 'ASR_DERIVED',
                entity_type: e.entity_type || 'company',
                entity_id: e.entity_id || '',
                certificate_url: `https://ai-visionary.com/aya/e/${e.entity_id || ''}`,
            }));

        return NextResponse.json({
            query: q,
            count: results.length,
            results,
        });
    } catch (err) {
        console.error('AYA search error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
