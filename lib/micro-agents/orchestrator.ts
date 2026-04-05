// lib/micro-agents/orchestrator.ts — Run all 8 agents, merge into AyoExtract

import { fetchHtml } from './html-fetcher';
import { detectContact } from './detect-contact';
import { detectJsonLd } from './detect-jsonld';
import { detectLocation } from './detect-location';
import { detectServices } from './detect-services';
import { detectLegal } from './detect-legal';
import { detectSecurity } from './detect-security';
import { detectSocial } from './detect-social';
import { detectPedagogy } from './detect-pedagogy';
import type { AllAgentResults, AgentEvent, AgentName, FetchResult, ServicesResult, LegalResult } from './types';
import type { AyoExtract, Quality } from '../aio-score-engine';

// --- Shared utility ---

function stripHtml(html: string): string {
  return html
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
}

// --- Retry+Merge helpers (stabilize LLM variance) ---

function unionStrings(a: string[], b: string[]): string[] {
  const seen = new Map<string, string>();
  for (const s of [...a, ...b]) {
    const key = s.toLowerCase().trim();
    if (key && !seen.has(key)) seen.set(key, s);
  }
  return Array.from(seen.values());
}

function keepLongest(a: string, b: string): string {
  if (!a) return b;
  if (!b) return a;
  return a.length >= b.length ? a : b;
}

/** Merge two ServicesResult (including target_audience, use_cases, pricing). */
function mergeServices(a: ServicesResult, b: ServicesResult): ServicesResult {
  return {
    services: unionStrings(a.services, b.services),
    products: unionStrings(a.products, b.products),
    target_audience: keepLongest(a.target_audience || '', b.target_audience || ''),
    use_cases: unionStrings(a.use_cases || [], b.use_cases || []),
    pricing: keepLongest(a.pricing || '', b.pricing || ''),
    q: Math.max(a.q, b.q) as Quality,
  };
}

/** Merge two LegalResult. */
function mergeLegal(a: LegalResult, b: LegalResult): LegalResult {
  return {
    policies: unionStrings(a.policies, b.policies),
    frameworks: unionStrings(a.frameworks, b.frameworks),
    certifications: unionStrings(a.certifications, b.certifications),
    urls: unionStrings(a.urls, b.urls),
    q: Math.max(a.q, b.q) as Quality,
  };
}

/**
 * Run an agent 2x in parallel and merge results to stabilize LLM variance.
 */
