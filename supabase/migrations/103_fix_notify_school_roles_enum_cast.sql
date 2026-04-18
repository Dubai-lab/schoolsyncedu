-- Migration 103: Fix notify_school_roles() — cast user_role enum to TEXT
--
-- Root cause of 42883 "operator does not exist: user_role = text":
-- notify_school_roles() does:  u.role = ANY(p_roles)
-- u.role is user_role enum; p_roles is TEXT[] — PostgreSQL has no implicit
-- cast from user_role to text for the = ANY() operator → 42883.
--
-- This function is called by trg_grade_submitted_notify() which fires on
-- EVERY UPDATE OF status ON grades — so submitting grades always crashed.
--
-- Fix: add ::TEXT cast → u.role::TEXT = ANY(p_roles), TEXT = TEXT, works.

CREATE OR REPLACE FUNCTION notify_school_roles(
  p_school_id  UUID,
  p_roles      TEXT[],
  p_type       TEXT,
  p_title      TEXT,
  p_body       TEXT        DEFAULT NULL,
  p_action_url TEXT        DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO user_notifications (user_id, school_id, type, title, body, action_url)
  SELECT u.id, p_school_id, p_type, p_title, p_body, p_action_url
  FROM   users u
  WHERE  u.school_id   = p_school_id
    AND  u.role::TEXT  = ANY(p_roles)
    AND  u.is_active   = TRUE;
END;
$$;

NOTIFY pgrst, 'reload schema';
