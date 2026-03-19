-- =============================================================
-- AI VISIONARY — Supabase Schema (migrated from Firestore)
-- Generated: 2026-03-19
-- =============================================================
-- Collections Firestore -> Tables Supabase :
--   analyses       -> analyses
--   aya_registry   -> aya_registry
--   scan_states    -> scan_states
--   system_logs    -> system_logs  (was 'system_logs' in Firestore logger.ts)
--   otps           -> otp_codes
--   sessions       -> sessions     (OTP auth sessions from verify-otp)
-- =============================================================

-- 0. EXTENSIONS
-- gen_random_uuid() requires pgcrypto
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================
-- UTILITY : updated_at auto-refresh trigger
-- =============================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================
-- UTILITY : URL normalization
-- Strips protocol (http/https), www., trailing slash, forces lowercase domain
-- Mirrors db.ts normalizeUrl() logic exactly
-- =============================================================
CREATE OR REPLACE FUNCTION normalize_url(url TEXT)
RETURNS TEXT AS $$
DECLARE
    result TEXT;
BEGIN
    result := LOWER(TRIM(url));
    -- Remove protocol
    result := REGEXP_REPLACE(result, '^https?://', '');
    -- Remove www.
    result := REGEXP_REPLACE(result, '^www\.', '');
    -- Remove trailing slash
    result := REGEXP_REPLACE(result, '/$', '');
    RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================
-- 1. TABLE : analyses
-- =============================================================
-- Firestore collection: 'analyses'
-- Doc ID = sessionAsrId (ex: "asr_abc123...")
-- Fields saved by db.saveAnalysis():
--   id, url, email (nullable), score, data (JSONB), timestamp
-- data contains: { fields, blocks, scan, analysis_blocks }
-- =============================================================
CREATE TABLE analyses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url             TEXT NOT NULL,
    url_normalized  TEXT GENERATED ALWAYS AS (normalize_url(url)) STORED,
    email           TEXT,
    score           NUMERIC(5,1) DEFAULT 0,
    raw_score       NUMERIC(5,1),
    data            JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- data structure: {
    --   fields: { identite: {...}, offre: {...}, ... },
    --   blocks: { identite: N, offre: N, ... },
    --   scan: { is_reachable, has_jsonld, ... },
    --   analysis_blocks: { ... }
    -- }
    pack_type       TEXT,  -- 'light', 'aya', 'pro'
    stripe_session_id TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_analyses_url_normalized ON analyses (url_normalized);
CREATE INDEX idx_analyses_email ON analyses (email) WHERE email IS NOT NULL;
CREATE INDEX idx_analyses_created_at ON analyses (created_at DESC);
CREATE INDEX idx_analyses_url ON analyses (url);

