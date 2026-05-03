/**
 * POST /api/cron/linkedin-publish-approved
 *
 * Cron auto-publish : prend le plus ancien post avec status='approved' dans
 * la queue, le publie via Playwright, met a jour le status (published / failed).
 *
 * Si la queue est vide → no-op (rien a publier).
 *
 * Auth : Bearer CRON_SECRET (timing-safe).
 * Cron Linux attendu : 0 9,13,18 * * * curl -X POST -H "Authorization: Bearer X"
 *                      http://localhost:3000/api/cron/linkedin-publish-approved
 *
 * Decision Cyril (2 mai 2026) : Cyril approuve les drafts en lot via la page
 * admin → ce cron consomme la queue tout seul, 3x/jour, pas besoin de Cyril.
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import {
    isLocalPgConfigured,
    linkedinGetOldestApproved,
    linkedinUpdatePostStatus,
} from '@/lib/db-local-pg';
import { publishToLinkedIn, teardown } from '@/lib/linkedin/playwright-poster';
import { createLogger, generateCorrelationId } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function authIsValid(authHeader: string): boolean {
    const secret = process.env.CRON_SECRET;
    if (!secret) return false;
    const expected = `Bearer ${secret}`;
    const a = Buffer.from(authHeader);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    try {
        return timingSafeEqual(a, b);
    } catch {
        return false;
    }
}

export async function POST(req: NextRequest) {
    const logger = createLogger(generateCorrelationId(), 'cron');

    // Auto-publish disabled: LinkedIn anti-bot blocks Playwright sessions.
    // Use the "Copier le texte" button in admin and paste manually.
    return NextResponse.json(
        {
            error: 'Auto-publish disabled',
            reason: 'LinkedIn anti-bot blocks Playwright sessions. Use the "Copier le texte" button in admin and paste manually.',
        },
        { status: 410 }
    );

    if (!authIsValid(req.headers.get('authorization') || '')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isLocalPgConfigured()) {
        return NextResponse.json(
            { error: 'This endpoint requires VPS Postgres (run on VPS only)' },
            { status: 503 }
        );
    }

    try {
        const postOrNull = await linkedinGetOldestApproved();
        if (!postOrNull) {
            logger.info('CRON_AUTOPUB_EMPTY', 'Queue approved vide — rien a publier');
            return NextResponse.json({ skipped: true, reason: 'queue_empty' });
        }
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const post = postOrNull!;

        logger.info(
            'CRON_AUTOPUB_PICK',
            `Publishing approved post: ${post.entity_name} (${post.entity_domain}, id=${post.id})`
        );

        const result = await publishToLinkedIn(post.post_text);
        // Liberer Playwright apres usage (le watcher persistent n'est pas
        // encore implemente, on lance/eteint a chaque fois)
        await teardown().catch(() => {});

        if (result.success) {
            await linkedinUpdatePostStatus(post.id, 'published', {
                linkedin_post_url: result.postUrl,
            });
            logger.info('CRON_AUTOPUB_OK', `Published: ${result.postUrl}`);
            return NextResponse.json({
                success: true,
                status: 'published',
                entity_name: post.entity_name,
                entity_domain: post.entity_domain,
                linkedin_post_url: result.postUrl,
            });
        } else {
            await linkedinUpdatePostStatus(post.id, 'failed', {
                error_message: result.error,
            });
            logger.warn('CRON_AUTOPUB_FAIL', `Publish failed: ${result.error}`);
            return NextResponse.json(
                {
                    success: false,
                    status: 'failed',
                    entity_name: post.entity_name,
                    error: result.error,
                },
                { status: 500 }
            );
        }
    } catch (e: any) {
        logger.error('CRON_AUTOPUB_ERROR', e?.message || 'Unknown error');
        await teardown().catch(() => {});
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
