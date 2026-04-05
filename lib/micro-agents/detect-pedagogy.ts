// lib/micro-agents/detect-pedagogy.ts — Detect FAQ, glossary & documentation via focused LLM
// Extracts all links + headings from HTML. For SPAs, fetches full rendered HTML via Jina.

import type { PedagogyResult, Quality } from './types';
import { llmExtract, parseJson } from './llm-agent';

const PROMPT = `You detect educational/pedagogical content on websites. The content can be in ANY language (French, English, German, etc.).

Below is a list of ALL links and section headings from the website. Detect:
- has_faq: true if there is a FAQ page/section (look for: "FAQ", "Foire aux questions", "Frequently Asked Questions", "Häufige Fragen", /faq)
- has_glossary: true if there is a glossary/lexicon (look for: "Glossaire", "Glossary", "Lexique", "Lexikon", /glossar, /lexique)
- has_documentation: true if there is documentation/guides/tutorials (look for: "Documentation", "Docs", "Guide", "Tutoriel", "Tutorial", "API Reference")

Return ONLY JSON: {"has_faq": true/false, "has_glossary": true/false, "has_documentation": true/false}
Do NOT invent. Only return true if clearly present.`;

/**
 * Extract all links (href + text) and headings from HTML.
 * Ensures footer/nav links are included regardless of HTML size.
 */
function extractLinksAndHeadings(html: string): string {
  const parts: string[] = [];

  // Extract all <a href="...">text</a> links
  const linkRe = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([^<]*)</gi;
  let m;
  while ((m = linkRe.exec(html)) !== null) {
    const href = m[1].trim();
    const text = m[2].trim();
    if (text || href) parts.push(`LINK: ${text} → ${href}`);
  }

  // Extract all headings
  const headingRe = /<h[1-6][^>]*>([^<]+)</gi;
  while ((m = headingRe.exec(html)) !== null) {
    const text = m[1].trim();
    if (text) parts.push(`HEADING: ${text}`);
  }

  // Extract nav/footer text content as extra context
  const navRe = /<(?:nav|footer)[^>]*>([\s\S]*?)<\/(?:nav|footer)>/gi;
  while ((m = navRe.exec(html)) !== null) {
    const text = m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (text.length > 10) parts.push(`NAV/FOOTER: ${text.substring(0, 500)}`);
  }

  return parts.join('\n');
}

/**
 * For SPAs: fetch full rendered HTML via Jina (HTML format) to get footer/nav links.
 * This is a separate request from the main html-fetcher (which uses markdown for content).
 */
async function fetchRenderedLinks(url: string): Promise<string> {
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(`https://r.jina.ai/${url}`, {
      signal: ctrl.signal,
      headers: {
        'X-Return-Format': 'html',
        'X-Wait-For-Selector': 'footer',
      },
    });
    clearTimeout(tid);
    if (!res.ok) return '';
    const html = await res.text();
    return extractLinksAndHeadings(html);
  } catch {
    return '';
  }
}

export async function detectPedagogy(html: string, url: string): Promise<PedagogyResult> {
  try {
    // 1. Extract links from available HTML
    let extracted = extractLinksAndHeadings(html);

    // 2. Fetch Jina HTML only if extracted links don't mention FAQ/glossary/docs (SPA fallback)
    const hasPedagogyHints = /faq|glossar|lexique|documentation|docs|guide|tutoriel/i.test(extracted);
    if (!hasPedagogyHints) {
      const jinaLinks = await fetchRenderedLinks(url);
      if (jinaLinks) {
        extracted = extracted + '\n' + jinaLinks;
      }
    }

    const raw = await llmExtract(PROMPT, extracted, 8000);
    const data = parseJson<{ has_faq?: boolean; has_glossary?: boolean; has_documentation?: boolean }>(raw);

    const has_faq = data?.has_faq || false;
    const has_glossary = data?.has_glossary || false;
    const has_documentation = data?.has_documentation || false;

    console.log(`[detect-pedagogy] Result: faq=${has_faq}, glossary=${has_glossary}, docs=${has_documentation}`);

    const q: Quality = (has_faq || has_glossary || has_documentation) ? 1 : 0;
    return { has_faq, has_glossary, has_documentation, q };
  } catch {
    return { has_faq: false, has_glossary: false, has_documentation: false, q: 0 };
  }
}
