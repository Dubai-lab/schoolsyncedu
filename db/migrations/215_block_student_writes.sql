-- ============================================================
-- Migration 215: Stop students and parents writing to school data
--
-- THE PROBLEM
--
-- 44 tables carry a policy of this shape, from migration 006:
--
--   CREATE POLICY classes_tenant ON classes
--     FOR ALL USING (school_id = auth_school_id() OR is_super_admin())
--     WITH CHECK (school_id = auth_school_id() OR is_super_admin());
--
-- FOR ALL covers SELECT, INSERT, UPDATE and DELETE, and the only test is
-- "does this row belong to my school". There is no role check. auth_school_id()
-- returns the caller's own school — including a student's. So any signed-in
-- student passes the check on every row in their school, for every operation.
--
-- In practice that means a student could delete their discipline record, mark
-- their invoice paid, move themselves to another class, reassign an NFC card,
-- or empty the library catalogue. Nothing in the UI offers it; the API allows
-- all of it, because the anon key ships in the JavaScript bundle by design and
-- RLS is the only barrier.
--
-- WHY IT SURVIVED
--
-- Migration 025 spotted this for student_enrollments and wrote correct
-- role-scoped policies — but dropped only its own earlier versions, not 006's
-- student_enrollments_tenant. PostgreSQL ORs permissive policies together, so
-- a row is reachable if ANY policy allows it. Adding a strict policy beside a
-- permissive one changes nothing. 43 of 45 are still live.
--
-- THE APPROACH
--
-- Not a rewrite of 44 policies. Their USING expressions differ — some check
-- school_id, some join through students or classes — and rewriting each by
-- hand is exactly how a working system breaks.
--
-- Instead this adds RESTRICTIVE policies, which PostgreSQL ANDs with the
-- existing permissive ones rather than ORing. Three per table, covering only
-- INSERT, UPDATE and DELETE. SELECT is deliberately untouched, so every screen
-- reads exactly what it read before.
--
-- The effect is additive and narrow:
--   • staff keep every write they had — none of them are student or parent
--   • students and parents lose writes they were never meant to have
--   • reads are unchanged for everyone
--
-- Student writes that must keep working all bypass this entirely:
--   record_fee_payment      SECURITY DEFINER
--   update_my_photo_url     SECURITY DEFINER
--   register_device_token   SECURITY DEFINER
--   bank_transfer_proofs    its own scoped policies, not in this list
--
-- ROLLBACK
--   DROP POLICY rls_no_student_write_ins ON <table>;   -- and _upd, _del
-- ============================================================

DO $$
DECLARE
  t          TEXT;
  -- Every table carrying a FOR ALL ... auth_school_id() policy from 006.
  tables     TEXT[] := ARRAY[
    'academic_calendar','announcements','book_copies','book_returns','books',
    'class_assignments','class_subjects','classes','expense_records',
    'fee_structures','financial_reports','id_card_designs','id_card_generation',
    'incident_actions','invoices','letter_approvals','letter_deliveries',
    'letter_recalls','letter_template_versions','letter_templates',
    'library_reports','nfc_attendance_logs','nfc_cards','nfc_chip_assignments',
    'nfc_readers','notification_preferences','payment_history',
    'payment_method_records','payment_receipts','permissions','print_queue',
    'promotion_records','sms_logs','student_academic_progress',
    'student_discipline_records','student_enrollments','student_incidents',
    'student_leave_records','subjects','subscriptions','timetables',
    'user_roles','webhook_events'
  ];
  -- COALESCE so an unauthenticated caller is not caught by this. anon has no
  -- role, and NULL NOT IN (...) is NULL rather than true, which would block
  -- legitimate anonymous inserts such as public application forms. Those are
  -- governed by their own anon policies; this layer targets signed-in students
  -- and parents specifically.
  guard      TEXT := $g$COALESCE(auth_user_role()::text, '') NOT IN ('student', 'parent')$g$;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Skip anything not present, so the migration survives a database where a
    -- table was renamed or never created.
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      RAISE NOTICE 'skipped (no such table): %', t;
      CONTINUE;
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS rls_no_student_write_ins ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS rls_no_student_write_upd ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS rls_no_student_write_del ON public.%I', t);

    -- INSERT is judged on the incoming row, so it needs WITH CHECK.
    EXECUTE format(
      'CREATE POLICY rls_no_student_write_ins ON public.%I AS RESTRICTIVE FOR INSERT WITH CHECK (%s)',
      t, guard);

    -- UPDATE is judged on the existing row (USING) and the new one (WITH CHECK).
    EXECUTE format(
      'CREATE POLICY rls_no_student_write_upd ON public.%I AS RESTRICTIVE FOR UPDATE USING (%s) WITH CHECK (%s)',
      t, guard, guard);

    -- DELETE is judged on the existing row only.
    EXECUTE format(
      'CREATE POLICY rls_no_student_write_del ON public.%I AS RESTRICTIVE FOR DELETE USING (%s)',
      t, guard);
  END LOOP;
END $$;


-- ============================================================
-- VERIFICATION
--
--   -- Three restrictive policies per table, and no SELECT among them:
--   SELECT tablename, cmd, permissive
--   FROM   pg_policies
--   WHERE  policyname LIKE 'rls_no_student_write%'
--   ORDER  BY tablename, cmd;
--   -- expect permissive = 'RESTRICTIVE', cmd in (INSERT, UPDATE, DELETE)
--
--   -- Count should be 3 x number of tables that exist:
--   SELECT count(*) FROM pg_policies WHERE policyname LIKE 'rls_no_student_write%';
--
-- WHAT TO TEST IN THE APP
--
--   As a student: open the portal. Grades, attendance, fees, timetable, ID
--   card and library must all still load — this migration touches no SELECT.
--   Paying a fee and changing the profile photo must still work; both go
--   through SECURITY DEFINER functions.
--
--   As staff: the screens each role uses to save data must still save.
--   Registrar enrolments, bursar payments, librarian checkouts, IT admin
--   cards. None of those roles is student or parent, so none is affected.
-- ============================================================

NOTIFY pgrst, 'reload schema';
