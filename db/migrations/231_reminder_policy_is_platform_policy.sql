-- Migration 231: one reminder policy, held in one place
--
-- Why this replaces 230's version of the sweep
-- --------------------------------------------
-- 230 read the cadence out of subscription_plans.notification_config, which
-- put it on the plan form: every new plan re-decided how hard we chase people
-- for money, plans drifted apart, and a school on Basic could be contacted
-- differently from one on Premium for no reason anyone intended. How often we
-- ask a customer to pay is company policy, not a property of a price tier.
-- The panel is being removed from the plan form and the policy lives here.
--
-- notification_config is left on the table untouched. Nothing reads it after
-- this migration, but dropping a column is irreversible and it costs nothing
-- to leave in place.
--
-- The policy
-- ----------
--   3 days before expiry   one heads-up, so an active school is not surprised
--   grace day 0            subscription has ended, offline in <grace> days
--   5 / 3 / 1 days left    three reminders inside the grace window
--   on suspension          the school is now offline, contact support
--
-- Six emails in total, and the last one is sent off the actual suspension
-- rather than off a date. That matters: it claims the school is offline, so
-- it must not go out until auto_expire_subscriptions() has really suspended
-- it. If that job is not scheduled, this email correctly never sends -- see
-- the note at the foot of this file.
--
-- Grace arithmetic: expires_at is the END of the grace window. Both routes in
-- push it forward by the plan's grace_days -- registration on a no-trial plan
-- (089) and auto_expire_subscriptions (054) -- so days-to-expiry is already
-- days-of-grace-remaining.

CREATE OR REPLACE FUNCTION subscription_reminder_sweep()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_sub      RECORD;
  v_owner    RECORD;
  v_left     INT;
  v_template TEXT;
  v_event    TEXT;
  v_subject  TEXT;
  v_body     TEXT;
  v_when     TEXT;
  v_due      DATE;
  v_queued   INT := 0;
  v_belled   INT := 0;
  v_due_ct   INT := 0;
BEGIN
  FOR v_sub IN
    SELECT s.id, s.school_id, s.status::TEXT AS status, s.expires_at,
           sc.name AS school_name,
           p.name  AS plan_name,
           COALESCE(p.grace_days, 7) AS grace_total
    FROM   subscriptions s
    JOIN   schools sc           ON sc.id = s.school_id
    JOIN   subscription_plans p ON p.id  = s.plan_id
    WHERE  s.status IN ('trial', 'active', 'grace', 'suspended')
      AND  s.expires_at IS NOT NULL
  LOOP
    v_due      := v_sub.expires_at::date;
    v_left     := v_due - CURRENT_DATE;
    v_template := NULL;

    IF v_sub.status = 'suspended' THEN
      -- Fires once per suspension date. A school reactivated and later
      -- suspended again has a new expires_at, so it is told again.
      v_template := 'suspended_notice';
      v_left     := 0;

    ELSIF v_sub.status = 'grace' THEN
      IF v_left = v_sub.grace_total THEN
        v_template := 'grace_start';
      ELSIF v_left IN (5, 3, 1) AND v_left < v_sub.grace_total THEN
        v_template := 'grace_reminder';
      END IF;

    ELSE  -- trial or active: a single heads-up before it lapses
      IF v_left = 3 THEN
        v_template := CASE WHEN v_sub.status = 'trial'
                           THEN 'trial_reminder' ELSE 'expiry_reminder' END;
      END IF;
    END IF;

    CONTINUE WHEN v_template IS NULL;

    v_event := CASE WHEN v_template = 'suspended_notice'
                    THEN v_template
                    ELSE v_template || '_' || v_left END;

    -- The gate. Loses the race on a double run and skips everything below.
    INSERT INTO subscription_reminder_log (subscription_id, school_id, event_type, due_on)
    VALUES (v_sub.id, v_sub.school_id, v_event, v_due)
    ON CONFLICT DO NOTHING;
    CONTINUE WHEN NOT FOUND;

    v_due_ct := v_due_ct + 1;

    v_when := CASE WHEN v_left = 1 THEN 'tomorrow'
                   WHEN v_left = 0 THEN 'today'
                   ELSE 'in ' || v_left || ' days' END;

    v_subject := CASE v_template
      WHEN 'trial_reminder'
        THEN 'Your SchoolSync trial ends ' || v_when || ' - ' || v_sub.school_name
      WHEN 'expiry_reminder'
        THEN 'Your SchoolSync subscription expires ' || v_when || ' - ' || v_sub.school_name
      WHEN 'grace_start'
        THEN 'Your subscription has ended - ' || v_sub.school_name
             || ' goes offline in ' || v_sub.grace_total || ' days'
      WHEN 'grace_reminder'
        THEN v_sub.school_name || ' goes offline ' || v_when || ' - action needed'
      ELSE v_sub.school_name || ' is now offline'
    END;

    v_body := CASE v_template
      WHEN 'grace_start'
        THEN 'Your subscription has ended. Contact us to arrange payment - the school '
             || 'stays fully usable until ' || to_char(v_due, 'FMDD Mon YYYY') || '.'
      WHEN 'grace_reminder'
        THEN 'Access ends ' || to_char(v_due, 'FMDD Mon YYYY')
             || '. Contact us to arrange payment before staff and students lose access.'
      WHEN 'suspended_notice'
        THEN 'Your school portal is offline and nobody can sign in. Your data is safe. '
             || 'Contact support to arrange payment and restore access.'
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
          'days_left',   v_left,
          'grace_total', v_sub.grace_total,
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
             'days_left',  v_left,
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

REVOKE ALL ON FUNCTION subscription_reminder_sweep() FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- The suspension notice, and who actually takes a school offline
--
-- "Your school is now offline" is only true once the school really has been
-- suspended, so this email is triggered by status = 'suspended' rather than by
-- a date. Nothing needs enabling for that to work.
--
-- auto_expire_subscriptions() -- the thing that sets is_online = false -- is
-- ALREADY running. It is called hourly by the run-scheduled-jobs edge
-- function, scheduled from the Supabase dashboard rather than from any
-- migration, which is why no cron.schedule for it appears anywhere in this
-- repository.
--
-- So do NOT set enable_auto_expire in system_job_config, and do not add a
-- pg_cron job for it. That would schedule a second copy alongside the one
-- already running.
--
-- The audit trail, if you ever need to confirm it is still firing (the trigger
-- in 057 writes a row every time is_online changes):
--   SELECT created_at, log_level, message, metadata
--   FROM   system_logs WHERE module = 'schools'
--   ORDER  BY created_at DESC LIMIT 20;
--
-- Footnote on why the reminders were silent for so long: run-scheduled-jobs
-- also POSTed to process-subscription-notifications, but without an
-- Authorization header, so that leg returned 401 on every run while the
-- function reported ok: true regardless. The expiry leg went through a
-- service-role client and worked. One scheduled job, one authenticated call
-- and one unauthenticated one -- which is exactly why schools went offline on
-- time and no reminder ever arrived.
-- ---------------------------------------------------------------------------
