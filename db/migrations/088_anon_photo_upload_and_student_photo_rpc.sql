-- ============================================================
-- Migration 088: Allow anonymous photo uploads from the public
--   application form, and add an RPC for students to update
--   their own photo_url from the profile page.
--
-- Problem: The application form is a public (unauthenticated) page.
-- The documents bucket previously only allowed authenticated uploads,
-- causing passport photo uploads to silently fail — photoUrl was
-- never stored, so students had no profile picture after enrollment.
-- ============================================================


-- ── 1. Allow anon uploads to student-photos/ in the documents bucket ──────────

DROP POLICY IF EXISTS "Anon upload student photos" ON storage.objects;

CREATE POLICY "Anon upload student photos"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (
    bucket_id = 'documents'
    AND name LIKE 'student-photos/%'
  );


-- ── 2. update_my_photo_url — student self-service photo upload ────────────────
-- Students cannot update the students table directly (RLS blocks it).
-- This SECURITY DEFINER function lets a logged-in student update only
-- their own photo_url.

CREATE OR REPLACE FUNCTION update_my_photo_url(p_photo_url TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE students
     SET photo_url  = NULLIF(p_photo_url, ''),
         updated_at = NOW()
   WHERE user_id = (SELECT id FROM users WHERE auth_id = auth.uid());
END;
$$;

GRANT EXECUTE ON FUNCTION update_my_photo_url(TEXT) TO authenticated;


NOTIFY pgrst, 'reload schema';
