-- Migration 084: Fix list_ready_to_enroll fee_type value
-- The actual stored value is 'registration', not 'registration_fee'

CREATE OR REPLACE FUNCTION list_ready_to_enroll(p_school_id UUID)
RETURNS TABLE (
  application_id      UUID,
  student_id          UUID,
  first_name          TEXT,
  last_name           TEXT,
  registration_number TEXT,
  class_name          TEXT,
  reg_fee_paid_at     TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role   user_role;
  v_caller_school UUID;
BEGIN
  SELECT role, school_id
    INTO v_caller_role, v_caller_school
    FROM users WHERE auth_id = auth.uid();

  IF v_caller_role NOT IN (
    'registrar','principal','vice_principal','admin_staff','super_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_caller_role != 'super_admin' AND v_caller_school != p_school_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    sa.id                                        AS application_id,
    s.id                                         AS student_id,
    s.first_name::TEXT,
    s.last_name::TEXT,
    s.registration_number::TEXT,
    COALESCE(c.name, s.current_grade_level)::TEXT AS class_name,
    p.payment_date::TIMESTAMPTZ                  AS reg_fee_paid_at
  FROM students s
  JOIN student_applications sa ON sa.student_id = s.id
  LEFT JOIN classes c ON c.id = s.current_class_id
  LEFT JOIN (
    SELECT sf.student_id, sf.status, sf.id AS sf_id
      FROM student_fees sf
      JOIN fee_structures fs ON fs.id = sf.fee_structure_id
     WHERE fs.fee_type = 'registration'
  ) reg ON reg.student_id = s.id
  LEFT JOIN payments p ON p.student_fee_id = reg.sf_id AND p.status = 'success'
  WHERE s.school_id = p_school_id
    AND s.user_id   IS NULL
    AND (reg.student_id IS NULL OR reg.status IN ('paid', 'partial'))
  ORDER BY p.payment_date DESC NULLS LAST, s.last_name, s.first_name;
END;
$$;

GRANT EXECUTE ON FUNCTION list_ready_to_enroll(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION list_ready_to_enroll(UUID) TO service_role;
