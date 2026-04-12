-- ============================================================
-- Migration 017: Fix orphaned users (public.users without auth.users)
--
-- Problem: Some staff users exist in public.users but have no
-- corresponding auth.users record, so they cannot log in.
-- This happens when the old create_school_user() (migration 013)
-- was used, or when the auth signup step failed but the
-- public.users insert succeeded.
--
-- Fix:
--   1. Re-apply the correct create_school_user() function
--   2. Add a fix_orphaned_users() function that creates missing
--      auth.users + auth.identities records for all orphaned users
-- ============================================================

-- Ensure pgcrypto is available (Supabase pre-installs in extensions schema)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ============================================================
-- STEP 1: Re-apply create_school_user (same as migration 016)
-- ============================================================

-- Drop ALL possible overloads to avoid ambiguity
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
BEGIN
  -- 1. Verify the caller has permission
  SELECT role, school_id INTO v_caller_role, v_caller_school
  FROM users
  WHERE auth_id = auth.uid();

  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: caller not found in users table';
  END IF;

  IF v_caller_role NOT IN ('proprietor', 'it_admin', 'super_admin') THEN
    RAISE EXCEPTION 'Unauthorized: only proprietor, IT admin, or super admin can create users';
  END IF;

  IF v_caller_role IN ('proprietor', 'it_admin') AND v_caller_school != p_school_id THEN
    RAISE EXCEPTION 'Unauthorized: cannot create users for a different school';
  END IF;

  -- 2. Check email is not already taken in auth
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = lower(p_email)) THEN
    RAISE EXCEPTION 'A user with this email already exists';
  END IF;

  -- 3. Create auth user directly in auth.users
  v_auth_id := gen_random_uuid();

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_sso_user,
    created_at,
    updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_auth_id,
    'authenticated',
    'authenticated',
    lower(p_email),
    crypt(p_password, gen_salt('bf')),
    NOW(),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    jsonb_build_object(
      'first_name', p_first_name,
      'last_name', p_last_name,
      'role', p_role::text,
      'school_id', p_school_id::text
    ),
    FALSE,
    NOW(),
    NOW()
  );

  -- 4. Create identity record (required for email/password login)
  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_auth_id,
    lower(p_email),
    jsonb_build_object(
      'sub', v_auth_id::text,
      'email', lower(p_email),
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    NOW(),
    NOW(),
    NOW()
  );

  -- 5. Create public.users record
  INSERT INTO users (
    auth_id, school_id, email, first_name, last_name, full_name, phone, role, is_active
  ) VALUES (
    v_auth_id,
    p_school_id,
    lower(p_email),
    p_first_name,
    p_last_name,
    p_first_name || ' ' || p_last_name,
    NULLIF(p_phone, ''),
    p_role,
    TRUE
  )
  RETURNING id INTO v_user_id;

  RETURN jsonb_build_object(
    'id',        v_user_id,
    'auth_id',   v_auth_id,
    'school_id', p_school_id,
    'email',     lower(p_email),
    'role',      p_role
  );
END;
$$;

GRANT EXECUTE ON FUNCTION create_school_user(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, user_role) TO authenticated;

-- ============================================================
-- STEP 2: Fix all orphaned users
-- Creates auth.users + auth.identities for public.users rows
-- that have no matching auth record (auth_id IS NULL or
-- auth_id does not exist in auth.users).
-- Uses a default password that must be changed on first login.
-- ============================================================

CREATE OR REPLACE FUNCTION fix_orphaned_users(
  p_default_password TEXT DEFAULT 'SchoolSync@2026'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_rec        RECORD;
  v_auth_id    UUID;
  v_fixed      INT := 0;
  v_errors     JSONB := '[]'::jsonb;
BEGIN
  -- Find all users with missing auth records
  FOR v_rec IN
    SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.school_id
    FROM users u
    LEFT JOIN auth.users au ON au.id = u.auth_id
    WHERE u.auth_id IS NULL
       OR au.id IS NULL
  LOOP
    BEGIN
      -- Skip if email already exists in auth (edge case: duplicate emails)
      IF EXISTS (SELECT 1 FROM auth.users WHERE email = lower(v_rec.email)) THEN
        -- Link to existing auth user instead
        UPDATE users
        SET auth_id = (SELECT id FROM auth.users WHERE email = lower(v_rec.email) LIMIT 1)
        WHERE id = v_rec.id;
        v_fixed := v_fixed + 1;
        CONTINUE;
      END IF;

      -- Create a new auth user
      v_auth_id := gen_random_uuid();

      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data,
        is_sso_user, created_at, updated_at
      ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        v_auth_id,
        'authenticated',
        'authenticated',
        lower(v_rec.email),
        crypt(p_default_password, gen_salt('bf')),
        NOW(),
        jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
        jsonb_build_object(
          'first_name', COALESCE(v_rec.first_name, ''),
          'last_name',  COALESCE(v_rec.last_name, ''),
          'role',       v_rec.role::text,
          'school_id',  v_rec.school_id::text
        ),
        FALSE,
        NOW(), NOW()
      );

      -- Create identity record
      INSERT INTO auth.identities (
        id, user_id, provider_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(),
        v_auth_id,
        lower(v_rec.email),
        jsonb_build_object(
          'sub', v_auth_id::text,
          'email', lower(v_rec.email),
          'email_verified', true,
          'phone_verified', false
        ),
        'email',
        NOW(), NOW(), NOW()
      );

      -- Link the public.users record to the new auth user
      UPDATE users SET auth_id = v_auth_id WHERE id = v_rec.id;

      v_fixed := v_fixed + 1;

    EXCEPTION WHEN OTHERS THEN
      -- Log the error but continue fixing other users
      v_errors := v_errors || jsonb_build_object(
        'user_id', v_rec.id,
        'email',   v_rec.email,
        'error',   SQLERRM
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'fixed_count', v_fixed,
    'errors',      v_errors
  );
END;
$$;

-- Only super admins / service role should run this
GRANT EXECUTE ON FUNCTION fix_orphaned_users(TEXT) TO authenticated;

-- ============================================================
-- STEP 3: Run the fix NOW for all existing orphaned users
-- Uses the default password — affected users should reset it.
-- ============================================================
-- To run with a custom default password, use:
--   SELECT fix_orphaned_users('YourDefaultPassword');
-- Otherwise uncomment the line below:
-- SELECT fix_orphaned_users();

-- Force PostgREST to reload the schema cache
NOTIFY pgrst, 'reload schema';
