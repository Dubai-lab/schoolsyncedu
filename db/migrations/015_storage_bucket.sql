-- ============================================================
-- Migration 015: Storage policies for school-assets bucket
-- ============================================================
-- PREREQUISITE: Create the bucket "school-assets" via the Supabase
-- Dashboard → Storage → New Bucket → name: school-assets → Public: ON
--
-- Then run this SQL in the Supabase SQL Editor.

-- 0. Clean up any previous attempts
DROP POLICY IF EXISTS "Public read access on school-assets" ON storage.objects;
DROP POLICY IF EXISTS "School staff can upload to own school folder" ON storage.objects;
DROP POLICY IF EXISTS "School staff can update own school folder" ON storage.objects;
DROP POLICY IF EXISTS "School staff can delete from own school folder" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload school-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update school-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete school-assets" ON storage.objects;

-- 1. Anyone can read (logos are shown on public school sites)
CREATE POLICY "Public read access on school-assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'school-assets');

-- 2. Any authenticated user can upload
CREATE POLICY "Authenticated users can upload school-assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'school-assets');

-- 3. Any authenticated user can update / overwrite
CREATE POLICY "Authenticated users can update school-assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'school-assets')
  WITH CHECK (bucket_id = 'school-assets');

-- 4. Any authenticated user can delete
CREATE POLICY "Authenticated users can delete school-assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'school-assets');
