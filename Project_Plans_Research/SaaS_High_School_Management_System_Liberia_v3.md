# SaaS_High_School_Management_System_Liberia_v3.pdf


---
## Page 1

SaaS School Management System for Liberia | v3.0 | Page 1
Design and Implementation Plan for a SaaS-Based School
Management System in Liberia
 Comprehensive K-12 System Design Document
 
 Version 3.0 | April 07, 2026
 
Document Version
3.0 (Final)
Scope
K-12 (Kindergarten through Grade 12)
Platform
Web-Based SaaS + PWA Mobile
Target Market
Republic of Liberia
Authentication
Universal Default Password + Grade Privacy Lock


---
## Page 2

SaaS School Management System for Liberia | v3.0 | Page 2
Table of Contents
1.   Liberian Education System Overview
2.   System Architecture & Multi-Tenancy
3.   User Roles & Permissions Matrix
4.   Student Authentication & Security
5.   Grade Privacy Lock System
6.   Student Enrollment & Registration Flow
7.   ID Card Generation System (NFC)
8.   Landing Pages & Domain Architecture
9.   Mobile Strategy (PWA + Future App)
10.   Proprietor Dashboard & Ethics Module
11.   Core Feature Modules
12.   Liberia-Specific Considerations
13.   Technology Stack & Infrastructure
14.   Implementation Roadmap
15.   Appendix


---
## Page 3

SaaS School Management System for Liberia | v3.0 | Page 3
1. Liberian Education System Overview
The Liberian education system is governed by the Ministry of Education (MoE) and follows a structured
progression from early childhood to secondary education.
Level
Grades
Ages
Key Details
Early Childhood
Nursery / KG
Ages 3-5
Pre-primary foundation
Lower Primary
Grades 1-3
Ages 6-8
Basic literacy & numeracy
Upper Primary
Grades 4-6
Ages 9-11
WASSCE Prep begins
Junior High
Grades 7-9
Ages 12-14
WAEC BECE exam at Grade 9
Senior High
Grades 10-12
Ages 15-17
WASSCE exam at Grade 12
Grading System: Liberian schools use a letter-grade system (A = 90-100, B = 80-89, C =
70-79, D = 60-69, F = Below 60). The system will support both percentage and letter-grade
display with GPA calculation.
Academic Calendar: Typically runs from September to June, with three terms/semesters.
Schools may customize start dates.


---
## Page 4

SaaS School Management System for Liberia | v3.0 | Page 4
2. System Architecture & Multi-Tenancy
The platform is built as a single-codebase, multi-tenant SaaS system where every school operates
within an isolated data environment while sharing the same application infrastructure.
Multi-Tenancy Model
 Each school = one tenant with isolated database schema/rows
 Shared codebase, shared infrastructure, individual branding
 Tenant identified by subdomain or custom domain
 Data isolation enforced at database level (Row-Level Security)
Domain Architecture
Type
Example
Details
Default Subdomain
schoolname.eduliberia.com
Free, auto-provisioned at registration
Custom Domain
www.myschool.edu.lr
Premium tier, DNS CNAME setup
Platform Root
www.eduliberia.com
Main marketing site & school directory
Tenant Provisioning Flow
1. Proprietor/Admin registers school on the platform
2. System auto-generates subdomain (e.g., brighthorizon.eduliberia.com)
3. Landing page auto-created from school metadata (logo, colors, motto)
4. Database tenant initialized with default settings
5. Admin receives credentials to begin school configuration


---
## Page 5

