-- Migration 091: Exclude ALL students who went through promotion from bulk import list
--
-- Migration 089 only excluded students with outcome='promoted'.
-- Retained students (outcome='retained') were still appearing in the
-- "imported students awaiting enrollment" section on the Registrar dashboard,
-- which is wrong — they have their own workflow via Promoted Students page.
--
-- Fix: exclude any student who has ANY record in student_promotions
-- (promoted, retained, OR graduated) from the bulk import section.

DROP FUNCTION IF EXISTS list_pending_import_students(uuid);

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
    -- Exclude ANY student who has gone through the promotion workflow
    -- (promoted, retained, or graduated all have their own Registrar flow)
    AND NOT EXISTS (
      SELECT 1 FROM student_promotions sp
       WHERE sp.student_id = s.id
    )
  ORDER BY se.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION list_pending_import_students(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION list_pending_import_students(UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
