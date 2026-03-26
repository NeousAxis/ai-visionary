// lib/update-token.ts
// HMAC-based token for authenticating client update requests.
// Used by /update/[entityId] page (server-side generation)
// and /api/update-entity + /api/regenerate-files (server-side verification).

import crypto from 'crypto';

const SECRET = process.env.SESSION_SECRET || process.env.ADMIN_SECRET || '';

/**
 * Generate a signed token for a given entityId.
 * Token format: entityId:expiryTimestamp:hmacSignature
 * Valid for 1 hour.
 */
export function generateUpdateToken(entityId: string): string {
  const expiry = Date.now() + 3_600_000; // 1 hour
  const payload = `${entityId}:${expiry}`;
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  return `${payload}:${sig}`;
}

/**
 * Verify a signed token against the expected entityId.
 * Returns true only if:
 * - Token has 3 parts (entityId:expiry:sig)
 * - entityId matches
 * - Token is not expired
 * - Signature is valid (timing-safe comparison)
 */
export function verifyUpdateToken(token: string, entityId: string): boolean {
  if (!token || !entityId || !SECRET) return false;

  const parts = token.split(':');
  if (parts.length !== 3) return false;

  const [id, expiryStr, sig] = parts;
  if (id !== entityId) return false;

  const expiry = parseInt(expiryStr, 10);
  if (isNaN(expiry) || Date.now() > expiry) return false;

  const expected = crypto.createHmac('sha256', SECRET).update(`${id}:${expiryStr}`).digest('hex');

  // Timing-safe comparison to prevent timing attacks
  if (sig.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}
