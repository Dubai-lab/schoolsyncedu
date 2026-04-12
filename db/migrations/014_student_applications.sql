-- ============================================================
-- Migration 014: Student Applications & System Settings
-- Adds online application system for prospective students,
-- application fee tracking, and system default settings
-- for IT Admin (e.g. default student password).
-- ============================================================

-- ============================================================
-- PART 1: Application Status Enum
-- ============================================================
CREATE TYPE application_status AS ENUM (
  'submitted', 'under_review', 'documents_requested',
  'accepted', 'rejected', 'waitlisted', 'enrolled', 'withdrawn'
);

-- ============================================================
-- PART 2: Student Applications Table
-- ============================================================
CREATE TABLE student_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,

  -- Academic info
  academic_year VARCHAR(50) NOT NULL,
  grade_level_applied VARCHAR(50) NOT NULL,

  -- Student personal info
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  date_of_birth DATE NOT NULL,
  gender VARCHAR(50),
  photo_url TEXT,
  previous_school VARCHAR(255),
  previous_grade VARCHAR(50),

  -- Guardian info (embedded — not a user yet)
  guardian_full_name VARCHAR(255) NOT NULL,
  guardian_relationship VARCHAR(50),
  guardian_email VARCHAR(255),
  guardian_phone VARCHAR(20) NOT NULL,
  guardian_address TEXT,
  guardian_occupation VARCHAR(255),

  -- Application tracking
  application_number VARCHAR(50) UNIQUE NOT NULL, -- e.g. APP-BHA-2026-0001
  status application_status DEFAULT 'submitted',
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Application fee
  application_fee_amount DECIMAL(10,2) DEFAULT 0,
  application_fee_paid BOOLEAN DEFAULT FALSE,
  application_fee_payment_ref VARCHAR(255),
  application_fee_paid_at TIMESTAMP,

  -- Review fields
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP,
  review_notes TEXT,

  -- Documents uploaded by applicant
  documents JSONB DEFAULT '[]'::jsonb, -- [{type, file_url, uploaded_at}]

  -- If accepted: the registration_number assigned
  assigned_registration_number VARCHAR(50),

  -- Emergency contact
  emergency_contact_name VARCHAR(255),
  emergency_contact_phone VARCHAR(20),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_student_applications_school ON student_applications(school_id);
CREATE INDEX idx_student_applications_status ON student_applications(status);
CREATE INDEX idx_student_applications_year ON student_applications(academic_year);

-- ============================================================
-- PART 3: School System Settings Table
-- Stores key-value settings per school (set by IT Admin)
-- ============================================================
CREATE TABLE school_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  setting_key VARCHAR(100) NOT NULL,
  setting_value TEXT NOT NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(school_id, setting_key)
);

CREATE INDEX idx_school_settings_school ON school_settings(school_id);

-- Insert default settings for application fee
-- (Schools can override these via IT Admin or Registrar dashboard)

-- ============================================================
-- PART 4: RLS Policies
-- ============================================================
ALTER TABLE student_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_settings ENABLE ROW LEVEL SECURITY;

-- Applications: anonymous can INSERT (submit), staff can view/update
CREATE POLICY applications_anon_insert ON student_applications
  FOR INSERT TO anon
  WITH CHECK (TRUE);

-- Applications: school staff can see their school's applications
CREATE POLICY applications_staff_select ON student_applications
  FOR SELECT TO authenticated
  USING (school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid()));

-- Applications: registrar/admin can update
CREATE POLICY applications_staff_update ON student_applications
  FOR UPDATE TO authenticated
  USING (school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid()));

-- Settings: staff can read their school's settings
CREATE POLICY settings_staff_select ON school_settings
  FOR SELECT TO authenticated
  USING (school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid()));

-- Settings: IT admin can insert/update
CREATE POLICY settings_staff_insert ON school_settings
  FOR INSERT TO authenticated
  WITH CHECK (school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY settings_staff_update ON school_settings
  FOR UPDATE TO authenticated
  USING (school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid()));

-- Allow anonymous to read school settings (for application fee display)
CREATE POLICY settings_anon_read ON school_settings
  FOR SELECT TO anon
  USING (setting_key IN ('application_fee_usd', 'application_fee_lrd', 'accepting_applications', 'current_academic_year'));