async function runAgentWithRetry<T>(
  name: AgentName,
  fn: () => Promise<T>,
  merge: (a: T, b: T) => T,
): Promise<{ result: T | null; event: AgentEvent }> {
  const start = Date.now();
  try {
    const [r1, r2, r3] = await Promise.all([fn(), fn(), fn()]);
    const merged = merge(merge(r1, r2), r3);
    const ms = Date.now() - start;
    console.log(`[retry-merge] ${name}: merged 3 results in ${ms}ms`);
    return {
      result: merged,
      event: { agent: name, status: 'done', data: merged as any, durationMs: ms },
    };
  } catch (err) {
    const ms = Date.now() - start;
    return {
      result: null,
      event: { agent: name, status: 'error', data: null, durationMs: ms, error: err instanceof Error ? err.message : String(err) },
    };
  }
}

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
 * Run all 8 micro-agents sequentially.
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
  const textContent = stripHtml(html);

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

  // Agent 4: Services (LLM) — retry+merge for stability
  onEvent?.({ agent: 'detect-services', status: 'running', data: null, durationMs: 0 });
  const servicesRun = await runAgentWithRetry('detect-services', () => detectServices(textContent), mergeServices);
  events.push(servicesRun.event);
  onEvent?.(servicesRun.event);

  // Agent 5: Legal/Compliance (LLM) — retry+merge for stability
  onEvent?.({ agent: 'detect-legal', status: 'running', data: null, durationMs: 0 });
  const legalRun = await runAgentWithRetry('detect-legal', () => detectLegal(textContent), mergeLegal);
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

  // Agent 8: Pedagogy — FAQ, Glossary, Documentation (LLM + HEAD fallback for SPA sites)
  onEvent?.({ agent: 'detect-pedagogy', status: 'running', data: null, durationMs: 0 });
  const pedagogyRun = await runAgent('detect-pedagogy', () => detectPedagogy(html, fetchResult.url));
  events.push(pedagogyRun.event);
  onEvent?.(pedagogyRun.event);

  const results: AllAgentResults = {
    contact: contactRun.result || { email: null, phone: null, q: 0 },
    services: servicesRun.result || { services: [], products: [], q: 0 },
    legal: legalRun.result || { policies: [], frameworks: [], certifications: [], urls: [], q: 0 },
    location: locationRun.result || { city: null, country: null, q: 0 },
    security: securityRun.result || { measures: [], q: 0 },
    jsonld: jsonldRun.result || { schemas: [], type: null, name: null, description: null, address: null, contactPoint: null, hasOrganizationType: false, hasFaqSchema: false, q: 0 },
    social: socialRun.result || { links: [], platforms: [], q: 0 },
    pedagogy: pedagogyRun.result || { has_faq: false, has_glossary: false, has_documentation: false, q: 0 },
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

  // Determine business type: JSON-LD first, then infer from services/content
  let businessType = jsonld.type || '';
  if (!businessType && services.services.length > 0) {
    const svcText = services.services.join(' ').toLowerCase();
    if (/consulting|conseil|advisory|accompagnement|stratégie/i.test(svcText)) businessType = 'ConsultingFirm';
    else if (/website|web|app|software|développement|development|saas|platform/i.test(svcText)) businessType = 'TechnologyCompany';
    else if (/design|graphi|créati|branding|ux|ui/i.test(svcText)) businessType = 'DesignAgency';
    else if (/marketing|communication|pub|seo|social media/i.test(svcText)) businessType = 'MarketingAgency';
    else if (/formation|training|coaching|education|cours/i.test(svcText)) businessType = 'EducationalOrganization';
    else if (/legal|juridique|avocat|droit|compliance/i.test(svcText)) businessType = 'LegalService';
    else if (/health|santé|medical|pharma|clinic/i.test(svcText)) businessType = 'MedicalBusiness';
    else if (/finance|bank|assurance|investissement/i.test(svcText)) businessType = 'FinancialService';
    else businessType = 'ProfessionalService';
  }

  // City/country: merge JSON-LD + location agent
  const city = location.city || jsonld.address?.city || '';
  const country = location.country || jsonld.address?.country || '';

  // Contact: merge contact agent + JSON-LD contactPoint
  const email = contact.email || jsonld.contactPoint?.email || '';
  const phone = contact.phone || jsonld.contactPoint?.phone || '';

  const plainText = stripHtml(fetchResult.html);

  // --- FAQ / Glossary / Doc = via detect-pedagogy LLM agent (merged with JSON-LD schema) ---
  const { pedagogy } = results;
  const hasFaqContent = jsonld.hasFaqSchema || pedagogy.has_faq;
  const hasGlossary = pedagogy.has_glossary;
  const hasDocumentation = pedagogy.has_documentation;
  // --- Sitemap / Mobile = DETERMINISTE (regex sur HTML — detection technique pure) ---
  const hasSitemap = /sitemap\.xml/i.test(fetchResult.html);
  const hasMobileViewport = /meta[^>]*name=["']viewport["']/i.test(fetchResult.html);

  // --- Process & Indicators = LLM cible (1 petite mission) ---
  let processSteps: string[] = [];
  let deliveryMode = '';
  let geographies = country || '';
  let qaText = '';
  let indicators: string[] = [];

  try {
    const { llmExtract, parseJson } = await import('./llm-agent');
    const processPrompt = `Extract business methodology and key metrics. Content can be in ANY language.
- process_steps: methodology steps or workflow phases (max 6)
- delivery_mode: "online", "on-site", or "hybrid"
- geographies: operating regions
- quality_assurance: quality monitoring mention
- indicators: key numbers with context (e.g. "5 years", "200+ clients")
Return ONLY JSON: {"process_steps":[],"delivery_mode":"","geographies":"","quality_assurance":"","indicators":[]}
Do NOT invent.`;

    // Retry+merge: 2 parallel LLM calls to stabilize variance
    type ProcessData = {
      process_steps?: string[];
      delivery_mode?: string;
      geographies?: string;
      quality_assurance?: string;
      indicators?: string[];
    };
    const [raw1, raw2, raw3] = await Promise.all([
      llmExtract(processPrompt, plainText, 10000).catch(() => '{}'),
      llmExtract(processPrompt, plainText, 10000).catch(() => '{}'),
      llmExtract(processPrompt, plainText, 10000).catch(() => '{}'),
    ]);
    const data1 = parseJson<ProcessData>(raw1);
    const data2 = parseJson<ProcessData>(raw2);
    const data3 = parseJson<ProcessData>(raw3);
    console.log('[retry-merge] process/indicators: merged 3 results');

    processSteps = unionStrings(unionStrings(data1?.process_steps || [], data2?.process_steps || []), data3?.process_steps || []);
    deliveryMode = keepLongest(keepLongest(data1?.delivery_mode || '', data2?.delivery_mode || ''), data3?.delivery_mode || '');
    if (data1?.geographies || data2?.geographies || data3?.geographies) geographies = keepLongest(keepLongest(data1?.geographies || '', data2?.geographies || ''), data3?.geographies || '');
    qaText = keepLongest(keepLongest(data1?.quality_assurance || '', data2?.quality_assurance || ''), data3?.quality_assurance || '');
    indicators = unionStrings(unionStrings(data1?.indicators || [], data2?.indicators || []), data3?.indicators || []);
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
          email || (contact.hasContactForm ? 'contact_form' : ''),
          email ? 1 : contact.hasContactForm ? 0.5 : 0,
          email ? ['scan_micro_agent'] : contact.hasContactForm ? ['scan_micro_agent_form'] : []
        ),
        contact_phone: field(phone, phone ? 1 : 0, phone ? ['scan_micro_agent'] : []),
      },
      offre: {
        services: field(services.services, services.q, services.services.length ? ['scan_micro_agent'] : []),
        products: field(services.products, services.products.length ? services.q : 0, services.products.length ? ['scan_micro_agent'] : []),
        // Found on site = verifiable = q:1
        use_cases: field(
          services.use_cases || [],
          services.use_cases?.length ? 1 : 0,
          services.use_cases?.length ? ['scan_micro_agent'] : []
        ),
        target_audience: field(
          services.target_audience || '',
          services.target_audience ? 1 : 0,
          services.target_audience ? ['scan_micro_agent'] : []
        ),
        pricing_indication: field(
          services.pricing || '',
          services.pricing ? 1 : 0,
          services.pricing ? ['scan_micro_agent'] : []
        ),
      },
      processus_methodes: {
        process_steps: field(processSteps, processSteps.length > 0 ? 1 : 0, processSteps.length ? ['scan_micro_agent'] : []),
        delivery_mode: field(deliveryMode, deliveryMode ? 1 : 0, deliveryMode ? ['scan_micro_agent'] : []),
        geographies_served: field(geographies, geographies ? 1 : 0, geographies ? ['scan_micro_agent'] : []),
        quality_assurance: field(qaText, qaText ? 1 : 0, qaText ? ['scan_micro_agent'] : []),
      },
      engagements_conformite: {
        policies: field(legal.policies, legal.policies.length ? legal.q : 0, legal.policies.length ? ['scan_micro_agent'] : []),
        frameworks: field(legal.frameworks, legal.frameworks.length ? legal.q : 0, legal.frameworks.length ? ['scan_micro_agent'] : []),
        certifications: field(legal.certifications, legal.certifications.length ? 1 : 0, legal.certifications.length ? ['scan_micro_agent'] : []),
        security_measures: field(security.measures, security.q, security.measures.length ? ['scan_micro_agent'] : []),
      },
      indicateurs: {
        key_indicators: field(indicators, indicators.length > 0 ? 1 : 0, indicators.length ? ['scan_micro_agent'] : []),
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
    pedagogy: { has_faq: false, has_glossary: false, has_documentation: false, q: 0 },
  };
}
