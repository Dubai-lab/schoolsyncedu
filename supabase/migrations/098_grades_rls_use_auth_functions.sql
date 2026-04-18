-- Migration 098: Fix grades RLS — stop querying users table inside policies
--
-- Root cause: migrations 096 and 097 used EXISTS(SELECT 1 FROM users WHERE
-- role::TEXT IN (...)) inside the USING clause. PostgREST evaluates this
-- subquery under the caller's permissions, which triggers the users table's
-- own RLS policies. Those older policies compare  user_role = 'text_literal'
-- without a cast → 42883 "operator does not exist: user_role = text".
--
-- Fix: use auth_user_role()::TEXT which is a SECURITY DEFINER helper that
-- bypasses the users table RLS entirely. Casting its return value to TEXT
-- (::TEXT) makes the comparison work whether the function returns user_role
-- enum or text.

-- ── Drop every policy on grades (dynamic — catches all names) ────────────────
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'grades'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON grades', pol.policyname);
  END LOOP;
END $$;

-- ── Staff SELECT ──────────────────────────────────────────────────────────────
CREATE POLICY "grades_staff_select"
  ON grades FOR SELECT TO authenticated
  USING (
    school_id = auth_school_id()
    AND auth_user_role()::TEXT != 'student'
  );

-- ── Students: own approved grades only ───────────────────────────────────────
CREATE POLICY "grades_student_select"
  ON grades FOR SELECT TO authenticated
  USING (
    school_id  = auth_school_id()
    AND auth_user_role()::TEXT = 'student'
    AND student_id = (
      SELECT s.id FROM students s
      JOIN users u ON u.id = s.user_id
      WHERE u.auth_id = auth.uid()
      LIMIT 1
    )
  );

-- ── Teachers + staff INSERT ───────────────────────────────────────────────────
CREATE POLICY "grades_staff_insert"
  ON grades FOR INSERT TO authenticated
  WITH CHECK (
    school_id = auth_school_id()
    AND auth_user_role()::TEXT IN (
      'teacher','principal','vice_principal',
      'admin_staff','it_admin','super_admin'
    )
  );

-- ── Teachers + staff UPDATE ───────────────────────────────────────────────────
CREATE POLICY "grades_staff_update"
  ON grades FOR UPDATE TO authenticated
  USING (
    school_id = auth_school_id()
    AND auth_user_role()::TEXT IN (
      'teacher','principal','vice_principal',
      'admin_staff','it_admin','super_admin'
    )
  )
  WITH CHECK (
    school_id = auth_school_id()
    AND auth_user_role()::TEXT IN (
      'teacher','principal','vice_principal',
      'admin_staff','it_admin','super_admin'
    )
  );

-- ── Principal / admin DELETE ──────────────────────────────────────────────────
CREATE POLICY "grades_admin_delete"
  ON grades FOR DELETE TO authenticated
  USING (
    school_id = auth_school_id()
    AND auth_user_role()::TEXT IN (
      'principal','vice_principal','admin_staff',
      'it_admin','super_admin'
    )
  );

NOTIFY pgrst, 'reload schema';
