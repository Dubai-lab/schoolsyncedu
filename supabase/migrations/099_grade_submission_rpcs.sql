-- Migration 099: Grade submission / approval RPCs (SECURITY DEFINER)
--
-- Direct PATCH on grades fails with 42883 "user_role = text" because the
-- initial schema's helper functions (auth_school_id / auth_user_role) have
-- type-cast issues that surface on UPDATE but not SELECT.
-- SECURITY DEFINER functions bypass RLS entirely and run as the owner,
-- so they are not affected by any policy type-cast bugs.

-- ════════════════════════════════════════════════════════════════
-- submit_grades_for_approval  — teacher submits draft grades
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION submit_grades_for_approval(p_grade_ids UUID[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role  TEXT;
  v_caller_school UUID;
  v_updated      INT;
BEGIN
  SELECT role::TEXT, school_id
    INTO v_caller_role, v_caller_school
    FROM users WHERE auth_id = auth.uid();

  IF v_caller_role NOT IN (
    'teacher','principal','vice_principal','admin_staff','it_admin','super_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE grades
     SET status     = 'submitted',
         updated_at = NOW()
   WHERE id         = ANY(p_grade_ids)
     AND school_id  = v_caller_school;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', TRUE,
    'updated', v_updated
  );
END;
$$;

GRANT EXECUTE ON FUNCTION submit_grades_for_approval(UUID[]) TO authenticated;


-- ════════════════════════════════════════════════════════════════
-- approve_grades  — principal approves submitted grades
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
  v_caller_role  TEXT;
  v_caller_school UUID;
  v_updated      INT;
BEGIN
  SELECT role::TEXT, school_id
    INTO v_caller_role, v_caller_school
    FROM users WHERE auth_id = auth.uid();

  IF v_caller_role NOT IN (
    'principal','vice_principal','admin_staff','it_admin','super_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only principals can approve grades';
  END IF;

  UPDATE grades
     SET status      = 'approved',
         approved_by = p_approved_by,
         approved_at = NOW(),
         rejection_reason = NULL,
         updated_at  = NOW()
   WHERE id          = ANY(p_grade_ids)
     AND school_id   = v_caller_school;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN jsonb_build_object('success', TRUE, 'updated', v_updated);
END;
$$;

GRANT EXECUTE ON FUNCTION approve_grades(UUID[], UUID) TO authenticated;


-- ════════════════════════════════════════════════════════════════
-- reject_grades  — principal rejects submitted grades with reason
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
  v_caller_role  TEXT;
  v_caller_school UUID;
  v_updated      INT;
BEGIN
  SELECT role::TEXT, school_id
    INTO v_caller_role, v_caller_school
    FROM users WHERE auth_id = auth.uid();

  IF v_caller_role NOT IN (
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
   WHERE id               = ANY(p_grade_ids)
     AND school_id        = v_caller_school;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN jsonb_build_object('success', TRUE, 'updated', v_updated);
END;
$$;

GRANT EXECUTE ON FUNCTION reject_grades(UUID[], UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
