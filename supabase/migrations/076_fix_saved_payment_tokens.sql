-- Migration 076: Fix saved_payment_tokens for Stripe-only card saving
--
-- Problems:
--   1. flw_token is NOT NULL with no default — Stripe inserts omit it → silent fail
--   2. No `provider` column — every insert must now specify the gateway
--   3. No RLS SELECT policy for authenticated proprietors → hasDefault() always 0
--
-- Run in: Supabase Dashboard → SQL Editor → New query

-- ── 1. Make flw_token nullable (was NOT NULL, breaks Stripe inserts) ──────────
ALTER TABLE saved_payment_tokens
  ALTER COLUMN flw_token DROP NOT NULL,
  ALTER COLUMN flw_token SET DEFAULT '';

-- ── 2. Add provider column (stripe | flutterwave) ─────────────────────────────
ALTER TABLE saved_payment_tokens
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'stripe';

-- ── 3. Ensure RLS is enabled ──────────────────────────────────────────────────
ALTER TABLE saved_payment_tokens ENABLE ROW LEVEL SECURITY;

-- ── 4. SELECT policy: proprietor of this school can read their cards ─────────
DROP POLICY IF EXISTS "School owner can read their saved cards" ON saved_payment_tokens;
CREATE POLICY "School owner can read their saved cards"
  ON saved_payment_tokens
  FOR SELECT
  TO authenticated
  USING (
    school_id IN (
      SELECT school_id FROM users
      WHERE auth_id = auth.uid()
        AND role = 'proprietor'
    )
  );

-- ── 5. INSERT/UPDATE/DELETE: still blocked for client — Edge Functions use ─────
--     service role which bypasses RLS entirely, so no extra policies needed.

NOTIFY pgrst, 'reload schema';
