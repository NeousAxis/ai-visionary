-- Migration 24 juin 2026 (d) : FERME À AGENTS (bootstrap côté demande).
-- Nos propres agents IA interrogent AYA en boucle (on est notre premier "opérateur
-- d'agent") → prouve la boucle, génère de la demande réelle sur le registre, exerce
-- le cashback. Additif, réversible. Postgres VPS aya_local uniquement.

CREATE TABLE IF NOT EXISTS agent_farm_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona       TEXT,                 -- verticale de l'agent (saas, fintech, ecommerce…)
  lang          TEXT,                 -- fr | en
  query         TEXT,                 -- besoin en langage naturel
  keyword       TEXT,                 -- mot-clé résolu par l'agent
  picks_count   INT NOT NULL DEFAULT 0,
  chosen_domain TEXT,                 -- 1er résultat recommandé
  chosen_name   TEXT,
  had_cashback  BOOLEAN NOT NULL DEFAULT false,
  answer        TEXT,                 -- recommandation rédigée par l'agent
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_farm_runs_persona ON agent_farm_runs (persona);
CREATE INDEX IF NOT EXISTS idx_agent_farm_runs_created ON agent_farm_runs (created_at);

-- Rollback : DROP TABLE IF EXISTS agent_farm_runs;
