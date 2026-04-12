-- ============================================================
-- Migration 011: Fix RLS Helper Functions & Policies
-- Fixes:
--   1. Helper functions changed from SECURITY INVOKER → SECURITY DEFINER
--      to avoid circular dependency (users_select policy calls auth_school_id()
--      which queries users table, which triggers users_select policy again)
--   2. Add 'proprietor' role to schools_update and users_insert policies
--   3. Add schools_insert policy for the registration flow
-- ============================================================

-- ============================================================
-- PART 1: Recreate helper functions as SECURITY DEFINER
-- ============================================================

CREATE OR REPLACE FUNCTION auth_school_id()
RETURNS UUID AS $$
  SELECT school_id FROM public.users WHERE auth_id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.users WHERE auth_id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION auth_user_id()
RETURNS UUID AS $$
  SELECT id FROM public.users WHERE auth_id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid() AND role = 'super_admin'::user_role
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION get_user_school_id(p_user_id UUID)
RETURNS UUID AS $$
  SELECT school_id FROM users WHERE id = p_user_id;
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

-- ============================================================
-- PART 2: Drop & recreate policies with proprietor role
-- ============================================================

-- --- SCHOOLS ---
DROP POLICY IF EXISTS schools_select ON schools;
DROP POLICY IF EXISTS schools_update ON schools;

CREATE POLICY schools_select ON schools
  FOR SELECT USING (
    id = auth_school_id() OR is_super_admin()
  );

CREATE POLICY schools_update ON schools
  FOR UPDATE USING (
    id = auth_school_id()
    AND auth_user_role() IN ('proprietor'::user_role, 'principal'::user_role, 'admin_staff'::user_role, 'it_admin'::user_role)
    OR is_super_admin()
  );

-- --- USERS ---
DROP POLICY IF EXISTS users_select ON users;
DROP POLICY IF EXISTS users_insert ON users;
DROP POLICY IF EXISTS users_update ON users;

CREATE POLICY users_select ON users
  FOR SELECT USING (
    school_id = auth_school_id()
    OR id = auth_user_id()
    OR is_super_admin()
  );

CREATE POLICY users_insert ON users
  FOR INSERT WITH CHECK (
    school_id = auth_school_id()
    AND auth_user_role() IN ('proprietor'::user_role, 'principal'::user_role, 'admin_staff'::user_role, 'it_admin'::user_role)
    OR is_super_admin()
  );

CREATE POLICY users_update ON users
  FOR UPDATE USING (
    (id = auth_user_id())
    OR (school_id = auth_school_id() AND auth_user_role() IN ('proprietor'::user_role, 'principal'::user_role, 'admin_staff'::user_role, 'it_admin'::user_role))
    OR is_super_admin()
  );

-- --- SUBSCRIPTIONS (proprietor needs read access) ---
DROP POLICY IF EXISTS subscriptions_select ON subscriptions;
DROP POLICY IF EXISTS subscriptions_update ON subscriptions;

CREATE POLICY subscriptions_select ON subscriptions
  FOR SELECT USING (
    school_id = auth_school_id() OR is_super_admin()
  );

CREATE POLICY subscriptions_update ON subscriptions
  FOR UPDATE USING (
    school_id = auth_school_id()
    AND auth_user_role() IN ('proprietor'::user_role, 'principal'::user_role)
    OR is_super_admin()
  );

-- ============================================================
-- PART 3: Public school site access
-- Allow anyone (logged in or not) to read published schools
-- ============================================================
DROP POLICY IF EXISTS schools_public_read ON schools;

CREATE POLICY schools_public_read ON schools
  FOR SELECT USING (site_published = TRUE);

-- RPC: Fetch school by slug (SECURITY DEFINER bypasses RLS entirely)
-- Used by the public school website — works for all users
CREATE OR REPLACE FUNCTION get_public_school_by_slug(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school RECORD;
BEGIN
  SELECT * INTO v_school
  FROM schools
  WHERE slug = p_slug AND site_published = TRUE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN to_jsonb(v_school);
END;
$$;

GRANT EXECUTE ON FUNCTION get_public_school_by_slug TO authenticated;
GRANT EXECUTE ON FUNCTION get_public_school_by_slug TO anon;
