-- Migration 230: subscription reminders that actually leave the building
--
-- Why this exists
-- ---------------
-- The reminder emails have been written since migration 053 and have never
-- sent once. The code was fine and the SMTP secrets were fine; nothing ever
-- *called* the function. Across the whole repository there was exactly one
-- real cron.schedule (099, subdomain cleanup) -- every other schedule lived in
-- a SQL comment, including the two in 048 and 054.
--
-- The old design chained pg_cron -> HTTP -> edge function -> SMTP, and every
-- link in that chain fails silently. This splits the decision from the
-- delivery:
--
--   subscription_reminder_sweep()  decides who is due and writes the bell row
--                                  plus a pending email row. Pure SQL, no
--                                  network, no secrets -- it cannot half-work.
--   subscription_reminder_drain()  asks the edge function to send whatever is
--                                  pending. If that call fails the rows stay
--                                  pending and the next run picks them up.
--
-- So a broken delivery leg delays mail; it no longer loses it.

-- ---------------------------------------------------------------------------
-- 1. Outbox
--    Mirrors push_outbox (202) deliberately: same status/attempts/last_error
--    shape, so a failure leaves evidence instead of vanishing.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS email_outbox (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID REFERENCES schools(id)       ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  recipient_name  TEXT,
  event_type      TEXT NOT NULL,           -- 'expiry_reminder_7'
  template        TEXT NOT NULL,           -- expiry_reminder | trial_reminder | grace_reminder
  subject         TEXT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  due_on          DATE NOT NULL,           -- the expiry this reminder is about
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'sent', 'failed')),
  attempts        INT  NOT NULL DEFAULT 0,
  last_error      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at         TIMESTAMPTZ
);

-- The drain only ever reads pending rows; this stays small as sent rows pile up.
CREATE INDEX IF NOT EXISTS idx_email_outbox_pending
  ON email_outbox(created_at) WHERE status = 'pending';

-- Belt and braces behind the ledger below.
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_outbox_event
  ON email_outbox(subscription_id, event_type, recipient_email, due_on);

ALTER TABLE email_outbox ENABLE ROW LEVEL SECURITY;
-- No policy on purpose: RLS denies every client, definer functions and the
-- service role still reach it. Same posture as push_outbox.

-- ---------------------------------------------------------------------------
-- 2. Dedup ledger
--    One row per (subscription, event, due date). Everything the sweep does is
--    gated on winning this insert, so a double run is physically impossible
--    rather than merely unlikely -- the old 20-hour time window was a guess.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS subscription_reminder_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  school_id       UUID NOT NULL REFERENCES schools(id)       ON DELETE CASCADE,
  event_type      TEXT NOT NULL,
  due_on          DATE NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, event_type, due_on)
);

ALTER TABLE subscription_reminder_log ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 3. The sweep
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION subscription_reminder_sweep()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_sub      RECORD;
  v_owner    RECORD;
  v_list     JSONB;
  v_match    INT;
  v_event    TEXT;
  v_template TEXT;
  v_subject  TEXT;
  v_when     TEXT;
  v_body     TEXT;
  v_due      DATE;
  v_queued   INT := 0;
  v_belled   INT := 0;
  v_due_ct   INT := 0;
