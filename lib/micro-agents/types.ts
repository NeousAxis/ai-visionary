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

/** 'user_provided' : HTML colle ou televerse par le visiteur, jamais lu par AYO sur le site. */
export type SourceType = 'ssr' | 'spa_puppeteer' | 'spa_degraded' | 'user_provided';

/**
 * Pourquoi un site n'a pas pu etre lu. Memes statuts que aya/page_check.py (bot Python),
 * plus 'placeholder' pour les pages par defaut de serveur et les sites en construction.
 */
export type UnreadableReason = 'unreachable' | 'blocked' | 'parked' | 'no_text' | 'redirected' | 'placeholder';

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
  /** Vrai seulement si AYO a reellement lu du contenu de l'entreprise : sinon, aucun score. */
  isReachable: boolean;
  /** URL ou la lecture a abouti, apres les redirections HTTP et JavaScript. */
  finalUrl?: string;
  /** Renseigne quand isReachable est faux. */
  unreadableReason?: UnreadableReason;
  /** Precision lisible (statut HTTP, hote d'arrivee, nombre de caracteres...). */
  unreadableDetail?: string;
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
