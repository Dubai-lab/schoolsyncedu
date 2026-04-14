-- Migration 060: requires_approval flag on letter_templates
--
-- Adds requires_approval BOOLEAN to letter_templates.
-- Default = TRUE (all existing custom templates continue to go through the
-- principal approval queue — no behaviour change for them).
--
-- The 23 default/starter templates are then updated to the correct value:
--   FALSE → operational letters that departments send on their own authority
--           (finance, registry, counselor, admissions, informational)
--   TRUE  → letters that carry disciplinary weight, school-wide commitments,
--           or significant academic consequences (stays in principal queue)

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Add column (idempotent)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE letter_templates
  ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN NOT NULL DEFAULT TRUE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Set requires_approval = FALSE for operational starter templates
--    (Finance / Bursar, Registrar / Admissions, Counselor, Informational)
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE letter_templates
SET    requires_approval = FALSE
WHERE  is_starter = TRUE
AND    name IN (
  -- Finance — bursar has institutional authority, time-sensitive
  'Fee Payment Reminder',
  'Outstanding Balance Notice',
  'Payment Receipt Letter',

  -- Admissions — registrar authority, factual outcomes
  'Student Acceptance Letter',
  'Admission Rejection Letter',
  'Waitlist Notification',
  'Transfer Letter',

  -- Registry — administrative, no school-wide commitment
  'Enrollment Verification Letter',
  'Withdrawal Confirmation',

  -- Academic — informational / positive
  'Report Card Cover Letter',
  'Honor Roll Certificate',

  -- Counselor — confidential by nature, principal should not read these
  'Student Recommendation Letter'
);

-- Templates NOT listed above keep requires_approval = TRUE (the default):
--   Student Warning Letter, Suspension Notice, NTR Notice, Expulsion Notice,
--   Student Promotion Letter, Class Retention Notice,
--   Chronic Absenteeism Notice, Truancy Notice,
--   PTA Meeting Invitation, General Announcement, Emergency Notice
