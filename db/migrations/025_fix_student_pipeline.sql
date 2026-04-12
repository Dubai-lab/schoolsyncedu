-- ============================================================
-- MIGRATION 025: Fix the entire student pipeline
-- Run this in Supabase SQL Editor
-- ============================================================
-- Problems fixed:
--   1. students SELECT RLS uses `id = auth.uid()` — WRONG.
--      auth.uid() is the Supabase auth UUID, not users.id.
--      Fix: use auth_school_id() / auth_user_role() helper functions.
--   2. class_assignments and student_enrollments have RLS enabled
--      but NO SELECT policy → Postgres denies all reads.
--   3. it_admin and proprietor missing from students RLS.
--   4. accept_student_application sets status='active' but the
--      student_status enum has no 'active' value — INSERT fails.
--   5. accept_student_application does not update current_class_id
--      after class assignment → classes page never shows students.
--   6. Liberia workflow: enrollment should start as
--      'pending_payment'; bursar recording registration fee
--      flips it to 'active'.
--   7. No registration fee auto-assigned after acceptance →
--      bursar has nothing to collect against.
-- ============================================================


-- ============================================================
-- PART 1: Drop broken students RLS policies and replace
-- ============================================================

DROP POLICY IF EXISTS students_select_policy  ON students;
DROP POLICY IF EXISTS students_insert_policy  ON students;
DROP POLICY IF EXISTS students_update_policy  ON students;

-- SELECT: every role inside the same school can read students.
-- auth_school_id() is SECURITY DEFINER so no RLS loop.
CREATE POLICY students_select_policy ON students
  FOR SELECT USING (
    school_id = auth_school_id()
    OR is_super_admin()
  );

-- INSERT: registrar, admin_staff, principal (manual enrolment)
CREATE POLICY students_insert_policy ON students
  FOR INSERT WITH CHECK (
    school_id = auth_school_id()
    AND auth_user_role() IN (
      'registrar'::user_role,
      'admin_staff'::user_role,
      'principal'::user_role,
      'vice_principal'::user_role
    )
  );

-- UPDATE: same roles, same school
CREATE POLICY students_update_policy ON students
  FOR UPDATE USING (
    school_id = auth_school_id()
    AND auth_user_role() IN (
      'registrar'::user_role,
      'admin_staff'::user_role,
      'principal'::user_role,
      'vice_principal'::user_role
    )
  );

-- DELETE: principal / admin only
CREATE POLICY students_delete_policy ON students
  FOR DELETE USING (
    school_id = auth_school_id()
    AND auth_user_role() IN (
      'principal'::user_role,
      'admin_staff'::user_role
    )
  );


-- ============================================================
-- PART 2: guardians RLS (same auth_id mismatch fix)
-- ============================================================

DROP POLICY IF EXISTS guardians_select_policy ON guardians;
DROP POLICY IF EXISTS guardians_insert_policy ON guardians;
DROP POLICY IF EXISTS guardians_update_policy ON guardians;

CREATE POLICY guardians_select_policy ON guardians
  FOR SELECT USING (
    school_id = auth_school_id()
    OR is_super_admin()
  );

CREATE POLICY guardians_insert_policy ON guardians
  FOR INSERT WITH CHECK (
    school_id = auth_school_id()
  );

CREATE POLICY guardians_update_policy ON guardians
  FOR UPDATE USING (
    school_id = auth_school_id()
  );


-- ============================================================
-- PART 3: student_enrollments — add missing SELECT policy
-- ============================================================

DROP POLICY IF EXISTS enrollments_select_policy   ON student_enrollments;
DROP POLICY IF EXISTS enrollments_insert_policy   ON student_enrollments;
DROP POLICY IF EXISTS enrollments_update_policy   ON student_enrollments;

CREATE POLICY enrollments_select_policy ON student_enrollments
  FOR SELECT USING (
    school_id = auth_school_id()
    OR is_super_admin()
  );

CREATE POLICY enrollments_insert_policy ON student_enrollments
  FOR INSERT WITH CHECK (
    school_id = auth_school_id()
    AND auth_user_role() IN (
      'registrar'::user_role,
      'admin_staff'::user_role,
      'principal'::user_role,
      'vice_principal'::user_role,
      'bursar'::user_role
    )
  );

CREATE POLICY enrollments_update_policy ON student_enrollments
  FOR UPDATE USING (
    school_id = auth_school_id()
    AND auth_user_role() IN (
      'registrar'::user_role,
      'admin_staff'::user_role,
      'principal'::user_role,
      'vice_principal'::user_role,
      'bursar'::user_role
    )
  );


-- ============================================================
-- PART 4: class_assignments — add missing SELECT policy
-- ============================================================

DROP POLICY IF EXISTS class_assignments_select_policy ON class_assignments;
DROP POLICY IF EXISTS class_assignments_insert_policy ON class_assignments;
DROP POLICY IF EXISTS class_assignments_update_policy ON class_assignments;

