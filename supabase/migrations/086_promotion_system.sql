-- Migration 086: Promotion system — server-side RPCs
--
-- Replaces the client-side savePromotions() logic with proper database
-- functions that handle the full year-end flow:
--
--   1. process_year_end_promotion
--      - Records promotion decisions (promoted / retained / graduated)
--      - For promoted students: creates next-year enrollment (pending_payment)
--        and assigns the school-wide registration fee if one exists for next year
--      - For graduated students: sets students.status = 'graduated'
--
--   2. list_promoted_pending_assignment
--      - Returns promoted students whose next-year enrollment is still
--        pending_payment — i.e. awaiting class assignment by the Registrar
--
--   3. assign_promoted_student_to_class
--      - Registrar assigns a promoted student to a class for the new year
--      - Updates current_class_id + current_grade_level on students row
--      - Inserts class_assignment record
--      - Calls assign_class_fees_to_student for all class fees
--      - Updates the student_promotions.to_grade_level
--      - Activates the next-year enrollment (pending_payment → active)

-- ════════════════════════════════════════════════════════════════
-- PART 1: process_year_end_promotion
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION process_year_end_promotion(
  p_school_id     UUID,
  p_academic_year TEXT,   -- year being CLOSED  e.g. '2024-2025'
  p_next_year     TEXT,   -- year being OPENED  e.g. '2025-2026'
  p_decisions     JSONB,  -- [{student_id, outcome, notes}]
  p_processed_by  UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role   user_role;
  v_caller_school UUID;
  v_decision      JSONB;
  v_student_id    UUID;
  v_outcome       TEXT;
  v_notes         TEXT;
  v_from_grade    TEXT;
  v_reg_fee_id    UUID;
  v_promoted      INT := 0;
  v_retained      INT := 0;
  v_graduated     INT := 0;
BEGIN
  -- ── Auth check ───────────────────────────────────────────────
  SELECT role, school_id
    INTO v_caller_role, v_caller_school
    FROM users WHERE auth_id = auth.uid();

  IF v_caller_role NOT IN (
    'registrar','principal','vice_principal','admin_staff','it_admin','super_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only Registrar, Principal, or Admin can process promotions';
  END IF;

  IF v_caller_role != 'super_admin' AND v_caller_school != p_school_id THEN
    RAISE EXCEPTION 'Access denied: you can only run promotions for your own school';
  END IF;

  -- ── Find school-wide registration fee for next year ──────────
  -- A school-wide reg fee has class_id IS NULL.
  -- If the school uses class-specific reg fees they will be assigned
  -- automatically when assign_promoted_student_to_class is called.
  SELECT fs.id INTO v_reg_fee_id
    FROM fee_structures fs
   WHERE fs.school_id     = p_school_id
     AND fs.fee_type      = 'registration'
     AND fs.academic_year = p_next_year
     AND fs.class_id      IS NULL
   LIMIT 1;

  -- ── Process each decision ─────────────────────────────────────
  FOR v_decision IN SELECT * FROM jsonb_array_elements(p_decisions) LOOP
    v_student_id := (v_decision->>'student_id')::UUID;
    v_outcome    :=  v_decision->>'outcome';
    v_notes      :=  v_decision->>'notes';

    -- Load current grade level
    SELECT current_grade_level INTO v_from_grade
      FROM students WHERE id = v_student_id;

    -- ── Record promotion decision ─────────────────────────────
    INSERT INTO student_promotions (
      school_id, student_id, academic_year,
      from_grade_level,
      to_grade_level,
      outcome, notes, processed_by
    ) VALUES (
      p_school_id,
      v_student_id,
      p_academic_year,
      v_from_grade,
      -- to_grade_level: retained keeps same grade; promoted/graduated set later
      CASE WHEN v_outcome = 'retained' THEN v_from_grade ELSE NULL END,
      v_outcome,
      NULLIF(v_notes, ''),
      p_processed_by
    )
    ON CONFLICT (school_id, student_id, academic_year) DO NOTHING;

    -- ── Per-outcome actions ───────────────────────────────────
    IF v_outcome = 'promoted' THEN
      v_promoted := v_promoted + 1;

      -- Create enrollment for next year (pending_payment)
      -- Guard against duplicate (no unique constraint on student_enrollments)
      IF NOT EXISTS (
        SELECT 1 FROM student_enrollments
         WHERE student_id    = v_student_id
           AND school_id     = p_school_id
           AND academic_year = p_next_year
      ) THEN
        INSERT INTO student_enrollments (
          student_id, school_id, academic_year, enrollment_date, status
        ) VALUES (
          v_student_id, p_school_id, p_next_year, CURRENT_DATE, 'pending_payment'
        );
      END IF;

      -- Assign school-wide registration fee if one exists for next year
      IF v_reg_fee_id IS NOT NULL THEN
        INSERT INTO student_fees (
          student_id, fee_structure_id, school_id,
          academic_year, amount_due, amount_paid, balance,
          status, due_date
        )
        SELECT
          v_student_id,
          fs.id,
          p_school_id,
          p_next_year,
          fs.amount_usd,
          0,
          fs.amount_usd,
          'pending',
          fs.due_date
        FROM fee_structures fs
        WHERE fs.id = v_reg_fee_id
        ON CONFLICT (student_id, fee_structure_id) DO NOTHING;
      END IF;

    ELSIF v_outcome = 'retained' THEN
      v_retained := v_retained + 1;
      -- Retained students stay enrolled in the current year; no new enrollment.

    ELSIF v_outcome = 'graduated' THEN
      v_graduated := v_graduated + 1;
      UPDATE students
         SET status     = 'graduated',
             updated_at = NOW()
       WHERE id = v_student_id;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success',   TRUE,
    'promoted',  v_promoted,
    'retained',  v_retained,
    'graduated', v_graduated,
    'message',   format(
      'Promotion processed. %s promoted, %s retained, %s graduated.',
      v_promoted, v_retained, v_graduated
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION process_year_end_promotion(UUID, TEXT, TEXT, JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION process_year_end_promotion(UUID, TEXT, TEXT, JSONB, UUID) TO service_role;


-- ════════════════════════════════════════════════════════════════
-- PART 2: list_promoted_pending_assignment
--
-- Returns every promoted student whose next-year enrollment is still
-- pending_payment — meaning the Registrar has not yet assigned them
-- to a class for the new year.
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION list_promoted_pending_assignment(p_school_id UUID)
RETURNS TABLE (
  student_id          UUID,
  first_name          TEXT,
  last_name           TEXT,
  registration_number TEXT,
  from_grade_level    TEXT,
  next_year           TEXT,
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

  RETURN QUERY
  SELECT
    s.id                                                         AS student_id,
    s.first_name,
    s.last_name,
    s.registration_number,
    sp.from_grade_level,
    se.academic_year                                             AS next_year,
    -- reg_fee_paid: TRUE when no fee record exists OR status is paid/partial
    COALESCE(
      (sf.status IN ('paid', 'partial')),
      TRUE
    )                                                            AS reg_fee_paid,
    COALESCE(sf.amount_due, 0::NUMERIC)                          AS reg_fee_amount,
    sp.processed_at                                              AS promoted_at
  FROM students s
  -- Only promoted students with a pending_payment next-year enrollment
  JOIN student_enrollments se
    ON se.student_id    = s.id
   AND se.school_id     = p_school_id
   AND se.status        = 'pending_payment'
  JOIN student_promotions sp
    ON sp.student_id    = s.id
   AND sp.school_id     = p_school_id
   AND sp.outcome       = 'promoted'
   AND sp.to_grade_level IS NULL    -- not yet assigned to a class
  -- Optional registration fee record for the next year
  LEFT JOIN student_fees sf
    ON sf.student_id    = s.id
   AND sf.school_id     = p_school_id
   AND sf.academic_year = se.academic_year
   AND EXISTS (
     SELECT 1 FROM fee_structures fs2
      WHERE fs2.id       = sf.fee_structure_id
        AND fs2.fee_type = 'registration'
   )
  WHERE s.school_id = p_school_id
  ORDER BY sp.from_grade_level, s.last_name, s.first_name;
END;
$$;

GRANT EXECUTE ON FUNCTION list_promoted_pending_assignment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION list_promoted_pending_assignment(UUID) TO service_role;


-- ════════════════════════════════════════════════════════════════
-- PART 3: assign_promoted_student_to_class
--
-- Registrar assigns a promoted student to a class for the new year.
-- This is the final step that activates the student for the new year:
--   • Updates students.current_class_id / current_grade_level
--   • Inserts class_assignments row for new year
--   • Calls assign_class_fees_to_student (all class fees for new year)
--   • Writes to_grade_level on the promotion record
--   • Flips next-year enrollment from pending_payment → active
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION assign_promoted_student_to_class(
  p_student_id UUID,
  p_class_id   UUID,
  p_next_year  TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role   user_role;
  v_caller_school UUID;
  v_student       RECORD;
  v_class         RECORD;
  v_fees_assigned INT;
BEGIN
  SELECT role, school_id
    INTO v_caller_role, v_caller_school
    FROM users WHERE auth_id = auth.uid();

  IF v_caller_role NOT IN (
    'registrar','principal','vice_principal','admin_staff','it_admin','super_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Load student
  SELECT * INTO v_student FROM students WHERE id = p_student_id;
  IF v_student.id IS NULL THEN RAISE EXCEPTION 'Student not found'; END IF;
  IF v_caller_role != 'super_admin' AND v_student.school_id != v_caller_school THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Load class
  SELECT * INTO v_class FROM classes WHERE id = p_class_id;
  IF v_class.id IS NULL THEN RAISE EXCEPTION 'Class not found'; END IF;

  -- Update student snapshot: class + grade level for new year
  UPDATE students
     SET current_class_id    = p_class_id,
         current_grade_level = v_class.grade_level,
         updated_at          = NOW()
   WHERE id = p_student_id;

  -- Record class assignment for new year
  INSERT INTO class_assignments (class_id, student_id, academic_year)
  VALUES (p_class_id, p_student_id, p_next_year)
  ON CONFLICT DO NOTHING;

  -- Assign ALL class fee structures for this class + year to the student
  -- (ON CONFLICT DO NOTHING inside — safe if some were already assigned)
  v_fees_assigned := assign_class_fees_to_student(
    p_student_id, p_class_id, v_student.school_id, p_next_year
  );

  -- Record the actual grade level reached on the promotion row
  UPDATE student_promotions
     SET to_grade_level = v_class.grade_level
   WHERE student_id  = p_student_id
     AND school_id   = v_student.school_id
     AND outcome     = 'promoted'
     AND to_grade_level IS NULL;

  -- Activate the next-year enrollment
  UPDATE student_enrollments
     SET status     = 'active',
         updated_at = NOW()
   WHERE student_id    = p_student_id
     AND school_id     = v_student.school_id
     AND academic_year = p_next_year
     AND status        = 'pending_payment';

  RETURN jsonb_build_object(
    'success',       TRUE,
    'student_id',    p_student_id,
    'class_name',    v_class.name,
    'grade_level',   v_class.grade_level,
    'fees_assigned', v_fees_assigned,
    'message',       format(
      'Student assigned to %s (%s). %s fee record(s) created.',
      v_class.name, v_class.grade_level, v_fees_assigned
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION assign_promoted_student_to_class(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION assign_promoted_student_to_class(UUID, UUID, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
