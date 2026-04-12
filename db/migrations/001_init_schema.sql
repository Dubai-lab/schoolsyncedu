-- ============================================================
-- SCHOOLSYNC DATABASE SCHEMA - COMPLETE INITIALIZATION
-- SchoolSync v4.0 - SaaS School Management System for Liberia
-- Total Tables: 74
-- Created: April 2026
-- ============================================================

-- ============================================================
-- MODULE 1: CORE & MULTI-TENANCY (7 tables)
-- ============================================================

-- Create ENUM types first
CREATE TYPE user_role AS ENUM (
  'super_admin', 'proprietor', 'principal', 'vice_principal',
  'registrar', 'bursar', 'dean_of_students', 'admin_staff',
  'it_admin', 'teacher', 'librarian', 'guidance_counselor',
  'student', 'parent'
);

CREATE TYPE audit_action AS ENUM (
  'create', 'read', 'update', 'delete', 'approve', 'reject',
  'send', 'export', 'login', 'logout'
);

CREATE TYPE student_status AS ENUM (
  'enrolled', 'suspended', 'expelled', 'withdrawn', 'graduated', 'on_leave'
);

CREATE TYPE attendance_status AS ENUM (
  'present', 'absent', 'late', 'excused', 'unexcused', 'medical_leave'
);

CREATE TYPE letter_category AS ENUM (
  'admissions', 'disciplinary', 'academic', 'financial',
  'attendance', 'communication', 'administrative'
);

CREATE TYPE letter_type AS ENUM (
  'acceptance_letter', 'rejection_letter', 'waitlist_notification', 'transfer_letter',
  'warning_letter', 'suspension_notice', 'ntr_notice', 'expulsion_notice',
  'report_card_cover', 'promotion_letter', 'retention_notice', 'honor_roll_certificate',
  'fee_reminder', 'outstanding_balance_notice', 'payment_receipt',
  'chronic_absenteeism_notice', 'truancy_notice',
  'pta_meeting_invitation', 'general_announcement', 'emergency_notice',
  'enrollment_verification', 'recommendation_letter', 'withdrawal_confirmation'
);

CREATE TYPE letter_severity AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TYPE payment_status AS ENUM ('pending', 'success', 'failed', 'refunded');

CREATE TYPE payment_method AS ENUM ('visa', 'mtn', 'orange', 'bank', 'manual');

CREATE TYPE subscription_status AS ENUM (
  'trial', 'active', 'grace', 'suspended', 'archived', 'cancelled', 'premier'
);

CREATE TYPE billing_cycle AS ENUM ('monthly', 'yearly', 'custom', 'lifetime');

CREATE TYPE id_card_status AS ENUM (
  'designed', 'generated', 'printed', 'distributed', 'lost', 'replaced'
);

CREATE TYPE nfc_card_status AS ENUM (
  'designed', 'printed', 'encoded', 'active', 'inactive', 'replaced'
);

CREATE TYPE nfc_scan_type AS ENUM (
  'attendance', 'library', 'gate_access', 'assignment', 'verification'
);

CREATE TYPE nfc_reader_type AS ENUM ('external_usb', 'android_nfc', 'web_nfc');

CREATE TYPE log_level AS ENUM ('DEBUG', 'INFO', 'WARN', 'ERROR');

-- ============================================================
-- TABLE 1: schools (Multi-tenant root)
-- ============================================================
CREATE TABLE schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  moe_registration_number VARCHAR(50) UNIQUE,
  principal_name VARCHAR(255),
  principal_email VARCHAR(255),
  proprietor_name VARCHAR(255),
  proprietor_email VARCHAR(255),
  phone VARCHAR(20),
  address TEXT,
  school_code VARCHAR(3) UNIQUE NOT NULL, -- For registration numbers
  logo_url TEXT,
  primary_color VARCHAR(7),    -- Hex color
  secondary_color VARCHAR(7),  -- Hex color
  motto TEXT,
  website VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 2: users
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  phone VARCHAR(20),
  role user_role NOT NULL,
  profile_photo_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(school_id, email)
);

-- ============================================================
-- TABLE 3: user_roles
-- ============================================================
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  role_name user_role NOT NULL,
  permissions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(school_id, role_name)
);

