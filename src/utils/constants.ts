/**
 * SCHOOLSYNC CONSTANTS
 * All enums, user roles, letter categories, and system-wide constants
 */

// ==================== USER ROLES ====================
// Total: 14 roles (Platform + School Leadership + Departments + Users)
export const USER_ROLES = {
  // Platform Level
  SUPER_ADMIN: 'super_admin',

  // School Level - Leadership
  PROPRIETOR: 'proprietor', // Read-only access (ethics principle)
  PRINCIPAL: 'principal',
  VICE_PRINCIPAL: 'vice_principal',

  // School Level - Key Departments
  REGISTRAR: 'registrar', // Admissions, enrollment, student records
  BURSAR: 'bursar', // Finance, fees, payments
  DEAN: 'dean_of_students', // Student affairs, discipline

  // School Level - Support Staff
  ADMIN_STAFF: 'admin_staff',
  IT_ADMIN: 'it_admin',

  // School Level - Teaching & Services
  TEACHER: 'teacher',
  LIBRARIAN: 'librarian',
  COUNSELOR: 'guidance_counselor',

  // User Level
  STUDENT: 'student',
  PARENT: 'parent',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

// ==================== ROLE HIERARCHY ====================
export const ROLE_HIERARCHY = {
  [USER_ROLES.SUPER_ADMIN]: 10, // Highest
  [USER_ROLES.PROPRIETOR]: 9, // Special - read-only oversight
  [USER_ROLES.PRINCIPAL]: 8,
  [USER_ROLES.VICE_PRINCIPAL]: 7,
  [USER_ROLES.REGISTRAR]: 6,
  [USER_ROLES.BURSAR]: 6,
  [USER_ROLES.DEAN]: 6,
  [USER_ROLES.ADMIN_STAFF]: 5,
  [USER_ROLES.IT_ADMIN]: 5,
  [USER_ROLES.TEACHER]: 4,
  [USER_ROLES.LIBRARIAN]: 4,
  [USER_ROLES.COUNSELOR]: 4,
  [USER_ROLES.STUDENT]: 2,
  [USER_ROLES.PARENT]: 1, // Lowest
} as const;

// ==================== LETTER CATEGORIES & TYPES ====================
export const LETTER_CATEGORIES = {
  ADMISSIONS: 'admissions',
  DISCIPLINARY: 'disciplinary',
  ACADEMIC: 'academic',
  FINANCIAL: 'financial',
  ATTENDANCE: 'attendance',
  COMMUNICATION: 'communication',
  ADMINISTRATIVE: 'administrative',
} as const;

export const LETTER_TYPES = {
  // Admissions
  ACCEPTANCE: 'acceptance_letter',
  REJECTION: 'rejection_letter',
  WAITLIST: 'waitlist_notification',
  TRANSFER: 'transfer_letter',

  // Disciplinary
  WARNING: 'warning_letter',
  SUSPENSION: 'suspension_notice',
  NTR: 'ntr_notice', // Never To Return
  EXPULSION: 'expulsion_notice',

  // Academic
  REPORT_CARD_COVER: 'report_card_cover',
  PROMOTION: 'promotion_letter',
  RETENTION: 'retention_notice',
  HONOR_ROLL: 'honor_roll_certificate',

  // Financial
  FEE_REMINDER: 'fee_reminder',
  OUTSTANDING_BALANCE: 'outstanding_balance_notice',
  PAYMENT_RECEIPT: 'payment_receipt',

  // Attendance
  CHRONIC_ABSENTEEISM: 'chronic_absenteeism_notice',
  TRUANCY: 'truancy_notice',

  // Communication
  PTA_INVITATION: 'pta_meeting_invitation',
  ANNOUNCEMENT: 'general_announcement',
  EMERGENCY: 'emergency_notice',

  // Administrative
  ENROLLMENT_VERIFICATION: 'enrollment_verification',
  RECOMMENDATION: 'recommendation_letter',
  WITHDRAWAL: 'withdrawal_confirmation',
} as const;

export const LETTER_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;

// ==================== LETTER INSTANCE STATUS ====================
export const LETTER_INSTANCE_STATUS = {
  DRAFT: 'draft',
  PENDING_APPROVAL: 'pending_approval',
  CHANGES_REQUESTED: 'changes_requested',
  APPROVED: 'approved',
  SENT: 'sent',
  RECALLED: 'recalled',
  VOIDED: 'voided',
} as const;

// ==================== LETTER APPROVAL STATUS ====================
export const LETTER_APPROVAL_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CHANGES_REQUESTED: 'changes_requested',
} as const;

