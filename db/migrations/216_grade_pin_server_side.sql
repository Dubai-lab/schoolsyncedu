-- ============================================================
-- Migration 216: Move the grade privacy PIN into the database
--
-- THE BUG
--   MyGrades.tsx stored the PIN in localStorage:
--
--     localStorage.setItem(`grade_pin_${userId}`, pin)
--     localStorage.setItem(`grade_pin_enabled_${userId}`, 'true')
--
--   It never reached the server. So the PIN lived only in the browser that
--   set it, and disappeared whenever that storage was cleared — which is why
--   a student who set a PIN is asked to "set a PIN or skip" again after a
--   while. On the mobile app this is worse, not better: a WebView's storage
--   is evicted by the OS under pressure, and iOS caps non-installed web
--   storage at seven days.
--
--   Three further consequences of the same line:
--
--   1. NO PROTECTION ON ANY OTHER DEVICE. The PIN is per-browser, so signing
--      in from a different phone or a school computer showed the grades with
--      no PIN at all. The lock only ever guarded the one device that set it.
--
--   2. THE PIN WAS PLAINTEXT AND READABLE. Anyone with the device could read
--      it out of devtools or the app's storage directory.
--
--   3. THE IT ADMIN RESET DIDN'T RESET ANYTHING. resetStudentGradePin sets
--      students.grade_pin_reset_requested = true, and the client clears its
--      own localStorage on the student's next visit. If the student never
--      opens that same browser again, the reset never happens. From any other
--      device the old PIN was already irrelevant.
--
-- AFTER THIS MIGRATION
--   The PIN is a bcrypt hash in a table no client can read, set once and kept
--   until an IT admin clears it. It follows the student to every device and
--   every browser, and survives storage being wiped.
--
--   Set-once is enforced in the database, not just the UI: set_my_grade_pin
--   refuses to overwrite an existing PIN unless staff have flagged a reset.
--   A student who forgets it visits the IT office, which is the intended flow.
--
-- BRUTE FORCE
--   A four-digit PIN checked over an API is 10,000 guesses. In localStorage
--   that was somebody else's problem — the comparison never left the device.
--   Now that verification is a network call it needs a limit, so five wrong
--   attempts lock the PIN for fifteen minutes.
--
-- ROLLBACK
--   DROP TABLE student_grade_pins;
--   DROP FUNCTION get_my_grade_pin_state();
--   DROP FUNCTION set_my_grade_pin(TEXT);
--   DROP FUNCTION verify_my_grade_pin(TEXT);
--   DROP FUNCTION reset_student_grade_pin(UUID);
-- ============================================================

-- Supabase ships pgcrypto in `extensions`. Every function below sets
-- search_path = public, extensions so crypt()/gen_salt() resolve in either
-- arrangement — without it they raise 42883 at call time, which PostgREST
-- returns as a 404 and reads like a missing function. Same trap as 206.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  PERFORM crypt('probe', gen_salt('bf'));
EXCEPTION WHEN undefined_function THEN
  RAISE EXCEPTION
    'pgcrypto is not reachable. Install it, or add its schema to the search_path in this migration.';
END $$;


-- ============================================================
-- 1. STORAGE
--    A separate table rather than a column on students, because a student may
--    SELECT their own students row (migration 006) and RLS is row-level — a
--    hash column there would be readable by its owner. This table has RLS on
--    and deliberately NO policies, so no client reaches it by any path. Only
--    the SECURITY DEFINER functions below touch it.
-- ============================================================

