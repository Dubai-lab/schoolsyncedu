-- Migration 063: Fix students RLS + add clear_grade_pin_reset RPC
-- Run this in: Supabase Dashboard → SQL Editor → New query
--
-- Problems fixed:
--   1. students SELECT policy: ensure any school member can read students
--      (idempotent — safe to re-run even if migration 006/025 already ran)
--   2. students UPDATE policy: add it_admin so Security Reset can set
--      grade_pin_reset_requested = true
--   3. New RPC clear_grade_pin_reset: lets a student clear their own
--      grade PIN reset flag after acknowledging it on My Grades

-- ── 1. Students SELECT — every member of the school can read ─────────────────
DROP POLICY IF EXISTS students_select        ON students;
DROP POLICY IF EXISTS students_select_policy ON students;

CREATE POLICY students_select_policy ON students
  FOR SELECT USING (
    school_id = auth_school_id()
    OR is_super_admin()
  );

-- ── 2. Students UPDATE — add it_admin to the allowed roles ───────────────────
DROP POLICY IF EXISTS students_update        ON students;
DROP POLICY IF EXISTS students_update_policy ON students;

CREATE POLICY students_update_policy ON students
  FOR UPDATE USING (
    school_id = auth_school_id()
    AND auth_user_role() IN (
      'registrar'::user_role,
      'admin_staff'::user_role,
      'principal'::user_role,
      'vice_principal'::user_role,
      'it_admin'::user_role
    )
  );

-- ── 3. RPC: clear_grade_pin_reset — student self-service ─────────────────────
-- Called by MyGrades.tsx when the student's device clears their local PIN
-- after IT Admin set grade_pin_reset_requested = true.
-- SECURITY DEFINER so the student doesn't need direct UPDATE on students.
CREATE OR REPLACE FUNCTION clear_grade_pin_reset(p_student_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   UUID;
  v_auth_role user_role;
BEGIN
  -- Resolve the calling user
  SELECT id, role
    INTO v_user_id, v_auth_role
    FROM users
   WHERE auth_id = auth.uid();

  -- Only the student who owns this record (or privileged staff) may call this
  IF v_auth_role = 'student' THEN
    -- Verify the student_id belongs to this user
    IF NOT EXISTS (
      SELECT 1 FROM students
       WHERE id = p_student_id
         AND user_id = v_user_id
    ) THEN
      RAISE EXCEPTION 'Forbidden: student record does not belong to this user';
    END IF;
  ELSIF v_auth_role IN ('it_admin','admin_staff','principal','registrar') THEN
    -- Privileged staff can clear any student's flag in their school
    IF NOT EXISTS (
      SELECT 1 FROM students
       WHERE id = p_student_id
         AND school_id = auth_school_id()
    ) THEN
      RAISE EXCEPTION 'Forbidden: student not in your school';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE students
     SET grade_pin_reset_requested = FALSE,
         updated_at = NOW()
   WHERE id = p_student_id;
END;
$$;

GRANT EXECUTE ON FUNCTION clear_grade_pin_reset(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
