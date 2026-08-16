-- ============================================================
-- Migration 202: Push notification infrastructure
--
-- Why this exists:
--   SchoolSync has no push of any kind. Notifications are database rows a
--   user only sees if they open the app and look at the bell. For a student
--   app that is the difference between a tool people use and one they forget
--   is installed — nothing ever tells them a grade was approved.
--
-- Why Firebase is involved when the backend is Supabase:
--   Delivery to a phone with the app closed is owned by the OS vendors.
--   Android accepts pushes only from FCM, iOS only from APNs. No backend can
--   bypass that. Supabase keeps the data and decides WHAT to send; FCM is
--   only the pipe that carries it.
--
-- Shape:
--   device_tokens  — which devices belong to which user
--   push_outbox    — queued messages, written by triggers
--   triggers       — enqueue on the events students care about
--
--   An outbox rather than calling FCM straight from a trigger. A trigger that
--   makes an HTTP call would need the service role key stored in SQL, and a
--   slow or failed call would block the transaction that approved the grade.
--   Enqueuing is instant and cannot fail the write it hangs off.
--
--   The send-push edge function drains the outbox on a schedule, matching how
--   run-scheduled-jobs already works.
-- ============================================================


-- ============================================================
-- 1. DEVICE TOKENS
-- ============================================================

CREATE TABLE IF NOT EXISTS device_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_id   UUID REFERENCES schools(id) ON DELETE CASCADE,
  -- FCM registration token. Unique because the same device handed to another
  -- student must not keep notifying the previous owner — re-registering
  -- reassigns the row rather than creating a duplicate.
  token       TEXT NOT NULL UNIQUE,
  platform    TEXT NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
  device_name TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id);

ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS device_tokens_own ON device_tokens;
CREATE POLICY device_tokens_own ON device_tokens
  FOR ALL
  USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));


-- ============================================================
-- 2. REGISTER A DEVICE
--    Called by the app after the OS grants notification permission.
-- ============================================================

CREATE OR REPLACE FUNCTION register_device_token(
  p_token       TEXT,
  p_platform    TEXT,
  p_device_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user   RECORD;
BEGIN
  SELECT id, school_id INTO v_user
  FROM   users
  WHERE  auth_id = auth.uid();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Not signed in.');
  END IF;

  IF p_platform NOT IN ('android', 'ios', 'web') THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Unknown platform.');
  END IF;

  -- ON CONFLICT on the token reassigns a device that changed hands.
  INSERT INTO device_tokens (user_id, school_id, token, platform, device_name)
  VALUES (v_user.id, v_user.school_id, p_token, p_platform, p_device_name)
  ON CONFLICT (token) DO UPDATE
    SET user_id      = EXCLUDED.user_id,
        school_id    = EXCLUDED.school_id,
        platform     = EXCLUDED.platform,
        device_name  = COALESCE(EXCLUDED.device_name, device_tokens.device_name),
        last_seen_at = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION register_device_token(TEXT, TEXT, TEXT) TO authenticated;


-- Sign-out should stop notifications reaching a device someone else may use.
CREATE OR REPLACE FUNCTION unregister_device_token(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM device_tokens
  WHERE  token = p_token
    AND  user_id IN (SELECT id FROM users WHERE auth_id = auth.uid());
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION unregister_device_token(TEXT) TO authenticated;


-- ============================================================
-- 3. OUTBOX
--    Service-role only: written by triggers, drained by the edge function.
--    No policy is created, so RLS denies all client access by default.
-- ============================================================

CREATE TABLE IF NOT EXISTS push_outbox (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_id  UUID REFERENCES schools(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  -- Deep link target, e.g. /student/grades — the app routes to it on tap.
  route      TEXT,
  kind       TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'pending'
             CHECK (status IN ('pending', 'sent', 'failed')),
  attempts   INT  NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at    TIMESTAMPTZ
);

-- Partial index: the drain query only ever looks at pending rows, and this
-- stays small even as sent rows accumulate.
CREATE INDEX IF NOT EXISTS idx_push_outbox_pending
  ON push_outbox(created_at)
  WHERE status = 'pending';

ALTER TABLE push_outbox ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 4. TRIGGER: grade approved
--    The clearest win — students currently have no idea results are out.
-- ============================================================

CREATE OR REPLACE FUNCTION notify_grade_approved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   UUID;
  v_school_id UUID;
  v_subject   TEXT;
BEGIN
  -- Only on the transition into 'approved'. Without this, every later edit to
  -- an already-approved grade would notify again.
  IF NEW.status IS DISTINCT FROM 'approved'
     OR (TG_OP = 'UPDATE' AND OLD.status = 'approved') THEN
    RETURN NEW;
  END IF;

  SELECT s.user_id, s.school_id INTO v_user_id, v_school_id
  FROM   students s
  WHERE  s.id = NEW.student_id;

  -- No portal account yet — nothing to notify.
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_subject FROM subjects WHERE id = NEW.subject_id;

  INSERT INTO push_outbox (user_id, school_id, title, body, route, kind)
  VALUES (
    v_user_id,
    v_school_id,
    'New grade published',
    COALESCE(v_subject, 'A subject') || ' results are now available.',
    '/student/grades',
    'grade_approved'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_grade_approved ON grades;
CREATE TRIGGER trg_notify_grade_approved
  AFTER INSERT OR UPDATE OF status ON grades
  FOR EACH ROW
  EXECUTE FUNCTION notify_grade_approved();


-- ============================================================
-- 5. TRIGGER: fee recorded against a student
--    Payments are the other thing students and their families chase.
-- ============================================================

CREATE OR REPLACE FUNCTION notify_fee_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   UUID;
  v_school_id UUID;
BEGIN
  -- Only when a payment actually moved.
  IF TG_OP = 'UPDATE'
     AND NEW.amount_paid IS NOT DISTINCT FROM OLD.amount_paid THEN
    RETURN NEW;
  END IF;

  SELECT s.user_id, s.school_id INTO v_user_id, v_school_id
  FROM   students s
  WHERE  s.id = NEW.student_id;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO push_outbox (user_id, school_id, title, body, route, kind)
  VALUES (
    v_user_id,
    v_school_id,
    'Payment recorded',
    'Your fee balance has been updated.',
    '/student/fees',
    'fee_payment'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_fee_payment ON student_fees;
CREATE TRIGGER trg_notify_fee_payment
  AFTER UPDATE OF amount_paid ON student_fees
  FOR EACH ROW
  EXECUTE FUNCTION notify_fee_payment();


-- ============================================================
-- 6. VERIFICATION
--
--   -- Tables exist and RLS is on:
--   SELECT tablename, rowsecurity FROM pg_tables
--   WHERE tablename IN ('device_tokens','push_outbox');
--
--   -- Triggers attached:
--   SELECT tgname FROM pg_trigger
--   WHERE tgname IN ('trg_notify_grade_approved','trg_notify_fee_payment');
--
--   -- After approving a grade for a student who has a portal account,
--   -- a row should appear here:
--   SELECT title, body, kind, status FROM push_outbox ORDER BY created_at DESC LIMIT 5;
-- ============================================================

NOTIFY pgrst, 'reload schema';
