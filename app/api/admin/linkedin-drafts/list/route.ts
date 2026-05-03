/**
 * GET /api/admin/linkedin-drafts/list?secret=...&status=draft&limit=50&offset=0
 *
 * Liste paginee des linkedin_posts depuis Postgres VPS.
 * Auth : ADMIN_SECRET via query param ou Authorization header.
 * Ne fonctionne que sur le VPS (Postgres VPS local).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { isLocalPgConfigured, linkedinListPosts } from '@/lib/db-local-pg';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const auth = requireAdmin(req);
    if (!auth.authorized) return auth.response!;

    if (!isLocalPgConfigured()) {
        return NextResponse.json(
            { error: 'Postgres VPS non configure. Cette page n\'est consultable que depuis le VPS.' },
            { status: 503 }
        );
    }

    const url = new URL(req.url);
    const status = url.searchParams.get('status') || undefined;
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    const { rows, total } = await linkedinListPosts({ limit, offset, statusFilter: status });
    return NextResponse.json({ total, count: rows.length, drafts: rows });
}
