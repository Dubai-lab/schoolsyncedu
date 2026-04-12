-- ============================================================
-- Migration 010: Registration RPC Function
-- Handles school registration atomically with SECURITY DEFINER
-- to bypass RLS during the signup flow (user row doesn't exist yet)
-- ============================================================

-- RPC function: register a new school + proprietor + trial subscription
-- Called from the frontend after supabase.auth.signUp()
CREATE OR REPLACE FUNCTION register_school(
  p_auth_id       UUID,
  p_owner_email   TEXT,
  p_owner_name    TEXT,
  p_owner_phone   TEXT,
  p_first_name    TEXT,
  p_last_name     TEXT,
  p_school_name   TEXT,
  p_school_code   VARCHAR(3),
  p_location      TEXT DEFAULT NULL,
  p_moe_reg       TEXT DEFAULT NULL,
  p_principal_name TEXT DEFAULT NULL,
  p_principal_email TEXT DEFAULT NULL,
  p_school_phone  TEXT DEFAULT NULL,
  p_address       TEXT DEFAULT NULL,
  p_motto         TEXT DEFAULT NULL,
  p_plan_id       UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id UUID;
  v_user_id   UUID;
  v_sub_id    UUID;
  v_trial_days INT := 14;
BEGIN
  -- 1. Create the school
  INSERT INTO schools (name, school_code, location, moe_registration_number,
    principal_name, principal_email, phone, address, motto,
    proprietor_name, proprietor_email)
  VALUES (p_school_name, p_school_code, p_location, NULLIF(p_moe_reg, ''),
    p_principal_name, p_principal_email, p_school_phone, NULLIF(p_address, ''),
    NULLIF(p_motto, ''), p_owner_name, p_owner_email)
  RETURNING id INTO v_school_id;

  -- 2. Create the user record
  INSERT INTO users (auth_id, school_id, email, full_name, first_name, last_name, phone, role, is_active)
  VALUES (p_auth_id, v_school_id, p_owner_email, p_owner_name, p_first_name, p_last_name,
    NULLIF(p_owner_phone, ''), 'proprietor'::user_role, TRUE)
  RETURNING id INTO v_user_id;

  -- 3. Create trial subscription if a plan was selected
  IF p_plan_id IS NOT NULL THEN
    SELECT COALESCE(trial_days, 14) INTO v_trial_days
    FROM subscription_plans WHERE id = p_plan_id;

    INSERT INTO subscriptions (school_id, plan_id, status, started_at, expires_at, auto_renew)
    VALUES (v_school_id, p_plan_id, 'trial',
      NOW(), NOW() + (v_trial_days || ' days')::INTERVAL, TRUE)
    RETURNING id INTO v_sub_id;
  END IF;

  RETURN jsonb_build_object(
    'school_id', v_school_id,
    'user_id', v_user_id,
    'subscription_id', v_sub_id,
    'school_code', p_school_code
  );
END;
$$;

-- Grant execute to authenticated users (just signed up)
GRANT EXECUTE ON FUNCTION register_school TO authenticated;
-- Also allow anon in case session isn't fully established yet
GRANT EXECUTE ON FUNCTION register_school TO anon;
