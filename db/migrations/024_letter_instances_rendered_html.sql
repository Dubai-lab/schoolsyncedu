-- ============================================================
-- Migration 024: Add rendered_html to letter_instances
-- ============================================================
-- Stores the fully resolved letter body (all {{placeholders}} replaced
-- with real school/student data) at the moment the letter is created.
-- This means print, PDF, and approval views always show the correct
-- school name, logo, address, etc. — not the raw template with {{tokens}}.
-- ============================================================

ALTER TABLE letter_instances
  ADD COLUMN IF NOT EXISTS rendered_html TEXT;

COMMENT ON COLUMN letter_instances.rendered_html IS
  'Fully resolved letter body HTML — all {{placeholders}} substituted with real school/student data at creation time.';
