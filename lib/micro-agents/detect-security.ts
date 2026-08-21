// lib/micro-agents/detect-security.ts — Extract security info (headers deterministic + content LLM)

import type { SecurityResult, Quality } from './types';
import { llmExtract, parseJson, LlmCallError } from './llm-agent';

// Headers are checked deterministically (no LLM needed)
const SECURITY_HEADERS: [string, string][] = [
  ['strict-transport-security', 'HSTS'],
  ['content-security-policy', 'CSP'],
  ['x-frame-options', 'X-Frame-Options'],
  ['x-content-type-options', 'X-Content-Type-Options'],
  ['referrer-policy', 'Referrer-Policy'],
  ['permissions-policy', 'Permissions-Policy'],
];

const PROMPT = `You are a security measure extractor. From the website content below, extract security measures mentioned:
- encryption (TLS, AES-256, SSL)
- authentication (2FA, MFA, SSO, OAuth, SAML)
- infrastructure (firewall, WAF, DDoS protection, backups)
- compliance (penetration testing, Zero Trust, SOC)

Return ONLY valid JSON: {"measures": ["TLS 1.3", "2FA", "WAF"]}
Extract ONLY what is explicitly mentioned. Do NOT invent. No explanation.`;

export async function detectSecurity(content: string, headers: Record<string, string>): Promise<SecurityResult> {
  const measures: string[] = [];

  // Deterministic: check HTTP headers
  for (const [header, label] of SECURITY_HEADERS) {
    if (headers[header]) measures.push(label);
  }
  if (headers['strict-transport-security']) measures.push('HTTPS');

  // LLM: extract security mentions from content
  try {
    const raw = await llmExtract(PROMPT, content);
    const data = parseJson<{ measures?: string[] }>(raw);
    if (data?.measures) {
      const seen = new Set(measures.map(m => m.toLowerCase()));
      for (const m of data.measures) {
        if (!seen.has(m.toLowerCase())) {
          measures.push(m);
          seen.add(m.toLowerCase());
        }
      }
    }
  } catch (err) {
    // Panne du fournisseur : on la laisse remonter. Les mesures deduites des headers ne
    // suffisent pas a couvrir le bloc conformite, le diagnostic serait sous-estime.
    if (err instanceof LlmCallError) throw err;
    /* sinon : headers seuls */
  }

  const q: Quality = measures.length >= 3 ? 1 : measures.length > 0 ? 0.5 : 0;
  return { measures, q };
}
