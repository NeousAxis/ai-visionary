import { NextRequest, NextResponse } from 'next/server';
import { getAyaEntityByUrlAggregated } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { trackAyaCall } from '@/lib/aya/api-tracker';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ domain: string }> }) {
    const rateLimited = checkRateLimit(req, 'aya-entity', RATE_LIMITS.default);
    if (rateLimited) return rateLimited;

    const { domain } = await params;
    trackAyaCall(req, 'entity', domain);
    if (!domain || domain.length < 3) {
        return NextResponse.json({ error: 'Missing or invalid domain parameter' }, { status: 400 });
    }

    try {
        // Aggregated lookup: Supabase first, then VPS. Tries both www/non-www internally.
        const entity = await getAyaEntityByUrlAggregated(`https://${domain}`);

        if (!entity) {
            return NextResponse.json({ error: 'Entity not found', domain }, { status: 404 });
        }

        const asr = entity.asr_payload || {};

        return NextResponse.json({
            entity: {
                name: entity.display_name || entity.legal_name || '',
                legal_name: entity.legal_name || '',
                domain: domain,
                website: entity.website || '',
                country: entity.country_legal || '',
                sector: entity.sector_macro || '',
                entity_type: entity.entity_type || 'company',
                contact_email: entity.contact_email || '',
                entity_id: entity.entity_id || '',
                certificate_url: `https://ai-visionary.xyz/aya/e/${entity.entity_id || ''}`,
            },
            scoring: {
                aio_score: entity.asr_score ?? 0,
                asr_status: entity.payment_completed ? 'ASR_CERTIFIED' : 'ASR_DERIVED',
                data_origin: entity.data_origin || '',
            },
            asr_derived: asr,
            recommendability: entity.recommendability || {},
        }, {
            headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=300' }
        });
    } catch (err) {
        console.error('AYA entity error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
