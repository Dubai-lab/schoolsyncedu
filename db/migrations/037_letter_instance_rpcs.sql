-- ============================================================
-- Migration 037: SECURITY DEFINER RPCs for letter operations
--
-- Why: RLS policies on letter_instances / letter_approvals still block
-- even after 036 because the role subquery `(SELECT role FROM users
-- WHERE id = auth.uid())` returns NULL for users whose JWT sub does
-- not match the users.id column (common when users are created via
-- service-role and the JWT uses a different claim layout).
--
-- Fix: Same pattern as record_fee_payment (migration 035) —
-- SECURITY DEFINER functions that SET LOCAL row_security = OFF,
-- perform the write, and return the result.
--
-- Functions created:
--   1. create_letter_instance   — insert + return row
--   2. update_letter_status     — status transitions + sent_at
--   3. record_letter_approval   — insert approval + update instance
-- ============================================================

-- ── 0. Add missing columns to letter_instances ──────────────────────────────

ALTER TABLE letter_instances
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- ── 1. create_letter_instance ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION create_letter_instance(
  p_school_id       UUID,
  p_template_id     UUID,
  p_student_id      UUID,
  p_recipient_type  TEXT,
  p_recipient_data  JSONB,
  p_channels        JSONB,          -- e.g. '["email","portal"]'
  p_created_by      UUID,
  p_rendered_html   TEXT,
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
    p_reference_number, 'draft',
    p_channels, p_created_by,
    p_rendered_html, NOW(), NOW()
  )
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

GRANT EXECUTE ON FUNCTION create_letter_instance TO authenticated;

-- ── 2. update_letter_status ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_letter_status(
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
    status      = p_status,
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

-- ── 3. record_letter_approval ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION record_letter_approval(
  p_letter_instance_id  UUID,
  p_approver_id         UUID,
  p_decision            TEXT,   -- 'approved' | 'rejected' | 'changes_requested'
  p_comments            TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_status TEXT;
BEGIN
  SET LOCAL row_security = OFF;

  -- Map approval decision → instance status
  v_new_status := CASE p_decision
    WHEN 'approved'           THEN 'approved'
    WHEN 'rejected'           THEN 'draft'
    WHEN 'changes_requested'  THEN 'changes_requested'
    ELSE 'draft'
  END;

  -- Insert the approval record
  INSERT INTO letter_approvals (
    letter_instance_id, approver_id, status, comments, approval_timestamp
  ) VALUES (
    p_letter_instance_id, p_approver_id, p_decision, p_comments, NOW()
  );

  -- Update the letter instance
  UPDATE letter_instances
  SET
    status      = v_new_status,
    updated_at  = NOW(),
    approved_by = CASE WHEN p_decision = 'approved' THEN p_approver_id ELSE approved_by END
  WHERE id = p_letter_instance_id;

  RETURN jsonb_build_object(
    'success',      true,
    'decision',     p_decision,
    'new_status',   v_new_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION record_letter_approval TO authenticated;
