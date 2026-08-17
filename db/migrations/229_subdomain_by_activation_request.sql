-- ============================================================
-- Migration 229: The subdomain add-on is paid for the way everything else is
--
-- ── THE HOLE ────────────────────────────────────────────────────────────────
--
--   SubdomainAddonCard confirms a Stripe card in the browser and then calls
--   activate_subdomain_addon to switch the subdomain on. That function is
--   SECURITY DEFINER, has no caller check of any kind, and is granted to
--   `authenticated`.
--
--   So the card is decoration. Any signed-in user can call the RPC directly
--   with a school id and a subdomain and get the add-on for nothing. And with
--   no Stripe account operating in Liberia there is not even a charge anywhere
--   to reconcile against — the same shape as the student fee hole in 218, the
--   application fee in 219 and the subscription in 225.
--
-- ── THE SHAPE THAT WORKS ────────────────────────────────────────────────────
--
--   Subscriptions already run on request-then-activate: the school asks, the
--   platform owner is paid however Liberian schools actually pay, and only
--   then does anyone switch anything on. The subdomain becomes the same thing,
--   reusing the same table and the same admin screen rather than growing a
--   second queue that has to be watched separately.
--
--   activation_requests was written for subscriptions, so it gains a type and
--   the two fields a subdomain request needs. Existing rows default to
--   'subscription' and behave exactly as before.
--
-- ROLLBACK
--   GRANT EXECUTE ON FUNCTION activate_subdomain_addon(uuid, text, text, text, text, numeric) TO authenticated;
--   ALTER TABLE activation_requests DROP COLUMN request_type, DROP COLUMN subdomain, DROP COLUMN billing_cycle;
--   DROP FUNCTION submit_subdomain_request(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
--   DROP FUNCTION activate_subdomain_from_request(UUID, DECIMAL, TEXT, TEXT);
-- ============================================================

-- ── 1. One queue, two kinds of request ──────────────────────────────────────
ALTER TABLE activation_requests
  ADD COLUMN IF NOT EXISTS request_type  TEXT NOT NULL DEFAULT 'subscription',
  ADD COLUMN IF NOT EXISTS subdomain     TEXT,
  ADD COLUMN IF NOT EXISTS billing_cycle TEXT;

CREATE INDEX IF NOT EXISTS idx_activation_requests_type
  ON activation_requests (request_type, status);


-- ── 2. Off the browser ──────────────────────────────────────────────────────
-- Both signatures: 098 created a four-argument version and 099 replaced it
-- with six, and a database that has only had 098 still carries the first.
DO $$
BEGIN
  BEGIN
    REVOKE EXECUTE ON FUNCTION activate_subdomain_addon(uuid, text, text, text, text, numeric)
      FROM anon, authenticated;
    GRANT EXECUTE ON FUNCTION activate_subdomain_addon(uuid, text, text, text, text, numeric)
      TO service_role;
  EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'skipped: 6-argument activate_subdomain_addon not present';
  END;
  BEGIN
    REVOKE EXECUTE ON FUNCTION activate_subdomain_addon(uuid, text, text, text)
      FROM anon, authenticated;
  EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'skipped: 4-argument activate_subdomain_addon not present';
  END;
END $$;


-- ── 3. A school asks for a subdomain ────────────────────────────────────────
-- Mirrors submit_activation_request, with the subdomain validated at request
-- time rather than at activation. A school that types a name already taken
-- should find out while it is still choosing, not a week later when the owner
-- tries to switch it on.
CREATE OR REPLACE FUNCTION submit_subdomain_request(
  p_subdomain        TEXT,
  p_billing_cycle    TEXT,
  p_contact_name     TEXT,
  p_contact_email    TEXT,
  p_contact_phone    TEXT DEFAULT NULL,
  p_preferred_method TEXT DEFAULT NULL,
  p_note             TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user   RECORD;
  v_school RECORD;
  v_sub    TEXT;
  v_ref    TEXT;
  v_open   RECORD;
BEGIN
  SELECT id, school_id, role::TEXT INTO v_user
  FROM   users WHERE auth_id = auth.uid();

  IF v_user.school_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Not signed in.');
  END IF;

  IF v_user.role NOT IN ('proprietor', 'it_admin') THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Only the Proprietor or IT Admin can request a subdomain.');
  END IF;

  IF p_billing_cycle NOT IN ('monthly', 'yearly') THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Choose monthly or yearly.');
  END IF;

  IF p_contact_email IS NULL OR p_contact_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Enter a valid email address.');
  END IF;

  -- Same rules activate_subdomain_addon applies, checked here so the school
  -- learns now rather than after paying.
  v_sub := lower(trim(p_subdomain));
  IF length(v_sub) NOT BETWEEN 3 AND 30 OR NOT (v_sub ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$') THEN
    RETURN jsonb_build_object('ok', false,
      'message', 'Use 3–30 lowercase letters, numbers or hyphens, starting and ending with a letter or number.');
  END IF;

  IF EXISTS (SELECT 1 FROM schools WHERE subdomain = v_sub AND id <> v_user.school_id) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'That subdomain is already taken. Please choose another.');
  END IF;

  -- Scoped to the type, so a school waiting on its subscription can still ask
  -- for a subdomain. The subscription version is narrowed to match below.
  SELECT id, reference INTO v_open
  FROM   activation_requests
  WHERE  school_id = v_user.school_id
    AND  request_type = 'subdomain'
    AND  status IN ('pending', 'contacted')
  ORDER  BY created_at DESC
  LIMIT  1;

  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'reference', v_open.reference, 'existing', true,
      'message', 'You already have a subdomain request open.');
  END IF;

  SELECT id, name INTO v_school FROM schools WHERE id = v_user.school_id;

  v_ref := 'D-' || nextval('activation_reference_seq')::TEXT;

  INSERT INTO activation_requests (
    school_id, requested_by, contact_name, contact_email, contact_phone,
    preferred_method, note, reference, status,
    request_type, subdomain, billing_cycle
  ) VALUES (
    v_user.school_id, v_user.id, p_contact_name, lower(btrim(p_contact_email)), p_contact_phone,
    p_preferred_method, p_note, v_ref, 'pending',
    'subdomain', v_sub, p_billing_cycle
  );

  -- Same bell as a subscription request. A separate channel would be a second
  -- thing to remember to check.
  INSERT INTO notification_logs (school_id, event_type, recipient_email, metadata)
  VALUES (
    v_user.school_id,
    'activation_request',
    lower(btrim(p_contact_email)),
    jsonb_build_object(
      'reference',   v_ref,
      'school_name', v_school.name,
      'request_type','subdomain',
      'subdomain',   v_sub,
      'cycle',       p_billing_cycle,
      'method',      p_preferred_method
    )
  );

  RETURN jsonb_build_object('ok', true, 'reference', v_ref, 'existing', false,
    'message', 'Request received. We will contact you to arrange payment.');
END;
$$;

GRANT EXECUTE ON FUNCTION submit_subdomain_request(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;


-- ── 4. The platform owner activates it ──────────────────────────────────────
CREATE OR REPLACE FUNCTION activate_subdomain_from_request(
  p_request_id     UUID,
  p_amount_usd     DECIMAL,
  p_payment_method TEXT DEFAULT 'manual',
  p_reference      TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req    RECORD;
  v_result JSONB;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_req FROM activation_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found.');
  END IF;

  IF v_req.request_type <> 'subdomain' THEN
    RETURN jsonb_build_object('success', false, 'error', 'That request is not a subdomain request.');
  END IF;

  IF v_req.status = 'activated' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This request has already been activated.');
  END IF;

  -- The add-on function still owns validation, proration and the payment row.
  -- This is the door in front of it, not a second copy of it.
  v_result := activate_subdomain_addon(
    v_req.school_id,
    v_req.subdomain,
    COALESCE(p_reference, v_req.reference),
    v_req.reference,
    COALESCE(v_req.billing_cycle, 'monthly'),
    p_amount_usd
  );

  IF NOT COALESCE((v_result->>'success')::BOOLEAN, FALSE) THEN
    RETURN v_result;
  END IF;

  UPDATE activation_requests
  SET    status = 'activated', activated_at = NOW()
  WHERE  id = p_request_id;

  RETURN v_result || jsonb_build_object('reference', v_req.reference);
END;
$$;

GRANT EXECUTE ON FUNCTION activate_subdomain_from_request(UUID, DECIMAL, TEXT, TEXT) TO authenticated;


-- ── 5. The subscription request's duplicate check gets the same scoping ─────
-- Without this, a school with an open subdomain request would be told it
-- already has a subscription request open and handed the wrong reference.
CREATE OR REPLACE FUNCTION submit_activation_request(
  p_plan_id          UUID,
  p_contact_name     TEXT,
  p_contact_email    TEXT,
  p_contact_phone    TEXT DEFAULT NULL,
  p_preferred_method TEXT DEFAULT NULL,
  p_note             TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user   RECORD;
  v_school RECORD;
  v_ref    TEXT;
  v_open   RECORD;
BEGIN
  SELECT id, school_id, role::TEXT INTO v_user
  FROM   users WHERE auth_id = auth.uid();

  IF v_user.school_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Not signed in.');
  END IF;

  IF v_user.role NOT IN ('proprietor', 'principal', 'it_admin') THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Only school leadership can request activation.');
  END IF;

  IF p_contact_email IS NULL OR p_contact_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Enter a valid email address.');
  END IF;

  SELECT id, reference INTO v_open
  FROM   activation_requests
  WHERE  school_id = v_user.school_id
    AND  request_type = 'subscription'
    AND  status IN ('pending', 'contacted')
  ORDER  BY created_at DESC
  LIMIT  1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true, 'reference', v_open.reference, 'existing', true,
      'message', 'You already have a request open.');
  END IF;

  SELECT id, name, school_code INTO v_school FROM schools WHERE id = v_user.school_id;

  v_ref := 'A-' || nextval('activation_reference_seq')::TEXT;

  INSERT INTO activation_requests (
    school_id, plan_id, requested_by, contact_name, contact_email, contact_phone,
    preferred_method, note, reference, status, request_type
  ) VALUES (
    v_user.school_id, p_plan_id, v_user.id, p_contact_name, lower(btrim(p_contact_email)),
    p_contact_phone, p_preferred_method, p_note, v_ref, 'pending', 'subscription'
  );

  -- Surface it in the super admin bell, which already reads notification_logs.
  -- Carried over from 208 unchanged: without it the owner stops being told a
  -- school is waiting, which is the whole point of the queue.
  INSERT INTO notification_logs (school_id, event_type, recipient_email, metadata)
  VALUES (
    v_user.school_id,
    'activation_request',
    lower(btrim(p_contact_email)),
    jsonb_build_object(
      'reference',   v_ref,
      'school_name', v_school.name,
      'school_code', v_school.school_code,
      'method',      p_preferred_method
    )
  );

  RETURN jsonb_build_object('ok', true, 'reference', v_ref, 'existing', false);
END;
$$;

GRANT EXECUTE ON FUNCTION submit_activation_request(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
