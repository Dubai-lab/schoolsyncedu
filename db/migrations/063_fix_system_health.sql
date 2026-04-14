-- Migration 063: Fix System Health page
--
-- Fixes two bugs:
--
-- 1. DB triggers in migration 057 inserted with lowercase log_level values
--    ('info', 'warn') but the enum is defined as uppercase ('INFO', 'WARN').
--    PostgreSQL enum casting is case-sensitive → the triggers threw errors on
--    every school INSERT/UPDATE and subscription UPDATE, silently preventing
--    log entries (and potentially blocking the parent transaction).
--    Fix: recreate all four trigger functions with the correct uppercase values.
--
-- 2. platform_admin_users is a standalone table with no data — super admins
--    live in the users table (role = 'super_admin').  The UI queries
--    platform_admin_users and always gets zero rows.
--    Fix: replace the table with a VIEW over users so the Platform Admins
--    section shows the real super admin accounts without any sync logic.

-- ── 1. Fix trigger functions — use uppercase enum values ──────────────────────

CREATE OR REPLACE FUNCTION log_system_event(
  p_level    TEXT,
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
  VALUES (UPPER(p_level)::log_level, p_module, p_message, p_metadata);
END;
$$;

GRANT EXECUTE ON FUNCTION log_system_event(TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION log_system_event(TEXT, TEXT, TEXT, JSONB) TO service_role;

-- School online/offline trigger
CREATE OR REPLACE FUNCTION trg_school_status_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_online IS DISTINCT FROM OLD.is_online THEN
    INSERT INTO system_logs (log_level, module, message, metadata)
    VALUES (
      CASE WHEN NEW.is_online THEN 'INFO'::log_level ELSE 'WARN'::log_level END,
      'schools',
      CASE WHEN NEW.is_online
        THEN 'School reactivated: ' || NEW.name
        ELSE 'School suspended: '   || NEW.name
      END,
      jsonb_build_object('school_id', NEW.id, 'slug', NEW.slug, 'is_online', NEW.is_online)
    );
  END IF;
  RETURN NEW;
END;
$$;

-- School created trigger
CREATE OR REPLACE FUNCTION trg_school_created_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO system_logs (log_level, module, message, metadata)
  VALUES (
    'INFO'::log_level,
    'schools',
    'New school registered: ' || NEW.name,
    jsonb_build_object('school_id', NEW.id, 'slug', NEW.slug)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never let a logging failure block the parent INSERT
  RETURN NEW;
END;
$$;

-- Subscription change trigger
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
      'INFO'::log_level,
      'subscriptions',
      'Subscription updated for school_id: ' || NEW.school_id::TEXT,
      jsonb_build_object(
        'school_id',  NEW.school_id,
        'old_plan',   OLD.plan_id,
        'new_plan',   NEW.plan_id,
        'old_status', OLD.status,
        'new_status', NEW.status
      )
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

-- ── 2. Fix platform_admin_users — replace table with a view over users ─────────
--
-- Drop the empty standalone table and replace it with a view that surfaces
-- every user with role = 'super_admin'.  The view columns match exactly what
-- getPlatformAdmins() expects: id, email, name, role, is_active, last_login.

DROP TABLE IF EXISTS platform_admin_users CASCADE;

CREATE OR REPLACE VIEW platform_admin_users AS
SELECT
  u.id,
  u.email,
  COALESCE(u.full_name, u.first_name || ' ' || u.last_name) AS name,
  u.role::TEXT                                               AS role,
  u.is_active,
  u.last_login,
  u.created_at
FROM users u
WHERE u.role = 'super_admin';

-- Super admins can read this view (RLS does not apply to views in the same
-- way, but restrict via the underlying users RLS which already allows
-- super_admin to read all users).
GRANT SELECT ON platform_admin_users TO authenticated;

NOTIFY pgrst, 'reload schema';
