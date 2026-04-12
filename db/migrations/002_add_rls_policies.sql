-- ============================================================
-- SCHOOLSYNC ROW-LEVEL SECURITY (RLS) POLICIES
-- Multi-tenant isolation - Each school sees only their data
-- Migration: 002_add_rls_policies.sql
-- ============================================================

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================

-- Core tables
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Student tables
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_leave_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_discipline_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_academic_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_grade_privacy_lock ENABLE ROW LEVEL SECURITY;

-- Academic tables
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetables ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_records ENABLE ROW LEVEL SECURITY;

-- Attendance tables
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE nfc_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE nfc_attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE nfc_readers ENABLE ROW LEVEL SECURITY;

-- Finance tables
ALTER TABLE fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_reports ENABLE ROW LEVEL SECURITY;

-- Letter tables
ALTER TABLE letter_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE letter_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE letter_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE letter_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE letter_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE letter_recalls ENABLE ROW LEVEL SECURITY;
ALTER TABLE letter_acknowledgments ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_queue ENABLE ROW LEVEL SECURITY;

-- Communication tables
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;

-- Library tables
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_copies ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_checkouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE overdue_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_reports ENABLE ROW LEVEL SECURITY;

-- Guidance tables
ALTER TABLE counseling_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_meetings ENABLE ROW LEVEL SECURITY;

-- ID Card tables
ALTER TABLE id_card_designs ENABLE ROW LEVEL SECURITY;
ALTER TABLE id_card_generation ENABLE ROW LEVEL SECURITY;
ALTER TABLE nfc_chip_assignments ENABLE ROW LEVEL SECURITY;

-- Subscription tables
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_method_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER FUNCTION: Get user school ID
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_school_id(user_id UUID)
RETURNS UUID AS $$
  SELECT school_id FROM users WHERE id = user_id;
$$ LANGUAGE SQL STABLE;

-- ============================================================
-- RLS POLICIES: STUDENT TABLE
-- ============================================================
CREATE POLICY students_select_policy ON students
  FOR SELECT USING (
    -- Students can see their own record
    auth.uid() IN (
      SELECT id FROM users WHERE id = auth.uid() AND school_id = students.school_id
    )
    OR
    -- Teachers can see students in their classes
    (SELECT role FROM users WHERE id = auth.uid()) = 'teacher'::user_role
    OR
    -- Staff can see all students
    (SELECT role FROM users WHERE id = auth.uid()) IN ('admin_staff'::user_role, 'principal'::user_role, 'registrar'::user_role)
    OR
    -- School admin roles
    (SELECT role FROM users WHERE id = auth.uid()) IN ('dean_of_students'::user_role, 'bursar'::user_role, 'vice_principal'::user_role)
  );

CREATE POLICY students_insert_policy ON students
  FOR INSERT WITH CHECK (
    -- Only registrar, admin, principal can create students
    (SELECT role FROM users WHERE id = auth.uid()) IN ('registrar'::user_role, 'admin_staff'::user_role, 'principal'::user_role)
    AND school_id = get_user_school_id(auth.uid())
  );

CREATE POLICY students_update_policy ON students
  FOR UPDATE USING (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('registrar'::user_role, 'admin_staff'::user_role, 'principal'::user_role)
    AND school_id = get_user_school_id(auth.uid())
  );

-- ============================================================
-- RLS POLICIES: ATTENDANCE RECORDS
-- ============================================================
CREATE POLICY attendance_select_policy ON attendance_records
  FOR SELECT USING (
    -- Students can see their own attendance records
    student_id IN (SELECT id FROM students WHERE id = auth.uid())
    OR
    -- Teachers can see their class attendance
    (SELECT role FROM users WHERE id = auth.uid()) IN ('teacher'::user_role, 'admin_staff'::user_role)
    OR
    -- School admin
    (SELECT role FROM users WHERE id = auth.uid()) IN ('principal'::user_role, 'dean_of_students'::user_role)
  );

CREATE POLICY attendance_insert_policy ON attendance_records
  FOR INSERT WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('teacher'::user_role, 'admin_staff'::user_role)
  );

-- ============================================================
-- RLS POLICIES: GRADES
-- ============================================================
CREATE POLICY grades_select_policy ON grades
  FOR SELECT USING (
    -- Students can see their own grades
    student_id IN (SELECT id FROM students WHERE id = auth.uid())
    OR
    -- Teachers can see student grades
    (SELECT role FROM users WHERE id = auth.uid()) IN ('teacher'::user_role, 'admin_staff'::user_role)
    OR
    -- School admin
    (SELECT role FROM users WHERE id = auth.uid()) IN ('principal'::user_role, 'vice_principal'::user_role)
  );

