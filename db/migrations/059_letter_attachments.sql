-- Migration 059: Custom letter attachments
-- Adds attachment support to letter_instances and creates the letter-documents storage bucket.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Add attachment columns to letter_instances
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE letter_instances
  ADD COLUMN IF NOT EXISTS attachment_url  TEXT,        -- storage path in letter-documents bucket
  ADD COLUMN IF NOT EXISTS attachment_name TEXT,        -- original filename shown to recipient
  ADD COLUMN IF NOT EXISTS is_custom       BOOLEAN NOT NULL DEFAULT FALSE;
  -- is_custom = TRUE means it was uploaded by staff (not generated from a template)

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Storage bucket: letter-documents
--    Stores uploaded Word / PDF letters.
--    Path convention: {school_id}/{timestamp}_{filename}
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'letter-documents',
  'letter-documents',
  FALSE,                       -- private — access via signed URLs only
  20971520,                    -- 20 MB limit per file
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: school staff can upload/read/delete only their school's files
CREATE POLICY "letter_docs_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'letter-documents'
    AND (storage.foldername(name))[1] = (
      SELECT school_id::TEXT FROM users WHERE auth_id = auth.uid() LIMIT 1
    )
  );

CREATE POLICY "letter_docs_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'letter-documents'
    AND (storage.foldername(name))[1] = (
      SELECT school_id::TEXT FROM users WHERE auth_id = auth.uid() LIMIT 1
    )
  );

CREATE POLICY "letter_docs_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'letter-documents'
    AND (storage.foldername(name))[1] = (
      SELECT school_id::TEXT FROM users WHERE auth_id = auth.uid() LIMIT 1
    )
  );

-- Service role can read all (needed by edge function to generate signed URLs)
CREATE POLICY "letter_docs_service_role"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'letter-documents')
  WITH CHECK (bucket_id = 'letter-documents');
