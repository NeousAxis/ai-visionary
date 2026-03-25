-- =============================================================================
-- RLS POLICIES — AI Visionary (Supabase)
-- =============================================================================
-- Date: 2026-03-24
-- Purpose: Enable Row Level Security on ALL tables to prevent public access.
--
-- IMPORTANT: The Node.js backend uses SUPABASE_SERVICE_ROLE_KEY which
-- automatically bypasses RLS. This script ONLY affects access via:
--   - anon key (public/unauthenticated requests)
--   - authenticated users (if any in the future)
--
-- HOW TO RUN:
--   1. Open Supabase Dashboard > SQL Editor
--   2. Paste this entire file
--   3. Click "Run"
--   4. Verify in Table Editor > each table shows "RLS enabled"
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ENABLE RLS ON ALL TABLES
-- -----------------------------------------------------------------------------

ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aya_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 2. DROP EXISTING POLICIES (idempotent — safe to re-run)
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "aya_registry_public_read" ON public.aya_registry;
DROP POLICY IF EXISTS "analyses_deny_all" ON public.analyses;
DROP POLICY IF EXISTS "scan_states_deny_all" ON public.scan_states;
DROP POLICY IF EXISTS "system_logs_deny_all" ON public.system_logs;
DROP POLICY IF EXISTS "otp_codes_deny_all" ON public.otp_codes;
DROP POLICY IF EXISTS "sessions_deny_all" ON public.sessions;

-- -----------------------------------------------------------------------------
-- 3. aya_registry — PUBLIC READ (for the API), no public write
-- -----------------------------------------------------------------------------
-- The /api/aya/* endpoints use service_role_key for writes (bot indexing,
-- payment webhook). Public SELECT is needed so the anon key can read
-- entities for the public registry page and API consumers.

CREATE POLICY "aya_registry_public_read"
    ON public.aya_registry
    FOR SELECT
    USING (true);

-- No INSERT/UPDATE/DELETE policy for anon/authenticated = denied by default.
-- Only service_role_key (which bypasses RLS) can write.

-- -----------------------------------------------------------------------------
-- 4. analyses — NO PUBLIC ACCESS (service_role only)
-- -----------------------------------------------------------------------------
-- Contains diagnostic results, emails, scores. Strictly server-side.
-- With RLS enabled and NO policy, all access via anon/authenticated is denied.
-- service_role_key bypasses RLS automatically.

-- (No policy needed — RLS enabled + no policy = deny all for non-service-role)

-- -----------------------------------------------------------------------------
-- 5. scan_states — NO PUBLIC ACCESS (service_role only)
-- -----------------------------------------------------------------------------
-- Intermediate scan states. Server-side only.

-- (No policy needed)

-- -----------------------------------------------------------------------------
-- 6. system_logs — NO PUBLIC ACCESS (service_role only)
-- -----------------------------------------------------------------------------
-- Internal system logs. Server-side only.

-- (No policy needed)

-- -----------------------------------------------------------------------------
-- 7. otp_codes — NO PUBLIC ACCESS (service_role only)
-- -----------------------------------------------------------------------------
-- One-time passwords. Extremely sensitive. Server-side only.

-- (No policy needed)

-- -----------------------------------------------------------------------------
-- 8. sessions — NO PUBLIC ACCESS (service_role only)
-- -----------------------------------------------------------------------------
-- User sessions. Server-side only.

-- (No policy needed)

-- =============================================================================
-- VERIFICATION QUERY — Run after applying to confirm RLS is active
-- =============================================================================
-- SELECT schemaname, tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN ('analyses', 'aya_registry', 'scan_states', 'system_logs', 'otp_codes', 'sessions');
--
-- Expected: rowsecurity = true for ALL 6 tables
-- =============================================================================