-- ============================================================
-- TABLE 4: permissions
-- ============================================================
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  module VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 5: audit_logs
-- ============================================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action audit_action NOT NULL,
  entity_type VARCHAR(100),
  entity_id VARCHAR(100),
  description TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 6: system_logs
-- ============================================================
CREATE TABLE system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_level log_level NOT NULL,
  module VARCHAR(100),
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 7: webhook_events
-- ============================================================
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP
);

-- ============================================================
-- MODULE 2: STUDENT MANAGEMENT (9 tables)
-- ============================================================

-- ============================================================
-- TABLE 8: students
-- ============================================================
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  registration_number VARCHAR(50) NOT NULL,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  date_of_birth DATE,
  gender VARCHAR(50),
  photo_url TEXT,
  enrollment_date DATE,
  current_grade_level VARCHAR(50),
  current_class_id UUID,
  status student_status DEFAULT 'enrolled',
  previous_school VARCHAR(255),
  emergency_contact_name VARCHAR(255),
  emergency_contact_phone VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(school_id, registration_number)
);

-- ============================================================
-- TABLE 9: guardians
-- ============================================================
CREATE TABLE guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  relationship VARCHAR(50),
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  address TEXT,
  occupation VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 10: student_enrollments
-- ============================================================
CREATE TABLE student_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year VARCHAR(50) NOT NULL,
  enrollment_date DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 11: student_documents
-- ============================================================
CREATE TABLE student_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  document_type VARCHAR(100),
  file_url VARCHAR(500) NOT NULL,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 12: student_status_history
-- ============================================================
CREATE TABLE student_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  previous_status student_status,
  new_status student_status NOT NULL,
  reason TEXT,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 13: student_leave_records
-- ============================================================
CREATE TABLE student_leave_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  leave_start_date DATE NOT NULL,
  leave_end_date DATE NOT NULL,
  reason TEXT,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 14: student_discipline_records
-- ============================================================
CREATE TABLE student_discipline_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  incident_date DATE NOT NULL,
  incident_description TEXT NOT NULL,
  action_taken VARCHAR(100),
  action_details JSONB,
  reported_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 15: student_academic_progress
-- ============================================================
CREATE TABLE student_academic_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  academic_year VARCHAR(50) NOT NULL,
  semester VARCHAR(50),
  overall_gpa DECIMAL(3,2),
  pass_fail_status VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 16: student_grade_privacy_lock
-- ============================================================
CREATE TABLE student_grade_privacy_lock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL UNIQUE REFERENCES students(id) ON DELETE CASCADE,
  pin_hash VARCHAR(255),
  is_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- MODULE 3: ACADEMIC MANAGEMENT (10 tables)
-- ============================================================

-- ============================================================
-- TABLE 17: classes
-- ============================================================
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  grade_level VARCHAR(50),
  section VARCHAR(10),
  class_teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
  capacity INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(school_id, name, grade_level, section)
);

-- Update students table to add FK to classes
ALTER TABLE students ADD CONSTRAINT fk_students_class 
  FOREIGN KEY (current_class_id) REFERENCES classes(id) ON DELETE SET NULL;

-- ============================================================
-- TABLE 18: class_assignments
-- ============================================================
CREATE TABLE class_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  academic_year VARCHAR(50) NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  removed_at TIMESTAMP
);

-- ============================================================
-- TABLE 19: subjects
-- ============================================================
CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(school_id, name)
);

-- ============================================================
-- TABLE 20: class_subjects
-- ============================================================
CREATE TABLE class_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
  academic_year VARCHAR(50) NOT NULL
);

-- ============================================================
-- TABLE 21: timetables
-- ============================================================
CREATE TABLE timetables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  academic_year VARCHAR(50) NOT NULL,
  day_of_week VARCHAR(20),
  start_time TIME,
  end_time TIME,
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
  location VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 22: academic_calendar
-- ============================================================
CREATE TABLE academic_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year VARCHAR(50) NOT NULL,
  term_name VARCHAR(100),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  holidays JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(school_id, academic_year, term_name)
);

-- ============================================================
-- TABLE 23: grades
-- ============================================================
CREATE TABLE grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  academic_year VARCHAR(50) NOT NULL,
  semester VARCHAR(50),
  score DECIMAL(5,2),
  letter_grade VARCHAR(2),
  gpa_points DECIMAL(3,2),
  entered_by UUID REFERENCES users(id) ON DELETE SET NULL,
  entered_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 24: report_cards
