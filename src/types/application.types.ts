// ============================================================
// APPLICATION TYPES — Student applications, school settings
// ============================================================

import type { UUID, Timestamp, ISODate, SchoolScopedEntity } from './common.types';

export type ApplicationStatus =
  | 'submitted'
  | 'under_review'
  | 'documents_requested'
  | 'accepted'
  | 'rejected'
  | 'waitlisted'
  | 'enrolled'
  | 'withdrawn';

/** student_applications table */
export interface StudentApplication extends SchoolScopedEntity {
  academic_year: string;
  grade_level_applied: string;
  class_id: UUID | null;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  date_of_birth: ISODate;
  gender: string | null;
  nationality: string | null;
  address: string | null;
  photo_url: string | null;
  previous_school: string | null;
  previous_grade: string | null;
  guardian_full_name: string;
  guardian_relationship: string | null;
  guardian_email: string | null;
  guardian_phone: string;
  guardian_address: string | null;
  guardian_occupation: string | null;
  application_number: string;
  status: ApplicationStatus;
  submitted_at: Timestamp;
  application_fee_amount: number;
  application_fee_paid: boolean;
  application_fee_payment_ref: string | null;
  application_fee_paid_at: Timestamp | null;
  reviewed_by: UUID | null;
  reviewed_at: Timestamp | null;
  review_notes: string | null;
  documents: ApplicationDocument[];
  assigned_registration_number: string | null;
  registration_number: string | null;
  additional_notes: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  updated_at: Timestamp;
}

export interface ApplicationDocument {
  type: string;
  name?: string;
  url?: string;
  file_url: string;
  uploaded_at: string;
}

/** school_settings table */
export interface SchoolSetting {
  id: UUID;
  school_id: UUID;
  setting_key: string;
  setting_value: string;
  updated_by: UUID | null;
  updated_at: Timestamp;
}

// ==================== FORMS ====================

export interface SubmitApplicationForm {
  schoolId: UUID;
  academicYear: string;
  gradeLevel: string;
  classId?: UUID;
  firstName: string;
  lastName: string;
  dateOfBirth: ISODate;
  gender?: string;
  previousSchool?: string;
  previousGrade?: string;
  guardianFullName: string;
  guardianRelationship?: string;
  guardianEmail?: string;
  guardianPhone: string;
  guardianAddress?: string;
  guardianOccupation?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  documents?: ApplicationDocument[];
}

export interface ReviewApplicationForm {
  applicationId: UUID;
  status: ApplicationStatus;
  reviewNotes?: string;
}

export interface ApplicationFilterParams {
  status?: ApplicationStatus;
  academicYear?: string;
  gradeLevel?: string;
  search?: string;
}
