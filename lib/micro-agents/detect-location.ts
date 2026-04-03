// lib/micro-agents/detect-location.ts — Extract city + country from HTML

import type { LocationResult, Quality, JsonLdResult } from './types';

// Country patterns (common mentions in footer/about/contact sections)
const COUNTRY_PATTERNS: [RegExp, string][] = [
  [/\bswitzerland\b/i, 'Switzerland'],
  [/\bsuisse\b/i, 'Switzerland'],
  [/\bschweiz\b/i, 'Switzerland'],
  [/\bfrance\b/i, 'France'],
  [/\bgermany\b/i, 'Germany'],
  [/\bdeutschland\b/i, 'Germany'],
  [/\bunited kingdom\b/i, 'United Kingdom'],
  [/\bunited states\b/i, 'United States'],
  [/\busa\b/i, 'United States'],
  [/\bitaly\b/i, 'Italy'],
  [/\bitalia\b/i, 'Italy'],
  [/\bspain\b/i, 'Spain'],
  [/\bespa[ñn]a\b/i, 'Spain'],
  [/\bnetherlands\b/i, 'Netherlands'],
  [/\bbelgium\b/i, 'Belgium'],
  [/\bbelgique\b/i, 'Belgium'],
  [/\baustria\b/i, 'Austria'],
  [/\bjapan\b/i, 'Japan'],
  [/\bcanada\b/i, 'Canada'],
  [/\baustralia\b/i, 'Australia'],
  [/\bsingapore\b/i, 'Singapore'],
  [/\bindia\b/i, 'India'],
  [/\bbrazil\b/i, 'Brazil'],
  [/\bportugal\b/i, 'Portugal'],
  [/\bsweden\b/i, 'Sweden'],
  [/\bnorway\b/i, 'Norway'],
  [/\bdenmark\b/i, 'Denmark'],
  [/\bfinland\b/i, 'Finland'],
  [/\bireland\b/i, 'Ireland'],
  [/\bluxembourg\b/i, 'Luxembourg'],
];

// Known city patterns
const CITY_PATTERNS: [RegExp, string, string][] = [
  [/\bgeneva\b|\bgen[èe]ve\b|\bgenf\b/i, 'Geneva', 'Switzerland'],
  [/\bzurich\b|\bz[üu]rich\b/i, 'Zurich', 'Switzerland'],
  [/\bbern\b|\bberne\b/i, 'Bern', 'Switzerland'],
  [/\blausanne\b/i, 'Lausanne', 'Switzerland'],
  [/\bbasel\b|\bb[âa]le\b/i, 'Basel', 'Switzerland'],
  [/\bparis\b/i, 'Paris', 'France'],
  [/\blyon\b/i, 'Lyon', 'France'],
  [/\bmarseille\b/i, 'Marseille', 'France'],
  [/\blondon\b/i, 'London', 'United Kingdom'],
  [/\bnew york\b/i, 'New York', 'United States'],
  [/\bsan francisco\b/i, 'San Francisco', 'United States'],
  [/\bberlin\b/i, 'Berlin', 'Germany'],
  [/\bmunich\b|\bm[üu]nchen\b/i, 'Munich', 'Germany'],
  [/\bamsterdam\b/i, 'Amsterdam', 'Netherlands'],
  [/\bbrussels\b|\bbruxelles\b/i, 'Brussels', 'Belgium'],
  [/\bvienna\b|\bwien\b/i, 'Vienna', 'Austria'],
  [/\bmadrid\b/i, 'Madrid', 'Spain'],
  [/\bbarcelona\b|\bbarcelone\b/i, 'Barcelona', 'Spain'],
  [/\brome\b|\broma\b/i, 'Rome', 'Italy'],
  [/\bmilan\b|\bmilano\b/i, 'Milan', 'Italy'],
  [/\btokyo\b/i, 'Tokyo', 'Japan'],
  [/\bdubai\b/i, 'Dubai', 'United Arab Emirates'],
  [/\bsydney\b/i, 'Sydney', 'Australia'],
  [/\btoronto\b/i, 'Toronto', 'Canada'],
  [/\bsingapore\b/i, 'Singapore', 'Singapore'],
];

// ISO 2-letter to country name
const ISO_TO_COUNTRY: Record<string, string> = {
  CH: 'Switzerland', FR: 'France', DE: 'Germany', GB: 'United Kingdom',
  US: 'United States', IT: 'Italy', ES: 'Spain', NL: 'Netherlands',
  BE: 'Belgium', AT: 'Austria', JP: 'Japan', CA: 'Canada',
  AU: 'Australia', SG: 'Singapore', IN: 'India', BR: 'Brazil',
  PT: 'Portugal', SE: 'Sweden', NO: 'Norway', DK: 'Denmark',
  FI: 'Finland', IE: 'Ireland', LU: 'Luxembourg', AE: 'United Arab Emirates',
};

export function detectLocation(html: string, jsonldResult?: JsonLdResult): LocationResult {
  let city: string | null = null;
  let country: string | null = null;
  let q: Quality = 0;

  // Priority 1: JSON-LD address (most reliable)
  if (jsonldResult?.address) {
    if (jsonldResult.address.city) {
      city = jsonldResult.address.city;
    }
    if (jsonldResult.address.country) {
      const raw = jsonldResult.address.country;
      // Handle ISO codes
      country = ISO_TO_COUNTRY[raw.toUpperCase()] || raw;
    }
    if (city || country) {
      q = 1; // Structured data = verifiable
    }
  }

  // Priority 2: City patterns in HTML (if not found via JSON-LD)
  if (!city) {
    // Focus on footer and contact sections
    const footerMatch = html.match(/<footer[\s\S]*?<\/footer>/i);
    const contactMatch = html.match(/<(?:div|section)[^>]*(?:contact|address|footer)[^>]*>[\s\S]*?<\/(?:div|section)>/i);
    const searchHtml = (footerMatch?.[0] || '') + (contactMatch?.[0] || '') + html;

    for (const [pattern, cityName, countryName] of CITY_PATTERNS) {
      if (pattern.test(searchHtml)) {
        city = cityName;
        if (!country) country = countryName;
        q = q || 0.5;
        break;
      }
    }
  }

  // Priority 3: Country patterns
  if (!country) {
    for (const [pattern, countryName] of COUNTRY_PATTERNS) {
      if (pattern.test(html)) {
        country = countryName;
        q = q || 0.5;
        break;
      }
    }
  }

  // Priority 4: Meta geo tags
  if (!country) {
    const geoRegion = html.match(/<meta[^>]*name=["']geo\.region["'][^>]*content=["']([^"']+)["']/i);
    if (geoRegion) {
      const code = geoRegion[1].split('-')[0].toUpperCase();
      country = ISO_TO_COUNTRY[code] || geoRegion[1];
      q = q || 0.5;
    }
  }

  // Priority 5: TLD-based country (last resort)
  if (!country) {
    const tldMatch = html.match(/href=["']https?:\/\/[^"']*\.(\w{2})(?:\/|["'])/i);
    if (tldMatch) {
      const tld = tldMatch[1].toUpperCase();
      if (ISO_TO_COUNTRY[tld] && !['COM', 'ORG', 'NET', 'IO', 'AI', 'CO'].includes(tld)) {
        country = ISO_TO_COUNTRY[tld];
        q = q || 0.5;
      }
    }
  }

  return { city, country, q };
}
