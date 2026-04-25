-- ============================================================
-- Migration 087: Add blood_type, phone, address, city to the
--   application pipeline so they flow through to the student
--   profile automatically.
--
-- Also backfills students.photo_url from student_applications
-- for any student whose photo was uploaded during application
-- but whose student record has photo_url = NULL.
-- ============================================================


-- ── 1. Add new columns to student_applications ───────────────────────────────

ALTER TABLE student_applications
  ADD COLUMN IF NOT EXISTS blood_type TEXT,
  ADD COLUMN IF NOT EXISTS phone      TEXT,
  ADD COLUMN IF NOT EXISTS address    TEXT,
  ADD COLUMN IF NOT EXISTS city       TEXT;


-- ── 2. submit_student_application — add new params ───────────────────────────
-- Drop old signature first (postgres won't overload REPLACE for different
-- param counts).

DROP FUNCTION IF EXISTS submit_student_application(UUID,TEXT,TEXT,TEXT,TEXT,DATE,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB,UUID,TEXT,TEXT);

CREATE OR REPLACE FUNCTION submit_student_application(
  p_school_id                      UUID,
  p_academic_year                  TEXT,
  p_grade_level                    TEXT,
  p_first_name                     TEXT,
  p_last_name                      TEXT,
  p_date_of_birth                  DATE,
  p_gender                         TEXT    DEFAULT NULL,
  p_previous_school                TEXT    DEFAULT NULL,
  p_previous_grade                 TEXT    DEFAULT NULL,
  p_guardian_full_name             TEXT    DEFAULT NULL,
  p_guardian_relationship          TEXT    DEFAULT NULL,
  p_guardian_email                 TEXT    DEFAULT NULL,
  p_guardian_phone                 TEXT    DEFAULT NULL,
  p_guardian_address               TEXT    DEFAULT NULL,
  p_guardian_occupation            TEXT    DEFAULT NULL,
  p_emergency_contact_name         TEXT    DEFAULT NULL,
  p_emergency_contact_phone        TEXT    DEFAULT NULL,
  p_documents                      JSONB   DEFAULT '[]'::jsonb,
  p_class_id                       UUID    DEFAULT NULL,
  p_emergency_contact_relationship TEXT    DEFAULT NULL,
  p_photo_url                      TEXT    DEFAULT NULL,
  p_blood_type                     TEXT    DEFAULT NULL,
  p_phone                          TEXT    DEFAULT NULL,
  p_address                        TEXT    DEFAULT NULL,
  p_city                           TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app_number TEXT;
  v_app_fee    DECIMAL(10,2) := 0;
  v_app_id     UUID;
  v_accepting  BOOLEAN;
BEGIN
  SELECT setting_value::BOOLEAN INTO v_accepting
    FROM school_settings
   WHERE school_id = p_school_id AND setting_key = 'accepting_applications';

  IF v_accepting IS NOT NULL AND v_accepting = FALSE THEN
    RAISE EXCEPTION 'This school is not currently accepting applications';
  END IF;

  SELECT COALESCE(setting_value::DECIMAL, 0) INTO v_app_fee
    FROM school_settings
   WHERE school_id = p_school_id AND setting_key = 'application_fee_usd';

  v_app_number := generate_application_number(p_school_id);

  INSERT INTO student_applications (
    school_id, academic_year, grade_level_applied,
    first_name, last_name, date_of_birth, gender,
    previous_school, previous_grade,
    guardian_full_name, guardian_relationship, guardian_email, guardian_phone,
    guardian_address, guardian_occupation,
    emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
    application_number, application_fee_amount, documents, class_id,
    photo_url, blood_type, phone, address, city
  ) VALUES (
    p_school_id, p_academic_year, p_grade_level,
    p_first_name, p_last_name, p_date_of_birth, p_gender,
    NULLIF(p_previous_school, ''), NULLIF(p_previous_grade, ''),
    p_guardian_full_name, NULLIF(p_guardian_relationship, ''),
    NULLIF(p_guardian_email, ''), p_guardian_phone,
    NULLIF(p_guardian_address, ''), NULLIF(p_guardian_occupation, ''),
    NULLIF(p_emergency_contact_name, ''), NULLIF(p_emergency_contact_phone, ''),
    NULLIF(p_emergency_contact_relationship, ''),
    v_app_number, v_app_fee, p_documents, p_class_id,
    NULLIF(p_photo_url, ''),
    NULLIF(p_blood_type, ''), NULLIF(p_phone, ''),
    NULLIF(p_address, ''), NULLIF(p_city, '')
  )
  RETURNING id INTO v_app_id;

  RETURN jsonb_build_object(
    'success',             TRUE,
    'application_id',      v_app_id,
    'application_number',  v_app_number,
    'application_fee',     v_app_fee,
    'message',             'Application submitted successfully'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION submit_student_application(UUID,TEXT,TEXT,TEXT,TEXT,DATE,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO anon;
GRANT EXECUTE ON FUNCTION submit_student_application(UUID,TEXT,TEXT,TEXT,TEXT,DATE,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated;


-- ── 3. accept_student_application — copy new fields to students ───────────────

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

  INSERT INTO students (
    school_id, registration_number,
    first_name, last_name, date_of_birth, gender,
    enrollment_date, current_grade_level, current_class_id, current_academic_year,
    status, previous_school,
    emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
    photo_url, blood_type, phone, address, city
  ) VALUES (
    v_app.school_id, v_reg_number,
    v_app.first_name, v_app.last_name, v_app.date_of_birth, v_app.gender,
    CURRENT_DATE, v_app.grade_level_applied, v_assign_class, v_academic_year,
    'enrolled'::student_status,
    v_app.previous_school,
    v_app.emergency_contact_name, v_app.emergency_contact_phone,
    v_app.emergency_contact_relationship,
    v_app.photo_url, v_app.blood_type, v_app.phone, v_app.address, v_app.city
  )
  RETURNING id INTO v_student_id;

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

  INSERT INTO student_enrollments (
    student_id, school_id, academic_year, enrollment_date, status
  ) VALUES (
    v_student_id, v_app.school_id, v_academic_year, CURRENT_DATE, 'pending_payment'
  );

  IF v_assign_class IS NOT NULL THEN
    INSERT INTO class_assignments (class_id, student_id, academic_year)
    VALUES (v_assign_class, v_student_id, v_academic_year)
    ON CONFLICT DO NOTHING;

    v_fees_assigned := assign_class_fees_to_student(
      v_student_id, v_assign_class, v_app.school_id, v_academic_year
    );
  END IF;

  UPDATE student_applications
     SET status                       = 'accepted',
         student_id                   = v_student_id,
         review_notes                 = COALESCE(p_review_notes, review_notes),
         assigned_registration_number = v_reg_number,
         reviewed_at                  = NOW(),
         reviewed_by                  = (SELECT id FROM users WHERE auth_id = auth.uid()),
         updated_at                   = NOW()
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


-- ── 4. Backfill photo_url: application → students ─────────────────────────────
-- Covers students whose photo was submitted in the application but whose
-- student record has photo_url = NULL (accepted under an older function).

UPDATE students s
   SET photo_url  = sa.photo_url,
       updated_at = NOW()
  FROM student_applications sa
 WHERE sa.student_id  = s.id
   AND sa.photo_url   IS NOT NULL
   AND s.photo_url    IS NULL;


NOTIFY pgrst, 'reload schema';
