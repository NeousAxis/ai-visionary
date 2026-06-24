-- Migration 24 juin 2026 : moteur d'outreach AI Visionary (cold B2B SMTP individuel)
-- A appliquer sur Postgres VPS aya_local UNIQUEMENT (pas Supabase).
-- Purement ADDITIF : 3 nouvelles tables, aucune donnee existante touchee. Reversible.
--
-- Modele (cf. [[project_outreach_engine]] + NEOUSBOT-OUTREACH-RUNBOOK.md) :
--   outreach_recipients = file d'envoi, 1 ligne = 1 entreprise ciblee (depuis aya_registry).
--   outreach_suppression = liste globale do-not-contact (desinscriptions + bounces durs).
--   outreach_events      = journal d'audit (sent / bounce / unsubscribe / complaint).
--
-- Canal = SMTP individuel throttle depuis une IDENTITE DEDIEE (outreach@/registry@),
-- JAMAIS la Newsletter Infomaniak (CGU opt-in) et JAMAIS hello@ (deliverabilite OTP/Stripe).

-- ── File d'envoi ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS outreach_recipients (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id         UUID,                          -- lien souple vers aya_registry (nullable)
  domain            TEXT,                          -- domaine bare (ex. "exemple.com")
  email             TEXT NOT NULL,                 -- adresse cible (depuis contact_email)
  display_name      TEXT,                          -- nom affiche de l'entreprise (personnalisation)
  sector_macro      TEXT,
  country_legal     TEXT,
  lang              TEXT NOT NULL DEFAULT 'en',     -- fr | en (choix du template)
  asr_score         NUMERIC(5,1),                  -- score AIO au moment de l'import (accroche)
  campaign          TEXT NOT NULL DEFAULT 'default',
  status            TEXT NOT NULL DEFAULT 'pending',-- pending | sent | bounced | failed | skipped | unsubscribed
  attempts          INT  NOT NULL DEFAULT 0,
  message_id        TEXT,                          -- Message-Id SMTP renvoye
  error             TEXT,
  unsubscribe_token TEXT NOT NULL,                 -- jeton opaque pour le lien de desinscription
  sent_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1 seule entree par (email, campagne) : pas de double envoi.
CREATE UNIQUE INDEX IF NOT EXISTS uq_outreach_recipients_email_campaign
  ON outreach_recipients (lower(email), campaign);
CREATE UNIQUE INDEX IF NOT EXISTS uq_outreach_recipients_token
  ON outreach_recipients (unsubscribe_token);
CREATE INDEX IF NOT EXISTS idx_outreach_recipients_status   ON outreach_recipients (status);
CREATE INDEX IF NOT EXISTS idx_outreach_recipients_campaign ON outreach_recipients (campaign);

-- ── Suppression globale (do-not-contact) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS outreach_suppression (
  email      TEXT PRIMARY KEY,                     -- lower(email)
  reason     TEXT,                                 -- unsubscribe | bounce | complaint | manual
  source     TEXT,                                 -- one-click | link | smtp | admin
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Journal d'audit ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS outreach_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID,
  email        TEXT,
  type         TEXT NOT NULL,                       -- sent | bounce | unsubscribe | complaint | open | error
  detail       JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outreach_events_recipient ON outreach_events (recipient_id);
CREATE INDEX IF NOT EXISTS idx_outreach_events_type      ON outreach_events (type);

-- ── Rollback (manuel) ────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS outreach_events;
-- DROP TABLE IF EXISTS outreach_suppression;
-- DROP TABLE IF EXISTS outreach_recipients;
