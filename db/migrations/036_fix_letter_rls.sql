-- ============================================================
-- Migration 036: Fix letter RLS policies
--
-- Problems fixed:
--   1. letter_instances SELECT policy is too narrow — bursar, registrar,
--      and vice_principal can INSERT but the RETURNING clause then hits
--      the SELECT policy and gets 403.
--   2. letter_approvals has RLS ENABLED but ZERO policies — every INSERT
--      (approval decision) is blocked.
--   3. print_queue has RLS ENABLED but ZERO policies — blocked.
-- ============================================================

-- ============================================================
-- 1. LETTER_INSTANCES — drop old policies, replace with correct ones
-- ============================================================

DROP POLICY IF EXISTS letter_instances_select_policy ON letter_instances;
DROP POLICY IF EXISTS letter_instances_insert_policy ON letter_instances;
DROP POLICY IF EXISTS letter_instances_update_policy ON letter_instances;
DROP POLICY IF EXISTS letter_instances_select        ON letter_instances;
DROP POLICY IF EXISTS letter_instances_insert        ON letter_instances;
DROP POLICY IF EXISTS letter_instances_update        ON letter_instances;

-- SELECT: any school staff member in these roles, plus the creator/approver,
-- plus students looking at their own letters.
CREATE POLICY letter_instances_select ON letter_instances
  FOR SELECT USING (
    school_id = (SELECT school_id FROM users WHERE id = auth.uid())
    AND (
      (SELECT role FROM users WHERE id = auth.uid()) IN (
        'principal'::user_role,
        'vice_principal'::user_role,
        'admin_staff'::user_role,
        'teacher'::user_role,
        'dean_of_students'::user_role,
        'registrar'::user_role,
        'bursar'::user_role,
        'it_admin'::user_role
      )
      OR created_by  = auth.uid()
      OR approved_by = auth.uid()
      OR student_id IN (
        SELECT id FROM students WHERE user_id = auth.uid()
      )
    )
  );

-- INSERT: all roles allowed to create letters (including vice_principal)
CREATE POLICY letter_instances_insert ON letter_instances
  FOR INSERT WITH CHECK (
    school_id = (SELECT school_id FROM users WHERE id = auth.uid())
    AND (SELECT role FROM users WHERE id = auth.uid()) IN (
      'principal'::user_role,
      'vice_principal'::user_role,
      'admin_staff'::user_role,
      'teacher'::user_role,
      'dean_of_students'::user_role,
      'registrar'::user_role,
      'bursar'::user_role
    )
  );

-- UPDATE: creator can edit their own drafts; principal/VP can update any
CREATE POLICY letter_instances_update ON letter_instances
  FOR UPDATE USING (
    school_id = (SELECT school_id FROM users WHERE id = auth.uid())
    AND (
      created_by = auth.uid()
      OR (SELECT role FROM users WHERE id = auth.uid()) IN (
        'principal'::user_role, 'vice_principal'::user_role
      )
    )
  );

-- ============================================================
-- 2. LETTER_APPROVALS — add missing policies
-- ============================================================

DROP POLICY IF EXISTS letter_approvals_select ON letter_approvals;
DROP POLICY IF EXISTS letter_approvals_insert ON letter_approvals;
DROP POLICY IF EXISTS letter_approvals_update ON letter_approvals;

-- SELECT: approvers and the original letter creator can see decisions
CREATE POLICY letter_approvals_select ON letter_approvals
  FOR SELECT USING (
    approver_id = auth.uid()
    OR (SELECT role FROM users WHERE id = auth.uid()) IN (
      'principal'::user_role, 'vice_principal'::user_role
    )
    OR letter_instance_id IN (
      SELECT id FROM letter_instances
      WHERE school_id = (SELECT school_id FROM users WHERE id = auth.uid())
        AND created_by = auth.uid()
    )
  );

-- INSERT: only principal / VP can record approval decisions
CREATE POLICY letter_approvals_insert ON letter_approvals
  FOR INSERT WITH CHECK (
    approver_id = auth.uid()
    AND (SELECT role FROM users WHERE id = auth.uid()) IN (
      'principal'::user_role, 'vice_principal'::user_role
    )
  );

-- ============================================================
-- 3. PRINT_QUEUE — add missing policies
-- ============================================================

DROP POLICY IF EXISTS print_queue_select ON print_queue;
DROP POLICY IF EXISTS print_queue_insert ON print_queue;
DROP POLICY IF EXISTS print_queue_update ON print_queue;

CREATE POLICY print_queue_select ON print_queue
  FOR SELECT USING (
    school_id = (SELECT school_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY print_queue_insert ON print_queue
  FOR INSERT WITH CHECK (
    school_id = (SELECT school_id FROM users WHERE id = auth.uid())
    AND (SELECT role FROM users WHERE id = auth.uid()) IN (
      'principal'::user_role, 'vice_principal'::user_role,
      'admin_staff'::user_role, 'registrar'::user_role
    )
  );

CREATE POLICY print_queue_update ON print_queue
  FOR UPDATE USING (
    school_id = (SELECT school_id FROM users WHERE id = auth.uid())
    AND (SELECT role FROM users WHERE id = auth.uid()) IN (
      'principal'::user_role, 'vice_principal'::user_role,
      'admin_staff'::user_role, 'registrar'::user_role
    )
  );
