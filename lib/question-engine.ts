/**
 * AYO V4 — Evidence-Based Question Engine
 *
 * Replaces the static ENRICHMENT_TEMPLATES with an evidence-aware system.
 * Questions are only asked when the scanner has NOT already detected the data
 * with sufficient confidence. Answers are evaluated for concrete evidence
 * (URLs, numbers, detailed text) vs bare confirmations.
 *
 * No LLM calls. No console.log. Pure deterministic logic.
 */

import type {
  EvidenceQuestion,
  EvidenceAnswer,
  EvidenceType,
  QuestionContext,
  ClassificationResult,
  SiteType,
} from './evidence-types';
import type { Quality } from './aio-score-engine';

// ---------------------------------------------------------------------------
// EVIDENCE_TEMPLATES — ~24 static question templates, organized by block
// ---------------------------------------------------------------------------

const CONFIDENCE_THRESHOLD = 70;

/**
 * Helper: standard askOnlyIf — skip if already detected above threshold.
 * Mandatory fields always ask when confidence is 0.
 */
function defaultAskOnlyIf(fieldPath: string, mandatory?: boolean) {
  return (detected: Record<string, number>): boolean => {
    const confidence = detected[fieldPath] ?? 0;
    if (mandatory && confidence === 0) return true;
    return confidence < CONFIDENCE_THRESHOLD;
  };
}

/** Shorthand to build a template entry with consistent defaults */
function tmpl(
  block: string,
  fieldName: string,
  opts: {
    question_fr: string;
    question_en: string;
    evidenceType: EvidenceType;
    priority: number;
    mandatory?: boolean;
    siteTypes?: SiteType[];
    customLabel_fr?: string;
    customLabel_en?: string;
  },
): EvidenceQuestion {
  const field = `${block}.${fieldName}`;
  return {
    field,
    block,
    fieldName,
    question_fr: opts.question_fr,
    question_en: opts.question_en,
    evidenceType: opts.evidenceType,
    qIfEvidence: 1 as const,
    qIfDeclaration: 0.5 as const,
    priority: opts.priority,
    mandatory: opts.mandatory,
    siteTypes: opts.siteTypes,
    inputType: 'text' as const,
    customLabel_fr: opts.customLabel_fr,
    customLabel_en: opts.customLabel_en,
    askOnlyIf: defaultAskOnlyIf(field, opts.mandatory),
  };
}

// ---------------------------------------------------------------------------
// Block 1: identite (3 mandatory)
// ---------------------------------------------------------------------------
const IDENTITE_TEMPLATES: EvidenceQuestion[] = [
  tmpl('identite', 'contact_email', {
    question_fr: "Quelle est votre adresse email professionnelle ?",
    question_en: "What is your professional email address?",
    evidenceType: 'text',
    priority: 1,
    mandatory: true,
    customLabel_fr: "Email professionnel...",
    customLabel_en: "Professional email...",
  }),
  tmpl('identite', 'legal_name', {
    question_fr: "Quel est le nom legal de votre entreprise ?",
    question_en: "What is the legal name of your company?",
    evidenceType: 'text',
    priority: 2,
    mandatory: true,
    customLabel_fr: "Nom legal...",
    customLabel_en: "Legal name...",
  }),
  tmpl('identite', 'contact_phone', {
    question_fr: "Quel est votre numero de telephone professionnel ?",
    question_en: "What is your professional phone number?",
    evidenceType: 'text',
    priority: 3,
    mandatory: true,
    customLabel_fr: "Telephone...",
    customLabel_en: "Phone number...",
  }),
];

// ---------------------------------------------------------------------------
// Block 2: offre (4 questions)
// ---------------------------------------------------------------------------
const OFFRE_TEMPLATES: EvidenceQuestion[] = [
  tmpl('offre', 'services', {
    question_fr: "Listez vos principaux services (separes par des virgules)",
    question_en: "List your main services (comma-separated)",
    evidenceType: 'text',
    priority: 10,
    customLabel_fr: "Vos services...",
    customLabel_en: "Your services...",
  }),
  tmpl('offre', 'products', {
    question_fr: "Quels sont vos principaux produits ?",
    question_en: "What are your main products?",
    evidenceType: 'text',
    priority: 11,
    siteTypes: ['e-commerce'],
    customLabel_fr: "Vos produits...",
    customLabel_en: "Your products...",
  }),
  tmpl('offre', 'target_audience', {
    question_fr: "Qui est votre audience cible ?",
    question_en: "Who is your target audience?",
    evidenceType: 'text',
    priority: 12,
    customLabel_fr: "Audience cible...",
    customLabel_en: "Target audience...",
  }),
  tmpl('offre', 'pricing_indication', {
    question_fr: "Quelle est votre politique tarifaire ? (ex: sur devis, a partir de X CHF)",
    question_en: "What is your pricing policy? (e.g., on request, starting from X CHF)",
    evidenceType: 'text',
    priority: 13,
    customLabel_fr: "Politique tarifaire...",
    customLabel_en: "Pricing policy...",
  }),
];