-- Auto-update updated_at
CREATE TRIGGER set_analyses_updated_at
    BEFORE UPDATE ON analyses
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================
-- 2. TABLE : aya_registry
-- =============================================================
-- Firestore collection: 'aya_registry'
-- Doc ID = aya_entity_id (UUID)
-- Based on AyaEntity interface (lib/aya/schema.ts)
-- + dynamic field contact_email (used by OTP auth & Stripe portal)
-- =============================================================
CREATE TABLE aya_registry (
    entity_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legal_name          TEXT NOT NULL DEFAULT 'Unknown Entity',
    display_name        TEXT NOT NULL DEFAULT 'Entreprise',
    entity_type         TEXT NOT NULL DEFAULT 'company'
                        CHECK (entity_type IN ('company', 'association', 'individual', 'public_body')),
    country_legal       TEXT NOT NULL DEFAULT 'XX',   -- ISO 2-letter code
    sector_macro        TEXT NOT NULL DEFAULT 'General',
    website             TEXT,
    website_normalized  TEXT GENERATED ALWAYS AS (normalize_url(COALESCE(website, ''))) STORED,
    asr_score           NUMERIC(5,1) DEFAULT 0,       -- Score AIO 0-100
    payment_completed   BOOLEAN NOT NULL DEFAULT FALSE,

    -- Contact (not in TypeScript interface but used by OTP auth + Stripe portal)
    contact_email       TEXT,

    -- Temporality
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_update         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_until         TIMESTAMPTZ,

    -- Origin
    data_origin         TEXT NOT NULL DEFAULT 'AYO',

    -- ASR Payload (the treasure) — full JSON blob
    -- Structure: { version: "1.0", data: {...}, signature: { hash, public_key } }
    asr_payload         JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Recommendability engine (computed)
    -- Structure: { machine_readable, status, freshness_score, priority_level, source_url }
    recommendability    JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Unique constraint on website to prevent duplicates (mirrors registry.ts dedup logic)
CREATE UNIQUE INDEX idx_aya_registry_website_unique
    ON aya_registry (website_normalized)
    WHERE website IS NOT NULL AND website != '';

-- Indexes
CREATE INDEX idx_aya_registry_website ON aya_registry (website);
CREATE INDEX idx_aya_registry_payment ON aya_registry (payment_completed) WHERE payment_completed = TRUE;
CREATE INDEX idx_aya_registry_status ON aya_registry USING GIN (recommendability jsonb_path_ops);
CREATE INDEX idx_aya_registry_last_update ON aya_registry (last_update DESC);

-- Auto-update last_update on any modification
CREATE TRIGGER set_aya_registry_last_update
    BEFORE UPDATE ON aya_registry
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================
-- 3. TABLE : scan_states
-- =============================================================
-- Firestore collection: 'scan_states'
-- Doc ID = base64url(url).substring(0,128)
-- Two save patterns:
--   chat/route.ts: { ...scanState, created_at, url }
--     scanState = { detected, confidence, high_confidence_keys, low_confidence_keys, unknown_keys }
--   scanner.ts:   { url, normalizedUrl, scanResult, scannedAt }
--     scanResult = { is_reachable, has_jsonld, jsonld_count, ... }
-- =============================================================
CREATE TABLE scan_states (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url             TEXT NOT NULL,
    url_normalized  TEXT GENERATED ALWAYS AS (normalize_url(url)) STORED,
    state           JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- state holds ALL scan data (detected, confidence, scanResult, etc.)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scan_states_url ON scan_states (url);
CREATE INDEX idx_scan_states_url_normalized ON scan_states (url_normalized);

-- =============================================================
-- 4. TABLE : system_logs (was 'system_logs' in Firestore via logger.ts)
-- =============================================================
-- Firestore collection: 'system_logs'
-- Fields: correlation_id, level, source, step, message, data, timestamp, _created
-- =============================================================
CREATE TABLE system_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    correlation_id  TEXT NOT NULL,
    level           TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error', 'critical')),
    source          TEXT NOT NULL,  -- 'chat', 'webhook', 'scanner', 'crypto', 'db', 'auth', 'admin', 'checkout', 'email', 'system', 'stripe'
    step            TEXT NOT NULL,
    message         TEXT NOT NULL,
    data            JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_system_logs_level ON system_logs (level);
CREATE INDEX idx_system_logs_correlation ON system_logs (correlation_id);
CREATE INDEX idx_system_logs_created_at ON system_logs (created_at DESC);
CREATE INDEX idx_system_logs_source ON system_logs (source);

-- =============================================================
-- 5. TABLE : otp_codes
-- =============================================================
-- Firestore collection: 'otps'
-- Doc ID = email.replace(/[^a-zA-Z0-9]/g, '_')
-- Fields: email, code, created_at, expires_at
-- One active OTP per email (overwritten on new request)
-- =============================================================
CREATE TABLE otp_codes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT NOT NULL,
    code            TEXT NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    used            BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_otp_codes_email ON otp_codes (email);
CREATE INDEX idx_otp_codes_expires ON otp_codes (expires_at);

-- =============================================================
-- 6. TABLE : sessions (OTP auth sessions from verify-otp/route.ts)
-- =============================================================
-- Firestore collection: 'sessions'
-- Doc ID = sessionToken.substring(0, 40)
-- Fields: email, url, token_hash, created_at, expires_at
-- =============================================================
CREATE TABLE sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT NOT NULL,
    url             TEXT NOT NULL,
    token_hash      TEXT NOT NULL UNIQUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_sessions_token_hash ON sessions (token_hash);
CREATE INDEX idx_sessions_expires ON sessions (expires_at);

-- =============================================================
-- RLS : Disabled for now (server-side service_role_key only)
-- =============================================================
ALTER TABLE analyses      DISABLE ROW LEVEL SECURITY;
ALTER TABLE aya_registry  DISABLE ROW LEVEL SECURITY;
ALTER TABLE scan_states   DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs   DISABLE ROW LEVEL SECURITY;
ALTER TABLE otp_codes     DISABLE ROW LEVEL SECURITY;
ALTER TABLE sessions      DISABLE ROW LEVEL SECURITY;

-- =============================================================
-- COMMENTS (documentation in-schema)
-- =============================================================
COMMENT ON TABLE analyses IS 'AIO scan analyses — one per chat session/URL. data JSONB holds fields, blocks, scan, analysis_blocks.';
COMMENT ON TABLE aya_registry IS 'AYA entity registry — businesses registered after payment. Unique per website.';
COMMENT ON TABLE scan_states IS 'Intermediate scan states — cached deep-scan results per URL.';
COMMENT ON TABLE system_logs IS 'Centralized structured logs (correlation_id tracing). Replaces Firestore system_logs collection.';
COMMENT ON TABLE otp_codes IS 'One-time passwords for entity admin authentication. 10min TTL.';
COMMENT ON TABLE sessions IS 'Authenticated OTP sessions. 1h TTL. Token verified via HMAC.';

COMMENT ON FUNCTION normalize_url(TEXT) IS 'Normalize URL: lowercase, strip protocol/www/trailing slash. Mirrors db.ts normalizeUrl().';
COMMENT ON FUNCTION trigger_set_updated_at() IS 'Auto-set updated_at to NOW() on row update.';
