-- Migration 093: Fix 42804 datatype mismatch in list_promoted_pending_assignment
--
-- PostgreSQL enum types (promotion_outcome, student_fee_status) cannot be
-- compared to plain text literals without an explicit cast. This caused
-- a 42804 error when PostgREST called the function.
-- All enum comparisons now use ::TEXT casts.

DROP FUNCTION IF EXISTS list_promoted_pending_assignment(uuid);

CREATE FUNCTION list_promoted_pending_assignment(p_school_id UUID)
RETURNS TABLE (
  student_id          UUID,
  first_name          TEXT,
  last_name           TEXT,
  registration_number TEXT,
  from_grade_level    TEXT,
  next_year           TEXT,
  outcome             TEXT,
  reg_fee_paid        BOOLEAN,
  reg_fee_amount      NUMERIC,
  promoted_at         TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role user_role;
  v_caller_school UUID;
  v_next_year   TEXT;
BEGIN
  SELECT role, school_id
    INTO v_caller_role, v_caller_school
    FROM users WHERE auth_id = auth.uid();

  IF v_caller_role NOT IN (
    'registrar','principal','vice_principal','admin_staff','it_admin','super_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_caller_role != 'super_admin' AND v_caller_school != p_school_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT setting_value INTO v_next_year
    FROM school_settings
   WHERE school_id   = p_school_id
     AND setting_key = 'next_academic_year'
   LIMIT 1;

  IF v_next_year IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    s.id::UUID                                    AS student_id,
    s.first_name::TEXT                            AS first_name,
    s.last_name::TEXT                             AS last_name,
    s.registration_number::TEXT                   AS registration_number,
    sp.from_grade_level::TEXT                     AS from_grade_level,
    v_next_year::TEXT                             AS next_year,
    sp.outcome::TEXT                              AS outcome,
    COALESCE(
      sf.status::TEXT IN ('paid', 'partial'),
      TRUE
    )::BOOLEAN                                    AS reg_fee_paid,
    COALESCE(sf.amount_due, 0)::NUMERIC           AS reg_fee_amount,
    sp.processed_at::TIMESTAMPTZ                  AS promoted_at
  FROM students s
  JOIN student_promotions sp
    ON  sp.student_id  = s.id
    AND sp.school_id   = p_school_id
    AND sp.outcome::TEXT IN ('promoted', 'retained')
  LEFT JOIN student_fees sf
    ON  sf.student_id    = s.id
    AND sf.school_id     = p_school_id
    AND sf.academic_year = v_next_year
    AND EXISTS (
      SELECT 1 FROM fee_structures fs
       WHERE fs.id            = sf.fee_structure_id
         AND fs.fee_type::TEXT = 'registration'
    )
  WHERE s.school_id = p_school_id
    AND NOT EXISTS (
      SELECT 1 FROM class_assignments ca
       WHERE ca.student_id    = s.id
         AND ca.academic_year = v_next_year
    )
  ORDER BY sp.outcome::TEXT DESC, sp.from_grade_level, s.last_name, s.first_name;
END;
$$;

GRANT EXECUTE ON FUNCTION list_promoted_pending_assignment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION list_promoted_pending_assignment(UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
