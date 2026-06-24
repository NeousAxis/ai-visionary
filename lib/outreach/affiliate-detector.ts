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

const KEYWORDS = [
    'affiliate', 'affiliates', 'affiliate program', 'affiliate-program', 'affiliation',
    'referral', 'referrals', 'refer a friend', 'refer-a-friend', 'parrainage',
    'partner program', 'partner-program', 'become a partner', 'devenez partenaire',
    'earn commission', 'commission program', "programme d'affiliation", 'programme d’affiliation',
];

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
    for (const kw of KEYWORDS) {
        if (lower.includes(kw)) hits.add(kw);
    }
    return [...hits];
}

/** Cherche un lien (href/anchor) qui sent l'affiliation, renvoie l'URL absolue si trouvé. */
function findAffiliateLink(html: string, base: string): string | null {
    const re = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
        const href = m[1] || '';
        const anchor = (m[2] || '').replace(/<[^>]+>/g, '');
        const hay = (href + ' ' + anchor).toLowerCase();
        if (KEYWORDS.some((kw) => hay.includes(kw))) {
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

    // 1) Homepage : lien d'affiliation explicite > simple mention de mot-clé.
    const home = await fetchText(origin, timeoutMs);
    if (home.ok) {
        const link = findAffiliateLink(home.text, home.finalUrl);
        if (link) return { has_affiliate: true, affiliate_url: link, signals: ['homepage-link'] };
        const kw = scanForKeywords(home.text);
        if (kw.length) return { has_affiliate: true, affiliate_url: home.finalUrl, signals: ['homepage-text', ...kw.slice(0, 3)] };
    }

    // 2) Sonde quelques chemins classiques.
    for (const path of PROBE_PATHS.slice(0, maxProbes)) {
        const probe = await fetchText(origin + path, timeoutMs);
        if (probe.ok && probe.status === 200) {
            const kw = scanForKeywords(probe.text);
            // page existe ET parle d'affiliation -> signal fort
            if (kw.length) return { has_affiliate: true, affiliate_url: probe.finalUrl, signals: [`path:${path}`, ...kw.slice(0, 2)] };
        }
    }

    return { has_affiliate: false, affiliate_url: null, signals: home.ok ? ['scanned'] : ['home-unreachable'] };
}
