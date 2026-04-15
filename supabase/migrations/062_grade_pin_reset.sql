-- Migration 062: Add grade_pin_reset_requested flag to students
-- Run this in: Supabase Dashboard → SQL Editor → New query

-- ── 1. Add the flag column ────────────────────────────────────────────────────
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS grade_pin_reset_requested BOOLEAN NOT NULL DEFAULT false;

-- ── 2. Index for quick lookups ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_students_grade_pin_reset
  ON students(grade_pin_reset_requested)
  WHERE grade_pin_reset_requested = true;

-- ── How it works ──────────────────────────────────────────────────────────────
-- IT Admin sets grade_pin_reset_requested = true for a student.
-- On the student's next login to "My Grades", the page checks this flag.
-- If true, it clears localStorage keys grade_pin_{userId} and
-- grade_pin_enabled_{userId}, then calls an API to set the flag back to false.
-- The student is then prompted to set a new PIN (or leave it disabled).
