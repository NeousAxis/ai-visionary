import { NextRequest, NextResponse } from 'next/server';
import { askRegistry } from '@/lib/aya/ask/search';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { trackAyaCall } from '@/lib/aya/api-tracker';
import { allow, realIp } from '@/lib/aya/guard';

export const dynamic = 'force-dynamic';

/**
 * GET /api/aya/ask?q=<phrase en langage courant>&limit=10
 *
 * Recherche d'entreprises par une phrase ("des repas faits maison livrés au
 * bureau à Lausanne"). Renvoie les critères compris, les fiches classées avec,
 * pour chaque critère, la phrase de la fiche qui le prouve, et la position des
 * entreprises dont la ville est connue.
 */
export async function GET(req: NextRequest) {
    const rateLimited = checkRateLimit(req, 'aya-ask', RATE_LIMITS.chat);
    if (rateLimited) return rateLimited;
    // Limite sur l'IP réelle (chaque recherche coûte un appel au modèle et un
    // parcours du registre) : 15 par minute et 300 par jour.
    const ip = realIp(req);
    if (!allow(`ask:m:${ip}`, 15, 60_000) || !allow(`ask:d:${ip}`, 300, 86_400_000)) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }
    trackAyaCall(req, 'search');

    const q = (req.nextUrl.searchParams.get('q') || '').trim().slice(0, 300);
    if (q.length < 2) {
        return NextResponse.json({ error: 'Missing required parameter: q' }, { status: 400 });
    }
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '10', 10) || 10;

    try {
        const lang = req.nextUrl.searchParams.get('lang') === 'en' ? 'en' : 'fr';
        const data = await askRegistry(q, { limit, lang });
        return NextResponse.json(data, {
            headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=60' },
        });
    } catch (err) {
        console.error('[aya/ask] error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
