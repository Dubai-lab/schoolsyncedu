-- ============================================================
-- MIGRATION 009: FIX RLS CIRCULAR DEPENDENCY ON AUTH FUNCTIONS
-- Problem: auth helper functions (is_super_admin, auth_school_id, etc.)
--          use SECURITY INVOKER, so they hit RLS on the users table,
--          which calls those same functions → infinite loop / silent failure.
-- Fix:    Recreate with SECURITY DEFINER to bypass RLS when resolving auth.
-- ============================================================

-- Use CREATE OR REPLACE (no drop needed — just changes SECURITY attribute)
-- Only auth_guardian_student_ids needs DROP CASCADE due to return type mismatch

CREATE OR REPLACE FUNCTION auth_school_id()
RETURNS UUID AS $$
  SELECT school_id FROM public.users WHERE auth_id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.users WHERE auth_id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION auth_user_id()
RETURNS UUID AS $$
  SELECT id FROM public.users WHERE auth_id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid() AND role = 'super_admin'::user_role
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION auth_student_id()
RETURNS UUID AS $$
  SELECT s.id FROM students s
  JOIN users u ON s.user_id = u.id
  WHERE u.auth_id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

DROP FUNCTION IF EXISTS auth_guardian_student_ids() CASCADE;

CREATE OR REPLACE FUNCTION auth_guardian_student_ids()
RETURNS UUID[] AS $$
  SELECT ARRAY_AGG(g.student_id)
  FROM guardians g
  JOIN users u ON g.user_id = u.id
  WHERE u.auth_id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;
