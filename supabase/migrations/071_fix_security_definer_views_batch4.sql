-- Migration 071: Fix SECURITY DEFINER views — batch 4
-- Run this in: Supabase Dashboard → SQL Editor → New query
--
-- Views fixed:
--   1. vw_financial_summary_by_class  — all schools' fee/payment data visible
--   2. vw_library_outstanding_items   — all schools' overdue books visible
--   3. waec_candidates_with_students  — all schools' WAEC candidates visible

-- ─────────────────────────────────────────────────────────────
-- 1. vw_financial_summary_by_class
-- ─────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS vw_financial_summary_by_class CASCADE;

CREATE VIEW vw_financial_summary_by_class
  WITH (security_invoker = true)
AS
SELECT
  c.id                                                                    AS class_id,
  c.school_id,
  c.name                                                                  AS class_name,
  COUNT(DISTINCT st.id)                                                   AS total_students,
  COALESCE(SUM(sf.amount_due), 0)                                         AS total_fees_due,
  COALESCE(SUM(p.amount_usd), 0)                                          AS total_paid,
  COALESCE(SUM(sf.amount_due), 0) - COALESCE(SUM(p.amount_usd), 0)       AS outstanding_balance,
  CASE
    WHEN COALESCE(SUM(sf.amount_due), 0) = 0 THEN 0
    ELSE ROUND(
      CAST(
        COALESCE(SUM(p.amount_usd), 0) / NULLIF(SUM(sf.amount_due), 0)::FLOAT * 100
      AS NUMERIC), 2
    )
  END                                                                     AS collection_percentage
FROM classes c
LEFT JOIN students st ON c.id = st.current_class_id
LEFT JOIN student_fees sf ON st.id = sf.student_id
LEFT JOIN payments p
  ON sf.id = p.student_fee_id
 AND p.status = 'success'::payment_status
GROUP BY c.id, c.school_id, c.name;

GRANT SELECT ON vw_financial_summary_by_class TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2. vw_library_outstanding_items
-- ─────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS vw_library_outstanding_items CASCADE;

CREATE VIEW vw_library_outstanding_items
  WITH (security_invoker = true)
AS
SELECT
  s.id                                                          AS student_id,
  s.school_id,
  s.first_name,
  s.last_name,
  b.title                                                       AS book_title,
  b.isbn,
  bc.barcode                                                    AS copy_number,
  bcr.checkout_date,
  bcr.due_date,
  CURRENT_DATE - bcr.due_date                                   AS days_overdue,
  CASE
    WHEN CURRENT_DATE > bcr.due_date                            THEN 'overdue'
    WHEN CURRENT_DATE > bcr.due_date - INTERVAL '3 days'       THEN 'due_soon'
    ELSE 'on_time'
  END                                                           AS status
FROM book_checkouts bcr
JOIN book_copies bc ON bcr.book_copy_id = bc.id
JOIN books b ON bc.book_id = b.id
JOIN students s ON bcr.student_id = s.id
WHERE bcr.is_returned = FALSE
ORDER BY bcr.due_date ASC;

GRANT SELECT ON vw_library_outstanding_items TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. waec_candidates_with_students
-- ─────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS waec_candidates_with_students CASCADE;

CREATE VIEW waec_candidates_with_students
  WITH (security_invoker = true)
AS
SELECT
  wc.*,
  s.first_name,
  s.last_name,
  c.name AS class_name,
  (SELECT COUNT(*)
     FROM waec_candidate_subjects wcs
    WHERE wcs.candidate_id = wc.id)                             AS subject_count
FROM waec_candidates wc
JOIN students s ON s.id = wc.student_id
LEFT JOIN class_assignments ca
  ON ca.student_id = s.id
 AND ca.removed_at IS NULL
LEFT JOIN classes c ON c.id = ca.class_id;

GRANT SELECT ON waec_candidates_with_students TO authenticated;

NOTIFY pgrst, 'reload schema';