-- ============================================================
CREATE TABLE report_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  academic_year VARCHAR(50) NOT NULL,
  semester VARCHAR(50),
  generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  pdf_url TEXT,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 25: transcripts
-- ============================================================
CREATE TABLE transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  academic_record JSONB,
  overall_gpa DECIMAL(3,2),
  generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 26: promotion_records
-- ============================================================
CREATE TABLE promotion_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  from_grade VARCHAR(50),
  to_grade VARCHAR(50),
  academic_year VARCHAR(50) NOT NULL,
  promotion_date DATE NOT NULL,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- MODULE 4: ATTENDANCE MANAGEMENT (5 tables)
-- ============================================================

-- ============================================================
-- TABLE 27: attendance_records
-- ============================================================
CREATE TABLE attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status attendance_status DEFAULT 'present',
  marked_by UUID REFERENCES users(id) ON DELETE SET NULL,
  marked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  UNIQUE(student_id, attendance_date)
);

-- ============================================================
-- TABLE 28: attendance_summary
-- ============================================================
CREATE TABLE attendance_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  academic_year VARCHAR(50) NOT NULL,
  total_days INTEGER DEFAULT 0,
  present_days INTEGER DEFAULT 0,
  absent_days INTEGER DEFAULT 0,
  late_days INTEGER DEFAULT 0,
  excused_days INTEGER DEFAULT 0,
  attendance_percentage DECIMAL(5,2),
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(student_id, academic_year)
);

-- ============================================================
-- TABLE 29: nfc_cards
-- ============================================================
CREATE TABLE nfc_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  card_number VARCHAR(50) UNIQUE NOT NULL,
  nfc_chip_id VARCHAR(255) UNIQUE,
  nfc_chip_data JSONB,
  status nfc_card_status DEFAULT 'designed',
  encoded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  encoded_at TIMESTAMP,
  assigned_at TIMESTAMP,
  valid_until DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 30: nfc_attendance_logs
-- ============================================================
CREATE TABLE nfc_attendance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES nfc_cards(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  tapped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reader_location VARCHAR(255),
  reader_type nfc_reader_type,
  scan_type nfc_scan_type,
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 31: nfc_readers
-- ============================================================
CREATE TABLE nfc_readers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(255),
  device_id VARCHAR(255),
  location VARCHAR(255),
  reader_type nfc_reader_type,
  is_active BOOLEAN DEFAULT TRUE,
  last_sync TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- MODULE 5: FINANCIAL MANAGEMENT (9 tables)
-- ============================================================

-- ============================================================
-- TABLE 32: fee_structures
-- ============================================================
CREATE TABLE fee_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year VARCHAR(50) NOT NULL,
  grade_level VARCHAR(50),
  fee_type VARCHAR(100) NOT NULL,
  amount_usd DECIMAL(10,2),
  amount_lrd DECIMAL(12,2),
  description TEXT,
  due_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 33: student_fees
-- ============================================================
CREATE TABLE student_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  fee_structure_id UUID NOT NULL REFERENCES fee_structures(id) ON DELETE CASCADE,
  academic_year VARCHAR(50) NOT NULL,
  amount_due DECIMAL(10,2),
  amount_paid DECIMAL(10,2) DEFAULT 0,
  balance DECIMAL(10,2),
  status VARCHAR(50) DEFAULT 'pending',
  due_date DATE,
  last_reminder_sent TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 34: payments
-- ============================================================
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  student_fee_id UUID REFERENCES student_fees(id) ON DELETE SET NULL,
  amount_usd DECIMAL(10,2),
  amount_lrd DECIMAL(12,2),
  currency_charged VARCHAR(10),
  payment_method payment_method NOT NULL,
  gateway_ref VARCHAR(255),
  status payment_status DEFAULT 'pending',
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  payment_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 35: invoices
-- ============================================================
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  total_amount DECIMAL(10,2),
  status VARCHAR(50) DEFAULT 'draft',
  due_date DATE,
  issued_date DATE,
  paid_at TIMESTAMP,
  pdf_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 36: payment_receipts
-- ============================================================
CREATE TABLE payment_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  receipt_number VARCHAR(50) UNIQUE NOT NULL,
  amount_received DECIMAL(10,2),
  received_from VARCHAR(255),
  received_by UUID REFERENCES users(id) ON DELETE SET NULL,
  issued_date DATE,
  pdf_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 37: payment_history
-- ============================================================
CREATE TABLE payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_fee_id UUID NOT NULL REFERENCES student_fees(id) ON DELETE CASCADE,
  previous_balance DECIMAL(10,2),
  payment_amount DECIMAL(10,2),
  new_balance DECIMAL(10,2),
  payment_date TIMESTAMP,
  payment_method payment_method
);

