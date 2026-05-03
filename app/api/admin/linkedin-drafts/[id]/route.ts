/**
 * PATCH /api/admin/linkedin-drafts/[id]?secret=...
 * Body : { action: 'approve' | 'reject' | 'publish_now' | 'mark_published', linkedin_post_url?: string }
 *
 * - approve        : status = 'approved' (entre en queue cron auto-publish)
 * - unapprove      : status = 'draft' (retire de la queue)
 * - reject         : status = 'skipped'
 * - publish_now    : utilise Playwright pour publier immediatement, status = 'published' ou 'failed'
 * - mark_published : marque manuellement comme publie (copy-paste manuel), status = 'published', published_at = NOW()
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
        // Status='approved' → entre en queue pour publication automatique par le cron
        // /api/cron/linkedin-publish-approved (3x/jour : 9h, 13h, 18h CET)
        const ok = await linkedinUpdatePostStatus(id, 'approved');
        return NextResponse.json({
            success: ok,
            status: 'approved',
            message: 'Approuve, sera publie automatiquement au prochain cron auto-publish',
        });
    }

    if (action === 'unapprove') {
        // Retour en draft (Cyril veut le re-tester ou changer d'avis)
        const ok = await linkedinUpdatePostStatus(id, 'draft');
        return NextResponse.json({ success: ok, status: 'draft' });
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

    if (action === 'mark_published') {
        // Publication manuelle (copy-paste) : marque le post comme publie sans Playwright
        const linkedinPostUrl = (body as any).linkedin_post_url ?? null;
        const ok = await linkedinUpdatePostStatus(id, 'published', {
            ...(linkedinPostUrl ? { linkedin_post_url: linkedinPostUrl } : {}),
        });
        return NextResponse.json({ ok, status: 'published' });
    }

    return NextResponse.json({ error: 'action invalide (approve | unapprove | reject | publish_now | mark_published)' }, { status: 400 });
}
