-- ============================================================
-- 067 — Fix attendance unique constraint for PostgREST upsert
--
-- Partial unique indexes (WHERE clause) are NOT supported by
-- PostgREST for upsert conflict resolution (error 42P10).
-- Replace with a single UNIQUE NULLS NOT DISTINCT constraint
-- on (student_id, attendance_date, subject_id) so PostgREST
-- can resolve conflicts correctly.
-- ============================================================

-- Drop the partial indexes added in 066
DROP INDEX IF EXISTS idx_attendance_subject_unique;
DROP INDEX IF EXISTS idx_attendance_general_unique;

-- Also drop the original constraint if it still exists
ALTER TABLE attendance_records
  DROP CONSTRAINT IF EXISTS attendance_records_student_id_attendance_date_key;

-- Single unique constraint treating NULL subject_id as equal to NULL
-- (NULLS NOT DISTINCT requires PostgreSQL 15+, available on Supabase)
ALTER TABLE attendance_records
  ADD CONSTRAINT attendance_records_student_date_subject_key
  UNIQUE NULLS NOT DISTINCT (student_id, attendance_date, subject_id);
