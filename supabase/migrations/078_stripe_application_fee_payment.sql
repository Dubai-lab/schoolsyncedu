-- Migration 078: Anon-safe RPC to mark application fee paid via Stripe
--
-- After the applicant completes a Stripe card payment for the application fee
-- on the public SchoolApplicationForm page, the client (running as anon) calls
-- this function to record the payment intent and set application_fee_paid = true.
--
-- Security notes:
--   • SECURITY DEFINER so anon can write to student_applications
--   • Only updates rows where application_fee_paid IS STILL false (idempotent)
--   • Stores the Stripe payment_intent_id in application_fee_payment_ref for Bursar audit
--   • The Bursar can still verify against Stripe dashboard if needed

CREATE OR REPLACE FUNCTION mark_application_fee_paid_stripe(
  p_application_id    UUID,
  p_payment_intent_id TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE student_applications
  SET
    application_fee_paid         = true,
    application_fee_payment_ref  = p_payment_intent_id,
    application_fee_paid_at      = now(),
    updated_at                   = now()
  WHERE id                  = p_application_id
    AND application_fee_paid = false;  -- idempotent; won't overwrite already-paid
END;
$$;

-- Allow both anon (public applicants) and authenticated users to call this
GRANT EXECUTE ON FUNCTION mark_application_fee_paid_stripe(UUID, TEXT)
  TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
