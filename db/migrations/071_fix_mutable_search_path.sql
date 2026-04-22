-- Migration 071: Fix mutable search_path warnings on 3 functions
-- Adds SET search_path = public to prevent search_path injection risk.

-- ── 1. auto_expire_subscriptions ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.auto_expire_subscriptions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_graced    INTEGER := 0;
  v_suspended INTEGER := 0;
BEGIN
  -- STEP 1: trial/active → grace (when plan has grace days)
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

  -- STEP 2: trial/active → suspended (plan has 0 grace days)
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

  -- STEP 3: grace expired → suspended + offline
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

-- ── 2. ensure_single_default_token ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ensure_single_default_token()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE saved_payment_tokens
    SET is_default = false
    WHERE school_id = NEW.school_id
      AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- ── 3. sync_student_fee_balance ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_student_fee_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.balance := NEW.amount_due - COALESCE(NEW.amount_paid, 0);
  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
