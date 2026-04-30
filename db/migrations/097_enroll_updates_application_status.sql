-- Migration 097: Mark application as 'enrolled' when student is enrolled
--
-- enroll_student_after_payment was creating the login account and activating
-- the enrollment record but never updating student_applications.status to
-- 'enrolled'. This left the application status stuck on 'accepted' forever,
-- so the public status page progress bar never reached the Enrolled step.
--
-- Fix: add UPDATE student_applications after the enrollment updates,
-- and also handle the already-enrolled idempotent path.

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

  -- Already has an account — idempotent: still mark application enrolled
  IF v_student.user_id IS NOT NULL THEN
    UPDATE student_applications
       SET status     = 'enrolled',
           updated_at = NOW()
     WHERE student_id = p_student_id
       AND status != 'enrolled';

    RETURN jsonb_build_object(
      'success',             TRUE,
      'already_exists',      TRUE,
      'registration_number', v_student.registration_number,
      'message',             'Student already has a login account.'
    );
  END IF;

  -- Block only if a registration fee record EXISTS and is unpaid
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

      UPDATE students
         SET user_id    = v_user_id,
             updated_at = NOW()
       WHERE id = p_student_id;

      UPDATE student_enrollments
         SET status     = 'active',
             updated_at = NOW()
       WHERE student_id = p_student_id
         AND status     = 'pending_payment';

      UPDATE student_applications
         SET status     = 'enrolled',
             updated_at = NOW()
       WHERE student_id = p_student_id
         AND status != 'enrolled';

      RETURN jsonb_build_object(
        'success',             TRUE,
        'already_exists',      TRUE,
        'registration_number', v_student.registration_number,
        'message',             'Student already has a login account.'
      );
    END;
  END IF;

  -- Create auth user
  v_auth_id      := gen_random_uuid();
  v_encrypted_pw := crypt(v_default_pw, gen_salt('bf'));

  INSERT INTO auth.users (
    instance_id, id, aud, role,
    email, encrypted_password,
    email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new,
    phone, phone_change_token,
    reauthentication_token, reauthentication_sent_at,
    is_super_admin, deleted_at, is_anonymous
  ) VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    v_auth_id, 'authenticated', 'authenticated',
    v_email, v_encrypted_pw,
    NOW(),
    jsonb_build_object('provider','email','providers',ARRAY['email']),
    jsonb_build_object(
      'first_name', v_student.first_name,
      'last_name',  v_student.last_name,
      'school_id',  v_student.school_id::text
    ),
    NOW(), NOW(),
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

  -- Mark the originating application as enrolled
  UPDATE student_applications
     SET status     = 'enrolled',
         updated_at = NOW()
   WHERE student_id = p_student_id
     AND status != 'enrolled';

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

-- Backfill: mark existing enrolled students' applications as 'enrolled'
-- Covers students who were already enrolled before this migration.
UPDATE student_applications sa
   SET status     = 'enrolled',
       updated_at = NOW()
  FROM students s
 WHERE sa.student_id = s.id
   AND s.user_id IS NOT NULL
   AND sa.status = 'accepted';

NOTIFY pgrst, 'reload schema';
