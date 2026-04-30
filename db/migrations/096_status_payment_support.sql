-- Migration 096: Application status page payment support
--
-- 1. check_application_status: add application_id + school_id to response
--    so the status page can load payment config and initiate payments
--    without requiring the applicant to be logged in.
--
-- 2. get_payment_config_public: add missing bank detail columns
--    (bank_account_name, bank_account_number, bank_name, bank_routing_number,
--     bank_swift_code, bank_instructions) so bank transfer instructions
--    show correctly on all public payment forms.

-- ── 1. check_application_status ──────────────────────────────────────────────

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
    id,
    school_id,
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
    'application_id', v_app.id,
    'school_id', v_app.school_id,
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

GRANT EXECUTE ON FUNCTION check_application_status(TEXT, DATE) TO anon;
GRANT EXECUTE ON FUNCTION check_application_status(TEXT, DATE) TO authenticated;

-- ── 2. get_payment_config_public — add bank account detail columns ────────────

DROP FUNCTION IF EXISTS get_payment_config_public(UUID);

CREATE FUNCTION get_payment_config_public(p_school_id UUID)
RETURNS TABLE (
  flw_enabled           BOOLEAN,
  flw_public_key        TEXT,
  flw_methods           TEXT[],
  flw_currency          TEXT,
  mtn_enabled           BOOLEAN,
  mtn_merchant_code     TEXT,
  mtn_has_api           BOOLEAN,
  orange_enabled        BOOLEAN,
  orange_merchant_code  TEXT,
  orange_has_api        BOOLEAN,
  stripe_enabled        BOOLEAN,
  stripe_public_key     TEXT,
  stripe_currency       TEXT,
  bank_enabled          BOOLEAN,
  bank_account_name     TEXT,
  bank_account_number   TEXT,
  bank_name             TEXT,
  bank_routing_number   TEXT,
  bank_swift_code       TEXT,
  bank_instructions     TEXT,
  payment_title         TEXT,
  payment_logo          TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.flw_enabled,
    c.flw_public_key,
    c.flw_methods,
    c.flw_currency,
    c.mtn_enabled,
    c.mtn_merchant_code,
    -- all three MTN credentials required for automated push payments
    (c.mtn_api_key IS NOT NULL AND c.mtn_api_key <> ''
     AND c.mtn_user_id IS NOT NULL AND c.mtn_user_id <> ''
     AND c.mtn_api_user_key IS NOT NULL AND c.mtn_api_user_key <> '') AS mtn_has_api,
    c.orange_enabled,
    c.orange_merchant_code,
    (c.orange_api_key IS NOT NULL AND c.orange_api_key <> ''
     AND c.orange_user_id IS NOT NULL AND c.orange_user_id <> '') AS orange_has_api,
    c.stripe_enabled,
    c.stripe_public_key,
    c.stripe_currency,
    c.bank_enabled,
    c.bank_account_name,
    c.bank_account_number,
    c.bank_name,
    c.bank_routing_number,
    c.bank_swift_code,
    c.bank_instructions,
    c.payment_title,
    c.payment_logo
  FROM school_payment_configs c
  WHERE c.school_id = p_school_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_payment_config_public(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_payment_config_public(UUID) TO anon;

NOTIFY pgrst, 'reload schema';
