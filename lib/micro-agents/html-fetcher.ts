import { AYOBOT_UA } from './constants';

// lib/micro-agents/html-fetcher.ts — Universal HTML fetcher
// Returns distinct sources: rawHtml, renderedHtml, textContent, sourceType
// SSR: rawHtml = renderedHtml, textContent derived from it
// SPA or anti-bot wall: rendered locally with headless Chromium.
//
// Every fetch and every render happens on this machine. No remote rendering service is
// used, so the URL a visitor submits never reaches a third party. That is a hard
// constraint, not an optimisation: it is what lets us state that user data stays here.

import { isAllowedUrl } from '../validators';
import type { FetchResult, SourceType } from './types';

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

/**
 * Render a page with headless Chromium (Puppeteer).
 * Returns null when the render produced an error page or a bot challenge rather than
 * the site itself, so callers never mistake an interstitial for real content.
 */
async function renderWithBrowser(url: string): Promise<string | null> {
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
      return html;
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
    return { ...EMPTY_RESULT, url };
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

    if (!res.ok) {
      // Anti-bot wall. A plain fetch carries no browser fingerprint, so a 403 here does
      // not mean the page is unreachable: local Chromium presents a real engine and
      // often gets through. Rendering stays on our own machine, so no third party ever
      // sees the URL a visitor submitted.
      console.warn(`[html-fetcher] Direct fetch blocked: status=${res.status} for ${url}, attempting local browser render`);
      const blockedHtml = await renderWithBrowser(url);
      if (blockedHtml && hasUsefulContent(blockedHtml)) {
        const textContent = getTextContent(blockedHtml);
        console.log(`[html-fetcher] Local render bypassed the block for ${url}: ${blockedHtml.length} chars, ${textContent.length} text`);
        return { url, rawHtml, renderedHtml: blockedHtml, textContent, sourceType: 'spa_puppeteer' as const, headers, statusCode: res.status, isReachable: true };
      }
      console.warn(`[html-fetcher] Local render could not bypass the block for ${url}`);
      return { url, rawHtml, renderedHtml: rawHtml, textContent: '', sourceType: 'ssr', headers, statusCode: res.status, isReachable: false };
    }

    // Step 2: SSR site — rawHtml IS the rendered HTML
    if (!isSpaShell(rawHtml)) {
      const textContent = getTextContent(rawHtml);
      console.log(`[html-fetcher] SSR site: ${url} (${rawHtml.length} chars, ${textContent.length} text chars)`);
      return { url, rawHtml, renderedHtml: rawHtml, textContent, sourceType: 'ssr', headers, statusCode: res.status, isReachable: true };
    }

    // Step 3: SPA detected — need rendering
    console.log(`[html-fetcher] SPA detected for ${url}`);

    // Try Puppeteer first (best quality — full real DOM)
    const puppeteerHtml = await renderWithBrowser(url);
    if (puppeteerHtml && getTextContent(puppeteerHtml).length > MIN_TEXT) {
      const textContent = getTextContent(puppeteerHtml);
      console.log(`[html-fetcher] Puppeteer: ${puppeteerHtml.length} chars, ${textContent.length} text for ${url}`);
      return { url, rawHtml, renderedHtml: puppeteerHtml, textContent, sourceType: 'spa_puppeteer', headers, statusCode: res.status, isReachable: true };
    }

    // Local rendering failed. There is deliberately no remote renderer behind this:
    // shipping the visitor's URL to a third party is the one thing this pipeline must
    // not do. We degrade to the raw shell and say so, rather than leaking the scan.
    console.warn(`[html-fetcher] Local render failed for SPA ${url}, falling back to the raw shell (degraded)`);
    const renderedHtml = rawHtml;
    const textContent = getTextContent(rawHtml);

    return { url, rawHtml, renderedHtml, textContent, sourceType: 'spa_degraded', headers, statusCode: res.status, isReachable: true };
  } catch {
    return { ...EMPTY_RESULT, url };
  }
}
