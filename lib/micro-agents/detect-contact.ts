// lib/micro-agents/detect-contact.ts — Extract email + phone from HTML

import type { ContactResult, Quality } from './types';

// Regex patterns (aligned with controle-qualite.ts)
const EMAIL_CAPTURE = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
const PHONE_PATTERNS = [
  /tel:([+\d\s\-().]{6,})/gi,                           // tel: links
  /href=["']tel:([^"']+)["']/gi,                         // href="tel:..."
  /(\+\d{1,3}[\s.-]?\(?\d{1,4}\)?[\s.-]?\d{2,4}[\s.-]?\d{2,4}[\s.-]?\d{0,4})/g, // International format
];

// Emails to ignore (generic/spam traps)
const IGNORED_EMAILS = /^(noreply|no-reply|admin|webmaster|info@example|test@|support@wordpress|wixpress)/i;

export function detectContact(html: string): ContactResult {
  let email: string | null = null;
  let phone: string | null = null;
  let q: Quality = 0;

  // --- Email extraction ---
  const emailMatches = html.match(EMAIL_CAPTURE) || [];
  const uniqueEmails = [...new Set(emailMatches.map(e => e.toLowerCase()))];

  // Filter out obvious non-contact emails
  const validEmails = uniqueEmails.filter(e =>
    !IGNORED_EMAILS.test(e) &&
    !e.endsWith('.png') &&
    !e.endsWith('.jpg') &&
    !e.includes('sentry') &&
    !e.includes('cloudflare') &&
    !e.includes('googleapis')
  );

  if (validEmails.length > 0) {
    // Prefer mailto: link emails, then contact-section emails
    const mailtoMatch = html.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    email = mailtoMatch ? mailtoMatch[1].toLowerCase() : validEmails[0];
    q = 1; // Found in HTML = verifiable
  }

  // --- Phone extraction ---
  for (const pattern of PHONE_PATTERNS) {
    const matches = html.match(pattern);
    if (matches && matches.length > 0) {
      // Clean the phone number
      let raw = matches[0]
        .replace(/^tel:/i, '')
        .replace(/href=["']tel:/i, '')
        .replace(/["']/g, '')
        .trim();

      // Must have at least 6 digits
      const digits = raw.replace(/\D/g, '');
      if (digits.length >= 6) {
        phone = raw;
        if (q === 0) q = 1;
        break;
      }
    }
  }

  // If only one of them found
  if ((email && !phone) || (!email && phone)) {
    q = 0.5;
  }
  // If both found
  if (email && phone) {
    q = 1;
  }

  return { email, phone, q };
}
