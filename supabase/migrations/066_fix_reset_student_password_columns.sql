-- Migration 066: Fix reset_student_password — wrong column names on school_settings
-- Run this in: Supabase Dashboard → SQL Editor → New query
--
-- Migration 065 queried `key` and `value` but the actual table uses
-- `setting_key` and `setting_value`.  This caused:
--   ERROR: column "value" does not exist
-- when IT Admin clicked "Reset Login Password".

CREATE OR REPLACE FUNCTION reset_student_password(
  p_student_id UUID,
  p_school_id  UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
  v_caller_role     user_role;
  v_caller_school   UUID;
  v_student_auth_id UUID;
  v_default_password TEXT;
  v_reg_number      TEXT;
BEGIN
  -- ── 1. Verify caller is privileged staff ────────────────────────────────
  SELECT role, school_id
    INTO v_caller_role, v_caller_school
    FROM users
   WHERE auth_id = auth.uid();

  IF v_caller_role NOT IN (
    'it_admin'::user_role,
    'admin_staff'::user_role,
    'principal'::user_role,
    'vice_principal'::user_role
  ) THEN
    RAISE EXCEPTION 'Unauthorized: insufficient role to reset passwords';
  END IF;

  IF v_caller_school != p_school_id THEN
    RAISE EXCEPTION 'Forbidden: student is not in your school';
  END IF;

  -- ── 2. Get student's auth_id and registration number ────────────────────
  SELECT u.auth_id, s.registration_number
    INTO v_student_auth_id, v_reg_number
    FROM students s
    JOIN users u ON u.id = s.user_id
   WHERE s.id        = p_student_id
     AND s.school_id = p_school_id;

  IF v_student_auth_id IS NULL THEN
    RAISE EXCEPTION 'Student not found or does not have a login account yet';
  END IF;

  -- ── 3. Get the school default password (fallback: registration number) ──
  -- FIX: use correct column names setting_key / setting_value
  SELECT setting_value INTO v_default_password
    FROM school_settings
   WHERE school_id  = p_school_id
     AND setting_key = 'default_student_password';

  v_default_password := COALESCE(
    NULLIF(TRIM(v_default_password), ''),
    v_reg_number,
    'school123'
  );

  -- ── 4. Update auth.users password ───────────────────────────────────────
  UPDATE auth.users
     SET encrypted_password = extensions.crypt(
           v_default_password,
           extensions.gen_salt('bf')
         ),
         updated_at = NOW()
   WHERE id = v_student_auth_id;
END;
$$;

GRANT EXECUTE ON FUNCTION reset_student_password(UUID, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
