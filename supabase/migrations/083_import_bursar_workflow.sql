-- Migration 083: Proper import + bursar fee workflow
--
-- Changes:
--   1. bulk_import_students  — remove auth account creation + remove reg_fee_paid
--      checkbox. Students are imported as pending (no login), fees are assigned.
--      Bursar must confirm reg fee; Registrar then enrolls (which creates auth).
--
--   2. confirm_import_enrollment — moved auth account creation here (was in
--      bulk_import). Also activates the student record.
--
--   3. bursar_confirm_reg_fee(p_student_id) — Bursar marks a pending imported
--      student's registration fee as paid and writes a payments audit record.
--
--   4. bursar_correct_fee(p_student_fee_id, p_paid_amount, p_reason) — Bursar
--      corrects any student's fee paid amount and creates an audit payment record.


-- ════════════════════════════════════════════════════════════════
-- 1. bulk_import_students — no auth account, no reg_fee_paid flag
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION bulk_import_students(
  p_school_id        UUID,
  p_academic_year    TEXT,
  p_students         JSONB,
  p_default_password TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_role   user_role;
  v_caller_school UUID;
  v_student       JSONB;
  v_row_num       INT := 0;
  v_results       JSONB := '[]'::JSONB;

  v_first_name  TEXT;
  v_last_name   TEXT;
  v_dob         DATE;
  v_gender      TEXT;
  v_class_name  TEXT;
  v_class_id    UUID;
  v_grade_level TEXT;
  v_g_name      TEXT;
  v_g_phone     TEXT;
  v_g_email     TEXT;

  v_reg_number TEXT;
  v_student_id UUID;
BEGIN
  -- ── Authorisation ──────────────────────────────────────────────────────────
  SELECT role, school_id
    INTO v_caller_role, v_caller_school
    FROM users WHERE auth_id = auth.uid();

  IF v_caller_role NOT IN (
    'registrar','admin_staff','it_admin','principal','vice_principal','super_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only IT Admin, Registrar, or Admin Staff can import students';
  END IF;

  IF v_caller_role != 'super_admin' AND v_caller_school != p_school_id THEN
    RAISE EXCEPTION 'You can only import students into your own school';
  END IF;

  -- ── Process each row ───────────────────────────────────────────────────────
  FOR v_student IN SELECT * FROM jsonb_array_elements(p_students)
  LOOP
    v_row_num := v_row_num + 1;

    BEGIN  -- inner block: one row failure does not abort the whole batch

      v_first_name := NULLIF(TRIM(v_student->>'first_name'), '');
      v_last_name  := NULLIF(TRIM(v_student->>'last_name'),  '');
      v_class_name := NULLIF(TRIM(v_student->>'class_name'), '');
      v_g_name     := NULLIF(TRIM(v_student->>'guardian_name'),  '');
      v_g_phone    := NULLIF(TRIM(v_student->>'guardian_phone'), '');
      v_g_email    := NULLIF(TRIM(v_student->>'guardian_email'), '');
      v_gender     := NULLIF(TRIM(v_student->>'gender'), '');

      BEGIN
        v_dob := (v_student->>'date_of_birth')::DATE;
      EXCEPTION WHEN OTHERS THEN
        v_dob := NULL;
      END;

      IF v_first_name IS NULL THEN RAISE EXCEPTION 'first_name is required'; END IF;
      IF v_last_name  IS NULL THEN RAISE EXCEPTION 'last_name is required';  END IF;
      IF v_class_name IS NULL THEN RAISE EXCEPTION 'class_name is required'; END IF;
      IF v_g_name     IS NULL THEN RAISE EXCEPTION 'guardian_name is required'; END IF;
      IF v_g_phone    IS NULL THEN RAISE EXCEPTION 'guardian_phone is required'; END IF;

      SELECT id, grade_level
        INTO v_class_id, v_grade_level
        FROM classes
       WHERE school_id  = p_school_id
         AND LOWER(name) = LOWER(v_class_name)
       LIMIT 1;

      IF v_class_id IS NULL THEN
        RAISE EXCEPTION 'Class "%" not found — check spelling matches exactly', v_class_name;
      END IF;

      v_reg_number := generate_registration_number(p_school_id);

      -- ── Student record (no auth account yet) ──────────────────────────────
      INSERT INTO students (
        school_id, registration_number,
        first_name, last_name,
        date_of_birth, gender,
        enrollment_date,
        current_grade_level, current_class_id,
        status
      ) VALUES (
        p_school_id, v_reg_number,
        v_first_name, v_last_name,
        v_dob, v_gender,
        CURRENT_DATE,
        v_grade_level, v_class_id,
        'enrolled'::student_status
      )
      RETURNING id INTO v_student_id;

      -- ── Guardian ──────────────────────────────────────────────────────────
      INSERT INTO guardians (
        student_id, school_id, relationship,
        full_name, email, phone
      ) VALUES (
        v_student_id, p_school_id, 'guardian',
        v_g_name, v_g_email, v_g_phone
      );

      -- ── Enrollment: always pending_payment — Bursar must clear fees first ─
      INSERT INTO student_enrollments (
        student_id, school_id,
        academic_year, enrollment_date, status
      ) VALUES (
        v_student_id, p_school_id,
        p_academic_year, CURRENT_DATE, 'pending_payment'
      );

      INSERT INTO class_assignments (class_id, student_id, academic_year)
      VALUES (v_class_id, v_student_id, p_academic_year)
      ON CONFLICT DO NOTHING;

      -- ── Assign class fees (registration + tuition) ────────────────────────
      PERFORM assign_class_fees_to_student(
        v_student_id, v_class_id, p_school_id, p_academic_year
      );

      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'row_number',          v_row_num,
        'success',             TRUE,
        'first_name',          v_first_name,
        'last_name',           v_last_name,
        'class_name',          v_grade_level,
        'registration_number', v_reg_number,
        'enrollment_status',   'pending_payment'
      ));

    EXCEPTION WHEN OTHERS THEN
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'row_number', v_row_num,
        'success',    FALSE,
        'first_name', v_student->>'first_name',
        'last_name',  v_student->>'last_name',
        'class_name', v_student->>'class_name',
        'error',      SQLERRM
      ));
    END;
  END LOOP;

  RETURN v_results;
