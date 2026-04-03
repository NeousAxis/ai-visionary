// lib/micro-agents/types.ts — Shared types for all micro-agents

export type Quality = 0 | 0.5 | 1;

export type AgentName =
  | 'detect-contact'
  | 'detect-services'
  | 'detect-legal'
  | 'detect-location'
  | 'detect-security'
  | 'detect-jsonld'
  | 'detect-social';

export type AgentStatus = 'waiting' | 'running' | 'done' | 'error';

// --- Individual agent results ---

export interface ContactResult {
  email: string | null;
  phone: string | null;
  q: Quality;
}

export interface ServicesResult {
  services: string[];
  products: string[];
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

// --- SSE Event ---

export interface AgentEvent {
  agent: AgentName;
  status: AgentStatus;
  data: ContactResult | ServicesResult | LegalResult | LocationResult | SecurityResult | JsonLdResult | SocialResult | null;
  durationMs: number;
  error?: string;
}

// --- Orchestrator merged output ---

export interface FetchResult {
  url: string;
  html: string;
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
}
