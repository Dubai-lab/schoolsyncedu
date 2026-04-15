-- Migration 072: Fix SECURITY DEFINER views — batch 5
-- Run this in: Supabase Dashboard → SQL Editor → New query
--
-- Views fixed:
--   1. vw_teacher_classload  — all schools' teacher/class assignments visible
--   2. vw_nfc_card_status    — all schools' NFC card data visible
--   3. overdue_books         — all schools' overdue checkout data visible

-- ─────────────────────────────────────────────────────────────
-- 1. vw_teacher_classload
-- ─────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS vw_teacher_classload CASCADE;

CREATE VIEW vw_teacher_classload
  WITH (security_invoker = true)
AS
SELECT
  u.id          AS teacher_id,
  u.school_id,
  u.first_name,
  u.last_name,
  cs.class_id,
  c.name        AS class_name,
  c.grade_level,
  s.name        AS subject_name,
  cs.academic_year
FROM users u
JOIN class_subjects cs ON u.id = cs.teacher_id
JOIN classes c ON cs.class_id = c.id
LEFT JOIN subjects s ON cs.subject_id = s.id
WHERE u.role = 'teacher'::user_role
ORDER BY c.grade_level, c.name;

GRANT SELECT ON vw_teacher_classload TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2. vw_nfc_card_status
-- ─────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS vw_nfc_card_status CASCADE;

CREATE VIEW vw_nfc_card_status
  WITH (security_invoker = true)
AS
SELECT
  nca.id                  AS assignment_id,
  nc.school_id,
  nc.card_number,
  nc.status               AS card_status,
  s.id                    AS student_id,
  s.first_name,
  s.last_name,
  s.registration_number,
  nca.assignment_date,
  nc.valid_until,
  (SELECT COUNT(*)
     FROM nfc_attendance_logs
    WHERE card_id = nc.id
      AND DATE(tapped_at) = CURRENT_DATE) AS scans_today
FROM nfc_chip_assignments nca
JOIN nfc_cards nc ON nca.card_id = nc.id
JOIN students s ON nca.assigned_to_student = s.id
WHERE nc.status IN ('active'::nfc_card_status, 'inactive'::nfc_card_status)
ORDER BY nc.status, s.last_name;

GRANT SELECT ON vw_nfc_card_status TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. overdue_books
-- ─────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS overdue_books CASCADE;

CREATE VIEW overdue_books
  WITH (security_invoker = true)
AS
SELECT
  gen_random_uuid()                           AS id,
  bc.student_id,
  bc.book_copy_id,
  bc.due_date,
  (CURRENT_DATE - bc.due_date)                AS days_overdue,
  0.00::DECIMAL(10,2)                         AS fine_amount,
  CASE
    WHEN CURRENT_DATE - bc.due_date > 14 THEN 'critical'
    WHEN CURRENT_DATE - bc.due_date > 7  THEN 'overdue'
    ELSE 'due_soon'
  END                                         AS status,
  bc.id                                       AS checkout_id
FROM book_checkouts bc
WHERE bc.is_returned = FALSE
  AND bc.due_date < CURRENT_DATE;

GRANT SELECT ON overdue_books TO authenticated;

NOTIFY pgrst, 'reload schema';
