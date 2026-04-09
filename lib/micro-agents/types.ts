// lib/micro-agents/types.ts — Shared types for all micro-agents

export type Quality = 0 | 0.5 | 1;

export type AgentName =
  | 'detect-contact'
  | 'detect-services'
  | 'detect-legal'
  | 'detect-location'
  | 'detect-security'
  | 'detect-jsonld'
  | 'detect-social'
  | 'detect-pedagogy';

export type AgentStatus = 'waiting' | 'running' | 'done' | 'error';

// --- Individual agent results ---

export interface ContactResult {
  email: string | null;
  phone: string | null;
  hasContactForm?: boolean;
  q: Quality;
}

export interface ServicesResult {
  services: string[];
  products: string[];
  target_audience?: string;
  use_cases?: string[];
  pricing?: string;
  q: Quality;
}

export interface LegalResult {
  policies: string[];
  frameworks: string[];
  certifications: string[];
  urls: string[];
  q: Quality;
}

export interface LocationResult {
  city: string | null;
  country: string | null;
  q: Quality;
}

export interface SecurityResult {
  measures: string[];
  q: Quality;
}

export interface JsonLdResult {
  schemas: Record<string, unknown>[];
  type: string | null;
  name: string | null;
  description: string | null;
  address: { city?: string; country?: string } | null;
  contactPoint: { email?: string; phone?: string } | null;
  hasOrganizationType: boolean;
  hasFaqSchema: boolean;
  q: Quality;
}

export interface SocialResult {
  links: string[];
  platforms: string[];
  q: Quality;
}

export interface PedagogyResult {
  has_faq: boolean;
  has_glossary: boolean;
  has_documentation: boolean;
  q: Quality;
}

// --- SSE Event ---

export interface AgentEvent {
  agent: AgentName;
  status: AgentStatus;
  data: ContactResult | ServicesResult | LegalResult | LocationResult | SecurityResult | JsonLdResult | SocialResult | PedagogyResult | null;
  durationMs: number;
  error?: string;
}

// --- Orchestrator merged output ---

export type SourceType = 'ssr' | 'spa_puppeteer' | 'spa_jina';

export interface FetchResult {
  url: string;
  /** Raw HTML from initial fetch (may be SPA shell) */
  rawHtml: string;
  /** Fully rendered HTML with DOM structure (footer, nav, links) — from Puppeteer or Jina HTML */
  renderedHtml: string;
  /** Clean text content stripped of all HTML tags */
  textContent: string;
  /** How the page was rendered */
  sourceType: SourceType;
  headers: Record<string, string>;
  statusCode: number;
  isReachable: boolean;
}

export interface AllAgentResults {
  contact: ContactResult;
  services: ServicesResult;
  legal: LegalResult;
  location: LocationResult;
  security: SecurityResult;
  jsonld: JsonLdResult;
  social: SocialResult;
  pedagogy: PedagogyResult;
}
