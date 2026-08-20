-- Migration 235: subdomain activation wrote a column that does not exist
--
-- Activating a subdomain request failed with:
--   42703  column "activated_at" of relation "activation_requests" does not exist
--
-- activation_requests has never had activated_at. It records who dealt with a
-- request in handled_by / handled_at / handled_note, which is what the
-- subscription path in 210 has always used. The subdomain path added in 229
-- invented a different name for the same idea and nothing caught it, because
-- the failure only happens on the one line that runs after a successful
-- activation.
--
-- Order matters in what that means for the data. The UPDATE is the last
-- statement in the function, after activate_subdomain_addon has already
-- turned the subdomain on and written the payment row. So a school whose
-- activation "failed" with this error may have had its subdomain activated
-- anyway, while its request stayed on 'pending'. See the query at the foot of
-- this file before re-activating anything.
--
-- Also fills in handled_by and handled_note, which 229 left unset. The
-- subscription path records both, and an audit trail that depends on which
-- kind of request it was is not an audit trail.

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
  v_admin  UUID;
  v_ref    TEXT;
  v_result JSONB;
BEGIN
  IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT id INTO v_admin FROM users WHERE auth_id = auth.uid();

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

  v_ref := COALESCE(NULLIF(btrim(p_reference), ''), 'Manual activation ' || v_req.reference);

  UPDATE activation_requests
  SET    status       = 'activated',
         handled_by   = v_admin,
         handled_at   = now(),
         handled_note = COALESCE(handled_note, '') ||
                        CASE WHEN handled_note IS NULL OR handled_note = '' THEN '' ELSE E'\n' END ||
                        'Subdomain activated: ' || v_ref
  WHERE  id = p_request_id;

  RETURN v_result || jsonb_build_object('reference', v_req.reference);
END;
$$;

GRANT EXECUTE ON FUNCTION activate_subdomain_from_request(UUID, DECIMAL, TEXT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Before re-activating: check whether it half-succeeded
--
-- The failing line ran after the subdomain had already been switched on, so a
-- request may be live on the school while still reading 'pending' here.
--
--   SELECT ar.reference, ar.status, ar.subdomain,
--          s.name, s.subdomain AS school_subdomain,
--          s.subdomain_active, s.subdomain_paid_until
--   FROM   activation_requests ar
--   JOIN   schools s ON s.id = ar.school_id
--   WHERE  ar.request_type = 'subdomain'
--   ORDER  BY ar.created_at DESC;
--
-- If subdomain_active is already true for a request still showing 'pending',
-- the activation went through and only the bookkeeping failed. Close it by
-- hand rather than pressing Activate again, which would charge and extend a
-- second time:
--
--   UPDATE activation_requests
--   SET    status = 'activated', handled_at = now(),
--          handled_note = 'Closed by hand after the 42703 failure in 229'
--   WHERE  reference = '<the reference>';
-- ---------------------------------------------------------------------------
