import { supabase } from '@/lib/supabase';
import type { UUID } from '@/types/common.types';
import type {
  LetterTemplate,
  LetterTemplateAccess,
  LetterInstance,
  LetterFilterParams,
  LetterCategory,
  LetterSeverity,
  LetterInstanceStatus,
  LetterApprovalStatus,
  LetterDeliveryChannel,
  PrintQueueItem,
  PrintQueueStatus,
} from '@/types/letter.types';
import type { UserRole } from '@/utils/constants';

// ==================== TEMPLATES ====================

export const letterTemplateService = {
  async list(schoolId: UUID, category?: LetterCategory) {
    let query = supabase
      .from('letter_templates')
      .select('*', { count: 'exact' })
      .eq('school_id', schoolId)
      .order('category')
      .order('name');
    if (category) query = query.eq('category', category);
    const { data, count, error } = await query;
    if (error) throw error;
    return { data: data as LetterTemplate[], count: count ?? 0 };
  },

  async getById(id: UUID) {
    const { data, error } = await supabase
      .from('letter_templates')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as LetterTemplate;
  },

  async create(
    schoolId: UUID,
    entry: {
      name: string;
      category: LetterCategory;
      letter_type: string;
      severity: LetterSeverity;
      subject: string;
      body_html: string;
      placeholders_used?: string[];
      created_by: UUID;
    },
  ) {
    const { data, error } = await supabase
      .from('letter_templates')
      .insert({
        school_id: schoolId,
        ...entry,
        placeholders_used: entry.placeholders_used ?? [],
        is_starter: false,
      })
      .select()
      .single();
    if (error) throw error;
    return data as LetterTemplate;
  },

  async update(
    id: UUID,
    entry: Partial<{
      name: string;
      category: LetterCategory;
      letter_type: string;
      severity: LetterSeverity;
      subject: string;
      body_html: string;
      placeholders_used: string[];
    }>,
  ) {
    const { data, error } = await supabase
      .from('letter_templates')
      .update({ ...entry, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as LetterTemplate;
  },

  async delete(id: UUID) {
    const { error } = await supabase.from('letter_templates').delete().eq('id', id);
    if (error) throw error;
  },
};

// ==================== LETTER INSTANCES ====================

export const letterInstanceService = {
  async list(
    schoolId: UUID,
    params: LetterFilterParams & { page?: number; pageSize?: number } = {},
  ) {
    const {
      page = 1,
      pageSize = 25,
      status,
      category,
      studentId,
      createdBy,
      dateFrom,
      dateTo,
    } = params;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('letter_instances')
      .select(
        `*, students!inner(id, first_name, last_name, registration_number), letter_templates!inner(id, name, category, letter_type, severity)`,
        { count: 'exact' },
      )
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (status) query = query.eq('status', status);
    if (category) query = query.eq('letter_templates.category', category);
    if (studentId) query = query.eq('student_id', studentId);
    if (createdBy) query = query.eq('created_by', createdBy);
    if (dateFrom) query = query.gte('created_at', dateFrom);
    if (dateTo) query = query.lte('created_at', dateTo);

    const { data, count, error } = await query;
    if (error) throw error;
    return {
      data: data as (LetterInstance & {
        students: Record<string, unknown>;
        letter_templates: Record<string, unknown>;
      })[],
      count: count ?? 0,
    };
  },

  async getById(id: UUID) {
    const { data, error } = await supabase
      .from('letter_instances')
      .select(`*, students(id, first_name, last_name), letter_templates(*)`)
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as LetterInstance & {
      students: Record<string, unknown>;
      letter_templates: Record<string, unknown>;
    };
  },

  async create(
    schoolId: UUID,
    entry: {
      template_id: UUID;
      student_id: UUID;
      recipient_type: string;
      recipient_data: Record<string, unknown>;
      delivery_channels: LetterDeliveryChannel[];
      created_by: UUID;
      rendered_html?: string;
    },
  ) {
    const refNum = `LTR-${Date.now().toString(36).toUpperCase()}`;
    // Use SECURITY DEFINER RPC to bypass RLS on letter_instances
    const { data, error } = await supabase.rpc('create_letter_instance', {
      p_school_id:        schoolId,
      p_template_id:      entry.template_id,
      p_student_id:       entry.student_id,
      p_recipient_type:   entry.recipient_type,
      p_recipient_data:   entry.recipient_data,
      p_channels:         entry.delivery_channels,
      p_created_by:       entry.created_by,
      p_rendered_html:    entry.rendered_html ?? null,
      p_reference_number: refNum,
    });
    if (error) throw error;
    return data as unknown as LetterInstance;
  },

  async updateStatus(id: UUID, status: LetterInstanceStatus, approvedBy?: UUID) {
    // Use SECURITY DEFINER RPC to bypass RLS on letter_instances.
    // Pass all params explicitly (including the optional one) so PostgREST can
    // resolve the function without ambiguity regardless of schema cache state.
    const { data, error } = await supabase.rpc('update_letter_status', {
      p_id:          id,
      p_status:      status,
      p_approved_by: approvedBy ?? null,
    });
    if (error) throw error;
    return data as unknown as LetterInstance;
  },

  /** Submit for approval */
  async submitForApproval(id: UUID) {
    return this.updateStatus(id, 'pending_approval');
  },
};

// ==================== APPROVALS ====================

export const letterApprovalService = {
  async listPending(schoolId: UUID) {
    // Use SECURITY DEFINER RPC — the SELECT RLS policy on letter_instances
    // uses a role subquery that returns NULL when JWT uid doesn't match
    // users.id, causing principals to see an empty list via direct query.
    const { data, error } = await supabase.rpc('list_pending_approval_letters', {
      p_school_id: schoolId,
    });
    if (error) throw error;
    return (data as unknown as (LetterInstance & {
      rendered_html: string | null;
      students: Record<string, unknown>;
      letter_templates: Record<string, unknown>;
    })[]) ?? [];
  },

  async approve(
    letterInstanceId: UUID,
    approverId: UUID,
    status: LetterApprovalStatus,
    comments?: string,
  ) {
    // Use SECURITY DEFINER RPC — inserts letter_approvals AND updates
    // letter_instances status in one call, bypassing RLS on both tables.
    const { error } = await supabase.rpc('record_letter_approval', {
      p_letter_instance_id: letterInstanceId,
      p_approver_id:        approverId,
      p_decision:           status,
      p_comments:           comments ?? null,
    });
    if (error) throw error;
  },
};

// ==================== PRINT QUEUE ====================

export const printQueueService = {
  async list(schoolId: UUID, status?: PrintQueueStatus) {
    let query = supabase
      .from('print_queue')
      .select(
        `*, letter_instances!inner(id, reference_number, student_id, students(id, first_name, last_name))`,
      )
      .eq('school_id', schoolId)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    return data as (PrintQueueItem & { letter_instances: Record<string, unknown> })[];
  },

  async updateStatus(id: UUID, status: PrintQueueStatus, distributedBy?: UUID) {
    const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (status === 'distributed' && distributedBy) {
      updates.distributed_at = new Date().toISOString();
      updates.distributed_by = distributedBy;
    }
    const { data, error } = await supabase
      .from('print_queue')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as PrintQueueItem;
  },

  async addToQueue(schoolId: UUID, letterInstanceId: UUID, priority: number = 1) {
    const { data, error } = await supabase
      .from('print_queue')
      .insert({
        school_id: schoolId,
        letter_instance_id: letterInstanceId,
        status: 'queued' as PrintQueueStatus,
        priority,
        reprint_count: 0,
      })
      .select()
      .single();
    if (error) throw error;
    return data as PrintQueueItem;
  },
};

// ==================== TEMPLATE ACCESS ====================
// Controls which staff roles can see and use which letter templates.
// Only principal / vice_principal can grant or revoke access (enforced by DB RLS).

export const letterTemplateAccessService = {
  /** Get all role grants for a specific template (for the access management dialog) */
  async listByTemplate(templateId: UUID): Promise<LetterTemplateAccess[]> {
    const { data, error } = await supabase
      .from('letter_template_access')
      .select('*')
      .eq('template_id', templateId)
      .order('role');
    if (error) throw error;
    return data as LetterTemplateAccess[];
  },

  /** Get all templates a specific role has been granted access to */
  async listForRole(schoolId: UUID, role: UserRole): Promise<LetterTemplateAccess[]> {
    const { data, error } = await supabase
      .from('letter_template_access')
      .select('*')
      .eq('school_id', schoolId)
      .eq('role', role);
    if (error) throw error;
    return data as LetterTemplateAccess[];
  },

  /**
   * Replace all role grants for a template with the given set of roles.
   * Used by the principal when saving changes in the access management dialog.
   * RLS ensures only principal/vice_principal can call this successfully.
   */
  async setRolesForTemplate(
    schoolId: UUID,
    templateId: UUID,
    roles: UserRole[],
    grantedBy: UUID,
  ): Promise<void> {
    // Delete existing grants for this template
    const { error: delError } = await supabase
      .from('letter_template_access')
      .delete()
      .eq('template_id', templateId);
    if (delError) throw delError;

    if (roles.length === 0) return;

    const inserts = roles.map((role) => ({
      school_id: schoolId,
      template_id: templateId,
      role,
      granted_by: grantedBy,
    }));
    const { error: insError } = await supabase.from('letter_template_access').insert(inserts);
    if (insError) throw insError;
  },

  /** Grant a single role access to a template */
  async grant(
    schoolId: UUID,
    templateId: UUID,
    role: UserRole,
    grantedBy: UUID,
  ): Promise<LetterTemplateAccess> {
    const { data, error } = await supabase
      .from('letter_template_access')
      .insert({ school_id: schoolId, template_id: templateId, role, granted_by: grantedBy })
      .select()
      .single();
    if (error) throw error;
    return data as LetterTemplateAccess;
  },

  /** Revoke a specific access grant by its id */
  async revoke(id: UUID): Promise<void> {
    const { error } = await supabase.from('letter_template_access').delete().eq('id', id);
    if (error) throw error;
  },
};

// ==================== SEND LETTER EMAIL ====================

export const letterSendService = {
  /** Look up the first guardian email on file for a student */
  async getGuardianEmail(studentId: UUID): Promise<string | null> {
    const { data } = await supabase
      .from('guardians')
      .select('email')
      .eq('student_id', studentId)
      .not('email', 'is', null)
      .limit(1);
    const row = data?.[0] as { email?: string | null } | undefined;
    return row?.email?.trim() || null;
  },

  /**
   * Send a letter instance to the student's guardian via the school's configured SMTP.
   * Updates the instance status to 'sent' on success.
   */
  async sendToGuardian(
    letterInstanceId: UUID,
    schoolId: UUID,
    _sentBy: UUID,
  ): Promise<{ sent: boolean; reason?: string }> {
    // 1. Load instance via SECURITY DEFINER RPC (bypasses RLS — same
    //    pattern as write RPCs, avoids "not found" due to RLS blocking
    //    the direct SELECT for some session configurations).
    const { data: instance, error: instErr } = await supabase.rpc('get_letter_for_send', {
      p_letter_id: letterInstanceId,
    });

    if (instErr) return { sent: false, reason: instErr.message ?? 'Letter instance not found' };
    if (!instance) return { sent: false, reason: 'Letter instance not found' };

    if (!instance.rendered_html) {
      return {
        sent: false,
        reason: 'Letter has no rendered content — please recreate it from the template.',
      };
    }

    // 2. Resolve guardian email
    const guardianEmail = await this.getGuardianEmail(instance.student_id);
    if (!guardianEmail) {
      return {
        sent: false,
        reason:
          "No guardian email address on file for this student. Add one under the student's Guardians tab.",
      };
    }

    // 3. Get school name for the "from" display name
    const { data: school } = await supabase
      .from('schools')
      .select('name')
      .eq('id', schoolId)
      .single();

    const template = instance.letter_templates as Record<string, string> | null;
    const rawSubject = template?.subject ?? 'Letter from School';
    // Resolve {{placeholders}} in the subject using recipient_data (contains
    // student_name, payment_reference, fee_amount, etc. filled in at compose time)
    const recipientData = (instance.recipient_data as Record<string, string>) ?? {};
    const subject = rawSubject.replace(/\{\{(\w+)\}\}/g, (_, key: string) => recipientData[key] ?? '');

    // 4. Invoke the Edge Function (uses school's SMTP config)
    const { error: fnErr } = await supabase.functions.invoke('send-letter-email', {
      body: {
        school_id: schoolId,
        to: guardianEmail,
        subject,
        html: instance.rendered_html,
        fromName: school?.name ?? 'School',
      },
    });

    if (fnErr) {
      console.error('letterSendService: edge function error', fnErr);
      return { sent: false, reason: fnErr.message ?? 'Email delivery failed' };
    }

    // 5. Mark instance as sent via RPC (bypasses RLS)
    await supabase.rpc('update_letter_status', {
      p_id:          letterInstanceId,
      p_status:      'sent',
      p_approved_by: null,
    });

    return { sent: true };
  },

  /**
   * Upload a custom letter (PDF/DOCX) and send it to a recipient via the school's SMTP.
   * Creates a letter_instance record for the audit trail.
   */
  async sendCustomLetter(params: {
    schoolId: UUID;
    sentBy: UUID;
    file: File;
    recipientEmail: string;
    recipientName?: string;
    studentId?: string | null;
    subject: string;
    message?: string;
  }): Promise<{ sent: boolean; reason?: string }> {
    const { schoolId, sentBy, file, recipientEmail, recipientName, studentId, subject, message } = params;

    // 1. Upload file to letter-documents bucket
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${schoolId}/${timestamp}_${safeName}`;

    const { error: uploadErr } = await supabase.storage
      .from('letter-documents')
      .upload(storagePath, file, { cacheControl: '3600', upsert: false });

    if (uploadErr) {
      return { sent: false, reason: `File upload failed: ${uploadErr.message}` };
    }

    // 2. Get school name for email display name
    const { data: school } = await supabase
      .from('schools')
      .select('name')
      .eq('id', schoolId)
      .single();

    // 3. Build the email body (simple wrapper around the attachment)
    const greeting = recipientName ? `Dear ${recipientName},` : 'Dear Guardian,';
    const bodyText = message?.trim()
      ? `<p>${message.trim().replace(/\n/g, '<br/>')}</p>`
      : '';
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;color:#1e293b">
        <p>${greeting}</p>
        <p>Please find attached a letter from <strong>${school?.name ?? 'your school'}</strong>.</p>
        ${bodyText}
        <p>If you have any questions, please contact the school directly.</p>
        <p>Regards,<br/><strong>${school?.name ?? 'School Administration'}</strong></p>
      </div>`;

    // 4. Create letter_instance for audit trail
    const { data: instance, error: instErr } = await supabase
      .from('letter_instances')
      .insert({
        school_id:       schoolId,
        template_id:     null,
        student_id:      studentId ?? null,
        recipient_type:  'guardian',
        recipient_data:  { email: recipientEmail, name: recipientName ?? '' },
        delivery_channels: ['email'],
        rendered_html:   html,
        attachment_url:  storagePath,
        attachment_name: file.name,
        is_custom:       true,
        status:          'sent',
        sent_at:         new Date().toISOString(),
        created_by:      sentBy,
      })
      .select('id')
      .single();

    if (instErr) {
      console.warn('sendCustomLetter: could not create letter_instance', instErr.message);
      // Don't abort — still try to send the email
    }

    // 5. Send via edge function with attachment
    const { error: fnErr } = await supabase.functions.invoke('send-letter-email', {
      body: {
        school_id:       schoolId,
        to:              recipientEmail,
        subject,
        html,
        fromName:        school?.name ?? 'School',
        attachment_path: storagePath,
        attachment_name: file.name,
      },
    });

    if (fnErr) {
      // Mark instance as failed if we created one
      if (instance?.id) {
        await supabase
          .from('letter_instances')
          .update({ status: 'draft' })
          .eq('id', instance.id);
      }
      return { sent: false, reason: fnErr.message ?? 'Email delivery failed' };
    }

    return { sent: true };
  },
};
