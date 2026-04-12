// Supabase Edge Function: send-letter-email
//
// Sends a transactional HTML email.
// Priority: per-school SMTP config (from school_email_configs table)
//           → fall back to global SMTP env var secrets
//
// Global fallback secrets (Supabase Dashboard → Edge Functions → Secrets):
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_SECURE
//
// Per-school SMTP is fetched via the get_school_smtp_config() RPC
// using the service_role key so credentials are never exposed to clients.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6.9.9';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { school_id, to, subject, html, fromName } = await req.json() as {
      school_id?: string;
      to: string;
      subject: string;
      html: string;
      fromName?: string;
    };

    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, subject, html' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Resolve SMTP config ──────────────────────────────────
    let smtpHost: string | undefined;
    let smtpPort = 587;
    let smtpSecure = false;
    let smtpUser: string | undefined;
    let smtpPass: string | undefined;
    let fromAddress: string | undefined;
    let resolvedFromName = fromName;
    let replyTo: string | undefined;

    // Try per-school config first
    if (school_id) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const adminClient = createClient(supabaseUrl, serviceKey);

      const { data: cfg } = await adminClient.rpc('get_school_smtp_config', {
        p_school_id: school_id,
      });

      const row = Array.isArray(cfg) ? cfg[0] : cfg;
      if (row?.smtp_host && row?.smtp_user && row?.smtp_pass) {
        smtpHost = row.smtp_host;
        smtpPort = row.smtp_port ?? 587;
        smtpSecure = row.smtp_secure ?? false;
        smtpUser = row.smtp_user;
        smtpPass = row.smtp_pass;
        fromAddress = row.from_address || row.smtp_user;
        if (row.from_name) resolvedFromName = row.from_name;
        replyTo = row.reply_to ?? undefined;
      }
    }

    // Fall back to global env var SMTP
    if (!smtpHost) {
      smtpHost = Deno.env.get('SMTP_HOST');
      smtpPort = Number(Deno.env.get('SMTP_PORT') || 587);
      smtpSecure = Deno.env.get('SMTP_SECURE') === 'true';
      smtpUser = Deno.env.get('SMTP_USER');
      smtpPass = Deno.env.get('SMTP_PASS');
      fromAddress = Deno.env.get('SMTP_FROM') || smtpUser;
    }

    if (!smtpHost || !smtpUser || !smtpPass) {
      console.error('No SMTP config available for school_id:', school_id);
      return new Response(
        JSON.stringify({
          error: school_id
            ? 'No email configuration found for this school. The IT Admin must set up email settings first.'
            : 'SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS secrets.',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Send ─────────────────────────────────────────────────
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: { user: smtpUser, pass: smtpPass },
    });

    const from = resolvedFromName
      ? `"${resolvedFromName}" <${fromAddress}>`
      : fromAddress;

    const mailOptions: Record<string, unknown> = { from, to, subject, html };
    if (replyTo) mailOptions.replyTo = replyTo;

    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${to} via ${smtpHost} (school: ${school_id ?? 'global'})`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Email send error:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