-- ============================================================
-- PART 5: Generate Application Number Function
-- Format: APP-{SCHOOL_CODE}-{YEAR}-{SEQ}
-- ============================================================
CREATE OR REPLACE FUNCTION generate_application_number(p_school_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_code VARCHAR(3);
  v_year TEXT;
  v_seq INT;
  v_app_number TEXT;
BEGIN
  SELECT school_code INTO v_school_code FROM schools WHERE id = p_school_id;
  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;

  SELECT COALESCE(MAX(
    CAST(SUBSTRING(application_number FROM '\d+$') AS INT)
  ), 0) + 1
  INTO v_seq
  FROM student_applications
  WHERE school_id = p_school_id
    AND application_number LIKE 'APP-' || v_school_code || '-' || v_year || '-%';

  v_app_number := 'APP-' || v_school_code || '-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
  RETURN v_app_number;
END;
$$;

GRANT EXECUTE ON FUNCTION generate_application_number(UUID) TO anon;
GRANT EXECUTE ON FUNCTION generate_application_number(UUID) TO authenticated;

-- ============================================================
-- PART 6: Generate Student Registration Number Function
-- Format: {SCHOOL_CODE}-{YEAR}-{SEQ}
-- ============================================================
CREATE OR REPLACE FUNCTION generate_registration_number(p_school_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_code VARCHAR(3);
  v_year TEXT;
  v_seq INT;
  v_reg_number TEXT;
BEGIN
  SELECT school_code INTO v_school_code FROM schools WHERE id = p_school_id;
  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;

  SELECT COALESCE(MAX(
    CAST(SUBSTRING(registration_number FROM '\d+$') AS INT)
  ), 0) + 1
  INTO v_seq
  FROM students
  WHERE school_id = p_school_id
    AND registration_number LIKE v_school_code || '-' || v_year || '-%';

  v_reg_number := v_school_code || '-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
  RETURN v_reg_number;
END;
$$;

GRANT EXECUTE ON FUNCTION generate_registration_number(UUID) TO authenticated;

-- ============================================================
-- PART 7: Submit Application RPC (public/anonymous)
-- ============================================================
CREATE OR REPLACE FUNCTION submit_student_application(
  p_school_id UUID,
  p_academic_year TEXT,
  p_grade_level TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_date_of_birth DATE,
  p_gender TEXT DEFAULT NULL,
  p_previous_school TEXT DEFAULT NULL,
  p_previous_grade TEXT DEFAULT NULL,
  p_guardian_full_name TEXT DEFAULT NULL,
  p_guardian_relationship TEXT DEFAULT NULL,
  p_guardian_email TEXT DEFAULT NULL,
  p_guardian_phone TEXT DEFAULT NULL,
  p_guardian_address TEXT DEFAULT NULL,
  p_guardian_occupation TEXT DEFAULT NULL,
  p_emergency_contact_name TEXT DEFAULT NULL,
  p_emergency_contact_phone TEXT DEFAULT NULL,
  p_documents JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app_number TEXT;
  v_app_fee DECIMAL(10,2) := 0;
  v_app_id UUID;
  v_accepting BOOLEAN;
BEGIN
  -- Check if school is accepting applications
  SELECT setting_value::BOOLEAN INTO v_accepting
  FROM school_settings
  WHERE school_id = p_school_id AND setting_key = 'accepting_applications';

  IF v_accepting IS NOT NULL AND v_accepting = FALSE THEN
    RAISE EXCEPTION 'This school is not currently accepting applications';
  END IF;

  -- Get application fee
  SELECT COALESCE(setting_value::DECIMAL, 0) INTO v_app_fee
  FROM school_settings
  WHERE school_id = p_school_id AND setting_key = 'application_fee_usd';

  -- Generate application number
  v_app_number := generate_application_number(p_school_id);

  -- Insert application
  INSERT INTO student_applications (
    school_id, academic_year, grade_level_applied,
    first_name, last_name, date_of_birth, gender,
    previous_school, previous_grade,
    guardian_full_name, guardian_relationship, guardian_email, guardian_phone,
    guardian_address, guardian_occupation,
    emergency_contact_name, emergency_contact_phone,
    application_number, application_fee_amount, documents
  ) VALUES (
    p_school_id, p_academic_year, p_grade_level,
    p_first_name, p_last_name, p_date_of_birth, p_gender,
    NULLIF(p_previous_school, ''), NULLIF(p_previous_grade, ''),
    p_guardian_full_name, NULLIF(p_guardian_relationship, ''),
    NULLIF(p_guardian_email, ''), p_guardian_phone,
    NULLIF(p_guardian_address, ''), NULLIF(p_guardian_occupation, ''),
    NULLIF(p_emergency_contact_name, ''), NULLIF(p_emergency_contact_phone, ''),
    v_app_number, v_app_fee, p_documents
  )
  RETURNING id INTO v_app_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'application_id', v_app_id,
    'application_number', v_app_number,
    'application_fee', v_app_fee,
    'message', 'Application submitted successfully'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION submit_student_application(UUID,TEXT,TEXT,TEXT,TEXT,DATE,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB) TO anon;
GRANT EXECUTE ON FUNCTION submit_student_application(UUID,TEXT,TEXT,TEXT,TEXT,DATE,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB) TO authenticated;

-- ============================================================
-- PART 8: Accept Application RPC (registrar)
-- Creates student record, generates reg number, creates
-- acceptance letter instance if template exists
-- ============================================================
CREATE OR REPLACE FUNCTION accept_student_application(
  p_application_id UUID,
  p_review_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app RECORD;
  v_caller_role user_role;
  v_caller_school UUID;
  v_reg_number TEXT;
  v_student_id UUID;
  v_guardian_id UUID;
  v_default_password TEXT;
  v_auth_id UUID;
BEGIN
  -- Verify caller
  SELECT role, school_id INTO v_caller_role, v_caller_school
  FROM users WHERE auth_id = auth.uid();

  IF v_caller_role NOT IN ('registrar', 'principal', 'vice_principal', 'admin_staff', 'super_admin') THEN
    RAISE EXCEPTION 'Unauthorized: only registrar or admin can accept applications';
  END IF;

  -- Get application
  SELECT * INTO v_app FROM student_applications WHERE id = p_application_id;
  IF v_app IS NULL THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  IF v_app.school_id != v_caller_school AND v_caller_role != 'super_admin' THEN
    RAISE EXCEPTION 'Unauthorized: application belongs to a different school';
  END IF;

  IF v_app.status != 'submitted' AND v_app.status != 'under_review' THEN
    RAISE EXCEPTION 'Application is not in a reviewable state (current: %)', v_app.status;
  END IF;

  -- Generate registration number
  v_reg_number := generate_registration_number(v_app.school_id);

  -- Create student record
  INSERT INTO students (
    school_id, registration_number, first_name, last_name,
    date_of_birth, gender, enrollment_date, current_grade_level,
    status, previous_school, emergency_contact_name, emergency_contact_phone
  ) VALUES (
    v_app.school_id, v_reg_number, v_app.first_name, v_app.last_name,
    v_app.date_of_birth, v_app.gender, CURRENT_DATE, v_app.grade_level_applied,
    'enrolled', v_app.previous_school,
    v_app.emergency_contact_name, v_app.emergency_contact_phone
  )
  RETURNING id INTO v_student_id;

  -- Create guardian record
  IF v_app.guardian_full_name IS NOT NULL THEN
    INSERT INTO guardians (
      student_id, school_id, relationship, full_name,
      email, phone, address, occupation
    ) VALUES (
      v_student_id, v_app.school_id, v_app.guardian_relationship,
      v_app.guardian_full_name, v_app.guardian_email,
      v_app.guardian_phone, v_app.guardian_address, v_app.guardian_occupation
    )
    RETURNING id INTO v_guardian_id;
  END IF;

  -- Create enrollment record
  INSERT INTO student_enrollments (student_id, school_id, academic_year, enrollment_date, status)
  VALUES (v_student_id, v_app.school_id, v_app.academic_year, CURRENT_DATE, 'active');

  -- Update application
  UPDATE student_applications SET
    status = 'accepted',
    reviewed_by = (SELECT id FROM users WHERE auth_id = auth.uid()),
    reviewed_at = NOW(),
    review_notes = COALESCE(p_review_notes, review_notes),
    assigned_registration_number = v_reg_number,
    updated_at = NOW()
  WHERE id = p_application_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'student_id', v_student_id,
    'registration_number', v_reg_number,
    'guardian_id', v_guardian_id,
    'message', 'Student accepted and enrolled successfully'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION accept_student_application(UUID, TEXT) TO authenticated;
