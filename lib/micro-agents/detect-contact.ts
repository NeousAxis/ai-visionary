// lib/micro-agents/detect-contact.ts — Extract contact info via focused LLM

import type { ContactResult, Quality, JsonLdResult } from './types';
import { llmExtract, parseJson, LlmCallError } from './llm-agent';

const PROMPT = `You extract contact information from websites. The content can be in ANY language (French, English, German, etc.).

The input starts with a SITE LINKS & FOOTER section listing all navigation links and footer content. PAY CLOSE ATTENTION to this section — contact info (email, phone, mailto links) is almost always in the footer.

Extract:
- email: the business contact email. Look for mailto: links, email addresses in text, form action URLs containing emails (formsubmit.co, formspree, etc.)
- phone: the phone number with country code if available
- hasContactForm: true if a contact form is present (look for: "formulaire", "remplissez", "contact form", "Kontaktformular", "get in touch", "nous contacter", input fields for name/email/message)

Return ONLY JSON: {"email": "x@y.com" or null, "phone": "+41..." or null, "hasContactForm": true/false}
Do NOT invent. If not found, return null.`;

// Strip non-digit characters for phone literal-match comparison
function stripPhone(s: string): string {
  return s.replace(/[^\d]/g, '');
}

export async function detectContact(content: string, jsonld?: JsonLdResult): Promise<ContactResult> {
  try {
    const raw = await llmExtract(PROMPT, content, 10000, { maxTokens: 300 });
    const data = parseJson<{ email?: string | null; phone?: string | null; hasContactForm?: boolean }>(raw);
    // Even if the LLM returns nothing, fall through so the JSON-LD fallback below can apply.
    let email = data?.email || null;
    let phone = data?.phone || null;
    const hasContactForm = data?.hasContactForm || false;

    // ANTI-HALLUCINATION: AYO doctrine says "ne jamais inventer". Validate that the
    // email and phone returned are LITERALLY present in the source content.
    // Models (especially Apertus) sometimes fabricate plausible emails from author
    // names + site domain (e.g. cyril.leger@re-ge-nere.app from "Cyril Leger" on the page).
    if (email) {
      const lcContent = content.toLowerCase();
      if (!lcContent.includes(email.toLowerCase())) {
        console.warn(`[detect-contact] HALLUCINATION REJECTED: email "${email}" not found in source content. Dropping.`);
        email = null;
      }
    }
    if (phone) {
      const digits = stripPhone(phone);
      // Need at least 7 digits and they must be in the content (allowing for formatting).
      if (digits.length < 7 || !stripPhone(content).includes(digits)) {
        console.warn(`[detect-contact] HALLUCINATION REJECTED: phone "${phone}" not found in source content. Dropping.`);
        phone = null;
      }
    }

    // JSON-LD fallback: structured contactPoint is authoritative (parsed, not LLM), so it
    // is not subject to the anti-hallucination check. Catches sites whose email lives only
    // in the SSR JSON-LD while the rendered page is a login gate (e.g. Next.js apps).
    if (!email && jsonld?.contactPoint?.email) email = jsonld.contactPoint.email;
    if (!phone && jsonld?.contactPoint?.phone) phone = jsonld.contactPoint.phone;

    let q: Quality = 0;
    if (email && phone) q = 1;
    else if (email) q = 1;
    else if (phone) q = 0.5;
    else if (hasContactForm) q = 0.5;

    return { email, phone, hasContactForm, q };
  } catch (err) {
    // Panne du fournisseur : on la laisse remonter pour que le diagnostic soit signale
    // incomplet, plutot que de faire passer une absence technique pour une absence reelle.
    if (err instanceof LlmCallError) throw err;
    return { email: null, phone: null, q: 0 };
  }
}
