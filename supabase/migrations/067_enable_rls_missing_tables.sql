-- Migration 067: Enable RLS on the three tables flagged by Supabase Security Advisor
-- Run this in: Supabase Dashboard → SQL Editor → New query
--
-- Tables fixed:
--   • system_logs      — platform-wide logs, no school_id, super_admin only
--   • webhook_events   — internal webhook queue, service_role only
--   • email_verifications — OTP codes, all access via SECURITY DEFINER RPCs only

-- ─────────────────────────────────────────────────────────────
-- 1. system_logs
--    No school_id column — this is platform-level.
--    Only super_admin can read. Nobody can insert/update/delete directly.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system_logs_super_admin_select" ON system_logs;
CREATE POLICY "system_logs_super_admin_select"
  ON system_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
       WHERE auth_id = auth.uid()
         AND role = 'super_admin'
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 2. webhook_events
--    Internal queue — no direct user access.
--    service_role (used by Edge Functions / cron) bypasses RLS by default.
--    Authenticated users get no access.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- No policies = no authenticated user can access directly.
-- service_role still has full access (it bypasses RLS).

-- ─────────────────────────────────────────────────────────────
-- 3. email_verifications
--    Contains OTP codes — extremely sensitive.
--    All legitimate access goes through SECURITY DEFINER RPCs
--    (send_otp_email, verify_otp_code). Direct table access blocked.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.email_verifications ENABLE ROW LEVEL SECURITY;

-- No policies = no authenticated user can access directly.
-- The SECURITY DEFINER functions (send_otp_email, verify_otp_code)
-- run as postgres and bypass RLS — they still work fine.

NOTIFY pgrst, 'reload schema';
