// AYO V4 — Deterministic Site Classifier
// Pure function: no LLM, no async, no side effects

import type { AioScanResult } from './aio-scanner';
import type { SiteType, ClassificationResult } from './evidence-types';

// --- Signal Definitions ---

interface SignalDef {
  label: string;
  patterns: string[];
  weight: number;
}

interface TypeProfile {
  maxWeight: number;
  signals: SignalDef[];
}

const TYPE_SIGNALS: Record<Exclude<SiteType, 'unknown'>, TypeProfile> = {
  'e-commerce': {
    maxWeight: 11,
    signals: [
      { label: 'cart', patterns: ['cart', 'panier', 'shopping-cart', 'add-to-cart', 'ajouter au panier'], weight: 3 },
      { label: 'price', patterns: ['chf ', 'eur ', 'usd ', '$ ', '\u20ac', '\u00a3 '], weight: 2 },
      { label: 'shipping', patterns: ['shipping', 'livraison', 'delivery', 'expedition'], weight: 2 },
      { label: 'returns', patterns: ['returns', 'retours', 'refund', 'remboursement'], weight: 1 },
      { label: 'shop', patterns: ['catalogue', 'shop', 'store', 'boutique', 'e-shop', 'eshop'], weight: 2 },
    ],
  },
  saas: {
    maxWeight: 11,
    signals: [
      { label: 'auth', patterns: ['login', 'sign-up', 'sign-in', 'register', 'dashboard', 'log in', 'sign up'], weight: 2 },
      { label: 'api', patterns: ['api', 'developer', 'documentation', 'sdk', 'webhook'], weight: 3 },
      { label: 'pricing', patterns: ['pricing', 'plans', 'subscription', 'tarifs', 'abonnement'], weight: 2 },
      { label: 'trial', patterns: ['trial', 'demo', 'free-tier', 'free tier', 'essai gratuit', 'try for free'], weight: 2 },
      { label: 'platform', patterns: ['saas', 'platform', 'cloud', 'plateforme'], weight: 2 },
    ],
  },
  corporate: {
    maxWeight: 9,
    signals: [
      { label: 'about', patterns: ['about-us', 'about us', 'a-propos', '\u00e0 propos', 'who-we-are', 'qui sommes'], weight: 2 },
      { label: 'team', patterns: ['team', '\u00e9quipe', 'equipe', 'our-team', 'notre \u00e9quipe'], weight: 2 },
      { label: 'careers', patterns: ['careers', 'jobs', 'recrutement', 'join us', 'nous rejoindre', 'emploi'], weight: 2 },
      { label: 'investors', patterns: ['investors', 'actionnaires', 'sharehol'], weight: 1 },
      { label: 'offices', patterns: ['offices', 'bureaux', 'nos bureaux', 'our offices'], weight: 1 },
      { label: 'organization', patterns: ['"organization"', '"@type":"organization"'], weight: 1 },
    ],
  },
  freelance: {
    maxWeight: 9,
    signals: [
      { label: 'portfolio', patterns: ['portfolio', 'mes projets', 'my projects', 'r\u00e9alisations'], weight: 3 },
      { label: 'solo', patterns: ['consultant', 'freelance', 'ind\u00e9pendant', 'independant', 'solo'], weight: 3 },
      { label: 'firstPerson', patterns: ['je suis', 'i am', 'mon expertise', 'my expertise', 'about me', '\u00e0 propos de moi'], weight: 2 },
      // Small text bonus is handled separately below
    ],
  },
  association: {
    maxWeight: 10,
    signals: [
      { label: 'nonprofit', patterns: ['non-profit', 'nonprofit', 'association', 'fondation', 'foundation'], weight: 3 },
      { label: 'members', patterns: ['members', 'membres', 'adh\u00e9rents', 'adherents', 'b\u00e9n\u00e9voles'], weight: 2 },
      { label: 'mission', patterns: ['mission', 'values', 'valeurs', 'notre mission', 'our mission'], weight: 2 },
      { label: 'legal', patterns: ['loi-1901', 'loi 1901', '501c3', '501(c)(3)', 'charity', 'charit\u00e9'], weight: 3 },
    ],
  },
  media: {
    maxWeight: 9,
    signals: [
      { label: 'articles', patterns: ['articles', 'article'], weight: 2 },
      { label: 'blog', patterns: ['blog', 'magazine', 'journal', 'editorial'], weight: 2 },
      { label: 'news', patterns: ['news', 'actualit\u00e9s', 'actualites', 'presse', 'press'], weight: 2 },
      { label: 'author', patterns: ['author', 'auteur', 'r\u00e9daction', 'redaction', 'journalist'], weight: 2 },
    ],
  },
  government: {
    maxWeight: 10,
    signals: [
      { label: 'govTld', patterns: ['.gov', '.gouv'], weight: 5 },
      { label: 'publicService', patterns: ['public-service', 'service-public', 'service public', 'public service'], weight: 3 },
      { label: 'municipality', patterns: ['municipality', 'commune', 'mairie', 'canton', 'prefecture'], weight: 2 },
    ],
  },
};

