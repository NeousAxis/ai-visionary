// lib/micro-agents/detect-contact.ts — Extract contact info via focused LLM

import type { ContactResult, Quality } from './types';
import { llmExtract, parseJson } from './llm-agent';

const PROMPT = `You are a contact info extractor. From the website content below, extract ONLY:
- email: the main contact/business email (not noreply, not support@wordpress)
- phone: the main phone number (with country code if possible)
- hasContactForm: true if a contact form exists on the page

Return ONLY valid JSON: {"email": "x@y.com" or null, "phone": "+41..." or null, "hasContactForm": true/false}
Do NOT invent data. If not found, return null. No explanation.`;

export async function detectContact(content: string): Promise<ContactResult> {
  try {
    const raw = await llmExtract(PROMPT, content);
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

    return { email, phone, q } as ContactResult;
  } catch {
    return { email: null, phone: null, q: 0 };
  }
}
