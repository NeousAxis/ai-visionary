// lib/micro-agents/detect-contact.ts — Extract contact info via focused LLM

import type { ContactResult, Quality } from './types';
import { llmExtract, parseJson } from './llm-agent';

const PROMPT = `You extract contact information from websites. The content can be in ANY language (French, English, German, etc.).

The input starts with a SITE LINKS & FOOTER section listing all navigation links and footer content. PAY CLOSE ATTENTION to this section — contact info (email, phone, mailto links) is almost always in the footer.

Extract:
- email: the business contact email. Look for mailto: links, email addresses in text, form action URLs containing emails (formsubmit.co, formspree, etc.)
- phone: the phone number with country code if available
- hasContactForm: true if a contact form is present (look for: "formulaire", "remplissez", "contact form", "Kontaktformular", "get in touch", "nous contacter", input fields for name/email/message)

Return ONLY JSON: {"email": "x@y.com" or null, "phone": "+41..." or null, "hasContactForm": true/false}
Do NOT invent. If not found, return null.`;

export async function detectContact(content: string): Promise<ContactResult> {
  try {
    const raw = await llmExtract(PROMPT, content, 10000);
    const data = parseJson<{ email?: string | null; phone?: string | null; hasContactForm?: boolean }>(raw);
    if (!data) return { email: null, phone: null, q: 0 };

    const email = data.email || null;
    const phone = data.phone || null;
    const hasContactForm = data.hasContactForm || false;

    let q: Quality = 0;
    if (email && phone) q = 1;
    else if (email) q = 1;
    else if (phone) q = 0.5;
    else if (hasContactForm) q = 0.5;

    return { email, phone, hasContactForm, q };
  } catch {
    return { email: null, phone: null, q: 0 };
  }
}
