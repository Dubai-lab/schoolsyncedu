-- ============================================================
-- Migration 026: Student Login Support
--
-- Problem 1: StudentLogin.tsx queries `students` table BEFORE
--   authentication. RLS blocks unauthenticated queries → student
--   is "not found" even if the record exists.
--
-- Problem 2: accept_student_application creates a students record
--   but never creates a Supabase auth user. students.user_id is
--   NULL until IT Admin explicitly provisions the account.
--
-- Fixes:
--   1. lookup_student_login(reg_number) — SECURITY DEFINER, grants
--      anon access, safely returns the auth email for a reg number.
--      No sensitive data exposed — email is a system-generated one.
--
--   2. provision_student_account(school_id, reg_number, password) —
--      SECURITY DEFINER, IT Admin / Principal only.
--      Creates auth.users + auth.identities + public.users, then
--      links students.user_id so the student can log in.
--
--   3. list_students_without_accounts(school_id) — returns enrolled
--      students that have no user_id yet (need provisioning).
-- ============================================================

-- ============================================================
-- 1. LOOKUP_STUDENT_LOGIN
--    Called by StudentLogin.tsx before auth is established.
--    Grants: anon + authenticated (so unauthenticated browsers work)
-- ============================================================

CREATE OR REPLACE FUNCTION lookup_student_login(p_reg_number TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_email   TEXT;
BEGIN
  -- Find the user_id linked to this registration number
  SELECT s.user_id INTO v_user_id
  FROM   students s
  WHERE  upper(s.registration_number) = upper(trim(p_reg_number))
  LIMIT  1;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('found', false, 'email', null,
      'message', 'No account linked to this registration number. Visit the IT office.');
  END IF;

  -- Get email from users table
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

-- Allow unauthenticated callers (login page runs before auth)
GRANT EXECUTE ON FUNCTION lookup_student_login(TEXT) TO anon, authenticated;

-- ============================================================
-- 2. PROVISION_STUDENT_ACCOUNT
--    IT Admin or Principal calls this to create a student's
--    login account after accepting their application.
--    Inserts into auth.users, auth.identities, public.users,
--    and links students.user_id.
-- ============================================================

CREATE OR REPLACE FUNCTION provision_student_account(
  p_school_id           UUID,
  p_registration_number TEXT,
  p_password            TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_role    user_role;
  v_caller_school  UUID;
  v_student_id     UUID;
  v_first_name     TEXT;
  v_last_name      TEXT;
  v_existing_uid   UUID;
  v_auth_id        UUID;
  v_user_id        UUID;
  v_email          TEXT;
  v_encrypted_pw   TEXT;
BEGIN
  -- ── Security check ──────────────────────────────────────────
  SELECT role, school_id
  INTO   v_caller_role, v_caller_school
  FROM   users
  WHERE  auth_id = auth.uid();

  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: caller not found';
  END IF;

  IF v_caller_role NOT IN ('it_admin', 'principal', 'vice_principal', 'super_admin') THEN
    RAISE EXCEPTION 'Only IT Admin or Principal can provision student accounts';
  END IF;

  IF v_caller_role != 'super_admin' AND v_caller_school != p_school_id THEN
    RAISE EXCEPTION 'Unauthorized: wrong school';
  END IF;

  -- ── Find student ─────────────────────────────────────────────
  SELECT id, first_name, last_name, user_id
  INTO   v_student_id, v_first_name, v_last_name, v_existing_uid
  FROM   students
  WHERE  school_id = p_school_id
    AND  upper(registration_number) = upper(trim(p_registration_number));

  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Student not found: %', p_registration_number;
  END IF;

  IF v_existing_uid IS NOT NULL THEN
    RAISE EXCEPTION 'Student % already has a login account', p_registration_number;
  END IF;

  -- ── Generate system email ────────────────────────────────────
  -- Registration numbers are globally unique (format: SCH-YEAR-NNNN)
  -- We use them as the email key so no email address is needed.
  v_email := lower(trim(p_registration_number)) || '@student.schoolsync';

  -- Guard against duplicate (shouldn't happen but be safe)
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    RAISE EXCEPTION 'An account with this registration number already exists in auth. Contact support.';
  END IF;

  -- ── Create Supabase auth user ────────────────────────────────
  v_auth_id      := gen_random_uuid();
  v_encrypted_pw := extensions.crypt(p_password, extensions.gen_salt('bf'));

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at,
    invited_at, confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at,
    email_change_token_new, email_change, email_change_sent_at,
    last_sign_in_at,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, created_at, updated_at,
    phone, phone_confirmed_at,
    phone_change, phone_change_token, phone_change_sent_at,
    email_change_token_current, email_change_confirm_status,
    banned_until, reauthentication_token, reauthentication_sent_at,
    is_sso_user, deleted_at, is_anonymous
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_auth_id, 'authenticated', 'authenticated',
    v_email, v_encrypted_pw,
    NOW(),          -- email already "confirmed" — student uses reg number, not email
    NULL, '', NULL,
    '', NULL,
    '', '', NULL,
    NULL,
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    jsonb_build_object(
      'first_name', v_first_name,
      'last_name',  v_last_name,
      'role',       'student',
      'school_id',  p_school_id::text
    ),
    FALSE, NOW(), NOW(),
    NULL, NULL,
    '', '', NULL,
    '', 0,
    NULL, '', NULL,
    FALSE, NULL, FALSE
  );

  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data,
    provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_auth_id, v_email,
    jsonb_build_object(
      'sub',            v_auth_id::text,
      'email',          v_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email', NOW(), NOW(), NOW()
  );

  -- ── Create public.users row ──────────────────────────────────
  INSERT INTO users (
    auth_id, school_id, email,
    first_name, last_name, full_name,
    role, is_active
  )
  VALUES (
    v_auth_id, p_school_id, v_email,
    v_first_name, v_last_name, v_first_name || ' ' || v_last_name,
    'student', TRUE
  )
  RETURNING id INTO v_user_id;

  -- ── Link student record ──────────────────────────────────────
  UPDATE students
  SET    user_id    = v_user_id,
         updated_at = NOW()
  WHERE  id = v_student_id;

  RETURN jsonb_build_object(
    'success',             true,
    'student_id',          v_student_id,
    'user_id',             v_user_id,
    'registration_number', p_registration_number,
    'message',             'Account created. Student can now log in with their registration number and the provided password.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION provision_student_account(UUID, TEXT, TEXT) TO authenticated;

-- ============================================================
-- 3. LIST_STUDENTS_WITHOUT_ACCOUNTS
--    IT Admin uses this to see which accepted students still
--    need their login accounts created.
-- ============================================================

CREATE OR REPLACE FUNCTION list_students_without_accounts(p_school_id UUID)
RETURNS TABLE (
  id                  UUID,
  registration_number TEXT,
  first_name          TEXT,
  last_name           TEXT,
  current_grade_level TEXT,
  status              TEXT,
  enrollment_date     DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role   user_role;
  v_caller_school UUID;
BEGIN
  SELECT role, school_id
  INTO   v_caller_role, v_caller_school
  FROM   users
  WHERE  auth_id = auth.uid();

  IF v_caller_role NOT IN ('it_admin', 'principal', 'vice_principal', 'super_admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_caller_role != 'super_admin' AND v_caller_school != p_school_id THEN
    RAISE EXCEPTION 'Wrong school';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.registration_number,
    s.first_name,
    s.last_name,
    s.current_grade_level,
    s.status::TEXT,
    s.enrollment_date
  FROM students s
  WHERE s.school_id = p_school_id
    AND s.user_id IS NULL
    AND s.status = 'enrolled'
  ORDER BY s.last_name, s.first_name;
END;
$$;

GRANT EXECUTE ON FUNCTION list_students_without_accounts(UUID) TO authenticated;

-- ============================================================
-- Notify PostgREST to reload schema
-- ============================================================
NOTIFY pgrst, 'reload schema';