// ==================== LETTER DELIVERY ====================
export const LETTER_DELIVERY_CHANNEL = {
  PDF: 'pdf',
  PORTAL: 'portal',
  SMS: 'sms',
  EMAIL: 'email',
} as const;

export const LETTER_DELIVERY_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  READ: 'read',
} as const;

// ==================== PRINT QUEUE ====================
export const PRINT_QUEUE_STATUS = {
  QUEUED: 'queued',
  PRINTING: 'printing',
  PRINTED: 'printed',
  DISTRIBUTED: 'distributed',
  FAILED: 'failed',
} as const;

export const PRINT_DISTRIBUTION_METHOD = {
  HANDED_TO_STUDENT: 'handed_to_student',
  MAILED: 'mailed',
  PICKED_UP: 'picked_up',
} as const;

// ==================== LETTER AUDIT ====================
export const LETTER_AUDIT_ACTION = {
  CREATED: 'created',
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  RECALLED: 'recalled',
  VOIDED: 'voided',
  REPRINTED: 'reprinted',
  ACKNOWLEDGED: 'acknowledged',
} as const;

// ==================== ACKNOWLEDGMENT ====================
export const ACKNOWLEDGMENT_METHOD = {
  DIGITAL_PORTAL: 'digital_portal',
  DIGITAL_SMS: 'digital_sms',
  PHYSICAL_SIGNOFF: 'physical_signoff',
  PHONE_CONFIRMATION: 'phone_confirmation',
} as const;

// ==================== SUBSCRIPTION PLANS ====================
export const SUBSCRIPTION_PLANS = {
  BASIC_MONTHLY: 'basic_monthly',
  BASIC_YEARLY: 'basic_yearly',
  STANDARD_MONTHLY: 'standard_monthly',
  STANDARD_YEARLY: 'standard_yearly',
  PREMIUM_MONTHLY: 'premium_monthly',
  PREMIUM_YEARLY: 'premium_yearly',
  PREMIER: 'premier', // Lifetime partnership
} as const;

export const PLAN_PRICING = {
  BASIC: { usd: 25, yearlyUSD: 250 }, // Save 17%
  STANDARD: { usd: 50, yearlyUSD: 500 },
  PREMIUM: { usd: 100, yearlyUSD: 1000 },
  PREMIER: { usd: 0, yearlyUSD: 0 }, // Custom
} as const;

export const PLAN_LIMITS = {
  BASIC: 200, // students
  STANDARD: 500,
  PREMIUM: 1500,
  PREMIER: Infinity,
} as const;

// ==================== SUBSCRIPTION STATES ====================
export const SUBSCRIPTION_STATUS = {
  TRIAL: 'trial',
  ACTIVE: 'active',
  GRACE_PERIOD: 'grace',
  SUSPENDED: 'suspended',
  ARCHIVED: 'archived',
  CANCELLED: 'cancelled',
  PREMIER: 'premier',
} as const;

// ==================== BILLING CYCLE ====================
export const BILLING_CYCLE = {
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
  CUSTOM: 'custom',
  LIFETIME: 'lifetime',
} as const;

// ==================== PAYMENT METHODS ====================
export const PAYMENT_METHODS = {
  VISA: 'visa',
  MTN_MOMO: 'mtn',
  ORANGE_MONEY: 'orange',
  BANK_TRANSFER: 'bank',
  MANUAL: 'manual',
} as const;

export const CURRENCY = {
  USD: 'USD',
  LRD: 'LRD', // Liberian Dollar
} as const;

