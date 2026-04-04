// lib/micro-agents/html-fetcher.ts — Fetch HTML + headers for micro-agents
// Supports SPA detection with headless rendering fallback

import { isAllowedUrl } from '../validators';
import type { FetchResult } from './types';

// Minimum text content to consider the page "real" (not an empty SPA shell)
const MIN_TEXT_LENGTH = 500;

// SPA shell indicators
const SPA_INDICATORS = [
  /<div\s+id=["'](?:root|app|__next|__nuxt)["']\s*>\s*<\/div>/i,
  /<div\s+id=["'](?:root|app)["']\s*><\/div>/i,
  /type=["']module["']\s+src=["']\/(?:assets|static|js)\//i,
];

/**
 * Check if HTML is likely an empty SPA shell
 */
function isSpaShell(html: string): boolean {
  // Very short HTML with SPA indicators
  const textContent = html.replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (textContent.length < MIN_TEXT_LENGTH) {
    return SPA_INDICATORS.some(re => re.test(html));
  }
  return false;
}

/**
 * Fetch rendered HTML from a headless rendering service.
 * Uses Google's public web render service as fallback.
 */
async function fetchRenderedHtml(url: string): Promise<string | null> {
  // Strategy 1: Use a headless rendering proxy
  // We use r.jina.ai which renders JS and returns clean content
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(`https://r.jina.ai/${url}`, {
      signal: controller.signal,
      headers: {
        'Accept': 'text/html',
        'User-Agent': 'AYO-Bot/2.0 (AI Visionary Scanner)',
      },
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const text = await response.text();
      if (text.length > MIN_TEXT_LENGTH) {
        return text;
      }
    }
  } catch {
    // Fallback below
  }

  // Strategy 2: Google cache / webcache
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const cacheUrl = `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(url)}`;
    const response = await fetch(cacheUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AYO-Bot/2.0)' },
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const text = await response.text();
      if (text.length > MIN_TEXT_LENGTH) {
        return text;
      }
    }
  } catch {
    // Both strategies failed
  }

  return null;
}

export async function fetchHtml(targetUrl: string): Promise<FetchResult> {
  let url = targetUrl.trim();
  if (!url.startsWith('http')) {
    url = 'https://' + url;
  }

  const ssrfCheck = isAllowedUrl(url);
  if (!ssrfCheck.allowed) {
    return { url, html: '', headers: {}, statusCode: 0, isReachable: false };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'AYO-Bot/2.0 (AI Visionary Micro-Agent Scanner)' },
      redirect: 'follow',
    });
    clearTimeout(timeoutId);

    let html = await response.text();

    // Extract response headers
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    // SPA Detection: if the HTML is just an empty shell, try headless rendering
    if (response.ok && isSpaShell(html)) {
      const rendered = await fetchRenderedHtml(url);
      if (rendered) {
        html = rendered;
      }
    }

    return {
      url,
      html,
      headers,
      statusCode: response.status,
      isReachable: response.ok,
    };
  } catch {
    return { url, html: '', headers: {}, statusCode: 0, isReachable: false };
  }
}
