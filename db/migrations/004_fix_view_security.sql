-- ============================================================
-- SCHOOLSYNC SECURITY FIX
-- Migration: 004_fix_view_security.sql
-- Purpose: Explicitly set SECURITY INVOKER on functions to ensure
-- views respect Row-Level Security policies of the calling user
-- ============================================================

-- Recreate all functions with explicit SECURITY INVOKER
-- This ensures views inherit the caller's permissions, not the creator's

-- Function: Get current term
CREATE OR REPLACE FUNCTION get_current_term(school_id UUID)
RETURNS UUID AS $$
  SELECT id FROM academic_calendar 
  WHERE school_id = $1 
  AND start_date <= CURRENT_DATE 
  AND end_date >= CURRENT_DATE 
  LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY INVOKER;

-- Function: Get student full name
CREATE OR REPLACE FUNCTION get_student_full_name(student_id UUID)
RETURNS TEXT AS $$
  SELECT first_name || ' ' || last_name FROM students WHERE id = $1;
$$ LANGUAGE SQL STABLE SECURITY INVOKER;

-- Function: Check if student is enrolled in class
CREATE OR REPLACE FUNCTION is_student_enrolled(student_id UUID, class_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM student_enrollments 
    WHERE student_id = $1 AND class_id = $2 AND status = 'active'
  );
$$ LANGUAGE SQL STABLE SECURITY INVOKER;

-- Function: Calculate student GPA for term
CREATE OR REPLACE FUNCTION calculate_student_gpa(student_id UUID, academic_year VARCHAR)
RETURNS DECIMAL AS $$
  SELECT AVG(CAST(gpa_points AS DECIMAL))
  FROM grades 
  WHERE student_id = $1 
  AND academic_year = $2 
  AND gpa_points IS NOT NULL;
$$ LANGUAGE SQL STABLE SECURITY INVOKER;

-- Function: Get overdue books count
CREATE OR REPLACE FUNCTION get_overdue_books_count(student_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*) FROM overdue_books WHERE student_id = $1;
$$ LANGUAGE SQL STABLE SECURITY INVOKER;

-- Function: Get pending letters count for approval
CREATE OR REPLACE FUNCTION get_pending_letters_count(user_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*) FROM letter_instances 
  WHERE status = 'pending_approval' 
  AND (approved_by = $1 OR created_by = $1);
$$ LANGUAGE SQL STABLE SECURITY INVOKER;

-- Function: Check if student has unpaid fees
CREATE OR REPLACE FUNCTION has_unpaid_fees(student_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM student_fees 
    WHERE student_id = $1 AND amount_due > 0
  );
$$ LANGUAGE SQL STABLE SECURITY INVOKER;

-- Function: Log User Action (called automatically by triggers)
CREATE OR REPLACE FUNCTION log_user_action(
  p_school_id UUID,
  p_user_id UUID,
  p_action audit_action,
  p_entity_type TEXT,
  p_entity_id VARCHAR,
  p_description TEXT,
  p_metadata JSONB
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  v_id := gen_random_uuid();
  INSERT INTO audit_logs (
    id, school_id, user_id, action, entity_type, entity_id, description, metadata, created_at
  ) VALUES (
    v_id, p_school_id, p_user_id, p_action, p_entity_type, p_entity_id, p_description, p_metadata, NOW()
  );
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- ============================================================
-- MIGRATION COMPLETE: Security settings fixed
-- All functions now use SECURITY INVOKER to respect caller's RLS
-- ============================================================
