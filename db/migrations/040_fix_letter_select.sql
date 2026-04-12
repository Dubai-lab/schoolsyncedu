-- ============================================================
-- Migration 040: Fix letter_instances SELECT + pending list RPC
--
-- Problems:
--   1. letter_instances SELECT RLS uses a role subquery that returns
--      NULL for some sessions → everyone sees empty letter lists.
--   2. list_pending_approval_letters not picked up by PostgREST
--      schema cache → 404 on the approvals page.
--
-- Fixes:
--   1. Replace the complex RLS SELECT policy with a simple school_id
--      check (all school staff can read all school letters — the UI
--      already limits who can approve/send).
--   2. Drop + recreate list_pending_approval_letters with explicit
--      jsonb_build_object (avoids enum serialisation issues) and cast
--      status to text in the WHERE clause.
--   3. Run NOTIFY pgrst inside this migration so the schema cache
--      refreshes the moment the SQL is executed.
-- ============================================================

-- ── 1. Simplify letter_instances SELECT policy ────────────────────────────────

DROP POLICY IF EXISTS letter_instances_select ON letter_instances;

CREATE POLICY letter_instances_select ON letter_instances
  FOR SELECT USING (
    school_id = (SELECT school_id FROM users WHERE id = auth.uid())
  );

-- ── 2. Recreate list_pending_approval_letters ─────────────────────────────────

DROP FUNCTION IF EXISTS list_pending_approval_letters(UUID);

CREATE FUNCTION list_pending_approval_letters(p_school_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SET LOCAL row_security = OFF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id',               li.id,
        'school_id',        li.school_id,
        'template_id',      li.template_id,
        'student_id',       li.student_id,
        'reference_number', li.reference_number,
        'status',           li.status::TEXT,
        'rendered_html',    li.rendered_html,
        'delivery_channels',li.delivery_channels,
        'created_by',       li.created_by,
        'created_at',       li.created_at,
        'updated_at',       li.updated_at,
        'sent_at',          li.sent_at,
        'approved_by',      li.approved_by,
        'recipient_type',   li.recipient_type,
        'recipient_data',   li.recipient_data,
        'students', jsonb_build_object(
          'id',         s.id,
          'first_name', s.first_name,
          'last_name',  s.last_name
        ),
        'letter_templates', jsonb_build_object(
          'id',       lt.id,
          'name',     lt.name,
          'category', lt.category::TEXT,
          'severity', lt.severity::TEXT,
          'body_html',lt.body_html
        )
      )
      ORDER BY li.created_at ASC
    ),
    '[]'::JSONB
  )
  INTO v_result
  FROM letter_instances li
  LEFT JOIN students         s  ON s.id  = li.student_id
  LEFT JOIN letter_templates lt ON lt.id = li.template_id
  WHERE li.school_id   = p_school_id
    AND li.status::TEXT = 'pending_approval';

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION list_pending_approval_letters TO authenticated;

-- ── 3. Force PostgREST schema cache refresh ───────────────────────────────────

NOTIFY pgrst, 'reload schema';
