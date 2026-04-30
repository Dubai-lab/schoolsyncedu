-- ============================================================
-- Migration 092: Wire audit trail — triggers + safe insert RPC
--
-- SAFETY RULES applied throughout:
--   1. log_user_action() is SECURITY DEFINER → bypasses RLS for INSERT
--      so no INSERT policy is needed (and no risk of policy changes
--      accidentally blocking logging).
--   2. Every trigger function has EXCEPTION WHEN OTHERS THEN RETURN NEW
--      so a logging failure NEVER rolls back the real operation.
--   3. NO trigger on the schools table → registration path untouched.
--   4. school_id in every audit row comes from the row being changed,
--      never from the calling user — guarantees each school only ever
--      sees its own data.
--   5. Proprietor INSERT on users (fired during register_school) is
--      silently skipped so registration is completely unaffected.
-- ============================================================

-- ── 1. Upgrade log_user_action to SECURITY DEFINER ────────────────────────────
--    Previous version was SECURITY INVOKER and had no error guard.
--    This version never throws — callers (triggers) are always safe.

CREATE OR REPLACE FUNCTION public.log_user_action(
  p_school_id   UUID,
  p_user_id     UUID,
  p_action      audit_action,
  p_entity_type TEXT,
  p_entity_id   VARCHAR,
  p_description TEXT,
  p_metadata    JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id UUID := gen_random_uuid();
BEGIN
  INSERT INTO audit_logs (
    id, school_id, user_id, action,
    entity_type, entity_id, description, metadata, created_at
  ) VALUES (
    v_id, p_school_id, p_user_id, p_action,
    p_entity_type, p_entity_id, p_description, p_metadata, NOW()
  );
  RETURN v_id;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;  -- Never crash the caller
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_user_action(UUID,UUID,audit_action,TEXT,VARCHAR,TEXT,JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_user_action(UUID,UUID,audit_action,TEXT,VARCHAR,TEXT,JSONB) TO service_role;

-- ── 2. Helper: resolve auth.uid() → users.id ──────────────────────────────────
--    Returns NULL (not an error) when called outside a user session
--    (e.g. cron jobs, service role operations).

CREATE OR REPLACE FUNCTION public.audit_actor_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id UUID;
BEGIN
  SELECT id INTO v_id FROM users WHERE auth_id = auth.uid() LIMIT 1;
  RETURN v_id;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.audit_actor_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.audit_actor_id() TO service_role;

-- ── 3. Trigger: students ───────────────────────────────────────────────────────
--    Logs: enrolment, status changes, profile updates, withdrawals/deletions.

CREATE OR REPLACE FUNCTION public.trg_audit_students()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor  UUID;
  v_action audit_action;
  v_desc   TEXT;
BEGIN
  v_actor := audit_actor_id();

  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_desc   := 'Student enrolled: ' || NEW.first_name || ' ' || NEW.last_name
                || ' (' || NEW.registration_number || ')';
    PERFORM log_user_action(NEW.school_id, v_actor, v_action, 'student', NEW.id::TEXT, v_desc, NULL);

  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_desc := 'Student status changed to "' || NEW.status || '": '
                || NEW.first_name || ' ' || NEW.last_name;
    ELSE
      v_desc := 'Student profile updated: ' || NEW.first_name || ' ' || NEW.last_name;
    END IF;
    PERFORM log_user_action(NEW.school_id, v_actor, v_action, 'student', NEW.id::TEXT, v_desc, NULL);

  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_desc   := 'Student record removed: ' || OLD.first_name || ' ' || OLD.last_name
                || ' (' || OLD.registration_number || ')';
    PERFORM log_user_action(OLD.school_id, v_actor, v_action, 'student', OLD.id::TEXT, v_desc, NULL);
  END IF;

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RETURN COALESCE(NEW, OLD);  -- Logging failure must never block student ops
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_students ON students;
CREATE TRIGGER trg_audit_students
  AFTER INSERT OR UPDATE OR DELETE ON students
  FOR EACH ROW EXECUTE FUNCTION trg_audit_students();

-- ── 4. Trigger: users (staff only) ────────────────────────────────────────────
--    Logs: new staff accounts, role changes, account activate/deactivate.
--    SKIPS: proprietor inserts (fired during register_school — we never
--           want a registration glitch to surface as an audit issue).

CREATE OR REPLACE FUNCTION public.trg_audit_staff()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID;
  v_desc  TEXT;
BEGIN
  -- Skip super_admin (no school_id) and proprietor inserts (registration path)
  IF NEW IS NOT NULL AND NEW.school_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' AND NEW.role = 'proprietor'::user_role THEN RETURN NEW; END IF;

  v_actor := audit_actor_id();

  IF TG_OP = 'INSERT' THEN
    v_desc := INITCAP(REPLACE(NEW.role::TEXT, '_', ' '))
              || ' account created: ' || NEW.full_name || ' (' || NEW.email || ')';
    PERFORM log_user_action(NEW.school_id, v_actor, 'create', 'staff', NEW.id::TEXT, v_desc, NULL);

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.role IS DISTINCT FROM NEW.role THEN
      v_desc := 'Staff role changed: ' || NEW.full_name
                || ' — ' || OLD.role::TEXT || ' → ' || NEW.role::TEXT;
      PERFORM log_user_action(NEW.school_id, v_actor, 'update', 'staff', NEW.id::TEXT, v_desc, NULL);

    ELSIF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
      v_desc := CASE WHEN NEW.is_active
                  THEN 'Staff account activated: '
                  ELSE 'Staff account deactivated: '
                END || NEW.full_name;
      PERFORM log_user_action(NEW.school_id, v_actor, 'update', 'staff', NEW.id::TEXT, v_desc, NULL);
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_staff ON users;
CREATE TRIGGER trg_audit_staff
  AFTER INSERT OR UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION trg_audit_staff();

-- ── 5. Trigger: payments ───────────────────────────────────────────────────────
--    Logs: every fee payment recorded against a student.

CREATE OR REPLACE FUNCTION public.trg_audit_payments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID;
  v_desc  TEXT;
BEGIN
  v_actor := audit_actor_id();
  v_desc  := 'Payment recorded: $' || COALESCE(NEW.amount_usd::TEXT, '0')
             || CASE WHEN NEW.amount_lrd IS NOT NULL AND NEW.amount_lrd > 0
                  THEN ' / L$' || NEW.amount_lrd::TEXT ELSE '' END
             || ' — status: ' || COALESCE(NEW.status, 'unknown');
  PERFORM log_user_action(NEW.school_id, v_actor, 'create', 'payment', NEW.id::TEXT, v_desc, NULL);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_payments ON payments;
CREATE TRIGGER trg_audit_payments
  AFTER INSERT ON payments
  FOR EACH ROW EXECUTE FUNCTION trg_audit_payments();

-- ── 6. Confirm RLS SELECT policy is correct ────────────────────────────────────
--    Each school can only SELECT rows where school_id matches their own.
--    This is the final guarantee that School A never sees School B's logs.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'audit_logs' AND policyname = 'audit_logs_select'
  ) THEN
    CREATE POLICY audit_logs_select ON audit_logs
      FOR SELECT USING (
        (school_id = (SELECT school_id FROM users WHERE auth_id = auth.uid() LIMIT 1)
         AND (SELECT role FROM users WHERE auth_id = auth.uid() LIMIT 1)
             IN ('principal'::user_role, 'proprietor'::user_role, 'it_admin'::user_role))
        OR (SELECT role FROM users WHERE auth_id = auth.uid() LIMIT 1) = 'super_admin'::user_role
      );
  END IF;
END;
$$;
