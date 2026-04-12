-- ============================================================
-- Migration 030: Add missing SELECT policies for subjects,
-- class_subjects, and timetables.
--
-- Table schemas (from migration 001):
--   subjects      — has school_id
--   class_subjects — NO school_id, scoped via class_id → classes
--   timetables    — NO school_id, scoped via class_id → classes
-- ============================================================

-- ── subjects (has school_id) ──────────────────────────────────
DROP POLICY IF EXISTS subjects_select_policy ON subjects;
CREATE POLICY subjects_select_policy ON subjects
  FOR SELECT USING (
    school_id = auth_school_id()
    OR is_super_admin()
  );

-- ── class_subjects (no school_id — scope via classes) ─────────
DROP POLICY IF EXISTS class_subjects_select_policy ON class_subjects;
CREATE POLICY class_subjects_select_policy ON class_subjects
  FOR SELECT USING (
    class_id IN (SELECT id FROM classes WHERE school_id = auth_school_id())
    OR is_super_admin()
  );

-- ── timetables (no school_id — scope via class_id → classes) ──
DROP POLICY IF EXISTS timetables_select_policy ON timetables;
CREATE POLICY timetables_select_policy ON timetables
  FOR SELECT USING (
    class_id IN (SELECT id FROM classes WHERE school_id = auth_school_id())
    OR is_super_admin()
  );

DROP POLICY IF EXISTS timetables_insert_policy ON timetables;
CREATE POLICY timetables_insert_policy ON timetables
  FOR INSERT WITH CHECK (
    class_id IN (SELECT id FROM classes WHERE school_id = auth_school_id())
    AND auth_user_role() IN (
      'principal'::user_role, 'vice_principal'::user_role,
      'admin_staff'::user_role, 'registrar'::user_role
    )
    OR is_super_admin()
  );

DROP POLICY IF EXISTS timetables_update_policy ON timetables;
CREATE POLICY timetables_update_policy ON timetables
  FOR UPDATE USING (
    class_id IN (SELECT id FROM classes WHERE school_id = auth_school_id())
    AND auth_user_role() IN (
      'principal'::user_role, 'vice_principal'::user_role,
      'admin_staff'::user_role, 'registrar'::user_role
    )
    OR is_super_admin()
  );

NOTIFY pgrst, 'reload schema';
