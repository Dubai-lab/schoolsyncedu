-- Migration 101: Grade RPCs with explicit row_security=off + JWT auth
--
-- Previous attempts still hit 42883 because the grades UPDATE triggers
-- RLS policy evaluation (function owner may not be a superuser with
-- BYPASSRLS). SET row_security = off in the function header forces RLS
-- off for every statement inside the function, regardless of ownership.
-- JWT claims provide auth without touching any RLS-protected table.

-- Drop explicitly (not just OR REPLACE) to ensure a clean slate
DROP FUNCTION IF EXISTS submit_grades_for_approval(UUID[]);
DROP FUNCTION IF EXISTS approve_grades(UUID[], UUID);
DROP FUNCTION IF EXISTS reject_grades(UUID[], UUID, TEXT);

-- ── submit_grades_for_approval ────────────────────────────────────────────────
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
GRANT EXECUTE ON FUNCTION submit_grades_for_approval(UUID[]) TO service_role;


-- ── approve_grades ────────────────────────────────────────────────────────────
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
GRANT EXECUTE ON FUNCTION approve_grades(UUID[], UUID) TO service_role;


-- ── reject_grades ─────────────────────────────────────────────────────────────
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
GRANT EXECUTE ON FUNCTION reject_grades(UUID[], UUID, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
