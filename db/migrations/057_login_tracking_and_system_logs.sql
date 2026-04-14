-- Migration 057: Login tracking + system event logging
-- Fixes:
--   1. record_login()     — updates users.last_login for the current user (called by client on sign-in)
--   2. log_system_event() — inserts into system_logs (called by client for key admin actions)
--   3. Trigger: auto-log school suspensions / reactivations to system_logs

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. record_login — SECURITY DEFINER so it always succeeds for any auth user
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION record_login()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE users
  SET    last_login = NOW()
  WHERE  auth_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION record_login() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. log_system_event — insert a row into system_logs
--    Only callable by authenticated users (super_admin checked by caller)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION log_system_event(
  p_level    TEXT,          -- 'info' | 'warn' | 'error' | 'debug'
  p_module   TEXT,
  p_message  TEXT,
  p_metadata JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO system_logs (log_level, module, message, metadata)
  VALUES (p_level::log_level, p_module, p_message, p_metadata);
END;
$$;

GRANT EXECUTE ON FUNCTION log_system_event(TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION log_system_event(TEXT, TEXT, TEXT, JSONB) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Auto-log school status changes (suspend / reactivate) to system_logs
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_school_status_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    INSERT INTO system_logs (log_level, module, message, metadata)
    VALUES (
      CASE WHEN NEW.is_active THEN 'info'::log_level ELSE 'warn'::log_level END,
      'schools',
      CASE WHEN NEW.is_active
        THEN 'School reactivated: ' || NEW.name
        ELSE 'School suspended: '   || NEW.name
      END,
      jsonb_build_object('school_id', NEW.id, 'slug', NEW.slug, 'is_active', NEW.is_active)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_school_status_log ON schools;
CREATE TRIGGER trg_school_status_log
  AFTER UPDATE OF is_active ON schools
  FOR EACH ROW
  EXECUTE FUNCTION trg_school_status_log();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Auto-log new school registrations
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_school_created_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO system_logs (log_level, module, message, metadata)
  VALUES (
    'info'::log_level,
    'schools',
    'New school registered: ' || NEW.name,
    jsonb_build_object('school_id', NEW.id, 'slug', NEW.slug, 'plan_id', NEW.plan_id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_school_created_log ON schools;
CREATE TRIGGER trg_school_created_log
  AFTER INSERT ON schools
  FOR EACH ROW
  EXECUTE FUNCTION trg_school_created_log();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Auto-log subscription plan changes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_subscription_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.plan_id IS DISTINCT FROM OLD.plan_id OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO system_logs (log_level, module, message, metadata)
    VALUES (
      'info'::log_level,
      'subscriptions',
      'Subscription updated for school_id: ' || NEW.school_id::TEXT,
      jsonb_build_object(
        'school_id', NEW.school_id,
        'old_plan',  OLD.plan_id,
        'new_plan',  NEW.plan_id,
        'old_status', OLD.status,
        'new_status', NEW.status
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_subscription_log ON school_subscriptions;
CREATE TRIGGER trg_subscription_log
  AFTER UPDATE ON school_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION trg_subscription_log();
