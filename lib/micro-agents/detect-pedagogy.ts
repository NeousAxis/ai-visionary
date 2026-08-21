// lib/micro-agents/detect-pedagogy.ts — Detect FAQ, glossary & documentation via focused LLM
// Consumes renderedHtml from html-fetcher — NO additional Jina calls.

import type { PedagogyResult, Quality } from './types';
import { llmExtract, parseJson, LlmCallError } from './llm-agent';

const PROMPT = `You detect educational/pedagogical content on websites. The content can be in ANY language (French, English, German, etc.).

Below is a list of ALL links and section headings from the website. Detect:
- has_faq: true if there is a FAQ page/section (look for: "FAQ", "Foire aux questions", "Frequently Asked Questions", "Häufige Fragen", "Aide", "Help", "Support", /faq, /help)
- has_glossary: true if there is a glossary/lexicon (look for: "Glossaire", "Glossary", "Lexique", "Lexikon", /glossar, /lexique)
- has_documentation: true if there is ANY educational/knowledge content: blog, insights, articles, reports, whitepapers, case studies, guides, tutorials, documentation, knowledge base, resources, academy, learning center (look for: "Blog", "Insights", "Articles", "Reports", "Resources", "Case Studies", "Études de cas", "Actualités", "News", "Guide", "Documentation", "Academy", "Learn", "Ressources", "Rapports", "Whitepapers", "Knowledge", /blog, /insights, /resources, /reports, /news, /articles, /academy, /case-studies, /our-work)

Return ONLY JSON: {"has_faq": true/false, "has_glossary": true/false, "has_documentation": true/false}
Do NOT invent. Only return true if clearly present.`;

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
export async function detectPedagogy(renderedHtml: string): Promise<PedagogyResult> {
  try {
    console.log(`[detect-pedagogy] Input: ${renderedHtml.length} chars, has <footer>: ${/<footer/i.test(renderedHtml)}, has <a href>: ${/<a\s/i.test(renderedHtml)}`);
    const extracted = extractLinksAndHeadings(renderedHtml);
    console.log(`[detect-pedagogy] Extracted ${extracted.split('\n').length} lines (${extracted.length} chars). Has FAQ: ${/faq/i.test(extracted)}, Glossaire: ${/glossai/i.test(extracted)}`);

    if (!extracted || extracted.length < 20) {
      console.warn(`[detect-pedagogy] No links/headings extracted — input is likely empty SPA shell`);
      return { has_faq: false, has_glossary: false, has_documentation: false, q: 0 };
    }

    const raw = await llmExtract(PROMPT, extracted, 8000);
    const data = parseJson<{ has_faq?: boolean; has_glossary?: boolean; has_documentation?: boolean }>(raw);

    const has_faq = data?.has_faq || false;
    const has_glossary = data?.has_glossary || false;
    const has_documentation = data?.has_documentation || false;

    console.log(`[detect-pedagogy] Result: faq=${has_faq}, glossary=${has_glossary}, docs=${has_documentation}`);

    const q: Quality = (has_faq || has_glossary || has_documentation) ? 1 : 0;
    return { has_faq, has_glossary, has_documentation, q };
  } catch (err) {
    // Panne du fournisseur : on la laisse remonter pour que le diagnostic soit signale
    // incomplet, plutot que de faire passer une absence technique pour une absence reelle.
    if (err instanceof LlmCallError) throw err;
    return { has_faq: false, has_glossary: false, has_documentation: false, q: 0 };
  }
}
