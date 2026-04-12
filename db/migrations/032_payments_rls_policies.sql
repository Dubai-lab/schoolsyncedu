-- ============================================================
-- Migration 032: Add missing INSERT / UPDATE policies for
-- payments and student_fees so finance staff can record payments.
--
-- Root cause: migration 002 created SELECT-only policies for
-- payments and student_fees. No INSERT or UPDATE policies were
-- ever added, causing 403 Forbidden on any write attempt.
-- ============================================================

-- ── payments ─────────────────────────────────────────────────

-- SELECT: re-create using auth_user_role() / auth_school_id()
-- (migration 002 used the old auth.uid() pattern)
DROP POLICY IF EXISTS payments_select_policy ON payments;
CREATE POLICY payments_select_policy ON payments
  FOR SELECT USING (
    -- Students see only their own payments
    (auth_user_role() = 'student'::user_role AND student_id = auth_student_id())
    OR
    -- Finance & admin staff see all payments in their school
    (school_id = auth_school_id()
      AND auth_user_role() IN (
        'bursar'::user_role, 'admin_staff'::user_role,
        'principal'::user_role, 'vice_principal'::user_role,
        'registrar'::user_role, 'proprietor'::user_role
      )
    )
    OR is_super_admin()
  );

-- INSERT: finance staff may record payments for their school
DROP POLICY IF EXISTS payments_insert_policy ON payments;
CREATE POLICY payments_insert_policy ON payments
  FOR INSERT WITH CHECK (
    school_id = auth_school_id()
    AND auth_user_role() IN (
      'bursar'::user_role, 'admin_staff'::user_role,
      'principal'::user_role, 'vice_principal'::user_role,
      'registrar'::user_role
    )
    OR is_super_admin()
  );

-- UPDATE: allow status corrections (e.g. marking as refunded)
DROP POLICY IF EXISTS payments_update_policy ON payments;
CREATE POLICY payments_update_policy ON payments
  FOR UPDATE USING (
    school_id = auth_school_id()
    AND auth_user_role() IN (
      'bursar'::user_role, 'admin_staff'::user_role,
      'principal'::user_role
    )
    OR is_super_admin()
  );

-- ── student_fees ──────────────────────────────────────────────

-- INSERT: finance staff assign fees to students
DROP POLICY IF EXISTS student_fees_insert_policy ON student_fees;
CREATE POLICY student_fees_insert_policy ON student_fees
  FOR INSERT WITH CHECK (
    school_id = auth_school_id()
    AND auth_user_role() IN (
      'bursar'::user_role, 'admin_staff'::user_role,
      'principal'::user_role, 'vice_principal'::user_role,
      'registrar'::user_role
    )
    OR is_super_admin()
  );

-- UPDATE: recordPayment updates amount_paid / balance / status
DROP POLICY IF EXISTS student_fees_update_policy ON student_fees;
CREATE POLICY student_fees_update_policy ON student_fees
  FOR UPDATE USING (
    school_id = auth_school_id()
    AND auth_user_role() IN (
      'bursar'::user_role, 'admin_staff'::user_role,
      'principal'::user_role, 'vice_principal'::user_role,
      'registrar'::user_role
    )
    OR is_super_admin()
  );

-- DELETE: principal/bursar may remove incorrectly assigned fees
DROP POLICY IF EXISTS student_fees_delete_policy ON student_fees;
CREATE POLICY student_fees_delete_policy ON student_fees
  FOR DELETE USING (
    school_id = auth_school_id()
    AND auth_user_role() IN (
      'bursar'::user_role, 'admin_staff'::user_role,
      'principal'::user_role
    )
    OR is_super_admin()
  );

NOTIFY pgrst, 'reload schema';
