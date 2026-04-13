// Supabase Edge Function: send-enterprise-inquiry
//
// Receives an enterprise plan inquiry from the public pricing page,
// stores it in enterprise_inquiries table, and emails support@schoolsyncedu.com
//
// Uses the same global SMTP secrets as send-otp-email:
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_SECURE

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6.9.9';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EnterpriseInquiryRequest {
  school_name: string;
  contact_name: string;
  email: string;
  phone?: string;
  student_count?: string;
  modules_needed?: string;
  message?: string;
}

function escapeHtml(text: string): string {
  const map: { [key: string]: string } = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, (c) => map[c]);
}

function generateEmailHTML(data: EnterpriseInquiryRequest): string {
  const row = (label: string, value: string | undefined) =>
    value
      ? `<tr><td style="padding:8px 12px;font-weight:600;color:#374151;width:160px;background:#f9fafb;border-bottom:1px solid #e5e7eb;">${label}</td><td style="padding:8px 12px;color:#111827;border-bottom:1px solid #e5e7eb;">${escapeHtml(value)}</td></tr>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Enterprise Inquiry</title></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f7fa;">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
    <div style="background:linear-gradient(135deg,#1e40af 0%,#1e3a5f 100%);padding:32px 24px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">New Enterprise Inquiry</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,.75);font-size:14px;">Received from SchoolSync Pricing Page</p>
    </div>
    <div style="padding:32px 24px;">
      <p style="margin:0 0 20px;font-size:15px;color:#374151;">A school has submitted an enterprise plan inquiry. Details below:</p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;font-size:14px;">
        ${row('School Name', data.school_name)}
        ${row('Contact Person', data.contact_name)}
        ${row('Email', data.email)}
        ${row('Phone', data.phone)}
        ${row('Est. Students', data.student_count)}
        ${row('Modules Needed', data.modules_needed)}
        ${row('Message', data.message)}
      </table>
      <div style="margin-top:24px;padding:16px;background:#eff6ff;border-left:4px solid #1e40af;border-radius:4px;">
        <p style="margin:0;font-size:13px;color:#1e40af;font-weight:600;">Action Required</p>
        <p style="margin:6px 0 0;font-size:13px;color:#374151;">Reply to <a href="mailto:${escapeHtml(data.email)}" style="color:#1e40af;">${escapeHtml(data.email)}</a> within 1–2 business days to discuss their custom plan.</p>
      </div>
    </div>
    <div style="background:#f9fafb;padding:16px 24px;text-align:center;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;">
      © ${new Date().getFullYear()} SchoolSync · support@schoolsyncedu.com
    </div>
  </div>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = (await req.json()) as EnterpriseInquiryRequest;
    const { school_name, contact_name, email } = body;

    if (!school_name?.trim() || !contact_name?.trim() || !email?.trim()) {
      return new Response(JSON.stringify({ error: 'school_name, contact_name, and email are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email address' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Store inquiry in database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error: dbError } = await supabase.from('enterprise_inquiries').insert({
      school_name: body.school_name,
      contact_name: body.contact_name,
      email: body.email,
      phone: body.phone || null,
      student_count: body.student_count || null,
      modules_needed: body.modules_needed || null,
      message: body.message || null,
    });

    if (dbError) {
      console.error('DB insert error:', dbError.message);
      // Don't block email send if DB fails
    }

    // 2. Send notification email to support
    const smtpHost = Deno.env.get('SMTP_HOST');
    const smtpPort = Number(Deno.env.get('SMTP_PORT') || 587);
    const smtpSecure = Deno.env.get('SMTP_SECURE') === 'true';
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPass = Deno.env.get('SMTP_PASS');
    const fromAddress = Deno.env.get('SMTP_FROM') || smtpUser;

    if (!smtpHost || !smtpUser || !smtpPass) {
      // SMTP not configured — inquiry saved to DB, but can't send email
      console.warn('SMTP not configured — inquiry saved but email not sent');
      return new Response(JSON.stringify({ success: true, email_sent: false, message: 'Inquiry saved. Email notification skipped (SMTP not configured).' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost, port: smtpPort, secure: smtpSecure,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: `"SchoolSync" <${fromAddress}>`,
      to: 'support@schoolsyncedu.com',
      replyTo: email,
      subject: `Enterprise Inquiry: ${school_name}`,
      html: generateEmailHTML(body),
      text: `Enterprise Inquiry from ${school_name}\n\nContact: ${contact_name}\nEmail: ${email}\nPhone: ${body.phone || 'N/A'}\nStudents: ${body.student_count || 'N/A'}\nModules: ${body.modules_needed || 'N/A'}\nMessage: ${body.message || 'N/A'}`,
    });

    console.log(`Enterprise inquiry from ${email} emailed to support@schoolsyncedu.com`);

    return new Response(JSON.stringify({ success: true, email_sent: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Enterprise inquiry error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
