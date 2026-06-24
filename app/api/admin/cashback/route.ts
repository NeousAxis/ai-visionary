import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import {
    localPgUpsertCashbackOffer,
    localPgListCashbackOffers,
    localPgSetCashbackOfferStatus,
    localPgListCashbackClaims,
    localPgGetClaimWithOffer,
    localPgUpdateCashbackClaim,
    localPgGetEntityByDomain,
} from '@/lib/db-local-pg';
import { resolveCashbackAmount } from '@/lib/pollen-cashback';

// Admin cashback Pollen — gestion des deals (offres) + validation manuelle des claims.
// Auth : ?secret=ADMIN_SECRET ou Authorization: Bearer.
export const maxDuration = 30;

// ── GET : lister offres + claims ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
    const auth = requireAdmin(req);
    if (!auth.authorized) return auth.response!;

    const url = new URL(req.url);
    const status = url.searchParams.get('status') || undefined;
    const offers = await localPgListCashbackOffers(200);
    const claims = await localPgListCashbackClaims({ status, limit: 200 });
    return NextResponse.json({ offers, claims: claims.rows, claims_total: claims.total });
}

// ── POST : creer / mettre a jour une offre (un deal) ─────────────────────────
export async function POST(req: NextRequest) {
    const auth = requireAdmin(req);
    if (!auth.authorized) return auth.response!;

    let body: any = {};
    try { body = await req.json(); } catch { /* */ }

    const entityDomain = (body.entity_domain ?? '').toString().trim();
    if (!entityDomain) {
        return NextResponse.json({ error: 'missing_entity_domain' }, { status: 400 });
    }
    const cashbackValue = Number(body.cashback_value);
    if (!Number.isFinite(cashbackValue) || cashbackValue <= 0) {
        return NextResponse.json({ error: 'invalid_cashback_value' }, { status: 400 });
    }
    const cashbackType = body.cashback_type === 'percent' ? 'percent' : 'flat';

    // Lien souple vers aya_registry : on resout l'entity_id depuis le domaine si absent.
    let entityId: string | null = body.entity_id ?? null;
    if (!entityId) {
        const entity = await localPgGetEntityByDomain(entityDomain);
        entityId = entity?.entity_id ?? null;
    }

    const id = await localPgUpsertCashbackOffer({
        entityId,
        entityDomain,
        serviceName: body.service_name ?? null,
        cashbackType,
        cashbackValue,
        currency: body.currency ?? 'CHF',
        cpaTotal: body.cpa_total != null ? Number(body.cpa_total) : null,
        honeyValue: body.honey_value != null ? Number(body.honey_value) : null,
        vertical: body.vertical ?? null,
        notes: body.notes ?? null,
    });

    if (!id) {
        return NextResponse.json({ error: 'offer_write_failed' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, offer_id: id, entity_id: entityId });
}

// ── PATCH : valider / payer / rejeter un claim, ou changer le status d'une offre ─
export async function PATCH(req: NextRequest) {
    const auth = requireAdmin(req);
    if (!auth.authorized) return auth.response!;

    let body: any = {};
    try { body = await req.json(); } catch { /* */ }

    // Changer le status d'une offre
    if (body.offer_id && body.offer_status) {
        const ok = await localPgSetCashbackOfferStatus(
            String(body.offer_id),
            String(body.offer_status),
        );
        return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
    }

    const claimId = (body.claim_id ?? '').toString();
    const action = (body.action ?? '').toString(); // validate | pay | reject
    if (!claimId || !['validate', 'pay', 'reject'].includes(action)) {
        return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    }

    const claim = await localPgGetClaimWithOffer(claimId);
    if (!claim) return NextResponse.json({ error: 'claim_not_found' }, { status: 404 });

    if (action === 'reject') {
        const ok = await localPgUpdateCashbackClaim(claimId, {
            status: 'rejected',
            reviewNotes: body.notes ?? null,
        });
        return NextResponse.json({ ok, status: 'rejected' });
    }

    if (action === 'validate') {
        // Resout le montant de cashback depuis l'offre (flat ou percent * tx_amount).
        const txAmount = body.tx_amount != null ? Number(body.tx_amount) : null;
        const amount = resolveCashbackAmount(
            {
                cashback_type: claim.offer_cashback_type ?? 'flat',
                cashback_value: claim.offer_cashback_value ?? 0,
                cpa_total: null,
                honey_value: claim.offer_honey_value ?? null,
            },
            txAmount,
        );
        if (amount == null) {
            return NextResponse.json(
                { error: 'tx_amount_required_for_percent' },
                { status: 400 },
            );
        }
        const ok = await localPgUpdateCashbackClaim(claimId, {
            status: 'validated',
            amountCashback: amount,
            amountHoney: claim.offer_honey_value ?? null,
            validatedAt: new Date(),
            reviewNotes: body.notes ?? null,
        });
        return NextResponse.json({ ok, status: 'validated', amount_cashback: amount });
    }

    // action === 'pay'
    const ok = await localPgUpdateCashbackClaim(claimId, {
        status: 'paid',
        paidAt: new Date(),
    });
    return NextResponse.json({ ok, status: 'paid' });
}
