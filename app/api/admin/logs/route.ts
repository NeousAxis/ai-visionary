import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getApps } from 'firebase-admin/app';
import '@/lib/db'; // Trigger Firebase Admin initialization

export const dynamic = 'force-dynamic';

function getDb() {
    if (!getApps().length) return null;
    try { return getFirestore(); } catch { return null; }
}

export async function GET(req: NextRequest) {
    const auth = requireAdmin(req);
    if (!auth.authorized) return auth.response!;

    const db = getDb();
    if (!db) {
        return NextResponse.json({ error: 'Firestore non disponible' }, { status: 503 });
    }

    const url = new URL(req.url);
    const level = url.searchParams.get('level');         // info, warn, error, critical
    const source = url.searchParams.get('source');       // chat, webhook, scanner...
    const correlationId = url.searchParams.get('cid');   // specific session
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);
    const collection = url.searchParams.get('collection') || 'system_logs';

    try {
        let query: FirebaseFirestore.Query = db.collection(collection);

        if (correlationId) {
            query = query.where('correlation_id', '==', correlationId);
        }
        if (level) {
            query = query.where('level', '==', level);
        }
        if (source) {
            query = query.where('source', '==', source);
        }

        query = query.orderBy('timestamp', 'desc').limit(limit);

        const snapshot = await query.get();
        const logs = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));

        return NextResponse.json({ logs, count: logs.length });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('[ADMIN_LOGS] Query error:', message);

        // If it's a Firestore index error, return helpful message
        if (message.includes('index')) {
            return NextResponse.json({
                error: 'Index Firestore manquant. Utilisez moins de filtres ou créez l\'index.',
                details: message,
                logs: [],
                count: 0
            }, { status: 200 });
        }

        return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
    }
}
