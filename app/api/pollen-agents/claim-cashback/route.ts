import { NextResponse } from 'next/server';
import {
    localPgGetCashbackClaimByJti,
    localPgInsertCashbackClaim,
} from '@/lib/db-local-pg';
import { verifyAttributionToken } from '@/lib/pollen-cashback';

// claim_cashback (cf. VISION-POLLEN-AGENTS.md §8bis) :
//   apres une transaction reelle, l'agent presente le jeton d'attribution + une
//   preuve. AYA verifie la signature + l'expiration, empeche le rejeu (1 jeton =
//   1 claim), puis enregistre le claim en 'claimed'. La VALIDATION est MANUELLE
//   au stade MVP (outcome-only) → aucun paiement automatique, fraude impossible.
export const maxDuration = 15;

export async function POST(req: Request) {
    let token = '';
    let proof: unknown = null;
    let agentId: string | null = null;
    let principalRef: string | null = null;
    try {
        const body = await req.json();
        token = (body?.token ?? '').toString();
        proof = body?.proof ?? null;
        agentId = body?.agent_id ? String(body.agent_id).slice(0, 128) : null;
        principalRef = body?.principal_ref ? String(body.principal_ref).slice(0, 128) : null;
    } catch {
        /* malformed body */
    }

    if (!token) {
        return NextResponse.json({ error: 'missing_token' }, { status: 400 });
    }

    const verdict = verifyAttributionToken(token, Date.now());
    if (!verdict.valid) {
        return NextResponse.json({ error: 'invalid_token', reason: verdict.reason }, { status: 400 });
    }

    const { payload } = verdict;

    // Anti-rejeu : un jeton ne peut etre reclame qu'une fois.
    const existing = await localPgGetCashbackClaimByJti(payload.jti);
    if (existing) {
        return NextResponse.json(
            { error: 'already_claimed', status: existing.status },
            { status: 409 },
        );
    }

    const claimId = await localPgInsertCashbackClaim({
        jti: payload.jti,
        offerId: payload.offer_id,
        entityId: payload.entity_id ?? null,
        entityDomain: payload.entity_domain,
        agentId: agentId ?? payload.agent_id ?? null,
        principalRef,
        proof,
        tokenIssuedAt: new Date(payload.iat * 1000),
        tokenExp: new Date(payload.exp * 1000),
    });

    if (!claimId) {
        // INSERT ... ON CONFLICT DO NOTHING → course possible : un autre claim a
        // gagne entre le SELECT et l'INSERT.
        return NextResponse.json({ error: 'already_claimed' }, { status: 409 });
    }

    return NextResponse.json({
        status: 'claimed',
        claim_id: claimId,
        message:
            'Claim enregistre. Validation manuelle de la transaction en cours (outcome-only). ' +
            'Le cashback sera debloque apres confirmation de l achat reel.',
    });
}
