import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { runAgentFarm } from '@/lib/agent-farm/run';
import { localPgAgentFarmStats } from '@/lib/db-local-pg';

// Admin FERME À AGENTS — fait tourner nos propres agents IA sur AYA (bootstrap demande).
// Auth : ?secret=ADMIN_SECRET ou Authorization: Bearer.
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// GET : statistiques de la ferme.
export async function GET(req: NextRequest) {
    const auth = requireAdmin(req);
    if (!auth.authorized) return auth.response!;
    const stats = await localPgAgentFarmStats();
    return NextResponse.json({ ok: true, stats });
}

// POST : lance une fournée d'agents. body { count } (défaut 10, max 50).
export async function POST(req: NextRequest) {
    const auth = requireAdmin(req);
    if (!auth.authorized) return auth.response!;
    let body: any = {};
    try { body = await req.json(); } catch { /* */ }
    const count = body.count != null ? Number(body.count) : 10;
    const summary = await runAgentFarm({ count });
    return NextResponse.json({ ok: true, summary });
}
