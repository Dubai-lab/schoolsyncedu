-- ============================================================
-- Migration 218: Stop anyone from marking any fee as paid
--
-- THE BUG
--   record_fee_payment (migration 035) is SECURITY DEFINER, opens with
--   `SET LOCAL row_security = OFF`, and had no caller check of any kind. It
--   was granted to `authenticated`. Every parameter it trusts — school,
--   student, fee, amount, who recorded it — comes from the caller.
--
--   So any signed-in user could call it and clear any fee balance, at any
--   school, for any student, with a made-up gateway reference and a forged
--   recorded_by. A student needed no more than their own fee id, which their
--   own portal already hands them.
--
--   That is not only a money hole. Exam clearance at the kiosk decides who may
--   sit a paper by reading fee status, so clearing your own balance walks you
--   past the exam door as well.
--
--   The 'bypass RLS so any authenticated role can record' comment in 035 is
--   the whole story: RLS was switched off to get past a policy problem, and
--   nothing was put back in its place.
--
-- WHY THE CLIENT COULD DO THIS AT ALL
--   The Stripe flow confirms the card in the browser and then the browser
--   tells the database it was paid. The server never asks Stripe whether the
--   payment happened. Flutterwave, MTN and Orange already verify server-side
--   in their Edge Functions; Stripe and the public fee page did not. Those two
--   are moved to a verifying Edge Function alongside this migration, which is
--   what allows the grant below to be withdrawn from students.
--
-- AFTER THIS MIGRATION
--   Two kinds of caller, judged separately:
--
--   • No JWT (service_role — the payment Edge Functions) keeps the parameters
--     it passes today. It has already verified the payment with the gateway,
--     and it is the only path that can act for a student.
--
--   • A signed-in caller must hold a finance role, and school and recorded_by
--     are taken from their session rather than from the request, so neither
--     can be aimed at another school or attributed to someone else.
--
-- ROLLBACK
--   Re-run migration 035.
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
  v_caller       RECORD;
  v_school_id    UUID := p_school_id;
  v_recorded_by  UUID := p_recorded_by;
BEGIN
  -- ── Who is calling ────────────────────────────────────────────────────────
  -- auth.uid() is NULL for service_role: the payment Edge Functions, which
  -- have already checked with the gateway that the money moved. They are the
  -- only route by which a student's payment gets recorded, and they supply
  -- their own school_id because they act outside any session.
  IF auth.uid() IS NOT NULL THEN
    SELECT id, role, school_id INTO v_caller
      FROM users WHERE auth_id = auth.uid();

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Not permitted to record payments';
    END IF;

    IF v_caller.role::TEXT NOT IN ('bursar','admin_staff','registrar','super_admin') THEN
      RAISE EXCEPTION 'Only finance staff may record a payment';
    END IF;

    -- Taken from the session, not the request. A caller cannot record into
    -- another school, and cannot put someone else's name on the entry.
    IF v_caller.role::TEXT <> 'super_admin' THEN
      v_school_id := v_caller.school_id;
    END IF;
    v_recorded_by := v_caller.id;
  END IF;

  IF p_amount_usd < 0 OR p_amount_lrd < 0 THEN
    RAISE EXCEPTION 'Payment amount cannot be negative';
  END IF;

  -- Bypass RLS for the write itself. Safe now that the caller has been
  -- established above and the school is no longer whatever they asked for.
  SET LOCAL row_security = OFF;

  SELECT sf.id, sf.amount_due, sf.amount_paid, sf.balance
  INTO v_fee
  FROM student_fees sf
  JOIN students s ON s.id = sf.student_id
  WHERE sf.id = p_student_fee_id
    AND sf.student_id = p_student_id
    AND s.school_id = v_school_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student fee record not found or does not belong to this school';
  END IF;

  -- Recording the same gateway reference twice would double-credit the fee.
  -- A retry after a dropped connection returns the original entry instead.
  IF p_gateway_ref IS NOT NULL AND p_gateway_ref <> '' THEN
    SELECT id INTO v_payment_id
      FROM payments
     WHERE gateway_ref = p_gateway_ref
       AND student_fee_id = p_student_fee_id
     LIMIT 1;

    IF v_payment_id IS NOT NULL THEN
      SELECT row_to_json(p.*)::jsonb INTO v_payment FROM payments p WHERE p.id = v_payment_id;
      RETURN jsonb_build_object(
        'success',     true,
        'duplicate',   true,
        'payment_id',  v_payment_id,
        'payment',     v_payment,
        'new_paid',    (SELECT amount_paid FROM student_fees WHERE id = p_student_fee_id),
        'new_balance', (SELECT balance     FROM student_fees WHERE id = p_student_fee_id),
        'new_status',  (SELECT status      FROM student_fees WHERE id = p_student_fee_id)
      );
    END IF;
  END IF;

  v_paid_amount := CASE
    WHEN p_currency_charged = 'USD' THEN p_amount_usd
    ELSE p_amount_lrd
  END;

  v_new_paid    := COALESCE(v_fee.amount_paid, 0) + v_paid_amount;
  v_new_balance := GREATEST(COALESCE(v_fee.amount_due, 0) - v_new_paid, 0);
  v_new_status  := CASE
    WHEN v_new_paid >= COALESCE(v_fee.amount_due, 0) THEN 'paid'
    WHEN v_new_paid > 0                               THEN 'partial'
    ELSE 'pending'
  END;

  INSERT INTO payments (
    school_id, student_id, student_fee_id,
    amount_usd, amount_lrd, currency_charged,
    payment_method, gateway_ref, status,
    recorded_by, payment_date
  ) VALUES (
    v_school_id, p_student_id, p_student_fee_id,
    p_amount_usd, p_amount_lrd, p_currency_charged,
    p_payment_method, p_gateway_ref, 'success',
    v_recorded_by, NOW()
  )
  RETURNING id INTO v_payment_id;

  UPDATE student_fees
  SET
    amount_paid = v_new_paid,
    balance     = v_new_balance,
    status      = v_new_status,
    updated_at  = NOW()
  WHERE id = p_student_fee_id;

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

NOTIFY pgrst, 'reload schema';
