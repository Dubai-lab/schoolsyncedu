-- ============================================================
-- Migration 219: Application fees must be verified before they are marked paid
--
-- THE BUG
--   mark_application_fee_paid_stripe (migration 078) is SECURITY DEFINER and
--   was granted to `anon`. The public application pages called it straight
--   from the browser, passing the payment reference they had just been handed:
--
--     await anonClient.rpc('mark_application_fee_paid_stripe', {
--       p_application_id:    applicationId,
--       p_payment_intent_id: paymentIntentId,
--     });
--
--   Nothing checked with Stripe that a payment had happened. Anyone — signed
--   in or not — could call it with an application id and any string at all and
--   have the fee recorded as paid. 078's own security notes only claim
--   idempotency, and end with 'the Bursar can still verify against the Stripe
--   dashboard if needed': verification was left to a person noticing.
--
--   Same shape as the student fee hole in migration 218. The browser confirmed
--   the card and then told the database the outcome.
--
-- THE FIX
--   The school-stripe-verify Edge Function retrieves the PaymentIntent from
--   Stripe with the school's own key, checks it succeeded, and reads the
--   application id back out of the intent's metadata rather than taking it
--   from the caller. Both public pages call that instead.
--
--   With no browser caller left, the grant comes off anon and authenticated.
--   service_role keeps it: school-flw-verify, school-mtn-status and
--   school-orange-status call it after verifying with their own gateways.
--
-- ROLLBACK
--   GRANT EXECUTE ON FUNCTION mark_application_fee_paid_stripe(UUID, TEXT)
--     TO anon, authenticated;
-- ============================================================

REVOKE EXECUTE ON FUNCTION mark_application_fee_paid_stripe(UUID, TEXT)
  FROM anon, authenticated;

-- record_application_online_payment has the same shape — SECURITY DEFINER,
-- granted to anon, takes an application number and a gateway reference and
-- marks the fee paid without checking either. Its only caller,
-- registrarService.recordOnlinePayment, is reachable from no page in the app:
-- the grant is live but the feature is not. Closing it now rather than leaving
-- an unused door open.
--
-- registrarService.recordOnlinePayment will now fail if anyone wires it up,
-- which is the right way round: it needs a gateway check first, like Stripe
-- and Flutterwave have.
REVOKE EXECUTE ON FUNCTION record_application_online_payment(TEXT, TEXT, TEXT)
  FROM anon, authenticated;

-- Explicit rather than relying on service_role's blanket privileges, so the
-- intent survives anyone tightening those later.
GRANT EXECUTE ON FUNCTION mark_application_fee_paid_stripe(UUID, TEXT)
  TO service_role;

NOTIFY pgrst, 'reload schema';
