// lib/micro-agents/detect-legal.ts — Extract legal/compliance info via focused LLM

import type { LegalResult, Quality } from './types';
import { llmExtract, parseJson, LlmCallError } from './llm-agent';

const PROMPT = `You extract legal and compliance information from websites. The content can be in ANY language (French, English, German, etc.).

The input starts with a SITE LINKS & FOOTER section listing all navigation links and footer content. PAY CLOSE ATTENTION to this section — legal pages are almost always linked in the footer.

Extract:
- policies: published legal documents. Look for: "Privacy Policy", "Mentions légales", "CGV", "CGU", "RGPD", "Terms", "Cookie Policy", "Impressum", "Datenschutz", "Politique de confidentialité", links to /legal, /privacy, /terms, /mentions-legales, /rgpd, /cgv, /conditions-generales
- frameworks: regulatory frameworks. Look for: GDPR, RGPD, HIPAA, PCI-DSS, LPD, CCPA, ODD (Objectifs de Développement Durable / SDGs), RSE/CSR
- certifications: third-party certifications. Look for: "Certifié", "Certified", ISO, SOC, B Corp, any certification mentioned
- urls: URLs of legal/policy pages found (from LINK entries or page content)

IMPORTANT: A link in the footer to "CGV", "Mentions légales", "Politique de confidentialité" or similar IS a policy — include it.

Return ONLY JSON: {"policies": [], "frameworks": [], "certifications": [], "urls": []}
Extract ONLY what is explicitly mentioned. Do NOT invent.`;

export async function detectLegal(content: string): Promise<LegalResult> {
  try {
    console.log(`[detect-legal] Input length: ${content.length}`);
    const raw = await llmExtract(PROMPT, content, 10000, { maxTokens: 800 });
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
  } catch (err) {
    // Panne du fournisseur : on la laisse remonter pour que le diagnostic soit signale
    // incomplet, plutot que de faire passer une absence technique pour une absence reelle.
    if (err instanceof LlmCallError) throw err;
    return { policies: [], frameworks: [], certifications: [], urls: [], q: 0 };
  }
}
