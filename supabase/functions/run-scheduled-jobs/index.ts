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

  // ── 2. Notification emails (runs at 08:00 UTC or when explicitly triggered) ─
  if (runNotifications && (isNotificationHour || body.job === 'notifications' || body.job === 'all')) {
    try {
      const notifUrl = `${SUPABASE_URL}/functions/v1/process-subscription-notifications`;
      const resp = await fetch(notifUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({}),
      });
      const notifData = await resp.json().catch(() => ({}));
      results.notifications = { ok: resp.ok, status: resp.status, ...notifData };
      console.log(`[notifications] status=${resp.status}`);
    } catch (err) {
      results.notifications = { ok: false, error: String(err) };
      console.error('[notifications] error:', err);
    }
  } else if (runNotifications) {
    results.notifications = { ok: true, skipped: true, reason: `Not notification hour (current UTC hour: ${hour})` };
  }

  return new Response(JSON.stringify({ ok: true, ran_at: new Date().toISOString(), ...results }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