// ==================== ATTENDANCE ====================
export const ATTENDANCE_STATUS = {
  PRESENT: 'present',
  ABSENT: 'absent',
  LATE: 'late',
  EXCUSED: 'excused',
  UNEXCUSED: 'unexcused',
  MEDICAL_LEAVE: 'medical_leave',
} as const;

// ==================== GRADES ====================
export const GRADE_SCALE = {
  A: { min: 90, max: 100, gpa: 4.0, description: 'Excellent' },
  B: { min: 80, max: 89, gpa: 3.0, description: 'Very Good' },
  C: { min: 70, max: 79, gpa: 2.0, description: 'Good' },
  D: { min: 60, max: 69, gpa: 1.0, description: 'Satisfactory' },
  F: { min: 0, max: 59, gpa: 0.0, description: 'Fail' },
} as const;

// Kept for backward compat — old grades stored these values in the semester column
export const ACADEMIC_YEAR_TERMS = {
  FIRST_SEMESTER: 'first_semester',
  SECOND_SEMESTER: 'second_semester',
  THIRD_TERM: 'third_term',
} as const;

// ── Liberian Academic Structure: 2 Semesters × 3 Periods each ──
export const SEMESTERS = {
  SEMESTER_1: 'semester_1',
  SEMESTER_2: 'semester_2',
} as const;

export const SEMESTER_LABELS: Record<string, string> = {
  semester_1: 'Semester 1 (Sept – Feb)',
  semester_2: 'Semester 2 (Feb – July)',
};

export const MARKING_PERIODS = {
  P1: 'p1', P2: 'p2', P3: 'p3',
  P4: 'p4', P5: 'p5', P6: 'p6',
} as const;

export const MARKING_PERIOD_LABELS: Record<string, string> = {
  p1: 'Period 1',
  p2: 'Period 2',
  p3: 'Period 3 (Semester 1 Exam)',
  p4: 'Period 4',
  p5: 'Period 5',
  p6: 'Period 6 (Semester 2 Exam)',
};

// Which semester each marking period belongs to
export const PERIOD_SEMESTER_MAP: Record<string, string> = {
  p1: 'semester_1', p2: 'semester_1', p3: 'semester_1',
  p4: 'semester_2', p5: 'semester_2', p6: 'semester_2',
};

// Ordered list for UI rendering
export const MARKING_PERIOD_LIST = [
  { value: 'p1', label: 'Period 1',                    semester: 'semester_1', periodNumber: 1 },
  { value: 'p2', label: 'Period 2',                    semester: 'semester_1', periodNumber: 2 },
  { value: 'p3', label: 'Period 3 (Semester 1 Exam)', semester: 'semester_1', periodNumber: 3 },
  { value: 'p4', label: 'Period 4',                    semester: 'semester_2', periodNumber: 4 },
  { value: 'p5', label: 'Period 5',                    semester: 'semester_2', periodNumber: 5 },
  { value: 'p6', label: 'Period 6 (Semester 2 Exam)', semester: 'semester_2', periodNumber: 6 },
] as const;

// ==================== STUDENT STATUS ====================
export const STUDENT_STATUS = {
  ENROLLED: 'enrolled',
  SUSPENDED: 'suspended',
  EXPELLED: 'expelled',
  WITHDRAWN: 'withdrawn',
  GRADUATED: 'graduated',
  ON_LEAVE: 'on_leave',
} as const;

// ==================== FEE TYPES ====================
export const FEE_TYPES = {
  TUITION: 'tuition',
  REGISTRATION: 'registration',
  EXAM: 'exam',
  ACTIVITY: 'activity',
  LIBRARY: 'library',
  TRANSPORTATION: 'transportation',
  FACILITY: 'facility',
} as const;

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed',
  REFUNDED: 'refunded',
} as const;

// ==================== ID CARD ====================
export const ID_CARD_STATUS = {
  DESIGNED: 'designed',
  GENERATED: 'generated',
  PRINTED: 'printed',
  DISTRIBUTED: 'distributed',
  LOST: 'lost',
  REPLACED: 'replaced',
} as const;

// ==================== NOTIFICATION CHANNELS ====================
export const NOTIFICATION_CHANNELS = {
  EMAIL: 'email',
  SMS: 'sms',
  IN_APP: 'in_app',
  PUSH: 'push',
} as const;

