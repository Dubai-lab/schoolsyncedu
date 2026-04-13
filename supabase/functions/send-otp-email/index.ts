// Supabase Edge Function: send-otp-email
//
// Sends an OTP verification email during school registration.
// Uses configured SMTP (per-school or global fallback).
//
// Global fallback secrets (Supabase Dashboard → Edge Functions → Secrets):
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_SECURE
//
// Fallback from: per-school SMTP config (if available)
// Fallback to: global SMTP env var secrets

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6.9.9';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OTPEmailRequest {
  to: string;
  otp_code: string;
  school_name?: string;
}

/**
 * Generate professional OTP email HTML template
 */
function generateOTPEmailHTML(otp: string, schoolName: string = 'SchoolSync'): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Email Verification</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
          background-color: #f5f7fa;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }
        .header {
          background: linear-gradient(135deg, #1e40af 0%, #1e3a3f 100%);
          padding: 40px 20px;
          text-align: center;
          color: white;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 600;
          letter-spacing: -0.5px;
        }
        .content {
          padding: 40px 30px;
        }
        .greeting {
          font-size: 16px;
          color: #1f2937;
          margin-bottom: 24px;
          line-height: 1.6;
        }
        .description {
          font-size: 14px;
          color: #6b7280;
          margin-bottom: 32px;
          line-height: 1.6;
        }
        .otp-section {
          background-color: #f3f4f6;
          border-left: 4px solid #1e40af;
          padding: 20px;
          margin: 32px 0;
          border-radius: 4px;
        }
        .otp-label {
          font-size: 12px;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 1px;
          font-weight: 600;
          margin-bottom: 8px;
        }
        .otp-code {
          font-size: 36px;
          font-weight: 700;
          color: #1e40af;
          letter-spacing: 6px;
          font-family: 'Courier New', monospace;
          text-align: center;
        }
        .warning {
          font-size: 13px;
          color: #7c2d12;
          background-color: #fed7aa;
          border-left: 4px solid #ea580c;
          padding: 12px 16px;
          margin-top: 20px;
          border-radius: 4px;
          line-height: 1.5;
        }
        .footer {
          background-color: #f9fafb;
          padding: 20px 30px;
          text-align: center;
          font-size: 12px;
          color: #9ca3af;
          border-top: 1px solid #e5e7eb;
        }
        .footer-link {
          color: #1e40af;
          text-decoration: none;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Email Verification</h1>
        </div>
        
        <div class="content">
          <div class="greeting">
            Welcome to <strong>${escapeHtml(schoolName)}</strong>!
          </div>
          
          <div class="description">
            We received a request to verify your email address during school registration. Your verification code is below. This code is valid for <strong>15 minutes</strong>.
          </div>
          
          <div class="otp-section">
            <div class="otp-label">Your Verification Code:</div>
            <div class="otp-code">${otp.split('').join(' ')}</div>
          </div>
          
          <div class="description">
            Enter this code in the verification window to proceed with your school registration.
          </div>
          
          <div class="warning">
            ⚠️ This code is personal and confidential. Never share it with anyone. SchoolSync staff will never ask for your verification code.
          </div>
          
          <div class="description" style="margin-top: 32px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 24px;">
            Didn't request this code? You can safely ignore this email. If you have concerns, please contact our support team.
          </div>
        </div>
        
        <div class="footer">
          <p style="margin: 0;">
            © ${new Date().getFullYear()} SchoolSync. All rights reserved.
          </p>
          <p style="margin: 8px 0 0;">
            Secure email provided by SchoolSync Platform
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Escape HTML special characters for security
 */
function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { to, otp_code, school_name } = (await req.json()) as OTPEmailRequest;

    // ── Validate input ───────────────────────────────────────
    if (!to || !otp_code) {
      return new Response(JSON.stringify({ error: 'Missing required fields: to, otp_code' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!/^\d{6}$/.test(otp_code)) {
      return new Response(JSON.stringify({ error: 'OTP code must be exactly 6 digits' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Resolve SMTP config ──────────────────────────────────
    let smtpHost: string | undefined;
    let smtpPort = 587;
    let smtpSecure = false;
    let smtpUser: string | undefined;
    let smtpPass: string | undefined;
    let fromAddress: string | undefined;

    // Fall back to global env var SMTP (no per-school for registration)
    smtpHost = Deno.env.get('SMTP_HOST');
    smtpPort = Number(Deno.env.get('SMTP_PORT') || 587);
    smtpSecure = Deno.env.get('SMTP_SECURE') === 'true';
    smtpUser = Deno.env.get('SMTP_USER');
    smtpPass = Deno.env.get('SMTP_PASS');
    fromAddress = Deno.env.get('SMTP_FROM') || smtpUser;

    if (!smtpHost || !smtpUser || !smtpPass) {
      console.error('SMTP not configured');
      return new Response(
        JSON.stringify({
          error: 'Email service is not configured. Please try again later or contact support.',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Create transporter and send email ─────────────────────
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: { user: smtpUser, pass: smtpPass },
    });

    const htmlContent = generateOTPEmailHTML(otp_code, school_name);

    const mailOptions = {
      from: `"SchoolSync" <${fromAddress}>`,
      to,
      subject: 'Verify Your Email - SchoolSync Registration',
      html: htmlContent,
      text: `Your verification code is: ${otp_code}. Valid for 15 minutes. Never share this code.`,
    };

    await transporter.sendMail(mailOptions);
    console.log(`OTP email sent to ${to} via ${smtpHost}`);

    return new Response(JSON.stringify({ success: true, message: 'OTP email sent successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('OTP email send error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
