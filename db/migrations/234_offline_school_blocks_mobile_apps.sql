-- Migration 234: a suspended school is turned away in the mobile apps too
--
-- What was wrong
-- --------------
-- schools.is_online was read in exactly two places in the product: the public
-- school site and its branded web login page. Both apps ignored it entirely.
-- A school could be suspended for non-payment and:
--
--   * students still signed in to the MIS app and used it normally
--   * teachers still signed in to Attend and recorded attendance
--   * examiners still cleared students at the kiosk
--
-- The suspension was real in the database and visible on the marketing
-- surface, and enforced nowhere that mattered operationally.
--
-- Why the checks go here rather than in the apps
-- ----------------------------------------------
-- These are installed apps. A check written only in the client protects
-- nobody running yesterday's build, and nobody calling the RPC directly. Both
-- login RPCs already return their refusal as a message the apps display, so
-- adding the rule here fixes phones that are already in people's hands
-- without shipping anything to a store.
--
-- The wording deliberately does not say "your school has not paid". A student
-- holding a phone is not the person who owes money and should not be told
-- their school's billing status; they are told to speak to the school.

-- ---------------------------------------------------------------------------
-- 1. Student MIS app — school code step
--    LoginScreen renders lookup.message verbatim, so this needs no app change.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION lookup_student_login(
  p_school_code TEXT,
  p_reg_number  TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id    UUID;
  v_school_name  TEXT;
  v_school_count INT;
  v_is_online    BOOLEAN;
  v_user_id      UUID;
  v_email        TEXT;
BEGIN
  IF p_school_code IS NULL OR btrim(p_school_code) = ''
     OR p_reg_number IS NULL OR btrim(p_reg_number) = '' THEN
    RETURN jsonb_build_object('found', false, 'email', null,
      'message', 'Enter your school code and registration number.');
  END IF;

  -- Resolve the school. school_code is VARCHAR(3) UNIQUE NOT NULL and the
  -- registration form always uppercases it, but UNIQUE in Postgres is
  -- case-sensitive -- so match case-insensitively and refuse to guess if
  -- that somehow matches more than one row.
  SELECT count(*) INTO v_school_count
  FROM   schools sc
  WHERE  upper(sc.school_code) = upper(btrim(p_school_code));

  IF v_school_count = 0 THEN
    RETURN jsonb_build_object('found', false, 'email', null,
      'message', 'School code not recognised. Check the code with your school office.');
  END IF;

  IF v_school_count > 1 THEN
    RETURN jsonb_build_object('found', false, 'email', null,
      'message', 'This school code is ambiguous. Contact SchoolSync support.');
  END IF;

  SELECT sc.id, sc.name, sc.is_online
  INTO   v_school_id, v_school_name, v_is_online
  FROM   schools sc
  WHERE  upper(sc.school_code) = upper(btrim(p_school_code));

  -- The school exists but is suspended. Answered before the registration
  -- number is looked at: whether a given student exists is not something an
  -- offline school should still be confirming to anyone who types a code.
  IF v_is_online IS FALSE THEN
    RETURN jsonb_build_object('found', false, 'email', null,
      'school_id', v_school_id, 'school_name', v_school_name,
      'reason', 'school_offline',
      'message', v_school_name || ' is currently offline. Please contact your school office.');
  END IF;

  -- Find the student WITHIN that school. UNIQUE(school_id, registration_number)
  -- guarantees at most one row, so there is nothing to disambiguate here.
  SELECT s.user_id INTO v_user_id
  FROM   students s
  WHERE  s.school_id = v_school_id
    AND  upper(s.registration_number) = upper(btrim(p_reg_number));

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false, 'email', null,
      'school_id', v_school_id, 'school_name', v_school_name,
      'message', 'No student with that registration number at ' || v_school_name || '.');
  END IF;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('found', false, 'email', null,
      'school_id', v_school_id, 'school_name', v_school_name,
      'message', 'No account linked to this registration number. Visit the IT office.');
  END IF;

  SELECT u.email INTO v_email
  FROM   users u
  WHERE  u.id = v_user_id;

  IF v_email IS NULL THEN
    RETURN jsonb_build_object('found', false, 'email', null,
      'school_id', v_school_id, 'school_name', v_school_name,
      'message', 'Account not configured. Contact your IT administrator.');
  END IF;

  RETURN jsonb_build_object(
    'found',       true,
    'email',       v_email,
    'school_id',   v_school_id,
    'school_name', v_school_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION lookup_student_login(TEXT, TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Attend app, exam clearance -- school code + finance PIN
--    KioskLogin renders the exception message, so this needs no app change.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION verify_kiosk_access(
  p_school_code VARCHAR,
  p_pin         VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_school     RECORD;
  v_stored_pin TEXT;
BEGIN
  SELECT id, name, school_code, logo_url, address, is_online
  INTO   v_school
  FROM   schools
  WHERE  UPPER(school_code) = UPPER(p_school_code)
  LIMIT  1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid school code';
  END IF;

  -- Before the PIN is checked, so a suspended school does not go on telling
  -- people whether they guessed its finance PIN correctly.
  IF v_school.is_online IS FALSE THEN
    RAISE EXCEPTION '% is currently offline. Contact your school administration.', v_school.name;
  END IF;

  SELECT setting_value INTO v_stored_pin
  FROM   school_settings
  WHERE  school_id = v_school.id
    AND  setting_key = 'kiosk_pin'
  LIMIT  1;

  IF v_stored_pin IS NULL THEN
    RAISE EXCEPTION 'Kiosk PIN not set. Ask finance to configure it in the Bursar dashboard.';
  END IF;

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

-- ---------------------------------------------------------------------------
-- 3. Everything that signs in with an email and password
--
--    Teacher and card-admin sign-in on Attend never sees a school code -- the
--    school is only known from the session afterwards. Sessions also persist,
--    so a device that signed in yesterday keeps working today unless something
--    re-checks. This is what the app shells call to find out.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION my_school_access()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_school RECORD;
BEGIN
  SELECT sc.id, sc.name, sc.is_online
  INTO   v_school
  FROM   users u
  JOIN   schools sc ON sc.id = u.school_id
  WHERE  u.auth_id = auth.uid();

  -- No session, or a user with no school (super admin). Nothing to block.
  IF NOT FOUND THEN
    RETURN jsonb_build_object('online', true, 'known', false);
  END IF;

  RETURN jsonb_build_object(
    'online',      COALESCE(v_school.is_online, true),
    'known',       true,
    'school_id',   v_school.id,
    'school_name', v_school.name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION my_school_access() TO authenticated;
