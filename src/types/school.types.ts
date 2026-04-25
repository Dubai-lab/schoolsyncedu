// ============================================================
// SCHOOL TYPES — Schools, classes, subjects, timetables, calendar
// ============================================================

import type {
  UUID,
  Timestamp,
  ISODate,
  TimeString,
  DayOfWeek,
  SchoolScopedEntity,
} from './common.types';

/** schools table */
export interface School {
  id: UUID;
  name: string;
  slug: string;
  location: string;
  moe_registration_number: string;
  principal_name: string;
  principal_email: string;
  proprietor_name: string | null;
  proprietor_email: string | null;
  phone: string;
  address: string | null;
  school_code: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  motto: string | null;
  website: string | null;
  hero_headline: string | null;
  hero_subtext: string | null;
  about_text: string | null;
  founded_year: number | null;
  county: string | null;
  custom_domain: string | null;
  site_published: boolean;
  site_config: SiteConfig;
  /** Whether the school portal is accessible. False = suspended (subscription expired). */
  is_online: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}

/** Transcript visual & signature configuration */
export interface TranscriptConfig {
  // ── Colors ────────────────────────────────────────────────────────────────
  header_bg_color: string;       // hex, default #b91c1c
  header_text_color: string;     // hex, default #ffffff
  table_header_bg: string;       // hex, default #f1f5f9
  row_alt_bg: string;            // alternating row color, default #f8fafc

  // ── Header layout ─────────────────────────────────────────────────────────
  header_layout: 'centered' | 'logo-left' | 'logo-both';
  show_logo: boolean;            // show school logo (from school.logo_url)
  seal_url: string;              // optional right-side emblem / seal image URL
  show_outer_border: boolean;    // border around entire document

  // ── Header text ───────────────────────────────────────────────────────────
  school_system_name: string;    // optional line above school name e.g. "SDA School System"
  transcript_title: string;      // e.g. "OFFICIAL TRANSCRIPT FOR SENIOR HIGH"
  show_contact_info: boolean;    // show address, phone, email in header

  // ── Signatories & footer ──────────────────────────────────────────────────
  principal_name: string;
  registrar_name: string;
  show_motto_footer: boolean;
}

/** Flexible site design configuration stored as JSONB */
export interface SiteConfig {
  hero_image_url?: string;
  building_image_url?: string;
  gallery_images?: Array<{ url: string; caption: string }>;
  stats?: Array<{ label: string; value: string; icon: string }>;
  programs?: Array<{ name: string; description: string; icon: string }>;
  announcements?: Array<{ title: string; date: string; excerpt: string }>;
  mission_text?: string;
  vision_text?: string;
  principal_message?: string;
  principal_image_url?: string;
  social_links?: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    youtube?: string;
    linkedin?: string;
    tiktok?: string;
  };
  school_hours?: string;
  sections_visible?: Record<string, boolean>;
  /** Public fee information page */
  fee_schedule?: FeeScheduleConfig;
  /** School-branded auth / login page */
  auth_page?: AuthPageConfig;
  /** Transcript visual & signing configuration */
  transcript_config?: TranscriptConfig;
}

/** Customisable school-branded login page */
export interface AuthPageConfig {
  /** Welcome heading shown above the form */
  welcome_heading?: string;
  /** Subtitle / description below the heading */
  welcome_subtext?: string;
  /** Announcement banner text (e.g. "School reopens Jan 15") */
  announcement?: string;
  /** Background image URL for the left branding panel */
  background_image_url?: string;
  /** Background gradient colour (fallback if no image) */
  background_color?: string;
  /** Accent / button color override — defaults to school primary_color */
  accent_color?: string;
  /** Feature cards shown on the branding panel */
  features?: Array<{ label: string; description: string }>;
  /** Show "Sign in with Registration Number" student link */
  show_student_login?: boolean;
  /** Show "Forgot password" link */
  show_forgot_password?: boolean;
  /** Footer text */
  footer_text?: string;
}

/** Fee schedule / information sheet published on the school site */
export interface FeeScheduleConfig {
  published: boolean;
  page_title?: string;
  header_text?: string;
  footnote?: string;
  academic_year?: string;
  currency_label?: string;
  show_lrd?: boolean;
  categories: FeeScheduleCategory[];
}

export interface FeeScheduleCategory {
  name: string;
  description?: string;
  items: FeeScheduleItem[];
}

export interface FeeScheduleItem {
  grade_or_class: string;
  fee_type: string;
  amount_usd: number;
  amount_lrd?: number;
  description?: string;
}

/** classes table */
export interface Class extends SchoolScopedEntity {
  name: string;
  grade_level: string;
  section: string | null;
  class_teacher_id: UUID | null;
  capacity: number;
  updated_at: Timestamp;
}

/** class_assignments table */
export interface ClassAssignment {
  id: UUID;
  class_id: UUID;
  student_id: UUID;
  academic_year: string;
  assigned_at: Timestamp;
  removed_at: Timestamp | null;
}

/** subjects table */
export interface Subject extends SchoolScopedEntity {
  name: string;
  code: string;
  description: string | null;
}

/** class_subjects table */
export interface ClassSubject {
  id: UUID;
  class_id: UUID;
  subject_id: UUID;
  teacher_id: UUID;
  academic_year: string;
}

/** timetables table */
export interface TimetableEntry {
  id: UUID;
  class_id: UUID;
  academic_year: string;
  day_of_week: DayOfWeek;
  start_time: TimeString;
  end_time: TimeString;
  subject_id: UUID;
  teacher_id: UUID;
  location: string | null;
  created_at: Timestamp;
}

/** Holiday entry stored in academic_calendar.holidays JSONB */
export interface Holiday {
  name: string;
  start_date: ISODate;
  end_date: ISODate;
}

/** academic_calendar table */
export interface AcademicCalendar extends SchoolScopedEntity {
  academic_year: string;
  /** For periods: 'p1'–'p6'. For semesters: 'semester_1' | 'semester_2'. */
  term_name: string;
  start_date: ISODate;
  end_date: ISODate;
  holidays: Holiday[];
  /** 'semester' | 'marking_period' */
  period_type: 'semester' | 'marking_period';
  /** 1–2 for semesters; 1–6 for marking periods */
  period_number: number | null;
  /** Which semester (1 or 2) this period belongs to; null for semester rows */
  semester_number: number | null;
}

// ==================== VIEW TYPES ====================

/** vw_teacher_classload */
export interface TeacherClassload {
  teacher_id: UUID;
  school_id: UUID;
  first_name: string;
  last_name: string;
  class_id: UUID;
  class_name: string;
  grade_level: string;
  subject_name: string | null;
  academic_year: string;
}

// ==================== FORMS ====================

export interface CreateSchoolForm {
  name: string;
  location: string;
  moeRegistrationNumber: string;
  principalName: string;
  principalEmail: string;
  proprietorName?: string;
  proprietorEmail?: string;
  phone: string;
  address?: string;
  schoolCode: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  motto?: string;
  website?: string;
}

export interface CreateClassForm {
  name: string;
  gradeLevel: string;
  section?: string;
  classTeacherId?: UUID;
  capacity: number;
}

export interface CreateSubjectForm {
  name: string;
  code: string;
  description?: string;
}

export interface TimetableForm {
  classId: UUID;
  academicYear: string;
  dayOfWeek: DayOfWeek;
  startTime: TimeString;
  endTime: TimeString;
  subjectId: UUID;
  teacherId: UUID;
  location?: string;
}

export interface AcademicCalendarForm {
  academicYear: string;
  termName: string;
  startDate: ISODate;
  endDate: ISODate;
  holidays?: Holiday[];
}
