// lib/micro-agents/orchestrator.ts — Run all 8 agents, merge into AyoExtract

import { fetchHtml, getTextContent } from './html-fetcher';
import { AYOBOT_UA } from './constants';
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

// --- Name cleaning ---

/**
 * Decode HTML entities and strip tagline/slogan from title-derived names.
 * "Regenere+ | Consulting Stratégie &amp; Durabilité" → "Regenere+"
 * "My Corp — The best in town" → "My Corp"
 * "AI Visionary" → "AI Visionary" (unchanged)
 */
function cleanEntityName(raw: string): string {
  if (!raw) return '';
  // 1. Decode HTML entities (&amp; &lt; &gt; &quot; &#39; &#x27; &#NNN;)
  let name = raw
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));

  // 2. Strip tagline after separators: " | ", " - ", " — ", " : "
  // Only if the part before the separator is long enough to be a real name (>= 3 chars)
  const separators = [' | ', ' — ', ' – ', ' - ', ' : '];
  for (const sep of separators) {
    const idx = name.indexOf(sep);
    if (idx >= 3) {
      name = name.substring(0, idx).trim();
      break;
    }
  }

  return name.trim();
}

// --- Deterministic legal link detection (regex, like social) ---

/** Legal link patterns: detect policy/framework/certification URLs in raw HTML (incl. JS bundles) */
const LEGAL_LINK_PATTERNS: { re: RegExp; label: string; type: 'policy' | 'framework' }[] = [
  { re: /(?:href|to)[=:"']+\s*["']?\/?mentions?[_-]?l[eé]gales?/gi, label: 'Mentions légales', type: 'policy' },
  { re: /(?:href|to)[=:"']+\s*["']?\/?(?:privacy|confidentialit[eé]|datenschutz)/gi, label: 'Privacy Policy', type: 'policy' },
  { re: /(?:href|to)[=:"']+\s*["']?\/?(?:cgv|conditions?[_-]?g[eé]n[eé]rales?[_-]?(?:de[_-])?vente)/gi, label: 'CGV', type: 'policy' },
  { re: /(?:href|to)[=:"']+\s*["']?\/?(?:cgu|conditions?[_-]?(?:g[eé]n[eé]rales?[_-]?)?(?:d[_-]?)?utilisation|terms(?:[_-]of[_-](?:use|service))?)/gi, label: 'Terms of Use', type: 'policy' },
  { re: /(?:href|to)[=:"']+\s*["']?\/?(?:impressum|imprint)/gi, label: 'Impressum', type: 'policy' },
  { re: /(?:href|to)[=:"']+\s*["']?\/?(?:cookie[_-]?polic|cookies)/gi, label: 'Cookie Policy', type: 'policy' },
  { re: /(?:href|to)[=:"']+\s*["']?\/?(?:legal[_-]?notice|legal)/gi, label: 'Legal Notice', type: 'policy' },
  { re: /(?:href|to)[=:"']+\s*["']?\/?(?:rgpd|gdpr)/gi, label: 'GDPR', type: 'framework' },
];

/**
 * Deterministic scan for legal links in HTML (raw + rendered).
 * Works on SPA bundles, SSR pages, Jina HTML — any format.
 */
function detectLegalLinksDeterministic(htmlSources: string[]): { policies: string[]; frameworks: string[] } {
  const combined = htmlSources.join('\n');
  const policies: string[] = [];
  const frameworks: string[] = [];

  for (const { re, label, type } of LEGAL_LINK_PATTERNS) {
    // Reset regex lastIndex
    re.lastIndex = 0;
    if (re.test(combined)) {
      if (type === 'policy' && !policies.includes(label)) policies.push(label);
      if (type === 'framework' && !frameworks.includes(label)) frameworks.push(label);
    }
  }

  return { policies, frameworks };
}

// --- Source preparation ---

/**
 * Extract all links (href + anchor text) and footer/nav sections from rendered HTML.
 * Produces a structured block that preserves URL info for agents needing DOM context.
 */
function extractSiteLinks(html: string): string {
  const parts: string[] = [];
  let m: RegExpExecArray | null;

  // Extract ALL <a href> links with their text (supports nested elements like <span>)
  const linkRe = /<a\s[^>]*href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const seenHrefs = new Set<string>();
  while ((m = linkRe.exec(html)) !== null) {
    const href = m[1].trim();
    const text = m[2].replace(/<[^>]+>/g, '').trim();
    if (href && !href.startsWith('javascript:') && !seenHrefs.has(href.toLowerCase())) {
      seenHrefs.add(href.toLowerCase());
      if (text) parts.push(`LINK: ${text} → ${href}`);
      else parts.push(`LINK: ${href}`);
    }
  }

  // Extract footer and nav text content
  const navFooterRe = /<(?:footer|nav)[^>]*>([\s\S]*?)<\/(?:footer|nav)>/gi;
  while ((m = navFooterRe.exec(html)) !== null) {
    const innerHtml = m[1];
    // Extract links from within footer/nav specifically (supports nested elements)
    const innerLinkRe = /<a\s[^>]*href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let innerM;
    while ((innerM = innerLinkRe.exec(innerHtml)) !== null) {
      const href = innerM[1].trim();
      const text = innerM[2].replace(/<[^>]+>/g, '').trim();
      if (href && !href.startsWith('javascript:') && !seenHrefs.has(href.toLowerCase())) {
        seenHrefs.add(href.toLowerCase());
        parts.push(`FOOTER-LINK: ${text} → ${href}`);
      }
    }
    // Plain text from footer/nav — increased limit for long footers with legal links at the end
    const text = innerHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (text.length > 10) parts.push(`FOOTER-TEXT: ${text.substring(0, 1500)}`);
  }

  return parts.join('\n');
}

/**
 * Build enriched content for agents that need DOM context (links + footer + text).
 * Used by: detect-legal, detect-contact, detect-location
 */
function buildEnrichedContent(renderedHtml: string, textContent: string): string {
  const siteLinks = extractSiteLinks(renderedHtml);
  if (!siteLinks) return textContent;
  return `=== SITE LINKS & FOOTER ===\n${siteLinks}\n\n=== PAGE CONTENT ===\n${textContent}`;
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
 * Run an agent. Historically did 3x in parallel to stabilize Gemini variance.
 * With Infomaniak/Apertus + json_schema mode, output is deterministic enough
 * that 1 call is sufficient — restores 2-3x performance.
 */
async function runAgentWithRetry<T>(
  name: AgentName,
  fn: () => Promise<T>,
  _merge: (a: T, b: T) => T,
): Promise<{ result: T | null; event: AgentEvent }> {
  const start = Date.now();
  try {
    const result = await fn();
    const ms = Date.now() - start;
    console.log(`[agent] ${name}: completed in ${ms}ms`);
    return {
      result,
      event: { agent: name, status: 'done', data: result as any, durationMs: ms },
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
 *
 * Source routing:
 * - renderedHtml → detect-jsonld, detect-social (need DOM structure)
 * - enrichedContent (links + footer + text) → detect-legal, detect-contact, detect-location
 * - textContent → detect-services, detect-security (text is enough)
 * - renderedHtml + url → detect-pedagogy (has its own Jina fallback)
 */
export async function runAllAgents(
  url: string,
  onEvent?: (event: AgentEvent) => void,
  providedHtmlContent?: string,
): Promise<{ fetchResult: FetchResult; results: AllAgentResults; events: AgentEvent[] }> {
  // Step 1: Fetch HTML — or use provided content (upload fallback)
  let fetchResult: FetchResult;
  if (providedHtmlContent && providedHtmlContent.trim().length > 100) {
    const textContent = getTextContent(providedHtmlContent);
    fetchResult = {
      url,
      rawHtml: providedHtmlContent,
      renderedHtml: providedHtmlContent,
      textContent,
      sourceType: 'ssr',
      headers: {},
      statusCode: 200,
      isReachable: true,
    };
    console.log(`[orchestrator] Using provided HTML: ${providedHtmlContent.length} chars, ${textContent.length} text chars`);
  } else {
    fetchResult = await fetchHtml(url);
  }
  const { renderedHtml, textContent, headers, sourceType } = fetchResult;

  console.log(`[orchestrator] Fetched ${url}: sourceType=${sourceType}, renderedHtml=${renderedHtml.length} chars, textContent=${textContent.length} chars`);

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

  // Build enriched content for agents that need DOM context (links + footer + text)
  const enrichedContent = buildEnrichedContent(renderedHtml, textContent);

  // Step 2: Run all 8 agents IN PARALLEL — emit 'running' for all upfront so the UI
  // sees the cards spin simultaneously, then emit each 'done' as it completes.
  // Was sequential (~30-40s); parallel cuts to ~8-12s on Infomaniak Apertus.
  const events: AgentEvent[] = [];
  const combinedHtmlForSocial = fetchResult.rawHtml !== renderedHtml
    ? `${fetchResult.rawHtml}\n${renderedHtml}`
    : renderedHtml;
  console.log(`[orchestrator] Passing renderedHtml to pedagogy: ${renderedHtml.length} chars, sourceType=${sourceType}, has <footer>: ${/<footer/i.test(renderedHtml)}`);

  // Deterministic legal regex (sync, instant)
  const deterministicLegal = detectLegalLinksDeterministic([fetchResult.rawHtml, renderedHtml]);
  console.log(`[orchestrator] Deterministic legal: policies=[${deterministicLegal.policies.join(', ')}], frameworks=[${deterministicLegal.frameworks.join(', ')}]`);

  // Emit all 'running' events upfront (UI shows 8 spinners immediately)
  const agentNames: AgentName[] = ['detect-jsonld', 'detect-contact', 'detect-location', 'detect-services', 'detect-legal', 'detect-security', 'detect-social', 'detect-pedagogy'];
  for (const name of agentNames) {
    onEvent?.({ agent: name, status: 'running', data: null, durationMs: 0 });
  }

  // Run jsonld first (sync, fast, feeds location)
  const jsonldRun = await runAgent('detect-jsonld', () => detectJsonLd(renderedHtml));
  events.push(jsonldRun.event); onEvent?.(jsonldRun.event);

  // Run the 7 remaining agents in parallel — emit 'done' as each settles
  const parallelRuns = await Promise.all([
    runAgent('detect-contact', () => detectContact(enrichedContent)).then(r => { events.push(r.event); onEvent?.(r.event); return r; }),
    runAgent('detect-location', () => detectLocation(enrichedContent, jsonldRun.result || undefined, fetchResult.url)).then(r => { events.push(r.event); onEvent?.(r.event); return r; }),
    runAgentWithRetry('detect-services', () => detectServices(textContent), mergeServices).then(r => { events.push(r.event); onEvent?.(r.event); return r; }),
    runAgentWithRetry('detect-legal', () => detectLegal(enrichedContent), mergeLegal).then(r => {
      // Merge deterministic findings into LLM result
      if (r.result) {
        r.result.policies = unionStrings(r.result.policies, deterministicLegal.policies);
        r.result.frameworks = unionStrings(r.result.frameworks, deterministicLegal.frameworks);
        if ((deterministicLegal.policies.length + deterministicLegal.frameworks.length) > 0 && r.result.q === 0) r.result.q = 0.5;
        r.event.data = r.result;
      }
      events.push(r.event); onEvent?.(r.event); return r;
    }),
    runAgent('detect-security', () => detectSecurity(textContent, headers)).then(r => { events.push(r.event); onEvent?.(r.event); return r; }),
    runAgent('detect-social', () => detectSocial(combinedHtmlForSocial)).then(r => { events.push(r.event); onEvent?.(r.event); return r; }),
    runAgent('detect-pedagogy', () => detectPedagogy(renderedHtml)).then(r => { events.push(r.event); onEvent?.(r.event); return r; }),
  ]);
  const [contactRun, locationRun, servicesRun, legalRun, securityRun, socialRun, pedagogyRun] = parallelRuns;

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
  const metaTitleMatch = fetchResult.renderedHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
  const rawName = jsonld.name || (metaTitleMatch ? metaTitleMatch[1].trim() : '');
  // Clean name: decode HTML entities + strip tagline/slogan after separators (|, -, —, :)
  const name = cleanEntityName(rawName);

  // Determine business type: JSON-LD first, then infer from services/content
  // Order matters: NGO/nonprofit BEFORE commercial types (avoid "advisory" → ConsultingFirm for ICRC)
  let businessType = jsonld.type || '';
  if (!businessType && services.services.length > 0) {
    const svcText = services.services.join(' ').toLowerCase();
    const allText = `${svcText} ${fetchResult.textContent.substring(0, 2000).toLowerCase()}`;
    // NGO/nonprofit detection FIRST — priority over commercial types
    if (/humanitari|humanitarian|ngo|ong|croix-?rouge|red cross|unicef|unhcr|fondation|foundation|charity|charit[eé]|nonprofit|non-?profit|aide humanitaire|r[eé]fugi[eé]|refugee|droits? de l'homme|human rights|développement durable|sustainable development|action sociale/i.test(allText)) businessType = 'NonprofitOrganization';
    else if (/consulting|conseil|advisory|accompagnement|stratégie/i.test(svcText)) businessType = 'ConsultingFirm';
    else if (/website|web|app|software|développement|development|saas|platform/i.test(svcText)) businessType = 'TechnologyCompany';
    else if (/design|graphi|créati|branding|ux|ui/i.test(svcText)) businessType = 'DesignAgency';
    else if (/marketing|communication|pub|seo|social media/i.test(svcText)) businessType = 'MarketingAgency';
    else if (/formation|training|coaching|education|cours/i.test(svcText)) businessType = 'EducationalOrganization';
    else if (/legal|juridique|avocat|droit|compliance/i.test(svcText)) businessType = 'LegalService';
    else if (/health|santé|medical|pharma|clinic/i.test(svcText)) businessType = 'MedicalBusiness';
    else if (/finance|bank|assurance|investissement/i.test(svcText)) businessType = 'FinancialService';
    else if (/e-?commerce|shop|boutique|magasin|store|retail|vente en ligne|marketplace/i.test(svcText)) businessType = 'Store';
    else businessType = 'ProfessionalService';
  }

  // City/country: merge JSON-LD + location agent
  const city = location.city || jsonld.address?.city || '';
  const country = location.country || jsonld.address?.country || '';

  // Contact: merge contact agent + JSON-LD contactPoint
  const email = contact.email || jsonld.contactPoint?.email || '';
  const phone = contact.phone || jsonld.contactPoint?.phone || '';

  // Build enriched content for process/indicators LLM
  const enrichedContent = buildEnrichedContent(fetchResult.renderedHtml, fetchResult.textContent);

  // --- FAQ / Glossary / Doc = via detect-pedagogy LLM agent (merged with JSON-LD schema) ---
  const { pedagogy } = results;
  const hasFaqContent = jsonld.hasFaqSchema || pedagogy.has_faq;
  const hasGlossary = pedagogy.has_glossary;
  const hasDocumentation = pedagogy.has_documentation;
  // --- Sitemap / Mobile = DETERMINISTE (regex sur HTML — detection technique pure) ---
  const hasSitemap = /sitemap\.xml/i.test(fetchResult.renderedHtml);
  const hasMobileViewport = /meta[^>]*name=["']viewport["']/i.test(fetchResult.rawHtml);

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

    // Single LLM call (was 3x for Gemini variance — Infomaniak json_schema is deterministic enough)
    type ProcessData = {
      process_steps?: string[];
      delivery_mode?: string;
      geographies?: string;
      quality_assurance?: string;
      indicators?: string[];
    };
    const raw = await llmExtract(processPrompt, enrichedContent, 10000).catch(() => '{}');
    const data = parseJson<ProcessData>(raw);
    console.log('[agent] process/indicators: completed');

    processSteps = data?.process_steps || [];
    deliveryMode = data?.delivery_mode || '';
    if (data?.geographies) geographies = data.geographies;
    qaText = data?.quality_assurance || '';
    indicators = data?.indicators || [];
  } catch { /* fallback: empty */ }

  // --- Industry Keywords = LLM cible (for competitor matching against AYA gemini_keywords) ---
  let industryKeywords: string[] = [];
  try {
    const { llmExtract, parseJson } = await import('./llm-agent');
    const keywordsPrompt = `You are a business classifier. Based on the company's products and services, generate 5-10 specific INDUSTRY KEYWORDS that describe what this company actually sells or does.
Rules:
- Keywords must be SPECIFIC product/service categories, not generic words
- Think: what would you search for to find this company's competitors?
- Use the SAME language as the site content
- Examples: "couteaux de cuisine", "peripheriques informatiques", "logiciel comptable", "assurance auto"
- Do NOT include: company name, locations, generic words like "innovation", "quality", "leader"
Return ONLY a JSON array: ["keyword1", "keyword2", ...]`;

    const kwRaw = await llmExtract(keywordsPrompt, enrichedContent, 8000).catch(() => '[]');
    const parsed = parseJson<string[]>(kwRaw);
    if (Array.isArray(parsed)) {
      industryKeywords = parsed.filter((k): k is string => typeof k === 'string' && k.length > 2).slice(0, 10);
    }
    console.log(`[orchestrator] Industry keywords: [${industryKeywords.join(', ')}]`);
  } catch { /* fallback: empty */ }

  // ASR file check — HEAD request to /.ayo/asr.json
  let hasAsr = false;
  try {
    const asrUrl = new URL(url);
    asrUrl.pathname = '/.ayo/asr.json';
    const asrRes = await fetch(asrUrl.toString(), {
      method: 'HEAD',
      headers: { 'User-Agent': AYOBOT_UA },
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
        industry_keywords: industryKeywords,
      },
    },
    fields: {
      identite: {
        name: field(name, name ? 1 : 0, name ? ['scan_micro_agent'] : []),
        legal_name: field(name || '', name ? 1 : 0, name ? ['scan_micro_agent'] : []),
        business_type: field(businessType, businessType ? 1 : 0, businessType ? ['scan_micro_agent'] : []),
        city: field(city, location.q, city ? ['scan_micro_agent'] : []),
        country: field(country, location.q, country ? ['scan_micro_agent'] : []),
        contact_email: field(
          email || (contact.hasContactForm ? 'contact_form' : ''),
          email ? 1 : contact.hasContactForm ? 0.5 : 0,
          email ? ['scan_micro_agent'] : contact.hasContactForm ? ['scan_micro_agent_form'] : []
        ),
        contact_phone: phone
          ? field(phone, 1, ['scan_micro_agent'])
          : { value: '', q: 0 as Quality, evidence: [], na: true },
      },
      offre: {
        services: field(services.services, services.q, services.services.length ? ['scan_micro_agent'] : []),
        products: field(services.products, services.products.length ? services.q : 0, services.products.length ? ['scan_micro_agent'] : []),
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
        has_glossary: field(hasGlossary, hasGlossary ? 1 : 0, hasGlossary ? ['scan_micro_agent'] : []),
        has_documentation: field(hasDocumentation, hasDocumentation ? 1 : 0, hasDocumentation ? ['scan_micro_agent'] : []),
      },
      structure_technique: {
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
