import { NextResponse } from 'next/server';
import { localPgGetActiveCashbackOffer } from '@/lib/db-local-pg';
import { signAttributionToken } from '@/lib/pollen-cashback';

// cashback_offer (cf. VISION-POLLEN-AGENTS.md §8bis) :
//   un agent interroge AYA pour une entite → recoit l'offre cashback active
//   + un JETON D'ATTRIBUTION signe (Ed25519). Reponse en ms, servie depuis le
//   registre — aucune ecriture. Le jeton est ensuite presente a claim_cashback
//   apres une transaction reelle.
export const maxDuration = 15;

export async function POST(req: Request) {
    let domain = '';
    let agentId: string | null = null;
    try {
        const body = await req.json();
        domain = (body?.domain ?? body?.entity_domain ?? '').toString().slice(0, 255).trim();
        agentId = body?.agent_id ? String(body.agent_id).slice(0, 128) : null;
    } catch {
        /* malformed body */
    }

    if (!domain) {
        return NextResponse.json({ error: 'missing_domain', offer: null }, { status: 400 });
    }

    const offer = await localPgGetActiveCashbackOffer(domain);
    if (!offer) {
        // Pas d'offre = reponse honnete, pas une erreur.
        return NextResponse.json({ offer: null, token: null });
    }

    let token: string;
    let exp: number;
    try {
        const minted = signAttributionToken({
            offerId: offer.id,
            entityDomain: offer.entity_domain,
            entityId: offer.entity_id,
            agentId,
            nowMs: Date.now(),
        });
        token = minted.token;
        exp = minted.payload.exp;
    } catch (err) {
        console.error('[cashback-offer] sign error:', err);
        return NextResponse.json({ error: 'signing_unavailable', offer: null }, { status: 503 });
    }

    // On n'expose JAMAIS l'economie interne (cpa_total / honey_value).
    return NextResponse.json({
        offer: {
            entity_domain: offer.entity_domain,
            service_name: offer.service_name,
            cashback_type: offer.cashback_type, // flat | percent
            cashback_value: offer.cashback_value,
            currency: offer.currency,
            vertical: offer.vertical,
            // Lien d'affiliation taggé : l'agent route l'achat via ce lien pour que la
            // commission soit attribuee (Amazon ?tag=, Hostinger, Travelpayouts, etc.).
            affiliate_url: offer.affiliate_url ?? null,
        },
        token,
        expires_at: new Date(exp * 1000).toISOString(),
    });
}
