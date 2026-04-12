-- Migration 020: Add class_id to student applications
-- Students select a class when applying; registrar sees it pre-selected on acceptance.

-- Add class_id column
ALTER TABLE student_applications
  ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES classes(id) ON DELETE SET NULL;

-- Recreate the submit RPC to accept class_id parameter
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
  p_documents JSONB DEFAULT '[]'::jsonb,
  p_class_id UUID DEFAULT NULL
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
    school_id, academic_year, grade_level_applied, class_id,
    first_name, last_name, date_of_birth, gender,
    previous_school, previous_grade,
    guardian_full_name, guardian_relationship, guardian_email, guardian_phone,
    guardian_address, guardian_occupation,
    emergency_contact_name, emergency_contact_phone,
    application_number, application_fee_amount, documents
  ) VALUES (
    p_school_id, p_academic_year, p_grade_level, p_class_id,
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

-- Re-grant permissions (new signature includes p_class_id)
GRANT EXECUTE ON FUNCTION submit_student_application(UUID,TEXT,TEXT,TEXT,TEXT,DATE,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB,UUID) TO anon;
GRANT EXECUTE ON FUNCTION submit_student_application(UUID,TEXT,TEXT,TEXT,TEXT,DATE,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB,UUID) TO authenticated;
