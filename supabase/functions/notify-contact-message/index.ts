/**
 * notify-contact-message
 *
 * Emails support@ when someone uses the public contact form.
 *
 * Deploy:
 *   supabase functions deploy notify-contact-message --no-verify-jwt
 *
 * Secrets (already set for the other mail functions):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_SECURE
 *   CONTACT_INBOX — optional; defaults to support@schoolsyncedu.com
 *
 * Deliberately best-effort. The message is already stored by
 * submit_contact_message before this is called, so a failure here loses a
 * notification, never an enquiry. That ordering is the whole point: the
 * previous version of this form had email as the only channel, except it never
 * actually sent, and messages vanished with nothing to recover.
 *
 * --no-verify-jwt because the sender is an anonymous visitor.
 */

import nodemailer from 'npm:nodemailer@6.9.9';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { name, email, subject, message } = await req.json() as {
      name?: string; email?: string; subject?: string; message?: string;
    };

    if (!name || !email || !message) {
      return Response.json({ error: 'name, email and message are required' }, {
        status: 400, headers: corsHeaders,
      });
    }

    const smtpHost = Deno.env.get('SMTP_HOST');
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPass = Deno.env.get('SMTP_PASS');
    if (!smtpHost || !smtpUser || !smtpPass) {
      // Not fatal: the enquiry is already recorded and readable in the admin
      // Messages page. Report it so the caller can log, not so it can retry.
      return Response.json({ ok: false, reason: 'SMTP not configured' }, { headers: corsHeaders });
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(Deno.env.get('SMTP_PORT') || 587),
      secure: Deno.env.get('SMTP_SECURE') === 'true',
      auth: { user: smtpUser, pass: smtpPass },
    });

    const inbox = Deno.env.get('CONTACT_INBOX') || 'support@schoolsyncedu.com';
    const from = Deno.env.get('SMTP_FROM') || smtpUser;

    await transporter.sendMail({
      from: `"SchoolSync" <${from}>`,
      to: inbox,
      // replyTo is what makes this useful: hitting Reply in the inbox answers
      // the visitor directly instead of writing back to our own address.
      replyTo: `"${name}" <${email}>`,
      subject: `Contact form: ${subject || 'New message'}`,
      text: `From: ${name} <${email}>\nSubject: ${subject ?? '(none)'}\n\n${message}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:600px;">
          <h2 style="margin:0 0 4px;font-size:18px;color:#111827;">New contact form message</h2>
          <p style="margin:0 0 16px;font-size:13px;color:#6b7280;">
            Reply to this email to answer ${escapeHtml(name)} directly.
          </p>
          <table style="font-size:14px;color:#374151;border-collapse:collapse;">
            <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Name</td><td>${escapeHtml(name)}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Email</td><td>${escapeHtml(email)}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Subject</td><td>${escapeHtml(subject ?? '(none)')}</td></tr>
          </table>
          <div style="margin-top:16px;padding:14px;background:#f9fafb;border-radius:8px;
                      font-size:14px;color:#111827;white-space:pre-wrap;">${escapeHtml(message)}</div>
          <p style="margin-top:16px;font-size:12px;color:#9ca3af;">
            Also saved in the admin Messages page, whether or not this email arrives.
          </p>
        </div>`,
    });

    return Response.json({ ok: true }, { headers: corsHeaders });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('notify-contact-message failed:', msg);
    return Response.json({ ok: false, reason: msg }, { headers: corsHeaders });
  }
});
