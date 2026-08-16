-- ============================================================
-- Migration 206: Hash the kiosk PIN, and make it resettable
--
-- Three problems, all in the same place.
--
-- 1. PERMANENT LOCKOUT
--    KioskSettings requires the current PIN to set a new one, and there is no
--    reset. Forgetting it locks a school out of exam clearance for good.
--
--    Requiring the old PIN was never buying much: whoever changes it is already
--    signed in as finance or school leadership. It guards only against someone
--    using an unattended session — and costs a permanent lockout in exchange.
--    A privileged, authenticated role may now set it outright.
--
-- 2. STORED IN PLAINTEXT
--    school_settings.setting_value held the PIN as typed, and
--    verify_kiosk_access compared it with <>. Anyone who could read the row
--    knew the PIN.
--
-- 3. EVERY STAFF ACCOUNT COULD READ IT
--    settings_staff_select (migration 014) grants each user SELECT on every
--    setting for their school. A teacher or librarian could fetch the exam
--    clearance PIN straight from the API. That is the actual hole: the PIN
--    decides who may check fee status at an exam door, and it was readable by
--    everyone inside the school.
--
-- After this migration the PIN is a bcrypt hash, no client can read it at all,
-- and finance or leadership can reset it without knowing the old one.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ============================================================
-- 1. HASH ANY EXISTING PIN
--    Done before the policy change so current PINs keep working. bcrypt
--    hashes start with $2, which is how the verify function below tells a
--    hashed value from a legacy plaintext one.
-- ============================================================

UPDATE school_settings
SET    setting_value = crypt(setting_value, gen_salt('bf'))
WHERE  setting_key = 'kiosk_pin'
  AND  setting_value IS NOT NULL
  AND  setting_value <> ''
  AND  left(setting_value, 2) <> '$2';


-- ============================================================
-- 2. HIDE THE PIN FROM CLIENTS
--    Narrows settings_staff_select rather than replacing it, so every other
--    setting behaves exactly as before. Nothing needs to read kiosk_pin from
--    the client: verification and status both run through SECURITY DEFINER
--    functions below.
-- ============================================================

DROP POLICY IF EXISTS settings_staff_select ON school_settings;
CREATE POLICY settings_staff_select ON school_settings
  FOR SELECT
  USING (
    school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid())
    AND setting_key <> 'kiosk_pin'
  );


-- ============================================================
-- 3. SET OR RESET THE PIN
--    No old PIN required. Restricted to the roles that own kiosk setup.
-- ============================================================

CREATE OR REPLACE FUNCTION set_kiosk_pin(p_pin TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user RECORD;
BEGIN
  SELECT id, school_id, role INTO v_user
  FROM   users
  WHERE  auth_id = auth.uid();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Not signed in.');
  END IF;

  IF v_user.role::TEXT NOT IN
     ('bursar', 'principal', 'vice_principal', 'proprietor', 'it_admin', 'super_admin') THEN
    RETURN jsonb_build_object('ok', false, 'message', 'You cannot change the kiosk PIN.');
  END IF;

  IF p_pin IS NULL OR p_pin !~ '^\d{4,8}$' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'PIN must be 4 to 8 digits.');
  END IF;

  INSERT INTO school_settings (school_id, setting_key, setting_value)
  VALUES (v_user.school_id, 'kiosk_pin', crypt(p_pin, gen_salt('bf')))
  ON CONFLICT (school_id, setting_key) DO UPDATE
    SET setting_value = EXCLUDED.setting_value;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION set_kiosk_pin(TEXT) TO authenticated;


-- ============================================================
-- 4. STATUS WITHOUT DISCLOSURE
--    The settings screen needs to know whether a PIN exists so it can say
--    "set" or "not set". It must not learn the value.
-- ============================================================

