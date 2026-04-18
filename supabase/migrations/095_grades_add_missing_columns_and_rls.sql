-- Migration 095: Add missing columns to grades table + teacher write RLS
--
-- PGRST204 "Column not found" error: the grades table was created before
-- migration 060 with only basic columns (id, school_id, student_id,
-- subject_id, academic_year, semester, score, created_at, updated_at).
-- The service sends component scores, letter_grade, gpa_points, entered_by,
-- entered_at, status, etc. — these columns were never added to the DB.
--
-- Also: migrations 079/080 only added SELECT policies; teachers have no
-- INSERT or UPDATE permission on grades, so upsert returns 403.

-- ════════════════════════════════════════════════════════════════
-- PART 1: Add missing columns (all idempotent via IF NOT EXISTS)
-- ════════════════════════════════════════════════════════════════

-- Component scores (Liberian grading: Assignment/20 + Quiz/20 + Test/20 + Exam/40)
ALTER TABLE grades ADD COLUMN IF NOT EXISTS assignment_score NUMERIC(5,2);
ALTER TABLE grades ADD COLUMN IF NOT EXISTS quiz_score       NUMERIC(5,2);
ALTER TABLE grades ADD COLUMN IF NOT EXISTS test_score       NUMERIC(5,2);
ALTER TABLE grades ADD COLUMN IF NOT EXISTS exam_score       NUMERIC(5,2);

-- Derived grade metadata
ALTER TABLE grades ADD COLUMN IF NOT EXISTS letter_grade TEXT;
ALTER TABLE grades ADD COLUMN IF NOT EXISTS gpa_points   NUMERIC(4,2);

-- Approval workflow
ALTER TABLE grades ADD COLUMN IF NOT EXISTS status           TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE grades ADD COLUMN IF NOT EXISTS entered_by       UUID REFERENCES users(id);
ALTER TABLE grades ADD COLUMN IF NOT EXISTS entered_at       TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE grades ADD COLUMN IF NOT EXISTS approved_by      UUID REFERENCES users(id);
ALTER TABLE grades ADD COLUMN IF NOT EXISTS approved_at      TIMESTAMPTZ;
ALTER TABLE grades ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Ensure updated_at exists (may already be there)
ALTER TABLE grades ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ════════════════════════════════════════════════════════════════
-- PART 2: Unique constraint for upsert on_conflict
-- Required by the service: on_conflict=school_id,student_id,subject_id,academic_year,semester
-- ════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
     WHERE constraint_type = 'UNIQUE'
       AND table_name      = 'grades'
       AND constraint_name = 'grades_unique_per_student_subject_term'
  ) THEN
    ALTER TABLE grades
      ADD CONSTRAINT grades_unique_per_student_subject_term
      UNIQUE (school_id, student_id, subject_id, academic_year, semester);
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════
-- PART 3: RLS — teachers (and other staff) can INSERT + UPDATE grades
-- ════════════════════════════════════════════════════════════════

ALTER TABLE grades ENABLE ROW LEVEL SECURITY;

-- Teachers / staff: write grades for their school
DROP POLICY IF EXISTS "Staff can write grades" ON grades;
CREATE POLICY "Staff can write grades"
  ON grades FOR ALL TO authenticated
  USING (
    school_id = auth_school_id()
    AND auth_user_role() IN (
      'teacher'::user_role,
      'principal'::user_role,
      'vice_principal'::user_role,
      'admin_staff'::user_role,
      'it_admin'::user_role,
      'super_admin'::user_role
    )
  )
  WITH CHECK (
    school_id = auth_school_id()
    AND auth_user_role() IN (
      'teacher'::user_role,
      'principal'::user_role,
      'vice_principal'::user_role,
      'admin_staff'::user_role,
      'it_admin'::user_role,
      'super_admin'::user_role
    )
  );

-- Re-apply read policies (idempotent)
DROP POLICY IF EXISTS "Staff can view school grades" ON grades;
CREATE POLICY "Staff can view school grades"
  ON grades FOR SELECT TO authenticated
  USING (
    school_id = auth_school_id()
    AND auth_user_role() != 'student'::user_role
  );

DROP POLICY IF EXISTS "Students can view own grades" ON grades;
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

NOTIFY pgrst, 'reload schema';
