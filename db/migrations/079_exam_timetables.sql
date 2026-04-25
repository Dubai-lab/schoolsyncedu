-- Migration 079: Create exam_timetables table
-- Supports Liberia's 2-semester / 6-period academic structure.
-- All 6 periods have Tests; Periods 3 & 6 additionally have Semester Exams.
-- Period 3 → Test (covers P3 content) + Semester 1 Exam (covers P1–P3)
-- Period 6 → Test (covers P6 content) + Semester 2 Exam (covers P4–P6)

CREATE TABLE IF NOT EXISTS exam_timetables (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id       UUID        NOT NULL REFERENCES schools(id)   ON DELETE CASCADE,
  class_id        UUID        NOT NULL REFERENCES classes(id)   ON DELETE CASCADE,
  academic_year   VARCHAR(50) NOT NULL,
  term_name       VARCHAR(10) NOT NULL,           -- 'p1' … 'p6'
  period_number   INTEGER     NOT NULL CHECK (period_number BETWEEN 1 AND 6),
  semester_number INTEGER     NOT NULL CHECK (semester_number IN (1, 2)),
  entry_type      VARCHAR(10) NOT NULL DEFAULT 'test' CHECK (entry_type IN ('test', 'exam')),
  subject_id      UUID        REFERENCES subjects(id)   ON DELETE SET NULL,
  teacher_id      UUID        REFERENCES users(id)      ON DELETE SET NULL,
  exam_date       DATE,
  start_time      TIME,
  end_time        TIME,
  location        VARCHAR(100),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exam_timetables_class   ON exam_timetables(class_id, academic_year);
CREATE INDEX IF NOT EXISTS idx_exam_timetables_school  ON exam_timetables(school_id, academic_year);
CREATE INDEX IF NOT EXISTS idx_exam_timetables_teacher ON exam_timetables(teacher_id, academic_year);

-- ── updated_at trigger ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_exam_timetables_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_exam_timetables_updated_at
  BEFORE UPDATE ON exam_timetables
  FOR EACH ROW EXECUTE FUNCTION update_exam_timetables_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE exam_timetables ENABLE ROW LEVEL SECURITY;

-- All school members (staff, teachers, students, parents) can view
DROP POLICY IF EXISTS exam_timetables_select ON exam_timetables;
CREATE POLICY exam_timetables_select ON exam_timetables
  FOR SELECT USING (
    school_id = auth_school_id()
    OR is_super_admin()
  );

-- Only senior admin roles can create/edit/delete
DROP POLICY IF EXISTS exam_timetables_insert ON exam_timetables;
CREATE POLICY exam_timetables_insert ON exam_timetables
  FOR INSERT WITH CHECK (
    school_id = auth_school_id()
    AND (
      auth_user_role() IN (
        'principal'::user_role, 'vice_principal'::user_role,
        'admin_staff'::user_role, 'registrar'::user_role, 'it_admin'::user_role
      )
      OR is_super_admin()
    )
  );

DROP POLICY IF EXISTS exam_timetables_update ON exam_timetables;
CREATE POLICY exam_timetables_update ON exam_timetables
  FOR UPDATE USING (
    school_id = auth_school_id()
    AND (
      auth_user_role() IN (
        'principal'::user_role, 'vice_principal'::user_role,
        'admin_staff'::user_role, 'registrar'::user_role, 'it_admin'::user_role
      )
      OR is_super_admin()
    )
  );

DROP POLICY IF EXISTS exam_timetables_delete ON exam_timetables;
CREATE POLICY exam_timetables_delete ON exam_timetables
  FOR DELETE USING (
    school_id = auth_school_id()
    AND (
      auth_user_role() IN (
        'principal'::user_role, 'vice_principal'::user_role,
        'admin_staff'::user_role, 'registrar'::user_role, 'it_admin'::user_role
      )
      OR is_super_admin()
    )
  );

NOTIFY pgrst, 'reload schema';
