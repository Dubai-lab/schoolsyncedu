-- Migration 095: Add mtn_api_user_key to school_payment_configs
-- MTN MoMo token endpoint requires three distinct credentials:
--   mtn_api_key      → Ocp-Apim-Subscription-Key header (API product subscription key)
--   mtn_user_id      → Basic auth username (API User ID, a UUID you provision)
--   mtn_api_user_key → Basic auth password (API User Key, generated from provisioning API)
-- Previously we were incorrectly using mtn_api_key as the Basic auth password.

ALTER TABLE school_payment_configs
  ADD COLUMN IF NOT EXISTS mtn_api_user_key TEXT;

-- Recompute mtn_has_api: now requires subscription key + user_id + api_user_key
DROP FUNCTION IF EXISTS get_payment_config_public(UUID);

CREATE FUNCTION get_payment_config_public(p_school_id UUID)
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
    -- all three MTN credentials required for automated push payments
    (c.mtn_api_key IS NOT NULL AND c.mtn_api_key <> ''
     AND c.mtn_user_id IS NOT NULL AND c.mtn_user_id <> ''
     AND c.mtn_api_user_key IS NOT NULL AND c.mtn_api_user_key <> '') AS mtn_has_api,
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
