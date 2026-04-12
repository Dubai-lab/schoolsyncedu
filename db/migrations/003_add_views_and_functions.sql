-- ============================================================
-- SCHOOLSYNC VIEWS & UTILITY FUNCTIONS
-- Migration: 003_add_views_and_functions.sql
-- ============================================================

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Function: Get current term
CREATE OR REPLACE FUNCTION get_current_term(school_id UUID)
RETURNS UUID AS $$
  SELECT id FROM academic_calendar 
  WHERE school_id = $1 
  AND start_date <= CURRENT_DATE 
  AND end_date >= CURRENT_DATE 
  LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- Function: Get student full name
CREATE OR REPLACE FUNCTION get_student_full_name(student_id UUID)
RETURNS TEXT AS $$
  SELECT first_name || ' ' || last_name FROM students WHERE id = $1;
$$ LANGUAGE SQL STABLE;

-- Function: Check if student is enrolled in class
CREATE OR REPLACE FUNCTION is_student_enrolled(student_id UUID, class_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM student_enrollments 
    WHERE student_id = $1 AND class_id = $2 AND status = 'active'
  );
$$ LANGUAGE SQL STABLE;

-- Function: Calculate student GPA for term
CREATE OR REPLACE FUNCTION calculate_student_gpa(student_id UUID, academic_year VARCHAR)
RETURNS DECIMAL AS $$
  SELECT AVG(CAST(gpa_points AS DECIMAL))
  FROM grades 
  WHERE student_id = $1 
  AND academic_year = $2 
  AND gpa_points IS NOT NULL;
$$ LANGUAGE SQL STABLE;

-- Function: Get overdue books count
CREATE OR REPLACE FUNCTION get_overdue_books_count(student_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*) FROM overdue_books WHERE student_id = $1;
$$ LANGUAGE SQL STABLE;

-- Function: Get pending letters count for approval
CREATE OR REPLACE FUNCTION get_pending_letters_count(user_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*) FROM letter_instances 
  WHERE status = 'pending_approval' 
  AND (approved_by = $1 OR created_by = $1);
$$ LANGUAGE SQL STABLE;

-- Function: Check if student has unpaid fees
CREATE OR REPLACE FUNCTION has_unpaid_fees(student_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM student_fees 
    WHERE student_id = $1 AND amount_due > 0
  );
$$ LANGUAGE SQL STABLE;

-- ============================================================
-- USEFUL VIEWS
-- ============================================================

-- View: Student Dashboard Data
CREATE OR REPLACE VIEW vw_student_dashboard AS
SELECT 
  s.id as student_id,
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
JOIN academic_calendar ac ON s.school_id = ac.school_id 
  AND ac.start_date <= CURRENT_DATE 
  AND ac.end_date >= CURRENT_DATE;

-- View: Teacher Classload (Classes assigned to teacher)
CREATE OR REPLACE VIEW vw_teacher_classload AS
SELECT 
  u.id as teacher_id,
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
CREATE OR REPLACE VIEW vw_attendance_summary_by_class AS
SELECT 
  c.id as class_id,
  c.name as class_name,
  ac.id as term_id,
  ac.term_name,
  COUNT(DISTINCT st.id) as total_students,
  COUNT(DISTINCT ar.id) as total_attendance_records,
  ROUND(
    CAST((COUNT(DISTINCT ar.id)::FLOAT / 
     GREATEST(COUNT(DISTINCT st.id) * COUNT(DISTINCT ar.attendance_date), 1)::FLOAT) * 100 AS NUMERIC), 
    2
  ) as attendance_percentage
FROM classes c
JOIN students st ON c.id = st.current_class_id
JOIN academic_calendar ac ON st.school_id = ac.school_id
LEFT JOIN attendance_records ar ON st.id = ar.student_id
GROUP BY c.id, c.name, ac.id, ac.term_name;

-- View: Financial Summary by Class
CREATE OR REPLACE VIEW vw_financial_summary_by_class AS
SELECT 
  c.id as class_id,
  c.name as class_name,
  COUNT(DISTINCT st.id) as total_students,
  SUM(sf.amount_due) as total_fees_due,
  SUM(p.amount_usd) as total_paid,
  SUM(sf.amount_due) - COALESCE(SUM(p.amount_usd), 0) as outstanding_balance,
  ROUND(
    CAST((COALESCE(SUM(p.amount_usd), 0) / SUM(sf.amount_due)::FLOAT) * 100 AS NUMERIC),
    2
  ) as collection_percentage
FROM classes c
LEFT JOIN students st ON c.id = st.current_class_id
LEFT JOIN student_fees sf ON st.id = sf.student_id
LEFT JOIN payments p ON sf.id = p.student_fee_id AND p.status = 'success'::payment_status
GROUP BY c.id, c.name;

