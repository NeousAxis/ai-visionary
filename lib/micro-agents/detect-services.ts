// lib/micro-agents/detect-services.ts — Extract services/products from HTML

import type { ServicesResult, Quality } from './types';

const SERVICE_KW = /services?|solutions?|offerings?|what we do|nos services|nos solutions|notre offre|prestations?|accompagnement|beratung|leistungen/i;
const PRODUCT_KW = /products?|produits?|our products|nos produits|catalogue|catalog/i;
const GENERIC_KW = /features?|fonctionnalit[ée]s?|capabilities|comp[ée]tences|expertise/i;
const NOISE = /^(home|accueil|about|contact|blog|news|login|sign|menu|nav|cookie|privacy|terms|legal|search|\d+|©|all rights|en savoir|learn more|read more|voir plus|lire|details|more info)/i;

export function detectServices(html: string): ServicesResult {
  const services: string[] = [];
  const products: string[] = [];

  // Strip nav, header, footer, scripts, styles
  const clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '');

  // === Strategy 1: List items (ul/ol) near service headings ===
  extractListsNearHeadings(clean, SERVICE_KW, services);
  extractListsNearHeadings(clean, PRODUCT_KW, products);

  // === Strategy 2: Card layouts (repeated div/article with h3/h4 inside sections) ===
  extractCardsInSections(clean, SERVICE_KW, services);
  extractCardsInSections(clean, PRODUCT_KW, products);
  extractCardsInSections(clean, GENERIC_KW, services);

  // === Strategy 3: All h3/h4 under service-keyword sections ===
  extractHeadingsInSections(clean, SERVICE_KW, services);
  extractHeadingsInSections(clean, PRODUCT_KW, products);

  // === Strategy 4: Meta description as hint ===
  const metaDesc = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
  if (metaDesc && services.length === 0 && products.length === 0) {
    // Extract comma-separated items from meta description
    const parts = metaDesc[1].split(/[,|·•]/).map(s => s.trim()).filter(s => s.length > 3 && s.length < 100);
    if (parts.length >= 2) {
      services.push(...parts.slice(0, 5));
    }
  }

  // === Strategy 5: Title tag parsing ===
  if (services.length === 0 && products.length === 0) {
    const title = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (title) {
      const parts = title[1].split(/[|·\-–—]/).map(s => s.trim()).filter(s => s.length > 3);
      if (parts.length >= 2) {
        // Second part is often the service description
        services.push(parts.slice(1).join(' — '));
      }
    }
  }

  const cleanServices = dedup(services);
  const cleanProducts = dedup(products);
  const total = cleanServices.length + cleanProducts.length;
  const q: Quality = total >= 3 ? 1 : total > 0 ? 0.5 : 0;

  return { services: cleanServices, products: cleanProducts, q };
}

function strip(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#\d+;/g, '').trim();
}

function extractListsNearHeadings(html: string, keyword: RegExp, out: string[]) {
  // Find sections containing keyword, then extract ul/ol items within
  const sectionRe = /(<(?:section|div|article)[^>]*>[\s\S]*?<\/(?:section|div|article)>)/gi;
  let match;
  while ((match = sectionRe.exec(html)) !== null) {
    const section = match[1];
    if (section.length > 20000) continue; // skip huge sections
    const first500 = strip(section.substring(0, 500));
    if (!keyword.test(first500)) continue;

    const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let li;
    while ((li = liRe.exec(section)) !== null) {
      const text = strip(li[1]).replace(/\s+/g, ' ');
      if (text.length > 3 && text.length < 200 && !NOISE.test(text)) {
        out.push(text);
      }
    }
  }
}

function extractCardsInSections(html: string, keyword: RegExp, out: string[]) {
  // Split by sections, find ones with keyword, extract h3/h4 headings from card-like divs
  const sections = html.split(/<(?:section)[^>]*>/i);
  for (const section of sections) {
    if (section.length > 30000) continue;
    const first500 = strip(section.substring(0, 500));
    if (!keyword.test(first500)) continue;

    // Look for h3/h4 headings (typical of cards)
    const headingRe = /<h[3-4][^>]*>([\s\S]*?)<\/h[3-4]>/gi;
    let h;
    while ((h = headingRe.exec(section)) !== null) {
      const text = strip(h[1]).replace(/\s+/g, ' ');
      if (text.length > 3 && text.length < 150 && !NOISE.test(text) &&
          !keyword.test(text) && !SERVICE_KW.test(text) && !PRODUCT_KW.test(text)) {
        out.push(text);
      }
    }
  }
}

function extractHeadingsInSections(html: string, keyword: RegExp, out: string[]) {
  const sections = html.split(/<(?:section|div)[^>]*class=["'][^"']*(?:service|product|offer|card|feature)[^"']*["']/i);
  for (const section of sections) {
    if (section.length > 20000 || !keyword.test(section.substring(0, 800))) continue;
    const hRe = /<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/gi;
    let h;
    while ((h = hRe.exec(section)) !== null) {
      const text = strip(h[1]).replace(/\s+/g, ' ');
      if (text.length > 3 && text.length < 150 && !NOISE.test(text)) {
        out.push(text);
      }
    }
  }
}

function dedup(items: string[]): string[] {
  const seen = new Set<string>();
  return items
    .map(s => s.replace(/\s+/g, ' ').trim())
    .filter(s => {
      const key = s.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return s.length > 3 && s.length < 200;
    })
    .slice(0, 15);
}
