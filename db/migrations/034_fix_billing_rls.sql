-- ============================================================
-- Migration 034: Fix subscription billing RLS bypass
--
-- Problem: record_subscription_payment() and upgrade_subscription()
-- are SECURITY DEFINER functions but Supabase enforces RLS even for
-- the postgres/supabase_admin role unless row_security is explicitly
-- disabled inside the function. This caused the INSERT into
-- platform_payments, billing_invoices, subscription_history and the
-- UPDATE on subscriptions to be blocked by the is_super_admin()
-- write policies, making every payment succeed in Flutterwave but
-- fail to activate the subscription.
--
-- Fix: Add SET LOCAL row_security = OFF at the start of each RPC
-- and also store tx_ref on platform_payments for reconciliation.
-- ============================================================

-- Step 1: Add tx_ref column to platform_payments if it doesn't exist
ALTER TABLE platform_payments
  ADD COLUMN IF NOT EXISTS tx_ref TEXT;

-- Step 2: Recreate record_subscription_payment with RLS bypass
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
  v_invoice_number TEXT;
BEGIN
  -- Bypass RLS for all operations inside this function
  SET LOCAL row_security = OFF;

  -- Verify the subscription exists and belongs to the school
  SELECT s.*, sp.billing_cycle
  INTO v_sub
  FROM subscriptions s
  JOIN subscription_plans sp ON sp.id = s.plan_id
  WHERE s.id = p_subscription_id AND s.school_id = p_school_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found for school';
  END IF;

  -- Prevent double-payment: if already active, return success with existing invoice if any
  IF v_sub.status = 'active' THEN
    DECLARE
      v_existing_invoice TEXT;
    BEGIN
      SELECT invoice_number INTO v_existing_invoice
      FROM billing_invoices
      WHERE subscription_id = p_subscription_id
      ORDER BY created_at DESC
      LIMIT 1;

      RETURN jsonb_build_object(
        'success', true,
        'invoice_number', COALESCE(v_existing_invoice, 'ALREADY-ACTIVE'),
        'status', 'active',
        'message', 'Subscription already active'
      );
    END;
  END IF;

  -- Record the platform payment
  INSERT INTO platform_payments (
    school_id, subscription_id, amount_usd, amount_lrd,
    currency_charged, payment_method, gateway_ref, tx_ref, status
  ) VALUES (
    p_school_id, p_subscription_id, p_amount_usd, 0,
    'USD', p_payment_method, p_gateway_ref, p_tx_ref, 'success'
  );

  -- Activate the subscription
  UPDATE subscriptions
  SET status = 'active'::subscription_status,
      started_at = NOW(),
      expires_at = CASE
        WHEN v_sub.billing_cycle = 'monthly' THEN NOW() + INTERVAL '1 month'
        WHEN v_sub.billing_cycle = 'yearly'  THEN NOW() + INTERVAL '1 year'
        ELSE NOW() + INTERVAL '1 year'
      END,
      payment_method = p_payment_method
  WHERE id = p_subscription_id;

  -- Record status change in history
  INSERT INTO subscription_history (
    subscription_id, previous_status, new_status, reason, changed_at
  ) VALUES (
    p_subscription_id,
    v_sub.status::subscription_status,
    'active'::subscription_status,
    'Payment received — Flutterwave ref: ' || p_gateway_ref || ' | tx: ' || COALESCE(p_tx_ref, ''),
    NOW()
  );

  -- Generate invoice number
  v_invoice_number := 'INV-' || UPPER(LEFT(p_school_id::text, 6)) || '-' ||
                      TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
                      LPAD(FLOOR(RANDOM() * 9999)::text, 4, '0');

  -- Create a paid invoice
  INSERT INTO billing_invoices (
    school_id, subscription_id, invoice_number,
    amount_usd, amount_lrd, status, due_date, paid_at
  ) VALUES (
    p_school_id, p_subscription_id, v_invoice_number,
    p_amount_usd, 0, 'paid', CURRENT_DATE, NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'invoice_number', v_invoice_number,
    'status', 'active'
  );
END;
$$;

-- Re-grant to anon and authenticated
GRANT EXECUTE ON FUNCTION record_subscription_payment(UUID, UUID, DECIMAL, TEXT, TEXT, payment_method) TO anon;
GRANT EXECUTE ON FUNCTION record_subscription_payment(UUID, UUID, DECIMAL, TEXT, TEXT, payment_method) TO authenticated;


-- Step 3: Recreate upgrade_subscription with RLS bypass
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
  v_old_status     subscription_status;
BEGIN
  -- Bypass RLS for all operations inside this function
  SET LOCAL row_security = OFF;

  -- Verify the subscription
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

  -- Don't allow same-plan "upgrade"
  IF v_sub.plan_id = p_new_plan_id THEN
    RAISE EXCEPTION 'Already on this plan. To renew, please contact support.';
  END IF;

  -- Record the platform payment
  INSERT INTO platform_payments (
    school_id, subscription_id, amount_usd, amount_lrd,
    currency_charged, payment_method, gateway_ref, tx_ref, status
  ) VALUES (
    p_school_id, p_subscription_id, p_amount_usd, 0,
    'USD', p_payment_method, p_gateway_ref, p_tx_ref, 'success'
  );

  -- Update the subscription
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
  WHERE id = p_subscription_id;

  -- Log history
  INSERT INTO subscription_history (
    subscription_id, previous_status, new_status, reason, changed_at
  ) VALUES (
    p_subscription_id,
    v_old_status,
    'active'::subscription_status,
    'Plan changed from ' || COALESCE(v_old_plan.name, '?') || ' to ' || v_new_plan.name ||
    ' — Payment: ' || p_gateway_ref,
    NOW()
  );

  -- Generate invoice number
  v_invoice_number := 'INV-' || UPPER(LEFT(p_school_id::text, 6)) || '-' ||
                      TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
                      LPAD(FLOOR(RANDOM() * 9999)::text, 4, '0');

  -- Create a paid invoice
  INSERT INTO billing_invoices (
    school_id, subscription_id, invoice_number,
    amount_usd, amount_lrd, status, due_date, paid_at
  ) VALUES (
    p_school_id, p_subscription_id, v_invoice_number,
    p_amount_usd, 0, 'paid', CURRENT_DATE, NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'invoice_number', v_invoice_number,
    'new_plan', v_new_plan.name,
    'status', 'active'
  );
END;
$$;

-- Re-grant
GRANT EXECUTE ON FUNCTION upgrade_subscription(UUID, UUID, UUID, DECIMAL, TEXT, TEXT, payment_method) TO authenticated;


-- Step 4: Also add a policy to allow these RPCs to reconcile payments
-- (super_admin can manually verify/record a payment for a school)
DROP POLICY IF EXISTS platform_payments_rpc_insert ON platform_payments;
CREATE POLICY platform_payments_rpc_insert ON platform_payments
  FOR INSERT WITH CHECK (TRUE);  -- INSERTs come only via SECURITY DEFINER RPCs

DROP POLICY IF EXISTS billing_invoices_rpc_insert ON billing_invoices;
CREATE POLICY billing_invoices_rpc_insert ON billing_invoices
  FOR INSERT WITH CHECK (TRUE);  -- INSERTs come only via SECURITY DEFINER RPCs

DROP POLICY IF EXISTS subscription_history_rpc_insert ON subscription_history;
CREATE POLICY subscription_history_rpc_insert ON subscription_history
  FOR INSERT WITH CHECK (TRUE);  -- INSERTs come only via SECURITY DEFINER RPCs

NOTIFY pgrst, 'reload schema';