-- ============================================================
-- TABLE 38: expense_records
-- ============================================================
CREATE TABLE expense_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  category VARCHAR(100),
  amount DECIMAL(10,2),
  receipt_url TEXT,
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  recorded_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 39: financial_reports
-- ============================================================
CREATE TABLE financial_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  report_type VARCHAR(100),
  period_start DATE,
  period_end DATE,
  data JSONB,
  generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 40: exchange_rates
-- ============================================================
CREATE TABLE exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency VARCHAR(3) NOT NULL,
  to_currency VARCHAR(3) NOT NULL,
  rate DECIMAL(10,4) NOT NULL,
  source VARCHAR(50),
  fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(from_currency, to_currency)
);

-- ============================================================
-- MODULE 6: LETTER & TEMPLATE SYSTEM (8 tables)
-- ============================================================

-- ============================================================
-- TABLE 41: letter_templates
-- ============================================================
CREATE TABLE letter_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  category letter_category NOT NULL,
  letter_type letter_type NOT NULL,
  severity letter_severity DEFAULT 'medium',
  subject VARCHAR(500),
  body_html TEXT,
  placeholders_used JSONB DEFAULT '[]'::jsonb,
  is_starter BOOLEAN DEFAULT FALSE,
  active_version_id UUID,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 42: letter_template_versions
-- ============================================================
CREATE TABLE letter_template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES letter_templates(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content_json JSONB,
  status VARCHAR(50) DEFAULT 'draft',
  change_summary TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(template_id, version_number)
);

-- ============================================================
-- TABLE 43: letter_instances
-- ============================================================
CREATE TABLE letter_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES letter_templates(id) ON DELETE CASCADE,
  template_version_id UUID REFERENCES letter_template_versions(id) ON DELETE SET NULL,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  recipient_type VARCHAR(100),
  recipient_data JSONB,
  reference_number VARCHAR(50) UNIQUE NOT NULL,
  status VARCHAR(50) DEFAULT 'draft',
  generated_pdf_url TEXT,
  delivery_channels JSONB DEFAULT '[]'::jsonb,
  batch_id UUID,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 44: letter_approvals
-- ============================================================
CREATE TABLE letter_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  letter_instance_id UUID NOT NULL REFERENCES letter_instances(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'pending',
  comments TEXT,
  approval_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 45: letter_deliveries
-- ============================================================
CREATE TABLE letter_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  letter_instance_id UUID NOT NULL REFERENCES letter_instances(id) ON DELETE CASCADE,
  channel VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  delivery_timestamp TIMESTAMP,
  read_at TIMESTAMP,
  delivery_metadata JSONB
);

-- ============================================================
-- TABLE 46: letter_recalls
-- ============================================================
CREATE TABLE letter_recalls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  letter_instance_id UUID NOT NULL REFERENCES letter_instances(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL,
  reason VARCHAR(100),
  reason_detail TEXT,
  initiated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  channels_notified JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 47: letter_acknowledgments
-- ============================================================
CREATE TABLE letter_acknowledgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  letter_instance_id UUID NOT NULL REFERENCES letter_instances(id) ON DELETE CASCADE,
  acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
  method VARCHAR(100),
  acknowledged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  signature_data TEXT
);

-- ============================================================
-- TABLE 48: print_queue
-- ============================================================
CREATE TABLE print_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  letter_instance_id UUID NOT NULL REFERENCES letter_instances(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'queued',
  priority INTEGER DEFAULT 0,
  distribution_method VARCHAR(50),
  distributed_at TIMESTAMP,
  distributed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  page_count INTEGER,
  reprint_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- MODULE 7: COMMUNICATION HUB (5 tables)
-- ============================================================

-- ============================================================
-- TABLE 49: announcements
-- ============================================================
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  recipient_group VARCHAR(255),
  is_published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMP,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 50: messages
-- ============================================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject VARCHAR(255),
  body TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 51: notifications
-- ============================================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL,
  title VARCHAR(255),
  message TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,
  data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 52: notification_preferences
-- ============================================================
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel VARCHAR(50),
  notification_type VARCHAR(100),
  is_enabled BOOLEAN DEFAULT TRUE,
  frequency VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, channel, notification_type)
);

