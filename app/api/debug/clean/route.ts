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

        // Use db.getAyaEntityByUrl to find and delete
        const entity = await db.getAyaEntityByUrl(targetUrl);
        let deleted = 0;

        if (entity?.entity_id) {
            // Delete via Firestore using the entity_id as doc ID
            try {
                const { getFirestore } = require('firebase-admin/firestore');
                const firestore = getFirestore();
                await firestore.collection('aya_registry').doc(entity.entity_id).delete();
                deleted = 1;
            } catch (e) {
                console.error('Delete error:', e);
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