END;
$$;

GRANT EXECUTE ON FUNCTION bulk_import_students(UUID, TEXT, JSONB)      TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_import_students(UUID, TEXT, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_import_students(UUID, TEXT, JSONB)      TO service_role;
GRANT EXECUTE ON FUNCTION bulk_import_students(UUID, TEXT, JSONB, TEXT) TO service_role;


-- ════════════════════════════════════════════════════════════════
-- 2. confirm_import_enrollment — now creates the auth account
--    (moved from bulk_import_students)
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION confirm_import_enrollment(p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_role   user_role;
  v_caller_school UUID;
  v_student       RECORD;
  v_school        RECORD;
  v_email         TEXT;
  v_password      TEXT;
  v_auth_id       UUID;
  v_user_id       UUID;
  v_encrypted_pw  TEXT;
  v_default_pw    TEXT;
BEGIN
  SELECT role, school_id
    INTO v_caller_role, v_caller_school
    FROM users WHERE auth_id = auth.uid();

  IF v_caller_role NOT IN (
    'registrar','principal','vice_principal','admin_staff','it_admin','super_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only Registrar, Principal, or IT Admin can confirm enrollment';
  END IF;

  SELECT * INTO v_student FROM students WHERE id = p_student_id;

  IF v_student.id IS NULL THEN
    RAISE EXCEPTION 'Student not found';
  END IF;

  IF v_student.school_id != v_caller_school AND v_caller_role != 'super_admin' THEN
    RAISE EXCEPTION 'Student belongs to a different school';
  END IF;

  -- ── Gate: registration fee must be paid ───────────────────────────────────
  IF EXISTS (
    SELECT 1
    FROM student_fees sf
    JOIN fee_structures fs ON fs.id = sf.fee_structure_id
    WHERE sf.student_id = p_student_id
      AND fs.fee_type   = 'registration'
      AND sf.status     NOT IN ('paid', 'partial')
  ) THEN
    RAISE EXCEPTION
      'Registration fee has not been confirmed by the Bursar. Enrollment cannot proceed.';
  END IF;

  -- ── Activate enrollment ───────────────────────────────────────────────────
  UPDATE student_enrollments
     SET status     = 'active',
         updated_at = NOW()
   WHERE student_id = p_student_id
     AND status     = 'pending_payment';

  -- ── Create auth account if it does not exist yet ──────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM users WHERE student_id_ref = p_student_id
  ) AND NOT EXISTS (
    SELECT 1 FROM students s JOIN users u ON u.id = s.user_id WHERE s.id = p_student_id
  ) THEN
    -- Get default password from school settings
    SELECT value INTO v_default_pw
      FROM school_settings
     WHERE school_id = v_student.school_id
       AND key       = 'default_student_password'
     LIMIT 1;

    v_email       := LOWER(TRIM(v_student.registration_number)) || '@student.schoolsync';
    v_password    := COALESCE(NULLIF(TRIM(v_default_pw), ''), v_student.registration_number);
    v_auth_id     := gen_random_uuid();
    v_encrypted_pw := extensions.crypt(v_password, extensions.gen_salt('bf'));

    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at,
        invited_at, confirmation_token, confirmation_sent_at,
        recovery_token, recovery_sent_at,
        email_change_token_new, email_change, email_change_sent_at,
        last_sign_in_at,
        raw_app_meta_data, raw_user_meta_data,
        is_super_admin, created_at, updated_at,
        phone, phone_confirmed_at,
        phone_change, phone_change_token, phone_change_sent_at,
        email_change_token_current, email_change_confirm_status,
        banned_until, reauthentication_token, reauthentication_sent_at,
        is_sso_user, deleted_at, is_anonymous
      ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        v_auth_id, 'authenticated', 'authenticated',
        v_email, v_encrypted_pw,
        NOW(),
        NULL, '', NULL,
        '', NULL,
        '', '', NULL,
        NULL,
        jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
        jsonb_build_object(
          'first_name', v_student.first_name,
          'last_name',  v_student.last_name,
          'role',       'student',
          'school_id',  v_student.school_id::TEXT
        ),
        FALSE, NOW(), NOW(),
        NULL, NULL,
        '', '', NULL,
        '', 0,
        NULL, '', NULL,
        FALSE, NULL, FALSE
      );

      INSERT INTO auth.identities (
        id, user_id, provider_id, identity_data,
        provider, last_sign_in_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), v_auth_id, v_email,
        jsonb_build_object(
          'sub',            v_auth_id::TEXT,
          'email',          v_email,
          'email_verified', TRUE,
          'phone_verified', FALSE
        ),
        'email', NOW(), NOW(), NOW()
      );

      INSERT INTO users (
        auth_id, school_id, email,
        first_name, last_name, full_name,
        role, is_active
      ) VALUES (
        v_auth_id, v_student.school_id, v_email,
        v_student.first_name, v_student.last_name,
        v_student.first_name || ' ' || v_student.last_name,
        'student', TRUE
      )
      RETURNING id INTO v_user_id;

      UPDATE students
         SET user_id    = v_user_id,
             updated_at = NOW()
       WHERE id = p_student_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success',             TRUE,
    'student_id',          p_student_id,
    'registration_number', v_student.registration_number,
    'login_email',         LOWER(TRIM(v_student.registration_number)) || '@student.schoolsync',
    'message',             'Enrollment confirmed — student account created and activated.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION confirm_import_enrollment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION confirm_import_enrollment(UUID) TO service_role;


