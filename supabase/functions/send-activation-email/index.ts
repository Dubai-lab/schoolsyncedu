/**
 * send-activation-email
 *
 * Sends the payment-confirmed / invoice email after a school is activated by
 * hand from the super admin queue.
 *
 * Deploy:
 *   supabase functions deploy send-activation-email
 *
 * Why this exists: activate_school_from_request writes a payment_confirmed row
 * to notification_logs, and I assumed that would send the mail. It does not —
 * notification_logs is an AUDIT LOG. process-subscription-notifications sends
 * first and inserts the row afterwards, so writing a row by hand records an
 * email that never existed. This actually sends it.
 *
 * Secrets (already used by the other mail functions):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE
 *   SMTP_BILLING_* override any of the above for billing mail
 *   SMTP_BILLING_FROM defaults to billing@schoolsyncedu.com
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6.9.9';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { school_id, invoice_number, amount_usd, payment_method, recipient_email } =
      await req.json() as {
        school_id?: string; invoice_number?: string; amount_usd?: number;
        payment_method?: string; recipient_email?: string;
      };

    if (!school_id) {
      return Response.json({ error: 'school_id is required' }, { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: school } = await supabase
      .from('schools')
      .select('name, principal_email, school_code')
      .eq('id', school_id)
      .maybeSingle();

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('expires_at, subscription_plans(name)')
      .eq('school_id', school_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Prefer the address the school gave on the request — it is the person who
    // actually arranged payment, and may not be the principal on file.
    const to = recipient_email || school?.principal_email;
    if (!to) {
      return Response.json({ ok: false, reason: 'No recipient address' }, { headers: corsHeaders });
    }

    const host = Deno.env.get('SMTP_BILLING_HOST') || Deno.env.get('SMTP_HOST');
    const user = Deno.env.get('SMTP_BILLING_USER') || Deno.env.get('SMTP_USER');
    const pass = Deno.env.get('SMTP_BILLING_PASS') || Deno.env.get('SMTP_PASS');
    if (!host || !user || !pass) {
      return Response.json({ ok: false, reason: 'SMTP not configured' }, { headers: corsHeaders });
    }

    const transporter = nodemailer.createTransport({
      host,
      port: Number(Deno.env.get('SMTP_BILLING_PORT') || Deno.env.get('SMTP_PORT') || 587),
      secure: (Deno.env.get('SMTP_BILLING_SECURE') || Deno.env.get('SMTP_SECURE')) === 'true',
      auth: { user, pass },
    });

    const from = Deno.env.get('SMTP_BILLING_FROM') || 'billing@schoolsyncedu.com';
    const planName =
      (sub as { subscription_plans?: { name?: string } } | null)?.subscription_plans?.name ?? 'your plan';
    const expires = sub?.expires_at
      ? new Date(sub.expires_at).toLocaleDateString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric',
        })
      : 'your next renewal date';
    const amount = `$${Number(amount_usd ?? 0).toFixed(2)} USD`;
    const schoolName = school?.name ?? 'Your school';
    const loginUrl = 'https://www.schoolsyncedu.com/auth/login';

    await transporter.sendMail({
      from: `"SchoolSync Billing" <${from}>`,
      to,
      subject: `Payment received — ${schoolName} is now active`,
      text:
        `Your payment for ${schoolName} has been received and your subscription is active.\n\n` +
        `Invoice: ${invoice_number ?? '—'}\nAmount: ${amount}\n` +
        `Method: ${payment_method ?? 'manual'}\nActive until: ${expires}\n\n` +
        `Log in at ${loginUrl}`,
      html: `
        <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;">
          <div style="background:#16a34a;padding:24px 28px;border-radius:12px 12px 0 0;">
            <h1 style="margin:0;font-size:20px;color:#fff;">Payment received</h1>
            <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,.85);">${esc(schoolName)}</p>
          </div>
          <div style="border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px;padding:28px;">
            <p style="margin:0 0 18px;font-size:15px;color:#1f2937;">
              Thank you. Your subscription is now <strong>active</strong>.
            </p>
            <table style="width:100%;font-size:14px;color:#374151;border-collapse:collapse;">
              ${[
                ['Invoice', invoice_number ?? '—'],
                ['Plan', planName],
                ['Amount', amount],
                ['Method', payment_method ?? 'manual'],
                ['Active until', expires],
              ].map(([k, v]) => `
                <tr>
                  <td style="padding:7px 0;color:#6b7280;">${esc(k)}</td>
                  <td style="padding:7px 0;text-align:right;font-weight:600;">${esc(String(v))}</td>
                </tr>`).join('')}
            </table>
            <a href="${loginUrl}"
               style="display:inline-block;margin-top:22px;background:#2d4fd6;color:#fff;
                      padding:11px 22px;border-radius:8px;text-decoration:none;
                      font-size:14px;font-weight:600;">Log in to SchoolSync</a>
            <p style="margin:22px 0 0;font-size:12px;color:#9ca3af;">
              Questions about this invoice? Reply to this email.
            </p>
          </div>
        </div>`,
    });

    return Response.json({ ok: true, sent_to: to }, { headers: corsHeaders });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('send-activation-email failed:', msg);
    return Response.json({ ok: false, reason: msg }, { headers: corsHeaders });
  }
});
