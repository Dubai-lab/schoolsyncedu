-- 099_subdomain_pricing.sql
-- Dynamic pricing for the Custom Subdomain add-on.
-- Adds: platform_settings table, subdomain_payments table,
--       subdomain_plan column on schools, updated activate RPC
--       with monthly/yearly plan support + proration + payment recording,
--       and a daily pg_cron job to auto-deactivate expired subdomains.

-- ── Platform settings (key-value store for system-wide config) ─────────────────

CREATE TABLE IF NOT EXISTS platform_settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL DEFAULT '{}'
);

-- Default subdomain pricing: $1/month, 20% off for yearly
INSERT INTO platform_settings (key, value)
VALUES ('subdomain_addon', '{"monthly_price_usd": 1.00, "yearly_discount_percent": 20}')
ON CONFLICT (key) DO NOTHING;

-- ── subdomain_payments table ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS subdomain_payments (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id    uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  amount_usd   numeric(10,2) NOT NULL,
  plan         text        NOT NULL CHECK (plan IN ('monthly', 'yearly')),
  gateway_ref  text,
  paid_at      timestamptz NOT NULL DEFAULT now(),
  paid_until   timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS subdomain_payments_school_idx ON subdomain_payments(school_id);

ALTER TABLE subdomain_payments ENABLE ROW LEVEL SECURITY;

-- Schools can read their own payment records (joined via users table)
CREATE POLICY "school members view own subdomain payments"
  ON subdomain_payments FOR SELECT TO authenticated
  USING (
    school_id IN (
      SELECT school_id FROM users WHERE id = auth.uid()
    )
  );

-- ── Add subdomain_plan to schools ──────────────────────────────────────────────

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS subdomain_plan text DEFAULT 'monthly'
    CHECK (subdomain_plan IN ('monthly', 'yearly'));

-- ── Replace activate_subdomain_addon (new signature adds plan + amount) ────────

DROP FUNCTION IF EXISTS activate_subdomain_addon(uuid, text, text, text);

CREATE FUNCTION activate_subdomain_addon(
  p_school_id    uuid,
  p_subdomain    text,
  p_gateway_ref  text,
  p_tx_ref       text,
  p_plan         text    DEFAULT 'monthly',
  p_amount_usd   numeric DEFAULT 1.00
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub          text;
  v_conflict     uuid;
  v_interval     interval;
  v_current_until timestamptz;
  v_new_until    timestamptz;
BEGIN
  v_sub := lower(trim(p_subdomain));

  -- Validate plan
  IF p_plan NOT IN ('monthly', 'yearly') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid plan. Choose monthly or yearly.');
  END IF;

  v_interval := CASE p_plan WHEN 'yearly' THEN interval '365 days' ELSE interval '30 days' END;

  -- Format validation
  IF length(v_sub) NOT BETWEEN 3 AND 30 OR NOT (v_sub ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'Invalid subdomain. Use 3–30 lowercase letters, numbers, or hyphens. Must start and end with a letter or number.'
    );
  END IF;

  -- Uniqueness check
  SELECT id INTO v_conflict
  FROM schools
  WHERE subdomain = v_sub AND id <> p_school_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'This subdomain is already taken. Please choose a different name.'
    );
  END IF;

  -- Proration: if paid_until is still in the future, extend from there
  SELECT subdomain_paid_until INTO v_current_until FROM schools WHERE id = p_school_id;

  v_new_until := CASE
    WHEN v_current_until IS NOT NULL AND v_current_until > now()
      THEN v_current_until + v_interval
    ELSE now() + v_interval
  END;

  -- Activate / renew
  UPDATE schools
  SET
    subdomain            = v_sub,
    subdomain_active     = true,
    subdomain_paid_until = v_new_until,
    subdomain_plan       = p_plan
  WHERE id = p_school_id;

  -- Record payment
  INSERT INTO subdomain_payments (school_id, amount_usd, plan, gateway_ref, paid_until)
  VALUES (p_school_id, p_amount_usd, p_plan, p_gateway_ref, v_new_until);

  RETURN jsonb_build_object(
    'success',    true,
    'subdomain',  v_sub,
    'paid_until', v_new_until::text
  );
END;
$$;

-- ── Pricing config RPCs ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_subdomain_addon_pricing()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT value FROM platform_settings WHERE key = 'subdomain_addon';
$$;

CREATE OR REPLACE FUNCTION set_subdomain_addon_pricing(
  p_monthly_price_usd       numeric,
  p_yearly_discount_percent integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO platform_settings (key, value)
  VALUES (
    'subdomain_addon',
    jsonb_build_object(
      'monthly_price_usd',       p_monthly_price_usd,
      'yearly_discount_percent', p_yearly_discount_percent
    )
  )
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
END;
$$;

-- ── Daily cleanup: deactivate subdomains after 24-hour grace period ────────────
-- Runs at 02:00 UTC every day via pg_cron (enabled by default on Supabase).

SELECT cron.schedule(
  'deactivate-expired-subdomains',
  '0 2 * * *',
  $$
    UPDATE schools
    SET subdomain_active = false
    WHERE subdomain_active = true
      AND subdomain_paid_until IS NOT NULL
      AND subdomain_paid_until < now() - interval '24 hours';
  $$
);

-- ── Grants ─────────────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION activate_subdomain_addon(uuid, text, text, text, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION get_subdomain_addon_pricing()                                   TO authenticated, anon;
GRANT EXECUTE ON FUNCTION set_subdomain_addon_pricing(numeric, integer)                   TO authenticated;
GRANT SELECT ON subdomain_payments TO authenticated;
