import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { db, supabase, _clearAyaCaches } from '@/lib/db';
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

        // Normalize URL and build variants for matching
        const normalizedUrl = db.normalizeUrl(targetUrl);
        const variants = [
            `https://${normalizedUrl}`,
            `https://www.${normalizedUrl}`,
            `http://${normalizedUrl}`,
            targetUrl,
        ];

        let deleted = 0;

        for (const variant of variants) {
            const { data, error } = await supabase
                .from('aya_registry')
                .delete()
                .eq('website', variant)
                .select('entity_id');

            if (!error && data) {
                deleted += data.length;
            }
        }

        if (deleted > 0) _clearAyaCaches();
        logger.info('CLEAN_DONE', `Deleted ${deleted} records for ${targetUrl}`);
        return NextResponse.json({ success: true, deleted });

    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('CLEAN_ERROR', message);
        return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
    }
}