-- ============================================================
-- TABLE 53: sms_logs
-- ============================================================
CREATE TABLE sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  recipient_phone VARCHAR(20) NOT NULL,
  message_content VARCHAR(160),
  gateway VARCHAR(50),
  gateway_ref VARCHAR(255),
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- MODULE 8: LIBRARY MANAGEMENT (6 tables)
-- ============================================================

-- ============================================================
-- TABLE 54: books
-- ============================================================
CREATE TABLE books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  author VARCHAR(255),
  isbn VARCHAR(20),
  category VARCHAR(100),
  description TEXT,
  publisher VARCHAR(255),
  publication_year INTEGER,
  total_copies INTEGER DEFAULT 1,
  available_copies INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(school_id, isbn)
);

-- ============================================================
-- TABLE 55: book_copies
-- ============================================================
CREATE TABLE book_copies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  barcode VARCHAR(100) UNIQUE NOT NULL,
  status VARCHAR(50) DEFAULT 'available',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 56: book_checkouts
-- ============================================================
CREATE TABLE book_checkouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  book_copy_id UUID NOT NULL REFERENCES book_copies(id) ON DELETE CASCADE,
  checkout_date DATE NOT NULL,
  due_date DATE NOT NULL,
  is_returned BOOLEAN DEFAULT FALSE,
  checked_out_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- TABLE 57: book_returns
-- ============================================================
CREATE TABLE book_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_copy_id UUID NOT NULL REFERENCES book_copies(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  return_date DATE NOT NULL,
  condition VARCHAR(50),
  checked_in_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 58: overdue_books
-- ============================================================
CREATE TABLE overdue_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  book_copy_id UUID NOT NULL REFERENCES book_copies(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  days_overdue INTEGER,
  fine_amount DECIMAL(10,2),
  status VARCHAR(50) DEFAULT 'pending',
  reminder_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 59: library_reports
-- ============================================================
CREATE TABLE library_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  report_type VARCHAR(100),
  period VARCHAR(50),
  data JSONB,
  generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- MODULE 9: GUIDANCE & COUNSELING (4 tables)
-- ============================================================

-- ============================================================
-- TABLE 60: counseling_sessions
-- ============================================================
CREATE TABLE counseling_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  counselor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  session_time TIME,
  duration_minutes INTEGER,
  notes TEXT,
  issues_discussed JSONB,
  action_items JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 61: student_incidents
-- ============================================================
CREATE TABLE student_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  incident_date DATE NOT NULL,
  incident_type VARCHAR(100),
  description TEXT,
  severity VARCHAR(50),
  reported_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 62: incident_actions
-- ============================================================
CREATE TABLE incident_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES student_incidents(id) ON DELETE CASCADE,
  action_type VARCHAR(100),
  description TEXT,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  action_date DATE
);

-- ============================================================
-- TABLE 63: parent_meetings
-- ============================================================
CREATE TABLE parent_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  staff_member_id UUID REFERENCES users(id) ON DELETE SET NULL,
  meeting_date DATE NOT NULL,
  meeting_time TIME,
  topics TEXT,
  notes TEXT,
  action_items JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- MODULE 10: ID CARD SYSTEM (4 tables)
-- ============================================================

-- ============================================================
-- TABLE 64: id_card_designs
-- ============================================================
CREATE TABLE id_card_designs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(255),
  design_json JSONB,
  is_active BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 65: id_card_generation
-- ============================================================
CREATE TABLE id_card_generation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  design_id UUID NOT NULL REFERENCES id_card_designs(id) ON DELETE CASCADE,
  batch_number VARCHAR(50),
  student_range JSONB,
  total_cards INTEGER,
  generated_cards INTEGER DEFAULT 0,
  failed_cards INTEGER DEFAULT 0,
  pdf_url TEXT,
  status VARCHAR(50) DEFAULT 'in_progress',
  generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 66: nfc_chip_assignments
-- ============================================================
CREATE TABLE nfc_chip_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES nfc_cards(id) ON DELETE CASCADE,
  assigned_to_student UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assignment_method VARCHAR(50),
  assignment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- MODULE 11: PLATFORM BILLING & SUBSCRIPTIONS (8 tables)
-- ============================================================

-- ============================================================
-- TABLE 67: subscription_plans
-- ============================================================
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  price_usd DECIMAL(10,2),
  billing_cycle billing_cycle NOT NULL,
  student_limit INTEGER,
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  is_visible BOOLEAN DEFAULT TRUE,
  trial_days INTEGER DEFAULT 30,
  grace_days INTEGER DEFAULT 7,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 68: subscriptions
-- ============================================================
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
  status subscription_status DEFAULT 'trial',
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  payment_method payment_method,
  auto_renew BOOLEAN DEFAULT TRUE,
  discount_id UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 69: discounts
-- ============================================================
CREATE TABLE discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100),
  value DECIMAL(10,2),
  coupon_code VARCHAR(50) UNIQUE,
  start_date DATE,
  end_date DATE,
  applicable_plans JSONB,
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  stackable BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 70: billing_invoices
-- ============================================================
CREATE TABLE billing_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  amount_usd DECIMAL(10,2),
  amount_lrd DECIMAL(12,2),
  status VARCHAR(50) DEFAULT 'draft',
  due_date DATE,
  paid_at TIMESTAMP,
  pdf_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 71: payment_method_records