// Suggested question skips per site type
const SKIPS: Record<SiteType, string[]> = {
  'e-commerce': ['offre.use_cases'],
  saas: ['offre.products'],
  corporate: [],
  freelance: ['engagements_conformite.certifications'],
  association: ['offre.pricing_indication'],
  media: ['processus_methodes.process_steps'],
  government: ['offre.pricing_indication'],
  unknown: [],
};

// --- Scoring ---

function scoreSignals(text: string, url: string, signals: SignalDef[]): { score: number; matched: string[] } {
  let score = 0;
  const matched: string[] = [];
  const lowerText = text.toLowerCase();
  const lowerUrl = url.toLowerCase();

  for (const signal of signals) {
    for (const pattern of signal.patterns) {
      if (lowerText.includes(pattern) || lowerUrl.includes(pattern)) {
        score += signal.weight;
        matched.push(signal.label);
        break; // count each signal group only once
      }
    }
  }
  return { score, matched };
}

// --- Public API ---

export function classifySite(scan: AioScanResult): ClassificationResult {
  // Combine all textual content for signal matching
  const combinedText = [
    scan.text,
    ...(scan.h1 ?? []),
    scan.metaTitle ?? '',
    scan.metaDescription ?? '',
  ].join(' ');

  const url = scan.url ?? '';

  // Exclude government sites from e-commerce (avoid false positives)
  const isGovUrl = /\.gov\b|\.gouv\b/i.test(url);

  let bestType: SiteType = 'unknown';
  let bestConfidence = 0;
  let bestSignals: string[] = [];

  const types = Object.keys(TYPE_SIGNALS) as Exclude<SiteType, 'unknown'>[];

  for (const siteType of types) {
    // Government exclusion for e-commerce
    if (siteType === 'e-commerce' && isGovUrl) continue;

    const profile = TYPE_SIGNALS[siteType];
    const { score, matched } = scoreSignals(combinedText, url, profile.signals);

    // Freelance bonus: short page text
    let adjustedScore = score;
    if (siteType === 'freelance' && scan.text.length > 0 && scan.text.length < 3000) {
      adjustedScore += 1;
      if (!matched.includes('smallText')) matched.push('smallText');
    }

    const confidence = adjustedScore / profile.maxWeight;

    if (confidence > bestConfidence) {
      bestConfidence = confidence;
      bestType = siteType;
      bestSignals = matched;
    }
  }

  // If no type reaches the minimum threshold, classify as unknown
  if (bestConfidence < 0.3) {
    return {
      type: 'unknown',
      confidence: bestConfidence,
      signals: bestSignals,
      suggestedSkips: SKIPS.unknown,
    };
  }

  return {
    type: bestType,
    confidence: Math.round(bestConfidence * 100) / 100,
    signals: bestSignals,
    suggestedSkips: SKIPS[bestType],
  };
}
