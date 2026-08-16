-- ============================================================
-- Migration 203: Public school branding lookup by code
--
-- Why:
--   The mobile apps are universal — one binary serving every school. A
--   student at Liberia Academy and one at Dakor School System install the
--   same app. Without this they both see generic SchoolSync purple, and the
--   app never feels like it belongs to their school.
--
--   Branding has to load BEFORE sign-in: the student types a school code on
--   the login screen, and the app should repaint immediately, while still
--   unauthenticated. That rules out reading the schools table directly, which
--   RLS correctly blocks for anon.
--
--   get_public_school_by_slug already exists and is granted to anon, but the
--   apps identify a school by its 3-letter code (the same value the kiosk
--   uses via verify_kiosk_access), not by slug. Hence a by-code variant.
--
-- Exposure:
--   Returns only what is already public on a school's own website — name,
--   logo, colours, motto. No contact details, no subscription state, no
--   counts. A school code is 3 characters and trivially enumerable, so
--   nothing here may be sensitive. Deliberately excludes principal_email,
--   phone and address, all of which sit in the same table.
-- ============================================================

CREATE OR REPLACE FUNCTION get_public_school_by_code(p_school_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_school RECORD;
  v_count  INT;
BEGIN
  IF p_school_code IS NULL OR btrim(p_school_code) = '' THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  -- school_code is VARCHAR(3) UNIQUE NOT NULL, and the registration form
  -- uppercases it — but UNIQUE in Postgres is case-sensitive, so match
  -- case-insensitively and refuse to guess if that ever hits two rows.
  SELECT count(*) INTO v_count
  FROM   schools s
  WHERE  upper(s.school_code) = upper(btrim(p_school_code));

  IF v_count <> 1 THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT s.id, s.name, s.logo_url, s.primary_color, s.secondary_color, s.motto
  INTO   v_school
  FROM   schools s
  WHERE  upper(s.school_code) = upper(btrim(p_school_code));

  RETURN jsonb_build_object(
    'found',           true,
    'school_id',       v_school.id,
    'name',            v_school.name,
    'logo_url',        v_school.logo_url,
    'primary_color',   v_school.primary_color,
    'secondary_color', v_school.secondary_color,
    'motto',           v_school.motto
  );
END;
$$;

-- anon: the login screen runs before a session exists.
GRANT EXECUTE ON FUNCTION get_public_school_by_code(TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';


-- ============================================================
-- VERIFICATION
--
--   SELECT get_public_school_by_code('LAC');
--
-- Should return found:true with the school's name and colours. An unknown
-- code returns found:false rather than an error, so the app can simply say
-- the code was not recognised.
-- ============================================================