// ---------------------------------------------------------------------------
// Block 3: processus_methodes (3 questions)
// ---------------------------------------------------------------------------
const PROCESSUS_TEMPLATES: EvidenceQuestion[] = [
  tmpl('processus_methodes', 'process_steps', {
    question_fr: "Decrivez vos etapes de travail principales",
    question_en: "Describe your main work process steps",
    evidenceType: 'text',
    priority: 20,
    customLabel_fr: "Etapes de travail...",
    customLabel_en: "Work steps...",
  }),
  tmpl('processus_methodes', 'delivery_mode', {
    question_fr: "Comment livrez-vous vos services ? (en ligne, sur site, hybride)",
    question_en: "How do you deliver your services? (online, on-site, hybrid)",
    evidenceType: 'text',
    priority: 21,
    customLabel_fr: "Mode de livraison...",
    customLabel_en: "Delivery mode...",
  }),
  tmpl('processus_methodes', 'quality_assurance', {
    question_fr: "Quelles mesures de qualite appliquez-vous ?",
    question_en: "What quality measures do you apply?",
    evidenceType: 'text',
    priority: 22,
    customLabel_fr: "Mesures qualite...",
    customLabel_en: "Quality measures...",
  }),
];

// ---------------------------------------------------------------------------
// Block 4: engagements_conformite (4 questions — EVIDENCE-BASED)
// ---------------------------------------------------------------------------
const CONFORMITE_TEMPLATES: EvidenceQuestion[] = [
  tmpl('engagements_conformite', 'certifications', {
    question_fr:
      "Quelles certifications detenez-vous ? Fournissez l'URL de votre page certifications si possible.",
    question_en:
      "What certifications do you hold? Provide your certifications page URL if possible.",
    evidenceType: 'url',
    priority: 30,
    customLabel_fr: "Certifications et URL...",
    customLabel_en: "Certifications and URL...",
  }),
  tmpl('engagements_conformite', 'frameworks', {
    question_fr: "Quels standards ou frameworks suivez-vous ? (ISO, RGPD, SOC2, etc.)",
    question_en: "What standards or frameworks do you follow? (ISO, GDPR, SOC2, etc.)",
    evidenceType: 'text',
    priority: 31,
    customLabel_fr: "Standards / frameworks...",
    customLabel_en: "Standards / frameworks...",
  }),
  tmpl('engagements_conformite', 'policies', {
    question_fr: "Avez-vous des politiques publiees (confidentialite, CGV) ? Indiquez l'URL.",
    question_en: "Do you have published policies (privacy, ToS)? Provide the URL.",
    evidenceType: 'url',
    priority: 32,
    customLabel_fr: "URL de vos politiques...",
    customLabel_en: "Policies URL...",
  }),
  tmpl('engagements_conformite', 'security_measures', {
    question_fr: "Quelles mesures de securite implementez-vous ?",
    question_en: "What security measures do you implement?",
    evidenceType: 'text',
    priority: 33,
    customLabel_fr: "Mesures de securite...",
    customLabel_en: "Security measures...",
  }),
];

// ---------------------------------------------------------------------------
// Block 5: indicateurs (2 questions — EVIDENCE-BASED)
// ---------------------------------------------------------------------------
const INDICATEURS_TEMPLATES: EvidenceQuestion[] = [
  tmpl('indicateurs', 'key_indicators', {
    question_fr:
      "Citez vos chiffres cles avec des valeurs concretes (ex: 150 clients, 99.9% uptime, 12 employes)",
    question_en:
      "Cite your key figures with concrete values (e.g., 150 clients, 99.9% uptime, 12 employees)",
    evidenceType: 'text',
    priority: 40,
    customLabel_fr: "Chiffres cles...",
    customLabel_en: "Key figures...",
  }),
  tmpl('indicateurs', 'last_review_date', {
    question_fr: "Date de derniere mise a jour de vos informations ? (format: YYYY-MM)",
    question_en: "When were your information last updated? (format: YYYY-MM)",
    evidenceType: 'text',
    priority: 41,
    customLabel_fr: "Date de mise a jour...",
    customLabel_en: "Last update date...",
  }),
];

