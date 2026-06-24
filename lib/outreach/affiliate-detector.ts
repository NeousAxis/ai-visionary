/**
 * lib/outreach/affiliate-detector.ts
 *
 * Détecte si une entreprise a déjà un PROGRAMME D'AFFILIATION / REFERRAL.
 * Ce sont les meilleures cibles cashback : elles acceptent déjà le modèle CPA.
 *
 * Méthode (bornée, ~0 CHF) : fetch la home + sonde quelques chemins classiques,
 * cherche des liens/textes contenant des mots-clés d'affiliation (FR/EN). Tout est
 * en lecture seule, timeouts courts, nombre de requêtes plafonné par domaine.
 */

// Mots-clés EXIGÉS DANS LE CHEMIN d'une URL (haute précision : un vrai programme a
// une page dédiée /affiliates, /referral-scheme, /programme-daffiliation…).
// On EXCLUT volontairement "referral"/"commission" en query string (utm_*=referral
// = tracking, pas un programme) et les simples mentions dans le corps de la home.
const PATH_KEYWORDS = [
    'affiliate', 'affiliates', 'affiliation', 'affilie', 'affilié',
    'referral', 'referral-scheme', 'referral-program', 'refer-a-friend',
    'parrainage', 'partenaire', 'programme-affiliation', 'programme-daffiliation', "programme-d-affiliation",
    'partner-program', 'partnerprogram', 'partner-programme',
];
// Anchor text fort (mot rare hors contexte affiliation).
const TEXT_RE = /affiliat|parrain|referral program|programme d.?affiliation/i;
// Mots-clés de corps de page (pour CONFIRMER une page /affiliates qui répond 200).
const BODY_KEYWORDS = ['affiliate', 'affiliation', 'referral', 'parrainage', 'commission'];

const PROBE_PATHS = [
    '/affiliates', '/affiliate', '/affiliate-program', '/partners', '/partner-program',
    '/referral', '/parrainage', '/affiliation', '/partenaires',
];

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

export interface AffiliateResult {
    has_affiliate: boolean;
    affiliate_url: string | null;
    signals: string[];
    error?: string;
}

async function fetchText(url: string, timeoutMs: number): Promise<{ ok: boolean; status: number; text: string; finalUrl: string }> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const res = await fetch(url, {
            method: 'GET',
            redirect: 'follow',
            signal: ctrl.signal,
            headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
        });
        const text = res.ok ? (await res.text()).slice(0, 200_000) : '';
        return { ok: res.ok, status: res.status, text, finalUrl: res.url || url };
    } catch (err) {
        return { ok: false, status: 0, text: '', finalUrl: url };
    } finally {
        clearTimeout(t);
    }
}

function scanForKeywords(html: string): string[] {
    const lower = html.toLowerCase();
    const hits = new Set<string>();
    for (const kw of BODY_KEYWORDS) {
        if (lower.includes(kw)) hits.add(kw);
    }
    return [...hits];
}

/**
 * Cherche un lien dont le CHEMIN (pas la query) sent l'affiliation, ou dont le texte
 * d'ancre matche un mot fort. Ignore les liens utm_*=referral (tracking, pas un programme).
 */
function findAffiliateLink(html: string, base: string): string | null {
    const re = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
        const href = m[1] || '';
        const anchor = (m[2] || '').replace(/<[^>]+>/g, ' ').trim();
        let path = '';
        try { path = new URL(href, base).pathname.toLowerCase(); } catch { path = href.toLowerCase().split('?')[0]; }
        const pathHit = PATH_KEYWORDS.some((kw) => path.includes(kw));
        const textHit = TEXT_RE.test(anchor);
        if (pathHit || textHit) {
            try { return new URL(href, base).toString(); } catch { return href; }
        }
    }
    return null;
}

/**
 * Détecte un programme d'affiliation pour un domaine (bare ou URL).
 * Requêtes plafonnées : home + jusqu'à `maxProbes` chemins.
 */
export async function detectAffiliateProgram(domain: string, opts: { timeoutMs?: number; maxProbes?: number } = {}): Promise<AffiliateResult> {
    const timeoutMs = opts.timeoutMs ?? 7000;
    const maxProbes = opts.maxProbes ?? 4;

    const bare = domain.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    if (!bare || !bare.includes('.')) return { has_affiliate: false, affiliate_url: null, signals: [], error: 'invalid_domain' };
    const origin = `https://${bare}`;

    // 1) Homepage : un lien dont le CHEMIN pointe une page programme (haute précision).
    const home = await fetchText(origin, timeoutMs);
    if (home.ok) {
        const link = findAffiliateLink(home.text, home.finalUrl);
        if (link) return { has_affiliate: true, affiliate_url: link, signals: ['homepage-link'] };
    }

    // 2) Sonde des chemins classiques, avec anti soft-404 : l'URL finale doit GARDER
    //    un segment d'affiliation (sinon = redirect vers la home = page inexistante).
    for (const path of PROBE_PATHS.slice(0, maxProbes)) {
        const probe = await fetchText(origin + path, timeoutMs);
        if (!probe.ok || probe.status !== 200) continue;
        let finalPath = '';
        try { finalPath = new URL(probe.finalUrl).pathname.toLowerCase(); } catch { finalPath = ''; }
        const pathStillAffiliate = PATH_KEYWORDS.some((kw) => finalPath.includes(kw));
        if (pathStillAffiliate && scanForKeywords(probe.text).length) {
            return { has_affiliate: true, affiliate_url: probe.finalUrl, signals: [`path:${path}`] };
        }
    }

    return { has_affiliate: false, affiliate_url: null, signals: home.ok ? ['scanned'] : ['home-unreachable'] };
}
