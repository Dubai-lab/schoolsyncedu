-- ============================================================
-- Migration 226: Close the loans that were returned but never marked returned
--
-- ── WHAT THIS REPAIRS ───────────────────────────────────────────────────────
--
--   Until 223 there was no UPDATE policy on book_checkouts, so the last step
--   of returnBook — setting is_returned and return_date — matched zero rows,
--   silently, every time. The book came back, book_returns recorded it, the
--   copy went back to 'available', and the loan stayed open.
--
--   223 fixed the mechanism. It did not repair the rows already wrong, and
--   those do not fix themselves: nothing revisits an old loan. Until they are
--   closed, each one keeps showing on the student's portal, keeps appearing in
--   the overdue list, and keeps accruing a fine on a book that is on the shelf.
--
--   213 does not cover this. Its backfill required `is_returned IS TRUE` and
--   only filled in a missing return_date. These rows never got that far — they
--   are still marked out.
--
-- ── HOW A RETURN IS IDENTIFIED ──────────────────────────────────────────────
--
--   book_returns is the authority. Its rows were always written successfully;
--   it is the checkout side that could not be updated. A loan is closed when
--   there is a return for the same copy and the same student, dated on or
--   after the checkout — the same match 213 used, so the two agree.
--
--   Copy status is deliberately not used as evidence. A copy reads 'available'
--   for several reasons, and guessing from it would close loans that are
--   genuinely outstanding. Anything without a return record is left alone and
--   reported at the end for a librarian to look at.
--
-- ── SAFE TO RUN TWICE ───────────────────────────────────────────────────────
--   Only touches rows that are still open, so a second run finds nothing.
--
-- ROLLBACK
--   None. Closing these is the correction; the previous state was wrong.
-- ============================================================

DO $$
DECLARE
  v_closed    INT;
  v_orphaned  INT;
  v_remaining INT;
BEGIN
  -- Close every open loan that has a matching return record, dating it from
  -- the earliest return at or after the checkout.
  WITH matched AS (
    SELECT bc.id,
           (
             SELECT br.return_date
             FROM   book_returns br
             WHERE  br.book_copy_id = bc.book_copy_id
               AND  br.student_id   = bc.student_id
               AND  br.return_date >= bc.checkout_date
             ORDER  BY br.return_date
             LIMIT  1
           ) AS closed_on
    FROM   book_checkouts bc
    WHERE  COALESCE(bc.is_returned, FALSE) = FALSE
  )
  UPDATE book_checkouts bc
  SET    is_returned = TRUE,
         return_date = m.closed_on
  FROM   matched m
  WHERE  m.id = bc.id
    AND  m.closed_on IS NOT NULL;

  GET DIAGNOSTICS v_closed = ROW_COUNT;

  -- Loans still open with no return record. Either genuinely out, or returned
  -- without a return being recorded at all — which no migration can tell
  -- apart, so they are counted rather than guessed at.
  SELECT COUNT(*) INTO v_remaining
  FROM   book_checkouts bc
  WHERE  COALESCE(bc.is_returned, FALSE) = FALSE;

  -- Of those, the ones whose copy is already back on the shelf. Not closed
  -- here — flagged, because this is the set worth a librarian's eye.
  SELECT COUNT(*) INTO v_orphaned
  FROM   book_checkouts bc
  JOIN   book_copies c ON c.id = bc.book_copy_id
  WHERE  COALESCE(bc.is_returned, FALSE) = FALSE
    AND  c.status = 'available';

  RAISE NOTICE '--------------------------------------------------';
  RAISE NOTICE 'Library repair';
  RAISE NOTICE '  loans closed from a return record : %', v_closed;
  RAISE NOTICE '  loans still open                  : %', v_remaining;
  RAISE NOTICE '  of those, copy already available  : % (needs review)', v_orphaned;
  RAISE NOTICE '--------------------------------------------------';
END $$;


-- The review list, as a view rather than a one-off notice, so a librarian can
-- work through it after the fact: open loans whose copy is back on the shelf.
-- Each is either a return nobody recorded, or a copy marked available while
-- still out. Both need a person; neither should be guessed.
-- security_invoker so the view is read under the caller's own permissions and
-- the RLS on book_checkouts still applies. Without it a view runs as its
-- owner and hands every row to anyone who selects from it — which is what
-- migrations 068 and 069 were written to undo. Not worth repeating.
CREATE OR REPLACE VIEW vw_library_loans_needing_review
  WITH (security_invoker = true) AS
SELECT bc.id                AS checkout_id,
       bc.student_id,
       s.first_name,
       s.last_name,
       s.registration_number,
       s.school_id,
       bc.book_copy_id,
       -- The copy's own identifier: book_copies has barcode, which is what the
       -- librarian types when checking a book in or out.
       c.barcode,
       b.title,
       bc.checkout_date,
       bc.due_date,
       c.status             AS copy_status
FROM   book_checkouts bc
JOIN   book_copies    c ON c.id = bc.book_copy_id
JOIN   books          b ON b.id = c.book_id
JOIN   students       s ON s.id = bc.student_id
WHERE  COALESCE(bc.is_returned, FALSE) = FALSE
  AND  c.status = 'available';

NOTIFY pgrst, 'reload schema';
