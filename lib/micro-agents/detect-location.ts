// lib/micro-agents/detect-location.ts — Extract city + country from HTML

import type { LocationResult, Quality, JsonLdResult } from './types';

// Country patterns
const COUNTRY_RE: [RegExp, string][] = [
  [/\bswitzerland\b|\bsuisse\b|\bschweiz\b|\bsvizzera\b/i, 'Switzerland'],
  [/\bfrance\b/i, 'France'], [/\bgermany\b|\bdeutschland\b/i, 'Germany'],
  [/\bunited kingdom\b|\bengland\b/i, 'United Kingdom'], [/\bunited states\b|\busa\b/i, 'United States'],
  [/\bitaly\b|\bitalia\b/i, 'Italy'], [/\bspain\b|\bespa[ñn]a\b/i, 'Spain'],
  [/\bnetherlands\b/i, 'Netherlands'], [/\bbelgium\b|\bbelgique\b/i, 'Belgium'],
  [/\baustria\b|\b[öo]sterreich\b/i, 'Austria'], [/\bjapan\b/i, 'Japan'],
  [/\bcanada\b/i, 'Canada'], [/\baustralia\b/i, 'Australia'],
  [/\bsingapore\b/i, 'Singapore'], [/\bindia\b/i, 'India'],
  [/\bbrazil\b|\bbrasil\b/i, 'Brazil'], [/\bportugal\b/i, 'Portugal'],
  [/\bsweden\b/i, 'Sweden'], [/\bnorway\b/i, 'Norway'],
  [/\bdenmark\b/i, 'Denmark'], [/\bfinland\b/i, 'Finland'],
  [/\bireland\b/i, 'Ireland'], [/\bluxembourg\b/i, 'Luxembourg'],
  [/\bpoland\b|\bpolska\b/i, 'Poland'], [/\bczech\b/i, 'Czech Republic'],
  [/\bmexico\b|\bméxico\b/i, 'Mexico'], [/\bsouth africa\b/i, 'South Africa'],
  [/\bchina\b/i, 'China'], [/\bsouth korea\b/i, 'South Korea'],
  [/\bthailand\b/i, 'Thailand'], [/\bindonesia\b/i, 'Indonesia'],
];

const CITY_RE: [RegExp, string, string][] = [
  [/\bgeneva\b|\bgen[èe]ve\b|\bgenf\b/i, 'Geneva', 'Switzerland'],
  [/\bzurich\b|\bz[üu]rich\b/i, 'Zurich', 'Switzerland'],
  [/\bbern\b|\bberne\b/i, 'Bern', 'Switzerland'],
  [/\blausanne\b/i, 'Lausanne', 'Switzerland'],
  [/\bbasel\b|\bb[âa]le\b/i, 'Basel', 'Switzerland'],
  [/\blugano\b/i, 'Lugano', 'Switzerland'],
  [/\bparis\b/i, 'Paris', 'France'], [/\blyon\b/i, 'Lyon', 'France'],
  [/\bmarseille\b/i, 'Marseille', 'France'], [/\btoulouse\b/i, 'Toulouse', 'France'],
  [/\bnantes\b/i, 'Nantes', 'France'], [/\bbordeaux\b/i, 'Bordeaux', 'France'],
  [/\blondon\b/i, 'London', 'United Kingdom'], [/\bmanchester\b/i, 'Manchester', 'United Kingdom'],
  [/\bnew york\b/i, 'New York', 'United States'], [/\bsan francisco\b/i, 'San Francisco', 'United States'],
  [/\blos angeles\b/i, 'Los Angeles', 'United States'], [/\bchicago\b/i, 'Chicago', 'United States'],
  [/\bboston\b/i, 'Boston', 'United States'],
  [/\bberlin\b/i, 'Berlin', 'Germany'], [/\bmunich\b|\bm[üu]nchen\b/i, 'Munich', 'Germany'],
  [/\bhamburg\b/i, 'Hamburg', 'Germany'], [/\bfrankfurt\b/i, 'Frankfurt', 'Germany'],
  [/\bamsterdam\b/i, 'Amsterdam', 'Netherlands'],
  [/\bbrussels\b|\bbruxelles\b/i, 'Brussels', 'Belgium'],
  [/\bvienna\b|\bwien\b/i, 'Vienna', 'Austria'],
  [/\bmadrid\b/i, 'Madrid', 'Spain'], [/\bbarcelona\b|\bbarcelone\b/i, 'Barcelona', 'Spain'],
  [/\brome\b|\broma\b/i, 'Rome', 'Italy'], [/\bmilan\b|\bmilano\b/i, 'Milan', 'Italy'],
  [/\btokyo\b/i, 'Tokyo', 'Japan'], [/\bdubai\b/i, 'Dubai', 'United Arab Emirates'],
  [/\bsydney\b/i, 'Sydney', 'Australia'], [/\btoronto\b/i, 'Toronto', 'Canada'],
  [/\bsingapore\b/i, 'Singapore', 'Singapore'],
];

