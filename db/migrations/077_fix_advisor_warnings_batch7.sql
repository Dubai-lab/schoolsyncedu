-- Migration 077: Fix Supabase Advisor warnings — batch 7
-- 1. search_path fix for notification_already_sent + update_enterprise_inquiry_timestamp
-- 2. Drop overly-permissive WITH CHECK (true) INSERT policies on log/payment tables
--    (inserts go through SECURITY DEFINER RPCs which bypass RLS)
-- 3. Tighten storage SELECT policies to block directory listing
-- 4. Make bank-transfer-proofs bucket private (financial docs must not be public URLs)
-- NOTE: student_applications and enterprise_inquiries keep WITH CHECK (true)
--       intentionally — both are public-facing forms that anon users must submit.

-- ── search_path fixes ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notification_already_sent(
  p_school_id    UUID,
  p_event_type   TEXT,
  p_within_hours INTEGER DEFAULT 20
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM notification_logs
    WHERE school_id  = p_school_id
      AND event_type = p_event_type
      AND sent_at    > now() - (p_within_hours || ' hours')::interval
  );
$$;

CREATE OR REPLACE FUNCTION public.update_enterprise_inquiry_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ── Drop unrestricted INSERT policies (SECURITY DEFINER RPCs bypass RLS anyway) ──

DROP POLICY IF EXISTS audit_logs_insert            ON audit_logs;
DROP POLICY IF EXISTS letter_audit_log_insert      ON letter_audit_log;
DROP POLICY IF EXISTS platform_payments_rpc_insert ON platform_payments;
DROP POLICY IF EXISTS billing_invoices_rpc_insert  ON billing_invoices;
DROP POLICY IF EXISTS subscription_history_rpc_insert ON subscription_history;
DROP POLICY IF EXISTS system_logs_insert           ON system_logs;
DROP POLICY IF EXISTS "notif_service_insert"       ON user_notifications;

-- ── Tighten storage SELECT policies to block directory listing ────────────────
-- Public URL access works without any SELECT policy on a public bucket.
-- Authenticated-only SELECT stops clients from listing all files.

DROP POLICY IF EXISTS "Public read access on school-assets" ON storage.objects;
DROP POLICY IF EXISTS "school-assets read" ON storage.objects;
CREATE POLICY "school-assets read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'school-assets' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Public read on documents" ON storage.objects;
DROP POLICY IF EXISTS "documents read" ON storage.objects;
CREATE POLICY "documents read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documents' AND auth.role() = 'authenticated');

-- ── bank-transfer-proofs: make private + restrict reads to school staff ───────
-- Bank transfer proof images are sensitive financial documents.
-- Making the bucket private means files are NOT accessible via public URL —
-- only authenticated requests with a valid signed URL or policy match work.
UPDATE storage.buckets
SET public = false
WHERE id = 'bank-transfer-proofs';

DROP POLICY IF EXISTS "authenticated_read_proofs" ON storage.objects;
DROP POLICY IF EXISTS "bank-transfer-proofs read" ON storage.objects;
CREATE POLICY "bank-transfer-proofs read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'bank-transfer-proofs'
    AND (
      SELECT role FROM public.users WHERE auth_id = auth.uid()
    ) IN ('bursar', 'principal', 'super_admin')
  );

NOTIFY pgrst, 'reload schema';
