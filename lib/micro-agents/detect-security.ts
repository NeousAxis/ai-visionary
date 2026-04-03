// lib/micro-agents/detect-security.ts — Check HTTP headers + security mentions

import type { SecurityResult, Quality } from './types';

// Security headers to check
const SECURITY_HEADERS: [string, string][] = [
  ['strict-transport-security', 'HSTS'],
  ['content-security-policy', 'CSP'],
  ['x-frame-options', 'X-Frame-Options'],
  ['x-content-type-options', 'X-Content-Type-Options'],
  ['x-xss-protection', 'X-XSS-Protection'],
  ['referrer-policy', 'Referrer-Policy'],
  ['permissions-policy', 'Permissions-Policy'],
];

// Security mentions in content
const SECURITY_MENTIONS: [RegExp, string][] = [
  [/\bTLS\s*1\.[23]\b/i, 'TLS 1.3'],
  [/\bAES[\s-]?256\b/i, 'AES-256 Encryption'],
  [/\bSSL\b/i, 'SSL'],
  [/\b2FA\b|\btwo[\s-]?factor\b|\bdouble.?auth/i, '2FA'],
  [/\bMFA\b|\bmulti[\s-]?factor/i, 'MFA'],
  [/\bencryption\b|\bchiffrement\b/i, 'Encryption'],
  [/\bfirewall\b/i, 'Firewall'],
  [/\bDDoS.?protection\b/i, 'DDoS Protection'],
  [/\bWAF\b|web.?application.?firewall/i, 'WAF'],
  [/\bSSO\b|single.?sign.?on/i, 'SSO'],
  [/\bOAuth\b/i, 'OAuth'],
  [/\bSAML\b/i, 'SAML'],
  [/\bZero[\s-]?Trust\b/i, 'Zero Trust'],
  [/\bpen(?:etration)?[\s-]?test/i, 'Penetration Testing'],
  [/\bbackup\b|\bsauvegarde\b/i, 'Backups'],
];

export function detectSecurity(html: string, headers: Record<string, string>): SecurityResult {
  const measures: string[] = [];
  let q: Quality = 0;

  // --- Check HTTP security headers ---
  for (const [header, label] of SECURITY_HEADERS) {
    if (headers[header]) {
      measures.push(label);
    }
  }

  // --- Check if HTTPS (from URL or headers) ---
  // If HSTS is present, the site uses HTTPS
  if (headers['strict-transport-security']) {
    if (!measures.includes('HTTPS')) {
      measures.push('HTTPS');
    }
  }

  // --- Scan HTML for security mentions ---
  const seen = new Set(measures.map(m => m.toLowerCase()));
  for (const [pattern, label] of SECURITY_MENTIONS) {
    if (pattern.test(html) && !seen.has(label.toLowerCase())) {
      measures.push(label);
      seen.add(label.toLowerCase());
    }
  }

  // --- Quality ---
  if (measures.length === 0) {
    q = 0;
  } else if (measures.some(m => ['HSTS', 'CSP', 'TLS 1.3'].includes(m))) {
    q = 1; // Headers = verifiable
  } else {
    q = 0.5; // Mentioned only
  }

  return { measures, q };
}
