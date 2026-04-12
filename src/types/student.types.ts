// ============================================================
// STUDENT TYPES — Students, guardians, enrollments, documents, etc.
// ============================================================

import type {
  UUID, Timestamp, ISODate, Gender,
  SchoolScopedEntity, EnrollmentStatus, PassFailStatus,
} from './common.types';

/** students table — includes user_id from migration 006 */
export interface Student extends SchoolScopedEntity {
  user_id: UUID | null;
  registration_number: string;
  first_name: string;
  last_name: string;
  date_of_birth: ISODate;
  gender: Gender;
  photo_url: string | null;
  enrollment_date: ISODate;
  current_grade_level: string;
  current_class_id: UUID | null;
  status: StudentStatus;
  previous_school: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  updated_at: Timestamp;
}

export type StudentStatus = 'enrolled' | 'suspended' | 'expelled' | 'withdrawn' | 'graduated' | 'on_leave';

/** guardians table — includes user_id + school_id from migration 006 */
export interface Guardian {
  id: UUID;
  student_id: UUID;
  user_id: UUID | null;
  school_id: UUID | null;
  relationship: GuardianRelationship;
  full_name: string;
  email: string | null;
  phone: string;
  address: string | null;
  occupation: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export type GuardianRelationship = 'mother' | 'father' | 'guardian' | 'relative';

/** student_enrollments table */
export interface StudentEnrollment {
  id: UUID;
  student_id: UUID;
  school_id: UUID;
  academic_year: string;
  enrollment_date: ISODate;
  status: EnrollmentStatus;
  notes: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

/** student_documents table */
export interface StudentDocument {
  id: UUID;
  student_id: UUID;
  document_type: string;
  file_url: string;
  uploaded_by: UUID;
  created_at: Timestamp;
}

/** student_status_history table */
export interface StudentStatusHistory {
  id: UUID;
  student_id: UUID;
  previous_status: StudentStatus;
  new_status: StudentStatus;
  reason: string | null;
  changed_by: UUID;
  changed_at: Timestamp;
}

/** student_leave_records table */
export interface StudentLeaveRecord {
  id: UUID;
  student_id: UUID;
  leave_start_date: ISODate;
  leave_end_date: ISODate;
  reason: string | null;
  approved_by: UUID | null;
  created_at: Timestamp;
}

/** student_discipline_records table */
export interface StudentDisciplineRecord {
  id: UUID;
  student_id: UUID;
  incident_date: ISODate;
  incident_description: string;
  action_taken: string;
  action_details: Record<string, unknown> | null;
  reported_by: UUID;
  created_at: Timestamp;
}

/** student_academic_progress table */
export interface StudentAcademicProgress {
  id: UUID;
  student_id: UUID;
  academic_year: string;
  semester: string;
  overall_gpa: number;
  pass_fail_status: PassFailStatus;
  notes: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

/** student_grade_privacy_lock table */
export interface StudentGradePrivacyLock {
  id: UUID;
  student_id: UUID;
  pin_hash: string;
  is_enabled: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}

// ==================== VIEW TYPES ====================

/** vw_student_dashboard */
export interface StudentDashboardData {
  student_id: UUID;
  school_id: UUID;
  first_name: string;
  last_name: string;
  registration_number: string;
  date_of_birth: ISODate;
  class_id: UUID | null;
  class_name: string | null;
  class_level: string | null;
  term_name: string | null;
  start_date: ISODate | null;
  end_date: ISODate | null;
  avg_gpa: number | null;
  attendance_days: number;
  has_pending_fees: boolean;
  overdue_books: number;
}

/** vw_guardian_dashboard */
export interface GuardianDashboardData {
  guardian_id: UUID;
  school_id: UUID;
  guardian_full_name: string;
  phone: string;
  email: string | null;
  student_id: UUID;
  student_first_name: string;
  student_last_name: string;
  registration_number: string;
  class_name: string | null;
  class_level: string | null;
  fees_due: number;
  amount_paid: number;
  balance_due: number;
}

// ==================== FORMS ====================

export interface CreateStudentForm {
  firstName: string;
  lastName: string;
  dateOfBirth: ISODate;
  gender: Gender;
  photoUrl?: string;
  enrollmentDate: ISODate;
  currentGradeLevel: string;
  currentClassId?: UUID;
  previousSchool?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  guardian: CreateGuardianForm;
}

export interface UpdateStudentForm {
  firstName?: string;
  lastName?: string;
  photoUrl?: string;
  currentGradeLevel?: string;
  currentClassId?: UUID;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

export interface CreateGuardianForm {
  relationship: GuardianRelationship;
  fullName: string;
  email?: string;
  phone: string;
  address?: string;
  occupation?: string;
}

export interface StudentFilterParams {
  search?: string;
  status?: StudentStatus;
  gradeLevel?: string;
  classId?: UUID;
  gender?: Gender;
}