-- View: Parent/Guardian Dashboard
CREATE OR REPLACE VIEW vw_guardian_dashboard AS
SELECT 
  g.id as guardian_id,
  g.full_name as guardian_full_name,
  g.phone,
  g.email,
  s.id as student_id,
  s.first_name as student_first_name,
  s.last_name as student_last_name,
  s.registration_number,
  c.name as class_name,
  c.grade_level as class_level,
  sf.amount_due as fees_due,
  p.amount_usd as amount_paid,
  (sf.amount_due - COALESCE(p.amount_usd, 0)) as balance_due
FROM guardians g
JOIN students s ON g.student_id = s.id
LEFT JOIN classes c ON s.current_class_id = c.id
LEFT JOIN student_fees sf ON s.id = sf.student_id
LEFT JOIN payments p ON sf.id = p.student_fee_id AND p.status = 'success'::payment_status
ORDER BY g.id, s.id;

-- View: Staff Directory by School
CREATE OR REPLACE VIEW vw_staff_directory AS
SELECT 
  u.id,
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
CREATE OR REPLACE VIEW vw_grade_report_summary AS
SELECT 
  s.id as student_id,
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
GROUP BY s.id, c.id, ac.id, ac.term_name, ac.start_date, ac.end_date;

-- View: NFC Card Assignment Status
CREATE OR REPLACE VIEW vw_nfc_card_status AS
SELECT 
  nca.id as assignment_id,
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
CREATE OR REPLACE VIEW vw_library_outstanding_items AS
SELECT 
  s.id as student_id,
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
CREATE OR REPLACE VIEW vw_active_subscriptions AS
SELECT 
  s.id,
  s.school_id,
  sch.name as school_name,
  sp.name as plan_name,
  sp.student_limit,
  s.started_at,
  s.expires_at,
  CASE 
    WHEN s.expires_at < CURRENT_DATE THEN 'expired'
    WHEN s.expires_at - CURRENT_DATE < INTERVAL '30 days' THEN 'expiring_soon'
    ELSE s.status::TEXT
  END as status,
  s.expires_at - CURRENT_DATE as days_remaining
FROM subscriptions s
JOIN schools sch ON s.school_id = sch.id
JOIN subscription_plans sp ON s.plan_id = sp.id
ORDER BY s.expires_at ASC;

-- View: Monthly Revenue Summary
CREATE OR REPLACE VIEW vw_monthly_revenue_summary AS
SELECT 
  DATE_TRUNC('month', p.created_at)::DATE as month,
  s.id as school_id,
  s.name as school_name,
  COUNT(DISTINCT p.id) as transaction_count,
  SUM(p.amount_usd) as total_revenue,
  AVG(p.amount_usd) as average_transaction,
  COUNT(DISTINCT p.student_id) as students_paid
FROM payments p
JOIN students st ON p.student_id = st.id
JOIN schools s ON st.school_id = s.id
WHERE p.status = 'success'::payment_status
GROUP BY DATE_TRUNC('month', p.created_at), s.id, s.name
ORDER BY month DESC;

-- ============================================================
-- INDEX VIEWS FOR PERFORMANCE
-- ============================================================

-- Index View: Late Finance Collections by School
CREATE OR REPLACE VIEW vw_late_payments AS
SELECT 
  st.school_id,
  sch.name as school_name,
  COUNT(DISTINCT sf.student_id) as students_with_late_fees,
  SUM(sf.amount_due) as total_overdue,
  COUNT(DISTINCT sf.student_id) as unique_students
FROM student_fees sf
JOIN students st ON sf.student_id = st.id
JOIN schools sch ON st.school_id = sch.id
WHERE sf.amount_due > 0 
GROUP BY st.school_id, sch.name
ORDER BY total_overdue DESC;

-- Index View: Staff Performance (Based on letter generation)
CREATE OR REPLACE VIEW vw_staff_letter_activity AS
SELECT 
  u.id as staff_id,
  u.first_name,
  u.last_name,
  u.role,
  COUNT(li.id) as letters_generated,
  COUNT(CASE WHEN li.status = 'delivered' THEN 1 END) as letters_delivered,
  COUNT(CASE WHEN li.status = 'pending_approval' THEN 1 END) as pending_approval,
  MAX(li.created_at) as last_letter_created
FROM users u
LEFT JOIN letter_instances li ON u.id = li.created_by
WHERE u.role NOT IN ('student'::user_role, 'parent'::user_role)
GROUP BY u.id, u.first_name, u.last_name, u.role
ORDER BY letters_generated DESC;

-- ============================================================
-- AUDIT & COMPLIANCE HELPERS
-- ============================================================

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
$$ LANGUAGE plpgsql;

-- View: Recent Audit Activity
CREATE OR REPLACE VIEW vw_recent_audit_activity AS
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
-- MIGRATION COMPLETE: Views & Functions Ready
-- ============================================================
