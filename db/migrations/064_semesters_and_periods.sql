-- ============================================================
-- 064 — Semesters & Marking Periods
--
-- Replaces the 3-term system with the correct Liberian academic
-- structure: 2 Semesters × 3 Marking Periods each = 6 periods.
--
-- Semester 1 (Sept–Feb): P1, P2, P3 (P3 closes with Sem 1 Exam)
-- Semester 2 (Feb–July): P4, P5, P6 (P6 closes with Sem 2 Exam)
--
-- Changes:
--   1. Extend academic_calendar with period_type, period_number,
--      semester_number columns.
--   2. Migrate existing first_term/second_term/third_term rows.
--   3. Add marking_period column to grades for new grade entries.
-- ============================================================

-- ── 1. Extend academic_calendar ──────────────────────────────
ALTER TABLE academic_calendar
  ADD COLUMN IF NOT EXISTS period_type     TEXT    NOT NULL DEFAULT 'marking_period',
  ADD COLUMN IF NOT EXISTS period_number   INTEGER,
  ADD COLUMN IF NOT EXISTS semester_number INTEGER;

COMMENT ON COLUMN academic_calendar.period_type IS
  'semester | marking_period — distinguishes semester-level from period-level rows';
COMMENT ON COLUMN academic_calendar.period_number IS
  '1–2 for semesters; 1–6 for marking periods (P1-P6 across the year)';
COMMENT ON COLUMN academic_calendar.semester_number IS
  '1 or 2 — which semester a marking period belongs to (null for semester rows)';

-- ── 2. Migrate existing 3-term rows to period structure ───────
-- Old first_term → P1 (Sem 1, Period 1) for backward compat
-- Old second_term → P2 (Sem 1, Period 2)
-- Old third_term  → P4 (Sem 2, Period 1) — closest mapping
UPDATE academic_calendar
SET
  period_type     = 'marking_period',
  period_number   = CASE term_name
                      WHEN 'first_term'  THEN 1
                      WHEN 'second_term' THEN 2
                      WHEN 'third_term'  THEN 4
                      ELSE NULL
                    END,
  semester_number = CASE term_name
                      WHEN 'first_term'  THEN 1
                      WHEN 'second_term' THEN 1
                      WHEN 'third_term'  THEN 2
                      ELSE NULL
                    END
WHERE period_number IS NULL
  AND term_name IN ('first_term', 'second_term', 'third_term');

-- ── 3. Add marking_period column to grades ────────────────────
-- New grade entries store p1–p6 here.
-- Old entries keep their legacy semester value; marking_period stays NULL.
ALTER TABLE grades
  ADD COLUMN IF NOT EXISTS marking_period VARCHAR(10);

COMMENT ON COLUMN grades.marking_period IS
  'Liberian marking period: p1–p6. NULL for pre-migration legacy grades.';

-- ── Index for fast per-period grade lookups ───────────────────
CREATE INDEX IF NOT EXISTS idx_grades_marking_period
  ON grades (school_id, marking_period)
  WHERE marking_period IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_academic_calendar_period_type
  ON academic_calendar (school_id, academic_year, period_type);
