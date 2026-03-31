// AYO V4 Evidence-Based — Shared Types

import type { Quality } from './aio-score-engine';

// --- Site Classification ---

export type SiteType = 'e-commerce' | 'saas' | 'corporate' | 'freelance' | 'association' | 'media' | 'government' | 'unknown';

export interface ClassificationResult {
  type: SiteType;
  confidence: number;        // 0-1, below 0.3 = unknown
  signals: string[];          // what triggered the classification
  suggestedSkips: string[];   // field paths not relevant for this type
}

// --- Evidence Questions ---

export type EvidenceType = 'url' | 'text' | 'confirmation';

export type ReliabilityLevel = 'verifiable' | 'self_declared' | 'interpretive';

export interface EvidenceQuestion {
  field: string;               // full path: 'engagements_conformite.certifications'
  block: string;               // block name: 'engagements_conformite'
  fieldName: string;           // field within block: 'certifications'
  siteTypes?: SiteType[];      // if defined, only ask for these site types
  askOnlyIf: (detected: Record<string, number>) => boolean; // true = ask the question
  question_fr: string;
  question_en: string;
  evidenceType: EvidenceType;
  qIfEvidence: 1;              // proof provided
  qIfDeclaration: 0.5;         // bare confirmation only
  priority: number;            // sort order (1 = first)
  mandatory?: boolean;         // always ask if missing (contact_email, legal_name, contact_phone)
  reliabilityLevel: ReliabilityLevel; // data reliability classification
  inputType?: 'text';          // force text input
  customLabel_fr?: string;     // placeholder FR
  customLabel_en?: string;     // placeholder EN
}

// --- Question Context ---

export interface QuestionContext {
  detected: Record<string, number>;   // field path -> confidence (0-100)
  siteType: SiteType;
  suggestedSkips: string[];
  locale: 'fr' | 'en';
}

// --- Evidence Answer ---

export interface EvidenceAnswer {
  field: string;
  q: Quality;
  evidenceUrl?: string;
  rawAnswer: string;
  reliabilityLevel: ReliabilityLevel;
}

// --- Site Detection Signals (added to AioScanResult) ---

export interface SiteDetectionSignals {
  hasCart: boolean;
  hasLogin: boolean;
  hasAPI: boolean;
  hasPricing: boolean;
  hasPortfolio: boolean;
  hasBlog: boolean;
  hasTeamPage: boolean;
  hasContactForm: boolean;
}
