-- ============================================================
-- 066 — Subject-level attendance
--
-- Attendance is now tracked per student + date + subject,
-- not per student + date only.
-- This allows each teacher to mark attendance for their own
-- subject/period independently.
-- ============================================================

ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL;

-- Drop the old unique constraint (student_id, attendance_date)
ALTER TABLE attendance_records
  DROP CONSTRAINT IF EXISTS attendance_records_student_id_attendance_date_key;

-- New unique: per student + date + subject (subject-level records)
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_subject_unique
  ON attendance_records(student_id, attendance_date, subject_id)
  WHERE subject_id IS NOT NULL;

-- Legacy unique: per student + date (old general records with no subject)
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_general_unique
  ON attendance_records(student_id, attendance_date)
  WHERE subject_id IS NULL;

-- Fast lookups: class + subject + date range (used by grade attendance scoring)
CREATE INDEX IF NOT EXISTS idx_attendance_class_subject_date
  ON attendance_records(class_id, subject_id, attendance_date)
  WHERE subject_id IS NOT NULL;

COMMENT ON COLUMN attendance_records.subject_id IS
  'Subject this attendance record belongs to. NULL = legacy general attendance.';