// ==================== AUDIT ACTIONS ====================
export const AUDIT_ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  APPROVE: 'approve',
  REJECT: 'reject',
  SEND: 'send',
  EXPORT: 'export',
  LOGIN: 'login',
  LOGOUT: 'logout',
} as const;

// ==================== APP CONFIG ====================
export const APP_CONFIG = {
  APP_NAME: import.meta.env.VITE_APP_NAME || 'SchoolSync',
  APP_VERSION: import.meta.env.VITE_APP_VERSION || '4.0.0',
  TIMEOUT: parseInt(import.meta.env.VITE_API_TIMEOUT || '30000'),
  DEFAULT_PASSWORD: 'SchoolSync@2025', // Changed per school
  GRACE_PERIOD_DAYS: 7,
  TRIAL_DAYS: 30,
  SESSION_TIMEOUT_MINUTES: 30,
  GRADE_PRIVACY_PIN_LENGTH: { min: 4, max: 6 },
} as const;

// ==================== PAGINATION ====================
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  PAGE_SIZES: [10, 25, 50, 100],
} as const;

// ==================== DATE FORMATS ====================
export const DATE_FORMAT = {
  DISPLAY: 'DD/MM/YYYY', // Liberian standard
  DISPLAY_WITH_TIME: 'DD/MM/YYYY HH:mm',
  ISO: 'YYYY-MM-DD',
  ISO_WITH_TIME: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
} as const;

// ==================== LIBERIAN CONTEXT ====================
export const LIBERIAN_CONFIG = {
  COUNTRY: 'Liberia',
  DEFAULT_CURRENCY: 'LRD',
  EXCHANGE_RATE_UPDATE_INTERVAL: 6 * 60 * 60 * 1000, // Every 6 hours
  PHONE_CODE: '+231',
  TIMEZONE: 'Africa/Monrovia',
} as const;

// ==================== ERROR CODES ====================
export const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
} as const;

// ==================== REGEX PATTERNS ====================
export const REGEX = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^[0-9+\-\s()]+$/,
  PASSWORD: /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/,
  REGISTRATION_NUMBER: /^[A-Z]{3}-\d{4}-\d{4}$/,
  CURRENCY: /^\d+(\.\d{2})?$/,
} as const;

// ==================== MODULES ====================
export const FEATURES = {
  ACADEMIC_MANAGEMENT: 'academic_management',
  ATTENDANCE: 'attendance',
  FINANCIAL_MANAGEMENT: 'financial_management',
  COMMUNICATION_HUB: 'communication_hub',
  LIBRARY_MANAGEMENT: 'library_management',
  GUIDANCE_COUNSELING: 'guidance_counseling',
  ID_CARD_SYSTEM: 'id_card_system',
  LETTER_TEMPLATE: 'letter_template',
  REPORTS: 'reports',
} as const;

// ==================== NFC & ID CARD SYSTEM ====================
export const NFC_CARD_STATUS = {
  DESIGNED: 'designed',           // Card template created
  PRINTED: 'printed',             // Physical card printed
  ENCODED: 'encoded',             // NFC chip written
  ACTIVE: 'active',               // Ready to use
  INACTIVE: 'inactive',           // Disabled/Lost
  REPLACED: 'replaced',           // Lost card replaced
} as const;

export const NFC_SCAN_TYPES = {
  ATTENDANCE: 'attendance',        // Mark attendance
  LIBRARY: 'library',             // Book checkout
  GATE_ACCESS: 'gate_access',     // Entry/exit logging
  ASSIGNMENT: 'assignment',       // Admin assigning to student
  VERIFICATION: 'verification',   // Verify card validity
} as const;

export const NFC_READER_TYPES = {
  EXTERNAL_USB: 'external_usb',   // USB device reader
  ANDROID_NFC: 'android_nfc',     // Android phone tap
  WEB_NFC: 'web_nfc',             // Browser Web NFC API
} as const;

// ==================== LOG LEVELS ====================
export const LOG_LEVELS = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
} as const;
