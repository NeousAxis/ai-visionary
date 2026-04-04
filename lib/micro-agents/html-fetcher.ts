// lib/micro-agents/html-fetcher.ts — Universal HTML fetcher
// 1. Try simple fetch (fast, works for SSR sites)
// 2. If SPA detected → Puppeteer headless Chromium (renders JS, universal)

import { isAllowedUrl } from '../validators';
import type { FetchResult } from './types';

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
    // Dynamic imports to avoid bundling issues
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

      // Navigate and wait for content to render
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 12000,
      });

      // Wait a bit more for lazy-loaded content
      await page.evaluate(() => {
        return new Promise<void>((resolve) => {
          // Scroll to bottom to trigger lazy loading
          window.scrollTo(0, document.body.scrollHeight);
          setTimeout(resolve, 1000);
        });
      });

      // Get the fully rendered HTML
      const html = await page.content();
      return html;
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error('[html-fetcher] Browser render failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Fallback: use jina.ai reader and convert markdown to basic HTML
 */
async function renderWithJina(url: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(`https://r.jina.ai/${url}`, {
      signal: ctrl.signal,
      headers: { 'Accept': 'text/html', 'X-Return-Format': 'html' },
    });
    clearTimeout(tid);
    if (!res.ok) return null;
    const md = await res.text();
    if (md.length < MIN_TEXT) return null;

    // Convert markdown to basic HTML
    let html = md;
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>');

    // Wrap in HTML structure
    const title = md.match(/^Title:\s*(.+)$/m)?.[1] || '';
    html = `<html><head><title>${title}</title></head><body>${html}</body></html>`;

    // Add source domain link for TLD detection
    const domain = url.replace(/^https?:\/\//, '').split('/')[0];
    html += `<a href="${url}">${domain}</a>`;

    return html;
  } catch {
    return null;
  }
}

export async function fetchHtml(targetUrl: string): Promise<FetchResult> {
  let url = targetUrl.trim();
  if (!url.startsWith('http')) url = 'https://' + url;

  const ssrfCheck = isAllowedUrl(url);
  if (!ssrfCheck.allowed) {
    return { url, html: '', headers: {}, statusCode: 0, isReachable: false };
  }

  try {
    // Step 1: Fast fetch
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'AYO-Bot/2.0 (AI Visionary Micro-Agent Scanner)' },
      redirect: 'follow',
    });
    clearTimeout(tid);

    let html = await res.text();
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });

    // Step 2: SPA detection → headless render
    if (res.ok && isSpaShell(html)) {
      console.log(`[html-fetcher] SPA detected for ${url}, launching headless browser...`);

      // Try Puppeteer first (best quality)
      const rendered = await renderWithBrowser(url);
      if (rendered && getTextContent(rendered).length > MIN_TEXT) {
        html = rendered;
        console.log(`[html-fetcher] Puppeteer rendered ${html.length} chars for ${url}`);
      } else {
        // Fallback to jina.ai
        console.log(`[html-fetcher] Puppeteer failed, falling back to jina.ai for ${url}`);
        const jinaHtml = await renderWithJina(url);
        if (jinaHtml) {
          html = jinaHtml;
          console.log(`[html-fetcher] Jina rendered ${html.length} chars for ${url}`);
        }
      }
    }

    return { url, html, headers, statusCode: res.status, isReachable: res.ok };
  } catch {
    return { url, html: '', headers: {}, statusCode: 0, isReachable: false };
  }
}
