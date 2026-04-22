-- Migration 078: Add missing RLS policies on tables that have RLS enabled but no policies
-- Fixes Supabase Advisor "RLS enabled but no policies exist" warnings.

-- ── 1. incident_actions ───────────────────────────────────────────────────────
-- School staff can manage actions for incidents belonging to their school.
DROP POLICY IF EXISTS incident_actions_tenant ON incident_actions;
CREATE POLICY incident_actions_tenant ON incident_actions
  FOR ALL USING (
    incident_id IN (
      SELECT si.id FROM student_incidents si
      JOIN students s ON si.student_id = s.id
      WHERE s.school_id = auth_school_id()
    )
    OR is_super_admin()
  )
  WITH CHECK (
    incident_id IN (
      SELECT si.id FROM student_incidents si
      JOIN students s ON si.student_id = s.id
      WHERE s.school_id = auth_school_id()
    )
    OR is_super_admin()
  );

-- ── 2. platform_notifications_log ─────────────────────────────────────────────
-- System-level log written by SECURITY DEFINER functions.
-- Only super_admin should be able to read it directly.
DROP POLICY IF EXISTS platform_notifications_log_admin ON platform_notifications_log;
CREATE POLICY platform_notifications_log_admin ON platform_notifications_log
  FOR ALL USING (is_super_admin());

-- ── 3. email_verifications ────────────────────────────────────────────────────
-- Accessed exclusively via SECURITY DEFINER RPCs (store_otp, verify_otp, etc.)
-- which bypass RLS. Direct table access is blocked for all non-super-admin users.
DROP POLICY IF EXISTS email_verifications_rpc_only ON email_verifications;
CREATE POLICY email_verifications_rpc_only ON email_verifications
  FOR ALL USING (is_super_admin());

NOTIFY pgrst, 'reload schema';
