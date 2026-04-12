-- ============================================================
-- Migration 023: Link fee_structures to classes table
-- Purpose:
--   fee_structures.grade_level was a freetext VARCHAR ("Grade 12", "KG1").
--   Schools create named classes (12A, 12B, JSS1A …) via the principal dashboard.
--   Fee structures must now reference those actual classes so bulk-assignment
--   can resolve students via class_assignments instead of a loose string match.
-- ============================================================

-- 1. Add class_id FK (nullable — existing rows stay valid)
ALTER TABLE fee_structures
  ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES classes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fee_structures_class_id ON fee_structures(class_id);

-- 2. Backfill: where grade_level exactly matches a class name in the same school,
--    wire up the class_id. Safe for existing data — only updates exact matches.
UPDATE fee_structures fs
SET class_id = c.id
FROM classes c
WHERE c.school_id = fs.school_id
  AND c.name = fs.grade_level
  AND fs.class_id IS NULL;
