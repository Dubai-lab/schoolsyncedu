-- ============================================================
-- Migration 023: Add application fee gate to accept function
-- 
-- Fixes:
--   1. accept_student_application now CHECKS application_fee_paid
--      before creating the student. If the school charges a fee
--      (application_fee_amount > 0) and it's unpaid, the function
--      raises an exception.
--   2. All checks are school_id scoped — each school's settings
--      only affect their own applications.
-- ============================================================

-- Drop all signatures of accept_student_application
DROP FUNCTION IF EXISTS accept_student_application(UUID, TEXT);
DROP FUNCTION IF EXISTS accept_student_application(UUID, TEXT, UUID);

CREATE OR REPLACE FUNCTION accept_student_application(
  p_application_id UUID,
  p_review_notes   TEXT    DEFAULT NULL,
  p_class_id       UUID    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app           RECORD;
  v_caller_role   user_role;
  v_caller_school UUID;
  v_reg_number    TEXT;
  v_student_id    UUID;
  v_guardian_id   UUID;
  v_assign_class  UUID;
  v_reg_fee       RECORD;
  v_academic_year TEXT;
BEGIN
  -- 1. Verify caller
  SELECT role, school_id
    INTO v_caller_role, v_caller_school
    FROM users WHERE auth_id = auth.uid();

  IF v_caller_role NOT IN (
    'registrar','principal','vice_principal','admin_staff','super_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only registrar or admin can accept applications';
  END IF;

  -- 2. Load application
  SELECT * INTO v_app FROM student_applications WHERE id = p_application_id;

  IF v_app IS NULL THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  IF v_app.school_id != v_caller_school AND v_caller_role != 'super_admin' THEN
    RAISE EXCEPTION 'Application belongs to a different school';
  END IF;

  IF v_app.status NOT IN ('submitted','under_review','documents_requested','waitlisted') THEN
    RAISE EXCEPTION 'Application is not in a reviewable state (current: %)', v_app.status;
  END IF;

  -- 3. APPLICATION FEE GATE — if school charges a fee, it must be paid
  IF COALESCE(v_app.application_fee_amount, 0) > 0 AND v_app.application_fee_paid IS NOT TRUE THEN
    RAISE EXCEPTION 'Application fee has not been paid. The student must pay the application fee ($%) before acceptance.', v_app.application_fee_amount;
  END IF;

  -- 4. Generate registration number
  v_reg_number := generate_registration_number(v_app.school_id);

  -- 5. Decide which class to use
  v_assign_class := COALESCE(p_class_id, v_app.class_id);

  -- 6. Create student record
  INSERT INTO students (
    school_id, registration_number,
    first_name, last_name, date_of_birth, gender,
    enrollment_date, current_grade_level, current_class_id,
    status, previous_school,
    emergency_contact_name, emergency_contact_phone
  ) VALUES (
    v_app.school_id, v_reg_number,
    v_app.first_name, v_app.last_name, v_app.date_of_birth, v_app.gender,
    CURRENT_DATE, v_app.grade_level_applied, v_assign_class,
    'enrolled'::student_status,
    v_app.previous_school,
    v_app.emergency_contact_name, v_app.emergency_contact_phone
  )
  RETURNING id INTO v_student_id;

  -- 7. Create guardian record
  IF v_app.guardian_full_name IS NOT NULL AND v_app.guardian_full_name != '' THEN
    INSERT INTO guardians (
      student_id, school_id, relationship,
      full_name, email, phone, address, occupation
    ) VALUES (
      v_student_id, v_app.school_id, v_app.guardian_relationship,
      v_app.guardian_full_name, v_app.guardian_email,
      v_app.guardian_phone, v_app.guardian_address, v_app.guardian_occupation
    )
    RETURNING id INTO v_guardian_id;
  END IF;

  -- 8. Determine academic year
  SELECT COALESCE(
    (SELECT setting_value FROM school_settings
      WHERE school_id = v_app.school_id AND setting_key = 'current_academic_year'),
    v_app.academic_year
  ) INTO v_academic_year;

  -- 9. Create enrollment record — pending_payment until reg fee collected
  INSERT INTO student_enrollments (
    student_id, school_id, academic_year, enrollment_date, status
  ) VALUES (
    v_student_id, v_app.school_id, v_academic_year,
    CURRENT_DATE, 'pending_payment'
  );

  -- 10. Assign to class if provided
  IF v_assign_class IS NOT NULL THEN
    INSERT INTO class_assignments (class_id, student_id, academic_year)
    VALUES (v_assign_class, v_student_id, v_academic_year)
    ON CONFLICT DO NOTHING;
  END IF;

  -- 11. Auto-assign registration fee if a structure exists
  SELECT fs.*
    INTO v_reg_fee
    FROM fee_structures fs
   WHERE fs.school_id     = v_app.school_id
     AND fs.fee_type      = 'registration_fee'
     AND fs.academic_year = v_academic_year
   ORDER BY fs.created_at DESC
   LIMIT 1;

  IF v_reg_fee.id IS NOT NULL THEN
    INSERT INTO student_fees (
      student_id, fee_structure_id, school_id,
      academic_year, amount_due, amount_paid, balance,
      status, due_date
    ) VALUES (
      v_student_id, v_reg_fee.id, v_app.school_id,
      v_academic_year, v_reg_fee.amount_usd, 0, v_reg_fee.amount_usd,
      'pending', v_reg_fee.due_date
    )
    ON CONFLICT DO NOTHING;
  END IF;

  -- 12. Update application
  UPDATE student_applications SET
    status = 'accepted',
    reviewed_by = (SELECT id FROM users WHERE auth_id = auth.uid()),
    reviewed_at = NOW(),
    review_notes = COALESCE(p_review_notes, review_notes),
    assigned_registration_number = v_reg_number,
    updated_at = NOW()
  WHERE id = p_application_id;

  RETURN jsonb_build_object(
    'success',             TRUE,
    'student_id',          v_student_id,
    'registration_number', v_reg_number,
    'guardian_id',         v_guardian_id,
    'class_id',            v_assign_class,
    'reg_fee_assigned',    (v_reg_fee.id IS NOT NULL),
    'message',             'Student accepted. Registration fee payment required to activate enrollment.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION accept_student_application(UUID, TEXT, UUID) TO authenticated;