// ---------------------------------------------------------------------------
// Block 6: contenus_pedagogiques (3 questions)
// ---------------------------------------------------------------------------
const PEDAGOGIE_TEMPLATES: EvidenceQuestion[] = [
  tmpl('contenus_pedagogiques', 'has_faq', {
    question_fr: "Avez-vous une page FAQ ? Si oui, indiquez l'URL.",
    question_en: "Do you have an FAQ page? If yes, provide the URL.",
    evidenceType: 'url',
    priority: 50,
    customLabel_fr: "URL de la FAQ...",
    customLabel_en: "FAQ URL...",
  }),
  tmpl('contenus_pedagogiques', 'has_glossary', {
    question_fr: "Avez-vous un glossaire ou lexique ? Indiquez l'URL.",
    question_en: "Do you have a glossary or lexicon? Provide the URL.",
    evidenceType: 'url',
    priority: 51,
    customLabel_fr: "URL du glossaire...",
    customLabel_en: "Glossary URL...",
  }),
  tmpl('contenus_pedagogiques', 'has_documentation', {
    question_fr: "Avez-vous une documentation technique ? Indiquez l'URL.",
    question_en: "Do you have technical documentation? Provide the URL.",
    evidenceType: 'url',
    priority: 52,
    siteTypes: ['saas'],
    customLabel_fr: "URL de la documentation...",
    customLabel_en: "Documentation URL...",
  }),
];

// ---------------------------------------------------------------------------
// Block 7: external_context (3 questions)
// ---------------------------------------------------------------------------
const EXTERNAL_CONTEXT_TEMPLATES: EvidenceQuestion[] = [
  tmpl('external_context', 'keywords', {
    question_fr: "Quels mots-cles decrivent votre activite ?",
    question_en: "What keywords describe your business?",
    evidenceType: 'text',
    priority: 60,
    customLabel_fr: "Mots-cles...",
    customLabel_en: "Keywords...",
  }),
  tmpl('external_context', 'intents', {
    question_fr: "Quelles questions vos clients posent-ils le plus souvent ?",
    question_en: "What questions do your clients most frequently ask?",
    evidenceType: 'text',
    priority: 61,
    customLabel_fr: "Questions frequentes...",
    customLabel_en: "Frequent questions...",
  }),
  tmpl('external_context', 'channels', {
    question_fr:
      "Quels sont vos canaux de distribution ? (site web, marketplace, reseaux sociaux)",
    question_en:
      "What are your distribution channels? (website, marketplace, social media)",
    evidenceType: 'text',
    priority: 62,
    customLabel_fr: "Canaux de distribution...",
    customLabel_en: "Distribution channels...",
  }),
];

// ---------------------------------------------------------------------------
// Block 2 extras: offre (2 additional questions)
// ---------------------------------------------------------------------------
const OFFRE_EXTRAS_TEMPLATES: EvidenceQuestion[] = [
  tmpl('offre', 'use_cases', {
    question_fr: "Decrivez 2-3 cas d'usage concrets de vos services",
    question_en: "Describe 2-3 concrete use cases of your services",
    evidenceType: 'text',
    priority: 14,
    customLabel_fr: "Cas d'usage...",
    customLabel_en: "Use cases...",
  }),
  tmpl('offre', 'geographies_served', {
    question_fr: "Quelles zones geographiques servez-vous ?",
    question_en: "What geographic areas do you serve?",
    evidenceType: 'text',
    priority: 15,
    customLabel_fr: "Zones geographiques...",
    customLabel_en: "Geographic areas...",
  }),
];

// ---------------------------------------------------------------------------
// Merged template array (const, never mutated)
// ---------------------------------------------------------------------------

export const EVIDENCE_TEMPLATES: readonly EvidenceQuestion[] = Object.freeze([
  ...IDENTITE_TEMPLATES,
  ...OFFRE_TEMPLATES,
  ...PROCESSUS_TEMPLATES,
  ...CONFORMITE_TEMPLATES,
  ...INDICATEURS_TEMPLATES,
  ...PEDAGOGIE_TEMPLATES,
  ...EXTERNAL_CONTEXT_TEMPLATES,
  ...OFFRE_EXTRAS_TEMPLATES,
]);

