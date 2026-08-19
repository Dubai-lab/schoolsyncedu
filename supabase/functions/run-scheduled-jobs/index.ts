/**
 * run-scheduled-jobs
 *
 * Combines two scheduled tasks into one edge function:
 *   1. Hourly: auto_expire_subscriptions() — moves expired subs to grace/suspended
 *   2. Daily:  process-subscription-notifications — sends reminder emails
 *
 * Deploy:  supabase functions deploy run-scheduled-jobs --no-verify-jwt
 *
 * Schedule via Supabase Dashboard → Edge Functions → Schedules:
 *   • Every hour:  0 * * * *   (runs expiry check always)
 *   • Notifications run automatically when the hour is 8 (08:00 UTC)
 *
 * OR via pg_cron (run in SQL editor):
 *   SELECT cron.schedule(
 *     'run-scheduled-jobs',
 *     '0 * * * *',
 *     $$
 *       SELECT net.http_post(
 *         url     := '<YOUR_SUPABASE_URL>/functions/v1/run-scheduled-jobs',
 *         headers := '{"Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
 *         body    := '{}'::jsonb
 *       );
 *     $$
 *   );
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  // Allow manual POST triggers with { "job": "expiry" | "notifications" | "all" }
  let body: { job?: string } = {};
  try {
    body = await req.json();
  } catch {
    // no body — run all jobs
  }

  const runExpiry = !body.job || body.job === 'expiry' || body.job === 'all';
  const runNotifications = !body.job || body.job === 'notifications' || body.job === 'all';

  // Only run notifications at 08:xx UTC (when called on schedule every hour)
  const hour = new Date().getUTCHours();
  const isNotificationHour = hour === 8;

  const results: Record<string, unknown> = {};

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // ── 1. Auto-expiry check (runs every hour) ────────────────────────────────
  if (runExpiry) {
    try {
      const { data, error } = await supabase.rpc('auto_expire_subscriptions');
      if (error) throw error;
      results.expiry = { ok: true, schools_affected: data ?? 0 };
      console.log(`[expiry] ${data ?? 0} schools affected`);
    } catch (err) {
      results.expiry = { ok: false, error: String(err) };
      console.error('[expiry] error:', err);
    }
  }

  // ── 2. Notification emails — no longer this function's job ────────────────
  //
  // This used to POST to process-subscription-notifications with no
  // Authorization header. That function verifies JWTs, so the call returned
  // 401 on every run since the day it was written, and the `ok: true` below
  // reported success anyway. The expiry leg above authenticates properly
  // through the service-role client, which is why schools went offline on
  // schedule while no reminder email ever arrived.
  //
  // Reminders now belong to subscription_reminder_sweep() and its drain
  // (migrations 230/231), scheduled in pg_cron. Restoring the call here would
  // start the *old* batch loop alongside the new sweep — different event
  // names, so the dedup ledger would not catch it and every school would be
  // mailed twice. Deliberately left removed.
  results.notifications = {
    ok: true,
    skipped: true,
    reason: 'handled by subscription_reminder_sweep (pg_cron), not this function',
  };

  // Report the truth. This used to be a hard-coded ok: true, so an expiry run
  // that threw still looked like a clean run to anyone reading the logs.
  const failures = Object.entries(results)
    .filter(([, v]) => (v as { ok?: boolean })?.ok === false)
    .map(([k]) => k);

  return new Response(
    JSON.stringify({
      ok: failures.length === 0,
      failed: failures.length ? failures : undefined,
      ran_at: new Date().toISOString(),
      ...results,
    }),
    {
      status: failures.length ? 500 : 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
});
