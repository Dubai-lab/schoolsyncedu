-- ============================================================
-- Migration 013: Create School User RPC Function
-- After client-side signUp() creates the auth account on a
-- separate non-session client, this RPC:
--   1. Confirms the email (so the user can log in immediately)
--   2. Inserts the public.users row with the correct auth_id
-- Uses SECURITY DEFINER to bypass RLS and access auth.users.
-- ============================================================

CREATE OR REPLACE FUNCTION create_school_user(
  p_auth_id     UUID,
  p_school_id   UUID,
  p_email       TEXT,
  p_first_name  TEXT,
  p_last_name   TEXT,
  p_phone       TEXT DEFAULT NULL,
  p_role        user_role DEFAULT 'teacher'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role  user_role;
  v_caller_school UUID;
  v_user_id      UUID;
BEGIN
  -- 1. Verify the caller has permission (proprietor or it_admin of the same school)
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

  -- 2. Auto-confirm the email so the user can log in immediately
  UPDATE auth.users
  SET email_confirmed_at = NOW()
  WHERE id = p_auth_id AND email_confirmed_at IS NULL;

  -- 3. Insert into the public users table with auth_id
  INSERT INTO users (auth_id, school_id, email, first_name, last_name, full_name, phone, role, is_active)
  VALUES (
    p_auth_id,
    p_school_id,
    p_email,
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
    'auth_id',   p_auth_id,
    'school_id', p_school_id,
    'email',     p_email,
    'role',      p_role
  );
END;
$$;

-- Grant to authenticated users only (must be logged in as admin)
GRANT EXECUTE ON FUNCTION create_school_user TO authenticated;
