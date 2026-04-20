-- ============================================================
-- 065 — Add attendance_score to grades
--
-- Liberian grading structure (confirmed):
--
--   Regular periods (P1, P2, P4, P5):
--     Assignment /20 + Quiz /20 + Test /50 + Attendance /10 = 100
--
--   Semester Exam periods (P3, P6):
--     Exam /100 only
--
-- Previous schema had Test /20 and no attendance column.
-- ============================================================

ALTER TABLE grades
  ADD COLUMN IF NOT EXISTS attendance_score NUMERIC(5,2);

COMMENT ON COLUMN grades.attendance_score IS
  'Liberian grading: Attendance /10 for regular periods (P1,P2,P4,P5). NULL for exam periods.';

CREATE INDEX IF NOT EXISTS idx_grades_attendance_score
  ON grades (school_id, attendance_score)
  WHERE attendance_score IS NOT NULL;
