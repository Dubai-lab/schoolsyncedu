-- ============================================================
-- Migration 086: Fix enrollment flow broken by migration 085
--
-- Bug 1: accept_student_application (085 version) does not set
--   student_id on the application row. get_application_enrollment_status
--   returns early (accepted:false) whenever student_id IS NULL, so
--   the Registrar sees "Awaiting Payment" / no Enroll button forever.
--
-- Bug 2: get_application_enrollment_status and
--   enroll_student_after_payment both check for fee_type =
--   'registration_fee', but FEE_TYPES.REGISTRATION = 'registration'.
--   The mismatch means the real fee record is never found.
--
-- Bug 3: Migration 085's accept_student_application creates
--   student_enrollments with status = 'active' instead of
--   'pending_payment', skipping the intended 3-step flow.
--
-- Fixes:
--   1. Rewrite accept_student_application to store student_id and
--      use 'pending_payment' enrollment status.
--   2. Update get_application_enrollment_status to use 'registration'.
--   3. Update enroll_student_after_payment to use 'registration'.
--   4. Backfill student_applications.student_id for existing accepted
--      applications whose student_id was not stored.
-- ============================================================


-- ── 1. accept_student_application ────────────────────────────────────────────

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
  SELECT role, school_id
    INTO v_caller_role, v_caller_school
    FROM users WHERE auth_id = auth.uid();

  IF v_caller_role NOT IN (
    'registrar','principal','vice_principal','admin_staff','super_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only registrar or admin can accept applications';
  END IF;

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

  v_reg_number   := generate_registration_number(v_app.school_id);
  v_assign_class := COALESCE(p_class_id, v_app.class_id);

  SELECT COALESCE(
    (SELECT setting_value FROM school_settings
      WHERE school_id = v_app.school_id AND setting_key = 'current_academic_year'),
    v_app.academic_year
  ) INTO v_academic_year;

  -- Create student record
  INSERT INTO students (
    school_id, registration_number,
    first_name, last_name, date_of_birth, gender,
    enrollment_date, current_grade_level, current_class_id, current_academic_year,
    status, previous_school,
    emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
    photo_url
  ) VALUES (
    v_app.school_id, v_reg_number,
    v_app.first_name, v_app.last_name, v_app.date_of_birth, v_app.gender,
    CURRENT_DATE, v_app.grade_level_applied, v_assign_class, v_academic_year,
    'enrolled'::student_status,
    v_app.previous_school,
    v_app.emergency_contact_name, v_app.emergency_contact_phone,
    v_app.emergency_contact_relationship,
    v_app.photo_url
  )
  RETURNING id INTO v_student_id;

  -- Create guardian
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

  -- Enrollment record — pending_payment until registration fee collected
  INSERT INTO student_enrollments (
    student_id, school_id, academic_year, enrollment_date, status
  ) VALUES (
    v_student_id, v_app.school_id, v_academic_year, CURRENT_DATE, 'pending_payment'
  );

  -- Class assignment
  IF v_assign_class IS NOT NULL THEN
    INSERT INTO class_assignments (class_id, student_id, academic_year)
    VALUES (v_assign_class, v_student_id, v_academic_year)
    ON CONFLICT DO NOTHING;

    v_fees_assigned := assign_class_fees_to_student(
      v_student_id, v_assign_class, v_app.school_id, v_academic_year
    );
  END IF;

  -- Mark application accepted — store student_id so enrollment status can be tracked
  UPDATE student_applications
     SET status                      = 'accepted',
         student_id                  = v_student_id,
         review_notes                = COALESCE(p_review_notes, review_notes),
         assigned_registration_number = v_reg_number,
         reviewed_at                 = NOW(),
         reviewed_by                 = (SELECT id FROM users WHERE auth_id = auth.uid()),
         updated_at                  = NOW()
   WHERE id = p_application_id;

  RETURN jsonb_build_object(
    'success',             TRUE,
    'student_id',          v_student_id,
    'registration_number', v_reg_number,
    'guardian_id',         v_guardian_id,
    'class_id',            v_assign_class,
    'fees_assigned',       v_fees_assigned,
    'reg_fee_assigned',    (v_fees_assigned > 0),
    'message',             'Student accepted. Waiting for registration fee payment before enrollment.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION accept_student_application(UUID, TEXT, UUID) TO authenticated;


-- ── 2. get_application_enrollment_status ─────────────────────────────────────
-- Fix: search for fee_type = 'registration' (matches FEE_TYPES.REGISTRATION)

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
  v_reg_fee_paid       BOOLEAN := TRUE;
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
  -- fee_type = 'registration' matches FEE_TYPES.REGISTRATION used in the app
  SELECT TRUE, COALESCE(sf.amount_due, 0)
    INTO v_has_reg_fee_record, v_reg_fee_amount
    FROM student_fees sf
    JOIN fee_structures fs ON fs.id = sf.fee_structure_id
   WHERE sf.student_id = v_app.student_id
     AND fs.fee_type   = 'registration'
   ORDER BY sf.created_at DESC
   LIMIT 1;

  IF v_has_reg_fee_record IS TRUE THEN
    SELECT (sf.status IN ('paid', 'partial'))
      INTO v_reg_fee_paid
      FROM student_fees sf
      JOIN fee_structures fs ON fs.id = sf.fee_structure_id
     WHERE sf.student_id = v_app.student_id
       AND fs.fee_type   = 'registration'
     ORDER BY sf.created_at DESC
     LIMIT 1;
  END IF;

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


-- ── 3. enroll_student_after_payment ──────────────────────────────────────────
-- Fix: block on fee_type = 'registration' (not 'registration_fee')

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
  SELECT role, school_id
    INTO v_caller_role, v_caller_school
    FROM users WHERE auth_id = auth.uid();

  IF v_caller_role NOT IN (
    'registrar','principal','vice_principal','admin_staff','it_admin','super_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only registrar, principal, or IT Admin can enroll students';
  END IF;

  SELECT s.* INTO v_student FROM students s WHERE s.id = p_student_id;

  IF v_student.id IS NULL THEN
    RAISE EXCEPTION 'Student not found';
  END IF;

  IF v_student.school_id != v_caller_school AND v_caller_role != 'super_admin' THEN
    RAISE EXCEPTION 'Student belongs to a different school';
  END IF;

  -- Already has an account — idempotent return
  IF v_student.user_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success',             TRUE,
      'already_exists',      TRUE,
      'registration_number', v_student.registration_number,
      'message',             'Student already has a login account.'
    );
  END IF;

  -- Block only if a registration fee record EXISTS and is unpaid
  -- fee_type = 'registration' matches FEE_TYPES.REGISTRATION
  IF EXISTS (
    SELECT 1
    FROM student_fees sf
    JOIN fee_structures fs ON fs.id = sf.fee_structure_id
    WHERE sf.student_id = p_student_id
      AND fs.fee_type   = 'registration'
      AND sf.status     NOT IN ('paid', 'partial')
  ) THEN
    RAISE EXCEPTION 'Registration fee has not been paid. Ask the bursar to record payment first.';
  END IF;

  SELECT COALESCE(
    (SELECT setting_value FROM school_settings
      WHERE school_id = v_student.school_id
        AND setting_key = 'default_student_password'),
    'school123'
  ) INTO v_default_pw;

  v_email := lower(trim(v_student.registration_number)) || '@student.schoolsync';

  -- Guard: account already in auth
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
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

  UPDATE students
     SET user_id    = v_user_id,
         updated_at = NOW()
   WHERE id = p_student_id;

  UPDATE student_enrollments
     SET status     = 'active',
         updated_at = NOW()
   WHERE student_id = p_student_id
     AND status     = 'pending_payment';

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


-- ── 4. Backfill student_id on accepted applications ───────────────────────────
-- Covers students accepted while migration 085's broken function was active.

UPDATE student_applications sa
   SET student_id = s.id,
       updated_at = NOW()
  FROM students s
 WHERE sa.assigned_registration_number = s.registration_number
   AND sa.school_id  = s.school_id
   AND sa.status     = 'accepted'
   AND sa.student_id IS NULL;


-- ── 5. Fix enrollment status for students created by migration 085 ────────────
-- 085 inserted 'active' instead of 'pending_payment', bypassing the flow.
-- Reset to 'pending_payment' for application-sourced students who still have
-- no login account. Bulk-imported students have no student_applications row
-- linking to them, so they are excluded.

UPDATE student_enrollments se
   SET status     = 'pending_payment',
       updated_at = NOW()
  FROM students s
 WHERE se.student_id = s.id
   AND se.status     = 'active'
   AND s.user_id     IS NULL
   AND EXISTS (
     SELECT 1 FROM student_applications sa
      WHERE sa.student_id = s.id
   );


NOTIFY pgrst, 'reload schema';
