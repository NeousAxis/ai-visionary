import { AYOBOT_UA } from './constants';

// lib/micro-agents/html-fetcher.ts — Universal HTML fetcher
// Returns distinct sources: rawHtml, renderedHtml, textContent, sourceType
// SSR: rawHtml = renderedHtml, textContent derived from it
// SPA: two parallel Jina calls — markdown (textContent) + HTML with footer (renderedHtml)

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

/**
 * Render a page with headless Chromium (Puppeteer).
 */
async function renderWithBrowser(url: string): Promise<string | null> {
  try {
    const chromium = await import('@sparticuz/chromium');
    const puppeteer = await import('puppeteer-core');

    const execPath = await chromium.default.executablePath();
    const browser = await puppeteer.default.launch({
      args: chromium.default.args,
      defaultViewport: { width: 1280, height: 800 },
      executablePath: execPath,
      headless: true,
    });

    try {
      const page = await browser.newPage();
      await page.setUserAgent(AYOBOT_UA);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 12000 });

      await page.evaluate(() => {
        return new Promise<void>((resolve) => {
          window.scrollTo(0, document.body.scrollHeight);
          setTimeout(resolve, 1000);
        });
      });

      return await page.content();
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error('[html-fetcher] Browser render failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Jina HTML: returns real rendered HTML with footer.
 * Used for: renderedHtml (DOM structure, links, footer/nav).
 */
async function fetchJinaHtml(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        'X-Return-Format': 'html',
        'X-Wait-For-Selector': 'footer',
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn(`[html-fetcher] Jina HTML failed: status=${res.status} for ${url}`);
      return null;
    }
    const html = await res.text();
    if (!html || !hasUsefulContent(html)) {
      console.warn(`[html-fetcher] Jina HTML: empty or SPA shell (${html?.length || 0} chars) for ${url}`);
      return null;
    }
    console.log(`[html-fetcher] Jina HTML OK: ${html.length} chars for ${url}`);
    return html;
  } catch (err) {
    console.warn(`[html-fetcher] Jina HTML error: ${err instanceof Error ? err.message : err} for ${url}`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Jina Markdown: returns clean structured text (headings, lists, links).
 * Used for: textContent (LLM agents need clean text, not raw HTML).
 */
async function fetchJinaMarkdown(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn(`[html-fetcher] Jina MD failed: status=${res.status} for ${url}`);
      return null;
    }
    const md = await res.text();
    if (!md || md.length < MIN_TEXT) {
      console.warn(`[html-fetcher] Jina MD: too short (${md?.length || 0} chars) for ${url}`);
      return null;
    }
    console.log(`[html-fetcher] Jina MD OK: ${md.length} chars for ${url}`);
    return md;
  } catch (err) {
    console.warn(`[html-fetcher] Jina MD error: ${err instanceof Error ? err.message : err} for ${url}`);
    return null;
  } finally {
    clearTimeout(timeout);
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
      // Anti-bot / Cloudflare wall — try Jina before giving up
      console.warn(`[html-fetcher] Direct fetch blocked: status=${res.status} for ${url} — attempting Jina fallback`);
      const [jinaHtml, jinaMarkdown] = await Promise.all([
        fetchJinaHtml(url),
        fetchJinaMarkdown(url),
      ]);
      if (jinaHtml || jinaMarkdown) {
        const renderedHtml = jinaHtml || '';
        const textContent = jinaMarkdown || getTextContent(renderedHtml);
        console.log(`[html-fetcher] Jina fallback succeeded for blocked site ${url}`);
        return { url, rawHtml, renderedHtml, textContent, sourceType: 'spa_jina' as const, headers, statusCode: res.status, isReachable: true };
      }
      // Both direct and Jina failed
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

    // Fallback: TWO parallel Jina calls
    // - HTML with footer → renderedHtml (DOM structure for link/footer extraction)
    // - Markdown → textContent (clean structured text for LLM agents)
    console.log(`[html-fetcher] Puppeteer failed, launching parallel Jina calls for ${url}`);
    const [jinaHtml, jinaMarkdown] = await Promise.all([
      fetchJinaHtml(url),
      fetchJinaMarkdown(url),
    ]);

    console.log(`[html-fetcher] Jina results for ${url}: html=${jinaHtml ? `OK(${jinaHtml.length})` : 'FAILED'}, md=${jinaMarkdown ? `OK(${jinaMarkdown.length})` : 'FAILED'}`);

    // renderedHtml: prefer Jina HTML (has DOM with footer/links), fallback to raw
    const renderedHtml = jinaHtml || rawHtml;
    // textContent: prefer Jina markdown (clean structured), fallback to stripping HTML
    const textContent = jinaMarkdown || getTextContent(renderedHtml);

    if (!jinaHtml && !jinaMarkdown) {
      console.warn(`[html-fetcher] BOTH Jina calls failed for SPA ${url} — using raw SPA shell (degraded)`);
    } else if (!jinaHtml) {
      console.warn(`[html-fetcher] Jina HTML failed for ${url} — renderedHtml=rawSpaShell, pedagogy/legal will be degraded`);
    }

    return { url, rawHtml, renderedHtml, textContent, sourceType: 'spa_jina', headers, statusCode: res.status, isReachable: true };
  } catch {
    return { ...EMPTY_RESULT, url };
  }
}
