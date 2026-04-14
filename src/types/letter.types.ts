// ============================================================
// LETTER TYPES — Templates, instances, approvals, deliveries, audit
// ============================================================

import type { UUID, Timestamp, SchoolScopedEntity, TemplateVersionStatus, RecallActionType, RecallReason } from './common.types';
import type { UserRole } from '@/utils/constants';

// ENUM types from migration 006
export type LetterInstanceStatus = 'draft' | 'pending_approval' | 'changes_requested' | 'approved' | 'sent' | 'recalled' | 'voided';
export type LetterApprovalStatus = 'pending' | 'approved' | 'rejected' | 'changes_requested';
export type LetterDeliveryChannel = 'pdf' | 'portal' | 'sms' | 'email';
export type LetterDeliveryStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'read';
export type PrintQueueStatus = 'queued' | 'printing' | 'printed' | 'distributed' | 'failed';
export type PrintDistributionMethod = 'handed_to_student' | 'mailed' | 'picked_up';
export type LetterAuditAction = 'created' | 'submitted' | 'approved' | 'rejected' | 'sent' | 'delivered' | 'read' | 'recalled' | 'voided' | 'reprinted' | 'acknowledged';
export type AcknowledgmentMethod = 'digital_portal' | 'digital_sms' | 'physical_signoff' | 'phone_confirmation';
export type LetterCategory = 'admissions' | 'disciplinary' | 'academic' | 'financial' | 'attendance' | 'communication' | 'administrative';
export type LetterSeverity = 'low' | 'medium' | 'high' | 'critical';
export type LetterType =
  | 'acceptance_letter' | 'rejection_letter' | 'waitlist_notification' | 'transfer_letter'
  | 'warning_letter' | 'suspension_notice' | 'ntr_notice' | 'expulsion_notice'
  | 'report_card_cover' | 'promotion_letter' | 'retention_notice' | 'honor_roll_certificate'
  | 'fee_reminder' | 'outstanding_balance_notice' | 'payment_receipt'
  | 'chronic_absenteeism_notice' | 'truancy_notice'
  | 'pta_meeting_invitation' | 'general_announcement' | 'emergency_notice'
  | 'enrollment_verification' | 'recommendation_letter' | 'withdrawal_confirmation';

/** letter_templates table */
export interface LetterTemplate extends SchoolScopedEntity {
  name: string;
  category: LetterCategory;
  letter_type: LetterType;
  severity: LetterSeverity;
  subject: string;
  body_html: string;
  placeholders_used: string[];
  is_starter: boolean;
  requires_approval: boolean;
  active_version_id: UUID | null;
  created_by: UUID;
  updated_at?: Timestamp;
}

/** letter_template_access table — maps which role can use which template */
export interface LetterTemplateAccess {
  id: UUID;
  school_id: UUID;
  template_id: UUID;
  role: UserRole;
  granted_by: UUID | null;
  granted_at: Timestamp;
}

/** Form for managing template role access */
export interface TemplateAccessForm {
  template_id: UUID;
  roles: UserRole[];
}

/** letter_template_versions table */
export interface LetterTemplateVersion {
  id: UUID;
  template_id: UUID;
  version_number: number;
  content_json: Record<string, unknown>;
  status: TemplateVersionStatus;
  change_summary: string | null;
  created_by: UUID;
  created_at: Timestamp;
}

/** letter_instances table */
export interface LetterInstance extends SchoolScopedEntity {
  template_id: UUID;
  template_version_id: UUID | null;
  student_id: UUID;
  recipient_type: string;
  recipient_data: Record<string, unknown>;
  reference_number: string;
  status: LetterInstanceStatus;
  /** Fully resolved letter body — all {{placeholders}} replaced with real school/student data at creation time (migration 024) */
  rendered_html: string | null;
  generated_pdf_url: string | null;
  delivery_channels: string[];
  batch_id: UUID | null;
  created_by: UUID;
  approved_by: UUID | null;
  sent_at: Timestamp | null;
}

/** letter_approvals table */
export interface LetterApproval {
  id: UUID;
  letter_instance_id: UUID;
  approver_id: UUID;
  status: LetterApprovalStatus;
  comments: string | null;
  approval_timestamp: Timestamp;
}

/** letter_deliveries table */
export interface LetterDelivery {
  id: UUID;
  letter_instance_id: UUID;
  channel: LetterDeliveryChannel;
  status: LetterDeliveryStatus;
  delivery_timestamp: Timestamp | null;
  read_at: Timestamp | null;
  delivery_metadata: Record<string, unknown> | null;
}

/** letter_recalls table */
export interface LetterRecall {
  id: UUID;
  letter_instance_id: UUID;
  action_type: RecallActionType;
  reason: RecallReason;
  reason_detail: string | null;
  initiated_by: UUID;
  approved_by: UUID | null;
  channels_notified: string[];
  created_at: Timestamp;
}

/** letter_acknowledgments table */
export interface LetterAcknowledgment {
  id: UUID;
  letter_instance_id: UUID;
  acknowledged_by: UUID;
  method: AcknowledgmentMethod;
  acknowledged_at: Timestamp;
  recorded_by: UUID | null;
  notes: string | null;
  signature_data: string | null;
}

/** letter_audit_log table (migration 006) */
export interface LetterAuditLogEntry {
  id: UUID;
  letter_instance_id: UUID;
  action: LetterAuditAction;
  performed_by: UUID | null;
  performed_at: Timestamp;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  checksum: string | null;
}

/** print_queue table */
export interface PrintQueueItem extends SchoolScopedEntity {
  letter_instance_id: UUID;
  status: PrintQueueStatus;
  priority: number;
  distribution_method: PrintDistributionMethod | null;
  distributed_at: Timestamp | null;
  distributed_by: UUID | null;
  page_count: number | null;
  reprint_count: number;
}

// ==================== VIEW TYPES ====================

/** vw_staff_letter_activity */
export interface StaffLetterActivity {
  staff_id: UUID;
  school_id: UUID;
  first_name: string;
  last_name: string;
  role: UserRole;
  letters_generated: number;
  letters_sent: number;
  pending_approval: number;
  last_letter_created: Timestamp | null;
}

// ==================== FORMS ====================

export interface CreateLetterTemplateForm {
  name: string;
  category: LetterCategory;
  letterType: string;
  severity: LetterSeverity;
  subject: string;
  bodyHtml: string;
  placeholdersUsed?: string[];
}

export interface CreateLetterInstanceForm {
  templateId: UUID;
  studentId: UUID;
  recipientType: string;
  recipientData: Record<string, unknown>;
  deliveryChannels: LetterDeliveryChannel[];
}

export interface ApproveLetterForm {
  letterInstanceId: UUID;
  status: 'approved' | 'rejected' | 'changes_requested';
  comments?: string;
}

export interface LetterFilterParams {
  status?: LetterInstanceStatus;
  category?: LetterCategory;
  studentId?: UUID;
  createdBy?: UUID;
  dateFrom?: string;
  dateTo?: string;
}