BEGIN
  FOR v_sub IN
    SELECT s.id, s.school_id, s.status::TEXT AS status, s.expires_at,
           COALESCE(s.grace_days_remaining, 0) AS grace_days,
           sc.name AS school_name,
           p.name  AS plan_name,
           COALESCE(p.notification_config, '{}'::jsonb) AS cfg
    FROM   subscriptions s
    JOIN   schools sc           ON sc.id = s.school_id
    JOIN   subscription_plans p ON p.id  = s.plan_id
    WHERE  s.status IN ('trial', 'active', 'grace')
      AND  s.expires_at IS NOT NULL
  LOOP
    v_due := v_sub.expires_at::date;

    IF v_sub.status = 'trial' THEN
      CONTINUE WHEN COALESCE((v_sub.cfg->>'notify_on_trial_start')::boolean, TRUE) IS NOT TRUE;
      v_list     := COALESCE(v_sub.cfg->'trial_reminder_days', '[3,1]'::jsonb);
      v_match    := v_due - CURRENT_DATE;
      v_template := 'trial_reminder';

    ELSIF v_sub.status = 'active' THEN
      -- The admin-facing checkbox labelled "Subscription expiry reminders" is
      -- bound to notify_on_trial_expired, not to a key named after itself
      -- (PricingPlans.tsx). Misleading, but it is the switch the operator sees
      -- for these emails, so it is the one that has to be honoured. The old
      -- edge function ignored it, which meant unticking the box did nothing.
      CONTINUE WHEN COALESCE((v_sub.cfg->>'notify_on_trial_expired')::boolean, TRUE) IS NOT TRUE;
      v_list     := COALESCE(v_sub.cfg->'expiry_reminder_days', '[7,3,1]'::jsonb);
      v_match    := v_due - CURRENT_DATE;
      v_template := 'expiry_reminder';

    ELSE  -- grace
      CONTINUE WHEN COALESCE((v_sub.cfg->>'notify_on_grace_start')::boolean, TRUE) IS NOT TRUE;
      v_list     := COALESCE(v_sub.cfg->'grace_reminder_days', '[2]'::jsonb);
      -- In grace the subscription has already expired, so days-to-expiry is
      -- negative. The number that means anything here is days left *of grace*.
      -- The old edge function compared the negative value against [2] and so
      -- could never match -- grace reminders never fired even in theory.
      v_match    := v_sub.grace_days - (CURRENT_DATE - v_due);
      v_template := 'grace_reminder';
    END IF;

    CONTINUE WHEN v_match IS NULL OR v_match < 0;
    CONTINUE WHEN jsonb_typeof(v_list) <> 'array';
    CONTINUE WHEN NOT (v_list @> to_jsonb(v_match));

    v_event := v_template || '_' || v_match;

    -- The gate. Loses the race on a double run and skips everything below.
    INSERT INTO subscription_reminder_log (subscription_id, school_id, event_type, due_on)
    VALUES (v_sub.id, v_sub.school_id, v_event, v_due)
    ON CONFLICT DO NOTHING;
    CONTINUE WHEN NOT FOUND;

    v_due_ct := v_due_ct + 1;

    -- 0 means the last day, not tomorrow. Reminder days are usually 7/3/1 so
    -- it rarely lands, but a plan configured with 0 should still read right.
    v_when := CASE WHEN v_match = 0 THEN 'today'
                   WHEN v_match = 1 THEN 'tomorrow'
                   ELSE 'in ' || v_match || ' days' END;

    v_subject := CASE v_template
      WHEN 'trial_reminder'
        THEN 'Your SchoolSync trial ends ' || v_when || ' - ' || v_sub.school_name
      WHEN 'expiry_reminder'
        THEN 'Your SchoolSync subscription expires ' || v_when || ' - ' || v_sub.school_name
      ELSE CASE WHEN v_match <= 1
             THEN 'Last day to renew - ' || v_sub.school_name
             ELSE 'Your SchoolSync subscription has expired - ' || v_match
                  || ' days left to renew - ' || v_sub.school_name
           END
    END;

    v_body := CASE
      WHEN v_template = 'grace_reminder'
        THEN 'Your subscription expired on ' || to_char(v_due, 'FMDD Mon YYYY')
             || '. Contact us to renew before access is suspended.'
      ELSE 'Contact us to renew your ' || COALESCE(v_sub.plan_name, 'subscription')
           || ' before ' || to_char(v_due, 'FMDD Mon YYYY') || '.'
    END;

    FOR v_owner IN
      SELECT u.id, u.full_name, u.email
      FROM   users u
      WHERE  u.school_id = v_sub.school_id
        AND  u.role      = 'proprietor'
        AND  u.is_active = TRUE
        AND  NULLIF(btrim(u.email), '') IS NOT NULL
    LOOP
      -- Bell first: it needs nothing but this transaction, so the school has a
      -- reminder waiting even if mail never leaves.
      INSERT INTO user_notifications (user_id, school_id, type, title, body, action_url)
      VALUES (v_owner.id, v_sub.school_id, 'subscription', v_subject, v_body,
              '/proprietor/subscription');
      v_belled := v_belled + 1;

      INSERT INTO email_outbox (
        school_id, subscription_id, recipient_email, recipient_name,
        event_type, template, subject, payload, due_on
      )
      VALUES (
        v_sub.school_id, v_sub.id, lower(btrim(v_owner.email)), v_owner.full_name,
        v_event, v_template, v_subject,
        jsonb_build_object(
          'school_name', v_sub.school_name,
          'owner_name',  v_owner.full_name,
          'plan_name',   v_sub.plan_name,
          'days_left',   v_match,
          'expires_on',  to_char(v_due, 'FMDD Mon YYYY'),
          'status',      v_sub.status
        ),
        v_due
      )
      ON CONFLICT DO NOTHING;
      v_queued := v_queued + 1;
    END LOOP;

    -- A copy for the platform owner. Under manual activation the reminder's
    -- real job is to prompt the phone call, so it has to reach whoever does
    -- the activating. The super admin bell reads notification_logs, not
    -- user_notifications (see notificationService.listForSuperAdmin).
    INSERT INTO notification_logs (school_id, subscription_id, event_type, recipient_email, metadata)
    SELECT v_sub.school_id, v_sub.id, v_event,
           COALESCE(
             (SELECT lower(btrim(u.email)) FROM users u
              WHERE u.school_id = v_sub.school_id AND u.role = 'proprietor'
                AND u.is_active = TRUE LIMIT 1),
             'no proprietor on file'
           ),
           jsonb_build_object(
             'plan_name',  v_sub.plan_name,
             'days_left',  v_match,
             'expires_on', v_due,
             'audience',   'platform_owner'
           )
    WHERE EXISTS (SELECT 1 FROM users WHERE role = 'super_admin' AND is_active = TRUE);
  END LOOP;

  RETURN jsonb_build_object(
    'ok', TRUE, 'due', v_due_ct, 'queued', v_queued, 'belled', v_belled, 'ran_at', now()
  );
