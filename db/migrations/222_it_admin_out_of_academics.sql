-- ============================================================
-- Migration 222: IT Admin runs the system, not the school's academics
--
-- THE PROBLEM
--   Every grade gate lists it_admin beside the Principal:
--
--     grades_staff_insert   teacher, principal, vice_principal, admin_staff, it_admin
--     grades_staff_update   teacher, principal, vice_principal, admin_staff, it_admin
--     grades_admin_delete           principal, vice_principal, admin_staff, it_admin
--     approve_grades                principal, vice_principal, admin_staff, it_admin
--     reject_grades                 principal, vice_principal, admin_staff, it_admin
--
--   So the account administrator could enter a grade, approve their own entry,
--   and delete the row afterwards. On its own that is a segregation problem
--   like the Principal's finance access. Combined with what IT Admin properly
--   does hold — creating accounts and assigning roles — it is the whole
--   system: the one person who can mint a login can also decide who passes.
--
--   IT Admin exists to keep the school running: accounts, passwords, cards,
--   devices, email, imports. None of that requires touching a mark. There is
--   no workflow in the app that asks IT to grade or approve anything; the
--   grade screens are not in their menu. The permission was inherited, not
--   designed — 104 was a security fix about app_metadata, and it carried the
--   existing role lists across unchanged.
--
--   Reading is untouched. IT keeps SELECT on grades, because a support
--   question is usually 'this grade is not showing' and they need to see it.
--
-- ALSO
--   super_admin stays everywhere: it is the platform operator and locking it
--   out would leave nobody able to repair a school's data.
--
-- ROLLBACK
--   Re-run the grade policies and RPCs from migration 104.
-- ============================================================

-- ── Write policies ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "grades_staff_insert" ON grades;
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
    ) IN ('teacher','principal','vice_principal','admin_staff','super_admin')
  );

DROP POLICY IF EXISTS "grades_staff_update" ON grades;
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
    ) IN ('teacher','principal','vice_principal','admin_staff','super_admin')
  )
  WITH CHECK (
    school_id = (
      current_setting('request.jwt.claims', true)::jsonb
      ->'app_metadata'->>'school_id'
    )::uuid
    AND (
      current_setting('request.jwt.claims', true)::jsonb
      ->'app_metadata'->>'role'
    ) IN ('teacher','principal','vice_principal','admin_staff','super_admin')
  );

DROP POLICY IF EXISTS "grades_admin_delete" ON grades;
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
    ) IN ('principal','vice_principal','admin_staff','super_admin')
  );


-- ── Approval RPCs ───────────────────────────────────────────────────────────
-- Bodies reproduced from 104 unchanged apart from the role list.

CREATE OR REPLACE FUNCTION submit_grades_for_approval(p_grade_ids UUID[])
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
    'teacher','principal','vice_principal','admin_staff','super_admin'
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


CREATE OR REPLACE FUNCTION approve_grades(p_grade_ids UUID[], p_approved_by UUID)
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
    'principal','vice_principal','admin_staff','super_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only school leadership may approve grades';
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


CREATE OR REPLACE FUNCTION reject_grades(p_grade_ids UUID[], p_approved_by UUID, p_reason TEXT)
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
    'principal','vice_principal','admin_staff','super_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only school leadership may reject grades';
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

NOTIFY pgrst, 'reload schema';
