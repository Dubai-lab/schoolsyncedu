-- Migration 060: Bank Transfer Payment Method
-- Run this in your Supabase SQL editor (Dashboard → SQL Editor → New query)

-- ── 1. Add bank transfer columns to school_payment_configs ────────────────────
ALTER TABLE school_payment_configs
  ADD COLUMN IF NOT EXISTS bank_enabled         BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS bank_account_name    TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS bank_account_number  TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS bank_name            TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS bank_routing_number  TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS bank_swift_code      TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS bank_instructions    TEXT    DEFAULT '';

-- ── 2. Expose bank fields in the public config RPC ────────────────────────────
-- If you have a get_payment_config_public function, update it to include bank fields.
-- Example update (adjust to match your existing function body):
--
-- CREATE OR REPLACE FUNCTION get_payment_config_public(p_school_id UUID)
-- RETURNS TABLE (...existing fields..., bank_enabled BOOLEAN, bank_account_name TEXT,
--   bank_account_number TEXT, bank_name TEXT, bank_routing_number TEXT,
--   bank_swift_code TEXT, bank_instructions TEXT)
-- LANGUAGE sql SECURITY DEFINER AS $$
--   SELECT ...existing fields..., bank_enabled, bank_account_name,
--          bank_account_number, bank_name, bank_routing_number,
--          bank_swift_code, bank_instructions
--   FROM school_payment_configs WHERE school_id = p_school_id;
-- $$;

-- ── 3. Create bank_transfer_proofs table ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS bank_transfer_proofs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         UUID        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id        UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  student_fee_id    UUID        NOT NULL REFERENCES student_fees(id) ON DELETE CASCADE,
  amount_usd        NUMERIC(10,2) NOT NULL,
  reference_number  TEXT        NOT NULL,
  proof_url         TEXT,
  proof_filename    TEXT,
  status            TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'verified', 'rejected')),
  student_notes     TEXT,
  bursar_notes      TEXT,
  verified_by       UUID        REFERENCES users(id),
  verified_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_btp_school_status ON bank_transfer_proofs(school_id, status);
CREATE INDEX IF NOT EXISTS idx_btp_student_fee   ON bank_transfer_proofs(student_fee_id);

-- ── 4. RLS policies for bank_transfer_proofs ──────────────────────────────────
ALTER TABLE bank_transfer_proofs ENABLE ROW LEVEL SECURITY;

-- Students can insert their own proofs
CREATE POLICY "students_insert_own_proof" ON bank_transfer_proofs
  FOR INSERT TO authenticated
  WITH CHECK (
    student_id IN (
      SELECT id FROM students WHERE user_id = (
        SELECT id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

-- Students can read their own proofs
CREATE POLICY "students_read_own_proofs" ON bank_transfer_proofs
  FOR SELECT TO authenticated
  USING (
    student_id IN (
      SELECT id FROM students WHERE user_id = (
        SELECT id FROM users WHERE auth_id = auth.uid()
      )
    )
  );

-- Bursars and admins can read all proofs for their school
CREATE POLICY "bursar_read_school_proofs" ON bank_transfer_proofs
  FOR SELECT TO authenticated
  USING (
    school_id = (
      SELECT school_id FROM users WHERE auth_id = auth.uid()
    )
    AND (
      SELECT role FROM users WHERE auth_id = auth.uid()
    ) IN ('bursar', 'admin', 'proprietor', 'it_admin')
  );

-- Bursars can update (verify/reject) proofs for their school
CREATE POLICY "bursar_update_school_proofs" ON bank_transfer_proofs
  FOR UPDATE TO authenticated
  USING (
    school_id = (SELECT school_id FROM users WHERE auth_id = auth.uid())
    AND (SELECT role FROM users WHERE auth_id = auth.uid()) IN ('bursar', 'admin', 'proprietor')
  );

-- ── 5. Storage bucket for proof uploads ───────────────────────────────────────
-- Run this in the Supabase SQL editor:
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bank-transfer-proofs',
  'bank-transfer-proofs',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: students can upload to their school's folder
CREATE POLICY "students_upload_proof" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'bank-transfer-proofs'
    AND (SELECT role FROM users WHERE auth_id = auth.uid()) = 'student'
  );

-- Anyone authenticated can read proof images (bursars need to view them)
CREATE POLICY "authenticated_read_proofs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'bank-transfer-proofs');
