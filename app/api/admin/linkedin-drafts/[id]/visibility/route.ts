/**
 * GET /api/admin/linkedin-drafts/[id]/visibility?provider=gemini|chatgpt&secret=...
 *
 * Lance une verification de visibilite manuelle pour un draft (pour aider Cyril
 * a confirmer qu'une entite n'est pas citee par un LLM avant publication).
 *
 * Auth : ADMIN_SECRET. Ne fonctionne que sur le VPS.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { isLocalPgConfigured, linkedinListPosts } from '@/lib/db-local-pg';
import { checkVisibility, checkVisibilityChatGPT } from '@/lib/linkedin/visibility-checker';
import { getKnownEntityMeta } from '@/lib/linkedin/known-entities';

const COUNTRY_NAMES: Record<string, string> = {
    CH: 'Switzerland', FR: 'France', DE: 'Germany', GB: 'the UK', UK: 'the UK',
    IT: 'Italy', ES: 'Spain', NL: 'the Netherlands', BE: 'Belgium', AT: 'Austria',
    PL: 'Poland', SE: 'Sweden', DK: 'Denmark', US: 'the US', CA: 'Canada',
};

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    const auth = requireAdmin(req);
    if (!auth.authorized) return auth.response!;

    if (!isLocalPgConfigured()) {
        return NextResponse.json({ error: 'Postgres VPS non configure' }, { status: 503 });
    }

    const { id } = await ctx.params;
    const url = new URL(req.url);
    const provider = (url.searchParams.get('provider') || 'gemini').toLowerCase();

    // Recharge le draft
    const { rows } = await linkedinListPosts({ limit: 200, offset: 0 });
    const post = rows.find((r) => r.id === id);
    if (!post) return NextResponse.json({ error: 'Draft introuvable' }, { status: 404 });

    // Recupere les metadonnees enrichies (sector_en, country) depuis KNOWN_DOMAINS_META
    const meta = getKnownEntityMeta(post.entity_domain);
    const sectorPhrase = meta?.sector_en || 'company';
    const country = meta?.country ? COUNTRY_NAMES[meta.country.toUpperCase()] : undefined;

    let result;
    if (provider === 'chatgpt' || provider === 'openai') {
        result = await checkVisibilityChatGPT({
            entityName: post.entity_name,
            sectorPhrase,
            country,
        });
    } else {
        result = await checkVisibility({
            entityName: post.entity_name,
            sectorPhrase,
            country,
        });
    }

    return NextResponse.json({
        provider: provider === 'chatgpt' || provider === 'openai' ? 'chatgpt' : 'gemini',
        entity_name: post.entity_name,
        query: `List the 5 best-known ${sectorPhrase}${country ? ' in ' + country : ''}`,
        ...result,
    });
}
