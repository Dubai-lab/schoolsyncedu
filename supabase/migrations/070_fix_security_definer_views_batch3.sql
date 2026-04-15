-- Migration 070: Fix SECURITY DEFINER views — batch 3
-- Run this in: Supabase Dashboard → SQL Editor → New query
--
-- Views fixed:
--   1. vw_student_dashboard   — all schools' student data visible
--   2. vw_guardian_dashboard  — all schools' guardian/fee data visible
--   3. vw_staff_directory     — all schools' staff visible cross-school

-- ─────────────────────────────────────────────────────────────
-- 1. vw_student_dashboard
-- ─────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS vw_student_dashboard CASCADE;

CREATE VIEW vw_student_dashboard
  WITH (security_invoker = true)
AS
SELECT
  s.id                                                              AS student_id,
  s.school_id,
  s.first_name,
  s.last_name,
  s.registration_number,
  s.date_of_birth,
  s.current_class_id                                                AS class_id,
  c.name                                                            AS class_name,
  c.grade_level                                                     AS class_level,
  ac.term_name,
  ac.start_date,
  ac.end_date,
  (SELECT AVG(gpa_points) FROM grades WHERE student_id = s.id)     AS avg_gpa,
  (SELECT COUNT(*) FROM attendance_records WHERE student_id = s.id) AS attendance_days,
  has_unpaid_fees(s.id)                                             AS has_pending_fees,
  get_overdue_books_count(s.id)                                     AS overdue_books
FROM students s
LEFT JOIN classes c ON s.current_class_id = c.id
LEFT JOIN academic_calendar ac
  ON s.school_id = ac.school_id
 AND ac.start_date <= CURRENT_DATE
 AND ac.end_date   >= CURRENT_DATE;

GRANT SELECT ON vw_student_dashboard TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2. vw_guardian_dashboard
-- ─────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS vw_guardian_dashboard CASCADE;

CREATE VIEW vw_guardian_dashboard
  WITH (security_invoker = true)
AS
SELECT
  g.id                                                              AS guardian_id,
  g.school_id,
  g.full_name                                                       AS guardian_full_name,
  g.phone,
  g.email,
  s.id                                                              AS student_id,
  s.first_name                                                      AS student_first_name,
  s.last_name                                                       AS student_last_name,
  s.registration_number,
  c.name                                                            AS class_name,
  c.grade_level                                                     AS class_level,
  COALESCE(sf.amount_due, 0)                                        AS fees_due,
  COALESCE(p.amount_usd, 0)                                         AS amount_paid,
  COALESCE(sf.amount_due, 0) - COALESCE(p.amount_usd, 0)           AS balance_due
FROM guardians g
JOIN students s ON g.student_id = s.id
LEFT JOIN classes c ON s.current_class_id = c.id
LEFT JOIN student_fees sf ON s.id = sf.student_id
LEFT JOIN payments p
  ON sf.id = p.student_fee_id
 AND p.status = 'success'::payment_status
ORDER BY g.id, s.id;

GRANT SELECT ON vw_guardian_dashboard TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. vw_staff_directory
-- ─────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS vw_staff_directory CASCADE;

CREATE VIEW vw_staff_directory
  WITH (security_invoker = true)
AS
SELECT
  u.id,
  u.school_id,
  u.email,
  u.first_name,
  u.last_name,
  u.phone,
  u.role,
  u.is_active                                                       AS status,
  u.created_at,
  s.name                                                            AS school_name
FROM users u
JOIN schools s ON u.school_id = s.id
WHERE u.role NOT IN ('student'::user_role, 'parent'::user_role)
ORDER BY u.role, u.last_name;

GRANT SELECT ON vw_staff_directory TO authenticated;

NOTIFY pgrst, 'reload schema';
