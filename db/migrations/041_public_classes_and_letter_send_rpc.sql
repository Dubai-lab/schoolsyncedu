-- ============================================================
-- Migration 041: Public class list + letter-send RPC
--
-- Fixes:
--   1. Application form (public page, no auth) could not read the
--      classes table → "Class Applying For" dropdown was empty.
--      Fix: add an anon SELECT policy on classes (class names are
--      not sensitive — they're shown on the public application form).
--
--   2. "Email not sent: Letter instance not found" — sendToGuardian
--      does a direct SELECT on letter_instances which still goes
--      through RLS and returns null in some sessions.
--      Fix: SECURITY DEFINER RPC that fetches the full letter row
--      needed for sending (bypasses RLS, same pattern as write RPCs).
-- ============================================================

-- ── 1. Allow anonymous reads of classes (for public application form) ─────────

DROP POLICY IF EXISTS classes_public_read ON classes;

CREATE POLICY classes_public_read ON classes
  FOR SELECT TO anon
  USING (true);

-- ── 2. get_letter_for_send ────────────────────────────────────────────────────
-- Returns everything sendToGuardian needs: the instance + template subject +
-- student id. Returns NULL as a JSONB if the id is not found.

DROP FUNCTION IF EXISTS get_letter_for_send(UUID);

CREATE FUNCTION get_letter_for_send(p_letter_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SET LOCAL row_security = OFF;

  SELECT jsonb_build_object(
    'id',           li.id,
    'school_id',    li.school_id,
    'student_id',   li.student_id,
    'status',       li.status::TEXT,
    'rendered_html',li.rendered_html,
    'letter_templates', jsonb_build_object(
      'id',      lt.id,
      'name',    lt.name,
      'subject', lt.subject
    ),
    'students', jsonb_build_object(
      'id',         s.id,
      'first_name', s.first_name,
      'last_name',  s.last_name
    )
  )
  INTO v_result
  FROM letter_instances li
  LEFT JOIN letter_templates lt ON lt.id = li.template_id
  LEFT JOIN students         s  ON s.id  = li.student_id
  WHERE li.id = p_letter_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_letter_for_send TO authenticated;

NOTIFY pgrst, 'reload schema';
