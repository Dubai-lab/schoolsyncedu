-- ============================================================
-- Migration 213: Real book copies, serial numbers, and returns that stick
--
-- Four problems, found while tracing a checkout end to end.
--
-- 1. "500 avail." AND "No available copies for this book."
--    bookService.create inserts a books row with total_copies and
--    available_copies set to whatever was typed, and never creates a single
--    book_copies row. The catalog reads those counters; checkout reads the
--    real table. So the counters were fiction — a library could show 500
--    copies and lend none of them.
--
-- 2. Returned books never left a student's list.
--    book_checkouts has no return_date column at all. returnBook sets
--    is_returned = true, but MyLibrary decides what is active with
--    `!c.return_date` — always undefined. Every book a student ever returned
--    stayed on their screen, and once past due, permanently red and OVERDUE.
--
-- 3. Nothing stopped the same physical copy being lent twice.
--    No constraint on active checkouts per copy.
--
-- 4. Counters drifted with no way back.
--    Nothing recomputed available_copies from reality.
--
-- Serial numbers rather than barcode scanning: each copy already has a UNIQUE
-- barcode column, which is exactly a serial number. It is now generated,
-- printed on the book, and typed by the librarian — no scanner hardware, which
-- is the right call for schools that will not buy one.
-- ============================================================


-- ============================================================
-- 1. RETURN DATE
-- ============================================================

ALTER TABLE book_checkouts
  ADD COLUMN IF NOT EXISTS return_date DATE;

-- Backfill from book_returns, which recorded the real date all along. Matches
-- on copy + student, taking the earliest return at or after each checkout.
--
-- A correlated subquery in SET rather than UPDATE ... FROM LATERAL: a LATERAL
-- item in the FROM list may only reference earlier FROM items, never the row
-- being updated, so referring to bc there is rejected outright.
UPDATE book_checkouts bc
SET    return_date = (
  SELECT br.return_date
  FROM   book_returns br
  WHERE  br.book_copy_id = bc.book_copy_id
    AND  br.student_id   = bc.student_id
    AND  br.return_date >= bc.checkout_date
  ORDER  BY br.return_date
  LIMIT  1
)
WHERE  bc.is_returned IS TRUE
  AND  bc.return_date IS NULL;

-- Anything still marked returned with no matching record gets its checkout
-- date, so it leaves the student's active list rather than sitting there
-- forever. Imperfect history beats a permanent false overdue.
UPDATE book_checkouts
SET    return_date = checkout_date
WHERE  is_returned IS TRUE AND return_date IS NULL;


-- ============================================================
-- 2. ONE ACTIVE CHECKOUT PER COPY
--    A partial unique index: many historical rows per copy are fine, but only
--    one may be outstanding at a time.
-- ============================================================

-- Close any existing duplicates first, or the index cannot be built. Keeps the
-- most recent and marks the rest returned.
UPDATE book_checkouts bc
SET    is_returned = TRUE,
       return_date = COALESCE(return_date, CURRENT_DATE)