END;
$fn$;

-- ---------------------------------------------------------------------------
-- 4. Config for the delivery leg
--    RLS on with no policies: clients cannot read this, definer functions and
--    the service role can.
--
--    NOT platform_config. That table already exists (058) and carries the
--    social links the public footer reads, so it is deliberately world
--    readable -- "FOR SELECT USING (true)". A service role key stored there
--    would be readable by anyone who can reach the API. This table is closed
--    by default and holds nothing the front end needs.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS system_job_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE system_job_config ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 5. The drain
--    Never raises. If it cannot reach the edge function the mail stays pending
--    and the next run tries again.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION subscription_reminder_drain()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_url     TEXT;
  v_key     TEXT;
  v_pending INT;
  v_req     BIGINT;
BEGIN
  SELECT count(*) INTO v_pending FROM email_outbox WHERE status = 'pending';
  IF v_pending = 0 THEN
    RETURN jsonb_build_object('ok', TRUE, 'pending', 0);
  END IF;

  SELECT value INTO v_url FROM system_job_config WHERE key = 'functions_url';
  SELECT value INTO v_key FROM system_job_config WHERE key = 'service_role_key';

  IF NULLIF(btrim(COALESCE(v_url, '')), '') IS NULL
     OR NULLIF(btrim(COALESCE(v_key, '')), '') IS NULL THEN
    RETURN jsonb_build_object(
      'ok', FALSE, 'pending', v_pending,
      'message', 'system_job_config missing functions_url / service_role_key - mail stays queued');
  END IF;

  IF to_regnamespace('net') IS NULL THEN
    RETURN jsonb_build_object(
      'ok', FALSE, 'pending', v_pending,
      'message', 'pg_net not installed - enable it, or schedule the function from the dashboard');
  END IF;

  -- EXECUTE so this function still creates cleanly where pg_net is absent.
  EXECUTE format(
    'SELECT net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb)',
    rtrim(v_url, '/') || '/process-subscription-notifications',
    jsonb_build_object('Content-Type', 'application/json',
                       'Authorization', 'Bearer ' || v_key)::text,
    jsonb_build_object('trigger', 'drain_outbox')::text
  ) INTO v_req;

  RETURN jsonb_build_object('ok', TRUE, 'pending', v_pending, 'request_id', v_req);
