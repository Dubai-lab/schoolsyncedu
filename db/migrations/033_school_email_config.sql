-- ============================================================
-- Migration 033: Per-school email / SMTP configuration
--
-- Each school's IT Admin can configure their own SMTP server
-- so that all outgoing emails (acceptance letters, rejection
-- letters, notifications) are sent from the school's own
-- domain email address.
--
-- The Edge Function reads config via get_school_smtp_config()
-- SECURITY DEFINER so credentials are never exposed to the
-- browser client.
-- ============================================================

CREATE TABLE IF NOT EXISTS school_email_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL UNIQUE REFERENCES schools(id) ON DELETE CASCADE,

  -- SMTP connection
  smtp_host       TEXT NOT NULL DEFAULT '',
  smtp_port       INTEGER NOT NULL DEFAULT 587,
  smtp_secure     BOOLEAN NOT NULL DEFAULT FALSE,   -- true = SSL/465, false = STARTTLS/587
  smtp_user       TEXT NOT NULL DEFAULT '',
  smtp_pass       TEXT NOT NULL DEFAULT '',         -- stored encrypted at rest by Supabase

  -- Sender identity
  from_name       TEXT NOT NULL DEFAULT '',         -- e.g. "Saint John Academy"
  from_address    TEXT NOT NULL DEFAULT '',         -- e.g. admissions@saintjohn.edu.lr
  reply_to        TEXT,                             -- optional reply-to address

  -- Status
  is_verified     BOOLEAN NOT NULL DEFAULT FALSE,   -- set to true after a successful test send
  last_tested_at  TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_school_email_configs_school_id ON school_email_configs(school_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION touch_school_email_config()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_touch_school_email_config ON school_email_configs;
CREATE TRIGGER trg_touch_school_email_config
  BEFORE UPDATE ON school_email_configs
  FOR EACH ROW EXECUTE FUNCTION touch_school_email_config();

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE school_email_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS school_email_configs_select ON school_email_configs;
CREATE POLICY school_email_configs_select ON school_email_configs
  FOR SELECT USING (
    school_id = auth_school_id()
    AND auth_user_role() IN ('it_admin'::user_role, 'principal'::user_role, 'proprietor'::user_role)
    OR is_super_admin()
  );

DROP POLICY IF EXISTS school_email_configs_insert ON school_email_configs;
CREATE POLICY school_email_configs_insert ON school_email_configs
  FOR INSERT WITH CHECK (
    school_id = auth_school_id()
    AND auth_user_role() IN ('it_admin'::user_role, 'principal'::user_role)
    OR is_super_admin()
  );

DROP POLICY IF EXISTS school_email_configs_update ON school_email_configs;
CREATE POLICY school_email_configs_update ON school_email_configs
  FOR UPDATE USING (
    school_id = auth_school_id()
    AND auth_user_role() IN ('it_admin'::user_role, 'principal'::user_role)
    OR is_super_admin()
  );

-- ── SECURITY DEFINER RPC (used by Edge Function) ─────────────
-- Returns SMTP credentials for a given school so the Edge
-- Function can fetch them server-side without exposing secrets
-- to the browser. Granted to service_role only.
DROP FUNCTION IF EXISTS get_school_smtp_config(UUID);
CREATE FUNCTION get_school_smtp_config(p_school_id UUID)
RETURNS TABLE (
  smtp_host     TEXT,
  smtp_port     INTEGER,
  smtp_secure   BOOLEAN,
  smtp_user     TEXT,
  smtp_pass     TEXT,
  from_name     TEXT,
  from_address  TEXT,
  reply_to      TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    smtp_host, smtp_port, smtp_secure,
    smtp_user, smtp_pass,
    from_name, from_address, reply_to
  FROM school_email_configs
  WHERE school_id = p_school_id
  LIMIT 1;
$$;

-- Only the Edge Function (service_role) should call this directly.
-- Authenticated users configure via the IT Admin settings page.
GRANT EXECUTE ON FUNCTION get_school_smtp_config(UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
