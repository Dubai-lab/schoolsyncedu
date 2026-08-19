-- Migration 233: retire the two cron jobs that could never have worked
--
-- What was actually wrong, finally established from cron.job rather than
-- guessed at from this repository:
--
--   jobid 1  daily-subscription-notifications   0 8 * * *
--     Created to send the reminder emails. POSTs to
--     process-subscription-notifications with
--         headers := '{"Content-Type":"application/json"}'
--     and no Authorization header. That function verifies JWTs, so the call
--     has been answered 401 every morning since the job was created. This is
--     the original bug: the reminders were not unscheduled, they were
--     unauthenticated.
--
--   jobid 3  run-scheduled-jobs-hourly          0 * * * *
--     Same missing header, but run-scheduled-jobs was deployed with
--     --no-verify-jwt so the call lands anyway. It ran auto_expire_
--     subscriptions() and then made its own unauthenticated fetch to
--     process-subscription-notifications, which was 401'd in turn and
--     swallowed -- the handler returned a hard-coded ok: true.
--
-- Both are now redundant:
--
--   * reminders belong to subscription_reminder_sweep (jobid 11) and the
--     drain (jobid 12), and the batch loop those jobs called now answers 410
--   * jobid 2, auto-expire-subscriptions, already runs the same expiry hourly
--     as plain SQL -- no HTTP, no auth, nothing to fail. It is the reason
--     schools have always gone offline on time, and it stays exactly as it is.
--
-- Dropping jobid 3 also removes every one of the 5-second pg_net timeouts in
-- net._http_response, since it was the only thing making that hourly call.

DO $do$
BEGIN
  IF to_regnamespace('cron') IS NULL THEN
    RAISE NOTICE 'pg_cron not installed - nothing to retire.';
    RETURN;
  END IF;

  PERFORM cron.unschedule(jobid)
  FROM   cron.job
  WHERE  jobname IN ('daily-subscription-notifications', 'run-scheduled-jobs-hourly');

  RAISE NOTICE 'Retired the unauthenticated notification jobs.';
END
$do$;

-- ---------------------------------------------------------------------------
-- After this, the schedule should read exactly:
--
--   auto-expire-subscriptions       0 * * * *    SELECT auto_expire_subscriptions()
--   deactivate-expired-subdomains   0 2 * * *    UPDATE schools ...
--   subscription-reminders          0 8 * * *    SELECT subscription_reminder_sweep()
--   subscription-mail-drain         15 * * * *   SELECT subscription_reminder_drain()
--
-- Three of the four are pure SQL. The drain is the only job that leaves the
-- database, and it is the only one carrying a credential.
--
--   SELECT jobid, jobname, schedule FROM cron.job ORDER BY jobid;
--
-- One loose end this migration cannot reach: the run-scheduled-jobs edge
-- function is still deployed with --no-verify-jwt, which means anyone who
-- knows the URL can POST to it and trigger auto_expire_subscriptions(). It
-- cannot expire a school that is not already due, so the exposure is small,
-- but nothing calls it any more. Delete it from the dashboard:
--   Edge Functions -> run-scheduled-jobs -> Delete
-- ---------------------------------------------------------------------------
