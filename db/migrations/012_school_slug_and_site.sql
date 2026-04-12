-- ============================================================
-- Migration 012: Add School Slug for Subdomain Routing
-- Each school gets a unique slug used as: slug.eduliberia.com
-- For development: localhost:5173/school/slug
-- ============================================================

-- Add slug column to schools
ALTER TABLE schools ADD COLUMN IF NOT EXISTS slug VARCHAR(100) UNIQUE;

-- Generate slugs for any existing schools (lowercase, hyphenated)
UPDATE schools
SET slug = LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(TRIM(name), '[^a-zA-Z0-9\s-]', '', 'g'),
    '\s+', '-', 'g'
  )
)
WHERE slug IS NULL;

-- Make slug NOT NULL after backfill
ALTER TABLE schools ALTER COLUMN slug SET NOT NULL;

-- Add site customization columns
ALTER TABLE schools ADD COLUMN IF NOT EXISTS hero_headline TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS hero_subtext TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS about_text TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS founded_year INTEGER;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS county VARCHAR(100);
ALTER TABLE schools ADD COLUMN IF NOT EXISTS custom_domain VARCHAR(255) UNIQUE;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS site_published BOOLEAN DEFAULT TRUE;

-- Allow anonymous users to read school public info by slug (for the public school site)
CREATE POLICY schools_public_read ON schools
  FOR SELECT TO anon
  USING (site_published = TRUE);

-- Update register_school RPC to accept and set slug
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
  v_slug      TEXT;
  v_slug_base TEXT;
  v_counter   INT := 0;
BEGIN
  -- Generate slug from school name
  v_slug_base := LOWER(REGEXP_REPLACE(
    REGEXP_REPLACE(TRIM(p_school_name), '[^a-zA-Z0-9\s-]', '', 'g'),
    '\s+', '-', 'g'
  ));
  v_slug := v_slug_base;

  -- Ensure uniqueness by appending a number if needed
  WHILE EXISTS(SELECT 1 FROM schools WHERE slug = v_slug) LOOP
    v_counter := v_counter + 1;
    v_slug := v_slug_base || '-' || v_counter;
  END LOOP;

  -- 1. Create the school
  INSERT INTO schools (name, school_code, slug, location, moe_registration_number,
    principal_name, principal_email, phone, address, motto,
    proprietor_name, proprietor_email, site_published)
  VALUES (p_school_name, p_school_code, v_slug, p_location, NULLIF(p_moe_reg, ''),
    p_principal_name, p_principal_email, p_school_phone, NULLIF(p_address, ''),
    NULLIF(p_motto, ''), p_owner_name, p_owner_email, TRUE)
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
    'school_code', p_school_code,
    'slug', v_slug
  );
END;
$$;

GRANT EXECUTE ON FUNCTION register_school TO authenticated;
GRANT EXECUTE ON FUNCTION register_school TO anon;
