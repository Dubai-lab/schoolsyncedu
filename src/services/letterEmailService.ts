import { supabase } from '@/lib/supabase';
import type { StudentApplication } from '@/types/application.types';

// Replace every {{placeholder}} in the HTML/subject with real values.
function renderTemplate(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? '');
}

// Build the placeholder map from application + school data.
function buildPlaceholders(
  app: StudentApplication,
  school: {
    name: string;
    logo_url?: string | null;
    address?: string | null;
    phone?: string;
    website?: string | null;
    moe_registration_number?: string;
    principal_name?: string;
  },
  extra: {
    class_name?: string;
    registration_number?: string;
    rejection_reason?: string;
    reporting_date?: string;
    academic_year?: string;
  } = {},
): Record<string, string> {
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  return {
    school_name: school.name,
    school_logo_url: school.logo_url ?? '',
    school_address: school.address ?? '',
    school_phone: school.phone ?? '',
    school_website: school.website ?? '',
    moe_registration_number: school.moe_registration_number ?? '',
    principal_name: school.principal_name ?? '',
    date: today,
    student_name: `${app.first_name} ${app.last_name}`,
    guardian_name: app.guardian_full_name ?? '',
    academic_year: extra.academic_year ?? app.academic_year,
    class_name: extra.class_name ?? '',
    registration_number: extra.registration_number ?? '',
    reporting_date: extra.reporting_date ?? '',
    rejection_reason: extra.rejection_reason ?? app.review_notes ?? '',
    grade_level: app.grade_level_applied ?? '',
  };
}

/** Send the acceptance or rejection email to the guardian.
 *
 * @param type         - 'acceptance_letter' | 'rejection_letter'
 * @param app          - The StudentApplication record
 * @param extra        - Additional placeholders (class_name, registration_number, rejection_reason)
 * @param sentBy       - The user ID of the staff member sending (for audit trail)
 * @param studentId    - The created student record ID (acceptance only)
 * @returns            - { sent: true } or { sent: false, reason: string }
 */
export async function sendApplicationEmail(
  type: 'acceptance_letter' | 'rejection_letter',
  app: StudentApplication,
  extra: {
    class_name?: string;
    registration_number?: string;
    rejection_reason?: string;
    reporting_date?: string;
  } = {},
  sentBy?: string,
  studentId?: string,
): Promise<{ sent: boolean; reason?: string }> {
  // 1. Guard — need a guardian email to send to
  const to = app.guardian_email?.trim();
  if (!to) {
    console.warn('sendApplicationEmail: no guardian_email on application', app.id);
    return { sent: false, reason: 'No guardian email address on this application' };
  }

  // 2. Fetch school info for placeholders
  const { data: school, error: schoolErr } = await supabase
    .from('schools')
    .select('name, logo_url, address, phone, website, moe_registration_number, principal_name')
    .eq('id', app.school_id)
    .single();
  if (schoolErr || !school) {
    console.error('sendApplicationEmail: could not fetch school', schoolErr);
    return { sent: false, reason: 'School data unavailable' };
  }

  // 3. Find the matching letter template for this school + letter type
  const { data: template, error: tplErr } = await supabase
    .from('letter_templates')
    .select('id, name, subject, body_html')
    .eq('school_id', app.school_id)
    .eq('letter_type', type)
    .limit(1)
    .maybeSingle();

  if (tplErr || !template) {
    // Fallback: try the school-agnostic starter template
    const { data: starterTpl } = await supabase
      .from('letter_templates')
      .select('id, name, subject, body_html')
      .eq('letter_type', type)
      .eq('is_starter', true)
      .limit(1)
      .maybeSingle();

    if (!starterTpl) {
      console.warn('sendApplicationEmail: no template found for', type);
      return { sent: false, reason: `No letter template found for type "${type}"` };
    }
    // Use the starter template but continue
    return _dispatchEmail(starterTpl, app, school, extra, to, sentBy, studentId);
  }

  return _dispatchEmail(template, app, school, extra, to, sentBy, studentId);
}

// Internal helper — renders, calls Edge Function, logs letter_instance.
async function _dispatchEmail(
  template: { id: string; name: string; subject: string; body_html: string },
  app: StudentApplication,
  school: {
    name: string; logo_url?: string | null; address?: string | null;
    phone?: string; website?: string | null;
    moe_registration_number?: string; principal_name?: string;
  },
  extra: { class_name?: string; registration_number?: string; rejection_reason?: string; reporting_date?: string },
  to: string,
  sentBy?: string,
  studentId?: string,
): Promise<{ sent: boolean; reason?: string }> {
  const placeholders = buildPlaceholders(app, school, extra);

  const renderedSubject = renderTemplate(template.subject, placeholders);
  const renderedHtml = renderTemplate(template.body_html, placeholders);

  // 4. Call the Edge Function to send the email via SMTP
  const { error: fnErr } = await supabase.functions.invoke('send-letter-email', {
    body: {
      school_id: app.school_id,
      to,
      subject: renderedSubject,
      html: renderedHtml,
      fromName: school.name,
    },
  });

  if (fnErr) {
    console.error('sendApplicationEmail: edge function error', fnErr);
    return { sent: false, reason: fnErr.message ?? 'Email send failed' };
  }

  // 5. Log a letter_instance for the audit trail
  await supabase.from('letter_instances').insert({
    school_id: app.school_id,
    template_id: template.id,
    student_id: studentId ?? null,
    recipient_type: 'guardian',
    recipient_data: {
      name: app.guardian_full_name,
      email: to,
      application_id: app.id,
      application_number: app.application_number,
    },
    delivery_channels: ['email'],
    rendered_html: renderedHtml,
    status: 'sent',
    sent_at: new Date().toISOString(),
    created_by: sentBy ?? null,
  });

  return { sent: true };
}