CREATE OR REPLACE FUNCTION is_kiosk_pin_set()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_school UUID;
BEGIN
  SELECT school_id INTO v_school FROM users WHERE auth_id = auth.uid();
  IF v_school IS NULL THEN RETURN FALSE; END IF;

  RETURN EXISTS (
    SELECT 1 FROM school_settings
    WHERE  school_id = v_school
      AND  setting_key = 'kiosk_pin'
      AND  setting_value IS NOT NULL
      AND  setting_value <> ''
  );
END;
$$;

GRANT EXECUTE ON FUNCTION is_kiosk_pin_set() TO authenticated;


-- ============================================================
-- 5. VERIFY AGAINST THE HASH
--    Replaces the plaintext <> comparison in migration 068. Still tolerates a
--    legacy plaintext value, in case a school_settings row is restored from an
--    older backup after this runs — otherwise that school would be locked out
--    with no way to tell why.
-- ============================================================

CREATE OR REPLACE FUNCTION verify_kiosk_pin(p_stored TEXT, p_supplied TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_stored IS NULL OR p_supplied IS NULL THEN
    RETURN FALSE;
  END IF;

  IF left(p_stored, 2) = '$2' THEN
    RETURN p_stored = crypt(p_supplied, p_stored);
  END IF;

  -- Legacy plaintext row.
  RETURN p_stored = p_supplied;
END;
$$;


-- ============================================================
-- 5b. REDEFINE verify_kiosk_access TO USE THE HASH
--
--     Identical to migration 068 apart from the comparison. Without this the
--     hashing above would lock every kiosk out — the stored value is now a
--     bcrypt hash and `<>` against a typed PIN can never match.
--
--     Kept byte-for-byte otherwise, including the returned shape, so
--     KioskLogin needs no changes.
-- ============================================================

CREATE OR REPLACE FUNCTION verify_kiosk_access(
  p_school_code VARCHAR,
  p_pin         VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school     RECORD;
  v_stored_pin TEXT;
BEGIN
  SELECT id, name, school_code, logo_url, address
  INTO   v_school
  FROM   schools
  WHERE  UPPER(school_code) = UPPER(p_school_code)
  LIMIT  1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid school code';
  END IF;

  SELECT setting_value INTO v_stored_pin
  FROM   school_settings
  WHERE  school_id = v_school.id
    AND  setting_key = 'kiosk_pin'
  LIMIT  1;

  IF v_stored_pin IS NULL THEN
    RAISE EXCEPTION 'Kiosk PIN not set. Ask finance to configure it in the Bursar dashboard.';
  END IF;

  -- Was: v_stored_pin <> p_pin
  IF NOT verify_kiosk_pin(v_stored_pin, p_pin) THEN
    RAISE EXCEPTION 'Incorrect PIN';
  END IF;

  RETURN jsonb_build_object(
    'school_id',   v_school.id,
    'school_name', v_school.name,
    'school_code', v_school.school_code,
    'logo_url',    v_school.logo_url,
    'address',     v_school.address,
    'academic_year', COALESCE(
      (SELECT setting_value FROM school_settings
       WHERE school_id = v_school.id AND setting_key = 'current_academic_year' LIMIT 1),
      to_char(CURRENT_DATE, 'YYYY') || '-' || to_char(CURRENT_DATE + interval '1 year', 'YYYY')
    )
  );
END;
$$;


-- ============================================================
-- 6. VERIFICATION
--
--   -- No plaintext PINs remain (every row should start with $2):
--   SELECT school_id, left(setting_value, 4) AS prefix
--   FROM   school_settings WHERE setting_key = 'kiosk_pin';
--
--   -- A client can no longer read it (run as a staff user, expect 0 rows):
--   SELECT * FROM school_settings WHERE setting_key = 'kiosk_pin';
--
--   -- Reset from the Bursar dashboard, then sign in to the kiosk with the
--   -- new PIN. Both should work with no old PIN entered anywhere.
-- ============================================================

NOTIFY pgrst, 'reload schema';
