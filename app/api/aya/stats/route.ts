import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { trackAyaCall } from '@/lib/aya/api-tracker';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const rateLimited = checkRateLimit(req, 'aya-stats', RATE_LIMITS.default);
    if (rateLimited) return rateLimited;
    trackAyaCall(req, 'stats');

    try {
        const allEntities = await db.getAyaEntities();

        const scores = allEntities.map((e: any) => e.asr_score ?? 0);
        const certified = allEntities.filter((e: any) => e.payment_completed);

        // Sector breakdown
        const sectors: Record<string, number> = {};
        for (const e of allEntities) {
            const s = e.sector_macro || 'Unknown';
            sectors[s] = (sectors[s] || 0) + 1;
        }

        // Country breakdown
        const countries: Record<string, number> = {};
        for (const e of allEntities) {
            const c = e.country_legal || 'XX';
            countries[c] = (countries[c] || 0) + 1;
        }

        // Sort breakdowns by count DESC
        const sortedSectors = Object.entries(sectors)
            .sort((a, b) => b[1] - a[1])
            .map(([name, count]) => ({ sector: name, count }));

        const sortedCountries = Object.entries(countries)
            .sort((a, b) => b[1] - a[1])
            .map(([code, count]) => ({ country: code, count }));

        return NextResponse.json({
            total_entities: allEntities.length,
            certified_count: certified.length,
            indexed_count: allEntities.length - certified.length,
            scores: {
                average: scores.length ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0,
                min: scores.length ? Math.min(...scores) : 0,
                max: scores.length ? Math.max(...scores) : 0,
                median: scores.length ? scores.sort((a: number, b: number) => a - b)[Math.floor(scores.length / 2)] : 0,
            },
            sectors: sortedSectors,
            countries: sortedCountries,
            last_updated: new Date().toISOString(),
        }, {
            headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=60' }
        });
    } catch (err) {
        console.error('AYA stats error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
