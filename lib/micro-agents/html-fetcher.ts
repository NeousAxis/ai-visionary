// lib/micro-agents/html-fetcher.ts — Universal HTML fetcher
// Returns distinct sources: rawHtml, renderedHtml, textContent, sourceType
// 1. Try simple fetch (fast, works for SSR sites)
// 2. If SPA detected → Puppeteer headless Chromium
// 3. Fallback → Jina HTML with footer wait

import { isAllowedUrl } from '../validators';
import type { FetchResult, SourceType } from './types';

const MIN_TEXT = 300;

const SPA_INDICATORS = [
  /<div\s+id=["'](?:root|app|__next|__nuxt|__app)["']\s*>\s*<\/div>/i,
  /<div\s+id=["'](?:root|app)["']\s*><\/div>/i,
  /type=["']module["']\s+src=["']\/(?:assets|static|js|_next)\//i,
  /<script[^>]*src=["'][^"']*(?:chunk|bundle|main|app)\.[a-f0-9]+\.js/i,
];

function getTextContent(html: string): string {
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

function isSpaShell(html: string): boolean {
  const text = getTextContent(html);
  return text.length < MIN_TEXT && SPA_INDICATORS.some(re => re.test(html));
}

/**
 * Render a page with headless Chromium (Puppeteer).
 * Uses @sparticuz/chromium for Vercel/AWS Lambda compatibility.
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
      await page.setUserAgent('AYO-Bot/2.0 (AI Visionary Scanner)');

      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 12000,
      });

      // Scroll to bottom to trigger lazy loading (footer)
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
 * Fallback: use jina.ai reader — rendered HTML with footer wait.
 * Returns real HTML (with <footer>, <nav>, <a href>) not markdown.
 */
async function renderWithJina(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        'X-Return-Format': 'html',
        'X-Wait-For-Selector': 'footer',
      },
      signal: controller.signal,
    });

    if (!res.ok) return null;

    const html = await res.text();
    if (!html || html.length < 500) return null;

    return html;
  } catch {
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
      headers: { 'User-Agent': 'AYO-Bot/2.0 (AI Visionary Scanner)' },
      redirect: 'follow',
    });
    clearTimeout(tid);

    const rawHtml = await res.text();
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });

    if (!res.ok) {
      return { url, rawHtml, renderedHtml: rawHtml, textContent: '', sourceType: 'ssr', headers, statusCode: res.status, isReachable: false };
    }

    // Step 2: SSR site — rawHtml IS the rendered HTML
    if (!isSpaShell(rawHtml)) {
      const textContent = getTextContent(rawHtml);
      console.log(`[html-fetcher] SSR site: ${url} (${rawHtml.length} chars, ${textContent.length} text chars)`);
      return { url, rawHtml, renderedHtml: rawHtml, textContent, sourceType: 'ssr', headers, statusCode: res.status, isReachable: true };
    }

    // Step 3: SPA detected — need rendering
    console.log(`[html-fetcher] SPA detected for ${url}, launching headless browser...`);
    let sourceType: SourceType = 'spa_jina';

    // Try Puppeteer first (best quality — full DOM)
    const puppeteerHtml = await renderWithBrowser(url);
    if (puppeteerHtml && getTextContent(puppeteerHtml).length > MIN_TEXT) {
      const textContent = getTextContent(puppeteerHtml);
      console.log(`[html-fetcher] Puppeteer rendered ${puppeteerHtml.length} chars for ${url}`);
      return { url, rawHtml, renderedHtml: puppeteerHtml, textContent, sourceType: 'spa_puppeteer', headers, statusCode: res.status, isReachable: true };
    }

    // Fallback: Jina HTML with footer wait
    console.log(`[html-fetcher] Puppeteer failed, falling back to Jina HTML for ${url}`);
    const jinaHtml = await renderWithJina(url);
    if (jinaHtml) {
      const textContent = getTextContent(jinaHtml);
      console.log(`[html-fetcher] Jina HTML rendered ${jinaHtml.length} chars (${textContent.length} text) for ${url}`);
      sourceType = 'spa_jina';
      return { url, rawHtml, renderedHtml: jinaHtml, textContent, sourceType, headers, statusCode: res.status, isReachable: true };
    }

    // Last resort: use raw SPA shell (very limited)
    console.log(`[html-fetcher] All renderers failed for ${url}, using raw SPA shell`);
    return { url, rawHtml, renderedHtml: rawHtml, textContent: getTextContent(rawHtml), sourceType: 'ssr', headers, statusCode: res.status, isReachable: true };
  } catch {
    return { ...EMPTY_RESULT, url };
  }
}
