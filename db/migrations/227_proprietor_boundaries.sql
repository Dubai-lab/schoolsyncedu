-- ============================================================
-- Migration 227: Proprietor boundaries, and closing an escalation I left open
--
-- ── 1. A SCHOOL COULD MINT A PLATFORM OWNER ─────────────────────────────────
--
--   My own migration 217 stopped a Principal escalating, but let the three
--   privileged roles through unchecked:
--
--     v_privileged := ARRAY['proprietor','super_admin','it_admin'];
--     IF v_actor_role = ANY (v_privileged) THEN RETURN NEW; END IF;
--
--   So a Proprietor — or any school's IT Admin — could set a user's role to
--   'super_admin'. is_super_admin() short-circuits tenant scoping everywhere,
--   so that account then reads and writes every school on the platform. One
--   school's technician could reach all of them. That is a tenant boundary,
--   not a school one, and it was mine to get right.
--
--   Worse, 217's trigger fires BEFORE UPDATE only. users_insert (011) checks
--   who is inserting but never what role they are inserting, so the same
--   escalation was available by creating a fresh user rather than promoting
--   one — and that path was not guarded at all.
--
--   A proper ladder now, on INSERT as well as UPDATE. Nobody grants a role
--   above their own:
--
--     super_admin   anything
--     proprietor    anything except super_admin
--     it_admin      ordinary staff only — not it_admin, proprietor or
--                   super_admin, so a technician cannot clone themselves
--                   or promote above. New IT Admins come from the
--                   Proprietor, which is what /proprietor/it-admin is for.
--     principal     ordinary staff only, as 217 had it
--
--   Registration still works: register_school runs before the new owner has a
--   users row, and a caller with no row may create the first one for their
--   school as long as it is not a super_admin.
--
-- ── 2. THE READ-ONLY PRINCIPLE WAS NEVER ENFORCED ───────────────────────────
--
--   constants.ts states it twice — "Read-only access (ethics principle)" and
--   "Special - read-only oversight". The intent is that the owner of the
--   school watches, and the staff operate. It is a good principle: it is what
--   stops an owner quietly adjusting a grade or a balance.
--
--   Nothing enforced it. The clearest breach is bank_transfer_proofs, where
--   the Proprietor could verify a parent's payment evidence — that is the
--   school's fee collection, the Bursar's work, and exactly the sort of thing
--   the principle exists to keep the owner out of. Removed.
--
--   What the Proprietor keeps is ownership rather than operations: the
--   subscription, payment methods, appointing the IT Admin, the site design,
--   and read access to every financial report. None of those are school
--   operations, and all of them are properly theirs.
--
-- ROLLBACK
--   Re-run 217's guard_user_role_changes and 217's bursar_update_school_proofs.
-- ============================================================

-- ── 1. The escalation ladder ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION guard_user_role_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_role TEXT;
  v_target     TEXT := NEW.role::TEXT;
