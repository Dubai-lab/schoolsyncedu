-- Migration 094: Fix registration fee lookup in process_year_end_promotion
--
-- Problem: promotion only searched for school-wide (class_id IS NULL)
-- registration fees. Schools that use class-specific registration fees
-- (class_id IS NOT NULL, copied via "Copy to Next Year") had no match.
-- Result: no fee was assigned → student showed as "Paid" in the
-- Promoted Students page (COALESCE fallback returns TRUE when no record).
--
-- Fix: three-level fallback for registration fee lookup per student:
--   1. School-wide fee (class_id IS NULL) — applies to all
--   2. Fee for the student's current class — most specific
--   3. Any registration fee for next year — last resort
--
-- Also: change COALESCE fallback in list_promoted_pending_assignment
-- from TRUE to FALSE when no fee record exists — so students without
-- an assigned fee show as "Pending" not "Paid", forcing the issue to
-- be visible rather than silently bypassed.

-- ════════════════════════════════════════════════════════════════
-- PART 1: process_year_end_promotion (fix reg fee lookup)
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION process_year_end_promotion(
  p_school_id     UUID,
  p_academic_year TEXT,
  p_next_year     TEXT,
  p_decisions     JSONB,
  p_processed_by  UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role    user_role;
  v_caller_school  UUID;
  v_decision       JSONB;
  v_student_id     UUID;
  v_outcome        TEXT;
  v_notes          TEXT;
  v_from_grade     TEXT;
  v_current_class  UUID;
  v_reg_fee_id     UUID;
  v_promoted       INT := 0;
  v_retained       INT := 0;
  v_graduated      INT := 0;
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

  FOR v_decision IN SELECT * FROM jsonb_array_elements(p_decisions) LOOP
    v_student_id := (v_decision->>'student_id')::UUID;
    v_outcome    :=  v_decision->>'outcome';
    v_notes      :=  v_decision->>'notes';

    -- Get student's current grade level and class
    SELECT current_grade_level, current_class_id
      INTO v_from_grade, v_current_class
      FROM students WHERE id = v_student_id;

    -- ── Record promotion decision ─────────────────────────────
    INSERT INTO student_promotions (
      school_id, student_id, academic_year,
      from_grade_level, to_grade_level,
      outcome, notes, processed_by
    ) VALUES (
      p_school_id, v_student_id, p_academic_year,
      v_from_grade,
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

      -- Upsert next-year enrollment as pending_payment
      UPDATE student_enrollments
         SET status = 'pending_payment', updated_at = NOW()
       WHERE student_id    = v_student_id
         AND school_id     = p_school_id
         AND academic_year = p_next_year
         AND status::TEXT != 'active';

      IF NOT FOUND THEN
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

      -- ── Find registration fee for next year — 3-level fallback ──
      --
      -- Level 1: school-wide fee (class_id IS NULL)
      SELECT fs.id INTO v_reg_fee_id
        FROM fee_structures fs
       WHERE fs.school_id      = p_school_id
         AND fs.fee_type::TEXT = 'registration'
         AND fs.academic_year  = p_next_year
         AND fs.class_id       IS NULL
       LIMIT 1;

      -- Level 2: fee for student's current class
      IF v_reg_fee_id IS NULL AND v_current_class IS NOT NULL THEN
        SELECT fs.id INTO v_reg_fee_id
          FROM fee_structures fs
         WHERE fs.school_id      = p_school_id
           AND fs.fee_type::TEXT = 'registration'
           AND fs.academic_year  = p_next_year
           AND fs.class_id       = v_current_class
         LIMIT 1;
      END IF;

      -- Level 3: any registration fee for next year (by grade level)
      IF v_reg_fee_id IS NULL THEN
        SELECT fs.id INTO v_reg_fee_id
          FROM fee_structures fs
         WHERE fs.school_id      = p_school_id
           AND fs.fee_type::TEXT = 'registration'
           AND fs.academic_year  = p_next_year
         ORDER BY fs.class_id NULLS FIRST
         LIMIT 1;
      END IF;

      -- Assign the registration fee to the student
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
         SET status = 'graduated', updated_at = NOW()
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
-- Fix COALESCE fallback: no fee record = FALSE (not paid)
-- so the student shows "Pending" instead of "Paid" when no
-- registration fee was assigned.
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

  SELECT setting_value INTO v_next_year
    FROM school_settings
   WHERE school_id   = p_school_id
     AND setting_key = 'next_academic_year'
   LIMIT 1;

  IF v_next_year IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    s.id::UUID                                    AS student_id,
    s.first_name::TEXT                            AS first_name,
    s.last_name::TEXT                             AS last_name,
    s.registration_number::TEXT                   AS registration_number,
    sp.from_grade_level::TEXT                     AS from_grade_level,
    v_next_year::TEXT                             AS next_year,
    sp.outcome::TEXT                              AS outcome,
    -- No fee record → FALSE (pending, not paid) so Bursar must record payment
    -- Fee record paid/partial → TRUE
    -- Fee record pending → FALSE
    COALESCE(
      sf.status::TEXT IN ('paid', 'partial'),
      FALSE
    )::BOOLEAN                                    AS reg_fee_paid,
    COALESCE(sf.amount_due, 0)::NUMERIC           AS reg_fee_amount,
    sp.processed_at::TIMESTAMPTZ                  AS promoted_at
  FROM students s
  JOIN student_promotions sp
    ON  sp.student_id   = s.id
    AND sp.school_id    = p_school_id
    AND sp.outcome::TEXT IN ('promoted', 'retained')
  LEFT JOIN student_fees sf
    ON  sf.student_id    = s.id
    AND sf.school_id     = p_school_id
    AND sf.academic_year = v_next_year
    AND EXISTS (
      SELECT 1 FROM fee_structures fs
       WHERE fs.id             = sf.fee_structure_id
         AND fs.fee_type::TEXT = 'registration'
    )
  WHERE s.school_id = p_school_id
    AND NOT EXISTS (
      SELECT 1 FROM class_assignments ca
       WHERE ca.student_id    = s.id
         AND ca.academic_year = v_next_year
    )
  ORDER BY sp.outcome::TEXT DESC, sp.from_grade_level, s.last_name, s.first_name;
END;
$$;

GRANT EXECUTE ON FUNCTION list_promoted_pending_assignment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION list_promoted_pending_assignment(UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
