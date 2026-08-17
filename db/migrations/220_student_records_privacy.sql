-- ============================================================
-- Migration 220: A student should not be able to read the whole roster
--
-- THE BUG
--   students_select_policy (migration 063) reads:
--
--     school_id = auth_school_id() OR is_super_admin()
--
--   and its comment says 'every member of the school can read'. A student is a
--   member of the school: they have a users row carrying school_id, so
--   auth_school_id() resolves for them exactly as it does for staff.
--
--   So any signed-in student could list every other student in the school —
--   names, dates of birth, addresses, phone numbers, photos — and
--   guardians_select_policy has the same shape, which hands them every
--   parent's name, phone, email and occupation alongside it.
--
--   Migration 215 stopped students writing to 44 tables. Reads were left
--   deliberately alone, on the reasoning that reads were already scoped. For
--   these two tables they were scoped to the school, not to the person.
--
--   Nothing needed it. The student portal's only query against students is
--   `.eq('user_id', userId)` — its own row. The permission was never used by
--   the product; it was simply available.
--
--   This is the registrar's data: student records and next-of-kin details for
--   children. It is the one table where 'everyone inside the school' is not a
--   safe default.
--
-- THE FIX
--   Staff keep the school-wide read they rely on — a teacher needs a class
--   roster, a librarian needs to identify a borrower, the registrar needs
--   everyone. Students see themselves. Parents see their own children, through
--   auth_guardian_student_ids(), which already exists for exactly this.
--
--   Written as one permissive policy rather than a RESTRICTIVE addition,
--   because permissive policies are OR'd: adding a second one would have
--   widened access rather than narrowed it. That is the trap migration 025 hit.
--
-- ROLLBACK
--   Re-run the policies from migration 063 and 025.
-- ============================================================

-- ── Helpers ─────────────────────────────────────────────────────────────────
-- Both policies below call these, and both read the very tables the policies
-- guard. SECURITY INVOKER would re-enter the policy and Postgres would raise
-- 'infinite recursion detected in policy for relation students'. They are
-- already DEFINER as of migrations 022 and 027; re-asserted here so this
-- migration does not depend on which of the earlier ones was applied last.
CREATE OR REPLACE FUNCTION auth_student_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id
  FROM   students s
  WHERE  s.user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  LIMIT  1;
$$;

CREATE OR REPLACE FUNCTION auth_guardian_student_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT g.student_id FROM public.guardians g
  JOIN public.users u ON g.user_id = u.id
  WHERE u.auth_id = auth.uid();
$$;


-- ── Students ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS students_select        ON students;
DROP POLICY IF EXISTS students_select_policy ON students;

CREATE POLICY students_select_policy ON students
  FOR SELECT USING (
    is_super_admin()
    -- Staff: unchanged, the whole school.
    OR (
      school_id = auth_school_id()
      AND COALESCE(auth_user_role()::TEXT, '') NOT IN ('student', 'parent')
    )
    -- A student, only themselves.
    OR id = auth_student_id()
    -- A parent, only their own children.
    OR id IN (SELECT auth_guardian_student_ids())
  );

-- ── Guardians ───────────────────────────────────────────────────────────────
-- Same shape. These rows are the parents' own contact details, which is why
-- the school-wide read mattered more here than it looks: a student could pull
-- every family's phone number out of the school in one request.
DROP POLICY IF EXISTS guardians_select        ON guardians;
DROP POLICY IF EXISTS guardians_select_policy ON guardians;

CREATE POLICY guardians_select_policy ON guardians
  FOR SELECT USING (
    is_super_admin()
    OR (
      school_id = auth_school_id()
      AND COALESCE(auth_user_role()::TEXT, '') NOT IN ('student', 'parent')
    )
    OR student_id = auth_student_id()
    OR student_id IN (SELECT auth_guardian_student_ids())
  );

NOTIFY pgrst, 'reload schema';