-- Everyone in the school can see which students are in which class
CREATE POLICY class_assignments_select_policy ON class_assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM classes c
      WHERE c.id = class_assignments.class_id
        AND c.school_id = auth_school_id()
    )
    OR is_super_admin()
  );

CREATE POLICY class_assignments_insert_policy ON class_assignments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM classes c
      WHERE c.id = class_assignments.class_id
        AND c.school_id = auth_school_id()
    )
    AND auth_user_role() IN (
      'registrar'::user_role,
      'admin_staff'::user_role,
      'principal'::user_role,
      'vice_principal'::user_role
    )
  );

CREATE POLICY class_assignments_update_policy ON class_assignments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM classes c
      WHERE c.id = class_assignments.class_id
        AND c.school_id = auth_school_id()
    )
    AND auth_user_role() IN (
      'registrar'::user_role,
      'admin_staff'::user_role,
      'principal'::user_role,
      'vice_principal'::user_role
    )
  );


-- ============================================================
-- PART 5: student_fees — fix missing school_id isolation
-- (The existing policy joins through fee_structures, which
--  is fragile. Add a direct school_id column + policy.)
-- ============================================================

-- Add school_id to student_fees if missing (safe to run twice)
ALTER TABLE student_fees
  ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;

-- Back-fill school_id from fee_structures for existing rows
UPDATE student_fees sf
SET school_id = fs.school_id
FROM fee_structures fs
WHERE sf.fee_structure_id = fs.id
  AND sf.school_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_student_fees_school ON student_fees(school_id);

-- Drop & replace student_fees policies
DROP POLICY IF EXISTS student_fees_select_policy ON student_fees;
DROP POLICY IF EXISTS student_fees_insert_policy ON student_fees;
DROP POLICY IF EXISTS student_fees_update_policy ON student_fees;

CREATE POLICY student_fees_select_policy ON student_fees
  FOR SELECT USING (
    school_id = auth_school_id()
    OR is_super_admin()
  );

CREATE POLICY student_fees_insert_policy ON student_fees
  FOR INSERT WITH CHECK (
    school_id = auth_school_id()
    AND auth_user_role() IN (
      'bursar'::user_role,
      'admin_staff'::user_role,
      'principal'::user_role,
      'registrar'::user_role
    )
  );

CREATE POLICY student_fees_update_policy ON student_fees
  FOR UPDATE USING (
    school_id = auth_school_id()
    AND auth_user_role() IN (
      'bursar'::user_role,
      'admin_staff'::user_role,
      'principal'::user_role
    )
  );


-- ============================================================
-- PART 6: Add enrollment_status to student_enrollments
-- Liberia workflow:
--   accepted       → status = 'pending_payment'
--   registration   → status = 'active'  (bursar records payment)
--   fee paid
-- The existing 'status' column uses VARCHAR so we just extend
-- the allowed values by convention (no enum to change).
-- ============================================================

-- Nothing to ALTER — status is already VARCHAR(50), we just
-- use the value 'pending_payment' from the RPC onward.


-- ============================================================
-- PART 7: Recreate accept_student_application
-- Fixes:
--   • status = 'enrolled'  (not 'active')
--   • enrollment status = 'pending_payment'
--   • accepts optional p_class_id to assign class immediately
--   • updates students.current_class_id after class assignment
--   • auto-creates a registration fee student_fee record if a
--     'registration_fee' fee_structure exists for the school
-- ============================================================

DROP FUNCTION IF EXISTS accept_student_application(UUID, TEXT);
DROP FUNCTION IF EXISTS accept_student_application(UUID, TEXT, UUID);

