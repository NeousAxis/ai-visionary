// lib/micro-agents/detect-location.ts — Extract location via focused LLM

import type { LocationResult, Quality, JsonLdResult } from './types';
import { llmExtract, parseJson, LlmCallError } from './llm-agent';

const PROMPT = `You are a location extractor. From the website content below, extract:
- city: the city where the business is located (e.g. "Geneva", "Paris", "New York")
- country: the country (e.g. "Switzerland", "France", "United States")

The input starts with a SITE LINKS & FOOTER section. PAY CLOSE ATTENTION — addresses and location info are almost always in the footer.

Look for addresses, footer info, "Based in", "Located in", contact sections, domain TLD (.ch=Switzerland, .fr=France, .de=Germany).
Return ONLY valid JSON: {"city": "Geneva" or null, "country": "Switzerland" or null}
Do NOT invent. If not found, return null. No explanation.`;

export async function detectLocation(content: string, jsonldResult?: JsonLdResult, siteUrl?: string): Promise<LocationResult> {
  // Priority 1: JSON-LD (already parsed, no LLM needed)
  if (jsonldResult?.address?.city || jsonldResult?.address?.country) {
    return {
      city: jsonldResult.address.city || null,
      country: jsonldResult.address.country || null,
      q: 1,
    };
  }

  // Priority 2: LLM extraction
  try {
    // Add site URL as context for TLD detection
    const extra = siteUrl ? `\nSite URL: ${siteUrl}` : '';
    const raw = await llmExtract(PROMPT, content + extra);
    const data = parseJson<{ city?: string | null; country?: string | null }>(raw);
    if (!data) return { city: null, country: null, q: 0 };

    const city = data.city || null;
    const country = data.country || null;

    let q: Quality = 0;
    if (city && country) q = 1;
    else if (city || country) q = 0.5;

    return { city, country, q };
  } catch (err) {
    // Panne du fournisseur : on la laisse remonter pour que le diagnostic soit signale
    // incomplet, plutot que de faire passer une absence technique pour une absence reelle.
    if (err instanceof LlmCallError) throw err;
    return { city: null, country: null, q: 0 };
  }
}
