-- ============================================================
-- Migration 201: Live attendance on the web portal
--
-- Problem:
--   SchoolSync Attend writes attendance_records as teachers tap cards, but
--   the web portal only shows them after a manual page refresh. The office
--   cannot watch a roll being taken.
--
--   The web page now subscribes via useLiveAttendance (postgres_changes on
--   attendance_records), but Supabase Realtime only broadcasts changes for
--   tables in the supabase_realtime publication. Migration 056 added
--   user_notifications and nothing since — so attendance_records emits
--   nothing and the subscription sits silent.
--
-- Fix:
--   Add attendance_records to the publication.
--
-- Security:
--   Realtime enforces RLS on the subscribing user's behalf — a client only
--   receives rows it could already SELECT. Adding a table to the publication
--   grants no new access; staff see their school's rows exactly as before,
--   and nothing here widens that.
--
-- Idempotent: safe to run more than once.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_publication_tables
    WHERE  pubname    = 'supabase_realtime'
      AND  schemaname = 'public'
      AND  tablename  = 'attendance_records'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_records;
  END IF;
END $$;


-- ============================================================
-- REPLICA IDENTITY
--
-- Taps are upserts: a first scan INSERTs, a re-scan UPDATEs. The web hook
-- listens for '*', and for UPDATE and DELETE events Realtime needs to
-- identify the row being changed. The default replica identity covers this
-- via the primary key, which attendance_records has — so no change is
-- required, and FULL is deliberately NOT set here: it makes Postgres write
-- the entire old row to WAL on every update, which is real overhead during a
-- class-wide scan for data the client does not use.
--
-- Set FULL only if a future feature needs the previous values of changed
-- columns:
--   ALTER TABLE public.attendance_records REPLICA IDENTITY FULL;
-- ============================================================


-- ============================================================
-- VERIFICATION
--
-- Should return one row after applying:
--
--   SELECT schemaname, tablename
--   FROM   pg_publication_tables
--   WHERE  pubname = 'supabase_realtime'
--     AND  tablename = 'attendance_records';
--
-- To watch it work: open Mark Attendance on the PC for a class, then tap a
-- card for a student in that class from SchoolSync Attend. The row should
-- update on the PC within a second, with no refresh.
-- ============================================================
