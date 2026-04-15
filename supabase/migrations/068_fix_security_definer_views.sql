-- Migration 068: Fix SECURITY DEFINER views flagged by Supabase Security Advisor
-- Run this in: Supabase Dashboard → SQL Editor → New query
--
-- Uses DROP + CREATE instead of CREATE OR REPLACE because PostgreSQL
-- does not allow changing column lists via OR REPLACE.
--
-- Views fixed:
--   1. attendance_summary            — no school filter; any user saw all schools
--   2. vw_attendance_summary_by_class — same issue
--   3. platform_admin_users          — any user could list all super-admin accounts

-- ─────────────────────────────────────────────────────────────
-- 1. attendance_summary
-- ─────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS attendance_summary CASCADE;

CREATE VIEW attendance_summary
  WITH (security_invoker = true)
AS
SELECT
  s.id                                                            AS student_id,
  ar_year.academic_year,
  COUNT(ar_year.id)                                               AS total_days,
  COUNT(CASE WHEN ar_year.status = 'present'                          THEN 1 END) AS present_days,
  COUNT(CASE WHEN ar_year.status IN ('absent','unexcused')            THEN 1 END) AS absent_days,
  COUNT(CASE WHEN ar_year.status = 'late'                             THEN 1 END) AS late_days,
  COUNT(CASE WHEN ar_year.status = 'excused'                          THEN 1 END) AS excused_days,
  CASE
    WHEN COUNT(ar_year.id) > 0 THEN
      ROUND(
        (COUNT(CASE WHEN ar_year.status = 'present' THEN 1 END)::DECIMAL
         / COUNT(ar_year.id)) * 100, 2
      )
    ELSE 0
  END                                                             AS attendance_percentage,
  MAX(ar_year.marked_at)                                          AS last_updated
FROM students s
LEFT JOIN (
  SELECT ar.*, ac.academic_year
  FROM attendance_records ar
  JOIN classes c ON ar.class_id = c.id
  JOIN academic_calendar ac
    ON c.school_id = ac.school_id
   AND ar.attendance_date BETWEEN ac.start_date AND ac.end_date
) ar_year ON s.id = ar_year.student_id
GROUP BY s.id, ar_year.academic_year;

GRANT SELECT ON attendance_summary TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2. vw_attendance_summary_by_class
-- ─────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS vw_attendance_summary_by_class CASCADE;

CREATE VIEW vw_attendance_summary_by_class
  WITH (security_invoker = true)
AS
SELECT
  c.id                                                            AS class_id,
  c.school_id,
  c.name                                                          AS class_name,
  ac.id                                                           AS term_id,
  ac.term_name,
  COUNT(DISTINCT st.id)                                           AS total_students,
  COUNT(DISTINCT ar.id)                                           AS total_attendance_records,
  ROUND(
    CAST(
      COUNT(DISTINCT ar.id)::FLOAT /
      GREATEST(
        COUNT(DISTINCT st.id) * NULLIF(COUNT(DISTINCT ar.attendance_date), 0),
        1
      )::FLOAT * 100 AS NUMERIC
    ), 2
  )                                                               AS attendance_percentage
FROM classes c
JOIN students st ON c.id = st.current_class_id
JOIN academic_calendar ac ON c.school_id = ac.school_id
LEFT JOIN attendance_records ar ON st.id = ar.student_id
GROUP BY c.id, c.school_id, c.name, ac.id, ac.term_name;

GRANT SELECT ON vw_attendance_summary_by_class TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. platform_admin_users
-- ─────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS platform_admin_users CASCADE;

CREATE VIEW platform_admin_users
  WITH (security_invoker = true)
AS
SELECT
  u.id,
  u.email,
  COALESCE(u.full_name, u.first_name || ' ' || u.last_name) AS name,
  u.role::TEXT                                               AS role,
  u.is_active,
  u.last_login,
  u.created_at
FROM users u
WHERE u.role = 'super_admin';

GRANT SELECT ON platform_admin_users TO authenticated;

NOTIFY pgrst, 'reload schema';