const ISO_COUNTRY: Record<string, string> = {
  CH:'Switzerland', FR:'France', DE:'Germany', GB:'United Kingdom', UK:'United Kingdom',
  US:'United States', IT:'Italy', ES:'Spain', NL:'Netherlands', BE:'Belgium',
  AT:'Austria', JP:'Japan', CA:'Canada', AU:'Australia', SG:'Singapore',
  IN:'India', BR:'Brazil', PT:'Portugal', SE:'Sweden', NO:'Norway',
  DK:'Denmark', FI:'Finland', IE:'Ireland', LU:'Luxembourg', AE:'United Arab Emirates',
  PL:'Poland', CZ:'Czech Republic', MX:'Mexico', ZA:'South Africa', CN:'China',
  KR:'South Korea', TH:'Thailand', ID:'Indonesia',
};

// ccTLD → country
const TLD_COUNTRY: Record<string, string> = {
  ch:'Switzerland', fr:'France', de:'Germany', uk:'United Kingdom',
  it:'Italy', es:'Spain', nl:'Netherlands', be:'Belgium', at:'Austria',
  jp:'Japan', ca:'Canada', au:'Australia', sg:'Singapore', in:'India',
  br:'Brazil', pt:'Portugal', se:'Sweden', no:'Norway', dk:'Denmark',
  fi:'Finland', ie:'Ireland', lu:'Luxembourg', pl:'Poland', cz:'Czech Republic',
  mx:'Mexico', za:'South Africa', cn:'China', kr:'South Korea', th:'Thailand',
};

export function detectLocation(html: string, jsonldResult?: JsonLdResult, siteUrl?: string): LocationResult {
  let city: string | null = null;
  let country: string | null = null;
  let q: Quality = 0;

  // Priority 1: JSON-LD address
  if (jsonldResult?.address) {
    if (jsonldResult.address.city) city = jsonldResult.address.city;
    if (jsonldResult.address.country) {
      const raw = jsonldResult.address.country;
      country = ISO_COUNTRY[raw.toUpperCase()] || raw;
    }
    if (city || country) q = 1;
  }

  // Priority 2: <address> HTML element
  if (!city) {
    const addrMatch = html.match(/<address[^>]*>([\s\S]*?)<\/address>/i);
    if (addrMatch) {
      const addrText = addrMatch[1].replace(/<[^>]+>/g, ' ').trim();
      for (const [re, cityName, countryName] of CITY_RE) {
        if (re.test(addrText)) { city = cityName; if (!country) country = countryName; q = 1; break; }
      }
    }
  }

  // Priority 3: City in footer/contact sections
  if (!city) {
    const footer = html.match(/<footer[\s\S]*?<\/footer>/i)?.[0] || '';
    const contact = html.match(/<(?:div|section)[^>]*(?:contact|address|footer|coordonn)[^>]*>[\s\S]*?<\/(?:div|section)>/i)?.[0] || '';
    const searchArea = footer + contact;
    if (searchArea) {
      for (const [re, cityName, countryName] of CITY_RE) {
        if (re.test(searchArea)) { city = cityName; if (!country) country = countryName; q = q || 0.5; break; }
      }
    }
  }

  // Priority 4: City in full text (lower confidence)
  if (!city) {
    const text = html.replace(/<[^>]+>/g, ' ');
    for (const [re, cityName, countryName] of CITY_RE) {
      if (re.test(text)) { city = cityName; if (!country) country = countryName; q = q || 0.5; break; }
    }
  }

  // Priority 5: Country patterns in text
  if (!country) {
    const text = html.replace(/<[^>]+>/g, ' ');
    for (const [re, countryName] of COUNTRY_RE) {
      if (re.test(text)) { country = countryName; q = q || 0.5; break; }
    }
  }

  // Priority 6: Country from context clues ("entreprises suisses", "Swiss company", etc.)
  if (!country) {
    if (/entreprises?\s+suisses?|swiss\s+compan|based\s+in\s+switzerland/i.test(html)) {
      country = 'Switzerland'; q = q || 0.5;
    }
  }

  // Priority 7: html lang attribute
  if (!country) {
    const langMatch = html.match(/<html[^>]*lang=["']([a-z]{2})(?:-([A-Z]{2}))?["']/i);
    if (langMatch?.[2]) {
      country = ISO_COUNTRY[langMatch[2]] || null;
      if (country) q = q || 0.5;
    }
  }

  // Priority 8: Site's own TLD
  if (!country && siteUrl) {
    const tldMatch = siteUrl.match(/\.([a-z]{2})(?:\/|$)/i);
    if (tldMatch) {
      const tld = tldMatch[1].toLowerCase();
      if (TLD_COUNTRY[tld]) { country = TLD_COUNTRY[tld]; q = q || 0.5; }
    }
  }

  // Priority 9: Meta geo.region
  if (!country) {
    const geoRegion = html.match(/<meta[^>]*name=["']geo\.region["'][^>]*content=["']([^"']+)["']/i);
    if (geoRegion) {
      const code = geoRegion[1].split('-')[0].toUpperCase();
      country = ISO_COUNTRY[code] || null;
      if (country) q = q || 0.5;
    }
  }

  return { city, country, q };
}
