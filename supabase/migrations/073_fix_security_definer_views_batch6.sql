-- Migration 073: Fix SECURITY DEFINER views — batch 6
-- Run this in: Supabase Dashboard → SQL Editor → New query
--
-- Views fixed:
--   1. vw_active_subscriptions      — all schools' subscription data visible
--   2. vw_monthly_revenue_summary   — all schools' revenue visible
--   3. vw_late_payments             — all schools' overdue fee totals visible
--
-- Also re-fixes vw_staff_letter_activity to match the corrected version
-- from migration 006 (adds school_id column, uses correct 'sent' status).

-- ─────────────────────────────────────────────────────────────
-- 1. vw_active_subscriptions
-- ─────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS vw_active_subscriptions CASCADE;

CREATE VIEW vw_active_subscriptions
  WITH (security_invoker = true)
AS
SELECT
  s.id,
  s.school_id,
  sch.name                                                        AS school_name,
  sp.name                                                         AS plan_name,
  sp.student_limit,
  s.started_at,
  s.expires_at,
  CASE
    WHEN s.expires_at < CURRENT_TIMESTAMP                        THEN 'expired'
    WHEN s.expires_at - CURRENT_TIMESTAMP < INTERVAL '30 days'  THEN 'expiring_soon'
    ELSE s.status::TEXT
  END                                                             AS display_status,
  s.expires_at - CURRENT_TIMESTAMP                               AS time_remaining
FROM subscriptions s
JOIN schools sch ON s.school_id = sch.id
JOIN subscription_plans sp ON s.plan_id = sp.id
ORDER BY s.expires_at ASC;

GRANT SELECT ON vw_active_subscriptions TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2. vw_monthly_revenue_summary
-- ─────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS vw_monthly_revenue_summary CASCADE;

CREATE VIEW vw_monthly_revenue_summary
  WITH (security_invoker = true)
AS
SELECT
  DATE_TRUNC('month', p.created_at)::DATE   AS month,
  s.id                                       AS school_id,
  s.name                                     AS school_name,
  COUNT(DISTINCT p.id)                       AS transaction_count,
  COALESCE(SUM(p.amount_usd), 0)             AS total_revenue,
  COALESCE(AVG(p.amount_usd), 0)             AS average_transaction,
  COUNT(DISTINCT p.student_id)               AS students_paid
FROM payments p
JOIN students st ON p.student_id = st.id
JOIN schools s ON st.school_id = s.id
WHERE p.status = 'success'::payment_status
GROUP BY DATE_TRUNC('month', p.created_at), s.id, s.name
ORDER BY month DESC;

GRANT SELECT ON vw_monthly_revenue_summary TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. vw_late_payments
-- ─────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS vw_late_payments CASCADE;

CREATE VIEW vw_late_payments
  WITH (security_invoker = true)
AS
SELECT
  st.school_id,
  sch.name                                   AS school_name,
  COUNT(DISTINCT sf.student_id)              AS students_with_late_fees,
  COALESCE(SUM(sf.balance), 0)               AS total_overdue
FROM student_fees sf
JOIN students st ON sf.student_id = st.id
JOIN schools sch ON st.school_id = sch.id
WHERE sf.balance > 0
GROUP BY st.school_id, sch.name
ORDER BY total_overdue DESC;

GRANT SELECT ON vw_late_payments TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- Re-fix vw_staff_letter_activity — migration 069 used the old
-- column list (no school_id). This aligns it with migration 006's
-- corrected version which adds school_id and uses 'sent' status.
-- ─────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS vw_staff_letter_activity CASCADE;

CREATE VIEW vw_staff_letter_activity
  WITH (security_invoker = true)
AS
SELECT
  u.id                                                                          AS staff_id,
  u.school_id,
  u.first_name,
  u.last_name,
  u.role,
  COUNT(li.id)                                                                  AS letters_generated,
  COUNT(CASE WHEN li.status = 'sent'::letter_instance_status            THEN 1 END) AS letters_sent,
  COUNT(CASE WHEN li.status = 'pending_approval'::letter_instance_status THEN 1 END) AS pending_approval,
  MAX(li.created_at)                                                            AS last_letter_created
FROM users u
LEFT JOIN letter_instances li ON u.id = li.created_by
WHERE u.role NOT IN ('student'::user_role, 'parent'::user_role)
GROUP BY u.id, u.school_id, u.first_name, u.last_name, u.role
ORDER BY letters_generated DESC;

GRANT SELECT ON vw_staff_letter_activity TO authenticated;

NOTIFY pgrst, 'reload schema';