END;
$fn$;

REVOKE ALL ON FUNCTION subscription_reminder_sweep() FROM PUBLIC;
REVOKE ALL ON FUNCTION subscription_reminder_drain() FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 6. The part that was missing all along -- a real schedule.
--    Written the way 099 writes it: executed, not left in a comment.
-- ---------------------------------------------------------------------------

DO $do$
BEGIN
  IF to_regnamespace('cron') IS NULL THEN
    RAISE NOTICE 'pg_cron not installed - schedules skipped. Enable it and re-run this block.';
    RETURN;
  END IF;

  -- Idempotent: drop by name first so re-running this migration is safe.
  -- Only the two jobs this migration owns. auto-expire is deliberately absent:
  -- unscheduling a job someone created by hand and then not recreating it
  -- would quietly disable it, which is the same silent-failure this whole
  -- migration exists to remove.
  PERFORM cron.unschedule(jobid)
  FROM   cron.job
  WHERE  jobname IN ('subscription-reminders', 'subscription-mail-drain');

  PERFORM cron.schedule('subscription-reminders',  '0 8 * * *',  'SELECT subscription_reminder_sweep()');
  PERFORM cron.schedule('subscription-mail-drain', '15 * * * *', 'SELECT subscription_reminder_drain()');

  -- auto_expire_subscriptions() has never been scheduled either, which is why
  -- lapsed subscriptions still read 'active' (048, 054).
  --
  -- It is NOT switched on here, on purpose. Every school that has been running
  -- past its expiry date would move to grace or suspended on the first run,
  -- and some of those are almost certainly schools that paid you offline while
  -- the record was never updated. Turning that on unattended could lock a
  -- paying school out of its own system mid-term.
  --
  -- Look first:
  --   SELECT sc.name, s.status, s.expires_at
  --   FROM subscriptions s JOIN schools sc ON sc.id = s.school_id
  --   WHERE s.status = 'active' AND s.expires_at < now()
  --   ORDER BY s.expires_at;
  --
  -- Then enable it deliberately:
  --   INSERT INTO system_job_config (key, value) VALUES ('enable_auto_expire', 'true')
  --   ON CONFLICT (key) DO UPDATE SET value = 'true', updated_at = now();
  --   -- and re-run this DO block.
  IF EXISTS (SELECT 1 FROM system_job_config WHERE key = 'enable_auto_expire' AND value = 'true') THEN
    IF to_regproc('auto_expire_subscriptions') IS NOT NULL THEN
      PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'auto-expire-subscriptions';
      PERFORM cron.schedule('auto-expire-subscriptions', '0 * * * *', 'SELECT auto_expire_subscriptions()');
      RAISE NOTICE 'auto-expire scheduled hourly.';
    ELSE
      RAISE NOTICE 'auto_expire_subscriptions() not found - run 054 first.';
    END IF;
  ELSE
    RAISE NOTICE 'auto-expire left OFF. Reminders do not depend on it; see the notes above before enabling.';
  END IF;
END
$do$;

-- ---------------------------------------------------------------------------
-- 7. After running this, set the delivery config once:
--
--   INSERT INTO system_job_config (key, value) VALUES
--     ('functions_url',    'https://zjwgqosyffyisatfgmff.supabase.co/functions/v1'),
--     ('service_role_key', 'PASTE_SERVICE_ROLE_KEY_HERE')
--   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
--
-- The project URL is public (it ships in the front-end bundle), so it is fine
-- here. The service role key is not -- paste it straight into the SQL editor
-- and never into this file, which is committed.
--
-- Until that is set the sweep still runs and the bell still fires; email
-- simply queues in email_outbox and goes out on the first drain that can
-- reach the function.
--
-- To check on it:
--   SELECT jobname, schedule, active FROM cron.job;
--   SELECT status, count(*) FROM email_outbox GROUP BY status;
--   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
-- ---------------------------------------------------------------------------
