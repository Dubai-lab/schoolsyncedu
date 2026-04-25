-- ============================================================
-- Migration 081: Fix record_subscription_payment to handle
--                renewals and plan upgrades (not just activation)
-- ============================================================

-- Add plan_id column to mtn_payment_requests (tracks which plan was selected)
ALTER TABLE mtn_payment_requests
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES subscription_plans(id);

-- Add optional p_new_plan_id parameter so payments can switch plans.
-- Remove the "already active → do nothing" guard so renewals/upgrades work.

CREATE OR REPLACE FUNCTION record_subscription_payment(
  p_school_id       UUID,
  p_subscription_id UUID,
  p_amount_usd      DECIMAL,
  p_gateway_ref     TEXT,
  p_tx_ref          TEXT,
  p_payment_method  payment_method DEFAULT 'visa',
  p_new_plan_id     UUID           DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub            RECORD;
  v_plan           RECORD;
  v_invoice_number TEXT;
  v_previous_status subscription_status;
BEGIN
  -- Verify the subscription exists and belongs to the school
  SELECT s.*, sp.billing_cycle, sp.id AS current_plan_id
  INTO v_sub
  FROM subscriptions s
  JOIN subscription_plans sp ON sp.id = s.plan_id
  WHERE s.id = p_subscription_id AND s.school_id = p_school_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found';
  END IF;

  v_previous_status := v_sub.status;

  -- Resolve which plan to use (new plan for upgrade, current plan for renewal)
  IF p_new_plan_id IS NOT NULL THEN
    SELECT * INTO v_plan FROM subscription_plans WHERE id = p_new_plan_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Plan not found: %', p_new_plan_id;
    END IF;
  ELSE
    SELECT * INTO v_plan FROM subscription_plans WHERE id = v_sub.current_plan_id;
  END IF;

  -- Record the platform payment
  INSERT INTO platform_payments (
    school_id, subscription_id, amount_usd, amount_lrd,
    currency_charged, payment_method, gateway_ref, status
  ) VALUES (
    p_school_id, p_subscription_id, p_amount_usd, 0,
    'USD', p_payment_method, p_gateway_ref, 'success'
  );

  -- Activate / renew / upgrade the subscription
  UPDATE subscriptions
  SET
    status         = 'active'::subscription_status,
    plan_id        = v_plan.id,
    started_at     = NOW(),
    expires_at     = CASE
      WHEN v_plan.billing_cycle = 'monthly' THEN NOW() + INTERVAL '1 month'
      WHEN v_plan.billing_cycle = 'yearly'  THEN NOW() + INTERVAL '1 year'
      ELSE NOW() + INTERVAL '1 year'
    END,
    payment_method       = p_payment_method,
    suspended_at         = NULL,
    suspension_reason    = NULL,
    grace_days_remaining = 0
  WHERE id = p_subscription_id;

  -- Bring school online if it was suspended
  UPDATE schools
  SET is_online = true, updated_at = NOW()
  WHERE id = p_school_id AND is_online = false;

  -- Record status change in history
  INSERT INTO subscription_history (
    subscription_id, previous_status, new_status, reason, changed_at
  ) VALUES (
    p_subscription_id,
    v_previous_status,
    'active'::subscription_status,
    'Payment received: ' || p_gateway_ref ||
      CASE WHEN p_new_plan_id IS NOT NULL THEN ' (plan changed to ' || v_plan.name || ')' ELSE '' END,
    NOW()
  );

  -- Create paid invoice
  v_invoice_number := 'INV-' ||
    UPPER(LEFT(p_school_id::text, 6)) || '-' ||
    TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
    LPAD(FLOOR(RANDOM() * 9999)::text, 4, '0');

  INSERT INTO billing_invoices (
    school_id, subscription_id, invoice_number,
    amount_usd, amount_lrd, status, due_date, paid_at
  ) VALUES (
    p_school_id, p_subscription_id, v_invoice_number,
    p_amount_usd, 0, 'paid', CURRENT_DATE, NOW()
  );

  RETURN jsonb_build_object(
    'success',        true,
    'invoice_number', v_invoice_number,
    'status',         'active',
    'plan_name',      v_plan.name
  );
END;
$$;

-- Re-grant permissions (replacing the function drops the old grants)
GRANT EXECUTE ON FUNCTION record_subscription_payment(UUID, UUID, DECIMAL, TEXT, TEXT, payment_method, UUID) TO anon;
GRANT EXECUTE ON FUNCTION record_subscription_payment(UUID, UUID, DECIMAL, TEXT, TEXT, payment_method, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
