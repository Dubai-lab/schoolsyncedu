-- ============================================================
-- Migration 090: Invoice auto-generation + payment confirmation RPC
--
-- generate_invoice_number()  → returns next sequential INV-YYYY-NNNN
-- confirm_subscription_payment() → atomically:
--     1. Activates subscription (sets status=active, new expires_at)
--     2. Creates paid billing_invoice record
--     3. Records platform_payment
--     4. Logs to subscription_history
-- ============================================================

-- ── 1. Auto-generate next invoice number ─────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year TEXT    := TO_CHAR(NOW(), 'YYYY');
  v_seq  INTEGER;
BEGIN
  SELECT COALESCE(
    MAX(CAST(SUBSTRING(invoice_number FROM LENGTH('INV-' || v_year || '-') + 1) AS INTEGER)),
    0
  ) + 1
  INTO v_seq
  FROM billing_invoices
  WHERE invoice_number LIKE 'INV-' || v_year || '-%';

  RETURN 'INV-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION generate_invoice_number() TO authenticated;
GRANT EXECUTE ON FUNCTION generate_invoice_number() TO service_role;

-- ── 2. Confirm payment → activate subscription atomically ─────────────────────
CREATE OR REPLACE FUNCTION confirm_subscription_payment(
  p_school_id      UUID,
  p_amount_usd     DECIMAL(10,2),
  p_amount_lrd     DECIMAL(12,2) DEFAULT NULL,
  p_payment_method TEXT          DEFAULT 'bank',
  p_invoice_number TEXT          DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub_id        UUID;
  v_plan_id       UUID;
  v_prev_status   subscription_status;
  v_billing_cycle billing_cycle;
  v_new_expires   TIMESTAMP;
  v_invoice_num   TEXT;
BEGIN
  -- Get the school's current subscription
  SELECT id, plan_id, status
  INTO v_sub_id, v_plan_id, v_prev_status
  FROM subscriptions
  WHERE school_id = p_school_id
    AND status NOT IN ('cancelled', 'archived')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_sub_id IS NULL THEN
    RAISE EXCEPTION 'No subscription found for school %', p_school_id;
  END IF;

  -- Get billing cycle from plan
  SELECT billing_cycle INTO v_billing_cycle
  FROM subscription_plans WHERE id = v_plan_id;

  -- Calculate new expiry date based on billing cycle
  v_new_expires := CASE v_billing_cycle
    WHEN 'monthly'  THEN NOW() + INTERVAL '30 days'
    WHEN 'yearly'   THEN NOW() + INTERVAL '365 days'
    WHEN 'lifetime' THEN NOW() + INTERVAL '36500 days'
    ELSE                 NOW() + INTERVAL '30 days'
  END;

  -- Auto-generate invoice number if not supplied
  v_invoice_num := COALESCE(NULLIF(TRIM(p_invoice_number), ''), generate_invoice_number());

  -- Activate subscription
  UPDATE subscriptions SET
    status               = 'active',
    expires_at           = v_new_expires,
    grace_days_remaining = 0,
    suspended_at         = NULL,
    suspension_reason    = NULL,
    auto_renew           = TRUE
  WHERE id = v_sub_id;

  -- Bring school back online if it was suspended
  UPDATE schools SET is_online = TRUE, updated_at = NOW()
  WHERE id = p_school_id AND is_online = FALSE;

  -- Create paid billing invoice
  INSERT INTO billing_invoices (
    school_id, subscription_id, invoice_number,
    amount_usd, amount_lrd, status, due_date, paid_at
  ) VALUES (
    p_school_id, v_sub_id, v_invoice_num,
    p_amount_usd, p_amount_lrd, 'paid', NOW()::DATE, NOW()
  );

  -- Record platform payment
  INSERT INTO platform_payments (
    school_id, subscription_id, amount_usd, amount_lrd,
    currency_charged, payment_method, gateway_ref, status
  ) VALUES (
    p_school_id, v_sub_id, p_amount_usd, p_amount_lrd,
    CASE WHEN p_amount_lrd IS NOT NULL AND p_amount_lrd > 0 THEN 'LRD' ELSE 'USD' END,
    p_payment_method::payment_method, v_invoice_num, 'success'
  );

  -- Log to subscription history
  INSERT INTO subscription_history (subscription_id, previous_status, new_status, reason)
  VALUES (v_sub_id, v_prev_status, 'active',
    'Manual payment confirmed by admin — Invoice ' || v_invoice_num);

  RETURN jsonb_build_object(
    'success',        TRUE,
    'invoice_number', v_invoice_num,
    'expires_at',     v_new_expires,
    'subscription_id', v_sub_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION confirm_subscription_payment(UUID, DECIMAL, DECIMAL, TEXT, TEXT) TO service_role;
