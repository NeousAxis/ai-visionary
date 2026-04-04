// lib/micro-agents/detect-legal.ts — Extract legal/compliance info via focused LLM

import type { LegalResult, Quality } from './types';
import { llmExtract, parseJson } from './llm-agent';

const PROMPT = `You are a legal/compliance extractor. From the website content below, extract:
- policies: published documents (Privacy Policy, Terms & Conditions, Cookie Policy, Legal Notice, etc.)
- frameworks: regulatory frameworks mentioned (GDPR, HIPAA, PCI-DSS, LPD, CCPA, etc.)
- certifications: third-party certifications (ISO 27001, SOC 2, B Corp, etc.)
- urls: any URLs to legal/policy pages found

Extract ONLY what is explicitly mentioned. Do NOT invent.
Return ONLY valid JSON: {"policies": [], "frameworks": [], "certifications": [], "urls": []}
No explanation.`;

export async function detectLegal(content: string): Promise<LegalResult> {
  try {
    const raw = await llmExtract(PROMPT, content);
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
