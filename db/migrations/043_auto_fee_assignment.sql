-- ============================================================
-- MIGRATION 043: Auto-assign fees to class students
--
-- Problems fixed:
--   1. Fees must auto-assign to ALL enrolled students in a class
--      when a fee structure is created — no manual "assign" button.
--   2. When a student is accepted into a class, ALL existing fee
--      structures for that class must be assigned to them.
--   3. Duplicate fee assignments when "assign" is clicked again.
--   4. Student auth account must be created automatically on
--      acceptance — no manual IT Admin step required.
-- ============================================================

-- ============================================================
-- PART 1: Add unique constraint to prevent duplicate fee records
-- ============================================================

ALTER TABLE student_fees
  ADD CONSTRAINT uq_student_fee_structure
  UNIQUE (student_id, fee_structure_id);


-- ============================================================
-- PART 2: assign_class_fees_to_student
-- Assigns ALL active fee structures for a given class to one
-- specific student. Called when a student is accepted.
-- Uses ON CONFLICT DO NOTHING — safe to call multiple times.
-- ============================================================

CREATE OR REPLACE FUNCTION assign_class_fees_to_student(
  p_student_id    UUID,
  p_class_id      UUID,
  p_school_id     UUID,
  p_academic_year TEXT
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT := 0;
BEGIN
  INSERT INTO student_fees (
    student_id, fee_structure_id, school_id,
    academic_year, amount_due, amount_paid, balance,
    status, due_date
  )
  SELECT
    p_student_id,
    fs.id,
    p_school_id,
    p_academic_year,
    fs.amount_usd,
    0,
    fs.amount_usd,
    'pending',
    fs.due_date
  FROM fee_structures fs
  WHERE fs.class_id      = p_class_id
    AND fs.school_id     = p_school_id
    AND fs.academic_year = p_academic_year
  ON CONFLICT (student_id, fee_structure_id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION assign_class_fees_to_student(UUID, UUID, UUID, TEXT) TO authenticated;


-- ============================================================
-- PART 3: auto_assign_fees_for_new_structure
-- When the bursar creates a new fee structure for a class, this
-- automatically assigns it to every enrolled student in that
-- class right away. Called from bursarService after INSERT.
-- ============================================================

CREATE OR REPLACE FUNCTION auto_assign_fees_for_new_structure(
  p_fee_structure_id UUID
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fee   RECORD;
  v_count INT := 0;
BEGIN
  -- Load the fee structure
  SELECT * INTO v_fee FROM fee_structures WHERE id = p_fee_structure_id;

  IF v_fee.id IS NULL THEN
    RAISE EXCEPTION 'Fee structure not found: %', p_fee_structure_id;
  END IF;

  -- Assign to all currently enrolled students in this class
  INSERT INTO student_fees (
    student_id, fee_structure_id, school_id,
    academic_year, amount_due, amount_paid, balance,
    status, due_date
  )
  SELECT
    ca.student_id,
    v_fee.id,
    v_fee.school_id,
    v_fee.academic_year,
    v_fee.amount_usd,
    0,
    v_fee.amount_usd,
    'pending',
    v_fee.due_date
  FROM class_assignments ca
  JOIN students s ON s.id = ca.student_id
  WHERE ca.class_id    = v_fee.class_id
    AND s.school_id    = v_fee.school_id
    AND s.status       = 'enrolled'
  ON CONFLICT (student_id, fee_structure_id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION auto_assign_fees_for_new_structure(UUID) TO authenticated;


-- ============================================================
-- PART 4: Update accept_student_application
-- Changes:
--   a. Step 10 now calls assign_class_fees_to_student instead
--      of only looking for 'registration_fee' — assigns ALL
--      fee structures for the class at once.
--   b. Adds step 11b: auto-provision student auth account using
--      registration number as the default password.
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
SET search_path = public, extensions
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
  -- auth account vars
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

  -- 4. Decide which class to use
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

  -- 9. Assign to class if provided
  IF v_assign_class IS NOT NULL THEN
    INSERT INTO class_assignments (class_id, student_id, academic_year)
    VALUES (v_assign_class, v_student_id, v_academic_year)
    ON CONFLICT DO NOTHING;
  END IF;

  -- 10. Auto-assign ALL fee structures for this class to the student
  --     (replaces old step that only assigned registration_fee)
  IF v_assign_class IS NOT NULL THEN
    v_fees_assigned := assign_class_fees_to_student(
      v_student_id, v_assign_class, v_app.school_id, v_academic_year
    );
  END IF;

  -- 11. Update application
  UPDATE student_applications SET
    status = 'accepted',
    reviewed_by = (SELECT id FROM users WHERE auth_id = auth.uid()),
    reviewed_at = NOW(),
    review_notes = COALESCE(p_review_notes, review_notes),
    assigned_registration_number = v_reg_number,
    updated_at = NOW()
  WHERE id = p_application_id;

  -- 12. Auto-provision student login account
  --     Default password = registration number (student changes after first login)
  v_email        := lower(trim(v_reg_number)) || '@student.schoolsync';
  v_auth_id      := gen_random_uuid();
  v_encrypted_pw := extensions.crypt(v_reg_number, extensions.gen_salt('bf'));

  -- Only create if no account already exists with this email
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
        'first_name', v_app.first_name,
        'last_name',  v_app.last_name,
        'role',       'student',
        'school_id',  v_app.school_id::text
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
      v_auth_id, v_app.school_id, v_email,
      v_app.first_name, v_app.last_name,
      v_app.first_name || ' ' || v_app.last_name,
      'student', TRUE
    )
    RETURNING id INTO v_user_id;

    UPDATE students
    SET    user_id    = v_user_id,
           updated_at = NOW()
    WHERE  id = v_student_id;
  END IF;

  RETURN jsonb_build_object(
    'success',             TRUE,
    'student_id',          v_student_id,
    'registration_number', v_reg_number,
    'guardian_id',         v_guardian_id,
    'class_id',            v_assign_class,
    'fees_assigned',       v_fees_assigned,
    'account_created',     (v_user_id IS NOT NULL),
    'message',             'Student accepted. Login account created — default password is the registration number.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION accept_student_application(UUID, TEXT, UUID) TO authenticated;


-- ============================================================
-- PART 5: Notify PostgREST schema cache
-- ============================================================
NOTIFY pgrst, 'reload schema';
