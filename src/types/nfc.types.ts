// ============================================================
// NFC & ID CARD TYPES — Cards, readers, attendance logs, ID generation
// ============================================================

import type { UUID, Timestamp, ISODate, SchoolScopedEntity, NfcAssignmentMethod, NfcScanStatus, IdCardGenerationStatus } from './common.types';

export type NfcCardStatus = 'designed' | 'printed' | 'encoded' | 'active' | 'inactive' | 'replaced';
export type NfcScanType = 'attendance' | 'library' | 'gate_access' | 'assignment' | 'verification';
export type NfcReaderType = 'external_usb' | 'android_nfc' | 'web_nfc';

/** nfc_cards table */
export interface NfcCard extends SchoolScopedEntity {
  student_id: UUID;
  card_number: string;
  nfc_chip_id: string | null;
  nfc_chip_data: NfcChipData | null;
  status: NfcCardStatus;
  encoded_by: UUID | null;
  encoded_at: Timestamp | null;
  assigned_at: Timestamp | null;
  valid_until: ISODate | null;
}

export interface NfcChipData {
  student_id: UUID;
  school_id: UUID;
  permissions: string[];
  expiry: ISODate;
}

/** nfc_attendance_logs table */
export interface NfcAttendanceLog {
  id: UUID;
  card_id: UUID;
  student_id: UUID;
  tapped_at: Timestamp;
  reader_location: string | null;
  reader_type: NfcReaderType;
  scan_type: NfcScanType;
  status: NfcScanStatus;
  created_at: Timestamp;
}

/** nfc_readers table */
export interface NfcReader extends SchoolScopedEntity {
  name: string;
  device_id: string;
  location: string | null;
  reader_type: NfcReaderType;
  is_active: boolean;
  last_sync: Timestamp | null;
}

/** id_card_designs table */
export interface IdCardDesign extends SchoolScopedEntity {
  name: string;
  design_json: IdCardDesignData;
  is_active: boolean;
  created_by: UUID;
}

export interface IdCardDesignData {
  logo?: string;
  dimensions?: { width: number; height: number };
  fields?: string[];
  layout?: Record<string, unknown>;
  background_color?: string;
  text_color?: string;
  accent_color?: string;
  header_color?: string;
  card_bg_image?: string;
  font_family?: string;
  show_school_name?: boolean;
  show_school_logo?: boolean;
  show_school_motto?: boolean;
  show_barcode?: boolean;
  show_qr_code?: boolean;
  border_style?: 'none' | 'solid' | 'rounded';
  orientation?: 'landscape' | 'portrait';
  // Back-of-card
  back_bg_color?: string;
  back_text_color?: string;
  back_content?: string;
  show_back_barcode?: boolean;
  show_back_emergency_info?: boolean;
  show_back_school_address?: boolean;
}

/** id_card_generation table */
export interface IdCardGeneration extends SchoolScopedEntity {
  design_id: UUID;
  batch_number: string;
  student_range: { start?: string; end?: string; filter?: Record<string, unknown> };
  total_cards: number;
  generated_cards: number;
  failed_cards: number;
  pdf_url: string | null;
  status: IdCardGenerationStatus;
  generated_by: UUID;
}

/** nfc_chip_assignments table */
export interface NfcChipAssignment {
  id: UUID;
  card_id: UUID;
  assigned_to_student: UUID;
  assigned_by: UUID;
  assignment_method: NfcAssignmentMethod;
  assignment_date: Timestamp;
}

// ==================== VIEW TYPES ====================

/** vw_nfc_card_status */
export interface NfcCardStatusView {
  assignment_id: UUID;
  school_id: UUID;
  card_number: string;
  card_status: NfcCardStatus;
  student_id: UUID;
  first_name: string;
  last_name: string;
  registration_number: string;
  assignment_date: Timestamp;
  valid_until: ISODate | null;
  scans_today: number;
}

// ==================== FORMS ====================

export interface AssignNfcCardForm {
  cardId: UUID;
  studentId: UUID;
  assignmentMethod: NfcAssignmentMethod;
}

export interface CreateIdCardDesignForm {
  name: string;
  designJson: IdCardDesignData;
}

export interface GenerateIdCardsForm {
  designId: UUID;
  studentRange: { start?: string; end?: string; filter?: Record<string, unknown> };
}