-- 100_subdomain_fixes.sql
-- Fixes three issues with the subdomain add-on:
--   1. Platform admin cannot see subdomain_payments (RLS blocks non-school users)
--   2. School members' payment history returns empty (RLS inconsistency)
--   3. No way to re-activate a voluntarily-deactivated subdomain while still paid

-- ── Admin view: all subdomain payments with school name ────────────────────────
CREATE OR REPLACE FUNCTION get_all_subdomain_payments()
RETURNS TABLE (
  id          uuid,
  school_id   uuid,
  school_name text,
  amount_usd  numeric,
  plan        text,
  gateway_ref text,
  paid_at     timestamptz,
  paid_until  timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sp.id,
    sp.school_id,
    s.name AS school_name,
    sp.amount_usd,
    sp.plan,
    sp.gateway_ref,
    sp.paid_at,
    sp.paid_until
  FROM subdomain_payments sp
  LEFT JOIN schools s ON s.id = sp.school_id
  ORDER BY sp.paid_at DESC;
$$;

-- ── School member view: their own payment history (bypasses RLS) ───────────────
CREATE OR REPLACE FUNCTION get_subdomain_payment_history(p_school_id uuid)
RETURNS TABLE (
  id          uuid,
  school_id   uuid,
  amount_usd  numeric,
  plan        text,
  gateway_ref text,
  paid_at     timestamptz,
  paid_until  timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, school_id, amount_usd, plan, gateway_ref, paid_at, paid_until
  FROM subdomain_payments
  WHERE school_id = p_school_id
  ORDER BY paid_at DESC;
$$;

-- ── Re-activate a subdomain that was voluntarily deactivated while still paid ──
CREATE OR REPLACE FUNCTION reactivate_subdomain_addon(p_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paid_until  timestamptz;
  v_subdomain   text;
BEGIN
  SELECT subdomain_paid_until, subdomain
  INTO   v_paid_until, v_subdomain
  FROM   schools
  WHERE  id = p_school_id;

  IF v_paid_until IS NULL OR v_paid_until <= now() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'Subdomain subscription has expired. Please renew to reactivate.'
    );
  END IF;

  UPDATE schools
  SET    subdomain_active = true
  WHERE  id = p_school_id;

  RETURN jsonb_build_object(
    'success',    true,
    'subdomain',  v_subdomain,
    'paid_until', v_paid_until::text
  );
END;
$$;

-- ── Grants ─────────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION get_all_subdomain_payments()        TO authenticated;
GRANT EXECUTE ON FUNCTION get_subdomain_payment_history(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION reactivate_subdomain_addon(uuid)    TO authenticated;
