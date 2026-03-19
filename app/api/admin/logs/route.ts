import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
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
        const { getFirestore } = require('firebase-admin/firestore');
        const firestore = getFirestore();

        let query: FirebaseFirestore.Query = firestore.collection('system_logs')
            .orderBy('created_at', 'desc')
            .limit(limit);

        if (correlationId) {
            query = query.where('correlation_id', '==', correlationId);
        }
        if (level) {
            query = query.where('level', '==', level);
        }
        if (source) {
            query = query.where('source', '==', source);
        }

        const snapshot = await query.get();
        const logs = snapshot.docs.map(doc => doc.data());

        return NextResponse.json({ logs, count: logs.length });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('[ADMIN_LOGS] Query error:', message);
        return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
    }
}