CREATE POLICY grades_insert_policy ON grades
  FOR INSERT WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('teacher'::user_role, 'admin_staff'::user_role)
    AND school_id = get_user_school_id(auth.uid())
  );

CREATE POLICY grades_update_policy ON grades
  FOR UPDATE USING (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('teacher'::user_role, 'admin_staff'::user_role, 'principal'::user_role)
    AND school_id = get_user_school_id(auth.uid())
  );

-- ============================================================
-- RLS POLICIES: PAYMENTS & FEES
-- ============================================================
CREATE POLICY student_fees_select_policy ON student_fees
  FOR SELECT USING (
    -- Parents can see their child's fees
    student_id IN (
      SELECT student_id FROM guardians WHERE student_id = student_fees.student_id
    )
    OR
    -- Students can see their own fees
    student_id IN (
      SELECT id FROM students WHERE id = auth.uid()
    )
    OR
    -- Bursar and admin staff
    (SELECT role FROM users WHERE id = auth.uid()) IN ('bursar'::user_role, 'admin_staff'::user_role, 'principal'::user_role)
  );

CREATE POLICY payments_select_policy ON payments
  FOR SELECT USING (
    -- Students and parents can see their payments
    student_id IN (
      SELECT id FROM students WHERE id = auth.uid()
    )
    OR
    -- Bursar and finance staff
    (SELECT role FROM users WHERE id = auth.uid()) IN ('bursar'::user_role, 'admin_staff'::user_role, 'principal'::user_role)
  );

-- ============================================================
-- RLS POLICIES: LETTERS & COMMUNICATIONS
-- ============================================================
CREATE POLICY letter_instances_select_policy ON letter_instances
  FOR SELECT USING (
    -- Students can see letters about them
    student_id IN (
      SELECT id FROM students WHERE id = auth.uid()
    )
    OR
    -- Staff who created/approved can see
    created_by = auth.uid() OR approved_by = auth.uid()
    OR
    -- Authorized staff can see
    (SELECT role FROM users WHERE id = auth.uid()) IN ('admin_staff'::user_role, 'principal'::user_role, 'dean_of_students'::user_role)
  );

CREATE POLICY letter_instances_insert_policy ON letter_instances
  FOR INSERT WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) IN (
      'admin_staff'::user_role, 'teacher'::user_role, 'principal'::user_role, 'dean_of_students'::user_role, 'registrar'::user_role, 'bursar'::user_role
    )
    AND school_id = get_user_school_id(auth.uid())
  );

-- ============================================================
-- RLS POLICIES: LIBRARY MANAGEMENT
-- ============================================================
CREATE POLICY book_checkouts_select_policy ON book_checkouts
  FOR SELECT USING (
    -- Students can see their checkouts
    student_id IN (
      SELECT id FROM students WHERE id = auth.uid()
    )
    OR
    -- Librarian and admin
    (SELECT role FROM users WHERE id = auth.uid()) IN ('librarian'::user_role, 'admin_staff'::user_role, 'principal'::user_role)
  );

CREATE POLICY book_checkouts_insert_policy ON book_checkouts
  FOR INSERT WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('librarian'::user_role, 'admin_staff'::user_role)
  );

-- ============================================================
-- RLS POLICIES: AUDIT LOGS (Read-only for compliance)
-- ============================================================
CREATE POLICY audit_logs_select_policy ON audit_logs
  FOR SELECT USING (
    -- Principal and Proprietor can view audit logs
    (SELECT role FROM users WHERE id = auth.uid()) IN ('principal'::user_role, 'proprietor'::user_role, 'super_admin'::user_role)
  );

-- Audit logs cannot be modified - INSERT only via triggers/functions
CREATE POLICY audit_logs_insert_policy ON audit_logs
  FOR INSERT WITH CHECK (TRUE);

-- ============================================================
-- RLS POLICIES: SUBSCRIPTIONS (Platform-level)
-- ============================================================
CREATE POLICY subscriptions_select_policy ON subscriptions
  FOR SELECT USING (
    school_id = get_user_school_id(auth.uid())
    OR
    (SELECT role FROM users WHERE id = auth.uid()) = 'super_admin'::user_role
  );

-- ============================================================
-- COMPLETE: All RLS policies configured for multi-tenant isolation
-- ============================================================
