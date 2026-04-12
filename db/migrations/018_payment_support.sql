-- ============================================================
-- Migration 018: Payment page support
-- RPC to fetch payment info for unauthenticated payment page
-- and to record a successful payment.
-- ============================================================

-- 1. RPC to fetch school + subscription + plan for the payment page
-- This is called by anon users who just registered but signed out.
-- Only returns limited data needed for the payment screen.
CREATE OR REPLACE FUNCTION get_payment_info(
  p_school_id UUID,
  p_email     TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school   RECORD;
  v_user     RECORD;
  v_sub      RECORD;
  v_plan     RECORD;
BEGIN
  -- Fetch school
  SELECT id, name INTO v_school
  FROM schools WHERE id = p_school_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'School not found';
  END IF;

  -- Fetch the owner user
  SELECT email, full_name, phone INTO v_user
  FROM users
  WHERE school_id = p_school_id AND email = lower(p_email)
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Fetch the latest trial/grace subscription
  SELECT s.id, s.plan_id, s.status, s.started_at, s.expires_at
  INTO v_sub
  FROM subscriptions s
  WHERE s.school_id = p_school_id AND s.status IN ('trial', 'grace')
  ORDER BY s.created_at DESC
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No pending subscription found';
  END IF;

  -- Fetch the plan details
  SELECT p.id, p.name, p.slug, p.description, p.price_usd, p.billing_cycle,
         p.student_limit, p.features, p.trial_days
  INTO v_plan
  FROM subscription_plans p WHERE p.id = v_sub.plan_id;

  RETURN jsonb_build_object(
    'school', jsonb_build_object('id', v_school.id, 'name', v_school.name),
    'owner',  jsonb_build_object('email', v_user.email, 'name', v_user.full_name, 'phone', COALESCE(v_user.phone, '')),
    'subscription', jsonb_build_object('id', v_sub.id, 'status', v_sub.status, 'plan_id', v_sub.plan_id),
    'plan', jsonb_build_object(
      'id', v_plan.id, 'name', v_plan.name, 'slug', v_plan.slug,
      'description', v_plan.description, 'price_usd', v_plan.price_usd,
      'billing_cycle', v_plan.billing_cycle, 'student_limit', v_plan.student_limit,
      'features', v_plan.features, 'trial_days', v_plan.trial_days
    )
  );
END;
$$;

-- Allow anon (unauthenticated payment page) and authenticated
GRANT EXECUTE ON FUNCTION get_payment_info(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_payment_info(UUID, TEXT) TO authenticated;


-- 2. RPC to record a successful payment and activate the subscription.
-- Called from the frontend after Flutterwave returns success.
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
    RETURN jsonb_build_object('success', true, 'message', 'Already active');
  END IF;

  -- Record the platform payment
  INSERT INTO platform_payments (
    school_id, subscription_id, amount_usd, amount_lrd,
    currency_charged, payment_method, gateway_ref, status
  ) VALUES (
    p_school_id, p_subscription_id, p_amount_usd, 0,
    'USD', p_payment_method, p_gateway_ref, 'success'
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
    p_subscription_id, v_sub.status::subscription_status, 'active'::subscription_status, 'Payment received: ' || p_gateway_ref, NOW()
  );

  -- Create a paid invoice
  v_invoice_number := 'INV-' || UPPER(LEFT(p_school_id::text, 6)) || '-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 9999)::text, 4, '0');

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

-- Allow anon and authenticated (payment page is unauthenticated)
GRANT EXECUTE ON FUNCTION record_subscription_payment(UUID, UUID, DECIMAL, TEXT, TEXT, payment_method) TO anon;
GRANT EXECUTE ON FUNCTION record_subscription_payment(UUID, UUID, DECIMAL, TEXT, TEXT, payment_method) TO authenticated;

NOTIFY pgrst, 'reload schema';
