-- ============================================================
-- Migration 210: Activate a subscription straight from the request queue
--
-- Migration 208 deliberately kept "Mark activated" as a bookkeeping action —
-- it recorded that the request was handled and did not touch billing. The
-- reasoning was that a status change in a queue should not silently alter what
-- a school is charged.
--
-- In practice that was wrong for how this is actually used. There is one
-- administrator, taking payment by hand, and the two steps had nothing linking
-- them: marking a request activated left the school still showing "Grace
-- period — 114 days left", with no indication that a second action was needed
-- somewhere else. The safeguard protected against a problem that does not
-- exist here and created one that does.
--
-- This makes it a single explicit action instead. It does not invent a new
-- activation path: it calls record_subscription_payment, the same function the
-- online payment page uses, so a manually activated school ends up with the
-- identical platform_payments row, subscription_history entry, paid invoice
-- and expiry date as one that paid by card.
-- ============================================================

CREATE OR REPLACE FUNCTION activate_school_from_request(
  p_request_id     UUID,
  p_amount_usd     DECIMAL,
  p_payment_method TEXT DEFAULT 'manual',
  p_reference      TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin   UUID;
  v_req     RECORD;
  v_sub     RECORD;
  v_method  payment_method;
  v_ref     TEXT;
  v_result  JSONB;
BEGIN
  SELECT id INTO v_admin
  FROM   users WHERE auth_id = auth.uid() AND role = 'super_admin';

  IF v_admin IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Not permitted.');
  END IF;

  SELECT * INTO v_req FROM activation_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Request not found.');
  END IF;

  -- payment_method is an enum of ('visa','mtn','orange','bank','manual').
  -- The request stores what the school *asked* for, which is a longer list, so
  -- map it down rather than fail on a value the enum has never heard of.
  v_method := CASE p_payment_method
                WHEN 'mtn_momo'      THEN 'mtn'
                WHEN 'orange_money'  THEN 'orange'
                WHEN 'bank_transfer' THEN 'bank'
                WHEN 'mtn'           THEN 'mtn'
                WHEN 'orange'        THEN 'orange'
                WHEN 'bank'          THEN 'bank'
                WHEN 'visa'          THEN 'visa'
                ELSE 'manual'
              END::payment_method;

  -- Most recent subscription for the school — the one the banner reflects.
  SELECT id, status::TEXT AS status INTO v_sub
  FROM   subscriptions
  WHERE  school_id = v_req.school_id
  ORDER  BY created_at DESC
  LIMIT  1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'message', 'This school has no subscription record. Create one in School Management first.');
  END IF;

  v_ref := COALESCE(NULLIF(btrim(p_reference), ''), 'Manual activation ' || v_req.reference);

  -- The canonical activation path, shared with the online payment page.
  v_result := record_subscription_payment(
    v_req.school_id,
    v_sub.id,
    COALESCE(p_amount_usd, 0),
    v_ref,
    v_req.reference,
    v_method
  );

  UPDATE activation_requests
  SET    status       = 'activated',
         handled_by   = v_admin,
         handled_at   = now(),
         handled_note = COALESCE(handled_note, '') ||
                        CASE WHEN handled_note IS NULL OR handled_note = '' THEN '' ELSE E'\n' END ||
                        'Activated: ' || v_ref
  WHERE  id = p_request_id;

  -- Tell the school. process-subscription-notifications already watches
  -- notification_logs for payment_confirmed, so this reuses the existing mail
  -- path rather than adding another one.
  INSERT INTO notification_logs (school_id, subscription_id, event_type, recipient_email, metadata)
  VALUES (
    v_req.school_id,
    v_sub.id,
    'payment_confirmed',
    v_req.contact_email,
    jsonb_build_object(
      'reference',      v_req.reference,
      'amount_usd',     COALESCE(p_amount_usd, 0),
      'payment_method', p_payment_method,
      'invoice_number', v_result->>'invoice_number',
      'manual',         true
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'invoice_number', v_result->>'invoice_number',
    'previous_status', v_sub.status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION activate_school_from_request(UUID, DECIMAL, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';


-- ============================================================
-- VERIFICATION
--
--   -- Before: the school shows grace/trial
--   SELECT status, expires_at FROM subscriptions WHERE school_id = '<id>';
--
--   -- Activate from the queue, then re-run. Expect status 'active' and
--   -- expires_at pushed out by the plan's billing cycle.
--
--   -- The paper trail should match a card payment exactly:
--   SELECT * FROM platform_payments     WHERE school_id = '<id>' ORDER BY created_at DESC LIMIT 1;
--   SELECT * FROM billing_invoices      WHERE school_id = '<id>' ORDER BY created_at DESC LIMIT 1;
--   SELECT * FROM subscription_history  WHERE subscription_id = '<sub>' ORDER BY changed_at DESC LIMIT 1;
-- ============================================================
