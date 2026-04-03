// lib/micro-agents/detect-services.ts — Extract services/products from HTML headings and lists

import type { ServicesResult, Quality } from './types';

// Section heading keywords that indicate services/products
const SERVICE_KEYWORDS = /services?|solutions?|offerings?|what we do|nos services|nos solutions|ce que nous faisons|notre offre|prestations?/i;
const PRODUCT_KEYWORDS = /products?|produits?|our products|nos produits|catalogue|catalog/i;
const GENERIC_OFFER = /features?|fonctionnalit[ée]s?|capabilities|comp[ée]tences/i;

// Items to filter out (too generic or navigation)
const NOISE_FILTER = /^(home|accueil|about|contact|blog|news|login|sign|menu|nav|cookie|privacy|terms|legal|search|\d+|©|all rights)/i;

export function detectServices(html: string): ServicesResult {
  const services: string[] = [];
  const products: string[] = [];
  let q: Quality = 0;

  // Strip scripts and styles
  const cleanHtml = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '');

  // Strategy 1: Find headings near service/product sections, then extract sibling lists
  const sectionRegex = /<(?:h[2-3]|div[^>]*class="[^"]*(?:title|heading)[^"]*")[^>]*>([\s\S]*?)<\/(?:h[2-3]|div)>\s*(?:<[^>]*>)*\s*(?:<ul[^>]*>([\s\S]*?)<\/ul>)?/gi;

  let match;
  while ((match = sectionRegex.exec(cleanHtml)) !== null) {
    const headingText = stripTags(match[1]).trim();
    const listHtml = match[2] || '';

    const isService = SERVICE_KEYWORDS.test(headingText) || GENERIC_OFFER.test(headingText);
    const isProduct = PRODUCT_KEYWORDS.test(headingText);

    if ((isService || isProduct) && listHtml) {
      const items = extractListItems(listHtml);
      if (isProduct) {
        products.push(...items);
      } else {
        services.push(...items);
      }
    }
  }

  // Strategy 2: Extract all h2/h3 headings under service/product sections
  const allHeadings = extractHeadingsNearKeywords(cleanHtml);
  for (const { text, type } of allHeadings) {
    if (type === 'product' && !products.includes(text)) {
      products.push(text);
    } else if (type === 'service' && !services.includes(text)) {
      services.push(text);
    }
  }

  // Strategy 3: If still empty, look for any ul/li in main content area
  if (services.length === 0 && products.length === 0) {
    const mainContent = cleanHtml.match(/<main[\s\S]*?<\/main>/i)?.[0] || cleanHtml;
    const allLists = extractAllMeaningfulLists(mainContent);
    services.push(...allLists.slice(0, 10)); // Cap at 10
  }

  // Deduplicate and clean
  const cleanServices = deduplicateAndClean(services);
  const cleanProducts = deduplicateAndClean(products);

  // Quality
  if (cleanServices.length > 0 || cleanProducts.length > 0) {
    q = cleanServices.length >= 3 || cleanProducts.length >= 3 ? 1 : 0.5;
  }

  return { services: cleanServices, products: cleanProducts, q };
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
}

function extractListItems(listHtml: string): string[] {
  const items: string[] = [];
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let match;
  while ((match = liRegex.exec(listHtml)) !== null) {
    const text = stripTags(match[1]).trim();
    if (text.length > 2 && text.length < 200 && !NOISE_FILTER.test(text)) {
      items.push(text);
    }
  }
  return items;
}

function extractHeadingsNearKeywords(html: string): { text: string; type: 'service' | 'product' }[] {
  const results: { text: string; type: 'service' | 'product' }[] = [];

  // Find sections that contain service/product keywords
  const sections = html.split(/<(?:section|div)[^>]*>/i);

  for (const section of sections) {
    const isServiceSection = SERVICE_KEYWORDS.test(section.substring(0, 500));
    const isProductSection = PRODUCT_KEYWORDS.test(section.substring(0, 500));

    if (isServiceSection || isProductSection) {
      const headingRegex = /<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/gi;
      let match;
      while ((match = headingRegex.exec(section)) !== null) {
        const text = stripTags(match[1]).trim();
        if (text.length > 3 && text.length < 150 && !NOISE_FILTER.test(text) &&
            !SERVICE_KEYWORDS.test(text) && !PRODUCT_KEYWORDS.test(text)) {
          results.push({
            text,
            type: isProductSection ? 'product' : 'service',
          });
        }
      }
    }
  }

  return results;
}

function extractAllMeaningfulLists(html: string): string[] {
  const items: string[] = [];
  const ulRegex = /<ul[^>]*>([\s\S]*?)<\/ul>/gi;
  let match;
  while ((match = ulRegex.exec(html)) !== null) {
    const listItems = extractListItems(match[1]);
    // Only take lists with 3+ items (likely content, not navigation)
    if (listItems.length >= 3) {
      items.push(...listItems);
    }
  }
  return items;
}

function deduplicateAndClean(items: string[]): string[] {
  const seen = new Set<string>();
  return items
    .map(s => s.replace(/\s+/g, ' ').trim())
    .filter(s => {
      const key = s.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return s.length > 2 && s.length < 200;
    })
    .slice(0, 15); // Cap at 15 items
}
