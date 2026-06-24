-- Migration 24 juin 2026 (b) : volet PARTENAIRES CASHBACK de l'outreach.
-- Additif, réversible. Postgres VPS aya_local uniquement.
--
-- 1) outreach_recipients.kind : distingue la campagne ASR-readability du pitch partenaire.
-- 2) partner_candidates : shortlist BD persistante, qualifiée automatiquement par le
--    détecteur de programme d'affiliation (lib/outreach/affiliate-detector.ts).

ALTER TABLE outreach_recipients
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'readability';  -- readability | partner

CREATE TABLE IF NOT EXISTS partner_candidates (
  domain         TEXT PRIMARY KEY,                 -- domaine bare normalisé
  entity_id      UUID,
  display_name   TEXT,
  sector_macro   TEXT,
  country_legal  TEXT,
  contact_email  TEXT,
  asr_score      NUMERIC(5,1),
  has_affiliate  BOOLEAN NOT NULL DEFAULT false,   -- programme d'affiliation/referral détecté
  affiliate_url  TEXT,                             -- URL de la page programme trouvée
  signals        JSONB,                            -- mots-clés / chemins ayant matché
  queued         BOOLEAN NOT NULL DEFAULT false,   -- mis en file outreach (kind=partner)
  scanned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_candidates_affiliate ON partner_candidates (has_affiliate);
CREATE INDEX IF NOT EXISTS idx_partner_candidates_sector    ON partner_candidates (sector_macro);

-- Rollback :
-- DROP TABLE IF EXISTS partner_candidates;
-- ALTER TABLE outreach_recipients DROP COLUMN IF EXISTS kind;