// ---------------------------------------------------------------------------
// buildEvidenceQueue — filter & sort templates for a given context
// ---------------------------------------------------------------------------

/**
 * Builds the ordered list of evidence questions to ask, filtering out:
 * - Questions irrelevant to the detected site type
 * - Questions the classifier says to skip
 * - Questions whose data was already detected with sufficient confidence
 */
export function buildEvidenceQueue(
  ctx: QuestionContext,
  classification: ClassificationResult,
): EvidenceQuestion[] {
  return EVIDENCE_TEMPLATES
    .filter((q) => {
      // Filter by site type (if restricted to certain types)
      if (
        q.siteTypes &&
        q.siteTypes.length > 0 &&
        !q.siteTypes.includes(classification.type) &&
        classification.type !== 'unknown'
      ) {
        return false;
      }

      // Filter by classifier-suggested skips
      if (classification.suggestedSkips.includes(q.field)) {
        return false;
      }

      // Filter by detection confidence (skip if already detected)
      if (!q.askOnlyIf(ctx.detected)) {
        return false;
      }

      return true;
    })
    .sort((a, b) => a.priority - b.priority);
}

// ---------------------------------------------------------------------------
// buildEvidenceQuestionBlock — same JSON format as greffier.ts question_block
// ---------------------------------------------------------------------------

/**
 * Produces a `question_block` JSON object compatible with the existing
 * chat UI rendering (same shape as greffier.ts buildEnrichmentQuestion).
 */
export function buildEvidenceQuestionBlock(
  question: EvidenceQuestion,
  locale: 'fr' | 'en',
): object {
  const text = locale === 'fr' ? question.question_fr : question.question_en;
  const customLabel =
    locale === 'fr'
      ? question.customLabel_fr || 'Votre reponse'
      : question.customLabel_en || 'Your answer';

  return {
    type: 'question_block',
    intro: '',
    questions: [
      {
        id: `evidence_${question.block}_${question.fieldName}`,
        text,
        options: [],
        allowCustom: true,
        allowMultiple: false,
        inputType: 'text',
        customLabel,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// evaluateEvidence — determine q value from user answer
// ---------------------------------------------------------------------------

/** Regex: empty or explicit refusal */
const REFUSAL_RE = /^(non|no|aucun|n\/a|rien|nothing|none)$/i;

/** Regex: bare confirmation without substance */
const CONFIRMATION_RE =
  /^(oui|yes|ok|d'accord|exact|je confirme|we do|we have)[\s!.]*$/i;

/** Regex: URL pattern */
const URL_RE = /https?:\/\/[^\s]+/i;

/**
 * Evaluates a user answer against an evidence question.
 * Returns the field path, quality value, and optional evidence URL.
 *
 * Scoring logic:
 * - Empty / refusal          -> q = 0
 * - Bare confirmation ("yes") -> q = 0.5  (declaration only)
 * - URL provided              -> q = 1    (verifiable evidence)
 * - Concrete data (numbers, long text, commas) -> q = 1
 * - Anything else             -> q = 0.5  (declaration only)
 */
export function evaluateEvidence(
  question: EvidenceQuestion,
  answer: string,
): EvidenceAnswer {
  const trimmed = answer.trim();

  // Empty or refusal
  if (!trimmed || REFUSAL_RE.test(trimmed)) {
    return { field: question.field, q: 0 as Quality, rawAnswer: trimmed };
  }

  // Bare confirmation
  if (CONFIRMATION_RE.test(trimmed)) {
    return { field: question.field, q: 0.5 as Quality, rawAnswer: trimmed };
  }

  // URL evidence
  const urlMatch = trimmed.match(URL_RE);
  if (urlMatch) {
    return {
      field: question.field,
      q: 1 as Quality,
      evidenceUrl: urlMatch[0],
      rawAnswer: trimmed,
    };
  }

  // Concrete evidence: contains digits, is substantial, or has list separators
  const hasConcreteData =
    /\d/.test(trimmed) || trimmed.length > 20 || trimmed.includes(',');
  if (hasConcreteData) {
    return { field: question.field, q: 1 as Quality, rawAnswer: trimmed };
  }

  // Default: declaration only
  return { field: question.field, q: 0.5 as Quality, rawAnswer: trimmed };
}
