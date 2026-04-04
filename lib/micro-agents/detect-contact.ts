// lib/micro-agents/detect-contact.ts — Extract email + phone from HTML

import type { ContactResult, Quality } from './types';

// Email patterns
const EMAIL_CAPTURE = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
const MAILTO_CAPTURE = /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
const FORM_ACTION_EMAIL = /action=["'][^"']*(?:formsubmit|formspree|getform|submit-form)[^"']*\/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
const OBFUSCATED_EMAIL = /([a-zA-Z0-9._%+-]+)\s*(?:\[at\]|\(at\)|@|&#64;)\s*([a-zA-Z0-9.-]+)\s*(?:\[dot\]|\(dot\)|\.)\s*([a-zA-Z]{2,})/gi;

// Phone patterns — much broader
const PHONE_PATTERNS = [
  /href=["']tel:([^"']+)["']/gi,                                              // tel: links
  /(\+\d{1,3}[\s.\-]?\(?\d{1,4}\)?[\s.\-]?\d{2,4}[\s.\-]?\d{2,4}[\s.\-]?\d{0,4})/g, // International +XX
  /(\b0\d{1,2}[\s.\-]\d{2,3}[\s.\-]\d{2,3}[\s.\-]?\d{2,4}\b)/g,              // Local 0XX format (CH/FR/DE)
  /(\(\d{3}\)\s?\d{3}[\s.\-]\d{4})/g,                                         // US (XXX) XXX-XXXX
  /(\b\d{3}[\s.\-]\d{3}[\s.\-]\d{4}\b)/g,                                     // US XXX-XXX-XXXX
];

// Emails to ignore
const IGNORED_EMAILS = /^(noreply|no-reply|admin@|webmaster@|root@|postmaster@|test@|support@wordpress|wixpress|example\.com|sentry|cloudflare|googleapis|w3\.org|schema\.org|google\.com)/i;

export function detectContact(html: string): ContactResult {
  let email: string | null = null;
  let phone: string | null = null;

  // --- EMAIL ---
  const allEmails = new Set<string>();

  // 1. mailto: links (highest priority)
  let m;
  const mailtoRe = new RegExp(MAILTO_CAPTURE.source, MAILTO_CAPTURE.flags);
  while ((m = mailtoRe.exec(html)) !== null) {
    allEmails.add(m[1].toLowerCase());
  }

  // 2. Form action emails (FormSubmit, Formspree, etc.)
  const formRe = new RegExp(FORM_ACTION_EMAIL.source, FORM_ACTION_EMAIL.flags);
  while ((m = formRe.exec(html)) !== null) {
    allEmails.add(m[1].toLowerCase());
  }

  // 3. Obfuscated emails
  const obfRe = new RegExp(OBFUSCATED_EMAIL.source, OBFUSCATED_EMAIL.flags);
  while ((m = obfRe.exec(html)) !== null) {
    allEmails.add(`${m[1]}@${m[2]}.${m[3]}`.toLowerCase());
  }

  // 4. Plain text emails
  const plainRe = new RegExp(EMAIL_CAPTURE.source, EMAIL_CAPTURE.flags);
  while ((m = plainRe.exec(html)) !== null) {
    allEmails.add(m[1].toLowerCase());
  }

  // Filter
  const validEmails = [...allEmails].filter(e =>
    !IGNORED_EMAILS.test(e) &&
    !e.endsWith('.png') && !e.endsWith('.jpg') && !e.endsWith('.svg') &&
    !e.includes('favicon') && e.length < 80
  );

  if (validEmails.length > 0) {
    email = validEmails[0];
  }

  // --- PHONE ---
  for (const pattern of PHONE_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags);
    while ((m = re.exec(html)) !== null) {
      let raw = m[1] || m[0];
      raw = raw.replace(/^tel:/i, '').replace(/["']/g, '').trim();
      const digits = raw.replace(/\D/g, '');
      if (digits.length >= 6 && digits.length <= 15) {
        phone = raw;
        break;
      }
    }
    if (phone) break;
  }

  // --- QUALITY ---
  let q: Quality = 0;
  if (email && phone) q = 1;
  else if (email) q = 1;  // email alone is verifiable
  else if (phone) q = 0.5;

  // Detect contact form as fallback signal
  const hasContactForm = /<form[^>]*(?:contact|message|anfrage|kontakt)/i.test(html) ||
    /name=["'](?:email|message|subject)["']/i.test(html);
  if (!email && !phone && hasContactForm) {
    q = 0.5;
  }

  return { email, phone, q, hasContactForm } as ContactResult & { hasContactForm?: boolean };
}
