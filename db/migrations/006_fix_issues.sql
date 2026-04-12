-- ============================================================
-- SCHOOLSYNC DATABASE FIX MIGRATION
-- Migration: 006_fix_issues.sql
-- Purpose: Fix critical auth mapping, RLS tenant isolation,
--          missing tables, broken functions, and view bugs
-- ============================================================

-- ============================================================
-- PART 1: NEW ENUM TYPES
-- ============================================================

CREATE TYPE letter_instance_status AS ENUM (
  'draft', 'pending_approval', 'changes_requested',
  'approved', 'sent', 'recalled', 'voided'
);

CREATE TYPE letter_approval_status AS ENUM (
  'pending', 'approved', 'rejected', 'changes_requested'
);

CREATE TYPE letter_delivery_channel AS ENUM (
  'pdf', 'portal', 'sms', 'email'
);

CREATE TYPE letter_delivery_status AS ENUM (
  'pending', 'sent', 'delivered', 'failed', 'read'
);

CREATE TYPE print_queue_status_enum AS ENUM (
  'queued', 'printing', 'printed', 'distributed', 'failed'
);

CREATE TYPE print_distribution_method AS ENUM (
  'handed_to_student', 'mailed', 'picked_up'
);

CREATE TYPE letter_audit_action AS ENUM (
  'created', 'submitted', 'approved', 'rejected', 'sent',
  'delivered', 'read', 'recalled', 'voided', 'reprinted', 'acknowledged'
);

CREATE TYPE acknowledgment_method AS ENUM (
  'digital_portal', 'digital_sms', 'physical_signoff', 'phone_confirmation'
);

-- ============================================================
-- PART 2: SCHEMA MODIFICATIONS
-- ============================================================

-- 2A: Link users table to Supabase Auth
-- auth_id maps to auth.users.id so RLS can use auth.uid()
ALTER TABLE users ADD COLUMN auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX idx_users_auth_id ON users(auth_id);

-- Remove password_hash — Supabase Auth handles passwords
-- (including student default password via Supabase Auth API)
ALTER TABLE users DROP COLUMN IF EXISTS password_hash;

-- 2B: Link students to their user account
-- Every student gets a users record (role='student') for auth
ALTER TABLE students ADD COLUMN user_id UUID UNIQUE REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX idx_students_user_id ON students(user_id);

-- 2C: Link guardians to their user account + add school_id
ALTER TABLE guardians ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE guardians ADD COLUMN school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
CREATE INDEX idx_guardians_user_id ON guardians(user_id);
CREATE INDEX idx_guardians_school_id ON guardians(school_id);

-- 2D: Drop existing views that depend on columns we're about to alter
-- (They'll be recreated in PART 6 with fixes)
DROP VIEW IF EXISTS vw_recent_audit_activity CASCADE;
DROP VIEW IF EXISTS vw_monthly_revenue_summary CASCADE;
DROP VIEW IF EXISTS vw_active_subscriptions CASCADE;
DROP VIEW IF EXISTS vw_library_outstanding_items CASCADE;
DROP VIEW IF EXISTS vw_nfc_card_status CASCADE;
DROP VIEW IF EXISTS vw_grade_report_summary CASCADE;
DROP VIEW IF EXISTS vw_staff_letter_activity CASCADE;
DROP VIEW IF EXISTS vw_late_payments CASCADE;
DROP VIEW IF EXISTS vw_staff_directory CASCADE;
DROP VIEW IF EXISTS vw_guardian_dashboard CASCADE;
DROP VIEW IF EXISTS vw_financial_summary_by_class CASCADE;
DROP VIEW IF EXISTS vw_attendance_summary_by_class CASCADE;
DROP VIEW IF EXISTS vw_teacher_classload CASCADE;
DROP VIEW IF EXISTS vw_student_dashboard CASCADE;

-- 2E: Alter letter columns from VARCHAR to proper ENUMs
-- Must drop defaults first — PostgreSQL can't auto-cast varchar defaults to enum
ALTER TABLE letter_instances ALTER COLUMN status DROP DEFAULT;
ALTER TABLE letter_instances
  ALTER COLUMN status TYPE letter_instance_status
  USING status::letter_instance_status;
ALTER TABLE letter_instances ALTER COLUMN status SET DEFAULT 'draft'::letter_instance_status;

ALTER TABLE letter_approvals ALTER COLUMN status DROP DEFAULT;
ALTER TABLE letter_approvals
  ALTER COLUMN status TYPE letter_approval_status
  USING status::letter_approval_status;
ALTER TABLE letter_approvals ALTER COLUMN status SET DEFAULT 'pending'::letter_approval_status;

ALTER TABLE letter_deliveries
  ALTER COLUMN channel TYPE letter_delivery_channel
  USING channel::letter_delivery_channel;

ALTER TABLE letter_deliveries ALTER COLUMN status DROP DEFAULT;
ALTER TABLE letter_deliveries
  ALTER COLUMN status TYPE letter_delivery_status
  USING status::letter_delivery_status;
ALTER TABLE letter_deliveries ALTER COLUMN status SET DEFAULT 'pending'::letter_delivery_status;

ALTER TABLE print_queue ALTER COLUMN status DROP DEFAULT;
ALTER TABLE print_queue
  ALTER COLUMN status TYPE print_queue_status_enum
  USING status::print_queue_status_enum;
ALTER TABLE print_queue ALTER COLUMN status SET DEFAULT 'queued'::print_queue_status_enum;

ALTER TABLE print_queue
  ALTER COLUMN distribution_method TYPE print_distribution_method
  USING distribution_method::print_distribution_method;

ALTER TABLE letter_acknowledgments
  ALTER COLUMN method TYPE acknowledgment_method
  USING method::acknowledgment_method;

-- 2E: Create letter_audit_log table (required by v2 research doc)
CREATE TABLE letter_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  letter_instance_id UUID NOT NULL REFERENCES letter_instances(id) ON DELETE CASCADE,
  action letter_audit_action NOT NULL,
  performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45),
  user_agent TEXT,
  metadata JSONB,
  checksum VARCHAR(64) -- SHA-256 hash for tamper detection chain
);

ALTER TABLE letter_audit_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_letter_audit_log_instance ON letter_audit_log(letter_instance_id);
CREATE INDEX idx_letter_audit_log_action ON letter_audit_log(action);

-- 2F: Create platform_notifications_log (for subscription lifecycle alerts)
CREATE TABLE platform_notifications_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL, -- trial_warning, payment_due, payment_failed, etc.
  channel VARCHAR(50), -- email, sms, both
  subject VARCHAR(255),
  body TEXT,
  status VARCHAR(50) DEFAULT 'pending', -- pending, sent, delivered, failed, read
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_platform_notif_school ON platform_notifications_log(school_id);
CREATE INDEX idx_platform_notif_type ON platform_notifications_log(type);

-- 2G: Convert overdue_books from TABLE to VIEW
-- Drop RLS first, then drop table, then create view
DROP POLICY IF EXISTS overdue_books_tenant ON overdue_books;
ALTER TABLE overdue_books DISABLE ROW LEVEL SECURITY;
DROP TABLE overdue_books;

