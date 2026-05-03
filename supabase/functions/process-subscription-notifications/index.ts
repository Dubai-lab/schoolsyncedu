// Supabase Edge Function: process-subscription-notifications
// Daily batch processor for subscription lifecycle email notifications.
//
// Schedule via Supabase Cron (Dashboard → Edge Functions → Cron) or pg_cron:
//   SELECT cron.schedule('notify-subscriptions', '0 8 * * *', $$
//     SELECT net.http_post(url := 'https://<project>.supabase.co/functions/v1/process-subscription-notifications',
//       headers := '{"Authorization":"Bearer <anon_key>"}'::jsonb) $$);
//
// Env secrets needed:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_SECURE
//   APP_URL

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6.9.9';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── HTML email builder helpers ────────────────────────────────────────────────

function escapeHtml(t: string) {
  return t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c] ?? c));
}

function emailWrapper(content: string, year: number) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>SchoolSync Notification</title></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f7fa;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
  ${content}
  <div style="background:#f9fafb;padding:20px 32px;text-align:center;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;">
    <p style="margin:0;">© ${year} SchoolSync · EduLiberia · Monrovia, Liberia</p>
    <p style="margin:6px 0 0;">You are receiving this because your school has an active subscription on SchoolSync.</p>
  </div>
</div>
</body></html>`;
}

function headerBlock(title: string, subtitle: string, color = '#1e40af') {
  return `<div style="background:${color};padding:40px 32px;text-align:center;">
    <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">${title}</h1>
    <p style="margin:8px 0 0;color:rgba(255,255,255,.8);font-size:14px;">${subtitle}</p>
  </div>`;
}

function ctaButton(label: string, url: string) {
  return `<div style="text-align:center;margin:32px 0;">
    <a href="${url}" style="display:inline-block;background:#1e40af;color:#fff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:10px;box-shadow:0 4px 12px rgba(30,64,175,.3);">${label}</a>
  </div>`;
}

function alertBox(text: string, color = '#fef3c7', border = '#f59e0b', textColor = '#92400e') {
  return `<div style="background:${color};border-left:4px solid ${border};border-radius:6px;padding:16px 20px;margin:20px 0;">
    <p style="margin:0;font-size:14px;color:${textColor};">${text}</p>
  </div>`;
}

// ── Individual email builders ─────────────────────────────────────────────────

function buildTrialReminderEmail(schoolName: string, ownerName: string, daysLeft: number, loginUrl: string, billingUrl: string) {
  const urgent = daysLeft <= 1;
  return emailWrapper(`
    ${headerBlock(
      urgent ? `Your trial ends tomorrow!` : `Your trial ends in ${daysLeft} days`,
      schoolName,
      urgent ? '#dc2626' : '#d97706'
    )}
    <div style="padding:36px 32px;">
      <p style="margin:0 0 16px;font-size:16px;color:#1f2937;">Hi <strong>${escapeHtml(ownerName)}</strong>,</p>
      ${alertBox(
        urgent
          ? `Your free trial for <strong>${escapeHtml(schoolName)}</strong> expires <strong>tomorrow</strong>. Upgrade now to avoid losing access.`
          : `Your free trial for <strong>${escapeHtml(schoolName)}</strong> ends in <strong>${daysLeft} day${daysLeft !== 1 ? 's' : ''}</strong>.`,
        urgent ? '#fee2e2' : '#fef3c7',
        urgent ? '#dc2626' : '#f59e0b',
        urgent ? '#991b1b' : '#92400e'
      )}
      <p style="margin:16px 0;font-size:14px;color:#4b5563;line-height:1.7;">
        Don't lose your student records, grades, attendance data, and everything you've set up.
        Upgrade to a paid plan to keep full access to SchoolSync.
      </p>
      <p style="margin:16px 0;font-size:14px;color:#4b5563;">
        To upgrade, log in to your school portal and go to <a href="${billingUrl}" style="color:#1e40af;text-decoration:underline;">Billing &amp; Subscription</a>.
      </p>
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        Questions? Email <a href="mailto:support@schoolsyncedu.com" style="color:#1e40af;text-decoration:none;">support@schoolsyncedu.com</a>
      </p>
    </div>`, new Date().getFullYear());
}

function buildExpiryReminderEmail(schoolName: string, ownerName: string, daysLeft: number, billingUrl: string) {
  const urgent = daysLeft <= 1;
  return emailWrapper(`
    ${headerBlock(
      urgent ? 'Your subscription expires tomorrow!' : `Subscription expiring in ${daysLeft} days`,
      schoolName,
      urgent ? '#dc2626' : '#d97706'
    )}
    <div style="padding:36px 32px;">
      <p style="margin:0 0 16px;font-size:16px;color:#1f2937;">Hi <strong>${escapeHtml(ownerName)}</strong>,</p>
      ${alertBox(
        urgent
          ? `Your SchoolSync subscription for <strong>${escapeHtml(schoolName)}</strong> expires <strong>tomorrow</strong>. Renew now to avoid service interruption.`
          : `Your SchoolSync subscription for <strong>${escapeHtml(schoolName)}</strong> will expire in <strong>${daysLeft} day${daysLeft !== 1 ? 's' : ''}</strong>. Renew early to stay uninterrupted.`,
        urgent ? '#fee2e2' : '#fef3c7',
        urgent ? '#dc2626' : '#f59e0b',
        urgent ? '#991b1b' : '#92400e'
      )}
      <p style="margin:16px 0;font-size:14px;color:#4b5563;">
        To renew, log in to your school portal and go to <a href="${billingUrl}" style="color:#1e40af;text-decoration:underline;">Billing &amp; Subscription</a>.
      </p>
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        Questions? Email <a href="mailto:support@schoolsyncedu.com" style="color:#1e40af;text-decoration:none;">support@schoolsyncedu.com</a>
      </p>
    </div>`, new Date().getFullYear());
}

function buildGraceStartEmail(schoolName: string, ownerName: string, graceDays: number, billingUrl: string) {
  return emailWrapper(`
    ${headerBlock('Grace Period Started', schoolName, '#d97706')}
    <div style="padding:36px 32px;">
      <p style="margin:0 0 16px;font-size:16px;color:#1f2937;">Hi <strong>${escapeHtml(ownerName)}</strong>,</p>
      ${alertBox(
        `Your subscription for <strong>${escapeHtml(schoolName)}</strong> has expired, but we've given you a <strong>${graceDays}-day grace period</strong> to renew and keep your data safe.`
      )}
      <p style="margin:16px 0;font-size:14px;color:#4b5563;line-height:1.7;">
        During the grace period, your school portal remains accessible. However, if you don't renew before the grace period ends, your school will be suspended and staff/students won't be able to log in.
      </p>
      <p style="margin:16px 0;font-size:14px;color:#4b5563;">
        To renew, log in to your school portal and go to <a href="${billingUrl}" style="color:#1e40af;text-decoration:underline;">Billing &amp; Subscription</a>.
      </p>
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        Questions? Email <a href="mailto:support@schoolsyncedu.com" style="color:#1e40af;text-decoration:none;">support@schoolsyncedu.com</a>
      </p>
    </div>`, new Date().getFullYear());
}

function buildGraceReminderEmail(schoolName: string, ownerName: string, daysLeft: number, billingUrl: string) {
  return emailWrapper(`
    ${headerBlock(`Grace period ends in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}!`, schoolName, '#dc2626')}
    <div style="padding:36px 32px;">
      <p style="margin:0 0 16px;font-size:16px;color:#1f2937;">Hi <strong>${escapeHtml(ownerName)}</strong>,</p>
      ${alertBox(
        `This is an urgent reminder: the grace period for <strong>${escapeHtml(schoolName)}</strong> ends in <strong>${daysLeft} day${daysLeft !== 1 ? 's' : ''}</strong>. After this, your school will be suspended.`,
        '#fee2e2', '#dc2626', '#991b1b'
      )}
      <p style="margin:16px 0;font-size:14px;color:#4b5563;line-height:1.7;">
        Once suspended, staff and students will not be able to log in. Your data is preserved — simply renew to restore access immediately.
      </p>
      <p style="margin:16px 0;font-size:14px;color:#4b5563;">
        To renew, log in to your school portal and go to <a href="${billingUrl}" style="color:#1e40af;text-decoration:underline;">Billing &amp; Subscription</a>.
      </p>
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        Questions? Email <a href="mailto:support@schoolsyncedu.com" style="color:#1e40af;text-decoration:none;">support@schoolsyncedu.com</a>
      </p>
    </div>`, new Date().getFullYear());
}

function buildSuspendedEmail(schoolName: string, ownerName: string, billingUrl: string) {
  return emailWrapper(`
    ${headerBlock('Your School Has Been Suspended', schoolName, '#dc2626')}
    <div style="padding:36px 32px;">
      <p style="margin:0 0 16px;font-size:16px;color:#1f2937;">Hi <strong>${escapeHtml(ownerName)}</strong>,</p>
      ${alertBox(
        `<strong>${escapeHtml(schoolName)}</strong> has been suspended due to a lapsed subscription. Staff and students can no longer log in.`,
        '#fee2e2', '#dc2626', '#991b1b'
      )}
      <p style="margin:16px 0;font-size:14px;color:#4b5563;line-height:1.7;">
        Your data is safe and securely stored. To restore access immediately, renew your subscription. Access will be restored within minutes of payment.
      </p>
      <p style="margin:16px 0;font-size:14px;color:#4b5563;">
        To renew, log in to your school portal and go to <a href="${billingUrl}" style="color:#1e40af;text-decoration:underline;">Billing &amp; Subscription</a>.
      </p>
      <p style="margin:16px 0;font-size:13px;color:#4b5563;line-height:1.7;">
        Need a payment extension or have billing questions? Contact us at
        <a href="mailto:support@schoolsyncedu.com" style="color:#1e40af;text-decoration:none;">support@schoolsyncedu.com</a>.
      </p>
    </div>`, new Date().getFullYear());
}

function buildReactivatedEmail(schoolName: string, ownerName: string, planName: string, expiresAt: string, loginUrl: string) {
  return emailWrapper(`
    ${headerBlock('Your School Is Active Again!', schoolName, '#16a34a')}
    <div style="padding:36px 32px;">
      <p style="margin:0 0 16px;font-size:16px;color:#1f2937;">Hi <strong>${escapeHtml(ownerName)}</strong>,</p>
      <p style="margin:0 0 16px;font-size:14px;color:#4b5563;line-height:1.7;">
        Great news! <strong>${escapeHtml(schoolName)}</strong> has been successfully reactivated on the <strong>${escapeHtml(planName)}</strong> plan.
        Staff and students can now log in again.
      </p>
      <div style="background:#f0fdf4;border-left:4px solid #16a34a;border-radius:6px;padding:16px 20px;margin:20px 0;">
        <p style="margin:0;font-size:13px;color:#166534;">Active until: <strong>${escapeHtml(expiresAt)}</strong></p>
      </div>
      <p style="margin:24px 0 0;font-size:13px;color:#4b5563;">
        Log in to your school portal at:
        <a href="${loginUrl}" style="color:#1e40af;text-decoration:underline;">${loginUrl}</a>
      </p>
    </div>`, new Date().getFullYear());
}

function buildPaymentPendingEmail(schoolName: string, ownerName: string, planName: string) {
  return emailWrapper(`
    ${headerBlock('Payment Pending — Action Required', schoolName, '#d97706')}
    <div style="padding:36px 32px;">
      <p style="margin:0 0 16px;font-size:16px;color:#1f2937;">Hi <strong>${escapeHtml(ownerName)}</strong>,</p>
      <p style="margin:0 0 16px;font-size:14px;color:#4b5563;line-height:1.7;">
        Thank you for registering <strong>${escapeHtml(schoolName)}</strong> on SchoolSync.
        Your school account has been created and is currently on the <strong>${escapeHtml(planName)}</strong> plan.
      </p>
      ${alertBox(`Your subscription payment has not yet been received. Your school is currently in a <strong>trial/grace period</strong>. To avoid interruption, please complete your payment as soon as possible.`)}
      <p style="margin:20px 0 8px;font-size:14px;font-weight:600;color:#1f2937;">How to pay:</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin:0 0 24px;">
        ${[
          ['Bank Transfer', 'Contact us for our Liberia bank account details'],
          ['Mobile Money', 'MTN or Orange Money — contact support for number'],
          ['Other Methods', 'We are flexible — reach out and we will work with you'],
        ].map(([method, detail]) => `
        <tr>
          <td style="padding:10px 12px;background:#f9fafb;color:#6b7280;border-bottom:1px solid #e5e7eb;font-weight:500;width:35%;">${method}</td>
          <td style="padding:10px 12px;color:#1f2937;border-bottom:1px solid #e5e7eb;">${detail}</td>
        </tr>`).join('')}
      </table>
      <p style="margin:0 0 20px;font-size:13px;color:#4b5563;line-height:1.7;">
        Once payment is confirmed, our team will activate your subscription and send you a payment receipt.
        If you have already made a payment, please reply to this email with your transfer reference.
      </p>
      <p style="margin:0;font-size:13px;color:#4b5563;">
        Questions? Contact us at
        <a href="mailto:billing@schoolsyncedu.com" style="color:#1e40af;text-decoration:none;font-weight:500;">billing@schoolsyncedu.com</a>
        or <a href="mailto:support@schoolsyncedu.com" style="color:#1e40af;text-decoration:none;">support@schoolsyncedu.com</a>.
      </p>
    </div>`, new Date().getFullYear());
}

function buildSubdomainReceiptEmail(schoolName: string, ownerName: string, subdomain: string, plan: string, amount: string, paidUntil: string, renewUrl: string) {
  const planLabel = plan === 'yearly' ? 'Annual' : 'Monthly';
  return emailWrapper(`
    ${headerBlock('Subdomain Payment Confirmed', schoolName, '#16a34a')}
    <div style="padding:36px 32px;">
      <p style="margin:0 0 16px;font-size:16px;color:#1f2937;">Hi <strong>${escapeHtml(ownerName)}</strong>,</p>
      <p style="margin:0 0 20px;font-size:14px;color:#4b5563;line-height:1.7;">
        Your branded subdomain is now active. Here are your payment details:
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin:0 0 24px;">
        ${[
          ['Subdomain', `${escapeHtml(subdomain)}.schoolsyncedu.com`],
          ['Plan', planLabel],
          ['Amount Paid', amount],
          ['Active Until', paidUntil],
        ].map(([label, value]) => `
        <tr>
          <td style="padding:10px 12px;background:#f9fafb;color:#6b7280;border-bottom:1px solid #e5e7eb;font-weight:500;width:40%;">${label}</td>
          <td style="padding:10px 12px;color:#1f2937;border-bottom:1px solid #e5e7eb;font-weight:600;">${value}</td>
        </tr>`).join('')}
      </table>
      <p style="margin:0 0 16px;font-size:14px;color:#4b5563;">
        Your school site is now accessible at:
        <a href="https://${escapeHtml(subdomain)}.schoolsyncedu.com" style="color:#1e40af;text-decoration:underline;">https://${escapeHtml(subdomain)}.schoolsyncedu.com</a>
      </p>
      <p style="margin:0 0 16px;font-size:13px;color:#6b7280;">
        To manage your subdomain, visit your school settings in the proprietor dashboard.
      </p>
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        Keep this email as your receipt. Questions? <a href="mailto:billing@schoolsyncedu.com" style="color:#1e40af;text-decoration:none;">billing@schoolsyncedu.com</a>
      </p>
    </div>`, new Date().getFullYear());
}

function buildSubdomainExpiryReminderEmail(schoolName: string, ownerName: string, subdomain: string, daysLeft: number, renewUrl: string) {
  const urgent = daysLeft <= 1;
  return emailWrapper(`
    ${headerBlock(
      urgent ? 'Your subdomain expires tomorrow!' : `Subdomain expiring in ${daysLeft} days`,
      schoolName,
      urgent ? '#dc2626' : '#d97706'
    )}
    <div style="padding:36px 32px;">
      <p style="margin:0 0 16px;font-size:16px;color:#1f2937;">Hi <strong>${escapeHtml(ownerName)}</strong>,</p>
      ${alertBox(
        urgent
          ? `Your branded subdomain <strong>${escapeHtml(subdomain)}.schoolsyncedu.com</strong> expires <strong>tomorrow</strong>. Renew now to avoid your school site going offline.`
          : `Your branded subdomain <strong>${escapeHtml(subdomain)}.schoolsyncedu.com</strong> will expire in <strong>${daysLeft} days</strong>. Renew early to stay uninterrupted.`,
        urgent ? '#fee2e2' : '#fef3c7',
        urgent ? '#dc2626' : '#f59e0b',
        urgent ? '#991b1b' : '#92400e'
      )}
      <p style="margin:16px 0;font-size:14px;color:#4b5563;">
        To renew, log in to your proprietor dashboard and go to <a href="${renewUrl}" style="color:#1e40af;text-decoration:underline;">School Settings → Custom Subdomain</a>.
      </p>
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        Questions? <a href="mailto:support@schoolsyncedu.com" style="color:#1e40af;text-decoration:none;">support@schoolsyncedu.com</a>
      </p>
    </div>`, new Date().getFullYear());
}

function buildSubdomainGraceEmail(schoolName: string, ownerName: string, subdomain: string, graceEndsAt: string, renewUrl: string) {
  return emailWrapper(`
    ${headerBlock('Subdomain Expired — 24-Hour Grace Period', schoolName, '#d97706')}
    <div style="padding:36px 32px;">
      <p style="margin:0 0 16px;font-size:16px;color:#1f2937;">Hi <strong>${escapeHtml(ownerName)}</strong>,</p>
      ${alertBox(
        `Your subdomain <strong>${escapeHtml(subdomain)}.schoolsyncedu.com</strong> has expired, but your school site is still accessible for a <strong>24-hour grace period</strong> ending at <strong>${escapeHtml(graceEndsAt)}</strong>. Renew before then to avoid any downtime.`
      )}
      <p style="margin:16px 0;font-size:14px;color:#4b5563;line-height:1.7;">
        After the grace period ends, your subdomain will be deactivated and visitors will no longer be able to reach your school site via
        <strong>${escapeHtml(subdomain)}.schoolsyncedu.com</strong>.
        Your data is safe — renewing will restore it immediately.
      </p>
      <p style="margin:16px 0;font-size:14px;color:#4b5563;">
        To renew, log in to your proprietor dashboard and go to <a href="${renewUrl}" style="color:#1e40af;text-decoration:underline;">School Settings → Custom Subdomain</a>.
      </p>
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        Questions? <a href="mailto:support@schoolsyncedu.com" style="color:#1e40af;text-decoration:none;">support@schoolsyncedu.com</a>
      </p>
    </div>`, new Date().getFullYear());
}

function buildPaymentConfirmedEmail(schoolName: string, ownerName: string, planName: string, amount: string, invoiceNumber: string, expiresAt: string, loginUrl: string) {
  return emailWrapper(`
    ${headerBlock('Payment Confirmed', schoolName, '#16a34a')}
    <div style="padding:36px 32px;">
      <p style="margin:0 0 16px;font-size:16px;color:#1f2937;">Hi <strong>${escapeHtml(ownerName)}</strong>,</p>
      <p style="margin:0 0 20px;font-size:14px;color:#4b5563;line-height:1.7;">
        Your payment has been received and your subscription is now active. Here are your details:
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin:0 0 24px;">
        ${[
          ['Invoice', invoiceNumber],
          ['Plan', planName],
          ['Amount Paid', amount],
          ['Valid Until', expiresAt],
        ].map(([label, value]) => `
        <tr>
          <td style="padding:10px 12px;background:#f9fafb;color:#6b7280;border-bottom:1px solid #e5e7eb;font-weight:500;width:40%;">${label}</td>
          <td style="padding:10px 12px;color:#1f2937;border-bottom:1px solid #e5e7eb;font-weight:600;">${escapeHtml(value)}</td>
        </tr>`).join('')}
      </table>
      <p style="margin:0 0 12px;font-size:13px;color:#4b5563;">
        Log in to your school portal at:
        <a href="${loginUrl}" style="color:#1e40af;text-decoration:underline;">${loginUrl}</a>
      </p>
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        Keep this email as your receipt. Questions? <a href="mailto:billing@schoolsyncedu.com" style="color:#1e40af;text-decoration:none;">billing@schoolsyncedu.com</a>
      </p>
    </div>`, new Date().getFullYear());
}

// ── Main serve handler ────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const appUrl = Deno.env.get('APP_URL') || 'https://schoolsyncedu.com';
    const loginUrl = `${appUrl}/auth/login`;
    const year = new Date().getFullYear();

    // ── SMTP setup (support) ──────────────────────────────────────
    const smtpHost = Deno.env.get('SMTP_HOST');
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPass = Deno.env.get('SMTP_PASS');
    const fromAddress = Deno.env.get('SMTP_FROM') || smtpUser;

    if (!smtpHost || !smtpUser || !smtpPass) {
      return new Response(JSON.stringify({ error: 'SMTP not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(Deno.env.get('SMTP_PORT') || 587),
      secure: Deno.env.get('SMTP_SECURE') === 'true',
      auth: { user: smtpUser, pass: smtpPass },
    });

    // ── SMTP setup (billing) ──────────────────────────────────────
    const billingHost = Deno.env.get('SMTP_BILLING_HOST') || smtpHost;
    const billingUser = Deno.env.get('SMTP_BILLING_USER') || smtpUser;
    const billingPass = Deno.env.get('SMTP_BILLING_PASS') || smtpPass;
    const billingFrom = Deno.env.get('SMTP_BILLING_FROM') || 'billing@schoolsyncedu.com';

    const billingTransporter = nodemailer.createTransport({
      host: billingHost,
      port: Number(Deno.env.get('SMTP_BILLING_PORT') || 587),
      secure: Deno.env.get('SMTP_BILLING_SECURE') === 'true',
      auth: { user: billingUser, pass: billingPass },
    });

    // ── Direct trigger mode (payment_confirmed, reactivated, etc.) ────────────
    const body = req.method === 'POST'
      ? await req.json().catch(() => ({}))
      : {};

    if (body?.trigger === 'payment_confirmed') {
      const {
        school_id, school_name, owner_email, plan_name,
        amount_usd, amount_lrd, payment_method,
      } = body as {
        school_id?: string; school_name?: string; owner_email?: string;
        plan_name?: string; amount_usd?: number; amount_lrd?: number; payment_method?: string;
      };

      if (!school_id || !owner_email || !school_name) {
        return new Response(JSON.stringify({ error: 'school_id, owner_email and school_name required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!amount_usd || amount_usd <= 0) {
        return new Response(JSON.stringify({ error: 'amount_usd is required and must be greater than 0' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ── Activate subscription + generate invoice atomically via RPC ──────────
      const { data: confirmation, error: rpcError } = await supabase.rpc('confirm_subscription_payment', {
        p_school_id:      school_id,
        p_amount_usd:     amount_usd,
        p_amount_lrd:     amount_lrd ?? null,
        p_payment_method: payment_method || 'bank',
        p_invoice_number: null, // auto-generated by DB
      });

      if (rpcError) {
        console.error('confirm_subscription_payment RPC error:', rpcError.message);
        return new Response(JSON.stringify({ error: `Failed to activate subscription: ${rpcError.message}` }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const invoiceNumber = (confirmation as any)?.invoice_number || 'N/A';
      const expiresAt     = (confirmation as any)?.expires_at;
      const expiresFormatted = expiresAt
        ? new Date(expiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        : 'N/A';

      // ── Send payment receipt email from billing@ ─────────────────────────────
      const amountDisplay = amount_lrd && amount_lrd > 0
        ? `LRD ${Number(amount_lrd).toLocaleString()} ($${Number(amount_usd).toFixed(2)} USD)`
        : `$${Number(amount_usd).toFixed(2)} USD`;

      await billingTransporter.sendMail({
        from: `"SchoolSync Billing" <${billingFrom}>`,
        to: owner_email,
        subject: `Payment Confirmed — ${school_name} subscription is now active`,
        html: buildPaymentConfirmedEmail(
          school_name, owner_email,
          plan_name || 'Standard',
          amountDisplay,
          invoiceNumber,
          expiresFormatted,
          loginUrl,
        ),
        text: `Your payment for ${school_name} has been confirmed.\nInvoice: ${invoiceNumber}\nAmount: ${amountDisplay}\nActive until: ${expiresFormatted}\n\nLog in at ${loginUrl}`,
      });

      await supabase.from('notification_logs').insert({
        school_id,
        event_type: 'payment_confirmed',
        recipient_email: owner_email,
        metadata: { plan_name, amount_usd, amount_lrd, invoice_number: invoiceNumber, expires_at: expiresAt },
      });

      console.log(`Payment confirmed for ${school_name} — Invoice ${invoiceNumber}, active until ${expiresFormatted}`);

      return new Response(JSON.stringify({
        success: true,
        trigger: 'payment_confirmed',
        invoice_number: invoiceNumber,
        expires_at: expiresAt,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (body?.trigger === 'reactivated') {
      const { school_id, school_name, owner_email, plan_name, expires_at } = body as {
        school_id?: string; school_name?: string; owner_email?: string;
        plan_name?: string; expires_at?: string;
      };

      if (!owner_email || !school_name) {
        return new Response(JSON.stringify({ error: 'owner_email and school_name required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const expiresFormatted = expires_at
        ? new Date(expires_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        : 'N/A';

      await transporter.sendMail({
        from: `"SchoolSync" <${fromAddress}>`,
        to: owner_email,
        subject: `Great news — ${school_name} is active again!`,
        html: buildReactivatedEmail(school_name, owner_email, plan_name || 'Standard', expiresFormatted, loginUrl),
        text: `${school_name} has been reactivated on the ${plan_name} plan. Active until ${expiresFormatted}.\n\nLog in at ${loginUrl}`,
      });

      if (school_id) {
        await supabase.from('notification_logs').insert({
          school_id,
          event_type: 'reactivated',
          recipient_email: owner_email,
          metadata: { plan_name, expires_at },
        });
      }

      return new Response(JSON.stringify({ success: true, trigger: 'reactivated' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (body?.trigger === 'payment_pending') {
      const { school_id, school_name, owner_email, owner_name, plan_name } = body as {
        school_id?: string; school_name?: string; owner_email?: string;
        owner_name?: string; plan_name?: string;
      };

      if (!owner_email || !school_name) {
        return new Response(JSON.stringify({ error: 'owner_email and school_name required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await billingTransporter.sendMail({
        from: `"SchoolSync Billing" <${billingFrom}>`,
        to: owner_email,
        subject: `Action Required — Complete your payment for ${school_name}`,
        html: buildPaymentPendingEmail(school_name, owner_name || owner_email, plan_name || 'Free Trial'),
        text: `Hi ${owner_name || owner_email},\n\nYour school ${school_name} is registered on SchoolSync but payment has not been received.\n\nContact billing@schoolsyncedu.com or support@schoolsyncedu.com to complete your payment.\n\nSchoolSync Billing Team`,
      });

      if (school_id) {
        await supabase.from('notification_logs').insert({
          school_id,
          event_type: 'payment_pending',
          recipient_email: owner_email,
          metadata: { plan_name },
        });
      }

      return new Response(JSON.stringify({ success: true, trigger: 'payment_pending' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (body?.trigger === 'subdomain_payment_confirmed') {
      const { school_id, subdomain, amount_usd, plan, paid_until } = body as {
        school_id?: string; subdomain?: string; amount_usd?: number;
        plan?: string; paid_until?: string;
      };

      if (!school_id || !subdomain || !amount_usd || !paid_until) {
        return new Response(JSON.stringify({ error: 'school_id, subdomain, amount_usd, paid_until required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Look up school name + proprietor email from DB
      const { data: schoolRow } = await supabase
        .from('schools')
        .select('name')
        .eq('id', school_id)
        .single();

      const { data: ownerRow } = await supabase
        .from('users')
        .select('full_name, email')
        .eq('school_id', school_id)
        .eq('role', 'proprietor')
        .single();

      if (!ownerRow?.email || !schoolRow?.name) {
        return new Response(JSON.stringify({ error: 'Could not resolve school owner' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const paidUntilFormatted = new Date(paid_until).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      });
      const amountDisplay = `$${Number(amount_usd).toFixed(2)} USD`;
      const renewUrl = `${appUrl}/proprietor/settings`;

      await billingTransporter.sendMail({
        from: `"SchoolSync Billing" <${billingFrom}>`,
        to: ownerRow.email,
        subject: `Payment Confirmed — ${subdomain}.schoolsyncedu.com is active`,
        html: buildSubdomainReceiptEmail(
          schoolRow.name, ownerRow.full_name ?? ownerRow.email,
          subdomain, plan ?? 'monthly', amountDisplay, paidUntilFormatted, renewUrl,
        ),
        text: `Hi ${ownerRow.full_name ?? ownerRow.email},\n\nYour subdomain ${subdomain}.schoolsyncedu.com has been activated.\nPlan: ${plan === 'yearly' ? 'Annual' : 'Monthly'}\nAmount: ${amountDisplay}\nActive until: ${paidUntilFormatted}\n\nManage it at ${renewUrl}\n\nSchoolSync Billing`,
      });

      await supabase.from('notification_logs').insert({
        school_id,
        event_type: 'subdomain_payment_confirmed',
        recipient_email: ownerRow.email,
        metadata: { subdomain, amount_usd, plan, paid_until },
      });

      console.log(`Subdomain receipt sent to ${ownerRow.email} for ${subdomain}.schoolsyncedu.com`);

      return new Response(JSON.stringify({ success: true, trigger: 'subdomain_payment_confirmed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Fetch all non-expired subscriptions with plan + school + owner ─────────
    const { data: subscriptions, error: subError } = await supabase
      .from('subscriptions')
      .select(`
        id,
        school_id,
        status,
        expires_at,
        grace_days_remaining,
        suspended_at,
        plan_id,
        subscription_plans (
          id,
          name,
          trial_days,
          notification_config
        ),
        schools (
          id,
          name
        )
      `)
      .in('status', ['trial', 'active', 'grace', 'suspended']);

    if (subError) throw new Error(`Failed to fetch subscriptions: ${subError.message}`);
    if (!subscriptions?.length) {
      return new Response(JSON.stringify({ processed: 0, message: 'No active subscriptions' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Fetch owners for all relevant schools ─────────────────────────────────
    const schoolIds = [...new Set(subscriptions.map((s: any) => s.school_id))];
    const { data: owners, error: ownersError } = await supabase
      .from('users')
      .select('school_id, full_name, email')
      .in('school_id', schoolIds)
      .eq('role', 'proprietor');

    if (ownersError) throw new Error(`Failed to fetch owners: ${ownersError.message}`);

    const ownerMap = new Map<string, { full_name: string; email: string }>();
    for (const o of (owners || [])) {
      ownerMap.set(o.school_id, { full_name: o.full_name, email: o.email });
    }

    // ── Helper: send one email + log it ──────────────────────────────────────
    async function sendAndLog(params: {
      schoolId: string;
      subscriptionId: string;
      eventType: string;
      recipientEmail: string;
      subject: string;
      html: string;
      text: string;
      metadata?: Record<string, unknown>;
      withinHours?: number;
    }) {
      const { schoolId, subscriptionId, eventType, recipientEmail, subject, html, text, metadata, withinHours = 20 } = params;

      // Deduplication check
      const { data: alreadySent } = await supabase.rpc('notification_already_sent', {
        p_school_id: schoolId,
        p_event_type: eventType,
        p_within_hours: withinHours,
      });

      if (alreadySent) {
        console.log(`[SKIP] ${eventType} already sent for school ${schoolId}`);
        return false;
      }

      await transporter.sendMail({
        from: `"SchoolSync" <${fromAddress}>`,
        to: recipientEmail,
        subject,
        html,
        text,
      });

      await supabase.from('notification_logs').insert({
        school_id: schoolId,
        subscription_id: subscriptionId,
        event_type: eventType,
        recipient_email: recipientEmail,
        metadata: metadata || {},
      });

      console.log(`[SENT] ${eventType} → ${recipientEmail} (school: ${schoolId})`);
      return true;
    }

    // ── Process each subscription ─────────────────────────────────────────────
    let sentCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];
    const now = new Date();

    for (const sub of (subscriptions as any[])) {
      const plan = sub.subscription_plans;
      const school = sub.schools;
      const owner = ownerMap.get(sub.school_id);

      if (!plan || !school || !owner) {
        console.warn(`[SKIP] Missing plan/school/owner for subscription ${sub.id}`);
        skippedCount++;
        continue;
      }

      const config = plan.notification_config || {};
      const billingUrl = `${appUrl}/dashboard/billing`;
      const expiresAt = sub.expires_at ? new Date(sub.expires_at) : null;
      const daysUntilExpiry = expiresAt
        ? Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      try {
        // ── TRIAL reminders ──────────────────────────────────────
        if (sub.status === 'trial' && config.notify_on_trial_start !== false) {
          const reminderDays: number[] = config.trial_reminder_days || [3, 1];
          if (daysUntilExpiry !== null && reminderDays.includes(daysUntilExpiry)) {
            const eventType = `trial_reminder_${daysUntilExpiry}`;
            const sent = await sendAndLog({
              schoolId: sub.school_id,
              subscriptionId: sub.id,
              eventType,
              recipientEmail: owner.email,
              subject: daysUntilExpiry <= 1
                ? `⚠️ Your SchoolSync trial ends tomorrow — ${school.name}`
                : `Your SchoolSync free trial ends in ${daysUntilExpiry} days — ${school.name}`,
              html: buildTrialReminderEmail(school.name, owner.full_name, daysUntilExpiry, loginUrl, billingUrl),
              text: `Hi ${owner.full_name},\n\nYour free trial for ${school.name} ends in ${daysUntilExpiry} day(s). Upgrade now at ${billingUrl}\n\nSchoolSync Team`,
              metadata: { plan_name: plan.name, days_left: daysUntilExpiry },
            });
            if (sent) sentCount++;
          }
        }

        // ── ACTIVE subscription expiry reminders ─────────────────
        if (sub.status === 'active' && config.expiry_reminder_days) {
          const reminderDays: number[] = config.expiry_reminder_days || [7, 3, 1];
          if (daysUntilExpiry !== null && reminderDays.includes(daysUntilExpiry)) {
            const eventType = `expiry_reminder_${daysUntilExpiry}`;
            const sent = await sendAndLog({
              schoolId: sub.school_id,
              subscriptionId: sub.id,
              eventType,
              recipientEmail: owner.email,
              subject: daysUntilExpiry <= 1
                ? `⚠️ Subscription expires tomorrow — ${school.name}`
                : `Your SchoolSync subscription expires in ${daysUntilExpiry} days — ${school.name}`,
              html: buildExpiryReminderEmail(school.name, owner.full_name, daysUntilExpiry, billingUrl),
              text: `Hi ${owner.full_name},\n\nYour SchoolSync subscription for ${school.name} expires in ${daysUntilExpiry} day(s). Renew at ${billingUrl}\n\nSchoolSync Team`,
              metadata: { plan_name: plan.name, days_left: daysUntilExpiry },
            });
            if (sent) sentCount++;
          }
        }

        // ── GRACE period ─────────────────────────────────────────
        if (sub.status === 'grace') {
          // Grace start notification (send on the first day of grace)
          if (config.notify_on_grace_start !== false && daysUntilExpiry !== null) {
            const totalGraceDays = sub.grace_days_remaining || 7;

            // Grace start: fire once per grace period (first cron run after entering grace,
            // regardless of timing — dedup window covers the full grace period)
            const graceEventType = 'grace_start';
            const sent = await sendAndLog({
              schoolId: sub.school_id,
              subscriptionId: sub.id,
              eventType: graceEventType,
              recipientEmail: owner.email,
              subject: `Your SchoolSync subscription has expired — Grace period started (${school.name})`,
              html: buildGraceStartEmail(school.name, owner.full_name, totalGraceDays, billingUrl),
              text: `Hi ${owner.full_name},\n\nYour subscription for ${school.name} has expired. You have a ${totalGraceDays}-day grace period. Renew at ${billingUrl}\n\nSchoolSync Team`,
              metadata: { plan_name: plan.name, grace_days: totalGraceDays },
              withinHours: totalGraceDays * 24,
            });
            if (sent) sentCount++;

            // Grace reminder days
            const graceReminderDays: number[] = config.grace_reminder_days || [2];
            if (graceReminderDays.includes(daysUntilExpiry)) {
              const eventType = `grace_reminder_${daysUntilExpiry}`;
              const sent = await sendAndLog({
                schoolId: sub.school_id,
                subscriptionId: sub.id,
                eventType,
                recipientEmail: owner.email,
                subject: `🚨 Grace period ends in ${daysUntilExpiry} day(s) — ${school.name} will be suspended`,
                html: buildGraceReminderEmail(school.name, owner.full_name, daysUntilExpiry, billingUrl),
                text: `Hi ${owner.full_name},\n\nURGENT: The grace period for ${school.name} ends in ${daysUntilExpiry} day(s). Renew now at ${billingUrl} or your school will be suspended.\n\nSchoolSync Team`,
                metadata: { plan_name: plan.name, days_left: daysUntilExpiry },
              });
              if (sent) sentCount++;
            }
          }
        }

        // ── SUSPENDED ────────────────────────────────────────────
        if (sub.status === 'suspended' && config.notify_on_suspended !== false) {
          // Only notify on suspension day (suspended_at within last 24h)
          const suspendedAt = sub.suspended_at ? new Date(sub.suspended_at) : null;
          const hoursSinceSuspension = suspendedAt
            ? (now.getTime() - suspendedAt.getTime()) / (1000 * 60 * 60)
            : 999;

          if (hoursSinceSuspension < 24) {
            const sent = await sendAndLog({
              schoolId: sub.school_id,
              subscriptionId: sub.id,
              eventType: 'suspended',
              recipientEmail: owner.email,
              subject: `Your SchoolSync school has been suspended — ${school.name}`,
              html: buildSuspendedEmail(school.name, owner.full_name, billingUrl),
              text: `Hi ${owner.full_name},\n\n${school.name} has been suspended due to a lapsed subscription. Renew at ${billingUrl} to restore access.\n\nSchoolSync Team`,
              metadata: { plan_name: plan.name },
            });
            if (sent) sentCount++;
          }
        }

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[ERROR] Failed processing subscription ${sub.id}:`, msg);
        errors.push(`sub:${sub.id} — ${msg}`);
      }
    }

    console.log(`Subscription notifications: ${sentCount} sent, ${skippedCount} skipped, ${errors.length} errors`);

    // ── Subdomain renewal reminders ───────────────────────────────────────────
    // Fetch active subdomains expiring within 7 days OR already in grace (within 24h past expiry)
    const graceCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const warnCutoff  = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: subdomainSchools } = await supabase
      .from('schools')
      .select('id, name, subdomain, subdomain_paid_until')
      .eq('subdomain_active', true)
      .gt('subdomain_paid_until', graceCutoff)   // still within grace or not yet expired
      .lt('subdomain_paid_until', warnCutoff);   // expires within 7 days (or already past)

    let subSentCount = 0;

    for (const school of (subdomainSchools ?? [])) {
      if (!school.subdomain || !school.subdomain_paid_until) continue;

      const owner = ownerMap.get(school.id);
      if (!owner) continue;

      const paidUntil     = new Date(school.subdomain_paid_until);
      const msUntilExpiry = paidUntil.getTime() - now.getTime();
      const daysLeft      = Math.ceil(msUntilExpiry / (1000 * 60 * 60 * 24));
      const renewUrl      = `${appUrl}/proprietor/settings`;

      try {
        if (msUntilExpiry < 0) {
          // In grace period — fire once per grace window
          const graceEnd = new Date(paidUntil.getTime() + 24 * 60 * 60 * 1000);
          const graceEndsFormatted = graceEnd.toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
          });

          const { data: alreadySent } = await supabase.rpc('notification_already_sent', {
            p_school_id:    school.id,
            p_event_type:   'subdomain_grace_start',
            p_within_hours: 24,
          });

          if (!alreadySent) {
            await transporter.sendMail({
              from: `"SchoolSync" <${fromAddress}>`,
              to: owner.email,
              subject: `⚠️ Your subdomain has expired — 24-hour grace period active (${school.subdomain}.schoolsyncedu.com)`,
              html: buildSubdomainGraceEmail(school.name, owner.full_name, school.subdomain, graceEndsFormatted, renewUrl),
              text: `Hi ${owner.full_name},\n\nYour subdomain ${school.subdomain}.schoolsyncedu.com has expired but is still accessible until ${graceEndsFormatted}.\n\nRenew at ${renewUrl} to avoid downtime.\n\nSchoolSync Team`,
            });
            await supabase.from('notification_logs').insert({
              school_id: school.id,
              event_type: 'subdomain_grace_start',
              recipient_email: owner.email,
              metadata: { subdomain: school.subdomain, paid_until: school.subdomain_paid_until, grace_ends: graceEnd.toISOString() },
            });
            console.log(`[SENT] subdomain_grace_start → ${owner.email} (${school.subdomain})`);
            subSentCount++;
          } else {
            console.log(`[SKIP] subdomain_grace_start already sent for ${school.subdomain}`);
          }
        } else if ([7, 3, 1].includes(daysLeft)) {
          // Expiry reminder
          const eventType = `subdomain_expiry_${daysLeft}`;
          const { data: alreadySent } = await supabase.rpc('notification_already_sent', {
            p_school_id:    school.id,
            p_event_type:   eventType,
            p_within_hours: 20,
          });

          if (!alreadySent) {
            const paidUntilFormatted = paidUntil.toLocaleDateString('en-US', {
              year: 'numeric', month: 'long', day: 'numeric',
            });
            await transporter.sendMail({
              from: `"SchoolSync" <${fromAddress}>`,
              to: owner.email,
              subject: daysLeft <= 1
                ? `⚠️ Your subdomain expires tomorrow — ${school.subdomain}.schoolsyncedu.com`
                : `Your subdomain expires in ${daysLeft} days — ${school.subdomain}.schoolsyncedu.com`,
              html: buildSubdomainExpiryReminderEmail(school.name, owner.full_name, school.subdomain, daysLeft, renewUrl),
              text: `Hi ${owner.full_name},\n\nYour subdomain ${school.subdomain}.schoolsyncedu.com expires in ${daysLeft} day(s) on ${paidUntilFormatted}.\n\nRenew at ${renewUrl}\n\nSchoolSync Team`,
            });
            await supabase.from('notification_logs').insert({
              school_id: school.id,
              event_type: eventType,
              recipient_email: owner.email,
              metadata: { subdomain: school.subdomain, days_left: daysLeft, paid_until: school.subdomain_paid_until },
            });
            console.log(`[SENT] ${eventType} → ${owner.email} (${school.subdomain})`);
            subSentCount++;
          } else {
            console.log(`[SKIP] ${eventType} already sent for ${school.subdomain}`);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[ERROR] Subdomain reminder failed for school ${school.id}:`, msg);
        errors.push(`subdomain:${school.id} — ${msg}`);
      }
    }

    console.log(`Subdomain reminders: ${subSentCount} sent`);

    return new Response(
      JSON.stringify({
        success: true,
        subscriptions_processed: subscriptions.length,
        subscription_emails_sent: sentCount,
        subdomain_emails_sent: subSentCount,
        skipped: skippedCount,
        errors,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('process-subscription-notifications error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
