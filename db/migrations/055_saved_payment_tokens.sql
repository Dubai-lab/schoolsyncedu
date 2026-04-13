-- ============================================================
-- Migration 055: Saved payment tokens (Flutterwave card tokenization)
-- Allows proprietors to save a card for future auto-pay / renewal
-- ============================================================

CREATE TABLE IF NOT EXISTS saved_payment_tokens (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  provider     TEXT        NOT NULL DEFAULT 'flutterwave',
  -- Card display info (non-sensitive, from Flutterwave response)
  card_last4   TEXT,
  card_type    TEXT,         -- 'visa', 'mastercard', 'verve', etc.
  card_expiry  TEXT,         -- 'MM/YY' display only
  card_name    TEXT,         -- cardholder name
  email        TEXT,         -- email used for payment
  -- The actual token (used to charge without re-entering card details)
  flw_token    TEXT        NOT NULL,
  -- Default flag — only one row per school should be default
  is_default   BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_saved_tokens_school ON saved_payment_tokens (school_id);

-- RLS
ALTER TABLE saved_payment_tokens ENABLE ROW LEVEL SECURITY;

-- Proprietors can read/write their own school's tokens
CREATE POLICY "proprietor_manage_tokens"
  ON saved_payment_tokens
  FOR ALL
  TO authenticated
  USING (
    school_id = (
      SELECT school_id FROM users
      WHERE id = auth.uid() AND role = 'proprietor'
    )
  )
  WITH CHECK (
    school_id = (
      SELECT school_id FROM users
      WHERE id = auth.uid() AND role = 'proprietor'
    )
  );

-- Service role (edge functions) can read/write all tokens for charging
CREATE POLICY "service_role_tokens"
  ON saved_payment_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Helper: ensure only one default per school
CREATE OR REPLACE FUNCTION ensure_single_default_token()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE saved_payment_tokens
    SET is_default = false
    WHERE school_id = NEW.school_id
      AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_single_default_token
  AFTER INSERT OR UPDATE OF is_default ON saved_payment_tokens
  FOR EACH ROW EXECUTE FUNCTION ensure_single_default_token();