SaaS School Management System for Liberia | v3.0 | Page 5
3. User Roles & Permissions Matrix
The system implements role-based access control (RBAC) with 12 distinct user roles, each with
carefully scoped permissions to ensure security and operational efficiency.
Super Admin
Platform Owner
Full platform control, tenant management, system config,
billing
Proprietor
School
Owner/Investor
Read-only financial oversight, audit logs, staff monitoring, all
reports
Principal
School Leader
Full school admin, staff management, academic oversight,
approvals
Vice Principal
Deputy Leader
Delegated principal duties, discipline, scheduling, staff
coordination
Dean of Students
Student Affairs
Student discipline, attendance oversight, student welfare,
conduct records
Admin Staff
School Secretary
Enrollment processing, fee collection, record keeping,
communications
IT Admin
Technical Staff
Password resets, system config, device management,
technical support
Teacher
Instructor
Grades entry, attendance, lesson plans, student
performance reports
Librarian
Library Manager
Book catalog, lending records, overdue tracking, library
reports
Guidance Counselor
Student Support
Student counseling records, behavioral notes, parent
meetings
Student
Learner
View grades (with Privacy Lock), timetable, assignments,
profile
Parent/Guardian
Family
View child's grades, attendance, fee status, communicate
with school


---
## Page 6

SaaS School Management System for Liberia | v3.0 | Page 6
Ethics Principle: The Proprietor role is intentionally read-only. Proprietors can monitor all
financial and operational data but cannot modify records, preventing conflicts of interest and
ensuring staff accountability through immutable audit trails.


---
## Page 7

SaaS School Management System for Liberia | v3.0 | Page 7
4. Student Authentication & Security
The system uses a low-barrier authentication model designed for Liberia's context where many
students may not have personal email addresses or consistent phone access.
Universal Default Password System
 Login Credentials: Registration Number + Password
 Default Password: One universal password set by the school (e.g., SchoolName@2025)
 Password Change: Optional — students may keep the default or set their own
 Ethical Design: Students are never forced to change; the choice respects their autonomy
Authentication Flow
Step 1
School admin registers student → System generates unique Registration Number
Step 2
Student receives Registration Number + default password (printed slip or SMS)
Step 3
Student visits school web portal and logs in with Reg Number + default password
Step 4
System prompts: 'Would you like to set a personal password?' (Skip option available)
Step 5
Student accesses dashboard — grades are protected by optional Grade Privacy Lock
Password Reset Protocol
 Self-Reset: Not available for students (prevents unauthorized access)
 IT Office Reset: Student visits IT office in person → identity verified → password reset to default
 Physical verification ensures no student can remotely hijack another's account
 IT Admin logs every reset with timestamp and verifier name for audit trail
