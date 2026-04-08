import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { forceFlush } from '@/lib/aya/api-tracker';

/**
 * GET /api/aya/analytics?days=7&secret=...
 *
 * Returns aggregated API call analytics.
 * Protected by ADMIN_SECRET.
 */
export async function GET(req: NextRequest) {
    const auth = requireAdmin(req);
    if (!auth.authorized) return auth.response!;

    const days = Math.min(parseInt(req.nextUrl.searchParams.get('days') || '7'), 90);

    try {
        // Flush any buffered data first
        await forceFlush();

        const rows = await db.getAyaAnalytics(days);

        // Aggregate by endpoint
        const byEndpoint: Record<string, number> = {};
        const byCallerType: Record<string, number> = {};
        const byDay: Record<string, { calls: number; endpoints: Record<string, number>; callers: Record<string, number> }> = {};
        const topDomains: Record<string, number> = {};
        const sampleUAs = new Set<string>();
        let totalCalls = 0;

        for (const row of rows) {
            const count = row.call_count || 1;
            totalCalls += count;

            byEndpoint[row.endpoint] = (byEndpoint[row.endpoint] || 0) + count;
            byCallerType[row.caller_type] = (byCallerType[row.caller_type] || 0) + count;

            // Daily aggregation
            const day = row.recorded_at?.slice(0, 10) || 'unknown';
            if (!byDay[day]) byDay[day] = { calls: 0, endpoints: {}, callers: {} };
            byDay[day].calls += count;
            byDay[day].endpoints[row.endpoint] = (byDay[day].endpoints[row.endpoint] || 0) + count;
            byDay[day].callers[row.caller_type] = (byDay[day].callers[row.caller_type] || 0) + count;

            if (row.domain) topDomains[row.domain] = (topDomains[row.domain] || 0) + count;
            if (row.sample_ua && sampleUAs.size < 20) sampleUAs.add(row.sample_ua);
        }

        // Sort daily desc
        const daily = Object.entries(byDay)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([date, data]) => ({ date, ...data }));

        // Sort top domains desc
        const sortedDomains = Object.entries(topDomains)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 20)
            .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});

        return NextResponse.json({
            period: {
                days,
                from: new Date(Date.now() - days * 86400000).toISOString().slice(0, 10),
                to: new Date().toISOString().slice(0, 10),
            },
            totals: {
                total_calls: totalCalls,
                by_endpoint: byEndpoint,
                by_caller_type: byCallerType,
            },
            daily,
            top_domains_queried: sortedDomains,
            sample_user_agents: [...sampleUAs],
        });
    } catch (err) {
        return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
    }
}