-- ============================================================
CREATE TABLE payment_method_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  method_type payment_method NOT NULL,
  last_four VARCHAR(10),
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 72: platform_payments
-- ============================================================
CREATE TABLE platform_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  amount_usd DECIMAL(10,2),
  amount_lrd DECIMAL(12,2),
  currency_charged VARCHAR(10),
  payment_method payment_method NOT NULL,
  gateway_ref VARCHAR(255),
  status payment_status DEFAULT 'pending',
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 73: subscription_history
-- ============================================================
CREATE TABLE subscription_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  previous_status subscription_status,
  new_status subscription_status NOT NULL,
  reason TEXT,
  changed_by UUID,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLE 74: platform_admin_users
-- ============================================================
CREATE TABLE platform_admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- FINAL UPDATE: Add foreign key for letter_templates.active_version_id
-- ============================================================
ALTER TABLE letter_templates 
ADD CONSTRAINT fk_letter_template_active_version 
FOREIGN KEY (active_version_id) REFERENCES letter_template_versions(id) ON DELETE SET NULL;

-- ============================================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================================

-- Core indexes
CREATE INDEX idx_schools_code ON schools(school_code);
CREATE INDEX idx_users_school_email ON users(school_id, email);
CREATE INDEX idx_users_role ON users(role);

-- Student indexes
CREATE INDEX idx_students_school_reg ON students(school_id, registration_number);
CREATE INDEX idx_students_status ON students(status);
CREATE INDEX idx_attendance_student_date ON attendance_records(student_id, attendance_date);

-- Academic indexes
CREATE INDEX idx_grades_student_subject ON grades(student_id, subject_id);
CREATE INDEX idx_class_assignments_student ON class_assignments(student_id);

-- Letter indexes
CREATE INDEX idx_letter_instances_student ON letter_instances(student_id);
CREATE INDEX idx_letter_instances_status ON letter_instances(status);
CREATE INDEX idx_letter_deliveries_channel ON letter_deliveries(channel);

-- Financial indexes
CREATE INDEX idx_student_fees_student ON student_fees(student_id);
CREATE INDEX idx_payments_student ON payments(student_id);
CREATE INDEX idx_payments_status ON payments(status);

-- NFC indexes
CREATE INDEX idx_nfc_cards_student ON nfc_cards(student_id);
CREATE INDEX idx_nfc_cards_status ON nfc_cards(status);
CREATE INDEX idx_nfc_attendance_tapped ON nfc_attendance_logs(tapped_at);

-- Audit index
CREATE INDEX idx_audit_logs_school_action ON audit_logs(school_id, action);

-- ============================================================
-- MIGRATION COMPLETE: 74 TABLES CREATED
-- ============================================================
-- Total Tables: 74
-- Total Indexes: 16
-- Date: April 2026
-- ============================================================
