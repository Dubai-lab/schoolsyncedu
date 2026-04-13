-- ============================================================
-- Migration 054: Fix subscription expiry flow
--   trial/active expires → grace period first
--   grace expires → suspended + school offline
-- ============================================================

-- Rewrite auto_expire_subscriptions() with proper 3-step flow:
--   1. trial/active expired + plan has grace_days → move to 'grace'
--   2. trial/active expired + plan has NO grace → suspend immediately
--   3. grace expired → suspend + take offline
CREATE OR REPLACE FUNCTION auto_expire_subscriptions()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_graced    INTEGER := 0;
  v_suspended INTEGER := 0;
BEGIN
  -- ── STEP 1: trial/active → grace (when plan has grace days) ──────────────
  WITH to_grace AS (
    UPDATE subscriptions s
    SET
      status               = 'grace',
      grace_days_remaining = sp.grace_days,
      expires_at           = NOW() + (sp.grace_days || ' days')::INTERVAL
    FROM subscription_plans sp
    WHERE s.plan_id    = sp.id
      AND s.status     IN ('trial', 'active')
      AND s.expires_at < NOW()
      AND sp.grace_days > 0
    RETURNING s.id
  )
  SELECT COUNT(*) INTO v_graced FROM to_grace;

  -- ── STEP 2: trial/active → suspended (plan has 0 grace days) ─────────────
  WITH no_grace AS (
    UPDATE subscriptions s
    SET
      status            = 'suspended',
      suspended_at      = NOW(),
      suspension_reason = 'Subscription expired — no grace period'
    FROM subscription_plans sp
    WHERE s.plan_id    = sp.id
      AND s.status     IN ('trial', 'active')
      AND s.expires_at < NOW()
      AND sp.grace_days = 0
    RETURNING s.school_id
  )
  UPDATE schools
  SET is_online = false, updated_at = NOW()
  WHERE id IN (SELECT school_id FROM no_grace)
    AND is_online = true;

  -- ── STEP 3: grace expired → suspended + offline ───────────────────────────
  WITH grace_done AS (
    UPDATE subscriptions
    SET
      status            = 'suspended',
      suspended_at      = NOW(),
      suspension_reason = 'Grace period expired — subscription not renewed'
    WHERE status     = 'grace'
      AND expires_at < NOW()
    RETURNING school_id
  )
  UPDATE schools
  SET is_online = false, updated_at = NOW()
  WHERE id IN (SELECT school_id FROM grace_done)
    AND is_online = true;

  GET DIAGNOSTICS v_suspended = ROW_COUNT;
  RETURN v_graced + v_suspended;
END;
$$;

-- ============================================================
-- HOW TO SCHEDULE (run once in Supabase SQL editor)
-- ============================================================
-- Requires pg_cron extension (enabled by default on Supabase).
--
-- 1. Hourly expiry check:
--    SELECT cron.schedule(
--      'auto-expire-subscriptions',
--      '0 * * * *',
--      'SELECT auto_expire_subscriptions()'
--    );
--
-- 2. Daily notification emails at 08:00 UTC (requires pg_net):
--    SELECT cron.schedule(
--      'subscription-notifications',
--      '0 8 * * *',
--      $$
--        SELECT net.http_post(
--          url     := current_setting('app.supabase_functions_url') || '/process-subscription-notifications',
--          headers := jsonb_build_object(
--            'Content-Type',  'application/json',
--            'Authorization', 'Bearer ' || current_setting('app.supabase_service_key')
--          ),
--          body    := '{}'::jsonb
--        );
--      $$
--    );
--
-- OR: Use Supabase Dashboard → Edge Functions → Schedule
--     to call process-subscription-notifications daily at 08:00.
-- ============================================================
