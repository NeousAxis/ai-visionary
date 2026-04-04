// lib/micro-agents/orchestrator.ts — Run all 7 agents, merge into AyoExtract

import { fetchHtml } from './html-fetcher';
import { detectContact } from './detect-contact';
import { detectJsonLd } from './detect-jsonld';
import { detectLocation } from './detect-location';
import { detectServices } from './detect-services';
import { detectLegal } from './detect-legal';
import { detectSecurity } from './detect-security';
import { detectSocial } from './detect-social';
import type { AllAgentResults, AgentEvent, AgentName, FetchResult } from './types';
import type { AyoExtract, Quality } from '../aio-score-engine';

// Helper to create a FieldNode
function field<T>(value: T, q: Quality, evidence: string[] = []): { value: T; q: Quality; evidence: string[] } {
  return { value, q, evidence };
}

/**
 * Run a single agent with timing and error handling.
 * Returns an AgentEvent for SSE streaming.
 */
async function runAgent<T>(
  name: AgentName,
  fn: () => T | Promise<T>,
): Promise<{ event: AgentEvent; result: T | null }> {
  const start = Date.now();
  try {
    const result = await fn();
    return {
      event: {
        agent: name,
        status: 'done',
        data: result as any,
        durationMs: Date.now() - start,
      },
      result,
    };
  } catch (err) {
    return {
      event: {
        agent: name,
        status: 'error',
        data: null,
        durationMs: Date.now() - start,
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      result: null,
    };
  }
}

/**
 * Run all 7 micro-agents in parallel.
 * Calls onEvent for each agent as it completes (for SSE streaming).
 */
export async function runAllAgents(
  url: string,
  onEvent?: (event: AgentEvent) => void,
): Promise<{ fetchResult: FetchResult; results: AllAgentResults; events: AgentEvent[] }> {
  // Step 1: Fetch HTML
  const fetchResult = await fetchHtml(url);
  const { html, headers } = fetchResult;

  if (!fetchResult.isReachable) {
    const errorEvent: AgentEvent = {
      agent: 'detect-contact',
      status: 'error',
      data: null,
      durationMs: 0,
      error: 'Site unreachable',
    };
    onEvent?.(errorEvent);
    return {
      fetchResult,
      results: emptyResults(),
      events: [errorEvent],
    };
  }

  // Step 2: Run all agents in parallel
  const agentPromises = [
    runAgent('detect-jsonld', () => detectJsonLd(html)),
    runAgent('detect-contact', () => detectContact(html)),
    runAgent('detect-services', () => detectServices(html)),
    runAgent('detect-legal', () => detectLegal(html)),
    runAgent('detect-security', () => detectSecurity(html, headers)),
    runAgent('detect-social', () => detectSocial(html)),
  ] as const;

  // Run JSON-LD first (location depends on it), then location
  const [jsonldRun, contactRun, servicesRun, legalRun, securityRun, socialRun] =
    await Promise.all(agentPromises);

  // Location uses JSON-LD results + site URL
  const locationRun = await runAgent('detect-location', () =>
    detectLocation(html, jsonldRun.result || undefined, fetchResult.url)
  );

  // Emit events
  const allRuns = [jsonldRun, contactRun, locationRun, servicesRun, legalRun, securityRun, socialRun];
  const events: AgentEvent[] = [];

  for (const run of allRuns) {
    events.push(run.event);
    onEvent?.(run.event);
  }

  const results: AllAgentResults = {
    contact: contactRun.result || { email: null, phone: null, q: 0 },
    services: servicesRun.result || { services: [], products: [], q: 0 },
    legal: legalRun.result || { policies: [], frameworks: [], certifications: [], urls: [], q: 0 },
    location: locationRun.result || { city: null, country: null, q: 0 },
    security: securityRun.result || { measures: [], q: 0 },
    jsonld: jsonldRun.result || { schemas: [], type: null, name: null, description: null, address: null, contactPoint: null, hasOrganizationType: false, hasFaqSchema: false, q: 0 },
    social: socialRun.result || { links: [], platforms: [], q: 0 },
  };

  return { fetchResult, results, events };
}

/**
 * Merge all agent results into AyoExtract format.
 * Compatible with computeAioScore() and all generators.
 */
export function mergeAgentResultsToExtract(
  url: string,
  fetchResult: FetchResult,
  results: AllAgentResults,
): AyoExtract {
  const { contact, services, legal, location, security, jsonld, social } = results;

  // Determine name: prefer JSON-LD, fallback to meta title
  const metaTitleMatch = fetchResult.html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const name = jsonld.name || (metaTitleMatch ? metaTitleMatch[1].trim() : '');

  // Determine business type from JSON-LD
  const businessType = jsonld.type || '';

  // City/country: merge JSON-LD + location agent
  const city = location.city || jsonld.address?.city || '';
  const country = location.country || jsonld.address?.country || '';

  // Contact: merge contact agent + JSON-LD contactPoint
  const email = contact.email || jsonld.contactPoint?.email || '';
  const phone = contact.phone || jsonld.contactPoint?.phone || '';

  // FAQ detection
  const hasFaqLink = /href=["'][^"']*faq[^"']*["']/i.test(fetchResult.html);
  const hasFaqText = /foire aux questions|frequently asked questions/i.test(fetchResult.html);
  const hasFaqContent = hasFaqLink || hasFaqText || jsonld.hasFaqSchema;

  // Sitemap check (quick regex in HTML or common paths)
  const hasSitemap = /sitemap\.xml/i.test(fetchResult.html);

  // Mobile optimized (viewport meta)
  const hasMobileViewport = /meta[^>]*name=["']viewport["']/i.test(fetchResult.html);

  // ASR file check
  const hasAsr = false; // Would need separate HEAD request, default false

  // Glossary/documentation detection
  const hasGlossary = /glossar|lexique|glossaire/i.test(fetchResult.html);
  const hasDocumentation = /documentation|docs\b|developer|api.?reference/i.test(fetchResult.html);

  return {
    version: 'AYO-EXTRACT-3.0',
    source: {
      url,
      scan: {
        is_reachable: fetchResult.isReachable,
        has_jsonld: jsonld.hasOrganizationType,
        jsonld_count: jsonld.schemas.length,
        has_asr_file: hasAsr,
        has_faq_content: hasFaqContent,
        has_faq_schema: jsonld.hasFaqSchema,
      },
    },
    fields: {
      identite: {
        name: field(name, name ? 1 : 0, name ? ['scan_micro_agent'] : []),
        legal_name: field('', 0, []),
        business_type: field(businessType, businessType ? 1 : 0, businessType ? ['scan_micro_agent'] : []),
        city: field(city, location.q, city ? ['scan_micro_agent'] : []),
        country: field(country, location.q, country ? ['scan_micro_agent'] : []),
        contact_email: field(email, email ? 1 : 0, email ? ['scan_micro_agent'] : []),
        contact_phone: field(phone, phone ? 0.5 : 0, phone ? ['scan_micro_agent'] : []),
      },
      offre: {
        services: field(services.services, services.q, services.services.length ? ['scan_micro_agent'] : []),
        products: field(services.products, services.products.length ? services.q : 0, services.products.length ? ['scan_micro_agent'] : []),
        use_cases: field([], 0, []),
        target_audience: field('', 0, []),
        pricing_indication: field('', 0, []),
      },
      processus_methodes: {
        process_steps: field([], 0, []),
        delivery_mode: field('', 0, []),
        geographies_served: field('', 0, []),
        quality_assurance: field('', 0, []),
      },
      engagements_conformite: {
        policies: field(legal.policies, legal.policies.length ? legal.q : 0, legal.policies.length ? ['scan_micro_agent'] : []),
        frameworks: field(legal.frameworks, legal.frameworks.length ? legal.q : 0, legal.frameworks.length ? ['scan_micro_agent'] : []),
        certifications: field(legal.certifications, legal.certifications.length ? 1 : 0, legal.certifications.length ? ['scan_micro_agent'] : []),
        security_measures: field(security.measures, security.q, security.measures.length ? ['scan_micro_agent'] : []),
      },
      indicateurs: {
        key_indicators: field([], 0, []),
        last_review_date: field('', 0, []),
      },
      contenus_pedagogiques: {
        has_faq: field(hasFaqContent, hasFaqContent ? 1 : 0, hasFaqContent ? ['scan_micro_agent'] : []),
        has_glossary: field(hasGlossary, hasGlossary ? 0.5 : 0, hasGlossary ? ['scan_micro_agent'] : []),
        has_documentation: field(hasDocumentation, hasDocumentation ? 0.5 : 0, hasDocumentation ? ['scan_micro_agent'] : []),
      },
      structure_technique: {
        has_asr: field(hasAsr, 0, []),
        has_jsonld: field(jsonld.hasOrganizationType, jsonld.hasOrganizationType ? 1 : 0, jsonld.hasOrganizationType ? ['scan_micro_agent'] : []),
        has_sitemap: field(hasSitemap, hasSitemap ? 0.5 : 0, hasSitemap ? ['scan_micro_agent'] : []),
        mobile_optimized: field(hasMobileViewport, hasMobileViewport ? 1 : 0, hasMobileViewport ? ['scan_micro_agent'] : []),
      },
      contextual_signals: {
        pricing_level: field('', 0, []),
        access_mode: field('', 0, []),
        service_mode: field([], 0, []),
        schedule_type: field([], 0, []),
      },
      recommandation: {
        contextual_relevance: field([], 0, []),
        selection_conditions: field({ required: [], exclusion: [] }, 0, []),
        ai_simulation: field([], 0, []),
      },
    },
  };
}

function emptyResults(): AllAgentResults {
  return {
    contact: { email: null, phone: null, q: 0 },
    services: { services: [], products: [], q: 0 },
    legal: { policies: [], frameworks: [], certifications: [], urls: [], q: 0 },
    location: { city: null, country: null, q: 0 },
    security: { measures: [], q: 0 },
    jsonld: { schemas: [], type: null, name: null, description: null, address: null, contactPoint: null, hasOrganizationType: false, hasFaqSchema: false, q: 0 },
    social: { links: [], platforms: [], q: 0 },
  };
}
