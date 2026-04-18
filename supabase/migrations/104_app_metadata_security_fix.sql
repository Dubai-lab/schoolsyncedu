-- Migration 104: Move role + school_id to app_metadata (server-only)
--
-- Supabase Security Advisor ERRORS on grades RLS policies that read
-- user_metadata.role / user_metadata.school_id.  user_metadata is
-- writable by any authenticated user via supabase.auth.updateUser(),
-- so a student could self-escalate to 'principal' and approve their
-- own grades — a real privilege-escalation vulnerability.
--
-- app_metadata (raw_app_meta_data) is writable ONLY by service role.
-- End users cannot change it. Safe to use in RLS policies.
--
-- Fix strategy:
--  1. sync_auth_app_metadata() — SECURITY DEFINER trigger function
--     that writes role + school_id into auth.users.raw_app_meta_data
--     whenever a public.users row is inserted or role/school_id updated.
--  2. Trigger on public.users so every creation path is covered
--     automatically (no need to touch each RPC individually).
--  3. One-time backfill for all existing auth users.
--  4. Rewrite grades RLS policies to read from app_metadata.
--  5. Rewrite grade-approval RPCs to read from app_metadata.

-- ── 1. Sync trigger function ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sync_auth_app_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NEW.auth_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE auth.users
     SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
                          || jsonb_build_object(
                               'role',      NEW.role::TEXT,
                               'school_id', NEW.school_id::TEXT
                             )
   WHERE id = NEW.auth_id;

  RETURN NEW;
END;
$$;

-- ── 2. Trigger on public.users ──────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_sync_app_metadata ON users;
CREATE TRIGGER trg_sync_app_metadata
  AFTER INSERT OR UPDATE OF role, school_id ON users
  FOR EACH ROW EXECUTE FUNCTION sync_auth_app_metadata();

-- ── 3. Backfill existing users ──────────────────────────────────────────────────
-- Merges role + school_id into raw_app_meta_data for every existing auth user.
-- After this runs, all users will get the updated claims in their next JWT refresh
-- (Supabase refreshes access tokens every hour automatically).
UPDATE auth.users au
   SET raw_app_meta_data = COALESCE(au.raw_app_meta_data, '{}'::jsonb)
                        || jsonb_build_object(
                             'role',      pu.role::TEXT,
                             'school_id', pu.school_id::TEXT
                           )
  FROM public.users pu
 WHERE pu.auth_id = au.id
   AND pu.auth_id IS NOT NULL;

-- ── 4. Rewrite grades RLS policies to use app_metadata ─────────────────────────
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'grades'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON grades', pol.policyname);
  END LOOP;
END $$;

-- Staff SELECT (any non-student staff of the same school)
CREATE POLICY "grades_staff_select"
  ON grades FOR SELECT TO authenticated
  USING (
    school_id = (
      current_setting('request.jwt.claims', true)::jsonb
      ->'app_metadata'->>'school_id'
    )::uuid
    AND (
      current_setting('request.jwt.claims', true)::jsonb
      ->'app_metadata'->>'role'
    ) != 'student'
  );

-- Student SELECT: own grades only
CREATE POLICY "grades_student_select"
  ON grades FOR SELECT TO authenticated
  USING (
    school_id = (
      current_setting('request.jwt.claims', true)::jsonb
      ->'app_metadata'->>'school_id'
    )::uuid
    AND (
      current_setting('request.jwt.claims', true)::jsonb
      ->'app_metadata'->>'role'
    ) = 'student'
    AND student_id IN (
      SELECT s.id FROM students s
      JOIN users u ON u.id = s.user_id
      WHERE u.auth_id = auth.uid()
    )
  );

-- Staff INSERT
CREATE POLICY "grades_staff_insert"
  ON grades FOR INSERT TO authenticated
  WITH CHECK (
    school_id = (
      current_setting('request.jwt.claims', true)::jsonb
      ->'app_metadata'->>'school_id'
    )::uuid
    AND (
      current_setting('request.jwt.claims', true)::jsonb
      ->'app_metadata'->>'role'
    ) IN ('teacher','principal','vice_principal','admin_staff','it_admin','super_admin')
  );

