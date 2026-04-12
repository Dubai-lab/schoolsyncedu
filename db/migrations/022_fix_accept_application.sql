-- Migration 022: Fix accept_student_application function
-- 
-- Problem: The accept function returns success but the student row doesn't
-- actually persist. This migration drops and recreates the function with
-- verified correct logic, fixes RLS helper functions, and repairs any
-- orphaned accepted applications.
-- ============================================================

-- ============================================================
-- PART 1: Fix auth helper functions (SECURITY DEFINER)
-- auth_student_id() and auth_guardian_student_ids() were SECURITY INVOKER
-- which caused potential recursive RLS evaluation issues
-- ============================================================

CREATE OR REPLACE FUNCTION auth_student_id()
RETURNS UUID AS $$
  SELECT s.id FROM public.students s
  JOIN public.users u ON s.user_id = u.id
  WHERE u.auth_id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

DROP FUNCTION IF EXISTS auth_guardian_student_ids();

CREATE FUNCTION auth_guardian_student_ids()
RETURNS SETOF UUID AS $$
  SELECT g.student_id FROM public.guardians g
  JOIN public.users u ON g.user_id = u.id
  WHERE u.auth_id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

-- ============================================================
-- PART 2: Recreate generate_registration_number (verified)
-- ============================================================

DROP FUNCTION IF EXISTS generate_registration_number(UUID);

CREATE OR REPLACE FUNCTION generate_registration_number(p_school_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_code VARCHAR(10);
  v_year TEXT;
  v_seq INT;
BEGIN
  SELECT school_code INTO v_school_code FROM schools WHERE id = p_school_id;

  IF v_school_code IS NULL THEN
    v_school_code := 'SCH';
  END IF;

  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;

  SELECT COALESCE(MAX(
    CAST(SUBSTRING(registration_number FROM '\d+$') AS INT)
  ), 0) + 1
  INTO v_seq
  FROM students
  WHERE school_id = p_school_id
    AND registration_number LIKE v_school_code || '-' || v_year || '-%';

  RETURN v_school_code || '-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION generate_registration_number(UUID) TO authenticated;

-- ============================================================
-- PART 3: Drop and recreate accept_student_application
-- This is the critical fix — ensure the student INSERT actually runs
-- ============================================================

DROP FUNCTION IF EXISTS accept_student_application(UUID, TEXT);

CREATE OR REPLACE FUNCTION accept_student_application(
  p_application_id UUID,
  p_review_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app RECORD;
  v_caller_role user_role;
  v_caller_school UUID;
  v_reg_number TEXT;
  v_student_id UUID;
  v_guardian_id UUID;
BEGIN
  -- 1. Verify caller role
  SELECT role, school_id INTO v_caller_role, v_caller_school
  FROM users WHERE auth_id = auth.uid();

  IF v_caller_role NOT IN ('registrar', 'principal', 'vice_principal', 'admin_staff', 'super_admin') THEN
    RAISE EXCEPTION 'Unauthorized: only registrar or admin can accept applications';
  END IF;

  -- 2. Get application
  SELECT * INTO v_app FROM student_applications WHERE id = p_application_id;

  IF v_app IS NULL THEN
    RAISE EXCEPTION 'Application not found';
  END IF;

  IF v_app.school_id != v_caller_school AND v_caller_role != 'super_admin' THEN
    RAISE EXCEPTION 'Unauthorized: application belongs to a different school';
  END IF;

  IF v_app.status NOT IN ('submitted', 'under_review') THEN
    RAISE EXCEPTION 'Application is not in a reviewable state (current: %)', v_app.status;
  END IF;

  -- 3. Generate registration number
  v_reg_number := generate_registration_number(v_app.school_id);

  -- 4. CREATE THE STUDENT RECORD
  INSERT INTO students (
    school_id,
    registration_number,
    first_name,
    last_name,
    date_of_birth,
    gender,
    enrollment_date,
    current_grade_level,
    status,
    previous_school,
    emergency_contact_name,
    emergency_contact_phone
  ) VALUES (
    v_app.school_id,
    v_reg_number,
    v_app.first_name,
    v_app.last_name,
    v_app.date_of_birth,
    v_app.gender,
    CURRENT_DATE,
    v_app.grade_level_applied,
    'active',
    v_app.previous_school,
    v_app.emergency_contact_name,
    v_app.emergency_contact_phone
  )
  RETURNING id INTO v_student_id;

  -- 5. Create guardian record (if guardian info exists)
  IF v_app.guardian_full_name IS NOT NULL AND v_app.guardian_full_name != '' THEN
    INSERT INTO guardians (
      student_id,
      school_id,
      relationship,
      full_name,
      email,
      phone,
      address,
      occupation
    ) VALUES (
      v_student_id,
      v_app.school_id,
      v_app.guardian_relationship,
      v_app.guardian_full_name,
      v_app.guardian_email,
      v_app.guardian_phone,
      v_app.guardian_address,
      v_app.guardian_occupation
    )
    RETURNING id INTO v_guardian_id;
  END IF;

  -- 6. Create enrollment record
  INSERT INTO student_enrollments (
    student_id,
    school_id,
    academic_year,
    enrollment_date,
    status
  ) VALUES (
    v_student_id,
    v_app.school_id,
    v_app.academic_year,
    CURRENT_DATE,
    'active'
  );

  -- 7. Update application status
  UPDATE student_applications SET
    status = 'accepted',
    reviewed_by = (SELECT id FROM users WHERE auth_id = auth.uid()),
    reviewed_at = NOW(),
    review_notes = COALESCE(p_review_notes, review_notes),
    assigned_registration_number = v_reg_number,
    updated_at = NOW()
  WHERE id = p_application_id;

  -- 8. Return success with all IDs
  RETURN jsonb_build_object(
    'success', TRUE,
    'student_id', v_student_id,
    'registration_number', v_reg_number,
    'guardian_id', v_guardian_id,
    'message', 'Student accepted and enrolled successfully'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION accept_student_application(UUID, TEXT) TO authenticated;

-- ============================================================
-- PART 4: Repair orphaned accepted applications
-- Reset any 'accepted' applications that don't have a matching
-- student record so the registrar can re-accept them
-- ============================================================

UPDATE student_applications sa
SET
  status = 'under_review',
  assigned_registration_number = NULL,
  review_notes = COALESCE(review_notes || E'\n', '') || '[System: Reset for re-acceptance — student record was not created]',
  updated_at = NOW()
WHERE sa.status = 'accepted'
  AND sa.assigned_registration_number IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM students s
    WHERE s.registration_number = sa.assigned_registration_number
      AND s.school_id = sa.school_id
  );
