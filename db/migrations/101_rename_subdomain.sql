-- 101_rename_subdomain.sql
-- Allows a school to rename their subdomain without paying again,
-- as long as the subscription is still active or paused (paid_until > now()).

CREATE OR REPLACE FUNCTION rename_subdomain_addon(
  p_school_id     uuid,
  p_new_subdomain text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_sub    text;
  v_conflict   uuid;
  v_paid_until timestamptz;
BEGIN
  v_new_sub := lower(trim(p_new_subdomain));

  -- Format validation (same rules as activation)
  IF length(v_new_sub) NOT BETWEEN 3 AND 30
     OR NOT (v_new_sub ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'Invalid subdomain. Use 3–30 lowercase letters, numbers, or hyphens. Must start and end with a letter or number.'
    );
  END IF;

  -- School must have paid time remaining (active or paused)
  SELECT subdomain_paid_until INTO v_paid_until FROM schools WHERE id = p_school_id;

  IF v_paid_until IS NULL OR v_paid_until <= now() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'Your subdomain subscription has expired. Renew first to rename.'
    );
  END IF;

  -- Uniqueness check against all other schools
  SELECT id INTO v_conflict
  FROM schools
  WHERE subdomain = v_new_sub AND id <> p_school_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'This subdomain is already taken. Please choose a different name.'
    );
  END IF;

  -- Rename only — paid_until and subdomain_active stay untouched
  UPDATE schools SET subdomain = v_new_sub WHERE id = p_school_id;

  RETURN jsonb_build_object('success', true, 'subdomain', v_new_sub);
END;
$$;

GRANT EXECUTE ON FUNCTION rename_subdomain_addon(uuid, text) TO authenticated;
