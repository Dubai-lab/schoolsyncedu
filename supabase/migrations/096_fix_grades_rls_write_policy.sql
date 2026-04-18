-- Migration 096: Fix grades write RLS — 42883 user_role = text
--
-- Problem: migration 095 wrote "Staff can write grades" using
--   auth_user_role() IN ('teacher'::user_role, ...)
-- auth_user_role() returns the user_role enum type. PostgreSQL evaluates
-- each IN-list element comparison as  user_role = user_role  which should
-- work — BUT if auth_user_role() is defined to return TEXT in this project
-- the cast to ::user_role flips it to  text = user_role  → 42883.
--
-- Fix: replace auth_user_role() comparisons with an EXISTS subquery that
-- reads role directly from the users table and casts it to TEXT before
-- comparing, which is safe regardless of the function's return type.

-- ── grades write policy (teachers + senior staff) ────────────────────────────
DROP POLICY IF EXISTS "Staff can write grades" ON grades;
CREATE POLICY "Staff can write grades"
  ON grades FOR ALL TO authenticated
  USING (
    school_id = auth_school_id()
    AND EXISTS (
      SELECT 1 FROM users u
       WHERE u.auth_id = auth.uid()
         AND u.role::TEXT IN (
           'teacher','principal','vice_principal',
           'admin_staff','it_admin','super_admin'
         )
    )
  )
  WITH CHECK (
    school_id = auth_school_id()
    AND EXISTS (
      SELECT 1 FROM users u
       WHERE u.auth_id = auth.uid()
         AND u.role::TEXT IN (
           'teacher','principal','vice_principal',
           'admin_staff','it_admin','super_admin'
         )
    )
  );

-- ── Re-apply read policies using the same safe pattern ───────────────────────
DROP POLICY IF EXISTS "Staff can view school grades" ON grades;
CREATE POLICY "Staff can view school grades"
  ON grades FOR SELECT TO authenticated
  USING (
    school_id = auth_school_id()
    AND EXISTS (
      SELECT 1 FROM users u
       WHERE u.auth_id = auth.uid()
         AND u.role::TEXT != 'student'
    )
  );

DROP POLICY IF EXISTS "Students can view own grades" ON grades;
CREATE POLICY "Students can view own grades"
  ON grades FOR SELECT TO authenticated
  USING (
    school_id = auth_school_id()
    AND student_id IN (
      SELECT s.id FROM students s
      JOIN users u ON u.id = s.user_id
      WHERE u.auth_id = auth.uid()
        AND u.role::TEXT = 'student'
    )
  );

NOTIFY pgrst, 'reload schema';
