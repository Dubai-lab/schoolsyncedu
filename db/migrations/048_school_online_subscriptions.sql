-- ============================================================
-- Migration 048: School online/offline control + subscription management
-- ============================================================

-- 1. Add is_online flag to schools (true = accessible, false = suspended)
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS is_online BOOLEAN NOT NULL DEFAULT true;

-- 2. Add subscription management columns
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS grace_days_remaining INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS suspended_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspension_reason    TEXT;

-- 3. Index for quick offline-school lookups
CREATE INDEX IF NOT EXISTS idx_schools_is_online ON schools (is_online) WHERE is_online = false;

-- 4. Helper function: super admin manually suspends a school
CREATE OR REPLACE FUNCTION suspend_school(
  p_school_id UUID,
  p_reason    TEXT DEFAULT 'Subscription expired'
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Mark school offline
  UPDATE schools SET is_online = false, updated_at = NOW() WHERE id = p_school_id;

  -- Update active subscription status to suspended
  UPDATE subscriptions
  SET
    status            = 'suspended',
    suspended_at      = NOW(),
    suspension_reason = p_reason
  WHERE school_id = p_school_id
    AND status    IN ('active', 'trial', 'grace');
END;
$$;

-- 5. Helper function: super admin reactivates a school + adds grace days
CREATE OR REPLACE FUNCTION reactivate_school(
  p_school_id  UUID,
  p_grace_days INTEGER DEFAULT 7
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Bring school back online
  UPDATE schools SET is_online = true, updated_at = NOW() WHERE id = p_school_id;

  -- Extend subscription: push expires_at by grace_days from NOW, reset status
  UPDATE subscriptions
  SET
    status               = 'grace',
    expires_at           = NOW() + (p_grace_days || ' days')::INTERVAL,
    grace_days_remaining = p_grace_days,
    suspended_at         = NULL,
    suspension_reason    = NULL
  WHERE school_id = p_school_id
    AND status    = 'suspended';
END;
$$;

-- 6. Automated expiry check function (call via pg_cron or Supabase scheduled edge function)
--    Sets is_online = false for schools whose subscription + grace period has expired
CREATE OR REPLACE FUNCTION auto_expire_subscriptions()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Suspend subscriptions past their expiry
  WITH expired AS (
    UPDATE subscriptions
    SET
      status            = 'suspended',
      suspended_at      = NOW(),
      suspension_reason = 'Subscription expired automatically'
    WHERE status    IN ('active', 'trial', 'grace')
      AND expires_at < NOW()
    RETURNING school_id
  )
  UPDATE schools
  SET is_online = false, updated_at = NOW()
  WHERE id IN (SELECT school_id FROM expired)
    AND is_online = true;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- INSTRUCTIONS:
-- To enable automatic expiry, run this in Supabase SQL editor (requires pg_cron extension):
--   SELECT cron.schedule('auto-expire-subscriptions', '0 * * * *', 'SELECT auto_expire_subscriptions()');
-- This runs every hour. Alternatively, call auto_expire_subscriptions() from a Supabase Edge Function cron.
