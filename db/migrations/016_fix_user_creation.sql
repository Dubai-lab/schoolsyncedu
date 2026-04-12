-- Migration 016: Fix user creation
--
-- Creates auth user + identity + public.users in one atomic transaction.
-- SECURITY DEFINER runs as postgres with full auth schema access.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DROP FUNCTION IF EXISTS create_school_user(UUID, UUID, TEXT, TEXT, TEXT, TEXT, user_role);
DROP FUNCTION IF EXISTS create_school_user(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, user_role);

CREATE OR REPLACE FUNCTION create_school_user(
  p_school_id   UUID,
  p_email       TEXT,
  p_password    TEXT,
  p_first_name  TEXT,
  p_last_name   TEXT,
  p_phone       TEXT DEFAULT '',
  p_role        user_role DEFAULT 'teacher'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_role   user_role;
  v_caller_school UUID;
  v_auth_id       UUID;
  v_user_id       UUID;
  v_encrypted_pw  TEXT;
BEGIN
  SELECT role, school_id INTO v_caller_role, v_caller_school
  FROM users WHERE auth_id = auth.uid();

  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: caller not found';
  END IF;
  IF v_caller_role NOT IN ('proprietor', 'it_admin', 'super_admin') THEN
    RAISE EXCEPTION 'Unauthorized: insufficient permissions';
  END IF;
  IF v_caller_role IN ('proprietor', 'it_admin') AND v_caller_school != p_school_id THEN
    RAISE EXCEPTION 'Unauthorized: wrong school';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = lower(p_email)) THEN
    RAISE EXCEPTION 'A user with this email already exists';
  END IF;

  v_auth_id := gen_random_uuid();
  v_encrypted_pw := extensions.crypt(p_password, extensions.gen_salt('bf'));

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at, email_change_token_new, email_change,
    email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
    is_super_admin, created_at, updated_at, phone, phone_confirmed_at,
    phone_change, phone_change_token, phone_change_sent_at,
    email_change_token_current, email_change_confirm_status,
    banned_until, reauthentication_token, reauthentication_sent_at,
    is_sso_user, deleted_at, is_anonymous
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_auth_id, 'authenticated', 'authenticated',
    lower(p_email), v_encrypted_pw,
    NOW(), NULL, '', NULL,
    '', NULL, '', '',
    NULL, NULL,
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    jsonb_build_object('first_name', p_first_name, 'last_name', p_last_name, 'role', p_role::text, 'school_id', p_school_id::text),
    FALSE, NOW(), NOW(), NULL, NULL,
    '', '', NULL,
    '', 0,
    NULL, '', NULL,
    FALSE, NULL, FALSE
  );

  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_auth_id, lower(p_email),
    jsonb_build_object('sub', v_auth_id::text, 'email', lower(p_email), 'email_verified', true, 'phone_verified', false),
    'email', NOW(), NOW(), NOW()
  );

  INSERT INTO users (auth_id, school_id, email, first_name, last_name, full_name, phone, role, is_active)
  VALUES (v_auth_id, p_school_id, lower(p_email), p_first_name, p_last_name,
          p_first_name || ' ' || p_last_name, NULLIF(p_phone, ''), p_role, TRUE)
  RETURNING id INTO v_user_id;

  RETURN jsonb_build_object(
    'id', v_user_id, 'auth_id', v_auth_id, 'school_id', p_school_id,
    'email', lower(p_email), 'role', p_role
  );
END;
$$;

GRANT EXECUTE ON FUNCTION create_school_user(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, user_role) TO authenticated;
NOTIFY pgrst, 'reload schema';
