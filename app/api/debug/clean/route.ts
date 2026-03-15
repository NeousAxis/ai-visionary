import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { createLogger, generateCorrelationId } from '@/lib/logger';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
    // Rate limit debug endpoints
    const rateLimited = checkRateLimit(req, 'debug-clean', RATE_LIMITS.debug);
    if (rateLimited) return rateLimited;

    const logger = createLogger(generateCorrelationId(), 'admin');

    // Require ADMIN_SECRET instead of hardcoded password
    const auth = requireAdmin(req);
    if (!auth.authorized) {
        logger.warn('AUTH_FAILED', 'Unauthorized clean attempt');
        return auth.response!;
    }

    try {
        const url = new URL(req.url);
        const targetUrl = url.searchParams.get('url');

        if (!targetUrl) {
            return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
        }

        logger.info('CLEAN_START', `Cleaning records for: ${targetUrl}`);

        const dbInstance = (db as any).getDb?.() || null;
        if (!dbInstance) {
            return NextResponse.json({ error: 'DB not available' }, { status: 503 });
        }

        // Dynamic URL search (not hardcoded to a single domain)
        const normalizedUrl = targetUrl.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
        const variants = [
            `https://${normalizedUrl}`,
            `https://www.${normalizedUrl}`,
            `http://${normalizedUrl}`,
            targetUrl,
        ];

        let deleted = 0;

        for (const variant of variants) {
            // @ts-expect-error — Firestore dynamic access
            const dbAccess = db.database ? db.database : db;
            const getDb = dbAccess.getDb || (() => dbInstance);
            const firestore = getDb() || dbInstance;

            const docs = await firestore.collection('aya_registry').where('website', '==', variant).get();
            for (const doc of docs.docs) {
                await doc.ref.delete();
                deleted++;
            }
        }

        logger.info('CLEAN_DONE', `Deleted ${deleted} records for ${targetUrl}`);
        return NextResponse.json({ success: true, deleted });

    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('CLEAN_ERROR', message);
        return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
    }
}
