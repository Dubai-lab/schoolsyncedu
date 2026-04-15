-- Migration 069: Fix SECURITY DEFINER views — batch 2
-- Run this in: Supabase Dashboard → SQL Editor → New query
--
-- Uses DROP + CREATE instead of CREATE OR REPLACE because PostgreSQL
-- does not allow changing column lists via OR REPLACE.
--
-- Views fixed:
--   1. vw_grade_report_summary    — all schools' student grades visible
--   2. vw_staff_letter_activity   — all schools' staff letter counts visible
--   3. vw_recent_audit_activity   — all schools' audit logs visible

-- ─────────────────────────────────────────────────────────────
-- 1. vw_grade_report_summary
-- ─────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS vw_grade_report_summary CASCADE;

CREATE VIEW vw_grade_report_summary
  WITH (security_invoker = true)
AS
SELECT
  s.id                                    AS student_id,
  s.first_name,
  s.last_name,
  c.id                                    AS class_id,
  c.name                                  AS class_name,
  ac.term_name,
  COUNT(g.id)                             AS subject_count,
  ROUND(AVG(g.gpa_points)::NUMERIC, 2)   AS average_gpa,
  MAX(g.gpa_points)                       AS highest_grade,
  MIN(g.gpa_points)                       AS lowest_grade,
  ac.start_date                           AS term_start,
  ac.end_date                             AS term_end,
  CURRENT_TIMESTAMP                       AS generated_at
FROM students s
LEFT JOIN classes c ON s.current_class_id = c.id
LEFT JOIN academic_calendar ac ON s.school_id = ac.school_id
LEFT JOIN grades g ON s.id = g.student_id AND g.academic_year = ac.academic_year
GROUP BY s.id, c.id, ac.id, ac.term_name, ac.start_date, ac.end_date;

GRANT SELECT ON vw_grade_report_summary TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2. vw_staff_letter_activity
-- ─────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS vw_staff_letter_activity CASCADE;

CREATE VIEW vw_staff_letter_activity
  WITH (security_invoker = true)
AS
SELECT
  u.id                                                                  AS staff_id,
  u.first_name,
  u.last_name,
  u.role,
  COUNT(li.id)                                                          AS letters_generated,
  COUNT(CASE WHEN li.status = 'delivered'        THEN 1 END)           AS letters_delivered,
  COUNT(CASE WHEN li.status = 'pending_approval' THEN 1 END)           AS pending_approval,
  MAX(li.created_at)                                                    AS last_letter_created
FROM users u
LEFT JOIN letter_instances li ON u.id = li.created_by
WHERE u.role NOT IN ('student'::user_role, 'parent'::user_role)
GROUP BY u.id, u.first_name, u.last_name, u.role
ORDER BY letters_generated DESC;

GRANT SELECT ON vw_staff_letter_activity TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. vw_recent_audit_activity
-- ─────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS vw_recent_audit_activity CASCADE;

CREATE VIEW vw_recent_audit_activity
  WITH (security_invoker = true)
AS
SELECT
  al.id,
  al.school_id,
  s.name                                                        AS school_name,
  al.user_id,
  COALESCE(u.first_name || ' ' || u.last_name, 'System')       AS user_name,
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

GRANT SELECT ON vw_recent_audit_activity TO authenticated;

NOTIFY pgrst, 'reload schema';
