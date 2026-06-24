-- Migration 16 juin 2026 : moteur cashback Pollen Agents (MVP)
-- A appliquer sur Postgres VPS aya_local UNIQUEMENT (pas Supabase).
-- Purement ADDITIF : 2 nouvelles tables, aucune donnee existante touchee.
--
-- Modele (cf. VISION-POLLEN-AGENTS.md §8bis) :
--   cashback_offers  = un deal actif finance par un service (le CPA).
--   cashback_claims  = une demande de cashback contre une offre, validee
--                      MANUELLEMENT (outcome-only, anti-fraude par jeton signe).

-- ── Offres (deals signes a la main au demarrage) ─────────────────────────────
CREATE TABLE IF NOT EXISTS cashback_offers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id      UUID,                          -- lien souple vers aya_registry (nullable)
  entity_domain  TEXT NOT NULL,                 -- domaine bare normalise (ex. "exemple.ch")
  service_name   TEXT,
  cashback_type  TEXT NOT NULL DEFAULT 'flat',  -- flat | percent
  cashback_value NUMERIC(10,2) NOT NULL,        -- montant a plat (devise) OU pourcentage
  currency       TEXT NOT NULL DEFAULT 'CHF',
  cpa_total      NUMERIC(10,2),                 -- commission totale financee par le service (interne)
  honey_value    NUMERIC(10,2),                 -- part operateur d'agent (interne)
  vertical       TEXT,                          -- ex. "fiduciaire-geneve"
  status         TEXT NOT NULL DEFAULT 'active',-- active | paused | ended
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cashback_offers_domain ON cashback_offers (entity_domain);
CREATE INDEX IF NOT EXISTS idx_cashback_offers_status ON cashback_offers (status);
CREATE INDEX IF NOT EXISTS idx_cashback_offers_entity ON cashback_offers (entity_id);

-- Au plus UNE offre active par domaine (le reste = paused/ended pour l'historique).
CREATE UNIQUE INDEX IF NOT EXISTS uq_cashback_offers_active_domain
  ON cashback_offers (entity_domain)
  WHERE status = 'active';

-- ── Claims (1 jeton d'attribution = 1 claim, anti-rejeu) ─────────────────────
CREATE TABLE IF NOT EXISTS cashback_claims (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jti             TEXT NOT NULL UNIQUE,         -- id du jeton signe : empeche le rejeu
  offer_id        UUID NOT NULL,
  entity_id       UUID,
  entity_domain   TEXT NOT NULL,
  agent_id        TEXT,                         -- operateur de l'agent (optionnel)
  principal_ref   TEXT,                         -- reference opaque de l'utilisateur final (PAS de PII)
  status          TEXT NOT NULL DEFAULT 'claimed', -- claimed | validated | paid | rejected
  proof           JSONB,                        -- preuve de transaction soumise par l'agent
  amount_cashback NUMERIC(10,2),                -- resolu a la validation
  amount_honey    NUMERIC(10,2),
  currency        TEXT NOT NULL DEFAULT 'CHF',
  token_issued_at TIMESTAMPTZ,
  token_exp       TIMESTAMPTZ,
  claimed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  validated_at    TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  review_notes    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cashback_claims_offer  ON cashback_claims (offer_id);
CREATE INDEX IF NOT EXISTS idx_cashback_claims_domain ON cashback_claims (entity_domain);
CREATE INDEX IF NOT EXISTS idx_cashback_claims_status ON cashback_claims (status);
