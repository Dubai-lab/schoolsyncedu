-- Migration 074: Return expires_at from record_subscription_payment RPC
-- Run this in: Supabase Dashboard → SQL Editor → New query
--
-- Problem: record_subscription_payment calculates and stores expires_at but
-- never returns it. The client-side billing email needs this value, and the
-- payment page is unauthenticated so it cannot read the subscriptions table
-- directly (RLS blocks anon reads). This fixes the function to include
-- expires_at in its return JSON.

CREATE OR REPLACE FUNCTION record_subscription_payment(
  p_school_id       UUID,
  p_subscription_id UUID,
  p_amount_usd      DECIMAL,
  p_gateway_ref     TEXT,
  p_tx_ref          TEXT,
  p_payment_method  payment_method DEFAULT 'visa'
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
  v_expires_at     TIMESTAMPTZ;
BEGIN
  -- Verify the subscription exists and belongs to the school
  SELECT s.*, sp.billing_cycle
  INTO v_sub
  FROM subscriptions s
  JOIN subscription_plans sp ON sp.id = s.plan_id
  WHERE s.id = p_subscription_id AND s.school_id = p_school_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found';
  END IF;

  -- Prevent double-payment
  IF v_sub.status = 'active' THEN
    -- Return existing expires_at so the email still shows the correct date
    RETURN jsonb_build_object(
      'success',        true,
      'message',        'Already active',
      'invoice_number', '',
      'expires_at',     v_sub.expires_at
    );
  END IF;

  -- Record the platform payment
  INSERT INTO platform_payments (
    school_id, subscription_id, amount_usd, amount_lrd,
    currency_charged, payment_method, gateway_ref, status, tx_ref
  ) VALUES (
    p_school_id, p_subscription_id, p_amount_usd, 0,
    'USD', p_payment_method, p_gateway_ref, 'success', p_tx_ref
  );

  -- Activate the subscription and capture the new expires_at
  UPDATE subscriptions
  SET status     = 'active'::subscription_status,
      started_at = NOW(),
      expires_at = CASE
        WHEN v_sub.billing_cycle = 'monthly' THEN NOW() + INTERVAL '1 month'
        WHEN v_sub.billing_cycle = 'yearly'  THEN NOW() + INTERVAL '1 year'
        ELSE NOW() + INTERVAL '1 year'
      END,
      payment_method = p_payment_method
  WHERE id = p_subscription_id
  RETURNING expires_at INTO v_expires_at;

  -- Record status change in history
  INSERT INTO subscription_history (
    subscription_id, previous_status, new_status, reason, changed_at
  ) VALUES (
    p_subscription_id,
    v_sub.status::subscription_status,
    'active'::subscription_status,
    'Payment received: ' || p_gateway_ref,
    NOW()
  );

  -- Create a paid invoice
  v_invoice_number := 'INV-'
    || UPPER(LEFT(p_school_id::text, 6))
    || '-' || TO_CHAR(NOW(), 'YYYYMMDD')
    || '-' || LPAD(FLOOR(RANDOM() * 9999)::text, 4, '0');

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
    'expires_at',     v_expires_at
  );
END;
$$;

-- Preserve existing grants
GRANT EXECUTE ON FUNCTION record_subscription_payment(UUID, UUID, DECIMAL, TEXT, TEXT, payment_method) TO anon;
GRANT EXECUTE ON FUNCTION record_subscription_payment(UUID, UUID, DECIMAL, TEXT, TEXT, payment_method) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- Also fix upgrade_subscription to return expires_at
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION upgrade_subscription(
  p_school_id       UUID,
  p_subscription_id UUID,
  p_new_plan_id     UUID,
  p_amount_usd      DECIMAL,
  p_gateway_ref     TEXT,
  p_tx_ref          TEXT,
  p_payment_method  payment_method DEFAULT 'visa'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub            RECORD;
  v_old_plan       RECORD;
  v_new_plan       RECORD;
  v_invoice_number TEXT;
  v_old_status     TEXT;
  v_expires_at     TIMESTAMPTZ;
BEGIN
  -- Verify the subscription exists and belongs to the school
  SELECT s.*
  INTO v_sub
  FROM subscriptions s
  WHERE s.id = p_subscription_id AND s.school_id = p_school_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found';
  END IF;

  v_old_status := v_sub.status;

  -- Get old plan name for history
  SELECT name INTO v_old_plan
  FROM subscription_plans WHERE id = v_sub.plan_id;

  -- Validate new plan
  SELECT id, name, billing_cycle, price_usd
  INTO v_new_plan
  FROM subscription_plans
  WHERE id = p_new_plan_id AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected plan not found or inactive';
  END IF;

  -- Don't allow "changing" to the same plan
  IF v_sub.plan_id = p_new_plan_id THEN
    RAISE EXCEPTION 'Already on this plan';
  END IF;

  -- Record the platform payment
  INSERT INTO platform_payments (
    school_id, subscription_id, amount_usd, amount_lrd,
    currency_charged, payment_method, gateway_ref, status, tx_ref
  ) VALUES (
    p_school_id, p_subscription_id, p_amount_usd, 0,
    'USD', p_payment_method, p_gateway_ref, 'success', p_tx_ref
  );

  -- Update the subscription and capture the new expires_at
  UPDATE subscriptions
  SET plan_id        = p_new_plan_id,
      status         = 'active'::subscription_status,
      started_at     = NOW(),
      expires_at     = CASE
        WHEN v_new_plan.billing_cycle = 'monthly' THEN NOW() + INTERVAL '1 month'
        WHEN v_new_plan.billing_cycle = 'yearly'  THEN NOW() + INTERVAL '1 year'
        ELSE NOW() + INTERVAL '1 year'
      END,
      payment_method = p_payment_method
  WHERE id = p_subscription_id
  RETURNING expires_at INTO v_expires_at;

  -- Log history
  INSERT INTO subscription_history (
    subscription_id, previous_status, new_status, reason, changed_at
  ) VALUES (
    p_subscription_id,
    v_old_status::subscription_status,
    'active'::subscription_status,
    'Plan changed from ' || v_old_plan.name || ' to ' || v_new_plan.name || ' — Payment: ' || p_gateway_ref,
    NOW()
  );

  -- Create a paid invoice
  v_invoice_number := 'INV-'
    || UPPER(LEFT(p_school_id::text, 6))
    || '-' || TO_CHAR(NOW(), 'YYYYMMDD')
    || '-' || LPAD(FLOOR(RANDOM() * 9999)::text, 4, '0');

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
    'new_plan',       v_new_plan.name,
    'status',         'active',
    'expires_at',     v_expires_at
  );
END;
$$;

-- Only authenticated proprietors need this
GRANT EXECUTE ON FUNCTION upgrade_subscription(UUID, UUID, UUID, DECIMAL, TEXT, TEXT, payment_method) TO authenticated;

NOTIFY pgrst, 'reload schema';
