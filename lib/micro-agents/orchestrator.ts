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

  const html = fetchResult.html;
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  // --- FAQ detection ---
  const hasFaqLink = /href=["'][^"']*faq[^"']*["']/i.test(html);
  const hasFaqText = /foire aux questions|frequently asked questions|FAQ/i.test(text);
  const hasFaqContent = hasFaqLink || hasFaqText || jsonld.hasFaqSchema;

  // --- Process & Methods extraction (from text content) ---
  const processSteps: string[] = [];
  // Look for numbered steps or methodology sections
  const stepPatterns = [
    /(?:étape|step|phase)\s*[:\s]*(\d+)\s*[:\s.\-–—]+\s*([^\n.]{5,80})/gi,
    /^0*(\d+)\s*[.\-–—:]\s*([A-ZÀ-Ü][^\n]{5,80})/gm,
  ];
  for (const pattern of stepPatterns) {
    let m;
    const re = new RegExp(pattern.source, pattern.flags);
    while ((m = re.exec(text)) !== null) {
      const step = (m[2] || m[1]).trim();
      if (step.length > 3 && !processSteps.includes(step)) processSteps.push(step);
    }
  }
  // Also extract h3 headings from methodology-like sections
  const methSections = html.match(/(?:approche|methode|methodology|process|démarche|notre approche|how we work|comment)[\s\S]{0,3000}/gi) || [];
  for (const section of methSections) {
    const h3s = section.match(/<h3[^>]*>([\s\S]*?)<\/h3>/gi) || [];
    for (const h3 of h3s) {
      const t = h3.replace(/<[^>]+>/g, '').trim();
      if (t.length > 3 && t.length < 100 && !processSteps.includes(t)) processSteps.push(t);
    }
  }
  // Markdown: look for ### under methodology sections
  const mdStepRe = /(?:approche|method|process|démarche|comment|du futur)[\s\S]{0,50}###\s+(.+)/gi;
  let mdM;
  while ((mdM = mdStepRe.exec(text)) !== null) {
    if (!processSteps.includes(mdM[1].trim())) processSteps.push(mdM[1].trim());
  }

  // Delivery mode detection
  const isOnline = /online|en ligne|digital|remote|à distance|platform|saas|app/i.test(text);
  const isOnsite = /on.?site|sur.?place|présentiel|in.?person|atelier|workshop/i.test(text);
  const deliveryMode = isOnline && isOnsite ? 'hybrid' : isOnline ? 'online' : isOnsite ? 'on-site' : '';

  // Geography detection
  const geoText = /suisses?|swiss|france|europe|worldwide|international|global/i.exec(text);
  const geographies = geoText ? geoText[0] : country || '';

  // Quality assurance detection
  const hasQA = /certifi[ée]|quality|qualité|garanti|assurance|suivi|mesure.?d.?impact|ajustement/i.test(text);
  const qaText = hasQA ? 'Continuous monitoring & adjustment' : '';

  // --- Key Indicators extraction ---
  const indicators: string[] = [];
  // Look for numbers with context (years, clients, projects, etc.)
  const numPatterns = [
    /(\d+)\s*(?:ans?|years?)\s*(?:d['']?expérience|experience|direction|accompagnement)/gi,
    /(\d+)\s*(?:clients?|entreprises?|companies|projects?|projets?)/gi,
    /(\d+)\s*(?:pays|countries|villes|cities)/gi,
    /\+?\s*(\d+)\s*(?:collaborateurs?|employees?|team|équipe)/gi,
  ];
  for (const pattern of numPatterns) {
    let m;
    const re = new RegExp(pattern.source, pattern.flags);
    while ((m = re.exec(text)) !== null) {
      indicators.push(m[0].trim());
    }
  }
  // Also look for "X ans" or "X+" standalone patterns
  const standaloneNums = text.match(/\b\d+\s*(?:ans|years|\+|ODD)\b/gi) || [];
  for (const n of standaloneNums) {
    if (!indicators.includes(n.trim())) indicators.push(n.trim());
  }

  // --- Technical Foundation ---
  const hasMobileViewport = /meta[^>]*name=["']viewport["']/i.test(html) || /responsive|mobile/i.test(text);
  const hasSitemap = /sitemap\.xml/i.test(html);
  const hasGlossary = /glossar|lexique|glossaire/i.test(text);
  const hasDocumentation = /documentation|docs\b|developer|api.?reference|guide|tutoriel/i.test(text);

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
    if (ayaEntity && ayaEntity.payment_completed) {
      isAyaRegistered = true;
    }
  } catch { /* ignore */ }

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
        process_steps: field(processSteps, processSteps.length > 0 ? 1 : 0, processSteps.length ? ['scan_micro_agent'] : []),
        delivery_mode: field(deliveryMode, deliveryMode ? 0.5 : 0, deliveryMode ? ['scan_micro_agent'] : []),
        geographies_served: field(geographies, geographies ? 0.5 : 0, geographies ? ['scan_micro_agent'] : []),
        quality_assurance: field(qaText, hasQA ? 0.5 : 0, hasQA ? ['scan_micro_agent'] : []),
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
        has_glossary: field(hasGlossary, hasGlossary ? 0.5 : 0, hasGlossary ? ['scan_micro_agent'] : []),
        has_documentation: field(hasDocumentation, hasDocumentation ? 0.5 : 0, hasDocumentation ? ['scan_micro_agent'] : []),
      },
      structure_technique: {
        // has_asr = fichier ASR physique sur le site (PRO uniquement)
        // is_aya_registered = dans le registre AYA (AYA ou PRO) — géré séparément par le score engine
        has_asr: field(hasAsr, hasAsr ? 1 : 0, hasAsr ? ['scan_micro_agent'] : []),
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
