-- ============================================================
-- Migration 223: Returning a book never marked it returned
--
-- ── THE BUG ─────────────────────────────────────────────────────────────────
--
--   RLS is enabled on book_checkouts, and it has exactly two policies:
--   book_checkouts_select and book_checkouts_write (FOR INSERT). There is no
--   UPDATE policy anywhere in the migration history.
--
--   Every other library table is written FOR ALL — books, book_copies,
--   book_returns — so they permit updates. book_checkouts is the one that was
--   split into separate SELECT and INSERT policies, and the UPDATE half was
--   never added.
--
--   libraryService.returnBook ends with:
--
--     await supabase.from('book_checkouts')
--       .update({ is_returned: true, return_date: ... })
--
--   With no permissive UPDATE policy that statement matches zero rows. The
--   result is never checked, so it fails without a word. The return row is
--   written, the copy goes back to 'available', and the checkout stays open.
--
--   So the book comes back to the shelf while the student's account still says
--   they have it — forever. It keeps appearing on their portal, it keeps
--   ageing into the overdue list, and a fine keeps accruing on a book sitting
--   in the library.
--
--   Migration 213 looked like it fixed this. It added return_date and
--   backfilled it from book_returns, which repaired every historical row in
--   one pass — and hid the fact that the live path still could not write. Any
--   return taken since then has failed the same silent way.
--
-- ── ALSO: EVERY STUDENT COULD READ EVERY BORROWING RECORD ───────────────────
--
--   book_checkouts_select allows any row whose student belongs to the caller's
--   school. For a student caller that is every row in the school, so a student
--   could list what every other student has borrowed and when.
--
--   Same shape as the students and guardians tables in migration 220, and the
--   same fix: staff keep the school-wide view they need to run a library,
--   students see their own loans, parents see their children's.
--
-- ROLLBACK
--   DROP POLICY book_checkouts_update ON book_checkouts;
--   -- and restore book_checkouts_select from migration 006
-- ============================================================

-- ── The missing half ────────────────────────────────────────────────────────
-- Mirrors book_checkouts_write: same roles, same school test, so a librarian
-- can close a loan exactly where they were already allowed to open one.
DROP POLICY IF EXISTS book_checkouts_update ON book_checkouts;
CREATE POLICY book_checkouts_update ON book_checkouts
  FOR UPDATE
  USING (
    is_super_admin()
    OR (
      student_id IN (SELECT id FROM students WHERE school_id = auth_school_id())
      AND auth_user_role() IN ('librarian'::user_role, 'admin_staff'::user_role)
    )
  )
  WITH CHECK (
    is_super_admin()
    OR (
      student_id IN (SELECT id FROM students WHERE school_id = auth_school_id())
      AND auth_user_role() IN ('librarian'::user_role, 'admin_staff'::user_role)
    )
  );


-- ── Borrowing history is not public to the school ───────────────────────────
DROP POLICY IF EXISTS book_checkouts_select        ON book_checkouts;
DROP POLICY IF EXISTS book_checkouts_select_policy ON book_checkouts;

CREATE POLICY book_checkouts_select ON book_checkouts
  FOR SELECT USING (
    is_super_admin()
    -- Staff: the whole school, which is what running a library needs.
    OR (
      student_id IN (SELECT id FROM students WHERE school_id = auth_school_id())
      AND COALESCE(auth_user_role()::TEXT, '') NOT IN ('student', 'parent')
    )
    -- A student, only their own loans.
    OR student_id = auth_student_id()
    -- A parent, only their children's.
    OR student_id IN (SELECT auth_guardian_student_ids())
  );

NOTIFY pgrst, 'reload schema';
