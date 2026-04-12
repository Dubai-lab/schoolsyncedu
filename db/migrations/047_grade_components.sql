-- ============================================================
-- 047 — Grade Components
-- Adds individual assessment component columns to grades table
-- so teachers can enter Assignment / Quiz / Test / Exam scores
-- separately. The final score is their sum (out of 100).
--
-- Default Liberian school breakdown:
--   Assignment  /20
--   Quiz        /20
--   Test        /20
--   Exam        /40
--   Total       /100
-- ============================================================

ALTER TABLE grades
  ADD COLUMN IF NOT EXISTS assignment_score NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS quiz_score       NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS test_score       NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS exam_score       NUMERIC(5,2);

COMMENT ON COLUMN grades.assignment_score IS 'Continuous assessment — assignment component (max configurable, default 20)';
COMMENT ON COLUMN grades.quiz_score       IS 'Continuous assessment — quiz component (max configurable, default 20)';
COMMENT ON COLUMN grades.test_score       IS 'Continuous assessment — class test component (max configurable, default 20)';
COMMENT ON COLUMN grades.exam_score       IS 'End-of-term examination component (max configurable, default 40)';
COMMENT ON COLUMN grades.score            IS 'Final computed total = assignment + quiz + test + exam (out of 100)';
