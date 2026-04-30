-- Migration 094: Add Flutterwave ('flw') to school_mobile_payments gateway constraint
-- Migration 093 created the table with CHECK (gateway IN ('mtn','orange')).
-- We expand the constraint to include 'flw' so Flutterwave payments can be tracked.

ALTER TABLE school_mobile_payments
  DROP CONSTRAINT IF EXISTS school_mobile_payments_gateway_check;

ALTER TABLE school_mobile_payments
  ADD CONSTRAINT school_mobile_payments_gateway_check
  CHECK (gateway IN ('mtn', 'orange', 'flw'));
