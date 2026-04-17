-- Migration 079: RLS policies for grades, subjects, and class_subjects
--
-- Problem: Students get 400 Bad Request when fetching their grades because
-- the grades and subjects tables have RLS enabled but no SELECT policies
-- that allow students (or staff) to read them.
--
-- Rules:
--   grades      → staff (any non-student) can read all in their school
--                 students can read only their own approved grades
--   subjects    → all school members can read
--   class_subjects → all school members can read

-- ── grades ────────────────────────────────────────────────────────────────────
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;

-- Staff: read all grades in their school
DROP POLICY IF EXISTS "Staff can view school grades" ON grades;
CREATE POLICY "Staff can view school grades"
  ON grades FOR SELECT TO authenticated
  USING (
    school_id = auth_school_id()
    AND auth_user_role() != 'student'::user_role
  );

-- Students: read only their own grades
DROP POLICY IF EXISTS "Students can view own grades" ON grades;
CREATE POLICY "Students can view own grades"
  ON grades FOR SELECT TO authenticated
  USING (
    school_id = auth_school_id()
    AND auth_user_role() = 'student'::user_role
    AND student_id IN (
      SELECT s.id
        FROM students s
        JOIN users u ON u.id = s.user_id
       WHERE u.auth_id = auth.uid()
    )
  );

-- ── subjects ──────────────────────────────────────────────────────────────────
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School members can view subjects" ON subjects;
CREATE POLICY "School members can view subjects"
  ON subjects FOR SELECT TO authenticated
  USING (school_id = auth_school_id());

-- Staff (teachers, admin) can manage subjects
DROP POLICY IF EXISTS "Staff can manage subjects" ON subjects;
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

-- ── class_subjects ────────────────────────────────────────────────────────────
ALTER TABLE class_subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School members can view class subjects" ON class_subjects;
CREATE POLICY "School members can view class subjects"
  ON class_subjects FOR SELECT TO authenticated
  USING (
    school_id = auth_school_id()
  );

DROP POLICY IF EXISTS "Staff can manage class subjects" ON class_subjects;
CREATE POLICY "Staff can manage class subjects"
  ON class_subjects FOR ALL TO authenticated
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

NOTIFY pgrst, 'reload schema';
