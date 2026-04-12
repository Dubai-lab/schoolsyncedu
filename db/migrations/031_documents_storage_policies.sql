-- ============================================================
-- Migration 031: Storage bucket + policies for the `documents`
-- bucket used by:
--   • Fee payment receipts  (receipts/{school_id}/...)
--   • Student photos        (students/{school_id}/...)
-- ============================================================

-- 1. Create the bucket if it doesn't already exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Drop any old policies to allow clean re-run
DROP POLICY IF EXISTS "Public read on documents"          ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload to documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update documents"    ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete documents"    ON storage.objects;

-- 3. Public read (receipt URLs and student photo URLs are used in public-facing views)
CREATE POLICY "Public read on documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documents');

-- 4. Any authenticated user can upload
CREATE POLICY "Authenticated upload to documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'documents');

-- 5. Any authenticated user can overwrite (upsert: true)
CREATE POLICY "Authenticated update documents"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'documents')
  WITH CHECK (bucket_id = 'documents');

-- 6. Any authenticated user can delete
CREATE POLICY "Authenticated delete documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'documents');
