-- ============================================================
-- Migration 027: Fix Student RLS + Fee Visibility
--
-- Problems:
--  1. grades_select_policy uses `students.id = auth.uid()` — WRONG.
--     students.id is the student record UUID, not the auth UUID.
--     Students cannot see their own grades.
--
--  2. attendance_select_policy has the same broken pattern.
--     Students cannot see their own attendance.
--
--  3. announcements table has RLS ENABLED but NO SELECT policy.
--     Nobody (including staff) can read announcements via RLS.
--
--  4. student_fees.school_id is NULL for all rows inserted after
--     migration 025, because bursarService did not set school_id.
--     The RLS policy `school_id = auth_school_id()` blocks all
--     newly assigned fees for every role.
--
-- Fixes:
--  A. Add auth_student_id() helper — returns students.id for the
--     current session (NULL if user is not a student).
--
--  B. Re-create grades_select_policy using auth_school_id() for
--     staff and auth_student_id() for students.
--
--  C. Re-create attendance_select_policy the same way.
--
--  D. Add announcements_select_policy (school-scoped read for all
--     authenticated users in the same school).
--
--  E. Backfill student_fees.school_id from fee_structures.
--     Re-create student_fees_select_policy so students can also
--     read their own fees (not just staff).
-- ============================================================


-- ============================================================
-- A. auth_student_id() helper
--    Returns the students.id for the current auth session.
--    Returns NULL when the caller is not a student.
-- ============================================================

CREATE OR REPLACE FUNCTION auth_student_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id
  FROM   students s
  WHERE  s.user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  LIMIT  1;
$$;


-- ============================================================
-- B. grades: fix SELECT policy for students
-- ============================================================

DROP POLICY IF EXISTS grades_select_policy ON grades;

CREATE POLICY grades_select_policy ON grades
  FOR SELECT USING (
    -- Students see their own grades only
    (auth_user_role() = 'student'::user_role AND student_id = auth_student_id())
    OR
    -- Staff see all grades in their school
    (school_id = auth_school_id()
      AND auth_user_role() IN (
        'teacher'::user_role, 'admin_staff'::user_role,
        'principal'::user_role, 'vice_principal'::user_role,
        'dean_of_students'::user_role, 'registrar'::user_role,
        'bursar'::user_role
      )
    )
    OR is_super_admin()
  );


-- ============================================================
-- C. attendance_records: fix SELECT policy for students
-- ============================================================

DROP POLICY IF EXISTS attendance_select_policy ON attendance_records;

CREATE POLICY attendance_select_policy ON attendance_records
  FOR SELECT USING (
    -- Students see their own records
    (auth_user_role() = 'student'::user_role AND student_id = auth_student_id())
    OR
    -- Staff see records in their school's classes
    (class_id IN (
      SELECT id FROM classes WHERE school_id = auth_school_id()
    ) AND auth_user_role() IN (
      'teacher'::user_role, 'admin_staff'::user_role,
      'principal'::user_role, 'vice_principal'::user_role,
      'dean_of_students'::user_role, 'registrar'::user_role
    ))
    OR is_super_admin()
  );


-- ============================================================
-- D. announcements: add missing SELECT policy
--    All authenticated users in the same school can read
--    published announcements.
-- ============================================================

DROP POLICY IF EXISTS announcements_select_policy ON announcements;

CREATE POLICY announcements_select_policy ON announcements
  FOR SELECT USING (
    school_id = auth_school_id()
    OR is_super_admin()
  );

-- Allow staff to insert/update announcements
DROP POLICY IF EXISTS announcements_insert_policy ON announcements;
CREATE POLICY announcements_insert_policy ON announcements
  FOR INSERT WITH CHECK (
    school_id = auth_school_id()
    AND auth_user_role() IN (
      'principal'::user_role, 'vice_principal'::user_role,
      'admin_staff'::user_role, 'dean_of_students'::user_role,
      'teacher'::user_role
    )
  );

DROP POLICY IF EXISTS announcements_update_policy ON announcements;
CREATE POLICY announcements_update_policy ON announcements
  FOR UPDATE USING (
    school_id = auth_school_id()
    AND auth_user_role() IN (
      'principal'::user_role, 'vice_principal'::user_role,
      'admin_staff'::user_role, 'dean_of_students'::user_role
    )
  );


-- ============================================================
-- E. student_fees: backfill NULL school_id + fix policy
-- ============================================================

-- Backfill school_id for rows that are missing it
UPDATE student_fees sf
SET    school_id = fs.school_id
FROM   fee_structures fs
WHERE  sf.fee_structure_id = fs.id
  AND  sf.school_id IS NULL;

-- Re-create policy: staff see school's fees, students see their own
DROP POLICY IF EXISTS student_fees_select_policy ON student_fees;

CREATE POLICY student_fees_select_policy ON student_fees
  FOR SELECT USING (
    -- Students see only their own fees
    (student_id = auth_student_id())
    OR
    -- Finance staff see all fees in their school
    (school_id = auth_school_id()
      AND auth_user_role() IN (
        'bursar'::user_role, 'admin_staff'::user_role,
        'principal'::user_role, 'vice_principal'::user_role,
        'registrar'::user_role
      )
    )
    OR is_super_admin()
  );

-- Grant execute on new function
GRANT EXECUTE ON FUNCTION auth_student_id() TO authenticated;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
