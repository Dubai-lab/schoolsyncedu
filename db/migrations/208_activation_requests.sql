-- ============================================================
-- Migration 208: Activation requests
--
-- Replaces a mailto: link with something that leaves a trace.
--
-- Today a school that reaches payment sees "Contact Support", which opens a
-- blank email — or opens nothing at all, on any device without a mail client
-- registered. Nothing is recorded on either side: no row saying a school tried
-- to subscribe, no reference the school can quote, no way to answer "how many
-- schools reached payment and gave up".
--
-- This does not replace the manual process. Payment is still arranged
-- out-of-band, which is the right call while no gateway serves Liberia. It
-- makes the process visible: the school gets a reference and a status, and the
-- request appears in a queue instead of an inbox.
-- ============================================================


-- ============================================================
-- 1. TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS activation_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  plan_id          UUID REFERENCES subscription_plans(id) ON DELETE SET NULL,
  requested_by     UUID REFERENCES users(id) ON DELETE SET NULL,

  contact_name     TEXT,
  contact_email    TEXT NOT NULL,
  contact_phone    TEXT,
  -- Free text rather than an enum: which methods are viable will change as
  -- gateways become available, and a CHECK constraint would need a migration
  -- every time. The UI offers a list; this stores whatever was chosen.
  preferred_method TEXT,
  note             TEXT,

  -- Short, human-readable, quotable over the phone. Not the UUID.
  reference        TEXT NOT NULL UNIQUE,

  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'contacted', 'activated', 'declined')),
  handled_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  handled_at       TIMESTAMPTZ,
  handled_note     TEXT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activation_requests_school ON activation_requests(school_id);
-- The queue only ever reads open requests, so index exactly that set.
CREATE INDEX IF NOT EXISTS idx_activation_requests_open
  ON activation_requests(created_at DESC)
  WHERE status IN ('pending', 'contacted');

CREATE SEQUENCE IF NOT EXISTS activation_reference_seq START 1000;


-- ============================================================
-- 2. RLS
--    A school sees its own requests so it can check status. Only super admin
--    sees everything, and only super admin resolves them.
-- ============================================================

ALTER TABLE activation_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activation_own_select ON activation_requests;
CREATE POLICY activation_own_select ON activation_requests
  FOR SELECT USING (
    school_id IN (SELECT school_id FROM users WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS activation_admin_all ON activation_requests;
CREATE POLICY activation_admin_all ON activation_requests
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
  );


-- ============================================================
-- 3. SUBMIT
-- ============================================================

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

  -- One open request per school. A second submission returns the existing
  -- reference rather than creating a duplicate — schools click twice when
  -- nothing appears to happen, and a queue full of duplicates is worse than
  -- the inbox this replaces.
  SELECT id, reference INTO v_open
  FROM   activation_requests
  WHERE  school_id = v_user.school_id
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
    school_id, plan_id, requested_by, contact_name, contact_email,
    contact_phone, preferred_method, note, reference
  ) VALUES (
    v_user.school_id, p_plan_id, v_user.id, p_contact_name, lower(btrim(p_contact_email)),
    p_contact_phone, p_preferred_method, p_note, v_ref
  );

  -- Surface it in the super admin bell, which already reads notification_logs.
  -- No new delivery mechanism, and it cannot land in a spam folder.
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


-- ============================================================
-- 4. THE SCHOOL'S OWN OPEN REQUEST
--    So the page can show "Request received — reference A-1042" instead of
--    offering the form again to someone who already submitted.
-- ============================================================

CREATE OR REPLACE FUNCTION my_activation_request()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_school UUID;
  v_req    RECORD;
BEGIN
  SELECT school_id INTO v_school FROM users WHERE auth_id = auth.uid();
  IF v_school IS NULL THEN RETURN jsonb_build_object('found', false); END IF;

  SELECT reference, status, created_at INTO v_req
  FROM   activation_requests
  WHERE  school_id = v_school
    AND  status IN ('pending', 'contacted')
  ORDER  BY created_at DESC
  LIMIT  1;

  IF NOT FOUND THEN RETURN jsonb_build_object('found', false); END IF;

  RETURN jsonb_build_object(
    'found', true,
    'reference', v_req.reference,
    'status', v_req.status,
    'created_at', v_req.created_at);
END;
$$;

GRANT EXECUTE ON FUNCTION my_activation_request() TO authenticated;


-- ============================================================
-- 5. RESOLVE (super admin)
--    Records who acted and when. Activating the subscription itself stays a
--    separate, deliberate step — this marks the request handled rather than
--    silently mutating billing as a side effect.
-- ============================================================

CREATE OR REPLACE FUNCTION resolve_activation_request(
  p_id     UUID,
  p_status TEXT,
  p_note   TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin UUID;
BEGIN
  SELECT id INTO v_admin
  FROM   users WHERE auth_id = auth.uid() AND role = 'super_admin';

  IF v_admin IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Not permitted.');
  END IF;

  IF p_status NOT IN ('pending', 'contacted', 'activated', 'declined') THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Unknown status.');
  END IF;

  UPDATE activation_requests
  SET    status       = p_status,
         handled_by   = v_admin,
         handled_at   = now(),
         handled_note = COALESCE(p_note, handled_note)
  WHERE  id = p_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Request not found.');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION resolve_activation_request(UUID, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';


-- ============================================================
-- 6. VERIFICATION
--
--   -- As a proprietor:
--   SELECT submit_activation_request(NULL, 'Emmanuel', 'you@example.com',
--                                    '0770000000', 'mtn_momo', 'Testing');
--   SELECT my_activation_request();
--
--   -- As super admin — the queue, and the bell entry:
--   SELECT reference, status, contact_email FROM activation_requests
--   ORDER BY created_at DESC;
--   SELECT event_type, metadata FROM notification_logs
--   WHERE event_type = 'activation_request' ORDER BY sent_at DESC LIMIT 3;
-- ============================================================
