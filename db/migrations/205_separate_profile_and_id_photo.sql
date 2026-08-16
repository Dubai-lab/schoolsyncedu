-- ============================================================
-- Migration 205: Separate the student's profile photo from their ID photo
--
-- Problem:
--   students.photo_url serves two different purposes that must not be the
--   same value:
--
--     - the OFFICIAL ID photo, chosen or taken by the school. ITCardGenerator
--       writes it (lines 483 and 520) and the printed card renders it.
--     - the student's own PROFILE picture, which they upload from the portal
--       via update_my_photo_url (migration 088).
--
--   Because both wrote photo_url, a student changing their profile picture
--   silently changed the photo on their identity card. That inverts who
--   controls an identity document: the school issues it, so the school owns
--   the photo on it. A student could put any image on their own ID.
--
-- Fix:
--   photo_url stays the official, school-controlled ID photo — no data moves,
--   and every existing card keeps the photo it was issued with.
--   profile_photo_url is new and student-controlled.
--
--   update_my_photo_url now writes profile_photo_url ONLY, so the portal can
--   no longer reach the ID photo through any path.
--
-- Direction of fallback matters:
--   The portal may fall back to showing the official photo when a student has
--   not uploaded one, so their profile is not blank. The card must NEVER fall
--   back to the profile photo — that would reopen exactly this hole.
-- ============================================================


-- ============================================================
-- 1. COLUMN
-- ============================================================

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;

COMMENT ON COLUMN students.profile_photo_url IS
  'Student-uploaded profile picture for the portal. Never used on the ID card — see students.photo_url for the official school-issued photo.';

COMMENT ON COLUMN students.photo_url IS
  'Official school-issued ID photo. Written by school staff only (ITCardGenerator). Students cannot modify this.';


-- ============================================================
-- 2. SEED EXISTING STUDENTS
--    Copy the current photo across once so nobody sees a blank avatar the
--    day this ships. From here the two evolve independently: this is a
--    one-time copy, not a sync.
-- ============================================================

UPDATE students
SET    profile_photo_url = photo_url
WHERE  profile_photo_url IS NULL
  AND  photo_url IS NOT NULL;


-- ============================================================
-- 3. REDIRECT THE STUDENT-FACING RPC
--    Same signature, so the app keeps calling it unchanged — only the target
--    column moves. Replaces the definition from migration 088.
-- ============================================================

CREATE OR REPLACE FUNCTION update_my_photo_url(p_photo_url TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- profile_photo_url, NOT photo_url. A student updating their portal picture
  -- must not alter the photo on their identity card.
  UPDATE students
     SET profile_photo_url = NULLIF(p_photo_url, ''),
         updated_at        = NOW()
   WHERE user_id = (SELECT id FROM users WHERE auth_id = auth.uid());
END;
$$;

GRANT EXECUTE ON FUNCTION update_my_photo_url(TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';


-- ============================================================
-- 4. VERIFICATION
--
--   -- Column exists and was seeded:
--   SELECT count(*) FILTER (WHERE profile_photo_url IS NOT NULL) AS seeded,
--          count(*)                                             AS total
--   FROM   students;
--
--   -- The RPC targets the right column:
--   SELECT prosrc LIKE '%profile_photo_url%' AS writes_profile,
--          prosrc LIKE '%SET photo_url%'     AS still_writes_id_photo
--   FROM   pg_proc WHERE proname = 'update_my_photo_url';
--   -- expect: writes_profile = true, still_writes_id_photo = false
--
--   -- End to end: change a profile photo from the student portal, then
--   -- confirm photo_url is untouched for that student.
-- ============================================================