BEGIN
  -- Server-side callers — service_role, Edge Functions, migrations — carry no
  -- JWT. Already trusted; this guards the API surface.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role::TEXT INTO v_actor_role FROM users WHERE auth_id = auth.uid();

  -- ── INSERT ───────────────────────────────────────────────────────────────
  IF TG_OP = 'INSERT' THEN
    -- Registration: register_school creates the owner's row while the caller
    -- still has none of their own. Allowed, but never as a platform owner.
    IF v_actor_role IS NULL THEN
      IF v_target = 'super_admin' THEN
        RAISE EXCEPTION 'Only a platform administrator may create that role.';
      END IF;
      RETURN NEW;
    END IF;

  -- ── UPDATE ───────────────────────────────────────────────────────────────
  ELSE
    -- Untouched privilege columns pass straight through, so a form that
    -- resubmits an unchanged role is unaffected.
    IF NEW.role      IS NOT DISTINCT FROM OLD.role
   AND NEW.school_id IS NOT DISTINCT FROM OLD.school_id THEN
      RETURN NEW;
    END IF;

    -- Nobody promotes themselves, whatever they are.
    IF OLD.auth_id = auth.uid() THEN
      RAISE EXCEPTION 'You cannot change your own role or school.';
    END IF;

    -- Moving a user between schools is a platform operation.
    IF NEW.school_id IS DISTINCT FROM OLD.school_id
   AND COALESCE(v_actor_role, '') NOT IN ('proprietor', 'super_admin') THEN
      RAISE EXCEPTION 'Only the Proprietor may move a user to another school.';
    END IF;

    -- Removing a role counts as much as granting one: demoting the only
    -- Proprietor, or stripping an IT Admin, needs the same standing.
    IF OLD.role::TEXT = 'super_admin' AND COALESCE(v_actor_role, '') <> 'super_admin' THEN
      RAISE EXCEPTION 'Only a platform administrator may change that role.';
    END IF;
    IF OLD.role::TEXT IN ('proprietor', 'it_admin')
   AND COALESCE(v_actor_role, '') NOT IN ('proprietor', 'super_admin') THEN
      RAISE EXCEPTION 'Only the Proprietor may change that role.';
    END IF;
  END IF;

  -- ── The ladder, for whichever role is being granted ──────────────────────

  -- Creating a student or parent login is not an escalation — those hold less
  -- than anyone able to create them — and it happens all over the school:
  -- bulk_student_import, accept_student_application and enroll_student_after_
  -- payment all insert a users row as part of admissions. Without this, a
  -- Registrar importing a class would be refused by the ladder below and the
  -- whole intake pipeline would stop.
  --
  -- Placed after the OLD.role guards above, so demoting an IT Admin or a
  -- Proprietor to 'student' still needs the standing to touch that role.
  IF v_target IN ('student', 'parent')
 AND COALESCE(v_actor_role, '') NOT IN ('', 'student', 'parent') THEN
    RETURN NEW;
  END IF;

  IF COALESCE(v_actor_role, '') = 'super_admin' THEN
    RETURN NEW;
  END IF;

  IF v_target = 'super_admin' THEN
    RAISE EXCEPTION 'Only a platform administrator may grant that role.';
  END IF;

  IF COALESCE(v_actor_role, '') = 'proprietor' THEN
    RETURN NEW;
  END IF;

  -- An IT Admin runs the school's accounts but does not decide who else holds
  -- power in it. New IT Admins and Proprietors come from the Proprietor.
  IF COALESCE(v_actor_role, '') = 'it_admin' THEN
    IF v_target IN ('proprietor', 'it_admin') THEN
      RAISE EXCEPTION 'Only the Proprietor may grant that role.';
    END IF;
    RETURN NEW;
  END IF;

  IF COALESCE(v_actor_role, '') IN ('principal', 'admin_staff') THEN
    IF v_target IN ('proprietor', 'it_admin') THEN
      RAISE EXCEPTION 'Only IT Admin or the Proprietor may grant that role.';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'You are not permitted to set user roles.';
END;
$$;

-- INSERT as well as UPDATE. 217 covered only UPDATE, which left creating a
-- user as the unguarded way to the same place.
DROP TRIGGER IF EXISTS users_guard_role_changes ON users;
CREATE TRIGGER users_guard_role_changes
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION guard_user_role_changes();


-- ── 2. The owner is not in the fee-collection loop ──────────────────────────
-- Reading the proofs stays open to leadership and the owner; verifying one is
-- the Bursar's.
DROP POLICY IF EXISTS "bursar_update_school_proofs" ON bank_transfer_proofs;
CREATE POLICY "bursar_update_school_proofs" ON bank_transfer_proofs
  FOR UPDATE TO authenticated
  USING (
    school_id = (SELECT school_id FROM users WHERE auth_id = auth.uid())
    AND (SELECT role FROM users WHERE auth_id = auth.uid())
        IN ('bursar', 'admin_staff')
  );

NOTIFY pgrst, 'reload schema';
