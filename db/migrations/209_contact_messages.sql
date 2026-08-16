-- ============================================================
-- Migration 209: Contact form messages
--
-- The contact form never sent anything. ContactUs.tsx waited 1200ms and
-- displayed "message sent":
--
--     // Simulate form submission — wire to edge function or email service
--     await new Promise((r) => setTimeout(r, 1200));
--     setSubmitted(true);
--
-- No request, no row, no email. Every enquiry submitted since launch was
-- discarded while the sender was told it had gone through. That is worse than
-- a form that errors: a visible failure gets retried or phoned in, a silent
-- one is simply lost, and the sender believes they are waiting on a reply.
--
-- Messages are stored first and emailed second. Email is the convenience;
-- the row is the guarantee. If SMTP is misconfigured, rate-limited, or the
-- message lands in spam, the enquiry is still on record.
-- ============================================================

CREATE TABLE IF NOT EXISTS contact_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  phone       TEXT,
  subject     TEXT,
  message     TEXT NOT NULL,

  -- Light triage context. Not identity, just enough to spot a flood from one
  -- source or tell which page a message came from.
  source_page TEXT,

  status      TEXT NOT NULL DEFAULT 'new'
              CHECK (status IN ('new', 'read', 'replied', 'spam')),
  handled_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  handled_at  TIMESTAMPTZ,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_new
  ON contact_messages(created_at DESC)
  WHERE status = 'new';


-- ============================================================
-- RLS
--
-- Anyone may write — this is a public contact form and the sender is not
-- signed in. Nobody but super admin may read, because these messages contain
-- other people's names, emails and phone numbers.
--
-- Write-only-to-the-public is the important shape here: an INSERT policy
-- without a matching SELECT policy means a submitter cannot read back what
-- anyone else has sent.
-- ============================================================

ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contact_anon_insert ON contact_messages;
CREATE POLICY contact_anon_insert ON contact_messages
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS contact_admin_all ON contact_messages;
CREATE POLICY contact_admin_all ON contact_messages
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
  );


-- ============================================================
-- SUBMIT
--
-- A function rather than a direct insert, so validation and length caps live
-- server-side. An open INSERT policy is exactly the surface someone would use
-- to write multi-megabyte rows.
-- ============================================================

CREATE OR REPLACE FUNCTION submit_contact_message(
  p_name        TEXT,
  p_email       TEXT,
  p_message     TEXT,
  p_subject     TEXT DEFAULT NULL,
  p_phone       TEXT DEFAULT NULL,
  p_source_page TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF btrim(COALESCE(p_name, '')) = '' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Name is required.');
  END IF;

  IF p_email IS NULL OR p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Enter a valid email address.');
  END IF;

  IF btrim(COALESCE(p_message, '')) = '' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Message is required.');
  END IF;

  IF length(p_message) > 5000 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Message is too long (5000 characters max).');
  END IF;

  INSERT INTO contact_messages (name, email, phone, subject, message, source_page)
  VALUES (
    left(btrim(p_name), 200),
    lower(btrim(p_email)),
    left(btrim(COALESCE(p_phone, '')), 50),
    left(btrim(COALESCE(p_subject, '')), 300),
    btrim(p_message),
    left(COALESCE(p_source_page, ''), 200)
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION submit_contact_message(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
  TO anon, authenticated;


-- ============================================================
-- MARK HANDLED (super admin)
-- ============================================================

CREATE OR REPLACE FUNCTION set_contact_message_status(p_id UUID, p_status TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin UUID;
BEGIN
  SELECT id INTO v_admin FROM users WHERE auth_id = auth.uid() AND role = 'super_admin';
  IF v_admin IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Not permitted.');
  END IF;

  IF p_status NOT IN ('new', 'read', 'replied', 'spam') THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Unknown status.');
  END IF;

  UPDATE contact_messages
  SET    status = p_status, handled_by = v_admin, handled_at = now()
  WHERE  id = p_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Message not found.');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION set_contact_message_status(UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';


-- ============================================================
-- VERIFICATION
--
--   -- Signed out, this should return ok:true:
--   SELECT submit_contact_message('Test', 'test@example.com', 'Hello');
--
--   -- And signed out, this should return no rows (write-only for the public):
--   SELECT * FROM contact_messages;
--
--   -- As super admin:
--   SELECT name, email, subject, status, created_at
--   FROM   contact_messages ORDER BY created_at DESC;
-- ============================================================