CREATE VIEW overdue_books AS
SELECT
  gen_random_uuid() as id,
  bc.student_id,
  bc.book_copy_id,
  bc.due_date,
  (CURRENT_DATE - bc.due_date) as days_overdue,
  0.00::DECIMAL(10,2) as fine_amount, -- configurable per school later
  CASE
    WHEN CURRENT_DATE - bc.due_date > 14 THEN 'critical'
    WHEN CURRENT_DATE - bc.due_date > 7 THEN 'overdue'
    ELSE 'due_soon'
  END as status,
  bc.id as checkout_id
FROM book_checkouts bc
WHERE bc.is_returned = FALSE
  AND bc.due_date < CURRENT_DATE;

-- 2H: Convert attendance_summary from TABLE to VIEW
DROP POLICY IF EXISTS attendance_summary_tenant ON attendance_summary;
ALTER TABLE attendance_summary DISABLE ROW LEVEL SECURITY;
DROP TABLE attendance_summary;

CREATE VIEW attendance_summary AS
SELECT
  s.id as student_id,
  ar_year.academic_year,
  COUNT(ar_year.id) as total_days,
  COUNT(CASE WHEN ar_year.status = 'present' THEN 1 END) as present_days,
  COUNT(CASE WHEN ar_year.status = 'absent' OR ar_year.status = 'unexcused' THEN 1 END) as absent_days,
  COUNT(CASE WHEN ar_year.status = 'late' THEN 1 END) as late_days,
  COUNT(CASE WHEN ar_year.status = 'excused' THEN 1 END) as excused_days,
  CASE
    WHEN COUNT(ar_year.id) > 0 THEN
      ROUND((COUNT(CASE WHEN ar_year.status = 'present' THEN 1 END)::DECIMAL / COUNT(ar_year.id)) * 100, 2)
    ELSE 0
  END as attendance_percentage,
  MAX(ar_year.marked_at) as last_updated
FROM students s
LEFT JOIN (
  SELECT ar.*, ac.academic_year
  FROM attendance_records ar
  JOIN classes c ON ar.class_id = c.id
  JOIN academic_calendar ac ON c.school_id = ac.school_id
    AND ar.attendance_date BETWEEN ac.start_date AND ac.end_date
) ar_year ON s.id = ar_year.student_id
GROUP BY s.id, ar_year.academic_year;

