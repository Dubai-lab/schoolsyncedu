-- Migration 092: Rebuild promotion detection using class_assignments
--
-- ROOT CAUSE: list_promoted_pending_assignment relied on
--   student_enrollments.status = 'pending_payment'
-- to know which promoted/retained students still need Registrar action.
-- But students who were originally enrolled via Add Student or Import
-- already have an 'active' enrollment for the current year. When
-- process_year_end_promotion creates a next-year enrollment it can
-- collide with an existing 'active' row, leaving status unchanged.
-- Result: the query finds nothing and the page shows 0 students.
--
-- FIX: detect "needs Registrar action" using class_assignments instead:
--   a student is PENDING if they have a student_promotions record
--   (promoted or retained) but NO class_assignment for next_year yet.
--   This is reliable regardless of enrollment status.
--
-- assign_promoted_student_to_class is also hardened:
--   it now upserts the next-year enrollment to 'active' whether or not
--   a row existed before, so the student is always fully activated.


-- ════════════════════════════════════════════════════════════════
-- PART 1: list_promoted_pending_assignment (rebuilt)
-- ════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS list_promoted_pending_assignment(uuid);

CREATE FUNCTION list_promoted_pending_assignment(p_school_id UUID)
RETURNS TABLE (
  student_id          UUID,
  first_name          TEXT,
  last_name           TEXT,
  registration_number TEXT,
  from_grade_level    TEXT,
  next_year           TEXT,
  outcome             TEXT,
  reg_fee_paid        BOOLEAN,
  reg_fee_amount      NUMERIC,
  promoted_at         TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role   user_role;
  v_caller_school UUID;
  v_next_year     TEXT;
BEGIN
  SELECT role, school_id
    INTO v_caller_role, v_caller_school
    FROM users WHERE auth_id = auth.uid();

  IF v_caller_role NOT IN (
    'registrar','principal','vice_principal','admin_staff','it_admin','super_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_caller_role != 'super_admin' AND v_caller_school != p_school_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Get next academic year from school settings
  SELECT setting_value INTO v_next_year
    FROM school_settings
   WHERE school_id   = p_school_id
     AND setting_key = 'next_academic_year'
   LIMIT 1;

  -- If next year is not configured, return empty (nothing to assign)
  IF v_next_year IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    s.id                                          AS student_id,
    s.first_name,
    s.last_name,
    s.registration_number,
    sp.from_grade_level,
    v_next_year                                   AS next_year,
    sp.outcome::TEXT,
    -- reg_fee_paid: TRUE if fee is paid/partial, TRUE if no fee record exists
    -- (no record means it will be assigned when class is chosen)
    COALESCE(
      (sf.status IN ('paid', 'partial')),
      TRUE
    )                                             AS reg_fee_paid,
    COALESCE(sf.amount_due, 0::NUMERIC)           AS reg_fee_amount,
    sp.processed_at                               AS promoted_at
  FROM students s
  JOIN student_promotions sp
    ON sp.student_id = s.id
   AND sp.school_id  = p_school_id
   AND sp.outcome    IN ('promoted', 'retained')
  -- Left join registration fee for next year (for payment status display)
  LEFT JOIN student_fees sf
    ON sf.student_id    = s.id
   AND sf.school_id     = p_school_id
   AND sf.academic_year = v_next_year
   AND EXISTS (
     SELECT 1 FROM fee_structures fs2
      WHERE fs2.id       = sf.fee_structure_id
        AND fs2.fee_type = 'registration'
   )
  WHERE s.school_id = p_school_id
    -- Only students NOT yet assigned to a class for next year
    AND NOT EXISTS (
      SELECT 1 FROM class_assignments ca
       WHERE ca.student_id    = s.id
         AND ca.academic_year = v_next_year
    )
  ORDER BY sp.outcome DESC, sp.from_grade_level, s.last_name, s.first_name;
END;
$$;

GRANT EXECUTE ON FUNCTION list_promoted_pending_assignment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION list_promoted_pending_assignment(UUID) TO service_role;


-- ════════════════════════════════════════════════════════════════
-- PART 2: assign_promoted_student_to_class (hardened)
--
-- Now upserts enrollment to 'active' regardless of prior state.
-- p_class_id = NULL means retained student — use current class.
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION assign_promoted_student_to_class(
  p_student_id UUID,
  p_class_id   UUID,   -- NULL for retained students (use current class)
  p_next_year  TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role        user_role;
  v_caller_school      UUID;
  v_student            RECORD;
  v_class              RECORD;
  v_fees_assigned      INT;
  v_effective_class_id UUID;
BEGIN
  SELECT role, school_id
    INTO v_caller_role, v_caller_school
    FROM users WHERE auth_id = auth.uid();

  IF v_caller_role NOT IN (
    'registrar','principal','vice_principal','admin_staff','it_admin','super_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_student FROM students WHERE id = p_student_id;
  IF v_student.id IS NULL THEN RAISE EXCEPTION 'Student not found'; END IF;
  IF v_caller_role != 'super_admin' AND v_student.school_id != v_caller_school THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Resolve class: caller-supplied for promoted, current class for retained
  v_effective_class_id := COALESCE(p_class_id, v_student.current_class_id);
  IF v_effective_class_id IS NULL THEN
    RAISE EXCEPTION 'No class specified and student has no current class';
  END IF;

  SELECT * INTO v_class FROM classes WHERE id = v_effective_class_id;
  IF v_class.id IS NULL THEN RAISE EXCEPTION 'Class not found'; END IF;

  -- Update student's current class + grade level
  UPDATE students
     SET current_class_id    = v_effective_class_id,
         current_grade_level = v_class.grade_level,
         updated_at          = NOW()
   WHERE id = p_student_id;

  -- Record class assignment for next year (this is what removes them from the pending list)
  INSERT INTO class_assignments (class_id, student_id, academic_year)
  VALUES (v_effective_class_id, p_student_id, p_next_year)
  ON CONFLICT DO NOTHING;

  -- Assign all class fee structures for next year
  v_fees_assigned := assign_class_fees_to_student(
    p_student_id, v_effective_class_id, v_student.school_id, p_next_year
  );

  -- Record final grade level on promotion record (for promoted: was NULL)
  UPDATE student_promotions
     SET to_grade_level = v_class.grade_level
   WHERE student_id     = p_student_id
     AND school_id      = v_student.school_id
     AND outcome        IN ('promoted', 'retained')
     AND to_grade_level IS NULL;

  -- Activate next-year enrollment — update existing or insert new
  -- We do this unconditionally: regardless of what status it had before
  UPDATE student_enrollments
     SET status     = 'active',
         updated_at = NOW()
   WHERE student_id    = p_student_id
     AND school_id     = v_student.school_id
     AND academic_year = p_next_year;

  IF NOT FOUND THEN
    INSERT INTO student_enrollments (
      student_id, school_id, academic_year, enrollment_date, status
    ) VALUES (
      p_student_id, v_student.school_id, p_next_year, CURRENT_DATE, 'active'
    );
  END IF;

  RETURN jsonb_build_object(
    'success',       TRUE,
    'student_id',    p_student_id,
    'class_name',    v_class.name,
    'grade_level',   v_class.grade_level,
    'fees_assigned', v_fees_assigned,
    'message',       format(
      'Student confirmed for %s (%s). %s fee record(s) created.',
      v_class.name, v_class.grade_level, v_fees_assigned
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION assign_promoted_student_to_class(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION assign_promoted_student_to_class(UUID, UUID, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
