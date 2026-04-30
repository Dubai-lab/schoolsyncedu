-- ============================================================
-- Migration 093: School-level MTN & Orange Money payment tracking
--
-- Adds:
--   1. mtn_user_id / orange_user_id columns to school_payment_configs
--      (schools enter these from their MTN/Orange developer accounts)
--   2. school_mobile_payments table — tracks every payment request
--      initiated through school MTN/Orange APIs so status can be polled
--   3. Updates get_payment_config_public RPC to expose mtn_has_api /
--      orange_has_api flags (tells the frontend to show the automated
--      push-payment form vs the manual merchant-code instructions)
-- ============================================================

-- ── 1. Add API credential columns ────────────────────────────────────────────
ALTER TABLE school_payment_configs
  ADD COLUMN IF NOT EXISTS mtn_user_id    TEXT,
  ADD COLUMN IF NOT EXISTS orange_user_id TEXT;

-- ── 2. Tracking table for school mobile payment requests ─────────────────────

CREATE TABLE IF NOT EXISTS school_mobile_payments (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID    NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  gateway         TEXT    NOT NULL CHECK (gateway IN ('mtn','orange')),
  payment_type    TEXT    NOT NULL CHECK (payment_type IN ('student_fee','application_fee')),
  student_fee_id  UUID    REFERENCES student_fees(id)          ON DELETE SET NULL,
  application_id  UUID    REFERENCES student_applications(id)  ON DELETE SET NULL,
  reference_id    TEXT    NOT NULL UNIQUE,  -- UUID sent to the gateway as X-Reference-Id
  amount_usd      DECIMAL(10,2) NOT NULL,
  phone_number    TEXT    NOT NULL,
  status          TEXT    NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','successful','failed')),
  gateway_response JSONB,
  activated       BOOLEAN NOT NULL DEFAULT FALSE,  -- TRUE once fee/app is marked paid
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

ALTER TABLE school_mobile_payments ENABLE ROW LEVEL SECURITY;

-- Service-role edge functions have full access
CREATE POLICY smp_service ON school_mobile_payments
  USING (TRUE) WITH CHECK (TRUE);

-- Authenticated users can read their own school's records (for polling)
CREATE POLICY smp_select ON school_mobile_payments
  FOR SELECT USING (
    school_id = (SELECT school_id FROM users WHERE auth_id = auth.uid() LIMIT 1)
  );

-- ── 3. Extend get_payment_config_public ───────────────────────────────────────
--    Adds mtn_has_api and orange_has_api booleans.
--    Frontend uses these to decide: show automated push form (TRUE)
--    or show manual merchant-code instructions (FALSE).

CREATE OR REPLACE FUNCTION get_payment_config_public(p_school_id UUID)
RETURNS TABLE (
  flw_enabled           BOOLEAN,
  flw_public_key        TEXT,
  flw_methods           TEXT[],
  flw_currency          TEXT,
  mtn_enabled           BOOLEAN,
  mtn_merchant_code     TEXT,
  mtn_has_api           BOOLEAN,
  orange_enabled        BOOLEAN,
  orange_merchant_code  TEXT,
  orange_has_api        BOOLEAN,
  stripe_enabled        BOOLEAN,
  stripe_public_key     TEXT,
  stripe_currency       TEXT,
  bank_enabled          BOOLEAN,
  payment_title         TEXT,
  payment_logo          TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.flw_enabled,
    c.flw_public_key,
    c.flw_methods,
    c.flw_currency,
    c.mtn_enabled,
    c.mtn_merchant_code,
    -- has_api = school entered subscription_key (stored in mtn_api_key) + user_id
    (c.mtn_api_key IS NOT NULL AND c.mtn_api_key <> ''
     AND c.mtn_user_id IS NOT NULL AND c.mtn_user_id <> '') AS mtn_has_api,
    c.orange_enabled,
    c.orange_merchant_code,
    (c.orange_api_key IS NOT NULL AND c.orange_api_key <> ''
     AND c.orange_user_id IS NOT NULL AND c.orange_user_id <> '') AS orange_has_api,
    c.stripe_enabled,
    c.stripe_public_key,
    c.stripe_currency,
    c.bank_enabled,
    c.payment_title,
    c.payment_logo
  FROM school_payment_configs c
  WHERE c.school_id = p_school_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_payment_config_public(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_payment_config_public(UUID) TO anon;

NOTIFY pgrst, 'reload schema';