Parent/Staff Authentication
 Parents receive account setup link via Email or SMS (school's choice)
 Staff accounts created by Admin with email-based password setup
 All non-student users can self-reset passwords via email/SMS OTP


---
## Page 8

SaaS School Management System for Liberia | v3.0 | Page 8
5. Grade Privacy Lock System
Inspired by banking app security, the Grade Privacy Lock is an optional secondary authentication layer
that protects a student's academic records from unauthorized viewing — even if someone else has access
to their logged-in session.
How It Works
Feature
Description
Activation
Optional — student chooses to enable/disable in settings
Lock Type
4-6 digit PIN set by the student (separate from login password)
Protected Content
Grade page, GPA, transcript, exam results, academic reports
Trigger
Any attempt to open the Grades section prompts PIN verification
Session Timeout
Grades re-lock after 5 minutes of inactivity or app switch
Visual Indicator
Lock icon on Grades tab; grades hidden until unlocked
Forgot PIN
Visit IT office for in-person PIN reset (same protocol as password)
Bank-App Analogy: Just like how banking apps let you hide your balance and require
fingerprint/PIN to reveal it, the Grade Privacy Lock lets students control who can see their
academic performance — even on a shared device.
UX Flow
1. Student taps Grades tab → Lock screen appears with PIN input
2. Student enters their 4-6 digit PIN
3. Grades revealed for the session (auto-locks after 5 min idle)
4. If PIN not set, grades show normally (opt-in system)


---
## Page 9

SaaS School Management System for Liberia | v3.0 | Page 9
6. Student Enrollment & Registration Flow
Enrollment is web-only, accessible from any device (phone or computer). The system is designed for
Liberia's mixed connectivity environment with offline-capable form saving.
Enrollment Process
1. Discovery: Parent/student finds school via platform directory or school's landing page
2. Application Form: Multi-step web form: personal info, guardian details, previous school,
documents upload (photo, birth certificate)
3. Form Submission: Application submitted with auto-save (survives connectivity drops).
Confirmation SMS/email sent.
4. Admin Review: School admin reviews application, verifies documents, approves/requests
corrections
5. Fee Payment: Acceptance letter sent with fee schedule. Payment via Mobile Money (MTN,
Orange) or bank transfer.
6. Registration Complete: System generates unique Registration Number. Student receives login
credentials (Reg # + default password).
7. Account Active: Student logs in, optionally sets personal password, optionally enables Grade
Privacy Lock.
Registration Number Format
Format: SCH-2025-0001
SCH = 3-letter school code | 2025 = enrollment year | 0001 = sequential number
Unique across the entire platform. Never reused. Serves as the student's permanent identifier.


---
## Page 10

SaaS School Management System for Liberia | v3.0 | Page 10
7. ID Card Generation System (NFC-Enabled)
The built-in ID card system allows schools to design, generate, and print physical NFC-enabled student
ID cards directly from the platform.
Card Features
Element
Source / Details
Student Photo
Uploaded during enrollment or updated via admin portal
School Name & Logo
Auto-populated from school registration data
Student Name
Full legal name from enrollment records
Registration Number
Unique ID + barcode/QR code
Grade/Class
Current academic level and section
Academic Year
Validity period for the card
NFC Chip Data
Encrypted student ID for attendance, library, gate access
Customizable Design
 Built-in drag-and-drop card designer with templates
 Schools choose layout, colors, background, and element positioning
 Preview before printing — PDF export for professional printing
 Bulk generation for entire classes or grade levels
NFC Use Cases
 Attendance: Tap card at classroom NFC reader for automatic check-in
 Library: Tap to check out/return books
 Gate Access: Entry/exit logging for security
 Cafeteria: Meal tracking and prepaid balance (future)


---
## Page 11

SaaS School Management System for Liberia | v3.0 | Page 11
8. Landing Pages & Domain Architecture
Every school on the platform gets an auto-generated, customizable landing page that serves as their
public-facing website.
Auto-Generated Landing Page
 Created instantly upon school registration
 Pre-populated with school name, logo, motto, contact info, and enrollment CTA
 Responsive design — works on phones, tablets, and desktops
 SEO-optimized with school metadata
Customization Options
Section
Customizable Elements
Branding
Logo, school colors (primary/secondary), motto, banner image
Content Sections
About Us, Programs, Admissions, Calendar, News/Events, Gallery
Contact
Address, phone, email, map embed, social media links
Enrollment CTA
'Apply Now' button linking directly to enrollment form
Theme
Choose from pre-built templates or customize colors/layout
Domain Tiers
Tier
Domain
Details
Free Tier
schoolname.eduliberia.com
Auto-provisioned, instant setup
Premium Tier
www.schoolname.edu.lr
Custom domain with SSL, DNS CNAME
required


---
## Page 12

SaaS School Management System for Liberia | v3.0 | Page 12
9. Mobile Strategy (PWA + Future App)
Phase 1: Progressive Web App (PWA) — Launch
The primary mobile experience is a Progressive Web App, ideal for Liberia's context:
 No app store download required — works directly in the browser
 'Add to Home Screen' creates an app-like icon on the student's phone
 Works offline for cached content (timetable, saved grades)
 Push notifications for announcements and grade updates
 Smaller data footprint than native apps
 Instant updates — no app store review delays
PHASE 2 — FUTURE UPDATE
Phase 2: Single Branded App — "EduLiberia" (Future Growth)
When the platform achieves significant adoption, a single branded mobile app will be published:
 One app: "EduLiberia" on Google Play Store and Apple App Store
 Users search for their school within the app after download
 Reduces confusion vs. one app per school
 Leverages existing SaaS multi-tenant architecture
 Push notifications, NFC card scanning, offline sync
Why PWA First? In Liberia, data costs are high and many users have limited storage on their
phones. A PWA delivers 90% of native app functionality with zero download friction. The Phase
2 native app is reserved for when the platform has enough users to justify App Store presence
and maintenance costs.


---
## Page 13

SaaS School Management System for Liberia | v3.0 | Page 13
10. Proprietor Dashboard & Ethics Module
The Proprietor role is designed around the principle of ethical oversight — providing complete visibility
without the ability to manipulate data.
Dashboard Features
Financial Overview: Real-time revenue, expenses, fee collection rates, outstanding balances,
payment trends
Staff Activity Monitor: Login times, actions performed, records modified (audit log viewer)
Enrollment Analytics: Student count by grade, new enrollments, withdrawals, retention rates
Academic Performance: School-wide grade averages, pass/fail rates, subject performance
Expense Tracking: All expenditures with receipt uploads, category breakdowns, anomaly alerts
Comparison Reports: Term-over-term and year-over-year comparisons for all metrics
Immutable Audit Trail
 Every action in the system is logged with timestamp, user, IP address, and action details
 Audit logs are append-only — no user (including Super Admin) can delete or modify them
 Proprietor has dedicated audit log viewer with search and filter
 Automatic anomaly alerts: unusual fee deletions, grade changes after deadlines, bulk record
modifications
Payment Reconciliation
 Side-by-side comparison of fees collected vs. fees expected
 Mobile Money transaction verification against system records
 Alert system for discrepancies exceeding configurable thresholds
 Monthly reconciliation reports auto-generated and sent to Proprietor


---
## Page 14

SaaS School Management System for Liberia | v3.0 | Page 14
11. Core Feature Modules
Academic Management
 Class scheduling and timetable generation
 Curriculum management aligned with Liberian MoE standards
 Exam creation, grading, and report card generation
 GPA calculation (4.0 scale) with letter grade mapping
 Transcript generation for WAEC/university applications
Attendance Management
 NFC card tap for automated attendance
 Manual attendance entry by teachers (fallback)
 Real-time attendance dashboard for admin and parents
 Automated SMS/notification to parents for absences
 Attendance reports by student, class, and school-wide
Financial Management
 Fee structure setup (tuition, registration, exam, activity fees)
 Mobile Money integration (MTN MoMo, Orange Money)
 Payment tracking with receipt generation
 Installment payment plans with automated reminders
 Financial reports: income, expenses, outstanding balances
Communication Hub
 In-app messaging (teacher-parent, admin-staff, announcements)
 SMS notifications for critical updates (absences, fees, grades)
 Notice board / news feed on school landing page
 Event calendar with RSVP functionality
 Emergency broadcast system
Library Management


---
## Page 15

SaaS School Management System for Liberia | v3.0 | Page 15
 Book catalog with search and categorization
 NFC-based book checkout/return
 Overdue tracking with automated notifications
 Reading history and recommendations
 Inventory management and procurement requests
Guidance & Counseling
 Confidential student counseling records
 Behavioral incident logging by Dean of Students
 Parent meeting scheduling and notes
 Academic intervention tracking
 Referral system between teachers and counselors


---
## Page 16

SaaS School Management System for Liberia | v3.0 | Page 16
12. Liberia-Specific Considerations
Connectivity & Infrastructure
 Offline-first design: forms auto-save locally, sync when connectivity returns
 Low-bandwidth optimization: compressed images, lazy loading, minimal data transfer
 SMS fallback for critical notifications when internet is unavailable
 PWA caching for offline access to timetables and cached grades
Payment Integration
 MTN Mobile Money and Orange Money as primary payment methods
 Bank transfer support for larger institutions
 Cash payment recording (manual entry by admin with receipt)
 All payments in Liberian Dollars (LRD) with USD display option
Regulatory Compliance
 Aligned with Ministry of Education reporting requirements
 Support for WAEC exam registration data export
 Student data privacy in compliance with applicable regulations
 Report card format following MoE standards
Language & Accessibility
 Primary language: English (official language of Liberia)
 Simple, clear UI language suitable for varying literacy levels
 Icon-heavy navigation for intuitive use
 High-contrast mode for outdoor/bright-light phone use


---
## Page 17

SaaS School Management System for Liberia | v3.0 | Page 17
13. Technology Stack & Infrastructure
Layer
Technology
Rationale
Frontend
React.js / Next.js with TypeScript
PWA-ready, component-based, responsive
Mobile
PWA (Phase 1) / React Native
(Phase 2)
Cross-platform, code reuse from web
Backend
Node.js with Express / NestJS
RESTful API + WebSocket for real-time
Database
PostgreSQL with Row-Level
Security
Multi-tenant isolation, ACID compliance
Authentication
JWT + Session management
Default password system + Grade Lock PIN
File Storage
Cloud Object Storage
(S3-compatible)
Student photos, documents, ID card assets
Payments
MTN MoMo API, Orange Money
API
Webhook-based payment confirmation
SMS Gateway
Twilio / Africa's Talking
Notifications, OTP, account setup links
Hosting
Cloud (AWS / DigitalOcean)
Auto-scaling, CDN for static assets
NFC
Web NFC API + Hardware readers
Card encoding, attendance, library


---
## Page 18

SaaS School Management System for Liberia | v3.0 | Page 18
14. Implementation Roadmap
Phase 1: Foundation (Months 1-3)
 Core authentication system (Universal Default Password + Registration Numbers)
 Multi-tenant architecture with subdomain provisioning
 Basic enrollment flow (web-only application form)
 User role setup (all 12 roles with RBAC)
 Landing page auto-generation engine
 PWA shell with offline caching
Phase 2: Academic Core (Months 4-6)
 Grade management with Grade Privacy Lock
 Attendance system (manual + NFC integration)
 Timetable and scheduling module
 Report card generation (MoE-aligned format)
 Parent portal with student linking
 SMS notification integration
Phase 3: Financial & Operations (Months 7-9)
 Fee management and Mobile Money payment integration
 Proprietor Dashboard with audit trail viewer
 Payment reconciliation and anomaly alerts
 ID card designer and NFC card generation
 Library management module
 Communication hub (messaging + announcements)
Phase 4: Advanced Features (Months 10-12)
 Guidance counseling module
 Advanced analytics and reporting
 Custom domain support (premium tier)
 WAEC exam data export
 Bulk operations (enrollment, grading, ID cards)
 API for third-party integrations


---
## Page 19

SaaS School Management System for Liberia | v3.0 | Page 19
Phase 5: Growth — FUTURE UPDATE
 Single branded mobile app: 'EduLiberia' (Google Play + App Store)
 Biometric attendance (fingerprint)
 AI-powered academic performance predictions
 Multi-school management for education groups
 Ministry of Education reporting dashboard
 Cafeteria and transport management modules


---
## Page 20

SaaS School Management System for Liberia | v3.0 | Page 20
15. Appendix
A. Registration Number Specification
Format: [SCHOOL_CODE]-[YEAR]-[SEQUENCE]
Example: BHA-2025-0042
Rules: School code = 3 uppercase letters (unique per school), Year =
4-digit enrollment year, Sequence = zero-padded 4-digit number,
auto-incremented per school per year. Never reused.
B. Grade Scale Reference
Grade
Percentage
GPA
Description
A
90 - 100
4.0
Excellent
B
80 - 89
3.0
Very Good
C
70 - 79
2.0
Good
D
60 - 69
1.0
Satisfactory
F
Below 60
0.0
Fail
C. Supported Payment Methods
Method
Priority
Integration
MTN Mobile Money
Primary
USSD + API integration
Orange Money
Primary
USSD + API integration
Bank Transfer
Secondary
Manual verification by admin
Cash
Fallback
Admin records with printed receipt


---
## Page 21

SaaS School Management System for Liberia | v3.0 | Page 21
 End of Document
 Version 3.0 — Final Design Document
 Prepared for SaaS-Based School Management System for Liberia
 