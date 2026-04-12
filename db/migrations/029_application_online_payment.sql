-- ============================================================
-- Migration 029: Online Payment for Application Fees
--
-- 1. Grant get_payment_config_public to anon so the public
--    application form (unauthenticated) can load the school's
--    payment gateway config.
--
-- 2. Create record_application_online_payment() — SECURITY
--    DEFINER RPC callable by anon after a successful Flutterwave
--    or mobile money payment. Marks application_fee_paid = true
--    and stores the gateway reference.
-- ============================================================

-- Allow unauthenticated (public) pages to load payment config
GRANT EXECUTE ON FUNCTION get_payment_config_public(UUID) TO anon;

-- ============================================================
-- Add gateway_ref column to student_applications if missing
-- (stores the Flutterwave transaction ref after online payment)
-- ============================================================
ALTER TABLE student_applications
  ADD COLUMN IF NOT EXISTS payment_gateway_ref TEXT,
  ADD COLUMN IF NOT EXISTS payment_method       TEXT;

-- ============================================================
-- RPC: record_application_online_payment
-- Called from the public form after a successful gateway payment.
-- Marks the application fee as paid and stores the reference.
-- SECURITY DEFINER so anon callers can write this one field only.
-- ============================================================
CREATE OR REPLACE FUNCTION record_application_online_payment(
  p_application_number TEXT,
  p_gateway_ref        TEXT,
  p_payment_method     TEXT  -- 'card', 'mtn', 'orange', 'bank'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app_id UUID;
  v_already_paid BOOLEAN;
BEGIN
  -- Find the application
  SELECT id, application_fee_paid
  INTO   v_app_id, v_already_paid
  FROM   student_applications
  WHERE  application_number = p_application_number
  LIMIT  1;

  IF v_app_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Application not found');
  END IF;

  IF v_already_paid THEN
    RETURN jsonb_build_object('success', true, 'message', 'Fee already marked as paid');
  END IF;

  UPDATE student_applications
  SET    application_fee_paid   = true,
         payment_gateway_ref    = p_gateway_ref,
         payment_method         = p_payment_method,
         updated_at             = now()
  WHERE  id = v_app_id;

  RETURN jsonb_build_object('success', true, 'message', 'Payment recorded successfully');
END;
$$;

-- Allow both anonymous (public form) and authenticated users
GRANT EXECUTE ON FUNCTION record_application_online_payment(TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION record_application_online_payment(TEXT, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
