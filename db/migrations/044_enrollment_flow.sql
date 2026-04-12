-- ============================================================
-- MIGRATION 044: Correct enrollment flow
--
-- Correct 3-step flow:
--   1. Registrar ACCEPTS application
--      → student record created, reg number assigned,
--        ALL class fees assigned, NO auth account yet.
--   2. Finance records registration fee payment
--      → enrollment flipped to 'active' automatically.
--   3. Registrar clicks ENROLL on accepted application
--      → auth account created using school's default_student_password.
--      Student logs in with reg number + school default password.
--
-- Fixes migration 043 which incorrectly auto-provisioned the
-- auth account at accept time using the reg number as password.
-- ============================================================

-- ============================================================
-- PART 1: Add student_id to student_applications
-- Stores the student record created during acceptance so the
-- registrar can look up fee status directly from the application.
-- ============================================================

ALTER TABLE student_applications
  ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES students(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_applications_student_id ON student_applications(student_id);


-- ============================================================
-- PART 2: accept_student_application (final version)
-- • Stores student_id back on the application row
-- • Does NOT auto-provision auth account
-- • Calls assign_class_fees_to_student for all class fees
-- ============================================================

DROP FUNCTION IF EXISTS accept_student_application(UUID, TEXT, UUID);

CREATE OR REPLACE FUNCTION accept_student_application(
  p_application_id UUID,
  p_review_notes   TEXT DEFAULT NULL,
  p_class_id       UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app            RECORD;
  v_caller_role    user_role;
  v_caller_school  UUID;
  v_reg_number     TEXT;
  v_student_id     UUID;
  v_guardian_id    UUID;
  v_assign_class   UUID;
  v_academic_year  TEXT;
  v_fees_assigned  INT := 0;
BEGIN
  -- 1. Verify caller
  SELECT role, school_id
    INTO v_caller_role, v_caller_school
    FROM users WHERE auth_id = auth.uid();

  IF v_caller_role NOT IN (
    'registrar','principal','vice_principal','admin_staff','super_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only registrar or admin can accept applications';
  END IF;

  -- 2. Load application
  SELECT * INTO v_app FROM student_applications WHERE id = p_application_id;
  IF v_app IS NULL THEN
    RAISE EXCEPTION 'Application not found';
  END IF;
  IF v_app.school_id != v_caller_school AND v_caller_role != 'super_admin' THEN
    RAISE EXCEPTION 'Application belongs to a different school';
  END IF;
  IF v_app.status NOT IN ('submitted','under_review','documents_requested','waitlisted') THEN
    RAISE EXCEPTION 'Application is not in a reviewable state (current: %)', v_app.status;
  END IF;

  -- 3. Generate registration number
  v_reg_number := generate_registration_number(v_app.school_id);

  -- 4. Choose class
  v_assign_class := COALESCE(p_class_id, v_app.class_id);

  -- 5. Create student record
  INSERT INTO students (
    school_id, registration_number,
    first_name, last_name, date_of_birth, gender,
    enrollment_date, current_grade_level, current_class_id,
    status, previous_school,
    emergency_contact_name, emergency_contact_phone
  ) VALUES (
    v_app.school_id, v_reg_number,
    v_app.first_name, v_app.last_name, v_app.date_of_birth, v_app.gender,
    CURRENT_DATE, v_app.grade_level_applied, v_assign_class,
    'enrolled'::student_status,
    v_app.previous_school,
    v_app.emergency_contact_name, v_app.emergency_contact_phone
  )
  RETURNING id INTO v_student_id;

  -- 6. Create guardian record
  IF v_app.guardian_full_name IS NOT NULL AND v_app.guardian_full_name != '' THEN
    INSERT INTO guardians (
      student_id, school_id, relationship,
      full_name, email, phone, address, occupation
    ) VALUES (
      v_student_id, v_app.school_id, v_app.guardian_relationship,
      v_app.guardian_full_name, v_app.guardian_email,
      v_app.guardian_phone, v_app.guardian_address, v_app.guardian_occupation
    )
    RETURNING id INTO v_guardian_id;
  END IF;

  -- 7. Determine academic year
  SELECT COALESCE(
    (SELECT setting_value FROM school_settings
      WHERE school_id = v_app.school_id AND setting_key = 'current_academic_year'),
    v_app.academic_year
  ) INTO v_academic_year;

  -- 8. Create enrollment record — pending_payment until reg fee collected
  INSERT INTO student_enrollments (
    student_id, school_id, academic_year, enrollment_date, status
  ) VALUES (
    v_student_id, v_app.school_id, v_academic_year,
    CURRENT_DATE, 'pending_payment'
  );

  -- 9. Assign to class
  IF v_assign_class IS NOT NULL THEN
    INSERT INTO class_assignments (class_id, student_id, academic_year)
    VALUES (v_assign_class, v_student_id, v_academic_year)
    ON CONFLICT DO NOTHING;
  END IF;

  -- 10. Auto-assign ALL fee structures for this class to the student
  IF v_assign_class IS NOT NULL THEN
    v_fees_assigned := assign_class_fees_to_student(
      v_student_id, v_assign_class, v_app.school_id, v_academic_year
    );
  END IF;

  -- 11. Update application — store student_id so registrar can track enrollment
  UPDATE student_applications SET
    status = 'accepted',
    student_id = v_student_id,
    reviewed_by = (SELECT id FROM users WHERE auth_id = auth.uid()),
    reviewed_at = NOW(),
    review_notes = COALESCE(p_review_notes, review_notes),
    assigned_registration_number = v_reg_number,
    updated_at = NOW()
  WHERE id = p_application_id;

  RETURN jsonb_build_object(
    'success',             TRUE,
    'student_id',          v_student_id,
    'registration_number', v_reg_number,
    'guardian_id',         v_guardian_id,
    'class_id',            v_assign_class,
    'fees_assigned',       v_fees_assigned,
    'reg_fee_assigned',    (v_fees_assigned > 0),
    'message',             'Student accepted. All class fees assigned. Waiting for registration fee payment before enrollment.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION accept_student_application(UUID, TEXT, UUID) TO authenticated;


-- ============================================================
-- PART 3: get_application_enrollment_status
-- Called by ApplicationDetail to drive the Enroll button.
--
-- BUG FIX: If NO registration fee structure exists for this
-- student (school skipped it or set it up after acceptance),
-- reg_fee_paid = TRUE so the Enroll button still appears.
-- We only block enrollment when a reg fee exists and is unpaid.
-- ============================================================

CREATE OR REPLACE FUNCTION get_application_enrollment_status(
  p_application_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app                RECORD;
  v_caller_school      UUID;
  v_reg_fee_paid       BOOLEAN := TRUE;   -- default TRUE: no fee = no barrier
  v_reg_fee_amount     NUMERIC := 0;
  v_account_exists     BOOLEAN := FALSE;
  v_enrollment_status  TEXT    := 'pending_payment';
  v_has_reg_fee_record BOOLEAN := FALSE;
BEGIN
  SELECT auth_school_id() INTO v_caller_school;
  IF v_caller_school IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_app FROM student_applications WHERE id = p_application_id;
  IF v_app IS NULL THEN
    RAISE EXCEPTION 'Application not found';
  END IF;
  IF v_app.school_id != v_caller_school AND NOT is_super_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Not yet accepted — nothing to show
  IF v_app.student_id IS NULL THEN
    RETURN jsonb_build_object(
      'accepted',          FALSE,
      'reg_fee_paid',      FALSE,
      'reg_fee_amount',    0,
      'account_exists',    FALSE,
      'enrollment_status', NULL,
      'student_id',        NULL
    );
  END IF;

  -- Check for a registration fee record on this student
  SELECT TRUE, COALESCE(sf.amount_due, 0)
    INTO v_has_reg_fee_record, v_reg_fee_amount
    FROM student_fees sf
    JOIN fee_structures fs ON fs.id = sf.fee_structure_id
   WHERE sf.student_id = v_app.student_id
     AND fs.fee_type   = 'registration_fee'
   ORDER BY sf.created_at DESC
   LIMIT 1;

  -- If a reg fee record EXISTS, check if it is actually paid
  IF v_has_reg_fee_record IS TRUE THEN
    SELECT (sf.status IN ('paid', 'partial'))
      INTO v_reg_fee_paid
      FROM student_fees sf
      JOIN fee_structures fs ON fs.id = sf.fee_structure_id
     WHERE sf.student_id = v_app.student_id
       AND fs.fee_type   = 'registration_fee'
     ORDER BY sf.created_at DESC
     LIMIT 1;
  END IF;
  -- If no reg fee record exists, v_reg_fee_paid stays TRUE (no barrier)

  -- Check if login account exists
  SELECT (user_id IS NOT NULL)
    INTO v_account_exists
    FROM students
   WHERE id = v_app.student_id;

  -- Get current enrollment status
  SELECT COALESCE(status, 'pending_payment')
    INTO v_enrollment_status
    FROM student_enrollments
   WHERE student_id = v_app.student_id
   ORDER BY created_at DESC
   LIMIT 1;

  RETURN jsonb_build_object(
    'accepted',           TRUE,
    'student_id',         v_app.student_id,
    'reg_fee_paid',       COALESCE(v_reg_fee_paid, TRUE),
    'reg_fee_amount',     COALESCE(v_reg_fee_amount, 0),
    'has_reg_fee',        COALESCE(v_has_reg_fee_record, FALSE),
    'account_exists',     COALESCE(v_account_exists, FALSE),
    'enrollment_status',  v_enrollment_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_application_enrollment_status(UUID) TO authenticated;


-- ============================================================
-- PART 4: enroll_student_after_payment
-- Creates login account using school's default_student_password.
--
-- BUG FIX: Only block if a registration fee record EXISTS and
-- is NOT paid. If no fee record exists at all (school has no
-- registration fee for this class), allow enrollment.
-- ============================================================

CREATE OR REPLACE FUNCTION enroll_student_after_payment(
  p_student_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_role    user_role;
  v_caller_school  UUID;
  v_student        RECORD;
  v_default_pw     TEXT;
  v_auth_id        UUID;
  v_user_id        UUID;
  v_email          TEXT;
  v_encrypted_pw   TEXT;
BEGIN
  -- 1. Verify caller
  SELECT role, school_id
    INTO v_caller_role, v_caller_school
    FROM users WHERE auth_id = auth.uid();

  IF v_caller_role NOT IN (
    'registrar','principal','vice_principal','admin_staff','it_admin','super_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only registrar, principal, or IT Admin can enroll students';
  END IF;

  -- 2. Load student
  SELECT s.*
    INTO v_student
    FROM students s
   WHERE s.id = p_student_id;

  IF v_student.id IS NULL THEN
    RAISE EXCEPTION 'Student not found';
  END IF;

  IF v_student.school_id != v_caller_school AND v_caller_role != 'super_admin' THEN
    RAISE EXCEPTION 'Student belongs to a different school';
  END IF;

  -- 3. Already has an account — idempotent return
  IF v_student.user_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success',             TRUE,
      'already_exists',      TRUE,
      'registration_number', v_student.registration_number,
      'message',             'Student already has a login account.'
    );
  END IF;

  -- 4. Block ONLY if a registration fee record exists and is unpaid
  --    (if no reg fee record exists, there is nothing to pay — allow)
  IF EXISTS (
    SELECT 1
    FROM student_fees sf
    JOIN fee_structures fs ON fs.id = sf.fee_structure_id
    WHERE sf.student_id = p_student_id
      AND fs.fee_type   = 'registration_fee'
      AND sf.status     NOT IN ('paid', 'partial')
  ) THEN
    RAISE EXCEPTION 'Registration fee has not been paid. Ask the bursar to record payment first.';
  END IF;

  -- 5. Get school default student password (IT Admin sets this in School Settings)
  SELECT COALESCE(
    (SELECT setting_value FROM school_settings
      WHERE school_id = v_student.school_id
        AND setting_key = 'default_student_password'),
    'school123'
  ) INTO v_default_pw;

  -- 6. Build internal login email (never sent — just used as auth key)
  v_email := lower(trim(v_student.registration_number)) || '@student.schoolsync';

  -- Guard: account already in auth (shouldn't happen but be safe)
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    -- Link the existing auth user to the student instead of failing
    DECLARE
      v_existing_auth_id UUID;
    BEGIN
      SELECT au.id INTO v_existing_auth_id FROM auth.users au WHERE au.email = v_email;
      SELECT u.id INTO v_user_id FROM users u WHERE u.auth_id = v_existing_auth_id;
      IF v_user_id IS NOT NULL THEN
        UPDATE students SET user_id = v_user_id, updated_at = NOW() WHERE id = p_student_id;
        RETURN jsonb_build_object(
          'success',             TRUE,
          'already_exists',      TRUE,
          'registration_number', v_student.registration_number,
          'message',             'Auth account already existed — linked to student record.'
        );
      END IF;
    END;
  END IF;

  -- 7. Create Supabase auth user
  v_auth_id      := gen_random_uuid();
  v_encrypted_pw := extensions.crypt(v_default_pw, extensions.gen_salt('bf'));

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
      'school_id',  v_student.school_id::text
    ),
    FALSE, NOW(), NOW(),
    NULL, NULL,
    '', '', NULL,
    '', 0,
    NULL, '', NULL,
    FALSE, NULL, FALSE
  );

  -- 8. Create auth identity
  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data,
    provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_auth_id, v_email,
    jsonb_build_object(
      'sub',            v_auth_id::text,
      'email',          v_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email', NOW(), NOW(), NOW()
  );

  -- 9. Create public.users row
  INSERT INTO users (
    auth_id, school_id, email,
    first_name, last_name, full_name,
    role, is_active
  )
  VALUES (
    v_auth_id, v_student.school_id, v_email,
    v_student.first_name, v_student.last_name,
    v_student.first_name || ' ' || v_student.last_name,
    'student', TRUE
  )
  RETURNING id INTO v_user_id;

  -- 10. Link student → user
  UPDATE students
  SET    user_id = v_user_id, updated_at = NOW()
  WHERE  id = p_student_id;

  -- 11. Mark enrollment active
  UPDATE student_enrollments
  SET    status = 'active', updated_at = NOW()
  WHERE  student_id = p_student_id
    AND  status = 'pending_payment';

  RETURN jsonb_build_object(
    'success',             TRUE,
    'already_exists',      FALSE,
    'student_id',          p_student_id,
    'user_id',             v_user_id,
    'registration_number', v_student.registration_number,
    'message',             'Student enrolled successfully. Login: registration number + school default password.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION enroll_student_after_payment(UUID) TO authenticated;


-- ============================================================
-- PART 5: list_ready_to_enroll
-- Students whose registration fee is paid (or no fee required)
-- and whose login account has not been created yet.
--
-- BUG FIX: Use LEFT JOIN + filter so students with no reg fee
-- record (no fee required) are also included.
-- ============================================================

CREATE OR REPLACE FUNCTION list_ready_to_enroll(p_school_id UUID)
RETURNS TABLE (
  application_id      UUID,
  student_id          UUID,
  first_name          TEXT,
  last_name           TEXT,
  registration_number TEXT,
  class_name          TEXT,
  reg_fee_paid_at     TIMESTAMPTZ
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
    'registrar','principal','vice_principal','admin_staff','super_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_caller_role != 'super_admin' AND v_caller_school != p_school_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    sa.id                                      AS application_id,
    s.id                                       AS student_id,
    s.first_name,
    s.last_name,
    s.registration_number,
    COALESCE(c.name, s.current_grade_level)    AS class_name,
    p.payment_date::TIMESTAMPTZ                AS reg_fee_paid_at
  FROM students s
  -- Must have a matching accepted application with student_id linked
  JOIN student_applications sa ON sa.student_id = s.id
  LEFT JOIN classes c ON c.id = s.current_class_id
  -- LEFT JOIN registration fee — students with no reg fee row also included
  LEFT JOIN (
    SELECT sf.student_id, sf.status, sf.id AS sf_id
    FROM student_fees sf
    JOIN fee_structures fs ON fs.id = sf.fee_structure_id
    WHERE fs.fee_type = 'registration_fee'
  ) reg ON reg.student_id = s.id
  LEFT JOIN payments p ON p.student_fee_id = reg.sf_id AND p.status = 'success'
  -- No login account yet
  WHERE s.school_id = p_school_id
    AND s.user_id   IS NULL
    -- Include if: no reg fee row at all, OR reg fee is paid
    AND (reg.student_id IS NULL OR reg.status IN ('paid', 'partial'))
  ORDER BY p.payment_date DESC NULLS LAST, s.last_name, s.first_name;
END;
$$;

GRANT EXECUTE ON FUNCTION list_ready_to_enroll(UUID) TO authenticated;


-- ============================================================
-- PART 6: Backfill student_id on existing accepted applications
-- ============================================================

UPDATE student_applications sa
SET    student_id = s.id
FROM   students s
WHERE  sa.assigned_registration_number = s.registration_number
  AND  sa.school_id = s.school_id
  AND  sa.status = 'accepted'
  AND  sa.student_id IS NULL;


-- ============================================================
-- PART 7: PostgREST schema reload
-- ============================================================
NOTIFY pgrst, 'reload schema';
