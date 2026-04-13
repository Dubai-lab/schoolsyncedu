-- Migration 052: Enterprise plan support + inquiry submissions
-- Adds is_enterprise flag to subscription_plans and creates enterprise_inquiries table

-- 1. Mark a plan as "enterprise" (no fixed price, contact-sales only)
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS is_enterprise BOOLEAN NOT NULL DEFAULT false;

-- 2. Store inbound enterprise inquiries from the pricing page contact form
CREATE TABLE IF NOT EXISTS enterprise_inquiries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_name     TEXT NOT NULL,
  contact_name    TEXT NOT NULL,
  email           TEXT NOT NULL,
  phone           TEXT,
  student_count   TEXT,               -- rough range entered by user, e.g. "2000-5000"
  modules_needed  TEXT,               -- free-text list of modules they want
  message         TEXT,               -- any additional requirements
  status          TEXT NOT NULL DEFAULT 'new'  -- new | contacted | closed
                    CHECK (status IN ('new', 'contacted', 'closed')),
  notes           TEXT,               -- internal admin notes
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_enterprise_inquiry_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enterprise_inquiry_updated ON enterprise_inquiries;
CREATE TRIGGER trg_enterprise_inquiry_updated
  BEFORE UPDATE ON enterprise_inquiries
  FOR EACH ROW EXECUTE FUNCTION update_enterprise_inquiry_timestamp();

-- Index for admin listing (newest first)
CREATE INDEX IF NOT EXISTS idx_enterprise_inquiries_created ON enterprise_inquiries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enterprise_inquiries_status  ON enterprise_inquiries(status);

-- RLS: only super admins can read/update; insert is open (public contact form)
ALTER TABLE enterprise_inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "enterprise_inquiries_insert" ON enterprise_inquiries;
CREATE POLICY "enterprise_inquiries_insert"
  ON enterprise_inquiries FOR INSERT
  WITH CHECK (true);  -- anyone can submit an inquiry

DROP POLICY IF EXISTS "enterprise_inquiries_admin_all" ON enterprise_inquiries;
CREATE POLICY "enterprise_inquiries_admin_all"
  ON enterprise_inquiries FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
        AND u.role = 'super_admin'
    )
  );
