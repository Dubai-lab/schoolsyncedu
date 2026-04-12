-- ============================================================
-- Migration 039: SECURITY DEFINER RPC for listing pending letters
--
-- Why: The letter_instances SELECT RLS policy uses
--   (SELECT role FROM users WHERE id = auth.uid())
-- which returns NULL when the JWT sub doesn't match users.id,
-- causing principals and vice-principals to see an empty list
-- even though they are authorised.
--
-- Fix: Same pattern as the write RPCs — SECURITY DEFINER +
-- SET LOCAL row_security = OFF — so the query runs without RLS.
-- The caller's school_id is still enforced inside the function.
-- ============================================================

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

  SELECT jsonb_agg(row_to_jsonb(r) ORDER BY r.created_at ASC)
  INTO v_result
  FROM (
    SELECT
      li.*,
      jsonb_build_object(
        'id',         s.id,
        'first_name', s.first_name,
        'last_name',  s.last_name
      ) AS students,
      jsonb_build_object(
        'id',        lt.id,
        'name',      lt.name,
        'category',  lt.category,
        'severity',  lt.severity,
        'body_html', lt.body_html
      ) AS letter_templates
    FROM letter_instances li
    LEFT JOIN students        s  ON s.id  = li.student_id
    LEFT JOIN letter_templates lt ON lt.id = li.template_id
    WHERE li.school_id = p_school_id
      AND li.status    = 'pending_approval'::letter_instance_status
  ) r;

  RETURN COALESCE(v_result, '[]'::JSONB);
END;
$$;

GRANT EXECUTE ON FUNCTION list_pending_approval_letters TO authenticated;
