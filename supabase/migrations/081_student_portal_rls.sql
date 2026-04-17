-- Migration 081: RLS policies for all student portal tables
--
-- Many tables used by the student portal have RLS enabled but no SELECT
-- policies allowing students to read their own data, causing 400 errors.
-- This migration covers every table queried by studentPortalService.ts.

-- ── report_cards ──────────────────────────────────────────────────────────────
ALTER TABLE report_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view own report cards" ON report_cards;
CREATE POLICY "Students can view own report cards"
  ON report_cards FOR SELECT TO authenticated
  USING (
    school_id = auth_school_id()
    AND (
      auth_user_role() != 'student'::user_role
      OR student_id IN (
        SELECT s.id FROM students s
        JOIN users u ON u.id = s.user_id
        WHERE u.auth_id = auth.uid()
      )
    )
  );

-- ── transcripts ───────────────────────────────────────────────────────────────
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view own transcripts" ON transcripts;
CREATE POLICY "Students can view own transcripts"
  ON transcripts FOR SELECT TO authenticated
  USING (
    school_id = auth_school_id()
    AND (
      auth_user_role() != 'student'::user_role
      OR student_id IN (
        SELECT s.id FROM students s
        JOIN users u ON u.id = s.user_id
        WHERE u.auth_id = auth.uid()
      )
    )
  );

-- ── payments ──────────────────────────────────────────────────────────────────
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view own payments" ON payments;
CREATE POLICY "Students can view own payments"
  ON payments FOR SELECT TO authenticated
  USING (
    school_id = auth_school_id()
    AND (
      auth_user_role() != 'student'::user_role
      OR student_id IN (
        SELECT s.id FROM students s
        JOIN users u ON u.id = s.user_id
        WHERE u.auth_id = auth.uid()
      )
    )
  );

-- ── student_fees ──────────────────────────────────────────────────────────────
ALTER TABLE student_fees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view own fees" ON student_fees;
CREATE POLICY "Students can view own fees"
  ON student_fees FOR SELECT TO authenticated
  USING (
    auth_user_role() != 'student'::user_role
    AND school_id = auth_school_id()
    OR student_id IN (
      SELECT s.id FROM students s
      JOIN users u ON u.id = s.user_id
      WHERE u.auth_id = auth.uid()
    )
  );

-- ── fee_structures ────────────────────────────────────────────────────────────
ALTER TABLE fee_structures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School members can view fee structures" ON fee_structures;
CREATE POLICY "School members can view fee structures"
  ON fee_structures FOR SELECT TO authenticated
  USING (school_id = auth_school_id());

-- ── attendance_records ────────────────────────────────────────────────────────
-- no school_id column — scope via student_id through students table
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view own attendance" ON attendance_records;
CREATE POLICY "Students can view own attendance"
  ON attendance_records FOR SELECT TO authenticated
  USING (
    auth_user_role() != 'student'::user_role
    OR student_id IN (
      SELECT s.id FROM students s
      JOIN users u ON u.id = s.user_id
      WHERE u.auth_id = auth.uid()
    )
  );

-- ── timetables ────────────────────────────────────────────────────────────────
-- no school_id column — scope via class_id
ALTER TABLE timetables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School members can view timetables" ON timetables;
CREATE POLICY "School members can view timetables"
  ON timetables FOR SELECT TO authenticated
  USING (
    class_id IN (SELECT id FROM classes WHERE school_id = auth_school_id())
  );

-- ── books ─────────────────────────────────────────────────────────────────────
ALTER TABLE books ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School members can view books" ON books;
CREATE POLICY "School members can view books"
  ON books FOR SELECT TO authenticated
  USING (school_id = auth_school_id());

-- ── book_copies ───────────────────────────────────────────────────────────────
ALTER TABLE book_copies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School members can view book copies" ON book_copies;
CREATE POLICY "School members can view book copies"
  ON book_copies FOR SELECT TO authenticated
  USING (
    book_id IN (SELECT id FROM books WHERE school_id = auth_school_id())
  );

-- ── book_checkouts ────────────────────────────────────────────────────────────
ALTER TABLE book_checkouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view own checkouts" ON book_checkouts;
CREATE POLICY "Students can view own checkouts"
  ON book_checkouts FOR SELECT TO authenticated
  USING (
    auth_user_role() != 'student'::user_role
    OR student_id IN (
      SELECT s.id FROM students s
      JOIN users u ON u.id = s.user_id
      WHERE u.auth_id = auth.uid()
    )
  );

-- ── announcements ─────────────────────────────────────────────────────────────
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School members can view announcements" ON announcements;
CREATE POLICY "School members can view announcements"
  ON announcements FOR SELECT TO authenticated
  USING (school_id = auth_school_id());

-- ── Reload PostgREST schema cache ─────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
