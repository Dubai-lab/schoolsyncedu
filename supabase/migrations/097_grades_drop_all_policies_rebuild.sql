-- Migration 097: Drop ALL grades RLS policies and rebuild cleanly
--
-- 42883 "user_role = text" persists after 095+096 because there are
-- older policies on the grades table (created before migration 079)
-- that neither 095 nor 096 dropped. This migration uses dynamic SQL
-- to drop every policy on grades regardless of name, then rebuilds
-- only the 3 correct policies using role::TEXT to avoid enum type issues.

-- ── Drop every policy on grades (dynamic, catches any hidden ones) ────────────
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'grades'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON grades', pol.policyname);
  END LOOP;
END $$;

-- ── Rebuild: teachers + senior staff can read and write their school's grades ──
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

-- ── Rebuild: non-student staff can read all grades in their school ────────────
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

-- ── Rebuild: students can read only their own approved grades ─────────────────
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