-- ════════════════════════════════════════════════════════════════
-- 3. bursar_confirm_reg_fee
--    Bursar marks a pending student's registration fee as paid
--    and creates an audit payment record.
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION bursar_confirm_reg_fee(p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role   user_role;
  v_caller_school UUID;
  v_student       RECORD;
  v_fee           RECORD;
BEGIN
  SELECT role, school_id
    INTO v_caller_role, v_caller_school
    FROM users WHERE auth_id = auth.uid();

  IF v_caller_role NOT IN (
    'bursar','principal','vice_principal','admin_staff','super_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only Bursar can confirm fee payments';
  END IF;

  SELECT * INTO v_student FROM students WHERE id = p_student_id;

  IF v_student.id IS NULL THEN
    RAISE EXCEPTION 'Student not found';
  END IF;

  IF v_student.school_id != v_caller_school AND v_caller_role != 'super_admin' THEN
    RAISE EXCEPTION 'Student belongs to a different school';
  END IF;

  -- Find the registration fee for this student
  SELECT sf.*
    INTO v_fee
    FROM student_fees sf
    JOIN fee_structures fs ON fs.id = sf.fee_structure_id
   WHERE sf.student_id = p_student_id
     AND fs.fee_type   = 'registration_fee'
   ORDER BY sf.created_at DESC
   LIMIT 1;

  IF v_fee.id IS NULL THEN
    RAISE EXCEPTION 'No registration fee record found for this student';
  END IF;

  IF v_fee.status IN ('paid', 'partial') THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'message', 'Registration fee was already marked as paid.'
    );
  END IF;

  -- Mark the fee as paid
  UPDATE student_fees
     SET amount_paid = amount_due,
         balance     = 0,
         status      = 'paid',
         updated_at  = NOW()
   WHERE id = v_fee.id;

  -- Create audit payment record
  INSERT INTO payments (
    school_id, student_id, student_fee_id,
    amount_usd, amount_lrd, currency_charged,
    payment_method, gateway_ref, status, payment_date
  ) VALUES (
    v_student.school_id,
    p_student_id,
    v_fee.id,
    v_fee.amount_due,
    0,
    'USD',
    'manual',
    'Registration fee confirmed by Bursar (imported student)',
    'success',
    NOW()
  );

  RETURN jsonb_build_object(
    'success',    TRUE,
    'student_id', p_student_id,
    'amount',     v_fee.amount_due,
    'message',    'Registration fee confirmed and marked as paid.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION bursar_confirm_reg_fee(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION bursar_confirm_reg_fee(UUID) TO service_role;


-- ════════════════════════════════════════════════════════════════
-- 4. bursar_correct_fee
--    Bursar corrects a student's paid amount on any fee.
--    Always creates an audit payment record with the reason.
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION bursar_correct_fee(
  p_student_fee_id UUID,
  p_paid_amount    NUMERIC,
  p_reason         TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role   user_role;
  v_caller_school UUID;
  v_fee           RECORD;
  v_adjustment    NUMERIC;
  v_new_balance   NUMERIC;
  v_new_status    TEXT;
BEGIN
  SELECT role, school_id
    INTO v_caller_role, v_caller_school
    FROM users WHERE auth_id = auth.uid();

  IF v_caller_role NOT IN (
    'bursar','principal','vice_principal','admin_staff','super_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only Bursar can correct fee payments';
  END IF;

  IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
    RAISE EXCEPTION 'A reason is required for fee corrections';
  END IF;

  IF p_paid_amount < 0 THEN
    RAISE EXCEPTION 'Paid amount cannot be negative';
  END IF;

  SELECT sf.*, s.school_id AS student_school_id
    INTO v_fee
    FROM student_fees sf
    JOIN students s ON s.id = sf.student_id
   WHERE sf.id = p_student_fee_id;

  IF v_fee.id IS NULL THEN
    RAISE EXCEPTION 'Fee record not found';
  END IF;

  IF v_fee.student_school_id != v_caller_school AND v_caller_role != 'super_admin' THEN
    RAISE EXCEPTION 'Fee belongs to a student at a different school';
  END IF;

  IF p_paid_amount > v_fee.amount_due THEN
    RAISE EXCEPTION 'Paid amount (%) cannot exceed amount due (%)',
      p_paid_amount, v_fee.amount_due;
  END IF;

  -- Calculate adjustment (difference from current paid amount)
  v_adjustment  := p_paid_amount - COALESCE(v_fee.amount_paid, 0);
  v_new_balance := v_fee.amount_due - p_paid_amount;
  v_new_status  := CASE
    WHEN p_paid_amount >= v_fee.amount_due THEN 'paid'
    WHEN p_paid_amount > 0                 THEN 'partial'
    ELSE 'pending'
  END;

  -- Update the fee record
  UPDATE student_fees
     SET amount_paid = p_paid_amount,
         balance     = v_new_balance,
         status      = v_new_status,
         updated_at  = NOW()
   WHERE id = p_student_fee_id;

  -- Always create an audit record even if adjustment is zero
  INSERT INTO payments (
    school_id, student_id, student_fee_id,
    amount_usd, amount_lrd, currency_charged,
    payment_method, gateway_ref, status, payment_date
  ) VALUES (
    v_fee.student_school_id,
    v_fee.student_id,
    p_student_fee_id,
    v_adjustment,
    0,
    'USD',
    'manual',
    'Bursar correction: ' || TRIM(p_reason),
    'success',
    NOW()
  );

  RETURN jsonb_build_object(
    'success',        TRUE,
    'student_fee_id', p_student_fee_id,
    'old_paid',       COALESCE(v_fee.amount_paid, 0),
    'new_paid',       p_paid_amount,
    'new_balance',    v_new_balance,
    'new_status',     v_new_status,
    'message',        'Fee record updated and audit entry created.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION bursar_correct_fee(UUID, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION bursar_correct_fee(UUID, NUMERIC, TEXT) TO service_role;


-- ════════════════════════════════════════════════════════════════
-- 5. list_pending_import_students — accessible by Bursar too
--    (previously only Registrar roles could call it)
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION list_pending_import_students(p_school_id UUID)
RETURNS TABLE (
  student_id          UUID,
  first_name          TEXT,
  last_name           TEXT,
  registration_number TEXT,
  class_name          TEXT,
  reg_fee_paid        BOOLEAN,
  reg_fee_amount      NUMERIC,
  imported_at         TIMESTAMPTZ
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
    'registrar','bursar','principal','vice_principal',
    'admin_staff','it_admin','super_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_caller_role != 'super_admin' AND v_caller_school != p_school_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    s.id                                        AS student_id,
    s.first_name::TEXT                          AS first_name,
    s.last_name::TEXT                           AS last_name,
    s.registration_number::TEXT                 AS registration_number,
    COALESCE(c.name, s.current_grade_level)::TEXT AS class_name,
    COALESCE(
      (SELECT sf.status::TEXT IN ('paid','partial')
         FROM student_fees sf
         JOIN fee_structures fs ON fs.id = sf.fee_structure_id
        WHERE sf.student_id = s.id
          AND fs.fee_type   = 'registration'
        ORDER BY sf.created_at DESC LIMIT 1),
      TRUE
    )                                           AS reg_fee_paid,
    COALESCE(
      (SELECT sf.amount_due::NUMERIC
         FROM student_fees sf
         JOIN fee_structures fs ON fs.id = sf.fee_structure_id
        WHERE sf.student_id = s.id
          AND fs.fee_type   = 'registration'
        ORDER BY sf.created_at DESC LIMIT 1),
      0::NUMERIC
    )                                           AS reg_fee_amount,
    se.created_at::TIMESTAMPTZ                  AS imported_at
  FROM students s
  JOIN student_enrollments se ON se.student_id = s.id
                              AND se.status     = 'pending_payment'
  LEFT JOIN classes c ON c.id = s.current_class_id
  WHERE s.school_id = p_school_id
    AND NOT EXISTS (
      SELECT 1 FROM student_applications sa WHERE sa.student_id = s.id
    )
  ORDER BY se.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION list_pending_import_students(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION list_pending_import_students(UUID) TO service_role;


NOTIFY pgrst, 'reload schema';
