-- Migration 062: Bulk student import
--
-- Allows IT Admin or Registrar to import existing students from a CSV file
-- without going through the application queue.  Each student gets:
--   • A generated registration number  (same generate_registration_number() used for applications)
--   • A student record (status = enrolled, enrollment status = active)
--   • A guardian record
--   • A class assignment
--   • All fee structures for that class auto-assigned
--   • A Supabase auth account  (email = reg_number@student.schoolsync, password = reg_number)
--
-- Input:  JSONB array of student objects
--   { first_name, last_name, date_of_birth?, gender?, class_name,
--     guardian_name, guardian_phone, guardian_email? }
--
-- Output: JSONB array of per-row results
--   { row_number, success, first_name, last_name,
--     registration_number?, login_email?, error? }

CREATE OR REPLACE FUNCTION bulk_import_students(
  p_school_id    UUID,
  p_academic_year TEXT,
  p_students     JSONB       -- array of student objects
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

  -- per-student vars
  v_first_name    TEXT;
  v_last_name     TEXT;
  v_dob           DATE;
  v_gender        TEXT;
  v_class_name    TEXT;
  v_class_id      UUID;
  v_grade_level   TEXT;
  v_g_name        TEXT;
  v_g_phone       TEXT;
  v_g_email       TEXT;

  v_reg_number    TEXT;
  v_student_id    UUID;
  v_guardian_id   UUID;
  v_auth_id       UUID;
  v_user_id       UUID;
  v_email         TEXT;
  v_encrypted_pw  TEXT;
BEGIN
  -- ── 1. Authorisation ──────────────────────────────────────────────────────
  SELECT role, school_id
    INTO v_caller_role, v_caller_school
    FROM users
   WHERE auth_id = auth.uid();

  IF v_caller_role NOT IN (
      'registrar','admin_staff','it_admin','principal','vice_principal','super_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only IT Admin, Registrar, or Admin Staff can import students';
  END IF;

  -- super_admin can import into any school; others only their own
  IF v_caller_role != 'super_admin' AND v_caller_school != p_school_id THEN
    RAISE EXCEPTION 'You can only import students into your own school';
  END IF;

  -- ── 2. Process each row ───────────────────────────────────────────────────
  FOR v_student IN SELECT * FROM jsonb_array_elements(p_students)
  LOOP
    v_row_num := v_row_num + 1;

    BEGIN  -- inner block so one row failure doesn't abort the whole batch

      -- Extract fields
      v_first_name := NULLIF(TRIM(v_student->>'first_name'), '');
      v_last_name  := NULLIF(TRIM(v_student->>'last_name'),  '');
      v_class_name := NULLIF(TRIM(v_student->>'class_name'), '');
      v_g_name     := NULLIF(TRIM(v_student->>'guardian_name'), '');
      v_g_phone    := NULLIF(TRIM(v_student->>'guardian_phone'), '');
      v_g_email    := NULLIF(TRIM(v_student->>'guardian_email'), '');
      v_gender     := NULLIF(TRIM(v_student->>'gender'), '');

      -- date_of_birth is optional; parse carefully
      BEGIN
        v_dob := (v_student->>'date_of_birth')::DATE;
      EXCEPTION WHEN OTHERS THEN
        v_dob := NULL;
      END;

      -- Validate required fields
      IF v_first_name IS NULL THEN
        RAISE EXCEPTION 'first_name is required';
      END IF;
      IF v_last_name IS NULL THEN
        RAISE EXCEPTION 'last_name is required';
      END IF;
      IF v_class_name IS NULL THEN
        RAISE EXCEPTION 'class_name is required';
      END IF;
      IF v_g_name IS NULL THEN
        RAISE EXCEPTION 'guardian_name is required';
      END IF;
      IF v_g_phone IS NULL THEN
        RAISE EXCEPTION 'guardian_phone is required';
      END IF;

      -- Resolve class_id from class name (case-insensitive)
      SELECT id, name INTO v_class_id, v_grade_level
        FROM classes
       WHERE school_id = p_school_id
         AND LOWER(name) = LOWER(v_class_name)
       LIMIT 1;

      IF v_class_id IS NULL THEN
        RAISE EXCEPTION 'Class "%" not found — check spelling matches exactly', v_class_name;
      END IF;

      -- ── Generate registration number ──────────────────────────────────────
      v_reg_number := generate_registration_number(p_school_id);

      -- ── Create student record ─────────────────────────────────────────────
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

      -- ── Create guardian record ────────────────────────────────────────────
      INSERT INTO guardians (
        student_id, school_id, relationship,
        full_name, email, phone
      ) VALUES (
        v_student_id, p_school_id, 'guardian',
        v_g_name, v_g_email, v_g_phone
      )
      RETURNING id INTO v_guardian_id;

      -- ── Enrollment record — directly active (no application fee required) ─
      INSERT INTO student_enrollments (
        student_id, school_id,
        academic_year, enrollment_date, status
      ) VALUES (
        v_student_id, p_school_id,
        p_academic_year, CURRENT_DATE, 'active'
      );

      -- ── Class assignment ──────────────────────────────────────────────────
      INSERT INTO class_assignments (class_id, student_id, academic_year)
      VALUES (v_class_id, v_student_id, p_academic_year)
      ON CONFLICT DO NOTHING;

      -- ── Auto-assign all fee structures for this class ─────────────────────
      PERFORM assign_class_fees_to_student(
        v_student_id, v_class_id, p_school_id, p_academic_year
      );

      -- ── Create Supabase auth account ──────────────────────────────────────
      --    email    = {reg_number}@student.schoolsync   (lower-cased)
      --    password = registration number (student changes after first login)
      v_email        := LOWER(TRIM(v_reg_number)) || '@student.schoolsync';
      v_auth_id      := gen_random_uuid();
      v_encrypted_pw := extensions.crypt(v_reg_number, extensions.gen_salt('bf'));

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
            'first_name', v_first_name,
            'last_name',  v_last_name,
            'role',       'student',
            'school_id',  p_school_id::TEXT
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
          v_auth_id, p_school_id, v_email,
          v_first_name, v_last_name,
          v_first_name || ' ' || v_last_name,
          'student', TRUE
        )
        RETURNING id INTO v_user_id;

        UPDATE students
           SET user_id    = v_user_id,
               updated_at = NOW()
         WHERE id = v_student_id;
      END IF;

      -- ── Append success result ─────────────────────────────────────────────
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'row_number',          v_row_num,
        'success',             TRUE,
        'first_name',          v_first_name,
        'last_name',           v_last_name,
        'class_name',          v_grade_level,
        'registration_number', v_reg_number,
        'login_email',         v_email,
        'default_password',    v_reg_number
      ));

    EXCEPTION WHEN OTHERS THEN
      -- Row failed — record the error and continue to the next row
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

GRANT EXECUTE ON FUNCTION bulk_import_students(UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_import_students(UUID, TEXT, JSONB) TO service_role;

NOTIFY pgrst, 'reload schema';
