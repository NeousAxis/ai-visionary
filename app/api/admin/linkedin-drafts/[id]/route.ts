/**
 * PATCH /api/admin/linkedin-drafts/[id]?secret=...
 * Body : { action: 'approve' | 'reject' | 'publish_now' }
 *
 * - approve     : status = 'draft' (no-op, juste pour signaler "OK pour publication")
 * - reject      : status = 'skipped'
 * - publish_now : utilise Playwright pour publier immediatement, status = 'published' ou 'failed'
 *
 * Auth : ADMIN_SECRET. Ne fonctionne que sur le VPS.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { isLocalPgConfigured, linkedinListPosts, linkedinUpdatePostStatus } from '@/lib/db-local-pg';
import { publishToLinkedIn, teardown } from '@/lib/linkedin/playwright-poster';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    const auth = requireAdmin(req);
    if (!auth.authorized) return auth.response!;

    if (!isLocalPgConfigured()) {
        return NextResponse.json({ error: 'Postgres VPS non configure' }, { status: 503 });
    }

    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 });

    let body: { action?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
    }

    const action = body.action;

    if (action === 'reject') {
        const ok = await linkedinUpdatePostStatus(id, 'skipped');
        return NextResponse.json({ success: ok, status: 'skipped' });
    }

    if (action === 'approve') {
        // Pas de changement de status (deja draft), juste un signal logique
        return NextResponse.json({ success: true, status: 'draft', message: 'Approuve, sera publie au prochain cron en mode auto-publish' });
    }

    if (action === 'publish_now') {
        // Recharge le post pour avoir le texte
        const { rows } = await linkedinListPosts({ limit: 200, offset: 0 });
        const post = rows.find((r) => r.id === id);
        if (!post) return NextResponse.json({ error: 'Draft introuvable' }, { status: 404 });
        if (post.status === 'published') {
            return NextResponse.json({ error: 'Deja publie', linkedin_post_url: post.linkedin_post_url }, { status: 409 });
        }

        const result = await publishToLinkedIn(post.post_text);
        await teardown().catch(() => {});

        if (result.success) {
            await linkedinUpdatePostStatus(id, 'published', { linkedin_post_url: result.postUrl });
            return NextResponse.json({ success: true, status: 'published', linkedin_post_url: result.postUrl });
        } else {
            await linkedinUpdatePostStatus(id, 'failed', { error_message: result.error });
            return NextResponse.json({ success: false, status: 'failed', error: result.error }, { status: 500 });
        }
    }

    return NextResponse.json({ error: 'action invalide (approve | reject | publish_now)' }, { status: 400 });
}
