-- Migration 070: Kiosk improvements
-- 1. kiosk_check_clearance now validates student belongs to selected class
-- 2. kiosk_find_or_create_session — reuse today's session for same class+semester
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Updated kiosk_check_clearance with class validation ───────────────────
CREATE OR REPLACE FUNCTION kiosk_check_clearance(
  p_school_id   UUID,
  p_nfc_chip_id VARCHAR,
  p_semester    VARCHAR,
  p_class_id    UUID DEFAULT NULL   -- if provided, student MUST be in this class
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
  v_in_class      BOOLEAN := TRUE;
  v_class_name    TEXT;
BEGIN
  -- 1. Find student via NFC card
  SELECT
    s.id               AS student_id,
    s.first_name,
    s.last_name,
    s.registration_number,
    nc.card_number
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

  -- 2. If class_id provided, verify student is assigned to that class
  IF p_class_id IS NOT NULL THEN
    SELECT c.name INTO v_class_name
    FROM   classes c WHERE c.id = p_class_id;

    SELECT EXISTS (
      SELECT 1 FROM class_assignments
      WHERE  student_id  = v_student.student_id
        AND  class_id    = p_class_id
        AND  removed_at  IS NULL
    ) INTO v_in_class;

    IF NOT v_in_class THEN
      -- Return a special "wrong class" result instead of raising — lets UI show a clear message
      RETURN jsonb_build_object(
        'student_id',          v_student.student_id,
        'student_name',        v_student.first_name || ' ' || v_student.last_name,
        'first_name',          v_student.first_name,
        'last_name',           v_student.last_name,
        'registration_number', v_student.registration_number,
        'class_name',          '',
        'card_number',         v_student.card_number,
        'wrong_class',         TRUE,
        'expected_class',      COALESCE(v_class_name, ''),
        'is_cleared',          FALSE,
        'total_balance_usd',   0,
        'fee_details',         '[]'::jsonb,
        'semester',            p_semester
      );
    END IF;
  END IF;

  -- 3. Get student's actual class name
  SELECT c.name INTO v_class_name
  FROM   classes c
  JOIN   class_assignments ca ON ca.class_id = c.id
  WHERE  ca.student_id = v_student.student_id
    AND  ca.removed_at IS NULL
  LIMIT  1;

  -- 4. Get current academic year
  SELECT setting_value INTO v_academic_year
  FROM   school_settings
  WHERE  school_id   = p_school_id
    AND  setting_key = 'current_academic_year'
  LIMIT  1;

  -- 5a. Installment-based fees for this semester
  FOR v_rec IN
    SELECT
      COALESCE(fstr.description, fstr.fee_type) AS fee_type,
      sfi.term_name,
      sfi.amount_due,
      sfi.amount_paid,
      sfi.balance,
      sfi.status
    FROM   student_fee_installments sfi
    JOIN   student_fees    sf   ON sf.id   = sfi.student_fee_id
    JOIN   fee_structures  fstr ON fstr.id = sf.fee_structure_id
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

  -- 5b. Non-installment fees (whole year)
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
    'class_name',          COALESCE(v_class_name, ''),
    'card_number',         v_student.card_number,
    'wrong_class',         FALSE,
    'is_cleared',          (v_total_balance = 0),
    'total_balance_usd',   v_total_balance,
    'fee_details',         v_fee_details,
    'semester',            p_semester
  );
END;
$$;

GRANT EXECUTE ON FUNCTION kiosk_check_clearance(UUID, VARCHAR, VARCHAR, UUID) TO anon;
GRANT EXECUTE ON FUNCTION kiosk_check_clearance(UUID, VARCHAR, VARCHAR, UUID) TO authenticated;

-- ── 2. kiosk_find_or_create_session ─────────────────────────────────────────
-- Returns today's existing session for the same school+class+semester, or
-- creates a new one. Ensures records from earlier in the day are not lost.
CREATE OR REPLACE FUNCTION kiosk_find_or_create_session(
  p_school_id     UUID,
  p_semester      VARCHAR,
  p_class_id      UUID,
  p_class_name    VARCHAR,
  p_academic_year VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id UUID;
  v_is_new     BOOLEAN := FALSE;
BEGIN
  -- Look for an existing session today for this school + class + semester
  SELECT id INTO v_session_id
  FROM   kiosk_sessions
  WHERE  school_id    = p_school_id
    AND  class_id     = p_class_id
    AND  semester     = p_semester
    AND  academic_year = p_academic_year
    AND  started_at::date = CURRENT_DATE
  ORDER  BY started_at DESC
  LIMIT  1;

  -- Create a new session if none found
  IF v_session_id IS NULL THEN
    INSERT INTO kiosk_sessions (school_id, semester, class_id, class_name, academic_year)
    VALUES (p_school_id, p_semester, p_class_id, p_class_name, p_academic_year)
    RETURNING id INTO v_session_id;
    v_is_new := TRUE;
  END IF;

  RETURN jsonb_build_object(
    'session_id', v_session_id,
    'is_new',     v_is_new
  );
END;
$$;

GRANT EXECUTE ON FUNCTION kiosk_find_or_create_session(UUID, VARCHAR, UUID, VARCHAR, VARCHAR) TO anon;
GRANT EXECUTE ON FUNCTION kiosk_find_or_create_session(UUID, VARCHAR, UUID, VARCHAR, VARCHAR) TO authenticated;

NOTIFY pgrst, 'reload schema';
