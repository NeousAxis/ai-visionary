import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { supabase } from '@/lib/db';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    // Rate limit admin endpoints
    const rateLimited = checkRateLimit(req, 'admin-logs', RATE_LIMITS.debug);
    if (rateLimited) return rateLimited;

    const auth = requireAdmin(req);
    if (!auth.authorized) return auth.response!;

    const url = new URL(req.url);
    const level = url.searchParams.get('level');         // info, warn, error, critical
    const source = url.searchParams.get('source');       // chat, webhook, scanner...
    const correlationId = url.searchParams.get('cid');   // specific session
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);

    try {
        let query = supabase
            .from('system_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (correlationId) {
            query = query.eq('correlation_id', correlationId);
        }
        if (level) {
            query = query.eq('level', level);
        }
        if (source) {
            query = query.eq('source', source);
        }

        const { data: logs, error } = await query;

        if (error) {
            console.error('[ADMIN_LOGS] Query error:', error.message);
            return NextResponse.json({ error: 'Erreur interne', details: error.message }, { status: 500 });
        }

        return NextResponse.json({ logs: logs || [], count: (logs || []).length });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('[ADMIN_LOGS] Query error:', message);
        return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
    }
}
