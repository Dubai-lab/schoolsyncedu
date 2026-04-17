-- Migration 089: Fix list_pending_import_students to exclude promoted students
--
-- Problem: When a bulk-imported student is promoted, the promotion RPC creates
-- a new student_enrollments row with status='pending_payment' for the next year.
-- The student has no student_applications row (bulk-imported).
-- Both conditions matched list_pending_import_students → promoted students
-- appeared in the "bulk import awaiting enrollment" section on the Registrar
-- dashboard, which is wrong.
--
-- Fix: Add a NOT EXISTS check against student_promotions to exclude any student
-- who has already been processed through the promotion workflow.

CREATE OR REPLACE FUNCTION list_pending_import_students(p_school_id UUID)
RETURNS TABLE (
  student_id          UUID,
  first_name          TEXT,
  last_name           TEXT,
  registration_number TEXT,
  class_name          TEXT,
  reg_fee_paid        BOOLEAN,
  reg_fee_amount      NUMERIC,
  imported_at         TIMESTAMPTZ
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
    'registrar','bursar','principal','vice_principal',
    'admin_staff','it_admin','super_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_caller_role != 'super_admin' AND v_caller_school != p_school_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    s.id                                          AS student_id,
    s.first_name::TEXT                            AS first_name,
    s.last_name::TEXT                             AS last_name,
    s.registration_number::TEXT                   AS registration_number,
    COALESCE(c.name, s.current_grade_level)::TEXT AS class_name,
    COALESCE(
      (SELECT sf.status::TEXT IN ('paid','partial')
         FROM student_fees sf
         JOIN fee_structures fs ON fs.id = sf.fee_structure_id
        WHERE sf.student_id = s.id
          AND fs.fee_type   = 'registration'
        ORDER BY sf.created_at DESC LIMIT 1),
      TRUE
    )                                             AS reg_fee_paid,
    COALESCE(
      (SELECT sf.amount_due::NUMERIC
         FROM student_fees sf
         JOIN fee_structures fs ON fs.id = sf.fee_structure_id
        WHERE sf.student_id = s.id
          AND fs.fee_type   = 'registration'
        ORDER BY sf.created_at DESC LIMIT 1),
      0::NUMERIC
    )                                             AS reg_fee_amount,
    se.created_at::TIMESTAMPTZ                    AS imported_at
  FROM students s
  JOIN student_enrollments se
    ON se.student_id = s.id
   AND se.status     = 'pending_payment'
  LEFT JOIN classes c ON c.id = s.current_class_id
  WHERE s.school_id = p_school_id
    -- Only bulk-imported students (no online application)
    AND NOT EXISTS (
      SELECT 1 FROM student_applications sa WHERE sa.student_id = s.id
    )
    -- Exclude promoted students — they have their own workflow
    -- (Registrar → Promoted Students → Assign Class)
    AND NOT EXISTS (
      SELECT 1 FROM student_promotions sp
       WHERE sp.student_id = s.id
         AND sp.outcome    = 'promoted'
    )
  ORDER BY se.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION list_pending_import_students(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION list_pending_import_students(UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
