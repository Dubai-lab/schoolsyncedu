-- Migration 082: Definitively fix grades→subjects FK + force schema cache reload
--
-- Problem: grades?select=*,subjects(name,code) returns 400 Bad Request even
-- after migration 080. Root cause: migration 080 checked by constraint name
-- "grades_subject_id_fkey" — if the constraint never existed, this check is a
-- no-op when the FK is already missing.  This migration checks by COLUMN
-- reference (not by name) and also handles the grades→students FK the same way.

-- ── Drop any existing FK from grades.subject_id (regardless of name) ─────────
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema   = kcu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name      = 'grades'
      AND kcu.column_name    = 'subject_id'
      AND tc.table_schema    = 'public'
  LOOP
    EXECUTE format('ALTER TABLE grades DROP CONSTRAINT %I', r.constraint_name);
  END LOOP;
END $$;

-- ── Re-add FK grades.subject_id → subjects.id ────────────────────────────────
ALTER TABLE grades
  ADD CONSTRAINT grades_subject_id_fkey
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL;

-- ── Ensure FK grades.student_id → students.id (idempotent by column check) ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema   = kcu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name      = 'grades'
      AND kcu.column_name    = 'student_id'
      AND tc.table_schema    = 'public'
  ) THEN
    ALTER TABLE grades
      ADD CONSTRAINT grades_student_id_fkey
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ── Force PostgREST to reload its schema cache ────────────────────────────────
NOTIFY pgrst, 'reload schema';
