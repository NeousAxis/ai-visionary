// lib/micro-agents/detect-legal.ts — Extract legal/compliance info via focused LLM

import type { LegalResult, Quality } from './types';
import { llmExtract, parseJson } from './llm-agent';

const PROMPT = `You extract legal and compliance information from websites. The content can be in ANY language (French, English, German, etc.).

Extract:
- policies: published legal documents. Look for: "Privacy Policy", "Mentions légales", "CGV", "CGU", "RGPD", "Terms", "Cookie Policy", "Impressum", "Datenschutz", "Politique de confidentialité", links to /legal, /privacy, /terms, /mentions-legales, /rgpd, /cgv
- frameworks: regulatory frameworks. Look for: GDPR, RGPD, HIPAA, PCI-DSS, LPD, CCPA, ODD (Objectifs de Développement Durable / SDGs), RSE/CSR
- certifications: third-party certifications. Look for: "Certifié", "Certified", ISO, SOC, B Corp, any certification mentioned
- urls: URLs of legal/policy pages found

Return ONLY JSON: {"policies": [], "frameworks": [], "certifications": [], "urls": []}
Extract ONLY what is explicitly mentioned. Do NOT invent.`;

export async function detectLegal(content: string): Promise<LegalResult> {
  try {
    console.log(`[detect-legal] Input length: ${content.length}`);
    const raw = await llmExtract(PROMPT, content, 10000);
    console.log(`[detect-legal] Raw response: ${raw.substring(0, 300)}`);
    const data = parseJson<{ policies?: string[]; frameworks?: string[]; certifications?: string[]; urls?: string[] }>(raw);
    if (!data) return { policies: [], frameworks: [], certifications: [], urls: [], q: 0 };

    const policies = data.policies || [];
    const frameworks = data.frameworks || [];
    const certifications = data.certifications || [];
    const urls = data.urls || [];

    const total = policies.length + frameworks.length + certifications.length;
    let q: Quality = 0;
    if (total > 0 && urls.length > 0) q = 1;
    else if (total > 0) q = 0.5;

    return { policies, frameworks, certifications, urls, q };
  } catch {
    return { policies: [], frameworks: [], certifications: [], urls: [], q: 0 };
  }
}
