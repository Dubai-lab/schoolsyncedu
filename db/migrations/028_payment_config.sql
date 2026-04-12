-- ============================================================
-- Migration 028: School Payment Configuration
--
-- Liberia payment reality:
--   • Flutterwave does NOT support Liberia (LRD) or Liberia
--     mobile money. It is used here for card-only payments
--     (international Visa/MasterCard charged in USD).
--   • MTN Mobile Money (Lonestar Cell MTN, "MoMo") and
--     Orange Money are the dominant local mobile money
--     providers and are integrated separately via their
--     direct APIs.
--
-- Table stores:
--   1. Flutterwave config (cards / bank transfer / international)
--   2. MTN MoMo config (merchant code + API key)
--   3. Orange Money config (merchant code + API key)
--
-- SaaS isolation:
--   • Only the school's proprietor can read/write this config.
--   • IT Admin has ZERO access.
-- ============================================================

CREATE TABLE IF NOT EXISTS school_payment_configs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL UNIQUE REFERENCES schools(id) ON DELETE CASCADE,

  -- ── Flutterwave (cards, bank transfer, international) ──────────
  flw_public_key   TEXT NOT NULL DEFAULT '',
  flw_secret_key   TEXT NOT NULL DEFAULT '',
  flw_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
  -- comma-separated Flutterwave payment_options string, e.g. "card, banktransfer"
  flw_methods      TEXT[] NOT NULL DEFAULT '{card}',
  flw_currency     TEXT NOT NULL DEFAULT 'USD',

  -- ── MTN MoMo (Lonestar Cell MTN, Liberia) ─────────────────────
  mtn_merchant_code TEXT NOT NULL DEFAULT '',
  mtn_api_key       TEXT NOT NULL DEFAULT '',
  mtn_enabled       BOOLEAN NOT NULL DEFAULT FALSE,

  -- ── Orange Money (Liberia) ─────────────────────────────────────
  orange_merchant_code TEXT NOT NULL DEFAULT '',
  orange_api_key       TEXT NOT NULL DEFAULT '',
  orange_enabled       BOOLEAN NOT NULL DEFAULT FALSE,

  -- ── Modal branding ─────────────────────────────────────────────
  payment_title    TEXT NOT NULL DEFAULT '',
  payment_logo     TEXT NOT NULL DEFAULT '',

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Index ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_school_payment_configs_school
  ON school_payment_configs(school_id);

-- ── RLS: proprietor-only, no IT Admin ──────────────────────────────
ALTER TABLE school_payment_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_config_select      ON school_payment_configs;
DROP POLICY IF EXISTS payment_config_insert      ON school_payment_configs;
DROP POLICY IF EXISTS payment_config_update      ON school_payment_configs;
DROP POLICY IF EXISTS payment_config_delete      ON school_payment_configs;
DROP POLICY IF EXISTS payment_config_super_admin ON school_payment_configs;

CREATE POLICY payment_config_select ON school_payment_configs
  FOR SELECT USING (
    school_id = auth_school_id()
    AND auth_user_role() = 'proprietor'::user_role
  );

CREATE POLICY payment_config_insert ON school_payment_configs
  FOR INSERT WITH CHECK (
    school_id = auth_school_id()
    AND auth_user_role() = 'proprietor'::user_role
  );

CREATE POLICY payment_config_update ON school_payment_configs
  FOR UPDATE USING (
    school_id = auth_school_id()
    AND auth_user_role() = 'proprietor'::user_role
  );

CREATE POLICY payment_config_delete ON school_payment_configs
  FOR DELETE USING (
    school_id = auth_school_id()
    AND auth_user_role() = 'proprietor'::user_role
  );

CREATE POLICY payment_config_super_admin ON school_payment_configs
  FOR ALL USING (is_super_admin());

-- ── updated_at trigger ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_payment_config_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payment_config_updated_at ON school_payment_configs;

CREATE TRIGGER trg_payment_config_updated_at
  BEFORE UPDATE ON school_payment_configs
  FOR EACH ROW EXECUTE FUNCTION set_payment_config_updated_at();

-- ============================================================
-- RPC: get_payment_config_public
-- Returns ONLY the safe public fields for the payment widget.
-- Never returns any secret key.
-- Available to all authenticated users (so student fee pages
-- and application forms can load the widget config).
-- ============================================================

CREATE OR REPLACE FUNCTION get_payment_config_public(p_school_id UUID)
RETURNS TABLE (
  flw_enabled           BOOLEAN,
  flw_public_key        TEXT,
  flw_methods           TEXT[],
  flw_currency          TEXT,
  mtn_enabled           BOOLEAN,
  mtn_merchant_code     TEXT,
  orange_enabled        BOOLEAN,
  orange_merchant_code  TEXT,
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
    c.orange_enabled,
    c.orange_merchant_code,
    c.payment_title,
    c.payment_logo
  FROM school_payment_configs c
  WHERE c.school_id = p_school_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_payment_config_public(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
