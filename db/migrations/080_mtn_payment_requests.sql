-- ============================================================
-- Migration 080: MTN MoMo payment requests tracking table
-- ============================================================

CREATE TABLE IF NOT EXISTS mtn_payment_requests (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  subscription_id UUID        NOT NULL REFERENCES subscriptions(id),
  reference_id    UUID        NOT NULL UNIQUE,  -- X-Reference-Id used with MTN API
  amount          DECIMAL(10,2) NOT NULL,
  currency        TEXT        NOT NULL DEFAULT 'EUR',
  phone_number    TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'PENDING'
                  CHECK (status IN ('PENDING', 'SUCCESSFUL', 'FAILED')),
  mtn_response    JSONB,
  activated       BOOLEAN     NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE mtn_payment_requests ENABLE ROW LEVEL SECURITY;

-- Service role (edge functions) can do everything
CREATE POLICY "mtn_service_all" ON mtn_payment_requests
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated school members can see their own school's requests
CREATE POLICY "mtn_school_member_select" ON mtn_payment_requests
  FOR SELECT TO authenticated USING (
    school_id IN (
      SELECT school_id FROM users WHERE id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_mtn_payment_requests_school_id        ON mtn_payment_requests(school_id);
CREATE INDEX IF NOT EXISTS idx_mtn_payment_requests_reference_id     ON mtn_payment_requests(reference_id);
CREATE INDEX IF NOT EXISTS idx_mtn_payment_requests_subscription_id  ON mtn_payment_requests(subscription_id);
CREATE INDEX IF NOT EXISTS idx_mtn_payment_requests_status           ON mtn_payment_requests(status) WHERE status = 'PENDING';

NOTIFY pgrst, 'reload schema';
