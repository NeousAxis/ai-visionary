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

  // Prepare clean text for LLM agents (strip HTML tags)
  const textContent = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Step 2: Run agents SEQUENTIALLY — so the client sees each one work in real-time
  const events: AgentEvent[] = [];

  // Agent 1: JSON-LD (deterministic, fast)
  onEvent?.({ agent: 'detect-jsonld', status: 'running', data: null, durationMs: 0 });
  const jsonldRun = await runAgent('detect-jsonld', () => detectJsonLd(html));
  events.push(jsonldRun.event);
  onEvent?.(jsonldRun.event);

  // Agent 2: Contact (LLM)
  onEvent?.({ agent: 'detect-contact', status: 'running', data: null, durationMs: 0 });
  const contactRun = await runAgent('detect-contact', () => detectContact(textContent));
  events.push(contactRun.event);
  onEvent?.(contactRun.event);

  // Agent 3: Location (LLM)
  onEvent?.({ agent: 'detect-location', status: 'running', data: null, durationMs: 0 });
  const locationRun = await runAgent('detect-location', () =>
    detectLocation(textContent, jsonldRun.result || undefined, fetchResult.url)
  );
  events.push(locationRun.event);
  onEvent?.(locationRun.event);

  // Agent 4: Services (LLM)
  onEvent?.({ agent: 'detect-services', status: 'running', data: null, durationMs: 0 });
  const servicesRun = await runAgent('detect-services', () => detectServices(textContent));
  events.push(servicesRun.event);
  onEvent?.(servicesRun.event);

  // Agent 5: Legal/Compliance (LLM)
  onEvent?.({ agent: 'detect-legal', status: 'running', data: null, durationMs: 0 });
  const legalRun = await runAgent('detect-legal', () => detectLegal(textContent));
  events.push(legalRun.event);
  onEvent?.(legalRun.event);

  // Agent 6: Security (deterministic headers + LLM content)
  onEvent?.({ agent: 'detect-security', status: 'running', data: null, durationMs: 0 });
  const securityRun = await runAgent('detect-security', () => detectSecurity(textContent, headers));
  events.push(securityRun.event);
  onEvent?.(securityRun.event);

  // Agent 7: Social (deterministic, fast)
  onEvent?.({ agent: 'detect-social', status: 'running', data: null, durationMs: 0 });
  const socialRun = await runAgent('detect-social', () => detectSocial(html));
  events.push(socialRun.event);
  onEvent?.(socialRun.event);

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
export async function mergeAgentResultsToExtract(
  url: string,
  fetchResult: FetchResult,
  results: AllAgentResults,
): Promise<AyoExtract> {
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

  const rawHtml = fetchResult.html;
  const plainText = rawHtml
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();

  // --- FAQ / Glossary / Doc / Sitemap / Mobile = DETERMINISTE (regex sur HTML) ---
  const hasFaqContent = jsonld.hasFaqSchema ||
    /href=["'][^"']*faq[^"']*["']/i.test(rawHtml) ||
    /id=["']faq["']/i.test(rawHtml) ||
    /foire aux questions|frequently asked questions/i.test(plainText);
  const hasGlossary = /glossar|lexique|glossaire/i.test(rawHtml) ||
    /id=["']glossary["']/i.test(rawHtml);
  const hasDocumentation = /documentation|id=["']docs["']|developer.?guide|api.?reference|tutoriel/i.test(rawHtml);
  const hasSitemap = /sitemap\.xml/i.test(rawHtml);
  const hasMobileViewport = /meta[^>]*name=["']viewport["']/i.test(rawHtml);

  // --- Process & Indicators = LLM cible (1 petite mission) ---
  let processSteps: string[] = [];
  let deliveryMode = '';
  let geographies = country || '';
  let qaText = '';
  let indicators: string[] = [];

  try {
    const { llmExtract, parseJson } = await import('./llm-agent');
    const raw = await llmExtract(
      `Extract business methodology and key metrics. Content can be in ANY language.
- process_steps: methodology steps or workflow phases (max 6)
- delivery_mode: "online", "on-site", or "hybrid"
- geographies: operating regions
- quality_assurance: quality monitoring mention
- indicators: key numbers with context (e.g. "5 years", "200+ clients")
Return ONLY JSON: {"process_steps":[],"delivery_mode":"","geographies":"","quality_assurance":"","indicators":[]}
Do NOT invent.`,
      plainText, 10000,
    );
    const data = parseJson<{
      process_steps?: string[];
      delivery_mode?: string;
      geographies?: string;
      quality_assurance?: string;
      indicators?: string[];
    }>(raw);
    if (data) {
      processSteps = data.process_steps || [];
      deliveryMode = data.delivery_mode || '';
      if (data.geographies) geographies = data.geographies;
      qaText = data.quality_assurance || '';
      indicators = data.indicators || [];
    }
  } catch { /* fallback: empty */ }

  // ASR file check — HEAD request to /.ayo/asr.json
  let hasAsr = false;
  try {
    const asrUrl = new URL(url);
    asrUrl.pathname = '/.ayo/asr.json';
    const asrRes = await fetch(asrUrl.toString(), {
      method: 'HEAD',
      headers: { 'User-Agent': 'AYO-Bot/2.0' },
      signal: AbortSignal.timeout(3000),
    });
    hasAsr = asrRes.ok;
  } catch { /* ignore */ }

  // AYA Registry check — is this site already registered?
  let isAyaRegistered = false;
  try {
    const { db } = await import('../db');
    const ayaEntity = await db.getAyaEntityByUrl(url);
    console.log(`[orchestrator] AYA lookup for ${url}: ${ayaEntity ? 'FOUND (score:' + ayaEntity.asr_score + ', paid:' + ayaEntity.payment_completed + ')' : 'NOT FOUND'}`);
    if (ayaEntity && ayaEntity.payment_completed) {
      isAyaRegistered = true;
      // AYA hosts JSON-LD + ASR for certified entities
      hasAsr = true;
    }
  } catch (err) {
    console.error(`[orchestrator] AYA lookup FAILED for ${url}:`, err instanceof Error ? err.message : err);
  }

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
        is_aya_registered: isAyaRegistered,
      },
    },
    fields: {
      identite: {
        name: field(name, name ? 1 : 0, name ? ['scan_micro_agent'] : []),
        legal_name: field('', 0, []),
        business_type: field(businessType, businessType ? 1 : 0, businessType ? ['scan_micro_agent'] : []),
        city: field(city, location.q, city ? ['scan_micro_agent'] : []),
        country: field(country, location.q, country ? ['scan_micro_agent'] : []),
        // Email OR contact form = valid contact method (anti-spam = normal)
        contact_email: field(
          email || ((contact as any).hasContactForm ? 'contact_form' : ''),
          email ? 1 : (contact as any).hasContactForm ? 0.5 : 0,
          email ? ['scan_micro_agent'] : (contact as any).hasContactForm ? ['scan_micro_agent_form'] : []
        ),
        contact_phone: field(phone, phone ? 0.5 : 0, phone ? ['scan_micro_agent'] : []),
      },
      offre: {
        services: field(services.services, services.q, services.services.length ? ['scan_micro_agent'] : []),
        products: field(services.products, services.products.length ? services.q : 0, services.products.length ? ['scan_micro_agent'] : []),
        use_cases: field(
          (services as any).use_cases || [],
          (services as any).use_cases?.length ? 0.5 : 0,
          (services as any).use_cases?.length ? ['scan_micro_agent'] : []
        ),
        target_audience: field(
          (services as any).target_audience || '',
          (services as any).target_audience ? 0.5 : 0,
          (services as any).target_audience ? ['scan_micro_agent'] : []
        ),
        pricing_indication: field(
          (services as any).pricing || '',
          (services as any).pricing ? 0.5 : 0,
          (services as any).pricing ? ['scan_micro_agent'] : []
        ),
      },
      processus_methodes: {
        process_steps: field(processSteps, processSteps.length > 0 ? 1 : 0, processSteps.length ? ['scan_micro_agent'] : []),
        delivery_mode: field(deliveryMode, deliveryMode ? 0.5 : 0, deliveryMode ? ['scan_micro_agent'] : []),
        geographies_served: field(geographies, geographies ? 0.5 : 0, geographies ? ['scan_micro_agent'] : []),
        quality_assurance: field(qaText, qaText ? 0.5 : 0, qaText ? ['scan_micro_agent'] : []),
      },
      engagements_conformite: {
        policies: field(legal.policies, legal.policies.length ? legal.q : 0, legal.policies.length ? ['scan_micro_agent'] : []),
        frameworks: field(legal.frameworks, legal.frameworks.length ? legal.q : 0, legal.frameworks.length ? ['scan_micro_agent'] : []),
        certifications: field(legal.certifications, legal.certifications.length ? 1 : 0, legal.certifications.length ? ['scan_micro_agent'] : []),
        security_measures: field(security.measures, security.q, security.measures.length ? ['scan_micro_agent'] : []),
      },
      indicateurs: {
        key_indicators: field(indicators, indicators.length > 0 ? 0.5 : 0, indicators.length ? ['scan_micro_agent'] : []),
        last_review_date: field('', 0, []),
      },
      contenus_pedagogiques: {
        has_faq: field(hasFaqContent, hasFaqContent ? 1 : 0, hasFaqContent ? ['scan_micro_agent'] : []),
        // These penalize the initial score — but AYO PRO generates them, so the Compare
        // section shows the score BOOST when these files are added
        has_glossary: field(hasGlossary, hasGlossary ? 1 : 0, hasGlossary ? ['scan_micro_agent'] : []),
        has_documentation: field(hasDocumentation, hasDocumentation ? 1 : 0, hasDocumentation ? ['scan_micro_agent'] : []),
      },
      structure_technique: {
        // has_asr = fichier ASR physique sur le site (PRO uniquement)
        // is_aya_registered = dans le registre AYA (AYA ou PRO) — géré séparément par le score engine
        has_asr: field(hasAsr, hasAsr ? 1 : 0, hasAsr ? ['scan_micro_agent'] : []),
        has_jsonld: field(jsonld.hasOrganizationType || isAyaRegistered, (jsonld.hasOrganizationType || isAyaRegistered) ? 1 : 0, isAyaRegistered ? ['aya_registry'] : jsonld.hasOrganizationType ? ['scan_micro_agent'] : []),
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
