// lib/micro-agents/detect-legal.ts — Detect legal/privacy/compliance links + certifications

import type { LegalResult, Quality } from './types';

// Link patterns for policies
const POLICY_LINK_PATTERNS: [RegExp, string][] = [
  [/privacy.?policy|politique.?de.?confidentialit[ée]|datenschutz/i, 'Privacy Policy'],
  [/terms.?(?:of.?(?:service|use)|and.?conditions)|conditions.?g[ée]n[ée]rales|cgu|cgv|agb/i, 'Terms & Conditions'],
  [/cookie.?policy|politique.?(?:de.?)?cookies/i, 'Cookie Policy'],
  [/legal.?notice|mentions.?l[ée]gales|impressum/i, 'Legal Notice'],
  [/refund.?policy|politique.?de.?remboursement/i, 'Refund Policy'],
  [/disclaimer|avertissement/i, 'Disclaimer'],
  [/acceptable.?use/i, 'Acceptable Use Policy'],
  [/data.?processing|dpa|traitement.?des.?donn[ée]es/i, 'Data Processing Agreement'],
  [/code.?of.?conduct|code.?de.?conduite/i, 'Code of Conduct'],
];

// Framework detection patterns
const FRAMEWORK_PATTERNS: [RegExp, string][] = [
  [/\bGDPR\b|r[èe]glement.?g[ée]n[ée]ral.?sur.?la.?protection.?des.?donn[ée]es|RGPD/i, 'GDPR'],
  [/\bHIPAA\b/i, 'HIPAA'],
  [/\bPCI[\s-]DSS\b/i, 'PCI-DSS'],
  [/\bSOX\b|Sarbanes[\s-]Oxley/i, 'SOX'],
  [/\bCCPA\b|California.?Consumer.?Privacy/i, 'CCPA'],
  [/\bLPD\b|Loi.?f[ée]d[ée]rale.?sur.?la.?protection.?des.?donn[ée]es/i, 'LPD'],
  [/\bnFADP\b|new.?Federal.?Act.?on.?Data.?Protection/i, 'nFADP'],
  [/\bFINMA\b/i, 'FINMA'],
  [/\bMiFID\b/i, 'MiFID II'],
  [/\bDORA\b|Digital.?Operational.?Resilience/i, 'DORA'],
  [/\bePrivacy\b/i, 'ePrivacy'],
];

// Certification patterns
const CERTIFICATION_PATTERNS: [RegExp, string][] = [
  [/\bISO[\s-]?27001\b/i, 'ISO 27001'],
  [/\bISO[\s-]?27701\b/i, 'ISO 27701'],
  [/\bISO[\s-]?9001\b/i, 'ISO 9001'],
  [/\bISO[\s-]?14001\b/i, 'ISO 14001'],
  [/\bISO[\s-]?22301\b/i, 'ISO 22301'],
  [/\bSOC[\s-]?2\b/i, 'SOC 2'],
  [/\bSOC[\s-]?1\b/i, 'SOC 1'],
  [/\bB[\s-]?Corp\b/i, 'B Corp'],
  [/\bFedRAMP\b/i, 'FedRAMP'],
  [/\bCSA[\s-]?STAR\b/i, 'CSA STAR'],
  [/\bCyber[\s-]?Essentials\b/i, 'Cyber Essentials'],
  [/\bTISAX\b/i, 'TISAX'],
  [/\bHITRUST\b/i, 'HITRUST'],
  [/\bISAE[\s-]?3402\b/i, 'ISAE 3402'],
];

export function detectLegal(html: string): LegalResult {
  const policies: string[] = [];
  const frameworks: string[] = [];
  const certifications: string[] = [];
  const urls: string[] = [];
  let q: Quality = 0;

  // --- Extract all links ---
  const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    const linkText = match[2].replace(/<[^>]+>/g, '').trim();
    const combined = href + ' ' + linkText;

    for (const [pattern, policyName] of POLICY_LINK_PATTERNS) {
      if (pattern.test(combined) && !policies.includes(policyName)) {
        policies.push(policyName);
        if (href.startsWith('http') || href.startsWith('/')) {
          urls.push(href);
        }
        break;
      }
    }
  }

  // --- Detect frameworks in full text ---
  for (const [pattern, frameworkName] of FRAMEWORK_PATTERNS) {
    if (pattern.test(html) && !frameworks.includes(frameworkName)) {
      frameworks.push(frameworkName);
    }
  }

  // --- Detect certifications ---
  for (const [pattern, certName] of CERTIFICATION_PATTERNS) {
    if (pattern.test(html) && !certifications.includes(certName)) {
      certifications.push(certName);
    }
  }

  // --- Quality ---
  const total = policies.length + frameworks.length + certifications.length;
  if (total === 0) {
    q = 0;
  } else if (policies.length > 0 && urls.length > 0) {
    q = 1; // Has links = verifiable
  } else {
    q = 0.5; // Mentioned but no proof link
  }

  return { policies, frameworks, certifications, urls, q };
}
