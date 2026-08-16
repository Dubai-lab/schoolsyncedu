-- ============================================================
-- Migration 212: Activation requests during registration
--
-- submit_activation_request (migration 208) resolves the school from
-- auth.uid(). That works inside the dashboard, but the registration flow
-- reaches the payment step through a public URL carrying ?school=&email=, and
-- RegisterSchool uses supabase.auth.signUp — which does not establish a
-- session when email confirmation is on.
--
-- So a school registering for the first time — exactly the case where nobody
-- can pay yet — hit "Not signed in." and could go no further. The form I put
-- on that page could never have worked.
--
-- This adds a public variant taking the school id explicitly. Same table, same
-- reference series, same one-open-request rule, so a registering school and a
-- suspended one appear identically in the queue.
--
-- On accepting anonymous writes: the request contains only what the submitter
-- typed plus a school id already present in the URL they were sent. It grants
-- nothing and reveals nothing — a wrong id produces a request for a school
-- that will not recognise it. The one-open-request rule doubles as the flood
-- guard, since a second submission returns the existing reference rather than
-- inserting.
-- ============================================================

CREATE OR REPLACE FUNCTION submit_activation_request_public(
  p_school_id        UUID,
  p_contact_name     TEXT,
  p_contact_email    TEXT,
  p_plan_id          UUID DEFAULT NULL,
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
  v_school RECORD;
  v_open   RECORD;
  v_ref    TEXT;
BEGIN
  IF p_school_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Missing school.');
  END IF;

  SELECT id, name, school_code INTO v_school FROM schools WHERE id = p_school_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'We could not find that school.');
  END IF;

  IF p_contact_email IS NULL OR p_contact_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Enter a valid email address.');
  END IF;

  -- Same rule as the authenticated version: return the existing reference
  -- rather than stacking duplicates when someone submits twice.
  SELECT reference INTO v_open
  FROM   activation_requests
  WHERE  school_id = p_school_id
    AND  status IN ('pending', 'contacted')
  ORDER  BY created_at DESC
  LIMIT  1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true, 'reference', v_open.reference, 'existing', true,
      'message', 'You already have a request open.');
  END IF;

  v_ref := 'A-' || nextval('activation_reference_seq')::TEXT;

  INSERT INTO activation_requests (
    school_id, plan_id, requested_by, contact_name, contact_email,
    contact_phone, preferred_method, note, reference
  ) VALUES (
    p_school_id, p_plan_id, NULL,
    left(btrim(COALESCE(p_contact_name, '')), 200),
    lower(btrim(p_contact_email)),
    left(btrim(COALESCE(p_contact_phone, '')), 50),
    p_preferred_method,
    left(btrim(COALESCE(p_note, '')), 2000),
    v_ref
  );

  INSERT INTO notification_logs (school_id, event_type, recipient_email, metadata)
  VALUES (
    p_school_id, 'activation_request', lower(btrim(p_contact_email)),
    jsonb_build_object(
      'reference',   v_ref,
      'school_name', v_school.name,
      'school_code', v_school.school_code,
      'method',      p_preferred_method,
      'source',      'registration')
  );

  RETURN jsonb_build_object('ok', true, 'reference', v_ref, 'existing', false);
END;
$$;

GRANT EXECUTE ON FUNCTION submit_activation_request_public(UUID, TEXT, TEXT, UUID, TEXT, TEXT, TEXT)
  TO anon, authenticated;


-- ============================================================
-- Public status lookup, so a school returning to the payment link sees its
-- reference instead of an empty form. Keyed on school id, and returns only the
-- reference and status — nothing that was not already known to whoever
-- submitted it.
-- ============================================================

CREATE OR REPLACE FUNCTION activation_request_status(p_school_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_req RECORD;
BEGIN
  SELECT reference, status INTO v_req
  FROM   activation_requests
  WHERE  school_id = p_school_id
    AND  status IN ('pending', 'contacted')
  ORDER  BY created_at DESC
  LIMIT  1;

  IF NOT FOUND THEN RETURN jsonb_build_object('found', false); END IF;

  RETURN jsonb_build_object('found', true, 'reference', v_req.reference, 'status', v_req.status);
END;
$$;

GRANT EXECUTE ON FUNCTION activation_request_status(UUID) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';


-- ============================================================
-- VERIFICATION
--
--   -- Signed out entirely:
--   SELECT submit_activation_request_public(
--     '<school id>', 'Test Owner', 'owner@example.com');
--   SELECT activation_request_status('<school id>');
--
--   -- Both should succeed, and the request should appear in the super admin
--   -- queue exactly like one raised from inside the dashboard.
-- ============================================================
