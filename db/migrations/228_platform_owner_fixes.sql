-- ============================================================
-- Migration 228: The platform owner's own screens
--
-- Three faults, all the same shape: RLS filters a write to zero rows, and a
-- filtered write is not an error. PostgREST returns success, the client
-- checks `error` — which is null — and reports that it worked.
--
-- ── 1. DELETING A PLAN OR A DISCOUNT DID NOTHING ────────────────────────────
--
--   subscription_plans and discounts each have SELECT, INSERT and UPDATE
--   policies and no DELETE policy at all. adminService.delete() checks the
--   error, gets none, and returns cleanly. The row is still there after the
--   list refreshes.
--
--   contact_messages and activation_requests were written FOR ALL, so their
--   deletes have always worked. Only these two were split by command and had
--   the delete left out.
--
-- ── 2. ANY VISITOR COULD READ EVERY COUPON CODE ─────────────────────────────
--
--   discounts_select is `is_active = TRUE OR is_super_admin()`, and
--   validateCoupon queries the table straight from the browser. Dropping the
--   coupon_code filter from that query returns the whole list — every active
--   code, its type and its value.
--
--   So a school registering could read the codes instead of being given one,
--   and apply the largest. Validation moves into a function that takes a code
--   and answers about that code only; the table itself is closed.
--
-- ── 3. max_uses WAS NEVER ENFORCED ──────────────────────────────────────────
--
--   incrementCouponUses does an UPDATE on discounts, and updating discounts
--   requires is_super_admin(). The person redeeming a coupon never is, so the
--   counter never moved. current_uses has been 0 for every coupon ever used,
--   and a code limited to one use could be used forever.
--
--   Redemption becomes a SECURITY DEFINER function that increments under a
--   row lock, so two schools redeeming the last use at once cannot both win.
--
-- ROLLBACK
--   DROP POLICY subscription_plans_delete ON subscription_plans;
--   DROP POLICY discounts_delete ON discounts;
--   DROP FUNCTION validate_coupon(TEXT, UUID);
--   DROP FUNCTION redeem_coupon(UUID);
--   -- and restore discounts_select from its original migration
-- ============================================================

-- ── 1. The missing deletes ──────────────────────────────────────────────────
DROP POLICY IF EXISTS subscription_plans_delete ON subscription_plans;
CREATE POLICY subscription_plans_delete ON subscription_plans
  FOR DELETE USING (is_super_admin());

DROP POLICY IF EXISTS discounts_delete ON discounts;
CREATE POLICY discounts_delete ON discounts
  FOR DELETE USING (is_super_admin());


-- ── 2. Coupon codes are not public ──────────────────────────────────────────
-- Plans stay publicly readable — that is the pricing page. Discounts do not:
-- a coupon is worth something precisely because it was given to someone.
DROP POLICY IF EXISTS discounts_select ON discounts;
CREATE POLICY discounts_select ON discounts
  FOR SELECT USING (is_super_admin());

-- Answers about one code, never about the list. Mirrors what the client used
-- to do in JavaScript, including the applicable_plans rule: null or empty
-- means every plan, otherwise the plan must be named.
CREATE OR REPLACE FUNCTION validate_coupon(p_code TEXT, p_plan_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_d     RECORD;
  v_today DATE := CURRENT_DATE;
BEGIN
  IF p_code IS NULL OR btrim(p_code) = '' THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_d
  FROM   discounts
  WHERE  coupon_code = upper(btrim(p_code))
    AND  is_active   = TRUE
    AND  (start_date IS NULL OR start_date <= v_today)
    AND  (end_date   IS NULL OR end_date   >= v_today)
  LIMIT  1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_d.applicable_plans IS NOT NULL
 AND jsonb_typeof(v_d.applicable_plans) = 'array'
 AND jsonb_array_length(v_d.applicable_plans) > 0
 AND NOT (v_d.applicable_plans ? p_plan_id::TEXT) THEN
    RETURN NULL;
  END IF;

  -- Enforced here for the first time.
  IF v_d.max_uses IS NOT NULL AND COALESCE(v_d.current_uses, 0) >= v_d.max_uses THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', v_d.id, 'name', v_d.name, 'type', v_d.type, 'value', v_d.value,
    'coupon_code', v_d.coupon_code, 'max_uses', v_d.max_uses,
    'current_uses', COALESCE(v_d.current_uses, 0), 'stackable', v_d.stackable,
    'is_active', v_d.is_active
  );
END;
$$;


-- ── 3. Redemption actually counts ───────────────────────────────────────────
-- FOR UPDATE takes a row lock, so two schools claiming the last use of a
-- coupon at the same moment cannot both be told yes.
CREATE OR REPLACE FUNCTION redeem_coupon(p_discount_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_d RECORD;
BEGIN
  SELECT id, max_uses, COALESCE(current_uses, 0) AS current_uses
  INTO   v_d
  FROM   discounts
  WHERE  id = p_discount_id AND is_active = TRUE
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF v_d.max_uses IS NOT NULL AND v_d.current_uses >= v_d.max_uses THEN
    RETURN FALSE;
  END IF;

  UPDATE discounts
  SET    current_uses = COALESCE(current_uses, 0) + 1
  WHERE  id = p_discount_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION validate_coupon(TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION redeem_coupon(UUID)         TO anon, authenticated;


-- ============================================================
-- 4. THE SUBDOMAIN BILLING FUNCTIONS HAD NO CALLER CHECKS
--
--   All three from migration 100 are SECURITY DEFINER, granted to
--   `authenticated`, and none of them ask who is calling:
--
--     get_all_subdomain_payments()      returns every subdomain payment on the
--                                       platform — school names, amounts,
--                                       gateway references, dates. Any signed-in
--                                       user of any school could read the whole
--                                       cross-school billing history. It backs
--                                       one screen, /admin/billing, which only
--                                       the platform owner can open — but the
--                                       function was never told that.
--
--     get_subdomain_payment_history(id) takes the school id from the caller and
--                                       trusts it, so any user could read any
--                                       school's payment history by passing a
--                                       different id.
--
--     reactivate_subdomain_addon(id)    likewise, and it writes: a user could
--                                       switch another school's subdomain back
--                                       on, as long as that school had paid.
--
--   Bodies unchanged apart from the check at the top.
-- ============================================================

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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
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
END;
$$;


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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Your own school, or the platform owner's view of anyone's.
  IF NOT (is_super_admin() OR p_school_id = auth_school_id()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT sp.id, sp.school_id, sp.amount_usd, sp.plan, sp.gateway_ref,
         sp.paid_at, sp.paid_until
  FROM   subdomain_payments sp
  WHERE  sp.school_id = p_school_id
  ORDER  BY sp.paid_at DESC;
END;
$$;


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
  -- Turning a subdomain back on is the owner's decision about their own
  -- school, or the platform owner's about any.
  IF NOT (is_super_admin()
          OR (p_school_id = auth_school_id()
              AND COALESCE(auth_user_role()::TEXT, '') IN ('proprietor', 'it_admin'))) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

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

NOTIFY pgrst, 'reload schema';
