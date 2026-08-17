-- ============================================================
-- Migration 221: A teacher may only grade their own classes, and may not
--                approve their own work
--
-- ── 1. A TEACHER COULD APPROVE THEIR OWN GRADES ─────────────────────────────
--
--   Grade approval is the Principal's core duty and it is properly gated:
--   approve_grades raises 'Unauthorized: only principals can approve grades'.
--
--   But grades_staff_update (migration 104) lets a teacher UPDATE any row in
--   the grades table, and RLS is row-level — it says nothing about which
--   columns. status, approved_by and approved_at are ordinary columns on that
--   row. A teacher could PATCH status='approved' straight through PostgREST
--   and never call the function at all.
--
--   So the entire approval workflow could be walked around by the one person
--   it exists to check. Locking the front door and leaving the window open.
--
-- ── 2. A TEACHER COULD GRADE ANY STUDENT IN ANY SUBJECT ─────────────────────
--
--   grades_staff_insert and grades_staff_update scope by school and role and
--   nothing else. Any teacher could enter or change a grade for any student in
--   the school, in a subject they do not teach. TeacherGradeEntry only offers
--   their own classes, but that is the screen being polite, not the database
--   saying no.
--
--   attendance_insert and attendance_update (migration 006) have the same
--   shape: any class in the school, not any class of theirs.
--
-- ── APPROACH ────────────────────────────────────────────────────────────────
--
--   Grades use a trigger, not a policy. The rules are about which columns
--   changed and what they changed from — draft may become submitted, nothing
--   may become approved — and RLS cannot express that. Attendance is a plain
--   row test, so the policies are simply narrowed.
--
--   The workflow the trigger enforces is the one migration 019 described:
--     draft → submitted (teacher)  → approved / rejected (leadership)
--   with rejected going back to the teacher for another attempt.
--
--   Non-teachers are untouched, and service_role passes through, so imports
--   and the mobile attendance sync behave exactly as before.
--
-- ROLLBACK
--   DROP TRIGGER grades_guard_teacher_writes ON grades;
--   DROP FUNCTION guard_teacher_grade_writes();
--   DROP FUNCTION teacher_teaches_class(UUID);
--   -- then re-run the attendance policies from migration 006
-- ============================================================


-- ============================================================
-- 1. DOES THIS TEACHER TAKE THIS CLASS?
--    Homeroom or subject teacher both count: in a primary school the class
--    teacher takes every subject, so limiting them to class_subjects rows
--    would lock them out of their own register.
--
--    SECURITY DEFINER because it is called from inside policies on tables the
--    caller's own policies restrict — as INVOKER it would see only the rows
--    RLS already allows and answer the wrong question.
-- ============================================================

CREATE OR REPLACE FUNCTION teacher_teaches_class(p_class_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM classes c
    LEFT JOIN class_subjects cs ON cs.class_id = c.id
    WHERE c.id = p_class_id
      AND (
        c.class_teacher_id = (SELECT id FROM users WHERE auth_id = auth.uid())
        OR cs.teacher_id    = (SELECT id FROM users WHERE auth_id = auth.uid())
      )
  );
$$;

GRANT EXECUTE ON FUNCTION teacher_teaches_class(UUID) TO authenticated;


-- ============================================================
-- 2. GRADE WRITES
-- ============================================================

CREATE OR REPLACE FUNCTION guard_teacher_grade_writes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role    TEXT;
  v_user_id UUID;
BEGIN
  -- service_role: imports, backfills, scheduled jobs. Already trusted.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id, role::TEXT INTO v_user_id, v_role
    FROM users WHERE auth_id = auth.uid();

  -- Everyone else keeps exactly what they had. This migration is about the
  -- teacher's own boundary, not about narrowing leadership.
  IF v_role IS DISTINCT FROM 'teacher' THEN
    RETURN NEW;
  END IF;

  -- ── The approval columns are not theirs to write ─────────────────────────
  IF TG_OP = 'UPDATE' THEN
    IF NEW.approved_by      IS DISTINCT FROM OLD.approved_by
    OR NEW.approved_at      IS DISTINCT FROM OLD.approved_at
    OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason THEN
      RAISE EXCEPTION 'Only school leadership may approve or reject a grade.';
    END IF;

    -- Submitting for approval is the teacher's own step; anything else on this
    -- column belongs to leadership. A rejected grade may be resubmitted.
    IF NEW.status IS DISTINCT FROM OLD.status
   AND NOT (COALESCE(OLD.status,'draft') IN ('draft','rejected') AND NEW.status = 'submitted') THEN
      RAISE EXCEPTION 'Only school leadership may approve or reject a grade.';
    END IF;

    -- Once it is with the Principal, or signed off, the mark stops moving.
    -- Without this a teacher could submit a grade, wait for approval, then
    -- quietly change the score afterwards.
    IF COALESCE(OLD.status,'draft') IN ('submitted','approved')
   AND (NEW.score        IS DISTINCT FROM OLD.score
     OR NEW.letter_grade IS DISTINCT FROM OLD.letter_grade
     OR NEW.gpa_points   IS DISTINCT FROM OLD.gpa_points) THEN
      RAISE EXCEPTION 'This grade is % and can no longer be changed. Ask leadership to reject it first.',
        OLD.status;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' AND COALESCE(NEW.status, 'draft') <> 'draft' THEN
    RAISE EXCEPTION 'A new grade starts as a draft.';
  END IF;

  -- ── Their own classes only ───────────────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1
    FROM class_assignments ca
    JOIN classes c ON c.id = ca.class_id
    LEFT JOIN class_subjects cs
           ON cs.class_id = c.id
          AND cs.subject_id = NEW.subject_id
    WHERE ca.student_id  = NEW.student_id
      AND ca.removed_at IS NULL
      AND c.school_id    = NEW.school_id
      AND (c.class_teacher_id = v_user_id OR cs.teacher_id = v_user_id)
  ) THEN
    RAISE EXCEPTION 'You can only enter grades for students in your own classes.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS grades_guard_teacher_writes ON grades;
CREATE TRIGGER grades_guard_teacher_writes
  BEFORE INSERT OR UPDATE ON grades
  FOR EACH ROW EXECUTE FUNCTION guard_teacher_grade_writes();


-- ============================================================
-- 3. ATTENDANCE WRITES
--    Narrowed rather than replaced: admin_staff and the Dean keep the
--    school-wide register they need for cover and for follow-up.
-- ============================================================

DROP POLICY IF EXISTS attendance_insert ON attendance_records;
CREATE POLICY attendance_insert ON attendance_records
  FOR INSERT WITH CHECK (
    class_id IN (SELECT id FROM classes WHERE school_id = auth_school_id())
    AND (
      auth_user_role() IN ('admin_staff'::user_role, 'dean_of_students'::user_role)
      OR (auth_user_role() = 'teacher'::user_role AND teacher_teaches_class(class_id))
    )
  );

DROP POLICY IF EXISTS attendance_update ON attendance_records;
CREATE POLICY attendance_update ON attendance_records
  FOR UPDATE USING (
    class_id IN (SELECT id FROM classes WHERE school_id = auth_school_id())
    AND (
      auth_user_role() = 'admin_staff'::user_role
      OR (auth_user_role() = 'teacher'::user_role AND teacher_teaches_class(class_id))
    )
  );

NOTIFY pgrst, 'reload schema';
