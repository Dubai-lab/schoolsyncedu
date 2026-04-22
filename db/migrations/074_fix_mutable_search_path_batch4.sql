-- Migration 074: Fix mutable search_path warnings — batch 4
-- Adds SET search_path = public to 3 functions flagged by Supabase Advisor.

CREATE OR REPLACE FUNCTION public.notify_school_roles(
  p_school_id  UUID,
  p_roles      TEXT[],
  p_type       TEXT,
  p_title      TEXT,
  p_body       TEXT        DEFAULT NULL,
  p_action_url TEXT        DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_notifications (user_id, school_id, type, title, body, action_url)
  SELECT u.id, p_school_id, p_type, p_title, p_body, p_action_url
  FROM   users u
  WHERE  u.school_id   = p_school_id
    AND  u.role::TEXT  = ANY(p_roles)
    AND  u.is_active   = TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_user_action(
  p_school_id   UUID,
  p_user_id     UUID,
  p_action      audit_action,
  p_entity_type TEXT,
  p_entity_id   VARCHAR,
  p_description TEXT,
  p_metadata    JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  v_id := gen_random_uuid();
  INSERT INTO audit_logs (
    id, school_id, user_id, action, entity_type, entity_id, description, metadata, created_at
  ) VALUES (
    v_id, p_school_id, p_user_id, p_action, p_entity_type, p_entity_id, p_description, p_metadata, NOW()
  );
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_student_gpa(student_id UUID, academic_year VARCHAR)
RETURNS DECIMAL
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT AVG(CAST(gpa_points AS DECIMAL))
  FROM   grades
  WHERE  student_id    = $1
    AND  academic_year = $2
    AND  gpa_points IS NOT NULL;
$$;

NOTIFY pgrst, 'reload schema';