WHERE  is_returned IS NOT TRUE
  AND  EXISTS (
    SELECT 1 FROM book_checkouts newer
    WHERE  newer.book_copy_id = bc.book_copy_id
      AND  newer.is_returned IS NOT TRUE
      AND  newer.checkout_date > bc.checkout_date
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_book_checkouts_one_active
  ON book_checkouts(book_copy_id)
  WHERE is_returned IS NOT TRUE;


-- ============================================================
-- 3. SERIAL NUMBERS
--
-- One global sequence, prefixed with the school code. Globally unique because
-- nextval never repeats, and short enough to read off a spine label and type.
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS book_copy_serial_seq START 1;

CREATE OR REPLACE FUNCTION generate_book_copies(p_book_id UUID, p_count INT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_code TEXT;
  v_made        INT := 0;
  i             INT;
BEGIN
  SELECT s.school_code INTO v_school_code
  FROM   books b JOIN schools s ON s.id = b.school_id
  WHERE  b.id = p_book_id;

  IF v_school_code IS NULL THEN
    RAISE EXCEPTION 'Book not found: %', p_book_id;
  END IF;

  FOR i IN 1..GREATEST(COALESCE(p_count, 0), 0) LOOP
    INSERT INTO book_copies (book_id, barcode, status)
    VALUES (
      p_book_id,
      upper(v_school_code) || '-' || lpad(nextval('book_copy_serial_seq')::TEXT, 6, '0'),
      'available'
    );
    v_made := v_made + 1;
  END LOOP;

  RETURN v_made;
END;
$$;

GRANT EXECUTE ON FUNCTION generate_book_copies(UUID, INT) TO authenticated;


-- ============================================================
-- 4. BACKFILL THE MISSING COPIES
--    Every book claiming copies it never had now gets them, so existing
--    catalogues become lendable instead of needing re-entry.
-- ============================================================

DO $$
DECLARE
  r       RECORD;
  v_have  INT;
  v_total INT;
BEGIN
  FOR r IN SELECT id, total_copies FROM books LOOP
    SELECT count(*) INTO v_have FROM book_copies WHERE book_id = r.id;
    v_total := GREATEST(COALESCE(r.total_copies, 0), 0);

    IF v_total > v_have THEN
      PERFORM generate_book_copies(r.id, v_total - v_have);
    END IF;
  END LOOP;
END $$;


-- ============================================================
-- 5. KEEP THE COUNTERS HONEST
--    Derived from book_copies rather than maintained by hand, so the catalog
--    and the checkout screen can no longer disagree.
-- ============================================================

CREATE OR REPLACE FUNCTION sync_book_copy_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_book UUID := COALESCE(NEW.book_id, OLD.book_id);
BEGIN
  UPDATE books
  SET    total_copies     = (SELECT count(*) FROM book_copies WHERE book_id = v_book),
         available_copies = (SELECT count(*) FROM book_copies
                             WHERE book_id = v_book AND status = 'available')
  WHERE  id = v_book;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_book_copy_counts ON book_copies;
CREATE TRIGGER trg_sync_book_copy_counts
  AFTER INSERT OR UPDATE OF status OR DELETE ON book_copies
  FOR EACH ROW EXECUTE FUNCTION sync_book_copy_counts();

-- One-off correction for every existing book.
UPDATE books b
SET    total_copies     = c.total,
       available_copies = c.avail
FROM (
  SELECT book_id,
         count(*) AS total,
         count(*) FILTER (WHERE status = 'available') AS avail
  FROM   book_copies GROUP BY book_id
) c
WHERE b.id = c.book_id;


-- ============================================================
-- 6. LOOK A COPY UP BY SERIAL
--    What the librarian actually needs: type the number printed on the book
--    and see what it is, whether it can go out, and who has it if not.
-- ============================================================

CREATE OR REPLACE FUNCTION lookup_book_copy(p_serial TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_school UUID;
  v_row    RECORD;
BEGIN
  SELECT school_id INTO v_school FROM users WHERE auth_id = auth.uid();
  IF v_school IS NULL THEN
    RETURN jsonb_build_object('found', false, 'message', 'Not signed in.');
  END IF;

  SELECT bc.id AS copy_id, bc.barcode, bc.status,
         b.id AS book_id, b.title, b.author, b.isbn
  INTO   v_row
  FROM   book_copies bc
  JOIN   books b ON b.id = bc.book_id
  WHERE  upper(btrim(bc.barcode)) = upper(btrim(p_serial))
    AND  b.school_id = v_school;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false, 'message', 'No book with that serial number.');
  END IF;

  RETURN jsonb_build_object(
    'found',   true,
    'copy_id', v_row.copy_id,
    'serial',  v_row.barcode,
    'status',  v_row.status,
    'book_id', v_row.book_id,
    'title',   v_row.title,
    'author',  v_row.author,
    'isbn',    v_row.isbn,
    -- Who has it, when it is out. This is what turns "unavailable" into
    -- something the librarian can act on.
    'current', (
      SELECT jsonb_build_object(
               'student_name', s.first_name || ' ' || s.last_name,
               'registration_number', s.registration_number,
               'due_date', k.due_date,
               'overdue', k.due_date < CURRENT_DATE)
      FROM   book_checkouts k
      JOIN   students s ON s.id = k.student_id
      WHERE  k.book_copy_id = v_row.copy_id AND k.is_returned IS NOT TRUE
      LIMIT  1
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION lookup_book_copy(TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';


-- ============================================================
-- VERIFICATION
--
--   -- Books now have real copies, and the counters match:
--   SELECT b.title, b.total_copies, b.available_copies,
--          (SELECT count(*) FROM book_copies c WHERE c.book_id = b.id) AS actual
--   FROM   books b;
--
--   -- Serial numbers were generated:
--   SELECT barcode, status FROM book_copies ORDER BY barcode LIMIT 10;
--
--   -- Look one up:
--   SELECT lookup_book_copy('NCA-000001');
--
--   -- Returned books now leave a student's active list:
--   SELECT count(*) FROM book_checkouts WHERE is_returned AND return_date IS NULL;
--   -- expect 0
-- ============================================================
