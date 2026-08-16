-- ============================================================
-- Migration 214: lookup_book_copy referenced a column that does not exist
--
-- Symptom: looking a serial up returned
--   PostgREST error=42703  (undefined_column)
--
-- Cause: the function selected b.cover_url. The books table has no such
-- column — it never has:
--
--   id, school_id, title, author, isbn, category, description,
--   publisher, publication_year, total_copies, available_copies, created_at
--
-- I took the name from studentPortalService.getMyCheckouts, which embeds
--   books(title, author, isbn, cover_url)
-- and is therefore also broken. That query throws on every call, so the
-- student app's library checkouts tab has been failing since it was written —
-- it just failed quietly, showing an empty list rather than an error.
--
-- Fixed in both places. Nothing sets a cover image anywhere in the product, so
-- the column is dropped from the queries rather than added to the table: an
-- unused column would only invite the same mistake again.
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
--   SELECT lookup_book_copy('NCA-000502');
--
-- Expect found:true with the title, author and status. An unknown serial
-- returns found:false rather than an error.
-- ============================================================
