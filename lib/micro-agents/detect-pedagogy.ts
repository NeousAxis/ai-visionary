// lib/micro-agents/detect-pedagogy.ts — Detect FAQ, glossary & documentation via focused LLM
// Consumes renderedHtml from html-fetcher — NO additional Jina calls.

import type { PedagogyResult, Quality } from './types';
import { llmExtract, parseJson, LlmCallError } from './llm-agent';
import { AYOBOT_UA } from './constants';

// Common FAQ page paths, probed when no FAQ is found on the scanned page itself
// (unlinked /faq, login-gated homepage with the real FAQ at a public /faq).
const FAQ_PAGE_PATHS = ['/faq', '/faq/', '/foire-aux-questions', '/questions-frequentes', '/aide', '/help', '/faqs'];
const FAQ_PAGE_LABEL = /(?:\bFAQ\b|foire\s+aux\s+questions|questions?\s+fr[eé]quentes|frequently\s+asked\s+questions|h[äa]ufig(?:e|\s+gestellte)?\s+fragen|preguntas\s+frecuentes|domande\s+frequenti)/i;

/**
 * Probe common FAQ URLs and require REAL Q&A content (FAQPage schema, or a FAQ label
 * plus 3+ question-terminated phrases) so a soft-404 SPA shell that 200s everywhere is
 * not a false positive.
 */
/**
 * Soft-404 guard: a clearly-nonexistent path returning 200 means the site echoes content on
 * every path (SPA catch-all), so URL existence probes are unreliable — used to skip them.
 */
async function isSoftNotFound(baseUrl: string): Promise<boolean> {
  try {
    const u = new URL(baseUrl);
    u.pathname = '/_ayo_nonexistent_probe_9z7x';
    const res = await fetch(u.toString(), { headers: { 'User-Agent': AYOBOT_UA }, redirect: 'manual', signal: AbortSignal.timeout(3500) });
    return res.status === 200;
  } catch {
    return false;
  }
}

