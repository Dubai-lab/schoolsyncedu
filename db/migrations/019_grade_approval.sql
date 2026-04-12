-- Migration 019: Add grade approval workflow
-- Grades now have a status: draft (teacher entered) → submitted → approved/rejected (principal)

ALTER TABLE grades
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Set existing grades to approved (backward compat)
UPDATE grades SET status = 'approved' WHERE status IS NULL OR status = 'draft';

-- Index for filtering by status
CREATE INDEX IF NOT EXISTS idx_grades_status ON grades(school_id, status);
CREATE INDEX IF NOT EXISTS idx_grades_approval ON grades(school_id, approved_by);
