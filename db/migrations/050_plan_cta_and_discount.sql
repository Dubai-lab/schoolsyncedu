-- ============================================================
-- Migration 050: Per-plan CTA button text + yearly discount %
-- Allows super admin to set the button label and yearly saving
-- shown on the public pricing page for each plan independently.
-- ============================================================

ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS cta_button_text        TEXT    NOT NULL DEFAULT 'Start Free Trial',
  ADD COLUMN IF NOT EXISTS yearly_discount_percent INTEGER NOT NULL DEFAULT 20;

-- Clamp discount to a sensible range via a check constraint
ALTER TABLE subscription_plans
  DROP CONSTRAINT IF EXISTS chk_yearly_discount_range;
ALTER TABLE subscription_plans
  ADD CONSTRAINT chk_yearly_discount_range
    CHECK (yearly_discount_percent >= 0 AND yearly_discount_percent <= 100);
