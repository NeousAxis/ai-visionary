// lib/micro-agents/detect-jsonld.ts — Parse JSON-LD structured data

import type { JsonLdResult, Quality } from './types';

const JSONLD_REGEX = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

const ENTITY_TYPES = [
  'organization', 'localbusiness', 'corporation',
  'professionalservice', 'store', 'medicalbusiness',
  'restaurant', 'hotel', 'sportsactivitylocation',
  'educationalorganization', 'governmentorganization',
  'ngo', 'airline', 'autodealer',
];

export function detectJsonLd(html: string): JsonLdResult {
  const result: JsonLdResult = {
    schemas: [],
    type: null,
    name: null,
    description: null,
    address: null,
    contactPoint: null,
    hasOrganizationType: false,
    hasFaqSchema: false,
    q: 0,
  };

  let match;
  const regex = new RegExp(JSONLD_REGEX.source, JSONLD_REGEX.flags);

  while ((match = regex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      result.schemas.push(data);

      const typeLower = (data['@type'] || '').toString().toLowerCase();

      // Check for entity type
      if (ENTITY_TYPES.some(t => typeLower.includes(t))) {
        result.hasOrganizationType = true;
        result.type = data['@type'];
        result.name = data.name || data.legalName || null;
        result.description = data.description || null;

        // Extract address
        if (data.address) {
          const addr = typeof data.address === 'string'
            ? { city: null, country: data.address }
            : {
                city: data.address.addressLocality || null,
                country: data.address.addressCountry || null,
              };
          result.address = addr;
        }

        // Extract contact
        if (data.contactPoint) {
          const cp = Array.isArray(data.contactPoint) ? data.contactPoint[0] : data.contactPoint;
          result.contactPoint = {
            email: cp.email || data.email || null,
            phone: cp.telephone || data.telephone || null,
          };
        } else if (data.email || data.telephone) {
          result.contactPoint = {
            email: data.email || null,
            phone: data.telephone || null,
          };
        }
      }

      // Check for FAQ
      if (typeLower === 'faqpage' || typeLower.includes('faqpage')) {
        result.hasFaqSchema = true;
      }

      // Handle @graph arrays
      if (data['@graph'] && Array.isArray(data['@graph'])) {
        for (const item of data['@graph']) {
          const itemType = (item['@type'] || '').toString().toLowerCase();
          if (ENTITY_TYPES.some(t => itemType.includes(t))) {
            result.hasOrganizationType = true;
            if (!result.name) result.name = item.name || null;
            if (!result.type) result.type = item['@type'];
            if (item.address && !result.address) {
              result.address = typeof item.address === 'string'
                ? { country: item.address }
                : {
                    city: item.address.addressLocality || null,
                    country: item.address.addressCountry || null,
                  };
            }
          }
          if (itemType === 'faqpage') {
            result.hasFaqSchema = true;
          }
        }
      }
    } catch {
      // Ignore JSON parse errors
    }
  }

  // Set quality
  if (result.hasOrganizationType && result.name) {
    result.q = 1;
  } else if (result.schemas.length > 0) {
    result.q = 0.5;
  }

  return result;
}
