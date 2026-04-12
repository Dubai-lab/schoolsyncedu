-- ============================================================
-- Migration 038: Re-create letter RPCs with correct enum casts
--
-- Why: The `status` column on letter_instances is the enum type
-- `letter_instance_status`, not TEXT. Assigning a TEXT parameter
-- directly to the column raises:
--   "column 'status' is of type letter_instance_status but
--    expression is of type text"
--
-- Fix: Explicit ::letter_instance_status casts throughout.
-- Also DROPs any old signature before recreating (avoids the
-- CREATE OR REPLACE signature-lock restriction).
-- ============================================================

-- ── Drop all existing overloads ───────────────────────────────────────────────

DROP FUNCTION IF EXISTS create_letter_instance(UUID,UUID,UUID,TEXT,JSONB,JSONB,UUID,TEXT,TEXT);
DROP FUNCTION IF EXISTS update_letter_status(UUID,TEXT);
DROP FUNCTION IF EXISTS update_letter_status(UUID,TEXT,UUID);
DROP FUNCTION IF EXISTS record_letter_approval(UUID,UUID,TEXT,TEXT);

-- ── 0. Add missing columns ─────────────────────────────────────────────────────

ALTER TABLE letter_instances
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- ── 1. create_letter_instance ──────────────────────────────────────────────────

CREATE FUNCTION create_letter_instance(
  p_school_id        UUID,
  p_template_id      UUID,
  p_student_id       UUID,
  p_recipient_type   TEXT,
  p_recipient_data   JSONB,
  p_channels         JSONB,
  p_created_by       UUID,
  p_rendered_html    TEXT,
  p_reference_number TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row letter_instances%ROWTYPE;
BEGIN
  SET LOCAL row_security = OFF;

  INSERT INTO letter_instances (
    school_id, template_id, student_id,
    recipient_type, recipient_data,
    reference_number, status,
    delivery_channels, created_by,
    rendered_html, created_at, updated_at
  ) VALUES (
    p_school_id, p_template_id, p_student_id,
    p_recipient_type, p_recipient_data,
    p_reference_number, 'draft'::letter_instance_status,
    p_channels, p_created_by,
    p_rendered_html, NOW(), NOW()
  )
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

GRANT EXECUTE ON FUNCTION create_letter_instance TO authenticated;

-- ── 2. update_letter_status ────────────────────────────────────────────────────

CREATE FUNCTION update_letter_status(
  p_id          UUID,
  p_status      TEXT,
  p_approved_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row letter_instances%ROWTYPE;
BEGIN
  SET LOCAL row_security = OFF;

  UPDATE letter_instances
  SET
    status      = p_status::letter_instance_status,
    updated_at  = NOW(),
    sent_at     = CASE WHEN p_status = 'sent' THEN NOW() ELSE sent_at END,
    approved_by = CASE WHEN p_approved_by IS NOT NULL THEN p_approved_by ELSE approved_by END
  WHERE id = p_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'letter_instance % not found', p_id;
  END IF;

  RETURN to_jsonb(v_row);
END;
$$;

GRANT EXECUTE ON FUNCTION update_letter_status TO authenticated;

-- ── 3. record_letter_approval ──────────────────────────────────────────────────

CREATE FUNCTION record_letter_approval(
  p_letter_instance_id UUID,
  p_approver_id        UUID,
  p_decision           TEXT,
  p_comments           TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_status letter_instance_status;
BEGIN
  SET LOCAL row_security = OFF;

  v_new_status := CASE p_decision
    WHEN 'approved'          THEN 'approved'::letter_instance_status
    WHEN 'rejected'          THEN 'draft'::letter_instance_status
    WHEN 'changes_requested' THEN 'changes_requested'::letter_instance_status
    ELSE 'draft'::letter_instance_status
  END;

  INSERT INTO letter_approvals (
    letter_instance_id, approver_id, status, comments, approval_timestamp
  ) VALUES (
    p_letter_instance_id, p_approver_id,
    p_decision::letter_approval_status,
    p_comments, NOW()
  );

  UPDATE letter_instances
  SET
    status      = v_new_status,
    updated_at  = NOW(),
    approved_by = CASE WHEN p_decision = 'approved' THEN p_approver_id ELSE approved_by END
  WHERE id = p_letter_instance_id;

  RETURN jsonb_build_object(
    'success',    true,
    'decision',   p_decision,
    'new_status', v_new_status::TEXT
  );
END;
$$;

GRANT EXECUTE ON FUNCTION record_letter_approval TO authenticated;
