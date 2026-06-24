/**
 * pollen-cashback.ts
 *
 * Moteur cashback Pollen Agents (MVP) — jeton d'attribution signe Ed25519.
 *
 * Le jeton est self-contained et signe avec la MEME cle que l'ASR
 * (AYO_SIGNING_PRIVATE_KEY / AYO_SIGNING_KEY). Il n'a PAS besoin d'etre stocke :
 * sa signature EST la preuve qu'AYA l'a emis pour une offre donnee. L'anti-rejeu
 * se fait cote claim (le `jti` est unique dans cashback_claims).
 *
 * Format du jeton : base64url(payloadJSON) + "." + base64url(signature)
 * (style JWS detache, mais minimal et sans dependance).
 */

import nacl from 'tweetnacl';

const SECRET_KEY_BASE64 =
  process.env.AYO_SIGNING_PRIVATE_KEY || process.env.AYO_SIGNING_KEY || '';
// Cle publique de verification (identique a ayo-crypto.ts — NON secrete).
const PUBLIC_KEY_BASE64 = 'Ol1YRyHMESzAIBYquUZJHyR1fDevd8oLcUmd98nUnCE=';
const KEY_ID = (process.env.AYO_KEY_ID || 'AYO-KEY-2026-03')
  .replace(/\\n/g, '')
  .replace(/[\n\r]/g, '')
  .trim();

// Fenetre de validite par defaut d'un jeton d'attribution (jours).
const DEFAULT_TTL_DAYS = 90;

export interface AttributionTokenPayload {
  /** Identifiant unique du jeton (anti-rejeu cote claim). */
  jti: string;
  /** Offre cashback ciblee. */
  offer_id: string;
  /** Entite (souple) + domaine bare normalise. */
  entity_id?: string | null;
  entity_domain: string;
  /** Operateur de l'agent qui a interroge (optionnel). */
  agent_id?: string | null;
  /** Emis le / expire le (epoch seconds). */
  iat: number;
  exp: number;
  /** Id de cle de signature (rotation future). */
  kid: string;
}

function b64urlEncode(buf: Buffer | Uint8Array): string {
  return Buffer.from(buf).toString('base64url');
}

function canonicalPayload(p: AttributionTokenPayload): string {
  // Ordre de cles fixe et stable pour une signature reproductible.
  return JSON.stringify({
    agent_id: p.agent_id ?? null,
    entity_domain: p.entity_domain,
    entity_id: p.entity_id ?? null,
    exp: p.exp,
    iat: p.iat,
    jti: p.jti,
    kid: p.kid,
    offer_id: p.offer_id,
  });
}

/**
 * Mint un jeton d'attribution signe. STATELESS : aucune ecriture DB.
 * `nowMs` est injecte pour rester testable et deterministe.
 */
export function signAttributionToken(input: {
  offerId: string;
  entityDomain: string;
  entityId?: string | null;
  agentId?: string | null;
  nowMs: number;
  ttlDays?: number;
}): { token: string; payload: AttributionTokenPayload } {
  if (!SECRET_KEY_BASE64) {
    throw new Error(
      'AYO_SIGNING_PRIVATE_KEY non defini — impossible de signer le jeton d attribution',
    );
  }
  const iat = Math.floor(input.nowMs / 1000);
  const ttl = (input.ttlDays ?? DEFAULT_TTL_DAYS) * 86400;
  const jti = b64urlEncode(nacl.randomBytes(18)); // 144 bits d'entropie

  const payload: AttributionTokenPayload = {
    jti,
    offer_id: input.offerId,
    entity_id: input.entityId ?? null,
    entity_domain: input.entityDomain,
    agent_id: input.agentId ?? null,
    iat,
    exp: iat + ttl,
    kid: KEY_ID,
  };

  const msg = new TextEncoder().encode(canonicalPayload(payload));
  const secretKey = new Uint8Array(Buffer.from(SECRET_KEY_BASE64, 'base64'));
  const sig = nacl.sign.detached(msg, secretKey);

  const token = `${b64urlEncode(Buffer.from(canonicalPayload(payload)))}.${b64urlEncode(sig)}`;
  return { token, payload };
}

export type VerifyResult =
  | { valid: true; payload: AttributionTokenPayload }
  | { valid: false; reason: 'malformed' | 'bad_signature' | 'expired' };

/**
 * Verifie un jeton d'attribution : structure, signature Ed25519, expiration.
 * `nowMs` injecte pour la testabilite.
 */
export function verifyAttributionToken(token: string, nowMs: number): VerifyResult {
  const parts = (token || '').split('.');
  if (parts.length !== 2) return { valid: false, reason: 'malformed' };

  let payload: AttributionTokenPayload;
  let payloadJson: string;
  try {
    payloadJson = Buffer.from(parts[0], 'base64url').toString('utf8');
    payload = JSON.parse(payloadJson);
  } catch {
    return { valid: false, reason: 'malformed' };
  }
  if (
    !payload ||
    typeof payload.jti !== 'string' ||
    typeof payload.offer_id !== 'string' ||
    typeof payload.entity_domain !== 'string' ||
    typeof payload.iat !== 'number' ||
    typeof payload.exp !== 'number'
  ) {
    return { valid: false, reason: 'malformed' };
  }

  // Re-canonicalise depuis l'objet parse : le message signe ne depend pas de
  // l'ordre/espacement recu, seulement des valeurs.
  const msg = new TextEncoder().encode(canonicalPayload(payload));
  let sig: Uint8Array;
  try {
    sig = new Uint8Array(Buffer.from(parts[1], 'base64url'));
  } catch {
    return { valid: false, reason: 'malformed' };
  }

  const pub = new Uint8Array(Buffer.from(PUBLIC_KEY_BASE64, 'base64'));
  const ok = nacl.sign.detached.verify(msg, sig, pub);
  if (!ok) return { valid: false, reason: 'bad_signature' };

  if (Math.floor(nowMs / 1000) > payload.exp) {
    return { valid: false, reason: 'expired' };
  }
  return { valid: true, payload };
}

// ── Resolution des montants (interne) ─────────────────────────────────────────

export interface OfferLike {
  cashback_type: string;
  cashback_value: number;
  cpa_total: number | null;
  honey_value: number | null;
}

/**
 * Resout le montant de cashback a partir d'une offre et (optionnel) d'un
 * montant de transaction. Pour `flat` : montant fixe. Pour `percent` : %
 * applique au montant de transaction (requis pour percent).
 */
export function resolveCashbackAmount(
  offer: OfferLike,
  txAmount?: number | null,
): number | null {
  if (offer.cashback_type === 'flat') {
    return Number(offer.cashback_value);
  }
  if (offer.cashback_type === 'percent') {
    if (typeof txAmount !== 'number' || txAmount <= 0) return null;
    return Math.round(txAmount * (Number(offer.cashback_value) / 100) * 100) / 100;
  }
  return null;
}
