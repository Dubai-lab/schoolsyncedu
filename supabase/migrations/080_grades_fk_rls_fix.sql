-- Migration 080: Fix grades/subjects PostgREST relationship + RLS
--
-- Problems:
--   1. PostgREST schema cache never got reloaded after the grades/subjects
--      tables were created (NOTIFY pgrst was missing). Students get
--      "PGRST200: Could not find a relationship" → 400 Bad Request.
--   2. Migration 079 failed midway (invalid enum 'dean') so RLS policies
--      may be partially applied. This migration is fully idempotent.
--
-- Fix:
--   1. Ensure FK constraints exist so PostgREST can resolve embedded joins
--   2. Re-apply all RLS policies cleanly (idempotent DROP IF EXISTS + CREATE)
--   3. NOTIFY pgrst to reload schema cache

-- ── 1. Ensure FK: grades.subject_id → subjects.id ─────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY'
      AND table_name = 'grades'
      AND constraint_name = 'grades_subject_id_fkey'
  ) THEN
    ALTER TABLE grades
      ADD CONSTRAINT grades_subject_id_fkey
      FOREIGN KEY (subject_id) REFERENCES subjects(id);
  END IF;
END $$;

-- ── 2. Ensure FK: grades.student_id → students.id ────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY'
      AND table_name = 'grades'
      AND constraint_name = 'grades_student_id_fkey'
  ) THEN
    ALTER TABLE grades
      ADD CONSTRAINT grades_student_id_fkey
      FOREIGN KEY (student_id) REFERENCES students(id);
  END IF;
END $$;

-- ── 3. RLS: grades ────────────────────────────────────────────────────────────
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view school grades"   ON grades;
DROP POLICY IF EXISTS "Students can view own grades"   ON grades;

CREATE POLICY "Staff can view school grades"
  ON grades FOR SELECT TO authenticated
  USING (
    school_id = auth_school_id()
    AND auth_user_role() != 'student'::user_role
  );

CREATE POLICY "Students can view own grades"
  ON grades FOR SELECT TO authenticated
  USING (
    school_id = auth_school_id()
    AND auth_user_role() = 'student'::user_role
    AND student_id IN (
      SELECT s.id FROM students s
      JOIN users u ON u.id = s.user_id
      WHERE u.auth_id = auth.uid()
    )
  );

-- ── 4. RLS: subjects ──────────────────────────────────────────────────────────
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School members can view subjects" ON subjects;
DROP POLICY IF EXISTS "Staff can manage subjects"        ON subjects;

CREATE POLICY "School members can view subjects"
  ON subjects FOR SELECT TO authenticated
  USING (school_id = auth_school_id());

CREATE POLICY "Staff can manage subjects"
  ON subjects FOR ALL TO authenticated
  USING (
    school_id = auth_school_id()
    AND auth_user_role() IN (
      'principal'::user_role,
      'vice_principal'::user_role,
      'registrar'::user_role,
      'admin_staff'::user_role,
      'it_admin'::user_role,
      'teacher'::user_role,
      'dean_of_students'::user_role
    )
  );

-- ── 5. RLS: class_subjects (no school_id — scope via class_id) ───────────────
ALTER TABLE class_subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School members can view class subjects" ON class_subjects;
DROP POLICY IF EXISTS "Staff can manage class subjects"        ON class_subjects;

CREATE POLICY "School members can view class subjects"
  ON class_subjects FOR SELECT TO authenticated
  USING (
    class_id IN (SELECT id FROM classes WHERE school_id = auth_school_id())
  );

CREATE POLICY "Staff can manage class subjects"
  ON class_subjects FOR ALL TO authenticated
  USING (
    class_id IN (SELECT id FROM classes WHERE school_id = auth_school_id())
    AND auth_user_role() IN (
      'principal'::user_role,
      'vice_principal'::user_role,
      'registrar'::user_role,
      'admin_staff'::user_role,
      'it_admin'::user_role,
      'teacher'::user_role,
      'dean_of_students'::user_role
    )
  );

-- ── 6. Reload PostgREST schema cache ──────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
