-- ============================================================
-- Migration 224: A student could read the whole school's records
--
-- ── WHAT HAPPENED ───────────────────────────────────────────────────────────
--
--   Migration 081 set out to scope the student portal and wrote the policies
--   correctly. "Students can view own payments", "Students can view own fees",
--   "Staff can view school report cards" — each one properly separates a
--   student from everyone else.
--
--   It had no effect. Permissive policies are OR'd, and 081 dropped only its
--   own policy names before recreating them. The originals from migration 006
--   were left in place:
--
--     payments_select        school_id = auth_school_id()
--     student_fees_select    student_id IN (students of my school)
--     report_cards_select    student_id IN (students of my school)
--     transcripts_select     student_id IN (students of my school)
--
--   A student has a users row carrying school_id, so auth_school_id() resolves
--   for them like anyone else, and every one of those conditions is true for
--   every row in the school. One broad policy beside a narrow one grants the
--   broad answer.
--
--   So any signed-in student could read every payment the school has taken —
--   who paid, how much, when, by what method — every family's outstanding
--   balance, and every other student's report cards and transcripts.
--
--   The fix is to delete the four stale policies. 081's, already written and
--   already correct, then apply as intended. This is the same trap noted in
--   migration 025 and fixed by replacement in 220 and 223.
--
-- ── NFC CARDS ───────────────────────────────────────────────────────────────
--
--   nfc_cards_tenant is FOR ALL USING (school_id = auth_school_id()), so a
--   student could read every card row in the school, including nfc_chip_id.
--
--   That is the credential. Attendance is taken by tapping it and exam
--   clearance is granted by tapping it, so knowing another student's chip id
--   and holding a writable tag is enough to be marked present in a class you
--   are not in, or to walk into an exam on someone else's fee record. Of
--   everything in this migration it is the only one that lets a student change
--   an outcome rather than just see something they should not.
--
--   Migration 215 already blocks students writing here. What was missing is
--   that they could read it at all. The portal only ever asks for their own
--   card, so scoping to that costs the product nothing.
--
--   nfc_attendance_logs carries the same shape and gets the same treatment.
--
-- ROLLBACK
--   Re-create the four *_select policies from 006 and nfc_cards_tenant.
-- ============================================================

-- ── 1. Stale policies that were overriding 081 ──────────────────────────────
-- Dropping only. The replacements already exist and are correct.
DROP POLICY IF EXISTS payments_select     ON payments;
DROP POLICY IF EXISTS student_fees_select ON student_fees;
DROP POLICY IF EXISTS report_cards_select ON report_cards;
DROP POLICY IF EXISTS transcripts_select  ON transcripts;

-- The 002-era names, in case a database was built before 006 replaced them.
DROP POLICY IF EXISTS payments_select_policy     ON payments;
DROP POLICY IF EXISTS student_fees_select_policy ON student_fees;
DROP POLICY IF EXISTS report_cards_select_policy ON report_cards;
DROP POLICY IF EXISTS transcripts_select_policy  ON transcripts;

-- Fail loudly rather than leave the hole open if 081 was never applied: with
-- no SELECT policy at all the portal would go blank, which is safe but would
-- look like data loss and be hard to trace back to here.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['payments','student_fees','report_cards','transcripts'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t AND cmd IN ('SELECT', 'ALL')
    ) THEN
      RAISE EXCEPTION
        'No SELECT policy remains on %. Apply supabase/migrations/081_student_portal_rls.sql before this migration.', t;
    END IF;
  END LOOP;
END $$;


-- ── 2. NFC cards — the chip id is a credential ──────────────────────────────
DROP POLICY IF EXISTS nfc_cards_tenant ON nfc_cards;

-- Staff keep exactly what they had, including writes: assigning a card, from
-- the IT screen or the Attend app, is unchanged.
CREATE POLICY nfc_cards_staff ON nfc_cards
  FOR ALL
  USING (
    is_super_admin()
    OR (
      school_id = auth_school_id()
      AND COALESCE(auth_user_role()::TEXT, '') NOT IN ('student', 'parent')
    )
  )
  WITH CHECK (
    is_super_admin()
    OR (
      school_id = auth_school_id()
      AND COALESCE(auth_user_role()::TEXT, '') NOT IN ('student', 'parent')
    )
  );

-- Read-only, and only their own — which is all My ID Card ever asks for.
CREATE POLICY nfc_cards_own_select ON nfc_cards
  FOR SELECT
  USING (
    student_id = auth_student_id()
    OR student_id IN (SELECT auth_guardian_student_ids())
  );


DROP POLICY IF EXISTS nfc_attendance_logs_tenant ON nfc_attendance_logs;

CREATE POLICY nfc_attendance_logs_staff ON nfc_attendance_logs
  FOR ALL
  USING (
    is_super_admin()
    OR (
      card_id IN (SELECT id FROM nfc_cards WHERE school_id = auth_school_id())
      AND COALESCE(auth_user_role()::TEXT, '') NOT IN ('student', 'parent')
    )
  )
  WITH CHECK (
    is_super_admin()
    OR (
      card_id IN (SELECT id FROM nfc_cards WHERE school_id = auth_school_id())
      AND COALESCE(auth_user_role()::TEXT, '') NOT IN ('student', 'parent')
    )
  );

CREATE POLICY nfc_attendance_logs_own_select ON nfc_attendance_logs
  FOR SELECT
  USING (
    card_id IN (
      SELECT id FROM nfc_cards
      WHERE student_id = auth_student_id()
         OR student_id IN (SELECT auth_guardian_student_ids())
    )
  );

-- ── 3. Guardian records were writable by anyone in the school ───────────────
--
--   guardians_insert_policy and guardians_update_policy (migration 025) test
--   only school_id = auth_school_id(). No role check at all, and guardians is
--   not among the 44 tables migration 215 closed to students.
--
--   So any student could add a guardian to any child in the school, or rewrite
--   an existing one's phone number and email. Contact details are what the
--   school uses to reach a parent about an incident or an unpaid fee, and
--   what a password reset would be sent to — changing someone else's is not a
--   small thing.
--
--   Matched to students_insert_policy, which is the same class of record and
--   already had the role list this was missing.
-- ============================================================

DROP POLICY IF EXISTS guardians_insert_policy ON guardians;
CREATE POLICY guardians_insert_policy ON guardians
  FOR INSERT WITH CHECK (
    school_id = auth_school_id()
    AND auth_user_role() IN (
      'registrar'::user_role,
      'admin_staff'::user_role,
      'principal'::user_role,
      'vice_principal'::user_role,
      'it_admin'::user_role
    )
  );

DROP POLICY IF EXISTS guardians_update_policy ON guardians;
CREATE POLICY guardians_update_policy ON guardians
  FOR UPDATE USING (
    school_id = auth_school_id()
    AND auth_user_role() IN (
      'registrar'::user_role,
      'admin_staff'::user_role,
      'principal'::user_role,
      'vice_principal'::user_role,
      'it_admin'::user_role
    )
  );

NOTIFY pgrst, 'reload schema';
