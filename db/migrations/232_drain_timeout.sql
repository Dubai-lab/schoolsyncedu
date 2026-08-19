-- Migration 232: stop the drain reporting a timeout on every successful send
--
-- pg_net defaults to a 5000 ms timeout. The edge function needs longer than
-- that on a cold start before it has even opened an SMTP connection, so
-- net._http_response recorded a timeout on almost every call:
--
--   id 2781  timed_out = true, "Timeout of 5000 ms reached"   <- email arrived
--   id 2780  status_code = 200                                <- warm start
--
-- The timeout is only pg_net giving up on waiting; the function still runs to
-- completion, which is why the mail sent anyway. But it means every call looks
-- like a failure, so a call that genuinely fails looks identical and there is
-- no way to tell them apart. The same pattern hides on the hourly
-- run-scheduled-jobs call -- see the note at the foot of this file.
--
-- 30 seconds is comfortably longer than a cold start plus a batch of sends,
-- and still well under the edge function's own wall clock limit.

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
    'SELECT net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb,'
    || ' timeout_milliseconds := 30000)',
    rtrim(v_url, '/') || '/process-subscription-notifications',
    jsonb_build_object('Content-Type', 'application/json',
                       'Authorization', 'Bearer ' || v_key)::text,
    jsonb_build_object('trigger', 'drain_outbox')::text
  ) INTO v_req;

  RETURN jsonb_build_object('ok', TRUE, 'pending', v_pending, 'request_id', v_req);
END;
$fn$;

REVOKE ALL ON FUNCTION subscription_reminder_drain() FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- The hourly run-scheduled-jobs call has the same problem
--
-- It was scheduled by hand in SQL rather than by a migration, so it is not in
-- this repository and this file cannot fix it. It shows up as a timeout at
-- HH:00:00 on most runs. auto_expire_subscriptions() still completes, which is
-- why schools go offline on time regardless.
--
-- To see it and give it the same headroom:
--   SELECT jobid, jobname, schedule, command FROM cron.job;
--
-- Then re-create that job with timeout_milliseconds := 30000 added to its
-- net.http_post call:
--   SELECT cron.unschedule(<jobid>);
--   SELECT cron.schedule('run-scheduled-jobs', '0 * * * *', $job$
--     SELECT net.http_post(
--       url     := 'https://zjwgqosyffyisatfgmff.supabase.co/functions/v1/run-scheduled-jobs',
--       headers := jsonb_build_object('Content-Type', 'application/json',
--                                     'Authorization', 'Bearer ' || <service key>),
--       body    := '{}'::jsonb,
--       timeout_milliseconds := 30000);
--   $job$);
-- ---------------------------------------------------------------------------