CREATE OR REPLACE FUNCTION accept_student_application(
  p_application_id UUID,
  p_review_notes   TEXT    DEFAULT NULL,
  p_class_id       UUID    DEFAULT NULL   -- optional: assign to class immediately
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

  -- 3. Generate registration number
  v_reg_number := generate_registration_number(v_app.school_id);

  -- 4. Decide which class to use
  --    p_class_id wins; otherwise fall back to class_id on the application
  v_assign_class := COALESCE(p_class_id, v_app.class_id);

  -- 5. Create student record
  --    status = 'enrolled' (valid enum value)
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

  -- 6. Create guardian record
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

  -- 7. Determine academic year (use setting or application year)
  SELECT COALESCE(
    (SELECT setting_value FROM school_settings
      WHERE school_id = v_app.school_id AND setting_key = 'current_academic_year'),
    v_app.academic_year
  ) INTO v_academic_year;

  -- 8. Create enrollment record — pending_payment until reg fee collected
  INSERT INTO student_enrollments (
    student_id, school_id, academic_year, enrollment_date, status
  ) VALUES (
    v_student_id, v_app.school_id, v_academic_year,
    CURRENT_DATE, 'pending_payment'
  );

  -- 9. Assign to class if provided
  IF v_assign_class IS NOT NULL THEN
    INSERT INTO class_assignments (class_id, student_id, academic_year)
    VALUES (v_assign_class, v_student_id, v_academic_year)
    ON CONFLICT DO NOTHING;
  END IF;

  -- 10. Auto-assign registration fee if a structure exists for this school
  --     Look for fee_type = 'registration_fee' for the current academic year.
  --     If found, create a student_fee record so the bursar can collect it.
  SELECT fs.*
    INTO v_reg_fee
    FROM fee_structures fs
   WHERE fs.school_id   = v_app.school_id
     AND fs.fee_type    = 'registration_fee'
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

  -- 11. Update application
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


-- ============================================================
-- PART 8: activate_student_enrollment
-- Called by the bursar after recording a registration fee
-- payment. Flips the enrollment from pending_payment → active.
-- ============================================================

CREATE OR REPLACE FUNCTION activate_student_enrollment(
  p_student_id    UUID,
  p_academic_year TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id UUID;
BEGIN
  -- Caller must be bursar, admin, or principal in same school
  SELECT auth_school_id() INTO v_school_id;

  IF auth_user_role() NOT IN (
    'bursar','admin_staff','principal','vice_principal','registrar','super_admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Check student belongs to caller's school
  IF NOT EXISTS (
    SELECT 1 FROM students
    WHERE id = p_student_id AND school_id = v_school_id
  ) THEN
    RAISE EXCEPTION 'Student not found in your school';
  END IF;

  UPDATE student_enrollments
     SET status = 'active', updated_at = NOW()
   WHERE student_id    = p_student_id
     AND academic_year = p_academic_year
     AND status = 'pending_payment';

  RETURN jsonb_build_object('success', TRUE, 'message', 'Enrollment activated');
END;
$$;

GRANT EXECUTE ON FUNCTION activate_student_enrollment(UUID, TEXT) TO authenticated;


-- ============================================================
-- PART 9: Repair existing accepted applications
-- Any application that is 'accepted' but has no student record
-- gets reset to 'under_review' so the registrar can re-accept.
-- ============================================================

UPDATE student_applications sa
SET
  status = 'under_review',
  assigned_registration_number = NULL,
  review_notes = COALESCE(review_notes || E'\n', '')
    || '[System 025: Reset — student record missing. Please re-accept.]',
  updated_at = NOW()
WHERE sa.status = 'accepted'
  AND sa.assigned_registration_number IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM students s
    WHERE s.registration_number = sa.assigned_registration_number
      AND s.school_id = sa.school_id
  );


-- ============================================================
-- PART 10: Repair existing student records
--  • Any student with status='active' → fix to 'enrolled'
--  • Back-fill current_class_id from class_assignments
-- ============================================================

-- Fix invalid status
UPDATE students
   SET status = 'enrolled'::student_status
 WHERE status::TEXT = 'active';

-- Back-fill current_class_id from latest class assignment
UPDATE students s
   SET current_class_id = ca.class_id
  FROM (
    SELECT DISTINCT ON (student_id) student_id, class_id
      FROM class_assignments
     WHERE removed_at IS NULL
     ORDER BY student_id, assigned_at DESC
  ) ca
 WHERE ca.student_id = s.id
   AND s.current_class_id IS NULL;


-- ============================================================
-- PART 11: Repair existing enrollment records
--  • Any enrollment with status='active' that was created
--    directly by the old RPC (before this migration) and where
--    no registration_fee payment exists → set pending_payment.
--  • If a payment does exist → leave as active.
-- ============================================================

UPDATE student_enrollments se
   SET status = 'pending_payment'
  FROM students s
 WHERE se.student_id = s.id
   AND se.status = 'active'
   AND NOT EXISTS (
     SELECT 1 FROM student_fees sf
     JOIN fee_structures fs ON sf.fee_structure_id = fs.id
     WHERE sf.student_id = s.id
       AND fs.fee_type   = 'registration_fee'
       AND sf.status     IN ('paid', 'partial')
   )
   AND EXISTS (
     -- Only touch enrollments that have a matching registration fee structure
     SELECT 1 FROM fee_structures fs2
     WHERE fs2.school_id = s.school_id
       AND fs2.fee_type = 'registration_fee'
   );


-- ============================================================
-- PART 12: school_settings — confirm anon RLS includes
--          current_academic_year (already in 014 but
--          adding defensively)
-- ============================================================

DROP POLICY IF EXISTS settings_anon_read ON school_settings;

CREATE POLICY settings_anon_read ON school_settings
  FOR SELECT TO anon
  USING (
    setting_key IN (
      'application_fee_usd',
      'application_fee_lrd',
      'accepting_applications',
      'current_academic_year'
    )
  );


-- ============================================================
-- Done. Summary of changes:
-- • students RLS: uses auth_school_id() / auth_user_role()
-- • guardians RLS: same fix
-- • student_enrollments: SELECT + INSERT + UPDATE policies added
-- • class_assignments: SELECT + INSERT + UPDATE policies added
-- • student_fees: school_id column added, policies fixed
-- • accept_student_application: status='enrolled',
--   enrollment='pending_payment', class assigned, reg fee linked
-- • activate_student_enrollment: new RPC for bursar
-- • Existing data repaired
-- ============================================================
