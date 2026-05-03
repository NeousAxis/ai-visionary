-- Migration 1er mai 2026 : table linkedin_posts
-- A appliquer sur Supabase (sanctuaire) ET Postgres VPS aya_local
-- Note : sur Supabase, ecriture autorisee uniquement par cette migration
--        (pas un batch en masse, juste create + insert au fil de l'eau)

CREATE TABLE IF NOT EXISTS linkedin_posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id       UUID NOT NULL,
  entity_domain   TEXT NOT NULL,
  entity_name     TEXT NOT NULL,
  current_score   INTEGER NOT NULL,
  projected_score INTEGER NOT NULL,
  post_text       TEXT NOT NULL,
  post_locale     TEXT NOT NULL DEFAULT 'fr',
  status          TEXT NOT NULL DEFAULT 'draft', -- draft | published | failed | skipped
  linkedin_post_url TEXT,
  scheduled_at    TIMESTAMPTZ DEFAULT NOW(),
  published_at    TIMESTAMPTZ,
  error_message   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_linkedin_posts_entity_id   ON linkedin_posts (entity_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_posts_status      ON linkedin_posts (status);
CREATE INDEX IF NOT EXISTS idx_linkedin_posts_scheduled   ON linkedin_posts (scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_linkedin_posts_domain      ON linkedin_posts (entity_domain);

-- Anti-doublon : 1 entite ne peut pas etre postee plus d'une fois par 30 jours
-- (verification cote applicatif, pas via constraint, pour permettre re-posts forces)
