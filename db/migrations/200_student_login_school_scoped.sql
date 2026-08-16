-- ============================================================
-- Migration 200: School-Scoped Student Login
--
-- NUMBERING NOTE: this series starts at 200 deliberately.
--   db/migrations tops out at 102 and supabase/migrations at 105,
--   and numbers 060-102 collide across those two folders with
--   different content in each. Starting at 200 keeps every future
--   migration unambiguous.
--
-- Problem:
--   students.registration_number is UNIQUE(school_id, registration_number)
--   — unique PER SCHOOL, not globally. But lookup_student_login(reg_number)
--   from migration 026 searches every school and takes LIMIT 1.
--
--   Two schools issuing the same registration number is not hypothetical:
--   codes are year-based (SLR-2026-0001) and each school picks its own
--   prefix. When it happens today, a student is silently handed a
--   DIFFERENT SCHOOL'S account email, or is told no account exists.
--
--   This is already a live bug on the web. It becomes the front door
--   once every school's students share one mobile app.
--
-- Fixes:
--   1. lookup_student_login(p_school_code, p_reg_number) — new 2-arg
--      overload. Resolves the school first, then scopes the student
--      lookup to it. This is what the mobile app will call.
--
--   2. lookup_student_login(p_reg_number) — the existing 1-arg version
--      is KEPT so the current web StudentLogin.tsx keeps working, but is
--      made safe: it now counts matches across all schools and refuses
--      to guess when more than one exists, instead of silently
--      returning the wrong account.
--
-- Both are SECURITY DEFINER with a pinned search_path, matching the
-- hardening done in migrations 071-077.
--
-- Non-breaking: no existing signature is dropped or changed.
-- ============================================================


-- ============================================================
-- 1. LOOKUP_STUDENT_LOGIN (school-scoped) — 2 arguments
--    Called by the mobile app and, once updated, by the web.
--    Grants: anon + authenticated (runs before auth is established)
-- ============================================================

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
  -- case-sensitive — so match case-insensitively and refuse to guess if
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

  SELECT sc.id, sc.name INTO v_school_id, v_school_name
  FROM   schools sc
  WHERE  upper(sc.school_code) = upper(btrim(p_school_code));

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


-- ============================================================
-- 2. LOOKUP_STUDENT_LOGIN (legacy) — 1 argument
--    Unchanged signature so the current web login keeps working.
--    Behaviour change: when a registration number exists at more than
--    one school it now returns a clear error instead of guessing.
--    Remove this once StudentLogin.tsx passes a school code.
-- ============================================================

CREATE OR REPLACE FUNCTION lookup_student_login(p_reg_number TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match_count INT;
  v_user_id     UUID;
  v_email       TEXT;
BEGIN
  IF p_reg_number IS NULL OR btrim(p_reg_number) = '' THEN
    RETURN jsonb_build_object('found', false, 'email', null,
      'message', 'Enter your registration number.');
  END IF;

  SELECT count(*) INTO v_match_count
  FROM   students s
  WHERE  upper(s.registration_number) = upper(btrim(p_reg_number));

  IF v_match_count = 0 THEN
    RETURN jsonb_build_object('found', false, 'email', null,
      'message', 'No account linked to this registration number. Visit the IT office.');
  END IF;

  -- More than one school issues this registration number. Refuse to guess:
  -- picking one would sign the student into another school's account.
  IF v_match_count > 1 THEN
    RETURN jsonb_build_object('found', false, 'email', null, 'needs_school_code', true,
      'message', 'That registration number is used at more than one school. Please sign in with your school code.');
  END IF;

  SELECT s.user_id INTO v_user_id
  FROM   students s
  WHERE  upper(s.registration_number) = upper(btrim(p_reg_number));

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('found', false, 'email', null,
      'message', 'No account linked to this registration number. Visit the IT office.');
  END IF;

  SELECT u.email INTO v_email
  FROM   users u
  WHERE  u.id = v_user_id;

  IF v_email IS NULL THEN
    RETURN jsonb_build_object('found', false, 'email', null,
      'message', 'Account not configured. Contact your IT administrator.');
  END IF;

  RETURN jsonb_build_object('found', true, 'email', v_email);
END;
$$;

GRANT EXECUTE ON FUNCTION lookup_student_login(TEXT) TO anon, authenticated;


-- ============================================================
-- 3. RELOAD THE API SCHEMA CACHE
--    PostgREST resolves overloaded functions by argument NAME, so it
--    must see the new 2-arg signature before the app can call it.
--    Supabase usually reloads on its own, but this makes it immediate.
-- ============================================================

NOTIFY pgrst, 'reload schema';


-- ============================================================
-- 4. VERIFICATION
--    Run these by hand after applying. Both should return 0 rows.
-- ============================================================

-- 3a. Any school codes that collide case-insensitively?
--     (UNIQUE is case-sensitive, so this is worth confirming once.)
--
--   SELECT upper(school_code) AS code, count(*)
--   FROM   schools
--   GROUP  BY upper(school_code)
--   HAVING count(*) > 1;

-- 3b. Any registration numbers already shared across schools?
--     If this returns rows, those students CANNOT log in via the legacy
--     1-arg path any more — they must use the school code. That is the
--     correct outcome, but you will want to know who they are.
--
--   SELECT upper(registration_number) AS reg, count(DISTINCT school_id) AS schools
--   FROM   students
--   GROUP  BY upper(registration_number)
--   HAVING count(DISTINCT school_id) > 1;