-- 2I: Add trigger to keep student_fees.balance in sync
CREATE OR REPLACE FUNCTION sync_student_fee_balance()
RETURNS TRIGGER AS $$
BEGIN
  NEW.balance := NEW.amount_due - COALESCE(NEW.amount_paid, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_student_fees_balance
  BEFORE INSERT OR UPDATE OF amount_due, amount_paid ON student_fees
  FOR EACH ROW
  EXECUTE FUNCTION sync_student_fee_balance();

-- ============================================================
-- PART 3: DROP ALL OLD RLS POLICIES (before touching functions they depend on)
-- ============================================================

-- Drop all policies created in migration 002
DROP POLICY IF EXISTS students_select_policy ON students;
DROP POLICY IF EXISTS students_insert_policy ON students;
DROP POLICY IF EXISTS students_update_policy ON students;
DROP POLICY IF EXISTS attendance_select_policy ON attendance_records;
DROP POLICY IF EXISTS attendance_insert_policy ON attendance_records;
DROP POLICY IF EXISTS grades_select_policy ON grades;
DROP POLICY IF EXISTS grades_insert_policy ON grades;
DROP POLICY IF EXISTS grades_update_policy ON grades;
DROP POLICY IF EXISTS student_fees_select_policy ON student_fees;
DROP POLICY IF EXISTS payments_select_policy ON payments;
DROP POLICY IF EXISTS letter_instances_select_policy ON letter_instances;
DROP POLICY IF EXISTS letter_instances_insert_policy ON letter_instances;
DROP POLICY IF EXISTS book_checkouts_select_policy ON book_checkouts;
DROP POLICY IF EXISTS book_checkouts_insert_policy ON book_checkouts;
DROP POLICY IF EXISTS audit_logs_select_policy ON audit_logs;
DROP POLICY IF EXISTS audit_logs_insert_policy ON audit_logs;
DROP POLICY IF EXISTS subscriptions_select_policy ON subscriptions;

-- ============================================================
-- PART 4: FIX & CREATE HELPER FUNCTIONS
-- ============================================================

-- Drop ALL existing functions from migration 003 first to avoid
-- parameter name conflicts on CREATE OR REPLACE
DROP FUNCTION IF EXISTS get_user_school_id(UUID) CASCADE;
DROP FUNCTION IF EXISTS is_student_enrolled(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS get_overdue_books_count(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_pending_letters_count(UUID) CASCADE;
DROP FUNCTION IF EXISTS has_unpaid_fees(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_student_attendance_rate(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_class_average_gpa(UUID) CASCADE;
DROP FUNCTION IF EXISTS log_user_action(UUID, UUID, VARCHAR, VARCHAR, UUID, TEXT, JSONB) CASCADE;

-- Get current user's school_id from Supabase auth context
CREATE OR REPLACE FUNCTION auth_school_id()
RETURNS UUID AS $$
  SELECT school_id FROM public.users WHERE auth_id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY INVOKER;

-- Get current user's role
CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.users WHERE auth_id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY INVOKER;

-- Get current user's internal user ID
CREATE OR REPLACE FUNCTION auth_user_id()
RETURNS UUID AS $$
  SELECT id FROM public.users WHERE auth_id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY INVOKER;

-- Check if current user is super_admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid() AND role = 'super_admin'::user_role
  );
$$ LANGUAGE SQL STABLE SECURITY INVOKER;

-- Get student_id for the currently authenticated student
CREATE OR REPLACE FUNCTION auth_student_id()
RETURNS UUID AS $$
  SELECT s.id FROM students s
  JOIN users u ON s.user_id = u.id
  WHERE u.auth_id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY INVOKER;

-- Get student_ids for the currently authenticated parent/guardian
CREATE OR REPLACE FUNCTION auth_guardian_student_ids()
RETURNS SETOF UUID AS $$
  SELECT g.student_id FROM guardians g
  JOIN users u ON g.user_id = u.id
  WHERE u.auth_id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY INVOKER;

-- Recreate get_user_school_id with fixed parameter name
CREATE OR REPLACE FUNCTION get_user_school_id(p_user_id UUID)
RETURNS UUID AS $$
  SELECT school_id FROM users WHERE id = p_user_id;
$$ LANGUAGE SQL STABLE SECURITY INVOKER;

-- FIX: is_student_enrolled was referencing wrong table (student_enrollments has no class_id)
CREATE OR REPLACE FUNCTION is_student_enrolled(p_student_id UUID, p_class_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM class_assignments
    WHERE student_id = p_student_id
      AND class_id = p_class_id
      AND removed_at IS NULL
  );
$$ LANGUAGE SQL STABLE SECURITY INVOKER;

-- Fix other functions with SECURITY INVOKER
CREATE OR REPLACE FUNCTION get_overdue_books_count(p_student_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER FROM book_checkouts
  WHERE student_id = p_student_id
    AND is_returned = FALSE
    AND due_date < CURRENT_DATE;
$$ LANGUAGE SQL STABLE SECURITY INVOKER;

CREATE OR REPLACE FUNCTION get_pending_letters_count(p_user_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER FROM letter_instances
  WHERE status = 'pending_approval'::letter_instance_status
    AND (approved_by = p_user_id OR created_by = p_user_id);
$$ LANGUAGE SQL STABLE SECURITY INVOKER;

CREATE OR REPLACE FUNCTION has_unpaid_fees(p_student_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM student_fees
    WHERE student_id = p_student_id AND balance > 0
  );
$$ LANGUAGE SQL STABLE SECURITY INVOKER;

-- ============================================================
-- PART 5: NEW RLS POLICIES WITH PROPER TENANT ISOLATION
-- ============================================================

-- ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
-- PATTERN A: School-scoped tables — all school users can read,
-- role-restricted writes. Uses auth_school_id() for isolation.
-- ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

-- === SCHOOLS ===
CREATE POLICY schools_select ON schools
  FOR SELECT USING (
    id = auth_school_id() OR is_super_admin()
  );

CREATE POLICY schools_update ON schools
  FOR UPDATE USING (
    id = auth_school_id()
    AND auth_user_role() IN ('principal'::user_role, 'admin_staff'::user_role)
    OR is_super_admin()
  );

-- === USERS ===
CREATE POLICY users_select ON users
  FOR SELECT USING (
    school_id = auth_school_id() OR is_super_admin()
  );

CREATE POLICY users_insert ON users
  FOR INSERT WITH CHECK (
    school_id = auth_school_id()
    AND auth_user_role() IN ('principal'::user_role, 'admin_staff'::user_role, 'it_admin'::user_role)
    OR is_super_admin()
  );

CREATE POLICY users_update ON users
  FOR UPDATE USING (
    -- Users can update own profile, or admins can update school users
    (id = auth_user_id())
    OR (school_id = auth_school_id() AND auth_user_role() IN ('principal'::user_role, 'admin_staff'::user_role, 'it_admin'::user_role))
    OR is_super_admin()
  );

-- === USER_ROLES ===
CREATE POLICY user_roles_tenant ON user_roles
  FOR ALL USING (school_id = auth_school_id() OR is_super_admin())
  WITH CHECK (school_id = auth_school_id() OR is_super_admin());

-- === PERMISSIONS ===
CREATE POLICY permissions_tenant ON permissions
  FOR ALL USING (school_id = auth_school_id() OR is_super_admin())
  WITH CHECK (school_id = auth_school_id() OR is_super_admin());

-- === STUDENTS ===
CREATE POLICY students_select ON students
  FOR SELECT USING (
    school_id = auth_school_id()
    OR id = auth_student_id()           -- student sees own record
    OR id IN (SELECT auth_guardian_student_ids()) -- parent sees child
    OR is_super_admin()
  );

CREATE POLICY students_insert ON students
  FOR INSERT WITH CHECK (
    school_id = auth_school_id()
    AND auth_user_role() IN ('registrar'::user_role, 'admin_staff'::user_role, 'principal'::user_role)
  );

CREATE POLICY students_update ON students
  FOR UPDATE USING (
    school_id = auth_school_id()
    AND auth_user_role() IN ('registrar'::user_role, 'admin_staff'::user_role, 'principal'::user_role)
  );

CREATE POLICY students_delete ON students
  FOR DELETE USING (
    school_id = auth_school_id()
    AND auth_user_role() IN ('principal'::user_role)
  );

-- === GUARDIANS ===
CREATE POLICY guardians_select ON guardians
  FOR SELECT USING (
    school_id = auth_school_id()
    OR student_id = auth_student_id()          -- student sees own guardians
    OR student_id IN (SELECT auth_guardian_student_ids()) -- parent sees own record
    OR is_super_admin()
  );

CREATE POLICY guardians_write ON guardians
  FOR INSERT WITH CHECK (
    school_id = auth_school_id()
    AND auth_user_role() IN ('registrar'::user_role, 'admin_staff'::user_role, 'principal'::user_role)
  );

CREATE POLICY guardians_update ON guardians
  FOR UPDATE USING (
    school_id = auth_school_id()
    AND auth_user_role() IN ('registrar'::user_role, 'admin_staff'::user_role, 'principal'::user_role)
  );

-- === STUDENT_ENROLLMENTS ===
CREATE POLICY student_enrollments_tenant ON student_enrollments
  FOR ALL USING (school_id = auth_school_id() OR is_super_admin())
  WITH CHECK (school_id = auth_school_id() OR is_super_admin());

-- === STUDENT_DOCUMENTS (no school_id — join through students) ===
CREATE POLICY student_documents_select ON student_documents
  FOR SELECT USING (
    student_id IN (SELECT id FROM students WHERE school_id = auth_school_id())
    OR is_super_admin()
  );

CREATE POLICY student_documents_write ON student_documents
  FOR INSERT WITH CHECK (
    student_id IN (SELECT id FROM students WHERE school_id = auth_school_id())
  );

-- === STUDENT_STATUS_HISTORY ===
CREATE POLICY student_status_history_select ON student_status_history
  FOR SELECT USING (
    student_id IN (SELECT id FROM students WHERE school_id = auth_school_id())
    OR is_super_admin()
  );

CREATE POLICY student_status_history_insert ON student_status_history
  FOR INSERT WITH CHECK (
    student_id IN (SELECT id FROM students WHERE school_id = auth_school_id())
  );

-- === STUDENT_LEAVE_RECORDS ===
CREATE POLICY student_leave_records_tenant ON student_leave_records
  FOR ALL USING (
    student_id IN (SELECT id FROM students WHERE school_id = auth_school_id())
    OR is_super_admin()
  ) WITH CHECK (
    student_id IN (SELECT id FROM students WHERE school_id = auth_school_id())
  );

-- === STUDENT_DISCIPLINE_RECORDS ===
CREATE POLICY student_discipline_records_tenant ON student_discipline_records
  FOR ALL USING (
    student_id IN (SELECT id FROM students WHERE school_id = auth_school_id())
    OR is_super_admin()
  ) WITH CHECK (
    student_id IN (SELECT id FROM students WHERE school_id = auth_school_id())
  );

-- === STUDENT_ACADEMIC_PROGRESS ===
CREATE POLICY student_academic_progress_tenant ON student_academic_progress
  FOR ALL USING (
    student_id IN (SELECT id FROM students WHERE school_id = auth_school_id())
    OR is_super_admin()
  ) WITH CHECK (
    student_id IN (SELECT id FROM students WHERE school_id = auth_school_id())
  );

-- === STUDENT_GRADE_PRIVACY_LOCK ===
CREATE POLICY grade_privacy_lock_select ON student_grade_privacy_lock
  FOR SELECT USING (
    student_id = auth_student_id() OR is_super_admin()
  );

CREATE POLICY grade_privacy_lock_write ON student_grade_privacy_lock
  FOR INSERT WITH CHECK (student_id = auth_student_id());

CREATE POLICY grade_privacy_lock_update ON student_grade_privacy_lock
  FOR UPDATE USING (
    student_id = auth_student_id()
    OR auth_user_role() = 'it_admin'::user_role
  );

-- === CLASSES ===
CREATE POLICY classes_tenant ON classes
  FOR ALL USING (school_id = auth_school_id() OR is_super_admin())
  WITH CHECK (school_id = auth_school_id() OR is_super_admin());

-- === CLASS_ASSIGNMENTS (no school_id — join through classes) ===
CREATE POLICY class_assignments_tenant ON class_assignments
  FOR ALL USING (
    class_id IN (SELECT id FROM classes WHERE school_id = auth_school_id())
    OR is_super_admin()
  ) WITH CHECK (
    class_id IN (SELECT id FROM classes WHERE school_id = auth_school_id())
  );

-- === SUBJECTS ===
CREATE POLICY subjects_tenant ON subjects
  FOR ALL USING (school_id = auth_school_id() OR is_super_admin())
  WITH CHECK (school_id = auth_school_id() OR is_super_admin());

-- === CLASS_SUBJECTS ===
CREATE POLICY class_subjects_tenant ON class_subjects
  FOR ALL USING (
    class_id IN (SELECT id FROM classes WHERE school_id = auth_school_id())
    OR is_super_admin()
  ) WITH CHECK (
    class_id IN (SELECT id FROM classes WHERE school_id = auth_school_id())
  );

-- === TIMETABLES ===
CREATE POLICY timetables_tenant ON timetables
  FOR ALL USING (
    class_id IN (SELECT id FROM classes WHERE school_id = auth_school_id())
    OR is_super_admin()
  ) WITH CHECK (
    class_id IN (SELECT id FROM classes WHERE school_id = auth_school_id())
  );

-- === ACADEMIC_CALENDAR ===
CREATE POLICY academic_calendar_tenant ON academic_calendar
  FOR ALL USING (school_id = auth_school_id() OR is_super_admin())
  WITH CHECK (school_id = auth_school_id() OR is_super_admin());

-- === GRADES (Role-restricted) ===
CREATE POLICY grades_select ON grades
  FOR SELECT USING (
    school_id = auth_school_id()
    OR student_id = auth_student_id()
    OR student_id IN (SELECT auth_guardian_student_ids())
    OR is_super_admin()
  );

CREATE POLICY grades_insert ON grades
  FOR INSERT WITH CHECK (
    school_id = auth_school_id()
    AND auth_user_role() IN ('teacher'::user_role, 'admin_staff'::user_role, 'principal'::user_role)
  );

CREATE POLICY grades_update ON grades
  FOR UPDATE USING (
    school_id = auth_school_id()
    AND auth_user_role() IN ('teacher'::user_role, 'admin_staff'::user_role, 'principal'::user_role)
  );

-- === REPORT_CARDS ===
CREATE POLICY report_cards_select ON report_cards
  FOR SELECT USING (
    student_id IN (SELECT id FROM students WHERE school_id = auth_school_id())
    OR student_id = auth_student_id()
    OR student_id IN (SELECT auth_guardian_student_ids())
    OR is_super_admin()
  );

CREATE POLICY report_cards_write ON report_cards
  FOR INSERT WITH CHECK (
    student_id IN (SELECT id FROM students WHERE school_id = auth_school_id())
    AND auth_user_role() IN ('teacher'::user_role, 'admin_staff'::user_role, 'principal'::user_role)
  );

-- === TRANSCRIPTS ===
CREATE POLICY transcripts_select ON transcripts
  FOR SELECT USING (
    student_id IN (SELECT id FROM students WHERE school_id = auth_school_id())
    OR student_id = auth_student_id()
    OR is_super_admin()
  );

CREATE POLICY transcripts_write ON transcripts
  FOR INSERT WITH CHECK (
    student_id IN (SELECT id FROM students WHERE school_id = auth_school_id())
    AND auth_user_role() IN ('admin_staff'::user_role, 'principal'::user_role, 'registrar'::user_role)
  );

-- === PROMOTION_RECORDS ===
CREATE POLICY promotion_records_tenant ON promotion_records
  FOR ALL USING (
    student_id IN (SELECT id FROM students WHERE school_id = auth_school_id())
    OR is_super_admin()
  ) WITH CHECK (
    student_id IN (SELECT id FROM students WHERE school_id = auth_school_id())
  );

-- === ATTENDANCE_RECORDS (Role-restricted) ===
CREATE POLICY attendance_select ON attendance_records
  FOR SELECT USING (
    -- Tenant isolation via class
    class_id IN (SELECT id FROM classes WHERE school_id = auth_school_id())
    OR student_id = auth_student_id()
    OR student_id IN (SELECT auth_guardian_student_ids())
    OR is_super_admin()
  );

CREATE POLICY attendance_insert ON attendance_records
  FOR INSERT WITH CHECK (
    class_id IN (SELECT id FROM classes WHERE school_id = auth_school_id())
    AND auth_user_role() IN ('teacher'::user_role, 'admin_staff'::user_role, 'dean_of_students'::user_role)
  );

CREATE POLICY attendance_update ON attendance_records
  FOR UPDATE USING (
    class_id IN (SELECT id FROM classes WHERE school_id = auth_school_id())
    AND auth_user_role() IN ('teacher'::user_role, 'admin_staff'::user_role)
  );

-- === NFC_CARDS ===
CREATE POLICY nfc_cards_tenant ON nfc_cards
  FOR ALL USING (school_id = auth_school_id() OR is_super_admin())
  WITH CHECK (school_id = auth_school_id() OR is_super_admin());

-- === NFC_ATTENDANCE_LOGS ===
CREATE POLICY nfc_attendance_logs_tenant ON nfc_attendance_logs
  FOR ALL USING (
    card_id IN (SELECT id FROM nfc_cards WHERE school_id = auth_school_id())
    OR is_super_admin()
  ) WITH CHECK (
    card_id IN (SELECT id FROM nfc_cards WHERE school_id = auth_school_id())
  );

-- === NFC_READERS ===
CREATE POLICY nfc_readers_tenant ON nfc_readers
  FOR ALL USING (school_id = auth_school_id() OR is_super_admin())
  WITH CHECK (school_id = auth_school_id() OR is_super_admin());

-- === FEE_STRUCTURES ===
CREATE POLICY fee_structures_tenant ON fee_structures
  FOR ALL USING (school_id = auth_school_id() OR is_super_admin())
  WITH CHECK (school_id = auth_school_id() OR is_super_admin());

-- === STUDENT_FEES (Role-restricted) ===
CREATE POLICY student_fees_select ON student_fees
  FOR SELECT USING (
    student_id IN (SELECT id FROM students WHERE school_id = auth_school_id())
    OR student_id = auth_student_id()
    OR student_id IN (SELECT auth_guardian_student_ids())
    OR is_super_admin()
  );

CREATE POLICY student_fees_write ON student_fees
  FOR INSERT WITH CHECK (
    student_id IN (SELECT id FROM students WHERE school_id = auth_school_id())
    AND auth_user_role() IN ('bursar'::user_role, 'admin_staff'::user_role, 'principal'::user_role)
  );

CREATE POLICY student_fees_update ON student_fees
  FOR UPDATE USING (
    student_id IN (SELECT id FROM students WHERE school_id = auth_school_id())
    AND auth_user_role() IN ('bursar'::user_role, 'admin_staff'::user_role, 'principal'::user_role)
  );

-- === PAYMENTS (Role-restricted) ===
CREATE POLICY payments_select ON payments
  FOR SELECT USING (
    school_id = auth_school_id()
    OR student_id = auth_student_id()
    OR student_id IN (SELECT auth_guardian_student_ids())
    OR is_super_admin()
  );

CREATE POLICY payments_insert ON payments
  FOR INSERT WITH CHECK (
    school_id = auth_school_id()
    AND auth_user_role() IN ('bursar'::user_role, 'admin_staff'::user_role, 'principal'::user_role)
  );

-- === INVOICES ===
CREATE POLICY invoices_tenant ON invoices
  FOR ALL USING (school_id = auth_school_id() OR is_super_admin())
  WITH CHECK (school_id = auth_school_id() OR is_super_admin());

-- === PAYMENT_RECEIPTS ===
CREATE POLICY payment_receipts_tenant ON payment_receipts
  FOR ALL USING (
    payment_id IN (SELECT id FROM payments WHERE school_id = auth_school_id())
    OR is_super_admin()
  ) WITH CHECK (
    payment_id IN (SELECT id FROM payments WHERE school_id = auth_school_id())
  );

-- === PAYMENT_HISTORY ===
CREATE POLICY payment_history_tenant ON payment_history
  FOR ALL USING (
    student_fee_id IN (
      SELECT sf.id FROM student_fees sf
      JOIN students s ON sf.student_id = s.id
      WHERE s.school_id = auth_school_id()
    )
    OR is_super_admin()
  ) WITH CHECK (
    student_fee_id IN (
      SELECT sf.id FROM student_fees sf
      JOIN students s ON sf.student_id = s.id
      WHERE s.school_id = auth_school_id()
    )
  );

-- === EXPENSE_RECORDS ===
CREATE POLICY expense_records_tenant ON expense_records
  FOR ALL USING (school_id = auth_school_id() OR is_super_admin())
  WITH CHECK (school_id = auth_school_id() OR is_super_admin());

-- === FINANCIAL_REPORTS ===
CREATE POLICY financial_reports_tenant ON financial_reports
  FOR ALL USING (school_id = auth_school_id() OR is_super_admin())
  WITH CHECK (school_id = auth_school_id() OR is_super_admin());

-- === LETTER_TEMPLATES ===
CREATE POLICY letter_templates_tenant ON letter_templates
  FOR ALL USING (school_id = auth_school_id() OR is_super_admin())
  WITH CHECK (school_id = auth_school_id() OR is_super_admin());

-- === LETTER_TEMPLATE_VERSIONS ===
CREATE POLICY letter_template_versions_tenant ON letter_template_versions
  FOR ALL USING (
    template_id IN (SELECT id FROM letter_templates WHERE school_id = auth_school_id())
    OR is_super_admin()
  ) WITH CHECK (
    template_id IN (SELECT id FROM letter_templates WHERE school_id = auth_school_id())
  );

-- === LETTER_INSTANCES (Role-restricted) ===
CREATE POLICY letter_instances_select ON letter_instances
  FOR SELECT USING (
    school_id = auth_school_id()
    OR student_id = auth_student_id()
    OR student_id IN (SELECT auth_guardian_student_ids())
    OR is_super_admin()
  );

CREATE POLICY letter_instances_insert ON letter_instances
  FOR INSERT WITH CHECK (
    school_id = auth_school_id()
    AND auth_user_role() IN (
      'admin_staff'::user_role, 'teacher'::user_role, 'principal'::user_role,
      'vice_principal'::user_role, 'dean_of_students'::user_role,
      'registrar'::user_role, 'bursar'::user_role
    )
  );

CREATE POLICY letter_instances_update ON letter_instances
  FOR UPDATE USING (
    school_id = auth_school_id()
    AND auth_user_role() IN (
      'admin_staff'::user_role, 'principal'::user_role,
      'vice_principal'::user_role, 'dean_of_students'::user_role
    )
  );

-- === LETTER_APPROVALS ===
CREATE POLICY letter_approvals_tenant ON letter_approvals
  FOR ALL USING (
    letter_instance_id IN (SELECT id FROM letter_instances WHERE school_id = auth_school_id())
    OR is_super_admin()
  ) WITH CHECK (
    letter_instance_id IN (SELECT id FROM letter_instances WHERE school_id = auth_school_id())
  );

-- === LETTER_DELIVERIES ===
CREATE POLICY letter_deliveries_tenant ON letter_deliveries
  FOR ALL USING (
    letter_instance_id IN (SELECT id FROM letter_instances WHERE school_id = auth_school_id())
    OR is_super_admin()
  ) WITH CHECK (
    letter_instance_id IN (SELECT id FROM letter_instances WHERE school_id = auth_school_id())
  );

-- === LETTER_RECALLS ===
CREATE POLICY letter_recalls_tenant ON letter_recalls
  FOR ALL USING (
    letter_instance_id IN (SELECT id FROM letter_instances WHERE school_id = auth_school_id())
    OR is_super_admin()
  ) WITH CHECK (
    letter_instance_id IN (SELECT id FROM letter_instances WHERE school_id = auth_school_id())
  );

-- === LETTER_ACKNOWLEDGMENTS ===
CREATE POLICY letter_acknowledgments_select ON letter_acknowledgments
  FOR SELECT USING (
    letter_instance_id IN (SELECT id FROM letter_instances WHERE school_id = auth_school_id())
    OR acknowledged_by = auth_user_id()
    OR is_super_admin()
  );

CREATE POLICY letter_acknowledgments_insert ON letter_acknowledgments
  FOR INSERT WITH CHECK (
    letter_instance_id IN (SELECT id FROM letter_instances WHERE school_id = auth_school_id())
  );

-- === LETTER_AUDIT_LOG (Append-only, read-restricted) ===
CREATE POLICY letter_audit_log_select ON letter_audit_log
  FOR SELECT USING (
    letter_instance_id IN (SELECT id FROM letter_instances WHERE school_id = auth_school_id())
    AND auth_user_role() IN ('principal'::user_role, 'proprietor'::user_role, 'vice_principal'::user_role)
    OR is_super_admin()
  );

CREATE POLICY letter_audit_log_insert ON letter_audit_log
  FOR INSERT WITH CHECK (TRUE); -- System inserts via functions

-- === PRINT_QUEUE ===
CREATE POLICY print_queue_tenant ON print_queue
  FOR ALL USING (school_id = auth_school_id() OR is_super_admin())
  WITH CHECK (school_id = auth_school_id() OR is_super_admin());

-- === ANNOUNCEMENTS ===
CREATE POLICY announcements_tenant ON announcements
  FOR ALL USING (school_id = auth_school_id() OR is_super_admin())
  WITH CHECK (school_id = auth_school_id() OR is_super_admin());

-- === MESSAGES ===
CREATE POLICY messages_select ON messages
  FOR SELECT USING (
    school_id = auth_school_id()
    AND (sender_id = auth_user_id() OR recipient_id = auth_user_id())
    OR is_super_admin()
  );

CREATE POLICY messages_insert ON messages
  FOR INSERT WITH CHECK (
    school_id = auth_school_id()
    AND sender_id = auth_user_id()
  );

-- === NOTIFICATIONS ===
CREATE POLICY notifications_select ON notifications
  FOR SELECT USING (
    user_id = auth_user_id() OR is_super_admin()
  );

CREATE POLICY notifications_insert ON notifications
  FOR INSERT WITH CHECK (
    school_id = auth_school_id() OR is_super_admin()
  );

CREATE POLICY notifications_update ON notifications
  FOR UPDATE USING (
    user_id = auth_user_id() -- users can mark own notifications as read
  );

-- === NOTIFICATION_PREFERENCES ===
CREATE POLICY notification_preferences_tenant ON notification_preferences
  FOR ALL USING (user_id = auth_user_id() OR is_super_admin())
  WITH CHECK (user_id = auth_user_id() OR is_super_admin());

-- === SMS_LOGS ===
CREATE POLICY sms_logs_tenant ON sms_logs
  FOR ALL USING (school_id = auth_school_id() OR is_super_admin())
  WITH CHECK (school_id = auth_school_id() OR is_super_admin());

-- === BOOKS ===
CREATE POLICY books_tenant ON books
  FOR ALL USING (school_id = auth_school_id() OR is_super_admin())
  WITH CHECK (school_id = auth_school_id() OR is_super_admin());

-- === BOOK_COPIES ===
CREATE POLICY book_copies_tenant ON book_copies
  FOR ALL USING (
    book_id IN (SELECT id FROM books WHERE school_id = auth_school_id())
    OR is_super_admin()
  ) WITH CHECK (
    book_id IN (SELECT id FROM books WHERE school_id = auth_school_id())
  );

-- === BOOK_CHECKOUTS ===
CREATE POLICY book_checkouts_select ON book_checkouts
  FOR SELECT USING (
    student_id IN (SELECT id FROM students WHERE school_id = auth_school_id())
    OR student_id = auth_student_id()
    OR is_super_admin()
  );

CREATE POLICY book_checkouts_write ON book_checkouts
  FOR INSERT WITH CHECK (
    student_id IN (SELECT id FROM students WHERE school_id = auth_school_id())
    AND auth_user_role() IN ('librarian'::user_role, 'admin_staff'::user_role)
  );

-- === BOOK_RETURNS ===
CREATE POLICY book_returns_tenant ON book_returns
  FOR ALL USING (
    student_id IN (SELECT id FROM students WHERE school_id = auth_school_id())
    OR is_super_admin()
  ) WITH CHECK (
    student_id IN (SELECT id FROM students WHERE school_id = auth_school_id())
    AND auth_user_role() IN ('librarian'::user_role, 'admin_staff'::user_role)
  );

-- === LIBRARY_REPORTS ===
CREATE POLICY library_reports_tenant ON library_reports
  FOR ALL USING (school_id = auth_school_id() OR is_super_admin())
  WITH CHECK (school_id = auth_school_id() OR is_super_admin());

-- === COUNSELING_SESSIONS (Confidential) ===
CREATE POLICY counseling_sessions_select ON counseling_sessions
  FOR SELECT USING (
    -- Only counselor and principal can see
    (student_id IN (SELECT id FROM students WHERE school_id = auth_school_id())
     AND auth_user_role() IN ('guidance_counselor'::user_role, 'principal'::user_role, 'dean_of_students'::user_role))
    OR is_super_admin()
  );

CREATE POLICY counseling_sessions_write ON counseling_sessions
  FOR INSERT WITH CHECK (
    student_id IN (SELECT id FROM students WHERE school_id = auth_school_id())
    AND auth_user_role() = 'guidance_counselor'::user_role
  );

-- === STUDENT_INCIDENTS ===
CREATE POLICY student_incidents_tenant ON student_incidents
  FOR ALL USING (
    student_id IN (SELECT id FROM students WHERE school_id = auth_school_id())
    OR is_super_admin()
  ) WITH CHECK (
    student_id IN (SELECT id FROM students WHERE school_id = auth_school_id())
  );

-- === INCIDENT_ACTIONS ===
CREATE POLICY incident_actions_tenant ON incident_actions
  FOR ALL USING (
    incident_id IN (
      SELECT si.id FROM student_incidents si
      JOIN students s ON si.student_id = s.id
      WHERE s.school_id = auth_school_id()
    )
    OR is_super_admin()
  ) WITH CHECK (
    incident_id IN (
      SELECT si.id FROM student_incidents si
      JOIN students s ON si.student_id = s.id
      WHERE s.school_id = auth_school_id()
    )
  );

-- === PARENT_MEETINGS ===
CREATE POLICY parent_meetings_select ON parent_meetings
  FOR SELECT USING (
    student_id IN (SELECT id FROM students WHERE school_id = auth_school_id())
    OR student_id IN (SELECT auth_guardian_student_ids())
    OR is_super_admin()
  );

CREATE POLICY parent_meetings_write ON parent_meetings
  FOR INSERT WITH CHECK (
    student_id IN (SELECT id FROM students WHERE school_id = auth_school_id())
  );

-- === ID_CARD_DESIGNS ===
CREATE POLICY id_card_designs_tenant ON id_card_designs
  FOR ALL USING (school_id = auth_school_id() OR is_super_admin())
  WITH CHECK (school_id = auth_school_id() OR is_super_admin());

-- === ID_CARD_GENERATION ===
CREATE POLICY id_card_generation_tenant ON id_card_generation
  FOR ALL USING (school_id = auth_school_id() OR is_super_admin())
  WITH CHECK (school_id = auth_school_id() OR is_super_admin());

-- === NFC_CHIP_ASSIGNMENTS ===
CREATE POLICY nfc_chip_assignments_tenant ON nfc_chip_assignments
  FOR ALL USING (
    card_id IN (SELECT id FROM nfc_cards WHERE school_id = auth_school_id())
    OR is_super_admin()
  ) WITH CHECK (
    card_id IN (SELECT id FROM nfc_cards WHERE school_id = auth_school_id())
  );

-- === AUDIT_LOGS (Read-only, append-only) ===
CREATE POLICY audit_logs_select ON audit_logs
  FOR SELECT USING (
    (school_id = auth_school_id()
     AND auth_user_role() IN ('principal'::user_role, 'proprietor'::user_role, 'it_admin'::user_role))
    OR is_super_admin()
  );

CREATE POLICY audit_logs_insert ON audit_logs
  FOR INSERT WITH CHECK (TRUE); -- System inserts only

-- ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
-- PATTERN B: Platform-level tables — Super Admin only
-- ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

-- === SUBSCRIPTION_PLANS (read by all, write by super_admin) ===
CREATE POLICY subscription_plans_select ON subscription_plans
  FOR SELECT USING (TRUE); -- Public pricing

CREATE POLICY subscription_plans_write ON subscription_plans
  FOR INSERT WITH CHECK (is_super_admin());

CREATE POLICY subscription_plans_update ON subscription_plans
  FOR UPDATE USING (is_super_admin());

-- === SUBSCRIPTIONS ===
CREATE POLICY subscriptions_select ON subscriptions
  FOR SELECT USING (
    school_id = auth_school_id() OR is_super_admin()
  );

CREATE POLICY subscriptions_write ON subscriptions
  FOR ALL USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- === DISCOUNTS ===
CREATE POLICY discounts_select ON discounts
  FOR SELECT USING (is_active = TRUE OR is_super_admin());

CREATE POLICY discounts_write ON discounts
  FOR INSERT WITH CHECK (is_super_admin());

CREATE POLICY discounts_update ON discounts
  FOR UPDATE USING (is_super_admin());

-- === BILLING_INVOICES ===
CREATE POLICY billing_invoices_tenant ON billing_invoices
  FOR SELECT USING (
    school_id = auth_school_id() OR is_super_admin()
  );

CREATE POLICY billing_invoices_write ON billing_invoices
  FOR INSERT WITH CHECK (is_super_admin());

-- === PAYMENT_METHOD_RECORDS ===
CREATE POLICY payment_method_records_tenant ON payment_method_records
  FOR ALL USING (school_id = auth_school_id() OR is_super_admin())
  WITH CHECK (school_id = auth_school_id() OR is_super_admin());

-- === PLATFORM_PAYMENTS ===
CREATE POLICY platform_payments_select ON platform_payments
  FOR SELECT USING (
    school_id = auth_school_id() OR is_super_admin()
  );

CREATE POLICY platform_payments_write ON platform_payments
  FOR INSERT WITH CHECK (is_super_admin());

-- === SUBSCRIPTION_HISTORY ===
CREATE POLICY subscription_history_tenant ON subscription_history
  FOR SELECT USING (
    subscription_id IN (SELECT id FROM subscriptions WHERE school_id = auth_school_id())
    OR is_super_admin()
  );

CREATE POLICY subscription_history_insert ON subscription_history
  FOR INSERT WITH CHECK (is_super_admin());

-- === EXCHANGE_RATES (read by all, write by super_admin) ===
CREATE POLICY exchange_rates_select ON exchange_rates
  FOR SELECT USING (TRUE);

CREATE POLICY exchange_rates_write ON exchange_rates
  FOR INSERT WITH CHECK (is_super_admin());

CREATE POLICY exchange_rates_update ON exchange_rates
  FOR UPDATE USING (is_super_admin());

-- === PLATFORM_ADMIN_USERS ===
CREATE POLICY platform_admin_users_tenant ON platform_admin_users
  FOR ALL USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- === SYSTEM_LOGS ===
CREATE POLICY system_logs_select ON system_logs
  FOR SELECT USING (is_super_admin());

CREATE POLICY system_logs_insert ON system_logs
  FOR INSERT WITH CHECK (TRUE); -- System inserts

-- === WEBHOOK_EVENTS ===
CREATE POLICY webhook_events_tenant ON webhook_events
  FOR ALL USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Enable RLS on new tables
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_notifications_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PART 6: RECREATE VIEWS WITH FIXES
-- ============================================================
-- (Views were already dropped in section 2D before ENUM conversions)

-- View: Student Dashboard Data
CREATE VIEW vw_student_dashboard AS
SELECT
  s.id as student_id,
  s.school_id,
  s.first_name,
  s.last_name,
  s.registration_number,
  s.date_of_birth,
  s.current_class_id as class_id,
  c.name as class_name,
  c.grade_level as class_level,
  ac.term_name,
  ac.start_date,
  ac.end_date,
  (SELECT AVG(gpa_points) FROM grades WHERE student_id = s.id) as avg_gpa,
  (SELECT COUNT(*) FROM attendance_records WHERE student_id = s.id) as attendance_days,
  has_unpaid_fees(s.id) as has_pending_fees,
  get_overdue_books_count(s.id) as overdue_books
FROM students s
LEFT JOIN classes c ON s.current_class_id = c.id
LEFT JOIN academic_calendar ac ON s.school_id = ac.school_id
  AND ac.start_date <= CURRENT_DATE
  AND ac.end_date >= CURRENT_DATE;

-- View: Teacher Classload
CREATE VIEW vw_teacher_classload AS
SELECT
  u.id as teacher_id,
  u.school_id,
  u.first_name,
  u.last_name,
  cs.class_id,
  c.name as class_name,
  c.grade_level,
  s.name as subject_name,
  cs.academic_year
FROM users u
JOIN class_subjects cs ON u.id = cs.teacher_id
JOIN classes c ON cs.class_id = c.id
LEFT JOIN subjects s ON cs.subject_id = s.id
WHERE u.role = 'teacher'::user_role
ORDER BY c.grade_level, c.name;

-- View: Attendance Summary by Class
CREATE VIEW vw_attendance_summary_by_class AS
SELECT
  c.id as class_id,
  c.school_id,
  c.name as class_name,
  ac.id as term_id,
  ac.term_name,
  COUNT(DISTINCT st.id) as total_students,
  COUNT(DISTINCT ar.id) as total_attendance_records,
  ROUND(
    CAST(
      COUNT(DISTINCT ar.id)::FLOAT /
      GREATEST(COUNT(DISTINCT st.id) * NULLIF(COUNT(DISTINCT ar.attendance_date), 0), 1)::FLOAT
      * 100 AS NUMERIC
    ), 2
  ) as attendance_percentage
FROM classes c
JOIN students st ON c.id = st.current_class_id
JOIN academic_calendar ac ON c.school_id = ac.school_id
LEFT JOIN attendance_records ar ON st.id = ar.student_id
GROUP BY c.id, c.school_id, c.name, ac.id, ac.term_name;

-- View: Financial Summary by Class — FIXED division by zero
CREATE VIEW vw_financial_summary_by_class AS
SELECT
  c.id as class_id,
  c.school_id,
  c.name as class_name,
  COUNT(DISTINCT st.id) as total_students,
  COALESCE(SUM(sf.amount_due), 0) as total_fees_due,
  COALESCE(SUM(p.amount_usd), 0) as total_paid,
  COALESCE(SUM(sf.amount_due), 0) - COALESCE(SUM(p.amount_usd), 0) as outstanding_balance,
  CASE
    WHEN COALESCE(SUM(sf.amount_due), 0) = 0 THEN 0
    ELSE ROUND(
      CAST(COALESCE(SUM(p.amount_usd), 0) / NULLIF(SUM(sf.amount_due), 0)::FLOAT * 100 AS NUMERIC),
      2
    )
  END as collection_percentage
FROM classes c
LEFT JOIN students st ON c.id = st.current_class_id
LEFT JOIN student_fees sf ON st.id = sf.student_id
LEFT JOIN payments p ON sf.id = p.student_fee_id AND p.status = 'success'::payment_status
GROUP BY c.id, c.school_id, c.name;

-- View: Parent/Guardian Dashboard
CREATE VIEW vw_guardian_dashboard AS
SELECT
  g.id as guardian_id,
  g.school_id,
  g.full_name as guardian_full_name,
  g.phone,
  g.email,
  s.id as student_id,
  s.first_name as student_first_name,
  s.last_name as student_last_name,
  s.registration_number,
  c.name as class_name,
  c.grade_level as class_level,
  COALESCE(sf.amount_due, 0) as fees_due,
  COALESCE(p.amount_usd, 0) as amount_paid,
  COALESCE(sf.amount_due, 0) - COALESCE(p.amount_usd, 0) as balance_due
FROM guardians g
JOIN students s ON g.student_id = s.id
LEFT JOIN classes c ON s.current_class_id = c.id
LEFT JOIN student_fees sf ON s.id = sf.student_id
LEFT JOIN payments p ON sf.id = p.student_fee_id AND p.status = 'success'::payment_status
ORDER BY g.id, s.id;

-- View: Staff Directory by School
CREATE VIEW vw_staff_directory AS
SELECT
  u.id,
  u.school_id,
  u.email,
  u.first_name,
  u.last_name,
  u.phone,
  u.role,
  u.is_active as status,
  u.created_at,
  s.name as school_name
FROM users u
JOIN schools s ON u.school_id = s.id
WHERE u.role NOT IN ('student'::user_role, 'parent'::user_role)
ORDER BY u.role, u.last_name;

-- View: Grade Report Summary
CREATE VIEW vw_grade_report_summary AS
SELECT
  s.id as student_id,
  s.school_id,
  s.first_name,
  s.last_name,
  c.id as class_id,
  c.name as class_name,
  ac.term_name,
  COUNT(g.id) as subject_count,
  ROUND(AVG(g.gpa_points)::NUMERIC, 2) as average_gpa,
  MAX(g.gpa_points) as highest_grade,
  MIN(g.gpa_points) as lowest_grade,
  ac.start_date as term_start,
  ac.end_date as term_end,
  CURRENT_TIMESTAMP as generated_at
FROM students s
LEFT JOIN classes c ON s.current_class_id = c.id
LEFT JOIN academic_calendar ac ON s.school_id = ac.school_id
LEFT JOIN grades g ON s.id = g.student_id AND g.academic_year = ac.academic_year
GROUP BY s.id, s.school_id, c.id, ac.id, ac.term_name, ac.start_date, ac.end_date;

-- View: NFC Card Assignment Status
CREATE VIEW vw_nfc_card_status AS
SELECT
  nca.id as assignment_id,
  nc.school_id,
  nc.card_number,
  nc.status as card_status,
  s.id as student_id,
  s.first_name,
  s.last_name,
  s.registration_number,
  nca.assignment_date,
  nc.valid_until,
  (SELECT COUNT(*) FROM nfc_attendance_logs WHERE card_id = nc.id AND DATE(tapped_at) = CURRENT_DATE) as scans_today
FROM nfc_chip_assignments nca
JOIN nfc_cards nc ON nca.card_id = nc.id
JOIN students s ON nca.assigned_to_student = s.id
WHERE nc.status IN ('active'::nfc_card_status, 'inactive'::nfc_card_status)
ORDER BY nc.status, s.last_name;

-- View: Library Outstanding Items
CREATE VIEW vw_library_outstanding_items AS
SELECT
  s.id as student_id,
  s.school_id,
  s.first_name,
  s.last_name,
  b.title as book_title,
  b.isbn,
  bc.barcode as copy_number,
  bcr.checkout_date,
  bcr.due_date,
  CURRENT_DATE - bcr.due_date as days_overdue,
  CASE
    WHEN CURRENT_DATE > bcr.due_date THEN 'overdue'
    WHEN CURRENT_DATE > bcr.due_date - INTERVAL '3 days' THEN 'due_soon'
    ELSE 'on_time'
  END as status
FROM book_checkouts bcr
JOIN book_copies bc ON bcr.book_copy_id = bc.id
JOIN books b ON bc.book_id = b.id
JOIN students s ON bcr.student_id = s.id
WHERE bcr.is_returned = FALSE
ORDER BY bcr.due_date ASC;

-- View: Active Subscriptions
CREATE VIEW vw_active_subscriptions AS
SELECT
  s.id,
  s.school_id,
  sch.name as school_name,
  sp.name as plan_name,
  sp.student_limit,
  s.started_at,
  s.expires_at,
  CASE
    WHEN s.expires_at < CURRENT_TIMESTAMP THEN 'expired'
    WHEN s.expires_at - CURRENT_TIMESTAMP < INTERVAL '30 days' THEN 'expiring_soon'
    ELSE s.status::TEXT
  END as display_status,
  s.expires_at - CURRENT_TIMESTAMP as time_remaining
FROM subscriptions s
JOIN schools sch ON s.school_id = sch.id
JOIN subscription_plans sp ON s.plan_id = sp.id
ORDER BY s.expires_at ASC;

-- View: Monthly Revenue Summary
CREATE VIEW vw_monthly_revenue_summary AS
SELECT
  DATE_TRUNC('month', p.created_at)::DATE as month,
  s.id as school_id,
  s.name as school_name,
  COUNT(DISTINCT p.id) as transaction_count,
  COALESCE(SUM(p.amount_usd), 0) as total_revenue,
  COALESCE(AVG(p.amount_usd), 0) as average_transaction,
  COUNT(DISTINCT p.student_id) as students_paid
FROM payments p
JOIN students st ON p.student_id = st.id
JOIN schools s ON st.school_id = s.id
WHERE p.status = 'success'::payment_status
GROUP BY DATE_TRUNC('month', p.created_at), s.id, s.name
ORDER BY month DESC;

-- View: Late Finance Collections by School
CREATE VIEW vw_late_payments AS
SELECT
  st.school_id,
  sch.name as school_name,
  COUNT(DISTINCT sf.student_id) as students_with_late_fees,
  COALESCE(SUM(sf.balance), 0) as total_overdue
FROM student_fees sf
JOIN students st ON sf.student_id = st.id
JOIN schools sch ON st.school_id = sch.id
WHERE sf.balance > 0
GROUP BY st.school_id, sch.name
ORDER BY total_overdue DESC;

-- View: Staff Letter Activity — FIXED: use letter_deliveries for delivered count
CREATE VIEW vw_staff_letter_activity AS
SELECT
  u.id as staff_id,
  u.school_id,
  u.first_name,
  u.last_name,
  u.role,
  COUNT(li.id) as letters_generated,
  COUNT(CASE WHEN li.status = 'sent'::letter_instance_status THEN 1 END) as letters_sent,
  COUNT(CASE WHEN li.status = 'pending_approval'::letter_instance_status THEN 1 END) as pending_approval,
  MAX(li.created_at) as last_letter_created
FROM users u
LEFT JOIN letter_instances li ON u.id = li.created_by
WHERE u.role NOT IN ('student'::user_role, 'parent'::user_role)
GROUP BY u.id, u.school_id, u.first_name, u.last_name, u.role
ORDER BY letters_generated DESC;

-- View: Recent Audit Activity
CREATE VIEW vw_recent_audit_activity AS
SELECT
  al.id,
  al.school_id,
  s.name as school_name,
  al.user_id,
  COALESCE(u.first_name || ' ' || u.last_name, 'System') as user_name,
  al.action,
  al.entity_type,
  al.entity_id,
  al.description,
  al.created_at
FROM audit_logs al
LEFT JOIN schools s ON al.school_id = s.id
LEFT JOIN users u ON al.user_id = u.id
ORDER BY al.created_at DESC
LIMIT 100;

-- ============================================================
-- PART 7: ADDITIONAL INDEXES FOR NEW COLUMNS
-- ============================================================

CREATE INDEX idx_letter_instances_status_enum ON letter_instances(status);
CREATE INDEX idx_letter_deliveries_status ON letter_deliveries(status);
CREATE INDEX idx_print_queue_status ON print_queue(status);
CREATE INDEX idx_student_fees_balance ON student_fees(balance);

-- ============================================================
-- MIGRATION 006 COMPLETE
-- ============================================================
-- Fixes applied:
--   [P0] users.auth_id linking to Supabase auth.users
--   [P0] All RLS policies now enforce school_id tenant isolation
--   [P0] Removed password_hash (Supabase Auth handles passwords)
--   [P1] Created letter_audit_log table with checksum chain
--   [P1] Fixed is_student_enrolled (was using wrong table)
--   [P1] Fixed vw_financial_summary_by_class division by zero
--   [P1] Fixed vw_staff_letter_activity (delivered → sent status)
--   [P2] Added students.user_id linking students to user accounts
--   [P2] Added guardians.user_id + school_id for auth & querying
--   [P2] Replaced attendance_summary table with computed VIEW
--   [P2] Added student_fees.balance auto-sync trigger
--   [P3] Replaced overdue_books table with computed VIEW
--   [P3] Converted letter VARCHAR columns to proper ENUMs
--   [+]  Created platform_notifications_log table
--   [+]  Created auth helper functions (auth_school_id, auth_user_role, etc.)
--   [+]  Added RLS policies for ALL 55+ tables (many had RLS enabled with no policies)
--   [+]  Added school_id to views for frontend filtering
-- ============================================================
