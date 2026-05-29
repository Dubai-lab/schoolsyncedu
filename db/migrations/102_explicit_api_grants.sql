-- ============================================================
-- 102_explicit_api_grants.sql
-- ============================================================
-- Supabase is removing the implicit "expose all public tables"
-- behaviour on October 30 2026.  This migration adds explicit
-- GRANTs so PostgREST / supabase-js keep working after that date
-- for both existing tables and any new tables created in future.
--
-- RLS policies remain unchanged — these grants only allow the
-- Data API to REACH the tables; row-level security still controls
-- which rows each role can actually read or modify.
-- ============================================================

-- ── 1. Schema-level usage ────────────────────────────────────
-- Both roles must be able to "see" the schema before any table
-- grant matters.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- ── 2. All existing tables ───────────────────────────────────
-- authenticated: full CRUD (RLS policies restrict per row)
-- anon:          SELECT only (public-facing reads — RLS still applies)
GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA public TO authenticated;

GRANT SELECT
  ON ALL TABLES IN SCHEMA public TO anon;

-- service_role bypasses RLS and already has superuser-like access
-- inside Supabase Edge Functions / service key calls.
GRANT ALL
  ON ALL TABLES IN SCHEMA public TO service_role;

-- ── 3. All existing sequences ────────────────────────────────
-- Required for INSERT on tables that use SERIAL / IDENTITY columns.
GRANT USAGE, SELECT
  ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon, service_role;

-- ── 4. All existing functions ────────────────────────────────
-- RPCs called via supabase.rpc() need EXECUTE.
GRANT EXECUTE
  ON ALL FUNCTIONS IN SCHEMA public TO authenticated, anon, service_role;

-- ── 5. Default privileges for FUTURE objects ─────────────────
-- Any table / sequence / function created after this migration
-- is automatically granted without needing another migration.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated, anon, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO authenticated, anon, service_role;
