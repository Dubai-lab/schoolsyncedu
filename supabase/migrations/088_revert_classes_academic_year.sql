-- Migration 088: Remove academic_year from classes table
--
-- Classes are permanent school-wide records ("Grade 7A" exists forever).
-- The year context already lives on:
--   • class_assignments (student_id, class_id, academic_year)
--   • fee_structures    (class_id, academic_year, fee_type, ...)
--   • class_subjects    (class_id, academic_year, subject_id, ...)
--
-- Adding academic_year to the class itself forced principals to recreate
-- every class each year — exactly the wrong behaviour.

DROP INDEX IF EXISTS idx_classes_academic_year;

ALTER TABLE classes DROP COLUMN IF EXISTS academic_year;

NOTIFY pgrst, 'reload schema';
