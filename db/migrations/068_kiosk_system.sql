-- Migration 068: Exam Clearance Kiosk System
--
-- Standalone kiosk for exam fee clearance:
--   • Schools access by school_code + kiosk_pin (set by finance in bursar settings)
--   • Finance selects semester (1 or 2) + class, then scans student NFC cards
--   • System checks if student has outstanding fees and shows CLEARED / BALANCE OWED
--   • Scan results saved per session; downloadable as CSV
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. kiosk_sessions — one per scanning session (class + semester)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kiosk_sessions (
  id          UUID    DEFAULT uuid_generate_v4() PRIMARY KEY,
  school_id   UUID    NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  semester    VARCHAR(50)  NOT NULL,  -- 'Semester 1' | 'Semester 2'
  class_id    UUID    REFERENCES classes(id) ON DELETE SET NULL,
  class_name  VARCHAR(255),
  academic_year VARCHAR(20),
  started_at  TIMESTAMPTZ DEFAULT NOW(),
  ended_at    TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. kiosk_scan_records — one row per student scanned in a session
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kiosk_scan_records (
  id                  UUID    DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id          UUID    NOT NULL REFERENCES kiosk_sessions(id) ON DELETE CASCADE,
  school_id           UUID    NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id          UUID    REFERENCES students(id) ON DELETE SET NULL,
  student_name        VARCHAR(255),
  registration_number VARCHAR(100),
  class_name          VARCHAR(255),
  scanned_at          TIMESTAMPTZ DEFAULT NOW(),
  is_cleared          BOOLEAN NOT NULL DEFAULT FALSE,
  total_balance_usd   DECIMAL(10,2) DEFAULT 0,
  fee_details         JSONB   DEFAULT '[]'::jsonb,

  -- Prevent double-scan of same student in same session
  UNIQUE(session_id, student_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RLS — allow anon + authenticated to use kiosk RPCs only
--    (all real access goes through SECURITY DEFINER functions below)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE kiosk_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE kiosk_scan_records ENABLE ROW LEVEL SECURITY;

-- Staff can see their school's sessions/records (for admin review)
CREATE POLICY "kiosk_sessions_staff"
  ON kiosk_sessions FOR ALL TO authenticated
  USING (school_id = (SELECT school_id FROM users WHERE auth_id = auth.uid() LIMIT 1))
  WITH CHECK (school_id = (SELECT school_id FROM users WHERE auth_id = auth.uid() LIMIT 1));

CREATE POLICY "kiosk_records_staff"
  ON kiosk_scan_records FOR ALL TO authenticated
  USING (school_id = (SELECT school_id FROM users WHERE auth_id = auth.uid() LIMIT 1))
  WITH CHECK (school_id = (SELECT school_id FROM users WHERE auth_id = auth.uid() LIMIT 1));

-- Service role full access (used by SECURITY DEFINER RPCs called from kiosk)
CREATE POLICY "kiosk_sessions_service"
  ON kiosk_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "kiosk_records_service"
  ON kiosk_scan_records FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RPC: verify_kiosk_access
--    Called when school enters their code + PIN on the kiosk login screen.
--    Returns school info (id, name, logo_url, school_code) if valid, raises exception if not.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION verify_kiosk_access(
  p_school_code VARCHAR,
  p_pin         VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school    RECORD;
  v_stored_pin TEXT;
BEGIN
  -- Find school by code (case-insensitive)
  SELECT id, name, school_code, logo_url, address
  INTO   v_school
  FROM   schools
  WHERE  UPPER(school_code) = UPPER(p_school_code)
  LIMIT  1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid school code';
  END IF;

  -- Get kiosk PIN from school_settings
  SELECT setting_value INTO v_stored_pin
  FROM   school_settings
  WHERE  school_id = v_school.id
    AND  setting_key = 'kiosk_pin'
  LIMIT  1;

  IF v_stored_pin IS NULL THEN
    RAISE EXCEPTION 'Kiosk PIN not set. Ask finance to configure it in the Bursar dashboard.';
  END IF;

  IF v_stored_pin <> p_pin THEN
    RAISE EXCEPTION 'Incorrect PIN';
  END IF;

  -- Return school info + current academic year
  RETURN jsonb_build_object(
    'school_id',   v_school.id,
    'school_name', v_school.name,
    'school_code', v_school.school_code,
    'logo_url',    v_school.logo_url,
    'address',     v_school.address,
    'academic_year', COALESCE(
      (SELECT setting_value FROM school_settings
       WHERE school_id = v_school.id AND setting_key = 'current_academic_year' LIMIT 1),
      to_char(CURRENT_DATE, 'YYYY') || '-' || to_char(CURRENT_DATE + interval '1 year', 'YYYY')
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION verify_kiosk_access(VARCHAR, VARCHAR) TO anon;
GRANT EXECUTE ON FUNCTION verify_kiosk_access(VARCHAR, VARCHAR) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RPC: kiosk_get_classes
--    Returns all classes for a school (no auth needed — gated by school_id
--    which was already verified via verify_kiosk_access).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION kiosk_get_classes(p_school_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_classes JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id',          c.id,
      'name',        c.name,
      'grade_level', c.grade_level,
      'section',     c.section
    ) ORDER BY c.grade_level, c.name
  )
  INTO v_classes
  FROM classes c
  WHERE c.school_id = p_school_id;

  RETURN COALESCE(v_classes, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION kiosk_get_classes(UUID) TO anon;
GRANT EXECUTE ON FUNCTION kiosk_get_classes(UUID) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RPC: kiosk_check_clearance
--    Tap NFC card → look up student → check all fee balances → return result.
--
--    Clearance logic:
--      a) Fees WITH installments: check student_fee_installments where
--         term_name ILIKE '%Semester N%' — cleared if all balance = 0
--      b) Fees WITHOUT installments: check student_fees.balance directly
--      c) CLEARED = total outstanding balance = 0
-- ─────────────────────────────────────────────────────────────────────────────
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
  v_student      RECORD;
  v_total_balance DECIMAL(10,2) := 0;
  v_fee_details  JSONB := '[]'::jsonb;
  v_detail       JSONB;
  v_academic_year TEXT;
BEGIN
  -- 1. Find student via NFC card
  SELECT
    s.id            AS student_id,
    s.first_name,
    s.last_name,
    s.registration_number,
    nc.card_number,
    nc.id           AS card_id,
    (SELECT name FROM classes c
     JOIN class_assignments ca ON ca.class_id = c.id
     WHERE ca.student_id = s.id AND ca.removed_at IS NULL
     LIMIT 1)       AS class_name
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

  -- 2. Get current academic year
  SELECT setting_value INTO v_academic_year
  FROM   school_settings
  WHERE  school_id = p_school_id
    AND  setting_key = 'current_academic_year'
  LIMIT  1;

  -- 3a. Check installment-based fees for this semester
  FOR v_detail IN
    SELECT jsonb_build_object(
      'fee_type',    COALESCE(fstr.description, fstr.fee_type),
      'term',        sfi.term_name,
      'amount_due',  sfi.amount_due,
      'amount_paid', sfi.amount_paid,
      'balance',     sfi.balance,
      'status',      sfi.status
    ) AS d,
    sfi.balance AS bal
    FROM   student_fee_installments sfi
    JOIN   student_fees sf      ON sf.id  = sfi.student_fee_id
    JOIN   fee_structures fstr  ON fstr.id = sf.fee_structure_id
    WHERE  sf.student_id   = v_student.student_id
      AND  sf.school_id    = p_school_id
      AND  (v_academic_year IS NULL OR sf.academic_year = v_academic_year)
      AND  LOWER(sfi.term_name) LIKE LOWER('%' || p_semester || '%')
  LOOP
    v_total_balance := v_total_balance + (v_detail).bal;
    v_fee_details   := v_fee_details || (v_detail).d;
  END LOOP;

  -- 3b. Check non-installment fees (apply to entire year → both semesters)
  FOR v_detail IN
    SELECT jsonb_build_object(
      'fee_type',    COALESCE(fstr.description, fstr.fee_type),
      'term',        'Full Year',
      'amount_due',  sf.amount_due,
      'amount_paid', sf.amount_paid,
      'balance',     sf.balance,
      'status',      sf.status
    ) AS d,
    sf.balance AS bal
    FROM   student_fees sf
    JOIN   fee_structures fstr ON fstr.id = sf.fee_structure_id
    WHERE  sf.student_id        = v_student.student_id
      AND  sf.school_id         = p_school_id
      AND  fstr.has_installments = FALSE
      AND  sf.balance            > 0
      AND  (v_academic_year IS NULL OR sf.academic_year = v_academic_year)
  LOOP
    v_total_balance := v_total_balance + (v_detail).bal;
    v_fee_details   := v_fee_details || (v_detail).d;
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. RPC: kiosk_start_session — create a new scan session
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION kiosk_start_session(
  p_school_id   UUID,
  p_semester    VARCHAR,
  p_class_id    UUID,
  p_class_name  VARCHAR,
  p_academic_year VARCHAR
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id UUID;
BEGIN
  INSERT INTO kiosk_sessions (school_id, semester, class_id, class_name, academic_year)
  VALUES (p_school_id, p_semester, p_class_id, p_class_name, p_academic_year)
  RETURNING id INTO v_session_id;

  RETURN v_session_id;
END;
$$;

GRANT EXECUTE ON FUNCTION kiosk_start_session(UUID, VARCHAR, UUID, VARCHAR, VARCHAR) TO anon;
GRANT EXECUTE ON FUNCTION kiosk_start_session(UUID, VARCHAR, UUID, VARCHAR, VARCHAR) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. RPC: kiosk_save_scan — upsert a scan record (idempotent on same student)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION kiosk_save_scan(
  p_session_id          UUID,
  p_school_id           UUID,
  p_student_id          UUID,
  p_student_name        VARCHAR,
  p_registration_number VARCHAR,
  p_class_name          VARCHAR,
  p_is_cleared          BOOLEAN,
  p_total_balance_usd   DECIMAL,
  p_fee_details         JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record_id UUID;
BEGIN
  INSERT INTO kiosk_scan_records (
    session_id, school_id, student_id, student_name,
    registration_number, class_name, is_cleared,
    total_balance_usd, fee_details
  ) VALUES (
    p_session_id, p_school_id, p_student_id, p_student_name,
    p_registration_number, p_class_name, p_is_cleared,
    p_total_balance_usd, p_fee_details
  )
  ON CONFLICT (session_id, student_id) DO UPDATE SET
    is_cleared        = EXCLUDED.is_cleared,
    total_balance_usd = EXCLUDED.total_balance_usd,
    fee_details       = EXCLUDED.fee_details,
    scanned_at        = NOW()
  RETURNING id INTO v_record_id;

  RETURN v_record_id;
END;
$$;

GRANT EXECUTE ON FUNCTION kiosk_save_scan(UUID, UUID, UUID, VARCHAR, VARCHAR, VARCHAR, BOOLEAN, DECIMAL, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION kiosk_save_scan(UUID, UUID, UUID, VARCHAR, VARCHAR, VARCHAR, BOOLEAN, DECIMAL, JSONB) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. RPC: kiosk_get_session_records — fetch all records for a session
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION kiosk_get_session_records(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_records JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id',                  r.id,
      'student_name',        r.student_name,
      'registration_number', r.registration_number,
      'class_name',          r.class_name,
      'is_cleared',          r.is_cleared,
      'total_balance_usd',   r.total_balance_usd,
      'scanned_at',          r.scanned_at,
      'fee_details',         r.fee_details
    ) ORDER BY r.scanned_at DESC
  )
  INTO v_records
  FROM kiosk_scan_records r
  WHERE r.session_id = p_session_id;

  RETURN COALESCE(v_records, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION kiosk_get_session_records(UUID) TO anon;
GRANT EXECUTE ON FUNCTION kiosk_get_session_records(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
