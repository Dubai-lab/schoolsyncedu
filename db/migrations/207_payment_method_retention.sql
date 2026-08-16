-- ============================================================
-- Migration 207: Card-on-file retention rules
--
-- Saving a card is optional. Removing one is not always allowed.
--
-- The rule, in plain terms: a school may replace its card whenever it likes,
-- but may only remove it once nothing is owed and nothing is about to be
-- charged. That is how subscription services generally behave — a card on file
-- is the arrangement that keeps the service running, so it cannot be withdrawn
-- while the service is still being billed for.
--
-- Concretely, removal is blocked when either is true:
--   • an unpaid invoice exists
--   • the subscription will renew (active or grace, with auto_renew on)
--
-- And always allowed when the school has genuinely finished: cancelled or
-- expired subscription, nothing outstanding. Turning auto_renew off is the
-- deliberate route out — a school decides to stop renewing, then removes the
-- card. It is never a trap, just an order of operations.
--
-- Enforced in the database rather than the UI. A rule that only exists in
-- React is not a rule; saved_payment_tokens is reachable through PostgREST.
-- ============================================================


-- ============================================================
-- 1. CAN THIS SCHOOL REMOVE ITS CARD?
--    Returns the reason as well as the answer, so the UI can explain the block
--    instead of showing a disabled button with no rationale.
-- ============================================================

CREATE OR REPLACE FUNCTION can_remove_payment_method()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_school   UUID;
  v_role     TEXT;
  v_unpaid   INT;
  v_sub      RECORD;
BEGIN
  SELECT school_id, role::TEXT INTO v_school, v_role
  FROM   users WHERE auth_id = auth.uid();

  IF v_school IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Not signed in.');
  END IF;

  IF v_role NOT IN ('proprietor', 'principal', 'super_admin') THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason',  'Only the proprietor can change billing details.');
  END IF;

  SELECT count(*) INTO v_unpaid
  FROM   billing_invoices
  WHERE  school_id = v_school
    AND  status NOT IN ('paid', 'cancelled', 'void');

  IF v_unpaid > 0 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason',  format('You have %s unpaid invoice%s. Settle your balance before removing your card.',
                        v_unpaid, CASE WHEN v_unpaid = 1 THEN '' ELSE 's' END));
  END IF;

  SELECT status::TEXT AS status, auto_renew, expires_at
  INTO   v_sub
  FROM   subscriptions
  WHERE  school_id = v_school
  ORDER  BY created_at DESC
  LIMIT  1;

  IF FOUND AND v_sub.auto_renew AND v_sub.status IN ('active', 'trial', 'grace') THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason',  'Your subscription renews automatically. Turn off auto-renew first, then remove your card.');
  END IF;

  RETURN jsonb_build_object('allowed', true);
END;
$$;

GRANT EXECUTE ON FUNCTION can_remove_payment_method() TO authenticated;


-- ============================================================
-- 2. REMOVE, GUARDED
--    Re-checks rather than trusting the caller: the client already knows the
--    answer from the function above, but nothing stops it calling this anyway.
-- ============================================================

CREATE OR REPLACE FUNCTION remove_payment_method(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school UUID;
  v_check  JSONB;
BEGIN
  SELECT school_id INTO v_school FROM users WHERE auth_id = auth.uid();
  IF v_school IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Not signed in.');
  END IF;

  v_check := can_remove_payment_method();
  IF NOT (v_check->>'allowed')::BOOLEAN THEN
    RETURN jsonb_build_object('ok', false, 'message', v_check->>'reason');
  END IF;

  -- Scoped to the caller's own school, so an id from elsewhere does nothing.
  DELETE FROM saved_payment_tokens
  WHERE  id = p_id AND school_id = v_school;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'That card is no longer on file.');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION remove_payment_method(UUID) TO authenticated;


-- ============================================================
-- 3. VERIFICATION
--
--   SELECT can_remove_payment_method();
--
--   With an active auto-renewing subscription, expect allowed:false and the
--   auto-renew reason. Turn auto_renew off:
--
--     UPDATE subscriptions SET auto_renew = false
--     WHERE school_id = '<id>';
--
--   and it should flip to allowed:true, provided no unpaid invoices remain.
-- ============================================================

NOTIFY pgrst, 'reload schema';