-- Staff UPDATE
CREATE POLICY "grades_staff_update"
  ON grades FOR UPDATE TO authenticated
  USING (
    school_id = (
      current_setting('request.jwt.claims', true)::jsonb
      ->'app_metadata'->>'school_id'
    )::uuid
    AND (
      current_setting('request.jwt.claims', true)::jsonb
      ->'app_metadata'->>'role'
    ) IN ('teacher','principal','vice_principal','admin_staff','it_admin','super_admin')
  )
  WITH CHECK (
    school_id = (
      current_setting('request.jwt.claims', true)::jsonb
      ->'app_metadata'->>'school_id'
    )::uuid
    AND (
      current_setting('request.jwt.claims', true)::jsonb
      ->'app_metadata'->>'role'
    ) IN ('teacher','principal','vice_principal','admin_staff','it_admin','super_admin')
  );

-- Admin DELETE
CREATE POLICY "grades_admin_delete"
  ON grades FOR DELETE TO authenticated
  USING (
    school_id = (
      current_setting('request.jwt.claims', true)::jsonb
      ->'app_metadata'->>'school_id'
    )::uuid
    AND (
      current_setting('request.jwt.claims', true)::jsonb
      ->'app_metadata'->>'role'
    ) IN ('principal','vice_principal','admin_staff','it_admin','super_admin')
  );

-- ── 5. Rewrite grade-approval RPCs to use app_metadata ─────────────────────────
DROP FUNCTION IF EXISTS submit_grades_for_approval(UUID[]);
DROP FUNCTION IF EXISTS approve_grades(UUID[], UUID);
DROP FUNCTION IF EXISTS reject_grades(UUID[], UUID, TEXT);

CREATE FUNCTION submit_grades_for_approval(p_grade_ids UUID[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_meta      JSONB;
  v_role      TEXT;
  v_school_id UUID;
  v_updated   INT;
BEGIN
  v_meta      := (current_setting('request.jwt.claims', true)::JSONB)->'app_metadata';
  v_role      := v_meta->>'role';
  v_school_id := (v_meta->>'school_id')::UUID;

  IF v_role NOT IN (
    'teacher','principal','vice_principal','admin_staff','it_admin','super_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE grades
     SET status     = 'submitted',
         updated_at = NOW()
   WHERE id         = ANY(p_grade_ids)
     AND school_id  = v_school_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN jsonb_build_object('success', TRUE, 'updated', v_updated);
END;
$$;

GRANT EXECUTE ON FUNCTION submit_grades_for_approval(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION submit_grades_for_approval(UUID[]) TO service_role;


CREATE FUNCTION approve_grades(p_grade_ids UUID[], p_approved_by UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_meta      JSONB;
  v_role      TEXT;
  v_school_id UUID;
  v_updated   INT;
BEGIN
  v_meta      := (current_setting('request.jwt.claims', true)::JSONB)->'app_metadata';
  v_role      := v_meta->>'role';
  v_school_id := (v_meta->>'school_id')::UUID;

  IF v_role NOT IN (
    'principal','vice_principal','admin_staff','it_admin','super_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only principals can approve grades';
  END IF;

  UPDATE grades
     SET status           = 'approved',
         approved_by      = p_approved_by,
         approved_at      = NOW(),
         rejection_reason = NULL,
         updated_at       = NOW()
   WHERE id        = ANY(p_grade_ids)
     AND school_id = v_school_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN jsonb_build_object('success', TRUE, 'updated', v_updated);
END;
$$;

GRANT EXECUTE ON FUNCTION approve_grades(UUID[], UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_grades(UUID[], UUID) TO service_role;


CREATE FUNCTION reject_grades(p_grade_ids UUID[], p_approved_by UUID, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_meta      JSONB;
  v_role      TEXT;
  v_school_id UUID;
  v_updated   INT;
BEGIN
  v_meta      := (current_setting('request.jwt.claims', true)::JSONB)->'app_metadata';
  v_role      := v_meta->>'role';
  v_school_id := (v_meta->>'school_id')::UUID;

  IF v_role NOT IN (
    'principal','vice_principal','admin_staff','it_admin','super_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only principals can reject grades';
  END IF;

  UPDATE grades
     SET status           = 'rejected',
         approved_by      = p_approved_by,
         approved_at      = NOW(),
         rejection_reason = p_reason,
         updated_at       = NOW()
   WHERE id        = ANY(p_grade_ids)
     AND school_id = v_school_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN jsonb_build_object('success', TRUE, 'updated', v_updated);
END;
$$;

GRANT EXECUTE ON FUNCTION reject_grades(UUID[], UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_grades(UUID[], UUID, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
