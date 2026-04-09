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
    return (html && html.length >= 500) ? html : null;
  } catch {
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
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      signal: controller.signal,
    });

    if (!res.ok) return null;
    const md = await res.text();
    return (md && md.length >= MIN_TEXT) ? md : null;
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

    const renderedHtml = jinaHtml || rawHtml;
    const textContent = jinaMarkdown || getTextContent(renderedHtml);

    console.log(`[html-fetcher] Jina: html=${jinaHtml ? jinaHtml.length : 0} chars, md=${jinaMarkdown ? jinaMarkdown.length : 0} chars for ${url}`);

    return { url, rawHtml, renderedHtml, textContent, sourceType: 'spa_jina', headers, statusCode: res.status, isReachable: true };
  } catch {
    return { ...EMPTY_RESULT, url };
  }
}
