-- ============================================================
-- Migration 035: record_fee_payment SECURITY DEFINER RPC
--
-- Problem: feeService.recordPayment() does direct INSERT into
-- payments and UPDATE on student_fees. Two bugs:
--   1. RLS blocks the INSERT if migration 032 wasn't run, causing
--      the Flutterwave payment to succeed but the record to hang/fail.
--   2. The balance column on student_fees is NEVER updated — only
--      amount_paid and status are set, so the balance stays wrong.
--
-- Fix: A single SECURITY DEFINER function that:
--   - Bypasses RLS (SET LOCAL row_security = OFF)
--   - Inserts the payment record
--   - Updates student_fees: amount_paid, balance, status in one shot
--   - Returns the created payment row as JSONB
-- ============================================================

CREATE OR REPLACE FUNCTION record_fee_payment(
  p_school_id        UUID,
  p_student_id       UUID,
  p_student_fee_id   UUID,
  p_amount_usd       DECIMAL,
  p_amount_lrd       DECIMAL,
  p_currency_charged VARCHAR(10),
  p_payment_method   payment_method,
  p_gateway_ref      TEXT DEFAULT NULL,
  p_recorded_by      UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fee          RECORD;
  v_new_paid     DECIMAL;
  v_new_balance  DECIMAL;
  v_new_status   VARCHAR(50);
  v_paid_amount  DECIMAL;
  v_payment_id   UUID;
  v_payment      RECORD;
BEGIN
  -- Bypass RLS so any authenticated role (bursar, finance, admin) can record
  SET LOCAL row_security = OFF;

  -- Validate the fee exists and belongs to the correct school
  SELECT sf.id, sf.amount_due, sf.amount_paid, sf.balance
  INTO v_fee
  FROM student_fees sf
  JOIN students s ON s.id = sf.student_id
  WHERE sf.id = p_student_fee_id
    AND sf.student_id = p_student_id
    AND s.school_id = p_school_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student fee record not found or does not belong to this school';
  END IF;

  -- Determine how much was actually paid in the base currency (USD preferred)
  v_paid_amount := CASE
    WHEN p_currency_charged = 'USD' THEN p_amount_usd
    ELSE p_amount_lrd
  END;

  -- Calculate new totals
  v_new_paid    := COALESCE(v_fee.amount_paid, 0) + v_paid_amount;
  v_new_balance := GREATEST(COALESCE(v_fee.amount_due, 0) - v_new_paid, 0);
  v_new_status  := CASE
    WHEN v_new_paid >= COALESCE(v_fee.amount_due, 0) THEN 'paid'
    WHEN v_new_paid > 0                               THEN 'partial'
    ELSE 'pending'
  END;

  -- Insert payment record
  INSERT INTO payments (
    school_id, student_id, student_fee_id,
    amount_usd, amount_lrd, currency_charged,
    payment_method, gateway_ref, status,
    recorded_by, payment_date
  ) VALUES (
    p_school_id, p_student_id, p_student_fee_id,
    p_amount_usd, p_amount_lrd, p_currency_charged,
    p_payment_method, p_gateway_ref, 'success',
    p_recorded_by, NOW()
  )
  RETURNING id INTO v_payment_id;

  -- Update student_fees: amount_paid, balance, status — all three
  UPDATE student_fees
  SET
    amount_paid = v_new_paid,
    balance     = v_new_balance,
    status      = v_new_status,
    updated_at  = NOW()
  WHERE id = p_student_fee_id;

  -- Return the created payment as JSONB
  SELECT row_to_json(p.*)::jsonb INTO v_payment
  FROM payments p WHERE p.id = v_payment_id;

  RETURN jsonb_build_object(
    'success',     true,
    'payment_id',  v_payment_id,
    'payment',     v_payment,
    'new_paid',    v_new_paid,
    'new_balance', v_new_balance,
    'new_status',  v_new_status
  );
END;
$$;

-- Grant to all authenticated roles (bursar, finance, admin, principal, etc.)
GRANT EXECUTE ON FUNCTION record_fee_payment(UUID, UUID, UUID, DECIMAL, DECIMAL, VARCHAR, payment_method, TEXT, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
