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

function buildWelcomeHTML(ownerName: string, schoolName: string, loginUrl: string) {
  const steps = [
    ['Complete your school profile', 'Add your logo, address, motto, and branding to make it yours.'],
    ['Set up your first academic term', 'Create class levels, sections, and your school calendar.'],
    ['Invite your IT Admin', 'Your IT Admin will manage users, settings, and access control.'],
    ['Add your staff', 'Invite your registrar, bursar, teachers, and support staff.'],
    ['Enroll your students', 'Import your student roster or add students individually.'],
  ];

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Welcome to SchoolSync</title></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f7fa;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#1e40af 0%,#1e3a5f 100%);padding:48px 32px;text-align:center;">
    <h1 style="margin:0;color:#fff;font-size:26px;font-weight:700;">Welcome to SchoolSync</h1>
    <p style="margin:8px 0 0;color:rgba(255,255,255,.75);font-size:15px;">${escapeHtml(schoolName)} is registered</p>
  </div>

  <!-- Body -->
  <div style="padding:40px 32px;">
    <p style="margin:0 0 20px;font-size:16px;color:#1f2937;">Hi <strong>${escapeHtml(ownerName)}</strong>,</p>
    <p style="margin:0 0 24px;font-size:14px;color:#4b5563;line-height:1.7;">
      <strong>${escapeHtml(schoolName)}</strong> has been successfully registered on SchoolSync —
      Liberia's school management platform for enrollment, grades, attendance, fees, and more.
    </p>

    <!-- Getting started steps -->
    <p style="margin:0 0 16px;font-size:14px;font-weight:600;color:#1f2937;">Here's how to get started:</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:28px;">
      ${steps.map(([title, desc], i) => `
      <tr>
        <td style="vertical-align:top;padding:10px 12px 10px 0;width:36px;">
          <div style="width:30px;height:30px;border-radius:50%;background:#dbeafe;color:#1e40af;font-size:13px;font-weight:700;text-align:center;line-height:30px;">${i + 1}</div>
        </td>
        <td style="vertical-align:top;padding:10px 0;border-bottom:1px solid #f3f4f6;">
          <p style="margin:0;font-size:13px;font-weight:600;color:#1f2937;">${title}</p>
          <p style="margin:3px 0 0;font-size:12px;color:#6b7280;line-height:1.5;">${desc}</p>
        </td>
      </tr>`).join('')}
    </table>

    <!-- Login link (plain text, not a button) -->
    <p style="margin:0 0 8px;font-size:13px;color:#4b5563;">
      You can log in to your school portal at:
    </p>
    <p style="margin:0 0 28px;font-size:13px;">
      <a href="${loginUrl}" style="color:#1e40af;text-decoration:underline;">${loginUrl}</a>
    </p>

    <div style="background:#f9fafb;border-radius:8px;padding:16px 20px;">
      <p style="margin:0;font-size:13px;color:#4b5563;line-height:1.6;">
        Our team is here to help you get set up. Reach us anytime at
        <a href="mailto:support@schoolsyncedu.com" style="color:#1e40af;text-decoration:none;font-weight:500;">support@schoolsyncedu.com</a>.
        We typically respond within one business day.
      </p>
    </div>
  </div>

  <!-- Footer -->
  <div style="background:#f9fafb;padding:20px 32px;text-align:center;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;">
    <p style="margin:0;">© ${new Date().getFullYear()} SchoolSync · EduLiberia · Monrovia, Liberia</p>
    <p style="margin:6px 0 0;">You are receiving this because you registered a school on SchoolSync.</p>
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

    const { owner_name, owner_email, school_name, school_id } =
      await req.json() as {
        owner_name: string;
        owner_email: string;
        school_name: string;
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
        metadata: { school_name },
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
      subject: `Welcome to SchoolSync — ${school_name} is registered`,
      html: buildWelcomeHTML(owner_name, school_name, loginUrl),
      text: `Welcome to SchoolSync, ${owner_name}!\n\n${school_name} has been successfully registered.\n\nLog in at: ${loginUrl}\n\nNeed help? Email support@schoolsyncedu.com`,
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
