-- Migration 100: Rewrite grade RPCs to read auth from JWT, not users table
--
-- Root cause: submit_grades_for_approval queried public.users to get the
-- caller's role/school_id. That SELECT hits the users_select RLS policy
-- (from migration 011), which calls auth_school_id() → SELECT from users →
-- hits users_select again → circular dependency → 42883 user_role = text.
--
-- Fix: read role and school_id from the JWT user_metadata instead of the
-- users table. The JWT is populated at login and contains both fields.
-- No table is queried for auth → no RLS chain → no 42883.

-- ════════════════════════════════════════════════════════════════
-- submit_grades_for_approval
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION submit_grades_for_approval(p_grade_ids UUID[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meta        JSONB;
  v_role        TEXT;
  v_school_id   UUID;
  v_updated     INT;
BEGIN
  v_meta      := (current_setting('request.jwt.claims', true)::JSONB)->'user_metadata';
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
   WHERE id        = ANY(p_grade_ids)
     AND school_id = v_school_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN jsonb_build_object('success', TRUE, 'updated', v_updated);
END;
$$;

GRANT EXECUTE ON FUNCTION submit_grades_for_approval(UUID[]) TO authenticated;


-- ════════════════════════════════════════════════════════════════
-- approve_grades
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION approve_grades(
  p_grade_ids   UUID[],
  p_approved_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meta      JSONB;
  v_role      TEXT;
  v_school_id UUID;
  v_updated   INT;
BEGIN
  v_meta      := (current_setting('request.jwt.claims', true)::JSONB)->'user_metadata';
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


-- ════════════════════════════════════════════════════════════════
-- reject_grades
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION reject_grades(
  p_grade_ids   UUID[],
  p_approved_by UUID,
  p_reason      TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meta      JSONB;
  v_role      TEXT;
  v_school_id UUID;
  v_updated   INT;
BEGIN
  v_meta      := (current_setting('request.jwt.claims', true)::JSONB)->'user_metadata';
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

NOTIFY pgrst, 'reload schema';