async function detectFaqPage(baseUrl: string): Promise<boolean> {
  if (await isSoftNotFound(baseUrl)) return false;
  const probe = async (p: string): Promise<boolean> => {
    try {
      const u = new URL(baseUrl);
      u.pathname = p;
      const res = await fetch(u.toString(), {
        headers: { 'User-Agent': AYOBOT_UA },
        redirect: 'follow',
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) return false;
      const html = await res.text();
      if (/"@type"\s*:\s*"(FAQPage|Question)"/i.test(html)) return true;
      const text = html.replace(/<[^>]+>/g, ' ');
      const questions = (text.match(/[A-Za-zÀ-ÿ][^?<>]{6,140}\?/g) || []).length;
      return FAQ_PAGE_LABEL.test(text) && questions >= 3;
    } catch {
      return false;
    }
  };
  const results = await Promise.all(FAQ_PAGE_PATHS.map(probe));
  return results.some(Boolean);
}

const PROMPT = `You detect educational/pedagogical content on websites. The content can be in ANY language (French, English, German, etc.).

Below is a list of ALL links and section headings from the website. Detect:
- has_faq: true if there is a FAQ page/section (look for: "FAQ", "Foire aux questions", "Frequently Asked Questions", "Häufige Fragen", "Aide", "Help", "Support", /faq, /help)
- has_glossary: true if there is a glossary/lexicon (look for: "Glossaire", "Glossary", "Lexique", "Lexikon", /glossar, /lexique)
- has_documentation: true if there is ANY educational/knowledge content: blog, insights, articles, reports, whitepapers, case studies, guides, tutorials, documentation, knowledge base, resources, academy, learning center (look for: "Blog", "Insights", "Articles", "Reports", "Resources", "Case Studies", "Études de cas", "Actualités", "News", "Guide", "Documentation", "Academy", "Learn", "Ressources", "Rapports", "Whitepapers", "Knowledge", /blog, /insights, /resources, /reports, /news, /articles, /academy, /case-studies, /our-work)

Return ONLY JSON: {"has_faq": true/false, "has_glossary": true/false, "has_documentation": true/false}
Do NOT invent. Only return true if clearly present.`;

// High-precision, multilingual section markers. Each explicitly names a FAQ/glossary
// section, so a plain-text hit is reliable (won't fire on casual "des questions ?").
// FAQ/glossary sections often render as <div>/<button> accordions with NO <a>/<h> tag and
// no nav link — invisible to link/heading extraction — so we also scan the full rendered text.
const FAQ_MARKERS = /(?:\bFAQ\b|foire\s+aux\s+questions|questions?\s+fr[eé]quentes|questions?\s*[-–/&]\s*r[eé]ponses|frequently\s+asked\s+questions|h[äa]ufig(?:e|\s+gestellte)?\s+fragen|preguntas\s+frecuentes|domande\s+frequenti|veelgestelde\s+vragen|perguntas\s+frequentes)/i;
const GLOSSARY_MARKERS = /(?:\bglossaire\b|\bglossary\b|\blexique\b|\blexikon\b|\bglossar\b|\bvocabulaire\b)/i;

// Strip tags to plain text for marker scanning.
function stripToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Extract all links (href + text) and headings from rendered HTML.
 * Works on real DOM (SSR or Jina HTML) — footer/nav links are included.
 */
function extractLinksAndHeadings(html: string): string {
  const parts: string[] = [];
  let m;

  // Extract all <a href="...">text</a> links
  const linkRe = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([^<]*)</gi;
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
 * Detect FAQ, glossary, documentation from renderedHtml.
 * No Jina calls — html-fetcher already provides complete renderedHtml.
 */
export async function detectPedagogy(renderedHtml: string, textContent = '', url = ''): Promise<PedagogyResult> {
  try {
    const extracted = extractLinksAndHeadings(renderedHtml);

    // Full corpus for the high-precision marker scan: link/heading structure + rendered body
    // text + clean text content. This catches FAQ/glossary sections that render as
    // <div>/<button> accordions (no <a>/<h> tag, no nav link) — the exact case that pure
    // link/heading extraction misses (e.g. an accordion titled "Questions fréquentes").
    const corpus = `${extracted}\n${stripToText(renderedHtml)}\n${textContent}`;
    const detFaq = FAQ_MARKERS.test(corpus);
    const detGlossary = GLOSSARY_MARKERS.test(corpus);
    console.log(`[detect-pedagogy] corpus=${corpus.length} chars | text-markers faq=${detFaq}, glossary=${detGlossary}`);

    // LLM pass over links/headings — catches nav-based FAQ + documentation (blog/guides/resources).
    let llmFaq = false, llmGlossary = false, llmDocs = false;
    if (extracted && extracted.length >= 20) {
      const raw = await llmExtract(PROMPT, extracted, 8000);
      const data = parseJson<{ has_faq?: boolean; has_glossary?: boolean; has_documentation?: boolean }>(raw);
      llmFaq = data?.has_faq || false;
      llmGlossary = data?.has_glossary || false;
      llmDocs = data?.has_documentation || false;
    } else {
      console.warn(`[detect-pedagogy] sparse links/headings — relying on text markers only`);
    }

    // FAQ/glossary: deterministic text marker OR llm signal. Documentation stays LLM-only.
    let has_faq = detFaq || llmFaq;
    const has_glossary = detGlossary || llmGlossary;
    const has_documentation = llmDocs;

    // Nothing on the scanned page? Probe common /faq URLs (unlinked FAQ page, or a
    // login-gated homepage whose real FAQ lives at a public /faq). This runs inside the
    // agent so the scan CARD (not just the score) reflects the FAQ.
    if (!has_faq && url) {
      has_faq = await detectFaqPage(url);
    }

    console.log(`[detect-pedagogy] Result: faq=${has_faq} (det=${detFaq}, llm=${llmFaq}), glossary=${has_glossary} (det=${detGlossary}, llm=${llmGlossary}), docs=${has_documentation}`);

    const q: Quality = (has_faq || has_glossary || has_documentation) ? 1 : 0;
    return { has_faq, has_glossary, has_documentation, q };
  } catch (err) {
    // Panne du fournisseur : on la laisse remonter pour que le diagnostic soit signale
    // incomplet, plutot que de faire passer une absence technique pour une absence reelle.
    if (err instanceof LlmCallError) throw err;
    return { has_faq: false, has_glossary: false, has_documentation: false, q: 0 };
  }
}
