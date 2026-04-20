-- Migration 069: Fix kiosk_check_clearance — invalid composite-type access on JSONB
-- The original used (v_detail).bal / (v_detail).d which is invalid on a JSONB variable.
-- Rewritten to use RECORD loop variables with proper field access.

CREATE OR REPLACE FUNCTION kiosk_check_clearance(
  p_school_id   UUID,
  p_nfc_chip_id VARCHAR,
  p_semester    VARCHAR   -- 'Semester 1' or 'Semester 2'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student       RECORD;
  v_total_balance DECIMAL(10,2) := 0;
  v_fee_details   JSONB := '[]'::jsonb;
  v_rec           RECORD;
  v_academic_year TEXT;
BEGIN
  -- 1. Find student via NFC card
  SELECT
    s.id               AS student_id,
    s.first_name,
    s.last_name,
    s.registration_number,
    nc.card_number,
    (SELECT c.name FROM classes c
     JOIN class_assignments ca ON ca.class_id = c.id
     WHERE ca.student_id = s.id AND ca.removed_at IS NULL
     LIMIT 1) AS class_name
  INTO v_student
  FROM   nfc_cards nc
  JOIN   students s ON s.id = nc.student_id
  WHERE  UPPER(REPLACE(nc.nfc_chip_id, ':', '')) = UPPER(REPLACE(p_nfc_chip_id, ':', ''))
    AND  s.school_id = p_school_id
    AND  nc.status   = 'active'
  LIMIT  1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Card not recognized. Make sure the card is registered and active.';
  END IF;

  -- 2. Get current academic year for this school
  SELECT setting_value INTO v_academic_year
  FROM   school_settings
  WHERE  school_id    = p_school_id
    AND  setting_key  = 'current_academic_year'
  LIMIT  1;

  -- 3a. Installment-based fees matching the selected semester
  FOR v_rec IN
    SELECT
      COALESCE(fstr.description, fstr.fee_type) AS fee_type,
      sfi.term_name,
      sfi.amount_due,
      sfi.amount_paid,
      sfi.balance,
      sfi.status
    FROM   student_fee_installments sfi
    JOIN   student_fees    sf   ON sf.id      = sfi.student_fee_id
    JOIN   fee_structures  fstr ON fstr.id    = sf.fee_structure_id
    WHERE  sf.student_id  = v_student.student_id
      AND  sf.school_id   = p_school_id
      AND  (v_academic_year IS NULL OR sf.academic_year = v_academic_year)
      AND  LOWER(sfi.term_name) LIKE LOWER('%' || p_semester || '%')
  LOOP
    v_total_balance := v_total_balance + v_rec.balance;
    v_fee_details   := v_fee_details || jsonb_build_object(
      'fee_type',    v_rec.fee_type,
      'term',        v_rec.term_name,
      'amount_due',  v_rec.amount_due,
      'amount_paid', v_rec.amount_paid,
      'balance',     v_rec.balance,
      'status',      v_rec.status
    );
  END LOOP;

  -- 3b. Non-installment fees (apply to whole year — check regardless of semester)
  FOR v_rec IN
    SELECT
      COALESCE(fstr.description, fstr.fee_type) AS fee_type,
      sf.amount_due,
      sf.amount_paid,
      sf.balance,
      sf.status
    FROM   student_fees    sf
    JOIN   fee_structures  fstr ON fstr.id = sf.fee_structure_id
    WHERE  sf.student_id        = v_student.student_id
      AND  sf.school_id         = p_school_id
      AND  fstr.has_installments = FALSE
      AND  sf.balance            > 0
      AND  (v_academic_year IS NULL OR sf.academic_year = v_academic_year)
  LOOP
    v_total_balance := v_total_balance + v_rec.balance;
    v_fee_details   := v_fee_details || jsonb_build_object(
      'fee_type',    v_rec.fee_type,
      'term',        'Full Year',
      'amount_due',  v_rec.amount_due,
      'amount_paid', v_rec.amount_paid,
      'balance',     v_rec.balance,
      'status',      v_rec.status
    );
  END LOOP;

  RETURN jsonb_build_object(
    'student_id',          v_student.student_id,
    'student_name',        v_student.first_name || ' ' || v_student.last_name,
    'first_name',          v_student.first_name,
    'last_name',           v_student.last_name,
    'registration_number', v_student.registration_number,
    'class_name',          COALESCE(v_student.class_name, ''),
    'card_number',         v_student.card_number,
    'is_cleared',          (v_total_balance = 0),
    'total_balance_usd',   v_total_balance,
    'fee_details',         v_fee_details,
    'semester',            p_semester
  );
END;
$$;

GRANT EXECUTE ON FUNCTION kiosk_check_clearance(UUID, VARCHAR, VARCHAR) TO anon;
GRANT EXECUTE ON FUNCTION kiosk_check_clearance(UUID, VARCHAR, VARCHAR) TO authenticated;

NOTIFY pgrst, 'reload schema';
