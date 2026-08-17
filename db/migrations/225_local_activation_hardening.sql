-- ============================================================
-- Migration 225: Subscriptions are activated by hand, so the RPC that
--                activates them must not be callable from a browser
--
-- ── WHY THIS MATTERS MORE NOW, NOT LESS ─────────────────────────────────────
--
--   record_subscription_payment marks a subscription paid and puts the school
--   back online. It is granted to anon and authenticated, and the only client
--   that calls it is stripeService, from the browser, after Stripe confirms in
--   the page — the same shape as the student fee hole closed in 218 and the
--   application fee hole closed in 219.
--
--   With a working card gateway there was at least a real payment somewhere in
--   the story. There is no gateway here: MTN has no key yet, and subscriptions
--   are arranged offline and activated by hand from the admin screen. So
--   nothing anywhere would contradict a browser that simply called this
--   function and declared itself paid — no charge to reconcile, no webhook,
--   no statement line. A school could activate its own subscription, and the
--   only sign would be a school running on a plan nobody was ever billed for.
--
--   The webhooks keep their access: flutterwave-webhook, mtn-callback,
--   mtn-status and stripe-webhook all call it with service_role, after their
--   gateway has confirmed. That is the path that should exist. The browser one
--   should not.
--
--   If Stripe is switched on again for another country, stripeService must go
--   through a verifying Edge Function first — school-stripe-verify is the
--   pattern: retrieve the intent, check it succeeded, read the amount from the
--   gateway rather than the request.
--
-- ── AND ONE THING THE PAGE COULD NOT SAY ────────────────────────────────────
--
--   get_payment_info already reads expires_at into v_sub and then does not
--   return it. A school that has just registered is in grace, and the one
--   question it has is how long that lasts — which the page had no way to
--   answer. Returned now.
--
-- ROLLBACK
--   GRANT EXECUTE ON FUNCTION record_subscription_payment(
--     UUID, UUID, DECIMAL, TEXT, TEXT, payment_method, UUID) TO anon, authenticated;
-- ============================================================

-- ── 1. Off the browser, on for the webhooks ─────────────────────────────────
-- Both signatures are named: 211 dropped the 6-argument overload, but a
-- database that has not had 211 applied yet still carries it, and leaving it
-- granted would leave the door open.
DO $$
BEGIN
  BEGIN
    REVOKE EXECUTE ON FUNCTION record_subscription_payment(
      UUID, UUID, DECIMAL, TEXT, TEXT, payment_method, UUID
    ) FROM anon, authenticated;
    GRANT EXECUTE ON FUNCTION record_subscription_payment(
      UUID, UUID, DECIMAL, TEXT, TEXT, payment_method, UUID
    ) TO service_role;
  EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'skipped: 7-argument record_subscription_payment not present';
  END;

  BEGIN
    REVOKE EXECUTE ON FUNCTION record_subscription_payment(
      UUID, UUID, DECIMAL, TEXT, TEXT, payment_method
    ) FROM anon, authenticated;
  EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'skipped: 6-argument record_subscription_payment not present (dropped by 211)';
  END;
END $$;


-- ── 2. Tell the payment page when grace runs out ────────────────────────────
-- Body reproduced from 018 with expires_at added to the subscription object.
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
  SELECT id, name INTO v_school
  FROM schools WHERE id = p_school_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'School not found';
  END IF;

  -- lower() on BOTH sides. The original compared `email = lower(p_email)`,
  -- which assumes the stored address is already lowercase — and register_school
  -- inserts p_owner_email exactly as the proprietor typed it. So a school that
  -- signed up as "John@School.com" was stored that way, never matched here, and
  -- the payment page failed outright with 'User not found' at the very first
  -- step after registering. Nothing in the flow lowercases on the way in, so the
  -- comparison has to.
  SELECT email, full_name, phone INTO v_user
  FROM users
  WHERE school_id = p_school_id AND lower(email) = lower(p_email)
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  SELECT s.id, s.plan_id, s.status, s.started_at, s.expires_at
  INTO v_sub
  FROM subscriptions s
  WHERE s.school_id = p_school_id AND s.status IN ('trial', 'grace')
  ORDER BY s.created_at DESC
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No pending subscription found';
  END IF;

  SELECT p.id, p.name, p.slug, p.description, p.price_usd, p.billing_cycle,
         p.student_limit, p.features, p.trial_days
  INTO v_plan
  FROM subscription_plans p WHERE p.id = v_sub.plan_id;

  RETURN jsonb_build_object(
    'school', jsonb_build_object('id', v_school.id, 'name', v_school.name),
    'owner',  jsonb_build_object('email', v_user.email, 'name', v_user.full_name, 'phone', COALESCE(v_user.phone, '')),
    'subscription', jsonb_build_object(
      'id', v_sub.id, 'status', v_sub.status, 'plan_id', v_sub.plan_id,
      'expires_at', v_sub.expires_at
    ),
    'plan', jsonb_build_object(
      'id', v_plan.id, 'name', v_plan.name, 'slug', v_plan.slug,
      'description', v_plan.description, 'price_usd', v_plan.price_usd,
      'billing_cycle', v_plan.billing_cycle, 'student_limit', v_plan.student_limit,
      'features', v_plan.features, 'trial_days', v_plan.trial_days
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_payment_info(UUID, TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