-- The reset flag was added in supabase/migrations/062. Asserted here so this
-- migration also stands up a database that never saw that file.
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS grade_pin_reset_requested BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS student_grade_pins (
  student_id     UUID PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  pin_hash       TEXT        NOT NULL,
  failed_attempts INT        NOT NULL DEFAULT 0,
  locked_until   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE student_grade_pins ENABLE ROW LEVEL SECURITY;

-- Belt and braces: even a future permissive policy cannot leak the hash if the
-- role was never granted the table.
REVOKE ALL ON student_grade_pins FROM anon, authenticated;


-- ============================================================
-- 2. STATE — what the gate needs to decide which screen to show
--    Returns no hash, only whether one exists.
-- ============================================================

CREATE OR REPLACE FUNCTION get_my_grade_pin_state()
RETURNS TABLE (has_pin BOOLEAN, reset_requested BOOLEAN, locked_until TIMESTAMPTZ)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
-- The OUT parameter locked_until shares its name with the column. Without this
-- plpgsql treats the bare name as ambiguous and raises at call time.
#variable_conflict use_column
DECLARE
  v_student_id UUID;
BEGIN
  v_student_id := auth_student_id();
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Not a student account';
  END IF;

  RETURN QUERY
  SELECT
    (p.student_id IS NOT NULL),
    COALESCE(s.grade_pin_reset_requested, FALSE),
    p.locked_until
  FROM students s
  LEFT JOIN student_grade_pins p ON p.student_id = s.id
  WHERE s.id = v_student_id;
END;
$$;


-- ============================================================
-- 3. SET — once, unless staff have cleared it
-- ============================================================

CREATE OR REPLACE FUNCTION set_my_grade_pin(p_pin TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_student_id UUID;
  v_exists     BOOLEAN;
  v_reset      BOOLEAN;
BEGIN
  v_student_id := auth_student_id();
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Not a student account';
  END IF;

  IF p_pin !~ '^[0-9]{4,6}$' THEN
    RAISE EXCEPTION 'PIN must be 4 to 6 digits';
  END IF;

  SELECT EXISTS (SELECT 1 FROM student_grade_pins WHERE student_id = v_student_id)
    INTO v_exists;

  SELECT COALESCE(grade_pin_reset_requested, FALSE)
    INTO v_reset
    FROM students WHERE id = v_student_id;

  -- The whole point of the change: a PIN already set stays set. Only an IT
  -- admin reset reopens it. Enforced here rather than in the UI, because the
  -- UI is the thing that was wrong in the first place.
  IF v_exists AND NOT v_reset THEN
    RAISE EXCEPTION 'A PIN is already set. Ask the IT office to reset it.';
  END IF;

  INSERT INTO student_grade_pins (student_id, pin_hash)
  VALUES (v_student_id, crypt(p_pin, gen_salt('bf')))
  ON CONFLICT (student_id) DO UPDATE
    SET pin_hash        = EXCLUDED.pin_hash,
        failed_attempts = 0,
        locked_until    = NULL,
        updated_at      = NOW();

  -- The reset has been honoured, so retire the flag.
  UPDATE students
     SET grade_pin_reset_requested = FALSE,
         updated_at = NOW()
   WHERE id = v_student_id
     AND grade_pin_reset_requested;
END;
$$;


-- ============================================================
-- 4. VERIFY — with a lockout, since this is now reachable over the network
-- ============================================================

CREATE OR REPLACE FUNCTION verify_my_grade_pin(p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_student_id UUID;
  v_row        student_grade_pins%ROWTYPE;
  v_ok         BOOLEAN;
BEGIN
  v_student_id := auth_student_id();
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Not a student account';
  END IF;

  SELECT * INTO v_row FROM student_grade_pins WHERE student_id = v_student_id;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF v_row.locked_until IS NOT NULL AND v_row.locked_until > NOW() THEN
    RAISE EXCEPTION 'Too many attempts. Try again after %',
      to_char(v_row.locked_until, 'HH24:MI');
  END IF;

  v_ok := (v_row.pin_hash = crypt(p_pin, v_row.pin_hash));

  IF v_ok THEN
    UPDATE student_grade_pins
       SET failed_attempts = 0, locked_until = NULL, updated_at = NOW()
     WHERE student_id = v_student_id;
  ELSE
    UPDATE student_grade_pins
       SET failed_attempts = failed_attempts + 1,
           locked_until = CASE
             WHEN failed_attempts + 1 >= 5 THEN NOW() + INTERVAL '15 minutes'
             ELSE NULL
           END,
           updated_at = NOW()
     WHERE student_id = v_student_id;
  END IF;

  RETURN v_ok;
END;
$$;


-- ============================================================
-- 5. RESET — staff clear the PIN outright
--    Deletes the hash instead of only raising a flag, so the reset takes
--    effect everywhere immediately rather than waiting for the student to
--    reopen the one browser that held it. The flag is still set, so the
--    existing IT admin screen keeps showing "reset pending" until the student
--    chooses a new PIN.
-- ============================================================

CREATE OR REPLACE FUNCTION reset_student_grade_pin(p_student_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_role user_role;
BEGIN
  SELECT role INTO v_role FROM users WHERE auth_id = auth.uid();

  IF v_role NOT IN ('it_admin','admin_staff','principal','vice_principal','registrar','super_admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_role <> 'super_admin' AND NOT EXISTS (
    SELECT 1 FROM students WHERE id = p_student_id AND school_id = auth_school_id()
  ) THEN
    RAISE EXCEPTION 'Forbidden: student not in your school';
  END IF;

  DELETE FROM student_grade_pins WHERE student_id = p_student_id;

  UPDATE students
     SET grade_pin_reset_requested = TRUE,
         updated_at = NOW()
   WHERE id = p_student_id;
END;
$$;


GRANT EXECUTE ON FUNCTION get_my_grade_pin_state()          TO authenticated;
GRANT EXECUTE ON FUNCTION set_my_grade_pin(TEXT)            TO authenticated;
GRANT EXECUTE ON FUNCTION verify_my_grade_pin(TEXT)         TO authenticated;
GRANT EXECUTE ON FUNCTION reset_student_grade_pin(UUID)     TO authenticated;

NOTIFY pgrst, 'reload schema';
