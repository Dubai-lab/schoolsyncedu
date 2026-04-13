-- Migration 053: Notification system
-- Adds per-plan notification config + notification_logs table to prevent duplicate sends

-- 1. Per-plan notification schedule (admin configures, system applies to all schools on that plan)
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS notification_config JSONB NOT NULL DEFAULT '{
    "notify_on_trial_start":    true,
    "trial_reminder_days":      [3, 1],
    "notify_on_trial_expired":  true,
    "expiry_reminder_days":     [7, 3, 1],
    "notify_on_grace_start":    true,
    "grace_reminder_days":      [2],
    "notify_on_suspended":      true,
    "notify_on_reactivated":    true
  }'::jsonb;

-- 2. Notification log — one row per (school, event_type, reference_date)
--    Prevents the daily cron from sending the same email twice
CREATE TABLE IF NOT EXISTS notification_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  subscription_id  UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  event_type       TEXT NOT NULL,   -- 'welcome' | 'trial_start' | 'trial_reminder_3' | 'expiry_reminder_7' | 'grace_start' | 'grace_reminder_2' | 'suspended' | 'reactivated' | 'payment_confirmed' | 'payment_failed' | 'staff_welcome'
  recipient_email  TEXT NOT NULL,
  sent_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata         JSONB                               -- extra context (plan name, amount, etc.)
);

CREATE INDEX IF NOT EXISTS idx_notif_log_school_event ON notification_logs(school_id, event_type, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_log_sub          ON notification_logs(subscription_id);

-- RLS
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_log_admin_all" ON notification_logs;
CREATE POLICY "notif_log_admin_all"
  ON notification_logs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid() AND u.role = 'super_admin'
    )
  );

-- 3. Helper: check if a notification was already sent today for a given school + event
CREATE OR REPLACE FUNCTION notification_already_sent(
  p_school_id     UUID,
  p_event_type    TEXT,
  p_within_hours  INTEGER DEFAULT 20   -- window to consider "already sent"
) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM notification_logs
    WHERE school_id    = p_school_id
      AND event_type   = p_event_type
      AND sent_at      > now() - (p_within_hours || ' hours')::interval
  );
$$;
