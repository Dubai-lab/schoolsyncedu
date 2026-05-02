-- 098_subdomain_addon.sql
-- Branded subdomain add-on ($1/month) for schools that want a clean URL like
-- newcovenant.schoolsyncedu.com instead of schoolsyncedu.com/school/newcovenant

-- ── Schema ─────────────────────────────────────────────────────────────────────

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS subdomain             text    UNIQUE,
  ADD COLUMN IF NOT EXISTS subdomain_active      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subdomain_paid_until  timestamptz;

-- Only lowercase letters, numbers, and hyphens; 3–30 chars; must start/end with
-- an alphanumeric character (e.g. "newcovenant", "st-josephs", "sdahs").
ALTER TABLE schools
  DROP CONSTRAINT IF EXISTS schools_subdomain_format;

ALTER TABLE schools
  ADD CONSTRAINT schools_subdomain_format
  CHECK (
    subdomain IS NULL
    OR (length(subdomain) BETWEEN 3 AND 30
        AND subdomain ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$')
  );

-- ── RPCs ───────────────────────────────────────────────────────────────────────

-- Called after a successful $1 Stripe payment to activate/renew the subdomain.
-- If the school already has an active subdomain, this extends paid_until by 30 days.
CREATE OR REPLACE FUNCTION activate_subdomain_addon(
  p_school_id   uuid,
  p_subdomain   text,
  p_gateway_ref text,
  p_tx_ref      text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub      text;
  v_conflict uuid;
BEGIN
  v_sub := lower(trim(p_subdomain));

  -- Format validation
  IF length(v_sub) NOT BETWEEN 3 AND 30 OR NOT (v_sub ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'Invalid subdomain. Use 3–30 lowercase letters, numbers, or hyphens. Must start and end with a letter or number.'
    );
  END IF;

  -- Uniqueness check (another school already owns this subdomain)
  SELECT id INTO v_conflict
  FROM schools
  WHERE subdomain = v_sub AND id <> p_school_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'This subdomain is already taken. Please choose a different name.'
    );
  END IF;

  -- Activate or renew
  UPDATE schools
  SET
    subdomain            = v_sub,
    subdomain_active     = true,
    subdomain_paid_until = CASE
      WHEN subdomain_paid_until IS NOT NULL AND subdomain_paid_until > now()
        THEN subdomain_paid_until + interval '30 days'
      ELSE now() + interval '30 days'
    END
  WHERE id = p_school_id;

  RETURN jsonb_build_object(
    'success',    true,
    'subdomain',  v_sub,
    'paid_until', (
      SELECT subdomain_paid_until::text FROM schools WHERE id = p_school_id
    )
  );
END;
$$;

-- Called when the school wants to revert to their default /school/slug URL.
-- Keeps the subdomain name reserved (so nobody else can take it) but stops routing.
CREATE OR REPLACE FUNCTION deactivate_subdomain_addon(p_school_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE schools
  SET subdomain_active = false
  WHERE id = p_school_id;
END;
$$;

-- ── Grants ─────────────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION activate_subdomain_addon(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION deactivate_subdomain_addon(uuid)                  TO authenticated;
