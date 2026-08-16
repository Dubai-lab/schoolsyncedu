/**
 * send-push
 *
 * Drains push_outbox and delivers each message through FCM.
 *
 * Deploy:
 *   supabase functions deploy send-push --no-verify-jwt
 *
 * Schedule (Supabase Dashboard → Edge Functions → Schedules):
 *   Every minute:  * * * * *
 *
 * Secrets required:
 *   FCM_SERVICE_ACCOUNT  — the entire service account JSON from
 *                          Firebase → Project settings → Service accounts
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — injected by Supabase
 *
 * Why an OAuth2 dance: FCM's legacy server key is retired. HTTP v1 requires a
 * short-lived access token minted from the service account, which means
 * signing a JWT with its private key. Deno's Web Crypto handles RS256, so
 * there is no dependency to pull in.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

// One send-push invocation handles at most this many messages. Keeps the
// function inside its execution budget when a whole year group is graded at
// once; the remainder is picked up by the next scheduled run.
const BATCH_SIZE = 200;

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

function b64url(input: ArrayBuffer | string): string {
  const bytes =
    typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** PEM → ArrayBuffer for Web Crypto's PKCS8 importer. */
function pemToDer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const raw = atob(body);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return buf.buffer;
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: FCM_SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );

  const key = await crypto.subtle.importKey(
    'pkcs8',
    // The JSON encodes newlines as \n; Web Crypto needs them real.
    pemToDer(sa.private_key.replace(/\\n/g, '\n')),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(`${header}.${claim}`),
  );

  const assertion = `${header}.${claim}.${b64url(signature)}`;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  }

  const { access_token } = await res.json();
  return access_token as string;
}

Deno.serve(async () => {
  try {
    const raw = Deno.env.get('FCM_SERVICE_ACCOUNT');
    if (!raw) {
      return Response.json({ error: 'FCM_SERVICE_ACCOUNT is not set' }, { status: 500 });
    }

    const sa = JSON.parse(raw) as ServiceAccount;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: queued, error } = await supabase
      .from('push_outbox')
      .select('id, user_id, title, body, route, attempts')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (error) throw error;
    if (!queued || queued.length === 0) {
      return Response.json({ sent: 0, message: 'nothing queued' });
    }

    const accessToken = await getAccessToken(sa);
    const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;

    let sent = 0;
    let failed = 0;
    const deadTokens: string[] = [];

    for (const msg of queued) {
      const { data: devices } = await supabase
        .from('device_tokens')
        .select('token, platform')
        .eq('user_id', msg.user_id);

      // A student with no device registered is not an error — they simply
      // have not installed the app. Mark it done so it stops being retried.
      if (!devices || devices.length === 0) {
        await supabase
          .from('push_outbox')
          .update({ status: 'sent', sent_at: new Date().toISOString(), last_error: 'no devices' })
          .eq('id', msg.id);
        continue;
      }

      let anyDelivered = false;
      let lastError = '';

      for (const device of devices) {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token: device.token,
              notification: { title: msg.title, body: msg.body },
              // Read by the app on tap to deep-link to the right screen.
              data: { route: msg.route ?? '/student/dashboard' },
              android: { priority: 'HIGH' },
              apns: { payload: { aps: { sound: 'default' } } },
            },
          }),
        });

        if (res.ok) {
          anyDelivered = true;
          continue;
        }

        const errText = await res.text();
        lastError = `${res.status}: ${errText.slice(0, 200)}`;

        // FCM reports uninstalled apps and rotated tokens this way. Keeping
        // them would mean retrying dead devices forever.
        if (
          res.status === 404 ||
          errText.includes('UNREGISTERED') ||
          errText.includes('INVALID_ARGUMENT')
        ) {
          deadTokens.push(device.token);
        }
      }

      if (anyDelivered) {
        sent++;
        await supabase
          .from('push_outbox')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', msg.id);
      } else {
        failed++;
        const attempts = (msg.attempts ?? 0) + 1;
        await supabase
          .from('push_outbox')
          .update({
            // Give up after five tries so one broken row cannot occupy the
            // batch forever and starve everything behind it.
            status: attempts >= 5 ? 'failed' : 'pending',
            attempts,
            last_error: lastError,
          })
          .eq('id', msg.id);
      }
    }

    if (deadTokens.length > 0) {
      await supabase.from('device_tokens').delete().in('token', deadTokens);
    }

    return Response.json({ sent, failed, pruned: deadTokens.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('send-push error:', message);
    return Response.json({ error: message }, { status: 500 });
  }
});
