-- Migration 090: Fix promotion for retained students + stale enrollment bug
--
-- Problems fixed:
--
-- 1. Retained students were getting NO new enrollment and NO registration fee
--    for the next academic year. Every student — promoted OR retained — must
--    pay registration fees when a new year starts.
--
-- 2. If a student had a previous enrollment for next year (from an earlier
--    test run) in status 'active', the IF NOT EXISTS guard skipped re-creating
--    it as 'pending_payment'. Result: promoted students appeared in
--    student_promotions but were invisible in list_promoted_pending_assignment.
--
-- 3. list_promoted_pending_assignment was filtering sp.outcome = 'promoted'
--    only — retained students (who now get pending_payment enrollments) were
--    excluded. Also removed the to_grade_level IS NULL filter (retained
--    students already have to_grade_level set).  Instead we gate on
--    se.status = 'pending_payment' to know "Registrar hasn't processed yet".
--
-- 4. assign_promoted_student_to_class: p_class_id is now nullable.
--    NULL means "use the student's current class" — correct for retained
--    students who stay in the same class.


-- ════════════════════════════════════════════════════════════════
-- PART 1: process_year_end_promotion (fixed)
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

    SELECT current_grade_level INTO v_from_grade
      FROM students WHERE id = v_student_id;

    -- ── Record promotion decision ─────────────────────────────
    INSERT INTO student_promotions (
      school_id, student_id, academic_year,
      from_grade_level, to_grade_level,
      outcome, notes, processed_by
    ) VALUES (
      p_school_id, v_student_id, p_academic_year,
      v_from_grade,
      -- retained stays in same grade; promoted/graduated assigned later
      CASE WHEN v_outcome = 'retained' THEN v_from_grade ELSE NULL END,
      v_outcome, NULLIF(v_notes, ''), p_processed_by
    )
    ON CONFLICT (school_id, student_id, academic_year) DO NOTHING;

    -- ── Per-outcome actions ───────────────────────────────────
    IF v_outcome IN ('promoted', 'retained') THEN

      IF v_outcome = 'promoted' THEN
        v_promoted := v_promoted + 1;
      ELSE
        v_retained := v_retained + 1;
      END IF;

      -- Upsert next-year enrollment as pending_payment.
      -- We UPDATE first (covers stale 'active' rows from test runs),
      -- then INSERT if no row existed.
      UPDATE student_enrollments
         SET status     = 'pending_payment',
             updated_at = NOW()
       WHERE student_id    = v_student_id
         AND school_id     = p_school_id
         AND academic_year = p_next_year
         AND status        != 'active';  -- never downgrade a fully-active enrollment

      IF NOT FOUND THEN
        -- No row existed at all — check if there is an active one first
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
      END IF;

      -- Assign school-wide registration fee for next year (both promoted + retained)
      IF v_reg_fee_id IS NOT NULL THEN
        INSERT INTO student_fees (
          student_id, fee_structure_id, school_id,
          academic_year, amount_due, amount_paid, balance,
          status, due_date
        )
        SELECT
          v_student_id, fs.id, p_school_id,
          p_next_year, fs.amount_usd, 0, fs.amount_usd,
          'pending', fs.due_date
        FROM fee_structures fs
        WHERE fs.id = v_reg_fee_id
        ON CONFLICT (student_id, fee_structure_id) DO NOTHING;
      END IF;

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
-- PART 2: list_promoted_pending_assignment (fixed)
--
-- Now returns BOTH promoted and retained students whose next-year
-- enrollment is pending_payment (Registrar hasn't confirmed yet).
-- Added outcome column so the UI can show "Retained / Same Class"
-- vs "Promoted / Needs New Class".
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION list_promoted_pending_assignment(p_school_id UUID)
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
    s.id,
    s.first_name,
    s.last_name,
    s.registration_number,
    sp.from_grade_level,
    se.academic_year                      AS next_year,
    sp.outcome::TEXT,
    -- reg_fee_paid: TRUE when no fee record OR status is paid/partial
    COALESCE((sf.status IN ('paid', 'partial')), TRUE) AS reg_fee_paid,
    COALESCE(sf.amount_due, 0::NUMERIC)   AS reg_fee_amount,
    sp.processed_at                       AS promoted_at
  FROM students s
  -- Students with a pending_payment enrollment for next year
  JOIN student_enrollments se
    ON se.student_id = s.id
   AND se.school_id  = p_school_id
   AND se.status     = 'pending_payment'
  -- Must have a promotion record (promoted OR retained) for the year being closed
  JOIN student_promotions sp
    ON sp.student_id = s.id
   AND sp.school_id  = p_school_id
   AND sp.outcome    IN ('promoted', 'retained')
  -- Optional: registration fee for next year
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
  ORDER BY sp.outcome DESC, sp.from_grade_level, s.last_name, s.first_name;
  -- ORDER: promoted first (DESC: 'retained' < 'promoted' alphabetically), then grade, then name
END;
$$;

GRANT EXECUTE ON FUNCTION list_promoted_pending_assignment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION list_promoted_pending_assignment(UUID) TO service_role;


-- ════════════════════════════════════════════════════════════════
-- PART 3: assign_promoted_student_to_class (fixed)
--
-- p_class_id is now nullable.
-- NULL = retained student staying in current class — use current_class_id.
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
  v_caller_role   user_role;
  v_caller_school UUID;
  v_student       RECORD;
  v_class         RECORD;
  v_fees_assigned INT;
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

  -- Determine the effective class: caller-supplied or current (for retained)
  v_effective_class_id := COALESCE(p_class_id, v_student.current_class_id);
  IF v_effective_class_id IS NULL THEN
    RAISE EXCEPTION 'No class specified and student has no current class — cannot assign';
  END IF;

  SELECT * INTO v_class FROM classes WHERE id = v_effective_class_id;
  IF v_class.id IS NULL THEN RAISE EXCEPTION 'Class not found'; END IF;

  -- Update student snapshot only if being moved to a different/new class
  UPDATE students
     SET current_class_id    = v_effective_class_id,
         current_grade_level = v_class.grade_level,
         updated_at          = NOW()
   WHERE id = p_student_id;

  -- Record class assignment for new year
  INSERT INTO class_assignments (class_id, student_id, academic_year)
  VALUES (v_effective_class_id, p_student_id, p_next_year)
  ON CONFLICT DO NOTHING;

  -- Assign ALL class fee structures for this class + year
  v_fees_assigned := assign_class_fees_to_student(
    p_student_id, v_effective_class_id, v_student.school_id, p_next_year
  );

  -- Record actual grade level on the promotion row (for promoted — to_grade_level was NULL)
  UPDATE student_promotions
     SET to_grade_level = v_class.grade_level
   WHERE student_id     = p_student_id
     AND school_id      = v_student.school_id
     AND outcome        = 'promoted'
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
      'Student confirmed for %s (%s). %s fee record(s) created.',
      v_class.name, v_class.grade_level, v_fees_assigned
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION assign_promoted_student_to_class(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION assign_promoted_student_to_class(UUID, UUID, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
