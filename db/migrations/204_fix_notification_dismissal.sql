-- ============================================================
-- Migration 204: Notifications that stay deleted
--
-- Symptom: dismissing a notification from the bell removes it from view, but
-- it reappears on the next page load. Two unrelated causes produce it.
--
-- CAUSE 1 — every non-super-admin user
--   user_notifications has SELECT, UPDATE and INSERT policies but no DELETE
--   policy (migration 056). With RLS on, a user's delete matches zero rows.
--   Postgres does not raise an error for a DELETE that affects nothing, so the
--   call "succeeds", the UI removes the row from local state, and the next
--   fetch brings it straight back.
--
-- CAUSE 2 — super admin
--   Handled in the frontend: NotificationBell skipped the delete call entirely
--   for super_admin. That is fixed alongside this migration, but it needed
--   somewhere to write to — see below.
--
-- Why super admin does not simply DELETE
--   Its bell reads notification_logs, which is the platform's record of every
--   email ever sent (welcome, trial reminders, suspensions, payment
--   confirmations). Deleting rows to tidy a dropdown would destroy that audit
--   trail permanently. Dismissal is a view-level concern, so it gets its own
--   column and the log stays intact.
-- ============================================================


-- ============================================================
-- 1. DELETE POLICY FOR OWN NOTIFICATIONS
--    Mirrors notif_own_select / notif_own_update from migration 056.
-- ============================================================

DROP POLICY IF EXISTS "notif_own_delete" ON user_notifications;
CREATE POLICY "notif_own_delete" ON user_notifications
  FOR DELETE USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1)
  );


-- ============================================================
-- 2. DISMISSAL FOR THE SUPER ADMIN BELL
--    Nullable timestamp rather than a boolean: knowing WHEN something was
--    dismissed is useful in an audit table, and NULL reads naturally as
--    "still showing".
-- ============================================================

ALTER TABLE notification_logs
  ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ;

-- The bell lists only undismissed rows, so index exactly that set.
CREATE INDEX IF NOT EXISTS idx_notif_log_active
  ON notification_logs(sent_at DESC)
  WHERE dismissed_at IS NULL;


-- ============================================================
-- 3. DISMISS RPCs
--    SECURITY DEFINER with an explicit super_admin check, so the bell cannot
--    be used to hide another role's audit rows.
-- ============================================================

CREATE OR REPLACE FUNCTION dismiss_notification_log(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Not permitted.');
  END IF;

  UPDATE notification_logs
  SET    dismissed_at = now()
  WHERE  id = p_id
    AND  dismissed_at IS NULL;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION dismiss_notification_log(UUID) TO authenticated;


-- Clear-all, so a super admin with months of backlog is not clicking one by one.
CREATE OR REPLACE FUNCTION dismiss_all_notification_logs()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Not permitted.');
  END IF;

  UPDATE notification_logs
  SET    dismissed_at = now()
  WHERE  dismissed_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'dismissed', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION dismiss_all_notification_logs() TO authenticated;

NOTIFY pgrst, 'reload schema';


-- ============================================================
-- 4. VERIFICATION
--
--   -- The delete policy now exists:
--   SELECT policyname, cmd FROM pg_policies
--   WHERE tablename = 'user_notifications' AND cmd = 'DELETE';
--
--   -- Column added:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'notification_logs' AND column_name = 'dismissed_at';
--
--   -- Nothing dismissed yet, so the bell shows the same rows as before:
--   SELECT count(*) FROM notification_logs WHERE dismissed_at IS NULL;
-- ============================================================
