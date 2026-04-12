-- ============================================================
-- Migration 042: Add recipient_data to get_letter_for_send RPC
--
-- Why: sendToGuardian uses the template subject directly, which
-- still contains {{payment_reference}} and other template-specific
-- placeholders. recipient_data holds the values the staff typed in
-- (e.g. payment_reference, fee_amount). We need it on the client
-- so the subject can be resolved before the email is sent.
-- ============================================================

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
    'id',             li.id,
    'school_id',      li.school_id,
    'student_id',     li.student_id,
    'status',         li.status::TEXT,
    'rendered_html',  li.rendered_html,
    'recipient_data', li.recipient_data,
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
