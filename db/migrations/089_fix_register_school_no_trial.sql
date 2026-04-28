-- ============================================================
-- Migration 089: Fix register_school for plans with 0 trial days
--
-- Previously: always created subscription as 'trial' even if trial_days = 0,
-- causing schools to immediately show "Free trial ends in 0 days".
--
-- Fix: if trial_days = 0, start subscription in 'grace' status immediately.
--      if trial_days > 0, start as 'trial' as before.
-- ============================================================

CREATE OR REPLACE FUNCTION register_school(
  p_auth_id         UUID,
  p_owner_email     TEXT,
  p_owner_name      TEXT,
  p_owner_phone     TEXT,
  p_first_name      TEXT,
  p_last_name       TEXT,
  p_school_name     TEXT,
  p_school_code     VARCHAR(3),
  p_location        TEXT DEFAULT NULL,
  p_moe_reg         TEXT DEFAULT NULL,
  p_principal_name  TEXT DEFAULT NULL,
  p_principal_email TEXT DEFAULT NULL,
  p_school_phone    TEXT DEFAULT NULL,
  p_address         TEXT DEFAULT NULL,
  p_motto           TEXT DEFAULT NULL,
  p_plan_id         UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id   UUID;
  v_user_id     UUID;
  v_sub_id      UUID;
  v_trial_days  INT := 0;
  v_grace_days  INT := 7;
  v_slug        TEXT;
  v_slug_base   TEXT;
  v_counter     INT := 0;
  v_sub_status  subscription_status;
  v_expires_at  TIMESTAMP;
BEGIN
  -- Generate unique slug from school name
  v_slug_base := LOWER(REGEXP_REPLACE(
    REGEXP_REPLACE(TRIM(p_school_name), '[^a-zA-Z0-9\s-]', '', 'g'),
    '\s+', '-', 'g'
  ));
  v_slug := v_slug_base;
  WHILE EXISTS(SELECT 1 FROM schools WHERE slug = v_slug) LOOP
    v_counter := v_counter + 1;
    v_slug := v_slug_base || '-' || v_counter;
  END LOOP;

  -- 1. Create the school
  INSERT INTO schools (
    name, school_code, slug, location, moe_registration_number,
    principal_name, principal_email, phone, address, motto,
    proprietor_name, proprietor_email, site_published
  ) VALUES (
    p_school_name, p_school_code, v_slug, p_location, NULLIF(p_moe_reg, ''),
    p_principal_name, p_principal_email, p_school_phone, NULLIF(p_address, ''),
    NULLIF(p_motto, ''), p_owner_name, p_owner_email, TRUE
  )
  RETURNING id INTO v_school_id;

  -- 2. Create the proprietor user record
  INSERT INTO users (
    auth_id, school_id, email, full_name, first_name, last_name, phone, role, is_active
  ) VALUES (
    p_auth_id, v_school_id, p_owner_email, p_owner_name, p_first_name, p_last_name,
    NULLIF(p_owner_phone, ''), 'proprietor'::user_role, TRUE
  )
  RETURNING id INTO v_user_id;

  -- 3. Create subscription if a plan was selected
  IF p_plan_id IS NOT NULL THEN
    SELECT
      COALESCE(trial_days, 0),
      COALESCE(grace_days, 7)
    INTO v_trial_days, v_grace_days
    FROM subscription_plans
    WHERE id = p_plan_id;

    IF v_trial_days > 0 THEN
      -- Plan has a free trial: start in trial status
      v_sub_status := 'trial';
      v_expires_at := NOW() + (v_trial_days || ' days')::INTERVAL;
    ELSE
      -- No free trial: start directly in grace period so admin can confirm payment
      v_sub_status := 'grace';
      v_expires_at := NOW() + (v_grace_days || ' days')::INTERVAL;
    END IF;

    INSERT INTO subscriptions (school_id, plan_id, status, started_at, expires_at, grace_days_remaining, auto_renew)
    VALUES (v_school_id, p_plan_id, v_sub_status, NOW(), v_expires_at, v_grace_days, TRUE)
    RETURNING id INTO v_sub_id;
  END IF;

  RETURN jsonb_build_object(
    'school_id',       v_school_id,
    'user_id',         v_user_id,
    'subscription_id', v_sub_id,
    'school_code',     p_school_code,
    'slug',            v_slug
  );
END;
$$;

GRANT EXECUTE ON FUNCTION register_school TO authenticated;
GRANT EXECUTE ON FUNCTION register_school TO anon;
