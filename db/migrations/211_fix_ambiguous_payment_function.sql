-- ============================================================
-- Migration 211: Remove the duplicate record_subscription_payment
--
-- Symptom: calling record_subscription_payment fails with
--   PostgREST error=42725  (ambiguous_function — "function is not unique")
--
-- Cause: migration 081 added a seventh parameter, p_new_plan_id, so schools
-- could switch plan while paying:
--
--   018/034  record_subscription_payment(UUID, UUID, DECIMAL, TEXT, TEXT, payment_method)
--   081      record_subscription_payment(UUID, UUID, DECIMAL, TEXT, TEXT, payment_method, UUID)
--
-- CREATE OR REPLACE only replaces a function with an identical signature.
-- Adding a parameter created a second overload instead of replacing the first,
-- and 081 never dropped the original. Because the new parameter has a DEFAULT,
-- a six-argument call matches BOTH — which is exactly what every caller does:
--
--   stripeService.ts, stripe-webhook, flutterwave-webhook,
--   mtn-callback, mtn-status
--
-- So this was not only breaking manual activation. Every payment path in the
-- product resolves to an ambiguous call. It has gone unnoticed because card
-- payments are currently disabled — it would have surfaced the first time a
-- real payment was taken.
--
-- Fix: drop the six-argument version. The seven-argument one is a strict
-- superset — p_new_plan_id defaults to NULL and is only read when NOT NULL, so
-- existing six-argument callers behave exactly as before, and now resolve to
-- one function instead of two.
-- ============================================================

DROP FUNCTION IF EXISTS record_subscription_payment(
  UUID, UUID, DECIMAL, TEXT, TEXT, payment_method
);


-- ============================================================
-- GUARD
--
-- Fail loudly if more than one overload survives, rather than leaving the same
-- ambiguity to be rediscovered from a 400 in a browser console.
-- ============================================================

DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT count(*) INTO v_count
  FROM   pg_proc p
  JOIN   pg_namespace n ON n.oid = p.pronamespace
  WHERE  n.nspname = 'public'
    AND  p.proname = 'record_subscription_payment';

  IF v_count <> 1 THEN
    RAISE EXCEPTION
      'Expected exactly 1 record_subscription_payment, found %. Resolve the overloads before continuing.',
      v_count;
  END IF;
END $$;


-- Re-grant: the dropped overload took its grants with it, and the surviving
-- one was granted when 081 ran — but re-stating is harmless and makes this
-- migration safe to run against a database where 081 was applied differently.
GRANT EXECUTE ON FUNCTION record_subscription_payment(
  UUID, UUID, DECIMAL, TEXT, TEXT, payment_method, UUID
) TO anon, authenticated;

-- ============================================================
-- SWEEP
--
-- Several functions were redefined across migrations with changed parameter
-- lists, which is how this one ended up duplicated. Report any others that
-- now have more than one overload.
--
-- A NOTICE rather than an exception: some overloads are deliberate, and this
-- migration should not refuse to run over a pair that is working as intended.
-- Anything listed here is worth checking, not necessarily fixing.
-- ============================================================

DO $$
DECLARE
  r RECORD;
  v_found BOOLEAN := false;
BEGIN
  FOR r IN
    SELECT p.proname, count(*) AS n,
           string_agg(pg_get_function_identity_arguments(p.oid), '  |  ') AS sigs
    FROM   pg_proc p
    JOIN   pg_namespace n ON n.oid = p.pronamespace
    WHERE  n.nspname = 'public'
      AND  p.prokind = 'f'
    GROUP  BY p.proname
    HAVING count(*) > 1
    ORDER  BY p.proname
  LOOP
    v_found := true;
    RAISE NOTICE 'Overloaded: %  (% versions)  ->  %', r.proname, r.n, r.sigs;
  END LOOP;

  IF NOT v_found THEN
    RAISE NOTICE 'No overloaded functions remain in public.';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';


-- ============================================================
-- VERIFICATION
--
--   -- Exactly one row expected:
--   SELECT pg_get_function_identity_arguments(p.oid) AS args
--   FROM   pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE  n.nspname = 'public' AND p.proname = 'record_subscription_payment';
--
--   -- Then activate from the queue again. The grace banner should clear and a
--   -- paid invoice should appear for the school.
-- ============================================================
