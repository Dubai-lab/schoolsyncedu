-- Migration 075: Add Stripe as optional payment gateway for schools
-- Run this in: Supabase Dashboard → SQL Editor → New query
--
-- Schools can now choose Stripe (card payments) alongside Flutterwave,
-- MTN MoMo, Orange Money, and Bank Transfer.
-- Only the school owner (proprietor) can configure this.

-- ── 1. Add Stripe columns ─────────────────────────────────────────────────────
ALTER TABLE school_payment_configs
  ADD COLUMN IF NOT EXISTS stripe_public_key  TEXT    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS stripe_secret_key  TEXT    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS stripe_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stripe_currency    TEXT    NOT NULL DEFAULT 'USD';

-- ── 2. Rebuild get_payment_config_public to expose Stripe public fields ───────
-- (never returns secret_key)
CREATE OR REPLACE FUNCTION get_payment_config_public(p_school_id UUID)
RETURNS TABLE (
  flw_enabled          BOOLEAN,
  flw_public_key       TEXT,
  flw_methods          TEXT[],
  flw_currency         TEXT,
  mtn_enabled          BOOLEAN,
  mtn_merchant_code    TEXT,
  orange_enabled       BOOLEAN,
  orange_merchant_code TEXT,
  bank_enabled         BOOLEAN,
  bank_account_name    TEXT,
  bank_account_number  TEXT,
  bank_name            TEXT,
  bank_routing_number  TEXT,
  bank_swift_code      TEXT,
  bank_instructions    TEXT,
  stripe_enabled       BOOLEAN,
  stripe_public_key    TEXT,
  stripe_currency      TEXT,
  payment_title        TEXT,
  payment_logo         TEXT
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
    c.orange_enabled,
    c.orange_merchant_code,
    c.bank_enabled,
    c.bank_account_name,
    c.bank_account_number,
    c.bank_name,
    c.bank_routing_number,
    c.bank_swift_code,
    c.bank_instructions,
    c.stripe_enabled,
    c.stripe_public_key,
    c.stripe_currency,
    c.payment_title,
    c.payment_logo
  FROM school_payment_configs c
  WHERE c.school_id = p_school_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_payment_config_public(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
