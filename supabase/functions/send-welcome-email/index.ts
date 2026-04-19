// Supabase Edge Function: send-welcome-email
// Sends a welcome email after successful school registration.
// Called from RegisterSchool.tsx immediately after register_school RPC succeeds.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6.9.9';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function escapeHtml(t: string) {
  return t.replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[c] ?? c));
}

function buildWelcomeHTML(ownerName: string, schoolName: string, planName: string, trialDays: number, loginUrl: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Welcome to SchoolSync</title></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f7fa;">
<div style="max-width:620px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#1e40af 0%,#1e3a5f 100%);padding:48px 32px;text-align:center;">
    <div style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;background:rgba(255,255,255,.15);border-radius:14px;margin-bottom:16px;">
      <span style="font-size:28px;">🎓</span>
    </div>
    <h1 style="margin:0;color:#fff;font-size:26px;font-weight:700;">Welcome to SchoolSync!</h1>
    <p style="margin:8px 0 0;color:rgba(255,255,255,.75);font-size:15px;">Your school account is ready</p>
  </div>

  <!-- Body -->
  <div style="padding:40px 32px;">
    <p style="margin:0 0 20px;font-size:16px;color:#1f2937;">Hi <strong>${escapeHtml(ownerName)}</strong>,</p>
    <p style="margin:0 0 20px;font-size:14px;color:#4b5563;line-height:1.7;">
      Congratulations! <strong>${escapeHtml(schoolName)}</strong> has been successfully registered on
      <strong>SchoolSync</strong>. You're now part of a growing community of schools across Liberia
      that are managing enrollment, grades, attendance, fees, and more — all in one platform.
    </p>

    <!-- Plan badge -->
    <div style="background:#eff6ff;border-left:4px solid #1e40af;border-radius:6px;padding:16px 20px;margin:24px 0;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">Your Plan</p>
      <p style="margin:0;font-size:18px;font-weight:700;color:#1e40af;">${escapeHtml(planName)}</p>
      ${trialDays > 0 ? `<p style="margin:6px 0 0;font-size:13px;color:#3b82f6;">✓ ${trialDays}-day free trial — no credit card required</p>` : ''}
    </div>

    <!-- Next steps -->
    <p style="margin:24px 0 12px;font-size:14px;font-weight:600;color:#1f2937;">Here's what to do next:</p>
    <table style="width:100%;border-collapse:collapse;">
      ${[
        ['1', 'Set up your school branding', 'Upload your logo, set your colors, and add your school motto'],
        ['2', 'Create your IT Admin account', 'Your IT Admin will manage users and system settings'],
        ['3', 'Invite your staff', 'Add your registrar, bursar, teachers, and other team members'],
        ['4', 'Enroll your first students', 'Import your student roster or add students one by one'],
      ].map(([num, title, desc]) => `
      <tr>
        <td style="vertical-align:top;padding:8px 12px 8px 0;width:32px;">
          <div style="width:28px;height:28px;border-radius:50%;background:#dbeafe;color:#1e40af;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;text-align:center;line-height:28px;">${num}</div>
        </td>
        <td style="vertical-align:top;padding:8px 0;">
          <p style="margin:0;font-size:13px;font-weight:600;color:#1f2937;">${title}</p>
          <p style="margin:2px 0 0;font-size:12px;color:#6b7280;">${desc}</p>
        </td>
      </tr>`).join('')}
    </table>

    <!-- CTA -->
    <div style="text-align:center;margin:36px 0 24px;">
      <a href="${loginUrl}" style="display:inline-block;background:#1e40af;color:#fff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:10px;box-shadow:0 4px 12px rgba(30,64,175,.3);">
        Go to My Dashboard →
      </a>
    </div>

    <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;line-height:1.6;">
      Need help getting started? Visit our
      <a href="https://schoolsyncedu.com/onboarding" style="color:#1e40af;text-decoration:none;">Onboarding Guide</a>
      or email us at
      <a href="mailto:support@schoolsyncedu.com" style="color:#1e40af;text-decoration:none;">support@schoolsyncedu.com</a>.
    </p>
  </div>

  <!-- Footer -->
  <div style="background:#f9fafb;padding:20px 32px;text-align:center;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;">
    <p style="margin:0;">© ${new Date().getFullYear()} SchoolSync · EduLiberia · Monrovia, Liberia</p>
    <p style="margin:6px 0 0;">This email was sent to you because you registered a school on SchoolSync.</p>
  </div>
</div>
</body></html>`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Verify caller is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user: caller }, error: authError } = await authClient.auth.getUser(jwt);
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { owner_name, owner_email, school_name, plan_name, trial_days, school_id } =
      await req.json() as {
        owner_name: string;
        owner_email: string;
        school_name: string;
        plan_name?: string;
        trial_days?: number;
        school_id?: string;
      };

    if (!owner_email || !owner_name || !school_name) {
      return new Response(JSON.stringify({ error: 'owner_name, owner_email, school_name required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Log to DB
    if (school_id) {
      await authClient.from('notification_logs').insert({
        school_id,
        event_type: 'welcome',
        recipient_email: owner_email,
        metadata: { school_name, plan_name, trial_days },
      });
    }

    // Send email
    const smtpHost = Deno.env.get('SMTP_HOST');
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPass = Deno.env.get('SMTP_PASS');
    const fromAddress = Deno.env.get('SMTP_FROM') || smtpUser;

    if (!smtpHost || !smtpUser || !smtpPass) {
      return new Response(JSON.stringify({ success: true, email_sent: false, reason: 'SMTP not configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(Deno.env.get('SMTP_PORT') || 587),
      secure: Deno.env.get('SMTP_SECURE') === 'true',
      auth: { user: smtpUser, pass: smtpPass },
    });

    const loginUrl = `${Deno.env.get('APP_URL') || 'https://schoolsyncedu.com'}/auth/login`;

    await transporter.sendMail({
      from: `"SchoolSync" <${fromAddress}>`,
      to: owner_email,
      subject: `Welcome to SchoolSync — ${school_name} is live! 🎓`,
      html: buildWelcomeHTML(owner_name, school_name, plan_name || 'Free Trial', trial_days ?? 14, loginUrl),
      text: `Welcome to SchoolSync, ${owner_name}!\n\n${school_name} has been registered. Your ${trial_days ?? 14}-day free trial has started.\n\nLog in at: ${loginUrl}\n\nNeed help? Email support@schoolsyncedu.com`,
    });

    console.log(`Welcome email sent to ${owner_email} for school: ${school_name}`);
    return new Response(JSON.stringify({ success: true, email_sent: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Welcome email error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
