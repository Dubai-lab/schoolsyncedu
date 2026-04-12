-- ============================================================
-- Migration 018: Public Application Status Lookup
-- Allows applicants to check their application status
-- using their application number + date of birth (for verification).
-- ============================================================

CREATE OR REPLACE FUNCTION check_application_status(
  p_application_number TEXT,
  p_date_of_birth DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app RECORD;
BEGIN
  SELECT
    application_number,
    first_name,
    last_name,
    grade_level_applied,
    academic_year,
    status,
    submitted_at,
    reviewed_at,
    review_notes,
    application_fee_amount,
    application_fee_paid,
    assigned_registration_number
  INTO v_app
  FROM student_applications
  WHERE application_number = p_application_number
    AND date_of_birth = p_date_of_birth;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'found', false,
      'message', 'No application found. Please check your application number and date of birth.'
    );
  END IF;

  RETURN json_build_object(
    'found', true,
    'application_number', v_app.application_number,
    'student_name', v_app.first_name || ' ' || v_app.last_name,
    'grade_level', v_app.grade_level_applied,
    'academic_year', v_app.academic_year,
    'status', v_app.status,
    'submitted_at', v_app.submitted_at,
    'reviewed_at', v_app.reviewed_at,
    'review_notes', v_app.review_notes,
    'application_fee_amount', v_app.application_fee_amount,
    'application_fee_paid', v_app.application_fee_paid,
    'registration_number', v_app.assigned_registration_number
  );
END;
$$;

-- Allow anonymous access to check application status
GRANT EXECUTE ON FUNCTION check_application_status(TEXT, DATE) TO anon;
GRANT EXECUTE ON FUNCTION check_application_status(TEXT, DATE) TO authenticated;
