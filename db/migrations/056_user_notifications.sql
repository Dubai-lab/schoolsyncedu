-- Migration 056: In-app user notifications (the bell)
-- Separate from notification_logs (email tracking) — this powers the UI bell.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Table
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  school_id   UUID                 REFERENCES schools(id)  ON DELETE CASCADE,
  type        TEXT        NOT NULL, -- see types below
  title       TEXT        NOT NULL,
  body        TEXT,
  action_url  TEXT,                -- frontend path to navigate on click
  is_read     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Types used: 'grade_approval' | 'letter_approval' | 'new_application'
--             | 'new_incident' | 'new_referral' | 'fee_overdue'
--             | 'overdue_books' | 'subscription' | 'general'

CREATE INDEX IF NOT EXISTS idx_user_notif_user     ON user_notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_notif_unread   ON user_notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_user_notif_school   ON user_notifications(school_id, created_at DESC);

-- RLS
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
DROP POLICY IF EXISTS "notif_own_select"  ON user_notifications;
CREATE POLICY "notif_own_select" ON user_notifications
  FOR SELECT USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1)
  );

-- Users can mark their own as read
DROP POLICY IF EXISTS "notif_own_update"  ON user_notifications;
CREATE POLICY "notif_own_update" ON user_notifications
  FOR UPDATE USING (
    user_id = (SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1)
  );

-- Service role can insert (triggers run as service role via SECURITY DEFINER)
DROP POLICY IF EXISTS "notif_service_insert" ON user_notifications;
CREATE POLICY "notif_service_insert" ON user_notifications
  FOR INSERT WITH CHECK (true);

-- Super admin can see all
DROP POLICY IF EXISTS "notif_admin_all" ON user_notifications;
CREATE POLICY "notif_admin_all" ON user_notifications
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Helper: insert a notification for every user of given role(s) in a school
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_school_roles(
  p_school_id  UUID,
  p_roles      TEXT[],
  p_type       TEXT,
  p_title      TEXT,
  p_body       TEXT        DEFAULT NULL,
  p_action_url TEXT        DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO user_notifications (user_id, school_id, type, title, body, action_url)
  SELECT u.id, p_school_id, p_type, p_title, p_body, p_action_url
  FROM   users u
  WHERE  u.school_id  = p_school_id
    AND  u.role       = ANY(p_roles)
    AND  u.is_active  = TRUE;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Trigger: grade submitted → notify principal + vice_principal
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_grade_submitted_notify()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'submitted' AND (OLD.status IS DISTINCT FROM 'submitted') THEN
    PERFORM notify_school_roles(
      NEW.school_id,
      ARRAY['principal', 'vice_principal'],
      'grade_approval',
      'Grades Pending Approval',
      'New grades have been submitted and are awaiting your approval.',
      '/grades/approval'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grade_submitted ON grades;
CREATE TRIGGER trg_grade_submitted
  AFTER UPDATE OF status ON grades
  FOR EACH ROW EXECUTE FUNCTION trg_grade_submitted_notify();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Trigger: letter pending approval → notify principal + vice_principal
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_letter_approval_notify()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'pending_approval' AND (OLD.status IS DISTINCT FROM 'pending_approval') THEN
    PERFORM notify_school_roles(
      NEW.school_id,
      ARRAY['principal', 'vice_principal'],
      'letter_approval',
      'Letter Awaiting Approval',
      'A letter has been submitted and is waiting for your sign-off.',
      '/letters/approvals'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_letter_approval ON letter_instances;
CREATE TRIGGER trg_letter_approval
  AFTER UPDATE OF status ON letter_instances
  FOR EACH ROW EXECUTE FUNCTION trg_letter_approval_notify();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Trigger: new student application → notify registrar
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_application_notify()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM notify_school_roles(
    NEW.school_id,
    ARRAY['registrar'],
    'new_application',
    'New Student Application',
    'A new application has been received and needs review.',
    '/registrar/applications'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_new_application ON student_applications;
CREATE TRIGGER trg_new_application
  AFTER INSERT ON student_applications
  FOR EACH ROW EXECUTE FUNCTION trg_application_notify();

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Trigger: new dean incident → notify dean_of_students
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_incident_notify()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM notify_school_roles(
    NEW.school_id,
    ARRAY['dean_of_students'],
    'new_incident',
    'New Incident Reported',
    'A disciplinary incident has been logged and requires attention.',
    '/dean/incidents'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_new_incident ON dean_incidents;
CREATE TRIGGER trg_new_incident
  AFTER INSERT ON dean_incidents
  FOR EACH ROW EXECUTE FUNCTION trg_incident_notify();

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Trigger: teacher referral → notify dean_of_students
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_referral_notify()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM notify_school_roles(
    NEW.school_id,
    ARRAY['dean_of_students'],
    'new_referral',
    'New Teacher Referral',
    'A teacher has submitted a referral for a student.',
    '/dean/referrals'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_new_referral ON teacher_referrals;
CREATE TRIGGER trg_new_referral
  AFTER INSERT ON teacher_referrals
  FOR EACH ROW EXECUTE FUNCTION trg_referral_notify();

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Enable Realtime for the bell to update live
-- ─────────────────────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE user_notifications;
