-- ============================================================
-- Migration 091: Widen phone columns + safe slug truncation
--
-- Fix for register_school 400 / SQLSTATE 22001 (string_data_right_truncation):
--   1. Widen schools.phone and users.phone from VARCHAR(20) to VARCHAR(60)
--      to handle multiple numbers like "+231770228130/+231777205947/+231881914647" (41 chars)
--   2. Rewrite register_school to truncate slug_base to 90 chars before the
--      uniqueness loop so the final slug stays within schools.slug VARCHAR(100)
--   3. Add COALESCE guards so a missing plan doesn't insert NULL into
--      NOT NULL columns (grace_days_remaining)
-- ============================================================

-- 1. Widen phone columns
--    vw_staff_directory uses users.phone, so drop → alter → recreate
ALTER TABLE schools ALTER COLUMN phone TYPE VARCHAR(60);

DROP VIEW IF EXISTS vw_staff_directory CASCADE;
ALTER TABLE users ALTER COLUMN phone TYPE VARCHAR(60);
CREATE VIEW vw_staff_directory WITH (security_invoker = true) AS
SELECT
  u.id,
  u.school_id,
  u.email,
  u.first_name,
  u.last_name,
  u.phone,
  u.role,
  u.is_active as status,
  u.created_at,
  s.name as school_name
FROM users u
JOIN schools s ON u.school_id = s.id
WHERE u.role NOT IN ('student'::user_role, 'parent'::user_role)
ORDER BY u.role, u.last_name;

-- 2. Rebuild register_school with slug-safe + null-safe fixes
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
  -- Generate unique slug (capped at 90 chars to stay under VARCHAR(100) + counter suffix)
  v_slug_base := SUBSTRING(
    LOWER(REGEXP_REPLACE(
      REGEXP_REPLACE(TRIM(p_school_name), '[^a-zA-Z0-9\s-]', '', 'g'),
      '\s+', '-', 'g'
    ))
    FROM 1 FOR 90
  );
  -- Strip trailing hyphens after truncation
  v_slug_base := REGEXP_REPLACE(v_slug_base, '-+$', '');

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
    p_principal_name, p_principal_email,
    NULLIF(LEFT(p_school_phone, 60), ''),
    NULLIF(p_address, ''),
    NULLIF(p_motto, ''), p_owner_name, p_owner_email, TRUE
  )
  RETURNING id INTO v_school_id;

  -- 2. Create the proprietor user record
  INSERT INTO users (
    auth_id, school_id, email, full_name, first_name, last_name, phone, role, is_active
  ) VALUES (
    p_auth_id, v_school_id, p_owner_email, p_owner_name, p_first_name, p_last_name,
    NULLIF(LEFT(p_owner_phone, 60), ''), 'proprietor'::user_role, TRUE
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

    -- Guard: plan not found → use defaults
    v_trial_days := COALESCE(v_trial_days, 0);
    v_grace_days := COALESCE(v_grace_days, 7);

    IF v_trial_days > 0 THEN
      v_sub_status := 'trial';
      v_expires_at := NOW() + (v_trial_days || ' days')::INTERVAL;
    ELSE
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
