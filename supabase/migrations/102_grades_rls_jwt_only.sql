-- Migration 102: Rewrite grades RLS policies using JWT claims only
--
-- Root cause of persistent 42883 "user_role = text":
-- All grades policies call auth_user_role() which returns user_role enum.
-- Even though we do ::TEXT cast, the STABLE function may be inlined by the
-- query planner, and at that point some comparison in the inlined body
-- causes user_role = text.
--
-- Fix: stop calling auth_user_role() or auth_school_id() in grades policies.
-- Instead, read role and school_id from request.jwt.claims directly.
-- All comparisons become TEXT = TEXT or UUID = UUID — no enums.

-- ── Drop every policy on grades ───────────────────────────────────────────────
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

-- ── Helper expression (inline) ─────────────────────────────────────────────
-- Instead of calling auth_user_role() (returns user_role enum) we read the
-- role string directly from the JWT:
--   current_setting('request.jwt.claims', true)::jsonb->'user_metadata'->>'role'
-- This returns TEXT. No enum involved anywhere.

-- ── Staff SELECT ──────────────────────────────────────────────────────────────
CREATE POLICY "grades_staff_select"
  ON grades FOR SELECT TO authenticated
  USING (
    school_id = (
      current_setting('request.jwt.claims', true)::jsonb
      ->'user_metadata'->>'school_id'
    )::uuid
    AND (
      current_setting('request.jwt.claims', true)::jsonb
      ->'user_metadata'->>'role'
    ) != 'student'
  );

-- ── Student SELECT: own grades only ──────────────────────────────────────────
CREATE POLICY "grades_student_select"
  ON grades FOR SELECT TO authenticated
  USING (
    school_id = (
      current_setting('request.jwt.claims', true)::jsonb
      ->'user_metadata'->>'school_id'
    )::uuid
    AND (
      current_setting('request.jwt.claims', true)::jsonb
      ->'user_metadata'->>'role'
    ) = 'student'
    AND student_id IN (
      SELECT s.id FROM students s
      JOIN users u ON u.id = s.user_id
      WHERE u.auth_id = auth.uid()
    )
  );

-- ── Staff INSERT ──────────────────────────────────────────────────────────────
CREATE POLICY "grades_staff_insert"
  ON grades FOR INSERT TO authenticated
  WITH CHECK (
    school_id = (
      current_setting('request.jwt.claims', true)::jsonb
      ->'user_metadata'->>'school_id'
    )::uuid
    AND (
      current_setting('request.jwt.claims', true)::jsonb
      ->'user_metadata'->>'role'
    ) IN ('teacher','principal','vice_principal','admin_staff','it_admin','super_admin')
  );

-- ── Staff UPDATE ──────────────────────────────────────────────────────────────
CREATE POLICY "grades_staff_update"
  ON grades FOR UPDATE TO authenticated
  USING (
    school_id = (
      current_setting('request.jwt.claims', true)::jsonb
      ->'user_metadata'->>'school_id'
    )::uuid
    AND (
      current_setting('request.jwt.claims', true)::jsonb
      ->'user_metadata'->>'role'
    ) IN ('teacher','principal','vice_principal','admin_staff','it_admin','super_admin')
  )
  WITH CHECK (
    school_id = (
      current_setting('request.jwt.claims', true)::jsonb
      ->'user_metadata'->>'school_id'
    )::uuid
    AND (
      current_setting('request.jwt.claims', true)::jsonb
      ->'user_metadata'->>'role'
    ) IN ('teacher','principal','vice_principal','admin_staff','it_admin','super_admin')
  );

-- ── Admin DELETE ──────────────────────────────────────────────────────────────
CREATE POLICY "grades_admin_delete"
  ON grades FOR DELETE TO authenticated
  USING (
    school_id = (
      current_setting('request.jwt.claims', true)::jsonb
      ->'user_metadata'->>'school_id'
    )::uuid
    AND (
      current_setting('request.jwt.claims', true)::jsonb
      ->'user_metadata'->>'role'
    ) IN ('principal','vice_principal','admin_staff','it_admin','super_admin')
  );

NOTIFY pgrst, 'reload schema';
