// lib/micro-agents/html-fetcher.ts — Fetch HTML + headers for micro-agents
// Handles SPAs with headless rendering fallback + returns both HTML and text

import { isAllowedUrl } from '../validators';
import type { FetchResult } from './types';

const MIN_TEXT = 500;
const SPA_SHELL = [
  /<div\s+id=["'](?:root|app|__next|__nuxt)["']\s*>\s*<\/div>/i,
  /type=["']module["']\s+src=["']\/(?:assets|static|js)\//i,
];

function isSpaShell(html: string): boolean {
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length < MIN_TEXT && SPA_SHELL.some(re => re.test(html));
}

export async function fetchHtml(targetUrl: string): Promise<FetchResult> {
  let url = targetUrl.trim();
  if (!url.startsWith('http')) url = 'https://' + url;

  const ssrfCheck = isAllowedUrl(url);
  if (!ssrfCheck.allowed) {
    return { url, html: '', headers: {}, statusCode: 0, isReachable: false };
  }

  try {
    // Step 1: Normal fetch (fast)
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

    // Step 2: SPA detection — if empty shell, fetch rendered version
    if (res.ok && isSpaShell(html)) {
      try {
        const ctrl2 = new AbortController();
        const tid2 = setTimeout(() => ctrl2.abort(), 15000);
        const rendered = await fetch(`https://r.jina.ai/${url}`, {
          signal: ctrl2.signal,
          headers: { 'Accept': 'text/html', 'X-Return-Format': 'html' },
        });
        clearTimeout(tid2);
        if (rendered.ok) {
          const text = await rendered.text();
          if (text.length > MIN_TEXT) {
            // jina returns markdown — wrap it so agents can parse it
            // Keep the markdown but ALSO try to reconstruct basic HTML hints
            html = convertMarkdownToBasicHtml(text, url);
          }
        }
      } catch { /* keep original html */ }
    }

    return { url, html, headers, statusCode: res.status, isReachable: res.ok };
  } catch {
    return { url, html: '', headers: {}, statusCode: 0, isReachable: false };
  }
}

/**
 * Convert jina markdown output to basic HTML that agents can parse.
 * This isn't perfect HTML but gives agents enough structure to work with.
 */
function convertMarkdownToBasicHtml(md: string, sourceUrl: string): string {
  let html = md;

  // Convert markdown links [text](url) to <a href="url">text</a>
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Convert ### headings to h3, ## to h2, # to h1
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Convert **bold** to <strong>
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Convert list items
  html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>');

  // Add the source URL as a meta hint
  html = `<html><head><title>${md.split('\n')[0] || ''}</title></head><body>${html}</body></html>`;

  // Inject domain info for TLD detection
  const domain = sourceUrl.replace(/^https?:\/\//, '').split('/')[0];
  html += `<a href="${sourceUrl}">${domain}</a>`;

  return html;
}
