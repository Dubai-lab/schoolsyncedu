-- Migration 068: Fix SECURITY DEFINER views flagged by Supabase Security Advisor
-- Run this in: Supabase Dashboard → SQL Editor → New query
--
-- Problem: PostgreSQL views are implicitly SECURITY DEFINER — they run as the
-- view owner (postgres) and bypass RLS on the underlying tables.  In a
-- multi-school SaaS this means any authenticated user can see every school's
-- data when querying these views.
--
-- Fix: Recreate each view WITH (security_invoker = true) so the view runs as
-- the calling user and the underlying tables' RLS policies apply normally.
--
-- Views fixed:
--   1. attendance_summary            — no school filter; any user saw all schools
--   2. vw_attendance_summary_by_class — same issue
--   3. platform_admin_users          — any user could list all super-admin accounts

-- ─────────────────────────────────────────────────────────────
-- 1. attendance_summary
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW attendance_summary
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
CREATE OR REPLACE VIEW vw_attendance_summary_by_class
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
--    Only super_admins query this.  With security_invoker the underlying
--    users RLS (which allows super_admin to see all users) ensures only
--    super_admins get results.  Also restrict the GRANT to service_role
--    + the app role so regular school users can't even call it.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW platform_admin_users
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

-- Only authenticated users can select; with security_invoker + users RLS,
-- non-super-admins will receive zero rows (their RLS hides super_admin records).
GRANT SELECT ON platform_admin_users TO authenticated;

NOTIFY pgrst, 'reload schema';
