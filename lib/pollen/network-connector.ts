/**
 * lib/pollen/network-connector.ts
 *
 * Connecteur RÉSEAUX D'AFFILIATION → cashback Pollen.
 *
 * Les marques connues (Amazon, Nike, Booking, AliExpress, SaaS/crypto connus…) ne
 * signent jamais un deal direct avec une startup : on y accède en tant qu'ÉDITEUR sur
 * un réseau d'affiliation (Awin, Impact.com, Amazon Associates…). C'est exactement
 * comme ça que tous les sites de cashback (Rakuten, TopCashback, Igraal) ont Amazon & co.
 *
 * Ce module récupère les programmes/marchands REJOINTS sur un réseau et les mappe vers
 * un format normalisé, prêt à devenir des cashback_offers (que les agents voient dans AYA).
 *
 * Clés requises (env, VPS uniquement) :
 *   AWIN_API_TOKEN, AWIN_PUBLISHER_ID
 *   IMPACT_ACCOUNT_SID, IMPACT_AUTH_TOKEN
 *
 * NB : le mapping des champs suit la doc publique d'Awin/Impact ; à confirmer au premier
 * appel réel (mode dry_run prévu côté admin) une fois le compte éditeur validé.
 */

export type AffiliateNetwork = 'awin' | 'impact';

export interface NormalizedMerchant {
    network: AffiliateNetwork;
    external_id: string;        // id programme/campagne côté réseau
    name: string;               // nom de la marque
    domain: string | null;      // domaine bare du marchand
    commission_label: string | null; // ex. "up to 8%" (brut réseau, pour les notes)
    currency: string | null;
    category: string | null;
    region: string | null;
}

const TIMEOUT_MS = 15000;

function bareDomain(url?: string | null): string | null {
    if (!url) return null;
    try {
        const u = new URL(url.startsWith('http') ? url : `https://${url}`);
        return u.hostname.replace(/^www\./, '').toLowerCase();
    } catch {
        const m = String(url).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
        return m && m.includes('.') ? m : null;
    }
}

async function getJson(url: string, headers: Record<string, string>): Promise<any> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(url, { headers: { Accept: 'application/json', ...headers }, signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } finally {
        clearTimeout(t);
    }
}

// ── Awin : programmes rejoints ───────────────────────────────────────────────
export function isAwinConfigured(): boolean {
    return !!(process.env.AWIN_API_TOKEN && process.env.AWIN_PUBLISHER_ID);
}

export async function fetchAwinJoinedProgrammes(): Promise<NormalizedMerchant[]> {
    if (!isAwinConfigured()) return [];
    const pub = process.env.AWIN_PUBLISHER_ID;
    const url = `https://api.awin.com/publishers/${pub}/programmes?relationship=joined`;
    const data = await getJson(url, { Authorization: `Bearer ${process.env.AWIN_API_TOKEN}` });
    const arr: any[] = Array.isArray(data) ? data : (data?.programmes ?? []);
    return arr.map((p) => ({
        network: 'awin' as const,
        external_id: String(p.id ?? p.programmeId ?? ''),
        name: String(p.name ?? p.programmeName ?? '').trim(),
        domain: bareDomain(p.displayUrl ?? p.clickThroughUrl ?? p.primaryDomain),
        commission_label: Array.isArray(p.commissionRange) && p.commissionRange.length
            ? `${p.commissionRange[0]?.min ?? ''}-${p.commissionRange[0]?.max ?? ''}${p.commissionRange[0]?.type === 'percentage' ? '%' : ''}`
            : (p.commission ?? null),
        currency: p.currencyCode ?? null,
        category: p.primarySector ?? p.sector ?? null,
        region: p.primaryRegion?.name ?? p.primaryRegion?.countryCode ?? null,
    })).filter((m) => m.name && m.domain);
}

// ── Impact.com : campagnes rejointes ─────────────────────────────────────────
export function isImpactConfigured(): boolean {
    return !!(process.env.IMPACT_ACCOUNT_SID && process.env.IMPACT_AUTH_TOKEN);
}

export async function fetchImpactCampaigns(): Promise<NormalizedMerchant[]> {
    if (!isImpactConfigured()) return [];
    const sid = process.env.IMPACT_ACCOUNT_SID!;
    const auth = Buffer.from(`${sid}:${process.env.IMPACT_AUTH_TOKEN}`).toString('base64');
    const url = `https://api.impact.com/Mediapartners/${sid}/Campaigns?PageSize=200`;
    const data = await getJson(url, { Authorization: `Basic ${auth}` });
    const arr: any[] = data?.Campaigns ?? data?.campaigns ?? [];
    return arr.map((c) => ({
        network: 'impact' as const,
        external_id: String(c.CampaignId ?? c.Id ?? ''),
        name: String(c.CampaignName ?? c.AdvertiserName ?? '').trim(),
        domain: bareDomain(c.CampaignUrl ?? c.AdvertiserUrl ?? c.TrackingLink),
        commission_label: c.DefaultPayout ?? c.ContractStatus ?? null,
        currency: c.Currency ?? null,
        category: c.Category ?? null,
        region: c.Country ?? null,
    })).filter((m) => m.name && m.domain);
}

export async function fetchNetworkMerchants(network: AffiliateNetwork): Promise<NormalizedMerchant[]> {
    if (network === 'awin') return fetchAwinJoinedProgrammes();
    if (network === 'impact') return fetchImpactCampaigns();
    return [];
}

export function networkConfigStatus(): { awin: boolean; impact: boolean } {
    return { awin: isAwinConfigured(), impact: isImpactConfigured() };
}
