import { AYOBOT_UA, MIN_VISIBLE_TEXT } from './constants';

// lib/micro-agents/html-fetcher.ts — Universal HTML fetcher
// Returns distinct sources: rawHtml, renderedHtml, textContent, sourceType
// SSR: rawHtml = renderedHtml, textContent derived from it
// SPA or anti-bot wall: rendered locally with headless Chromium.
//
// Every fetch and every render happens on this machine. No remote rendering service is
// used, so the URL a visitor submits never reaches a third party. That is a hard
// constraint, not an optimisation: it is what lets us state that user data stays here.

import { isAllowedUrl } from '../validators';
import type { FetchResult, UnreadableReason } from './types';

const MIN_TEXT = 300;

const SPA_INDICATORS = [
  /<div\s+id=["'](?:root|app|__next|__nuxt|__app)["']\s*>\s*<\/div>/i,
  /<div\s+id=["'](?:root|app)["']\s*><\/div>/i,
  /type=["']module["']\s+src=["']\/(?:assets|static|js|_next)\//i,
  /<script[^>]*src=["'][^"']*(?:chunk|bundle|main|app)\.[a-f0-9]+\.js/i,
];

export function getTextContent(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if HTML contains useful rendered content (not an empty SPA shell).
 * A valid rendered page should have headings, paragraphs, links with text, or meaningful text.
 */
function hasUsefulContent(html: string): boolean {
  const text = getTextContent(html);
  if (text.length < MIN_TEXT) return false;
  // Must have at least some real DOM structure (headings, paragraphs, links with text)
  const hasStructure =
    /<h[1-6][^>]*>[^<]{3,}/i.test(html) ||
    /<p[^>]*>[^<]{20,}/i.test(html) ||
    /<a\s[^>]*href=[^>]*>[^<]{2,}/i.test(html);
  return hasStructure;
}

function isSpaShell(html: string): boolean {
  const text = getTextContent(html);
  return text.length < MIN_TEXT && SPA_INDICATORS.some(re => re.test(html));
}

// @sparticuz/chromium ships Lambda-tuned defaults: renderer sandbox off, same-origin
// policy off, site isolation off, everything in one process. That is a fair trade in a
// throwaway Lambda container. Here the same browser opens URLs submitted by anyone
// through the public diagnostic, on the VPS that also hosts the registry, so a scanned
// page must not be able to reach out of the browser.
//
// isAllowedUrl() already blocks localhost, private ranges and metadata endpoints, but it
// only validates the URL we navigate TO. With --disable-web-security, the loaded page's
// own JavaScript can then fetch 127.0.0.1 and read the response, which the same-origin
// policy would normally forbid. Restoring the browser defaults closes that.
// Always dropped: these are what let a scanned page reach out of the browser.
const UNSAFE_ARGS = new Set([
  '--disable-web-security',
  '--disable-site-isolation-trials',
  '--allow-running-insecure-content',
]);

// Dropped only when the host can actually run the process sandbox. Ubuntu 24.04 ships
// kernel.apparmor_restrict_unprivileged_userns=1, which blocks Chrome's unprivileged
// user-namespace sandbox, and @sparticuz/chromium bundles no SUID helper, so Chrome
// dies at startup with "No usable sandbox!" if these are removed (verified on the VPS).
// Set AYO_BROWSER_SANDBOX=1 once the host allows it, and the renderer gets sandboxed too.
const PROCESS_SANDBOX_ARGS = new Set([
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--single-process', // a single process has no separate renderer to sandbox
  '--no-zygote', // the zygote is what sandboxed renderers are forked from
]);

// IsolateOrigins and site-per-process ARE site isolation; the rest of the list stays.
const UNSAFE_DISABLED_FEATURES = new Set(['IsolateOrigins', 'site-per-process']);

export function hardenBrowserArgs(args: string[]): string[] {
  const withProcessSandbox = process.env.AYO_BROWSER_SANDBOX === '1';
  const hardened = args
    .filter((arg) => !UNSAFE_ARGS.has(arg))
    .filter((arg) => !(withProcessSandbox && PROCESS_SANDBOX_ARGS.has(arg)))
    .map((arg) => {
      if (!arg.startsWith('--disable-features=')) return arg;
      const kept = arg
        .slice('--disable-features='.length)
        .split(',')
        .map((f) => f.trim())
        .filter((f) => f && !UNSAFE_DISABLED_FEATURES.has(f));
      return kept.length ? `--disable-features=${kept.join(',')}` : '';
    })
    .filter(Boolean);

  // Chrome refuses to start sandboxed as uid 0. pm2 runs the app as `ubuntu`, so this
  // never triggers in prod; it keeps a root container working instead of failing every
  // scan, and says so out loud rather than doing it silently.
  if (withProcessSandbox && typeof process.getuid === 'function' && process.getuid() === 0) {
    console.warn('[html-fetcher] running as root: Chromium process sandbox disabled');
    hardened.push('--no-sandbox');
  }
  return hardened;
}

// An anti-bot interstitial renders like any other page and reads like a real one:
// deindeal.ch and iherb.com both hand headless Chromium ~18k characters of "Performing
// security verification" under HTTP 403. That sails past every content check below, so
// without this guard a Cloudflare challenge would be scanned as if it were the company's
// own website, and the entity would be scored on it.
const CHALLENGE_MARKERS = [
  /just a moment/i,
  /performing security verification/i,
  /checking your browser before accessing/i,
  /enable javascript and cookies to continue/i,
  /verifying you are human/i,
  /attention required!\s*\|\s*cloudflare/i,
  /pardon our interruption/i,
  /request unsuccessful\D{0,20}incapsula/i,
];

function isChallengePage(html: string): boolean {
  const head = getTextContent(html).slice(0, 600);
  return CHALLENGE_MARKERS.some((re) => re.test(head));
}

// --- Porte de lisibilite ---------------------------------------------------------------
//
// Un site qu'AYO n'a pas reellement lu ne recoit aucun score : AYO n'invente rien. Jusqu'au
// 14.10.2026, toute reponse 2xx passait pour lisible. Une page de parking, une page nginx
// par defaut ou une coquille JavaScript jamais rendue etaient notees 3 a 6/100 sur le seul
// nom de domaine, affichees au visiteur puis inscrites au registre AYA (AYO-SCAN). Meme
// logique que classify_homepage dans aya/page_check.py, qui a corrige ce defaut cote bot.

/** Les pages de parking, murs anti-bot et pages par defaut sont courtes. */
const SHORT_PAGE = 1500;
/** Page quasi vide : quelques mots suffisent alors a reconnaitre un refus. */
const TINY_PAGE = 300;

const PARKING_HOSTS = [
  'sedoparking.com', 'sedo.com', 'dan.com', 'afternic.com', 'hugedomains.com',
  'bodis.com', 'parkingcrew.net', 'above.com', 'undeveloped.com', 'domainmarket.com',
  'buydomains.com', 'parklogic.com', 'domainlore.com', 'efty.com', 'squadhelp.com',
  'atom.com', 'brandbucket.com', 'epik.com', 'uni.domains', 'spaceship.com',
  'expireddomains.com',
];
const PARKING_RE = /domain (?:name )?(?:is|may be) for sale|this domain (?:is|has been) (?:parked|registered)|buy this domain|domain parking|parked (?:free|domain|by)|make an offer on this domain|this domain name is available|domain for sale|hugedomains|sedoparking|parkingcrew|is for sale!?\s*$|inquire about this domain/i;
/** GoDaddy et consorts servent en 200 une page vide dont le seul script file vers /lander. */
const LANDER_RE = /location(?:\.href)?\s*=\s*["']\/lander/i;
// Murs anti-bot reconnaissables dans le HTML brut, meme servis en 200. Le script
// /cdn-cgi/challenge-platform/ n'y figure pas : Cloudflare l'injecte aussi dans des pages
// normales, il ferait refuser de petits sites parfaitement lisibles.
const CHALLENGE_HTML_RE = /_cf_chl_opt|cf-browser-verification|sgcaptcha|incapsula incident|ddos-guard/i;
const CHALLENGE_TEXT_RE = /just a moment|attention required|checking (?:if the site connection is secure|your browser)|enable javascript and cookies to continue|performing security verification|verify(?:ing)? (?:that )?you are (?:a )?human|are you a (?:human|robot)|bot verification|pardon our interruption|request unsuccessful|incapsula incident|ddos-guard|(?:your|the) request is being verified|one moment,? please\.{0,3}\s*loader/i;
/**
 * Trop courants pour etre testes ailleurs que sur une page quasi vide. \bcaptcha\b laisse
 * passer le "protected by reCAPTCHA" (ou hCaptcha) d'un simple formulaire de contact.
 */
const CHALLENGE_TINY_RE = /access denied|\bcaptcha\b|forbidden/i;
/** Page par defaut d'un serveur, compte suspendu, site en construction : rien sur l'entreprise. */
const PLACEHOLDER_RE = /welcome to nginx|apache2? [\w ]{0,20}default page|^\s*index of \/|account (?:has been )?suspended|this (?:account|site|website) (?:has been|is) suspended|default (?:web )?(?:site|server) page|future home of|(?:site|website|page|we are|we're)\s+(?:is\s+)?(?:coming soon|under construction)|under construction|launching soon|site (?:web )?en (?:cours de )?construction|(?:site|website) bient[oô]t en ligne|(?:site|website) (?:is )?(?:offline|down for maintenance)|(?:site|website) will be back soon|under maintenance|maintenance mode|site (?:web )?en maintenance/i;
/** Page qui ne s'affiche qu'avec JavaScript. */
const JS_REQUIRED_RE = /(?:enable|activate|turn on) javascript|javascript (?:is )?(?:required|disabled|must be enabled)|requires javascript|activ(?:ez|er) (?:le )?javascript|javascript aktivieren/i;
/** Deuxiemes niveaux generiques (exemple.co.uk, exemple.com.au), pour retrouver le nom du site. */
const GENERIC_SLD = new Set(['co', 'com', 'org', 'net', 'ac', 'gov', 'edu', 'ltd', 'plc', 'gob', 'nom', 'or', 'ne']);

interface Verdict { reason: UnreadableReason; detail: string }

/** Texte visible : titre compris, scripts, styles, noscript et template exclus. */
function visibleText(html: string): string {
  return getTextContent(html.replace(/<(noscript|template)\b[\s\S]*?<\/\1>/gi, ' '));
}

function pageTitle(html: string): string {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return m ? m[1].trim() : '';
}

function hostOf(url: string): string {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; }
}

/** exemple.co.uk, www.exemple.ch et shop.exemple.com donnent tous 'exemple'. */
function siteName(host: string): string {
  const labels = host.toLowerCase().split('.').filter((l) => l && l !== 'www');
  const n = labels.length;
  if (n >= 3 && GENERIC_SLD.has(labels[n - 2]) && labels[n - 1].length === 2) return labels[n - 3];
  return n >= 2 ? labels[n - 2] : (labels[0] || '');
}

/**
 * Vrai si la page d'arrivee appartient encore a l'entreprise : meme domaine, sous-domaine,
 * ou meme nom sous une autre extension (exemple.ch vers exemple.com). Les tirets ne
 * comptent pas : tecease.com vers tec-ease.com reste le meme site.
 */
export function sameSite(requestedHost: string, finalHost: string): boolean {
  const a = requestedHost.toLowerCase().replace(/^www\./, '');
  const b = finalHost.toLowerCase().replace(/^www\./, '');
  if (!a || !b || a === b || a.endsWith('.' + b) || b.endsWith('.' + a)) return true;
  return siteName(a).replace(/-/g, '') === siteName(b).replace(/-/g, '');
}

/** Ou la lecture a atterri : un parking ou le site d'un autre ne disent rien de l'entreprise. */
function checkLanding(requestedUrl: string, finalUrl: string): Verdict | null {
  const asked = hostOf(requestedUrl);
  const host = hostOf(finalUrl);
  if (!asked || !host || asked === host) return null;
  // Parking reconnu seulement apres redirection : sedo.com scanne directement reste un vrai site.
  if (PARKING_HOSTS.some((h) => host === h || host.endsWith('.' + h))) return { reason: 'parked', detail: host };
  if (!sameSite(asked, host)) return { reason: 'redirected', detail: host };
  return null;
}

/**
 * Le contenu de cette page dit-il quelque chose de l'entreprise ? null quand elle est
 * lisible, sinon la raison du refus. Exportee pour le HTML televerse par le visiteur.
 */
export function assessPageContent(html: string): Verdict | null {
  if (!html || !html.trim()) return { reason: 'unreachable', detail: 'empty body' };
  if (LANDER_RE.test(html.slice(0, 5000))) return { reason: 'parked', detail: 'lander redirect' };
  const text = visibleText(html);
  if (text.length < SHORT_PAGE) {
    if (CHALLENGE_HTML_RE.test(html.slice(0, 50000))) return { reason: 'blocked', detail: 'challenge page' };
    const title = pageTitle(html);
    const probe = `${title} ${text}`;
    if (PARKING_RE.test(probe)) return { reason: 'parked', detail: 'parking page' };
    if (CHALLENGE_TEXT_RE.test(probe) || (text.length < TINY_PAGE && CHALLENGE_TINY_RE.test(probe))) {
      return { reason: 'blocked', detail: 'challenge page' };
    }
    if (PLACEHOLDER_RE.test(`${title} ${text.slice(0, 400)}`)) return { reason: 'placeholder', detail: 'default or placeholder page' };
    if (text.length < TINY_PAGE && JS_REQUIRED_RE.test(probe)) return { reason: 'no_text', detail: 'javascript required' };
  }
  if (text.length < MIN_VISIBLE_TEXT) return { reason: 'no_text', detail: `${text.length} visible chars` };
  return null;
}

function unreadable(base: Omit<FetchResult, 'textContent' | 'isReachable'>, v: Verdict): FetchResult {
  console.warn(`[html-fetcher] ${base.url} non lisible (${v.reason}: ${v.detail}), aucun score`);
  return { ...base, textContent: '', isReachable: false, unreadableReason: v.reason, unreadableDetail: v.detail };
}

/** Derniere porte, appliquee a toute page rendue que fetchHtml s'apprete a declarer lue. */
function gate(r: FetchResult, requestedUrl: string): FetchResult {
  const v = checkLanding(requestedUrl, r.finalUrl || requestedUrl) || assessPageContent(r.renderedHtml);
  return v ? unreadable(r, v) : r;
}

/**
 * Render a page with headless Chromium (Puppeteer).
 * Returns null when the render produced an error page or a bot challenge rather than
 * the site itself, so callers never mistake an interstitial for real content.
 * finalUrl is where the page ended up after HTTP and JavaScript redirects.
 */
async function renderWithBrowser(url: string): Promise<{ html: string; finalUrl: string } | null> {
  try {
    const chromium = await import('@sparticuz/chromium');
    const puppeteer = await import('puppeteer-core');

    const execPath = await chromium.default.executablePath();
    const browser = await puppeteer.default.launch({
      args: hardenBrowserArgs(chromium.default.args),
      defaultViewport: { width: 1280, height: 800 },
      executablePath: execPath,
      headless: true,
    });

    try {
      const page = await browser.newPage();
      await page.setUserAgent(AYOBOT_UA);
      const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 12000 });

      await page.evaluate(() => {
        return new Promise<void>((resolve) => {
          window.scrollTo(0, document.body.scrollHeight);
          setTimeout(resolve, 1000);
        });
      });

      const html = await page.content();
      const status = response ? response.status() : 0;

      if (status >= 400) {
        console.warn(`[html-fetcher] Browser render returned status=${status} for ${url}, discarding`);
        return null;
      }
      if (isChallengePage(html)) {
        console.warn(`[html-fetcher] Browser render hit a bot challenge for ${url}, discarding`);
        return null;
      }
      return { html, finalUrl: page.url() || url };
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error('[html-fetcher] Browser render failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

const EMPTY_RESULT: FetchResult = {
  url: '',
  rawHtml: '',
  renderedHtml: '',
  textContent: '',
  sourceType: 'ssr',
  headers: {},
  statusCode: 0,
  isReachable: false,
};

export async function fetchHtml(targetUrl: string): Promise<FetchResult> {
  let url = targetUrl.trim();
  if (!url.startsWith('http')) url = 'https://' + url;

  const ssrfCheck = isAllowedUrl(url);
  if (!ssrfCheck.allowed) {
    return { ...EMPTY_RESULT, url, unreadableReason: 'unreachable', unreadableDetail: 'url not allowed' };
  }

  try {
    // Step 1: Fast fetch (raw HTML)
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': AYOBOT_UA },
      redirect: 'follow',
    });
    clearTimeout(tid);

    const rawHtml = await res.text();
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
    // Ou les redirections HTTP ont mene : la page lue n'est plus forcement celle demandee.
    const finalUrl = res.url || url;

    if (!res.ok) {
      // Anti-bot wall. A plain fetch carries no browser fingerprint, so a 403 here does
      // not mean the page is unreachable: local Chromium presents a real engine and
      // often gets through. Rendering stays on our own machine, so no third party ever
      // sees the URL a visitor submitted.
      console.warn(`[html-fetcher] Direct fetch blocked: status=${res.status} for ${url}, attempting local browser render`);
      const rendered = await renderWithBrowser(url);
      if (rendered && hasUsefulContent(rendered.html)) {
        const textContent = getTextContent(rendered.html);
        console.log(`[html-fetcher] Local render bypassed the block for ${url}: ${rendered.html.length} chars, ${textContent.length} text`);
        // rawHtml = la page rendue : le corps 403 est le mur anti-bot, pas le site. Garde,
        // il faisait lire mobile_optimized, les liens legaux et le JSON-LD sur l'interstitiel.
        return gate({ url, rawHtml: rendered.html, renderedHtml: rendered.html, textContent, sourceType: 'spa_puppeteer', headers, statusCode: res.status, isReachable: true, finalUrl: rendered.finalUrl }, url);
      }
      console.warn(`[html-fetcher] Local render could not bypass the block for ${url}`);
      return {
        url, rawHtml, renderedHtml: rawHtml, textContent: '', sourceType: 'ssr', headers, statusCode: res.status, isReachable: false, finalUrl,
        unreadableReason: [401, 403, 429].includes(res.status) ? 'blocked' : 'unreachable',
        unreadableDetail: `http ${res.status}`,
      };
    }

    const base = { url, rawHtml, renderedHtml: rawHtml, sourceType: 'ssr' as const, headers, statusCode: res.status, finalUrl };

    const contentType = (headers['content-type'] || '').toLowerCase();
    if (contentType && !contentType.includes('html') && !contentType.includes('xml')) {
      return unreadable(base, { reason: 'unreachable', detail: `not html (${contentType.split(';')[0]})` });
    }

    // Redirection vers un parking ou vers le site d'un autre : inutile d'aller plus loin.
    const landing = checkLanding(url, finalUrl);
    if (landing) return unreadable(base, landing);

    // Step 2: SSR site — rawHtml IS the rendered HTML
    if (!isSpaShell(rawHtml)) {
      const verdict = assessPageContent(rawHtml);
      if (!verdict) {
        const textContent = getTextContent(rawHtml);
        console.log(`[html-fetcher] SSR site: ${url} (${rawHtml.length} chars, ${textContent.length} text chars)`);
        return { ...base, textContent, isReachable: true };
      }
      // Presque aucun texte sans JavaScript, sans signe de parking ni de mur : le site est
      // peut-etre construit dans le navigateur sans ressembler aux coquilles SPA connues
      // (Flutter, div#root avec une classe...). Un rendu local tranche.
      if (verdict.reason === 'no_text') {
        const rendered = await renderWithBrowser(url);
        if (rendered) {
          const textContent = getTextContent(rendered.html);
          console.log(`[html-fetcher] Near-empty SSR page rendered locally for ${url}: ${rendered.html.length} chars, ${textContent.length} text`);
          return gate({ ...base, renderedHtml: rendered.html, textContent, sourceType: 'spa_puppeteer', isReachable: true, finalUrl: rendered.finalUrl }, url);
        }
      }
      return unreadable(base, verdict);
    }

    // Step 3: SPA detected — need rendering
    console.log(`[html-fetcher] SPA detected for ${url}`);

    // Puppeteer: full real DOM
    const rendered = await renderWithBrowser(url);
    if (rendered) {
      const textContent = getTextContent(rendered.html);
      console.log(`[html-fetcher] Puppeteer: ${rendered.html.length} chars, ${textContent.length} text for ${url}`);
      return gate({ ...base, renderedHtml: rendered.html, textContent, sourceType: 'spa_puppeteer', isReachable: true, finalUrl: rendered.finalUrl }, url);
    }

    // Local rendering failed. There is deliberately no remote renderer behind this:
    // shipping the visitor's URL to a third party is the one thing this pipeline must
    // not do. Une coquille jamais rendue ne dit rien de l'entreprise : jusqu'au 14.10.2026
    // elle etait notee quand meme (spa_degraded), elle est desormais refusee.
    return unreadable({ ...base, sourceType: 'spa_degraded' }, { reason: 'no_text', detail: 'javascript shell, local render failed' });
  } catch (err) {
    return { ...EMPTY_RESULT, url, unreadableReason: 'unreachable', unreadableDetail: err instanceof Error ? err.message : 'network' };
  }
}
