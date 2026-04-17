-- Migration 087: Add academic_year to classes table
--
-- Classes previously had no academic year — subjects and fee structures
-- carried the year on their own rows. This caused confusion in the
-- promotion workflow (class dropdown showed classes from all years with
-- no context) and made it impossible for Principals to manage classes
-- per year.
--
-- Changes:
--   1. Add academic_year column to classes (nullable for backward compat)
--   2. Backfill existing classes with the school's current_academic_year
--   3. Add index for common year-based queries
--   4. Update list_promoted_pending_assignment to be aware of year filtering
--      (no SQL change needed — already uses p_school_id correctly)

ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS academic_year TEXT;

CREATE INDEX IF NOT EXISTS idx_classes_academic_year ON classes(school_id, academic_year);

-- Backfill: set academic_year for classes that don't have one yet,
-- using the school's current_academic_year setting.
-- Safe no-op if setting does not exist or column was already set.
UPDATE classes c
   SET academic_year = ss.setting_value
  FROM school_settings ss
 WHERE ss.school_id    = c.school_id
   AND ss.setting_key  = 'current_academic_year'
   AND c.academic_year IS NULL;

NOTIFY pgrst, 'reload schema';
