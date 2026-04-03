// lib/micro-agents/html-fetcher.ts — Fetch HTML + headers for micro-agents

import { isAllowedUrl } from '../validators';
import type { FetchResult } from './types';

export async function fetchHtml(targetUrl: string): Promise<FetchResult> {
  let url = targetUrl.trim();
  if (!url.startsWith('http')) {
    url = 'https://' + url;
  }

  const ssrfCheck = isAllowedUrl(url);
  if (!ssrfCheck.allowed) {
    return {
      url,
      html: '',
      headers: {},
      statusCode: 0,
      isReachable: false,
    };
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

    const html = await response.text();

    // Extract response headers as plain object
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    return {
      url,
      html,
      headers,
      statusCode: response.status,
      isReachable: response.ok,
    };
  } catch {
    return {
      url,
      html: '',
      headers: {},
      statusCode: 0,
      isReachable: false,
    };
  }
}
