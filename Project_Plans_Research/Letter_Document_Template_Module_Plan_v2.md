# Letter_Document_Template_Module_Plan_v2.pdf


---
## Page 1

LETTER & DOCUMENT TEMPLATE
MANAGEMENT MODULE
Version 2.0 — Final Implementation-Ready Plan
SaaS High School Management System
Republic of Liberia
Companion Document to System Architecture v4
Prepared: April 8, 2026
Status: Final — Ready for Implementation

---
## Page 2

Table of Contents

---
## Page 3

1. Module Overview
The Letter & Document Template Management Module is a core component of the SaaS High 
School Management System designed specifically for Liberian secondary schools. It provides a 
centralized, role-controlled system for creating, approving, delivering, and tracking all official 
school correspondence.
1.1 Purpose
This module addresses the critical need for standardized, professional school communication in 
the Liberian educational context. It replaces ad-hoc, inconsistent letter generation with a 
structured system that ensures:
•Legal compliance through audit trails and tamper-proof records
•Professional branding with school-customized templates
•Role-based access control aligned with the 12 system roles
•Multi-channel delivery suited to Liberia’s connectivity challenges
•Offline-first operation consistent with the v4 system architecture
1.2 Scope
The module covers 23 letter types across 7 categories, supporting the full lifecycle from 
template creation to delivery confirmation and archival. It integrates with Admissions, Discipline, 
Finance, Attendance, and Communication modules.
1.3 Key Enhancements in v2
Version 2 incorporates 10 critical improvements over v1:
•Bulk operations for mass letter generation and batch printing
•Offline & sync support with IndexedDB draft creation
•Template versioning with rollback and change logs
•Letter recall & void system for error correction
•Enhanced SMS specifications with character limits and URL shortening
•Print queue management dashboard
•Parent acknowledgment and read receipts
•Digital signature verification for high-stakes notices
•Module integration triggers with configurable conditions
•Localization and language support for Liberian context

---
## Page 4

2. Letter Categories & Types
All 23 letter types are organized into 7 categories. Each letter type has defined severity levels, 
required approvals, and default delivery channels.
2.1 Complete Letter Type Matrix
CategoryLetter Type Severit
yApproval 
RequiredDelivery Channels
AdmissionsAcceptance Letter LowRegistrar PDF, Portal, Email
AdmissionsRejection Letter MediumPrincipal PDF, Portal
AdmissionsWaitlist Notification LowRegistrar PDF, Portal, SMS
AdmissionsTransfer Letter MediumPrincipal PDF
DisciplinaryWarning Letter MediumDean of Students PDF, Portal
DisciplinarySuspension Notice HighPrincipal PDF, Portal, SMS
DisciplinaryNTR (Never To Return) CriticalPrincipal + 
ProprietorPDF only
DisciplinaryExpulsion Notice CriticalPrincipal + 
ProprietorPDF only
AcademicReport Card Cover 
LetterLowAuto-generated PDF, Portal
AcademicPromotion Letter LowAuto-generated PDF, Portal
AcademicRetention Notice HighPrincipal PDF, Portal
AcademicHonor Roll Certificate LowAuto-generated PDF, Portal, Email
FinancialFee Reminder MediumBursar PDF, SMS, Portal
FinancialOutstanding Balance 
NoticeHighBursar + Principal PDF, SMS
FinancialPayment Receipt LowAuto-generated PDF, Portal, Email
AttendanceChronic Absenteeism 
NoticeHighDean + Principal PDF, SMS, Portal
AttendanceTruancy Notice CriticalPrincipal PDF, SMS
Communicati
onPTA Meeting Invitation LowAdmin Officer PDF, SMS, Portal, Email
Communicati
onGeneral Announcement LowAdmin Officer Portal, SMS, Email
Communicati
onEmergency Notice CriticalPrincipal SMS, Portal, Email
AdministrativeEnrollment Verification LowRegistrar PDF
AdministrativeRecommendation Letter LowTeacher/Principal PDF
AdministrativeWithdrawal 
ConfirmationMediumRegistrar + 
PrincipalPDF, Portal

---
## Page 5

2.2 Severity Levels Defined
LevelDescription Approval Chain Audit Requirements
LowRoutine communications Auto or single approver Standard logging
MediumNotifications with 
consequencesDepartment head Full audit trail
HighSignificant impact on student Principal required Full audit + 
acknowledgment
CriticalLegal implications Principal + Proprietor 
reviewFull audit + signatures + 
acknowledgment

---
## Page 6

3. Template Builder Design
The Template Builder provides school administrators with a visual, drag-and-drop interface for 
creating and customizing letter templates. Each school can maintain its own branded templates 
while adhering to system-enforced compliance requirements.
3.1 Template Components
•School Logo: Upload and position school logo (PNG/JPG, max 2MB, recommended 
300x300px)
•Header Block: School name, address, motto, contact information
•Letter Body: Rich text editor with placeholder insertion toolbar
•Signature Block: Signatory name, title, and signature image placement
•Footer: School registration number, accreditation info, confidentiality notice
•Watermark: Optional school seal or “OFFICIAL” watermark overlay
3.1.1 Digital Signature System
High-stakes letters (NTR, Expulsion, Suspension) require verified digital signatures:
•Each authorized signatory uploads a signature image (PNG with transparent 
background)
•Signature placement is defined per template with X/Y coordinates and size
•Signatory name and title auto-populate below the signature image
•Multi-signature support: NTR and Expulsion letters require both Principal and Proprietor 
signatures
•Signature audit trail: system logs which signature was applied, by whom, timestamp, and  
IP address
•Signature images are encrypted at rest and only rendered during PDF generation
3.2 Template Customization Options
ElementCustomizable Properties Constraints
LogoPosition, size, opacity Max 2MB, PNG/JPG only
HeaderFont, size, color, alignment School name required
Body TextFont family, size, line spacing Min 10pt, max 14pt
MarginsTop, bottom, left, right Min 0.5 inch all sides
SignaturePosition, size, name format Must match authorized signatory
FooterContent, font size Registration number required
WatermarkText or image, opacity Max 30% opacity

---
## Page 7

3.3 Bulk Operations
The system supports mass letter generation for entire grades, classes, or filtered student 
groups. This is essential for operations like sending fee reminders to all students with 
outstanding balances.
3.3.1 Batch Generation Workflow
•Admin selects a letter template and defines the recipient filter (grade, class, status, 
balance threshold, etc.)
•System displays a preview count: “200 students match this filter”
•Admin confirms generation; system queues all letters as a background job
•Progress bar shows real-time status: “142/200 generated”
•Failed generations are logged with error reasons (e.g., missing placeholder data)
•Completed batch produces a downloadable ZIP of all PDFs or routes to print queue
3.3.2 Batch Generation Limits
Parameter Limit Rationale
Max batch size 500 letters per job Server memory constraints
Concurrent jobs 2 per school Fair resource allocation
Retry attempts 3 per failed letter Network/data resilience
Job expiry 24 hours Auto-cleanup of stale jobs
3.3.3 CSV Export
Every bulk operation generates a CSV summary report containing:
•Student name, ID, grade, class
•Letter generation status (Success/Failed/Skipped)
•Delivery channel used
•Error details for failed generations
•Timestamp of generation
3.4 Template Versioning & Governance
Every modification to a letter template creates a new version, ensuring full traceability and the 
ability to roll back to any previous version.
3.4.1 Version Control Rules
•Each template edit creates an incremental version (v1, v2, v3...)
•Only one version can be “Active” at any time — this is the version used for letter 
generation
•Edits are saved as “Draft” versions until explicitly promoted to Active
•Rollback: any previous version can be promoted to Active with one click
•Version comparison: side-by-side diff view showing changes between any two versions

---
## Page 8

•Change log: every version records who edited, what changed, and when
3.4.2 Template Version Schema
Field Type Description
version_id UUID Unique version identifier
template_id UUID (FK) Parent template reference
version_number INTEGER Sequential version number
content_json JSONB Full template content snapshot
status ENUM draft | active | archived
created_by UUID (FK) User who created this version
created_at TIMESTAMP Version creation timestamp
change_summary TEXT Human-readable change description
3.5 Localization & Language Support
Templates support localization for the Liberian context:
•Primary Language: English (standard)
•Alternate Variant: Simple Liberian English for parent-facing documents
•Date Format: DD/MM/YYYY (Liberian standard), with {{date_formatted}} placeholder
•Currency: Dual display — USD and LRD with {{amount_usd}} and {{amount_lrd}} 
placeholders
•Exchange Rate: Configurable exchange rate placeholder {{exchange_rate}} updated by 
Bursar
•Template variants: each template can have multiple language versions
•Auto-selection: system selects variant based on parent’s preferred language setting

---
## Page 9

4. Dynamic Placeholders System
Placeholders are variables embedded in templates that auto-fill with real data during letter 
generation. The system validates that all required placeholders have data before generating a 
letter.
4.1 Complete Placeholder Reference
CategoryPlaceholder Description Used In
Student{{student_name}} Full name of the student All
Student{{student_id}} Unique student ID number All
Student{{student_grade}} Current grade level Academic, Attendance
Student{{student_class}} Class/section assignment Academic, Attendance
Student{{student_dob}} Date of birth (DD/MM/YYYY) Administrative
Student{{student_gender}} Gender (Male/Female) Administrative
Parent{{parent_name}} Parent/guardian full name All
Parent{{parent_phone}} Primary phone number Communication
Parent{{parent_email}} Email address (if available) Communication
Parent{{parent_address}} Mailing address All physical letters
School{{school_name}} Official school name All
School{{school_address}} School physical address All
School{{school_phone}} School contact number All
School{{school_motto}} School motto Headers
School{{school_reg_number}} MOE registration number Official letters
Date{{date}} Current date (DD/MM/YYYY) All
Date{{date_formatted}} Formatted date (e.g., 8 April 
2026)All
Date{{academic_year}} Current academic year Academic
Date{{semester}} Current semester/term Academic
Finance{{fee_amount}} Total fee amount due Financial
Finance{{amount_paid}} Amount already paid Financial
Finance{{outstanding_balance}} Remaining balance Financial
Finance{{payment_deadline}} Payment due date Financial
Finance{{amount_usd}} Amount in US Dollars Financial
Finance{{amount_lrd}} Amount in Liberian Dollars Financial
Finance{{exchange_rate}} Current USD/LRD exchange rate Financial
Discipline{{incident_date}} Date of incident Disciplinary
Discipline{{incident_description}} Description of the offense Disciplinary

---
## Page 10

Discipline{{disciplinary_action}} Action taken Disciplinary
Discipline{{suspension_start}} Suspension start date Disciplinary
Discipline{{suspension_end}} Suspension end date Disciplinary
Discipline{{return_conditions}} Conditions for return Disciplinary
Attendanc
e{{days_absent}} Total days absent Attendance
Attendanc
e{{absence_percentage}} Absence rate percentage Attendance
Attendanc
e{{last_attendance_date}
}Last date student attended Attendance
Signatory{{signatory_name}} Name of letter signer All
Signatory{{signatory_title}} Title of letter signer All
Signatory{{signatory_signature}} Digital signature image High/Critical
System{{letter_reference}} Unique letter reference number All
System{{letter_date}} Date letter was generated All
System{{verification_code}} QR/code for letter verification Critical
4.2 Placeholder Validation
Before generating any letter, the system performs validation:
•Required placeholders: the system checks that all placeholders in the template have 
corresponding data
•Missing data handling: if a required placeholder has no data, generation is blocked with 
an error message
•Optional placeholders: marked with {{?placeholder}} syntax; rendered as blank if no data
•Preview mode: admin can see a preview with sample data before sending
•Data type validation: dates must be valid dates, amounts must be numeric, etc.

---
## Page 11

5. Delivery Channels
The system provides four delivery channels designed for Liberia’s mixed-connectivity 
environment. Schools configure default channels per letter type, with manual override available.
5.1 Channel Overview
Channel Primary Use Connectivity 
RequiredCostReliability
PDF 
Download/PrintAll letter types Generation onlyPaper + inkHighest
In-App (Parent 
Portal)Non-critical 
notificationsInternet accessFreeMedium
SMS Link Urgent and financial 
noticesBasic cellularPer-message 
feeHigh
Email Where available Internet accessFreeLow (limited 
adoption)
5.2 PDF Download & Print
PDF is the primary delivery channel, reflecting Liberia’s reliance on physical document delivery.
•Generation: Server-side PDF rendering using Puppeteer or wkhtmltopdf
•Format: A4 size, portrait orientation, with school branding
•Storage: Generated PDFs stored in object storage with 7-year retention
•Download: Individual or bulk download (ZIP for batch operations)
5.2.1 Print Queue Management
The Print Queue Dashboard provides centralized management of all letters awaiting physical 
printing and distribution:
•Queue Status Board: Visual dashboard showing Pending, Printing, Printed, Distributed,  
Failed
•Batch Printing: Group letters by grade, class, or letter type for efficient printing
•Page Count Estimator: Shows total pages before printing to manage paper/ink 
resources
•Priority Queue: Critical-severity letters automatically promoted to top of queue
5.2.2 Physical Distribution Tracking
Status Description Set By
Queued Letter generated, awaiting print System (auto)
Printing Currently being printed Admin (manual)
Printed Printed, awaiting distribution Admin (manual)
Handed to Student Given directly to student Admin/Teacher

---
## Page 12

Mailed Sent via postal service Admin
Picked Up Parent collected from office Admin
Failed Print error occurred System (auto)
•Reprint: any letter can be reprinted with audit log entry recording reason
•Distribution report: summary of delivery methods used per batch
5.3 In-App Notification (Parent Portal)
•Letter appears in parent’s portal inbox with unread indicator
•Push notification triggered (if parent has mobile app installed)
•Full letter viewable in-app with option to download PDF
•Read receipt: system records when parent opens the letter
5.4 SMS Link
SMS delivery is critical for reaching parents without smartphones or internet access.
5.4.1 SMS Message Format
SMS messages must fit within 160 characters to avoid multi-part charges:
Letter Type SMS Template (max 160 chars) Character Count
Fee Reminder [SchoolName]: Fee reminder for [Student]. Balance: $
[amt]. View: [short_url]~85
Suspension [SchoolName]: [Student] suspended [start]-[end]. 
Details: [short_url]~75
Emergency [SchoolName] URGENT: [brief_msg]. Check portal or 
call [phone]~70
PTA Meeting [SchoolName]: PTA meeting [date] at [time]. Details: 
[short_url]~65
Attendance [SchoolName]: [Student] absent [X] days. Please 
contact school. [short_url]~80
5.4.2 URL Shortening
•System generates short URLs (e.g., sch.ly/abc123) linking to full letter in parent portal
•Short URLs are unique per letter instance and expire after 90 days
•Fallback: if URL shortener service is unavailable, send summary-only SMS without link
•Click tracking: system logs when a short URL is accessed
5.4.3 SMS Gateway Integration
•Primary gateway: configurable per school (e.g., Twilio, Africa’s Talking, local Liberian 
providers)
•Delivery status callbacks: Sent, Delivered, Failed, Undeliverable

---
## Page 13

•Retry logic: failed SMS retried up to 3 times at 15-minute intervals
•Cost tracking: per-school SMS usage dashboard with monthly spend
5.5 Email
•HTML-formatted email with letter content and PDF attachment
•Fallback plain-text version for older email clients
•Delivery tracking via read receipts and bounce handling
•Email is optional and supplementary given low email adoption in Liberia
5.6 Offline & Sync Support
Consistent with the v4 system’s offline-first architecture, the letter module supports full offline 
operation:
5.6.1 Offline Draft Creation
•Teachers and admins can draft letters while offline using IndexedDB storage
•Template data and placeholder values are cached locally during last sync
•Drafts are marked with “Offline Draft” status and timestamped
•Rich text editing available offline using cached template components
5.6.2 Sync Queue
•When connectivity returns, offline drafts enter a sync queue
•Sync order: oldest drafts first (FIFO)
•Conflict resolution: if the same letter was edited both offline and online, server version 
wins; offline version is preserved as “Draft Copy”
•Sync status indicators: Pending Sync, Syncing, Synced, Conflict
•Failed syncs retry automatically up to 5 times
5.6.3 Offline PDF Viewing
•Previously generated PDFs are cached in the browser for offline viewing
•Cache limit: 50 most recent PDFs per user
•Cache is refreshed on each successful sync

---
## Page 14

6. Approval Workflow
Letters follow role-based approval chains mapped to the 12 system roles. The approval 
requirements vary by letter severity.
6.1 Approval Chain by Severity
SeverityDraft By Approval Required Time LimitEscalation
LowAny authorized role None (auto-approved) N/AN/A
MediumTeacher, Admin 
OfficerDepartment Head 24 hoursAuto-approve after 
48h
HighDean, Department 
HeadPrincipal 12 hoursNotify Proprietor after  
24h
CriticalPrincipal Principal + Proprietor 
ReviewImmediateCannot bypass
6.2 Proprietor Review (Read-Only Ethics)
In alignment with the v4 system’s Proprietor role restrictions, the Proprietor has a special review  
workflow for critical letters:
•Proprietor receives a notification when a Critical letter is drafted
•Proprietor can VIEW the letter and its context but CANNOT edit content
•Proprietor can add a “Review Note” with comments or concerns
•Proprietor clicks “Acknowledge” to confirm they have reviewed the letter
•If Proprietor has concerns, they flag it and the letter returns to Principal for revision
•This preserves operational authority with the Principal while ensuring oversight
6.3 Approval Workflow States
State Description Actions Available
Draft Letter created, not submitted Edit, Delete, Submit for Approval
Pending Approval Submitted, awaiting approver Approve, Reject, Request Changes
Changes Requested Returned with feedback Edit and Resubmit
Approved Ready for delivery Send, Schedule, Add to Print Queue
Sent Delivered via selected channel(s) View, Reprint, Track Delivery
Recalled Withdrawn after sending View Recall Reason
Voided Marked as invalid View (with VOID watermark)
6.4 Letter Recall & Void
The system provides mechanisms to handle letters sent in error:

---
## Page 15

6.4.1 Recall System
•Time Window: Letters can be recalled within a configurable window (default: 2 hours 
after sending)
•Recall Actions: 
◦If delivered via portal: letter is removed from parent’s inbox with “Recalled” notice
◦If delivered via email: a follow-up “Retraction Notice” email is auto-sent
◦If delivered via SMS: a follow-up SMS is sent: “Please disregard previous 
message from [School]”
◦If printed/distributed: physical recall is logged manually by admin
•Recall Reason: Admin must provide a reason (Sent in Error, Wrong Recipient, Incorrect  
Information, Other)
6.4.2 Void System
•Purpose: For letters that cannot be recalled but need to be invalidated in the system
•Voided letters are NEVER deleted — they remain in the audit trail
•Voided letters display a “VOID” watermark if reprinted or viewed
•Void requires Principal-level authority
•Void reason and approver are permanently logged
6.4.3 Recall/Void Schema
Field Type Description
recall_id UUID Unique recall record identifier
letter_instance_id UUID (FK) Reference to the recalled letter
action_type ENUM recall | void
reason ENUM sent_in_error | wrong_recipient | incorrect_info | 
other
reason_detail TEXT Free-text explanation
initiated_by UUID (FK) User who initiated the action
approved_by UUID (FK) User who approved (for void)
created_at TIMESTAMP When the action was taken
channels_notified JSONB Which delivery channels were notified

---
## Page 16

7. Integration Points
The Letter Module integrates with all major system modules. Each integration includes 
configurable auto-triggers with conditions and suppression rules.
7.1 Module Integration Triggers
Source 
ModuleTrigger Event Letter Generated Condition Delay
AdmissionsApplication 
approvedAcceptance Letter Always Immediate
AdmissionsApplication rejected Rejection Letter Always Immediate
AdmissionsWaitlist placement Waitlist Notification Always Immediate
AdmissionsTransfer processed Transfer Letter Always Immediate
DisciplineWarning recorded Warning Letter Always 1 hour
DisciplineSuspension 
enteredSuspension Notice Always Immediate
DisciplineNTR decision NTR Notice Principal approved After Proprietor 
review
DisciplineExpulsion decision Expulsion Notice Principal approved After Proprietor 
review
FinanceBalance exceeds 
thresholdFee Reminder Balance > $50 
USD3 days after 
threshold
FinancePayment received Payment Receipt Always Immediate
Finance30 days overdue Outstanding 
BalanceBalance > $0 Immediate
Attendance10+ days absent Absenteeism 
NoticeConsecutive or 
cumulativeNext school day
AttendanceTruancy threshold Truancy Notice Per MOE 
guidelinesImmediate
Communicati
onPTA scheduled PTA Invitation Always 7 days before 
event
SystemReport cards 
generatedReport Card Cover End of term With report cards
AcademicPromotion decided Promotion Letter End of year With results
AcademicRetention decided Retention Notice End of year With results
7.2 Trigger Configuration
Administrators can configure trigger behavior per school:
•Enable/Disable: Any auto-trigger can be turned off; letters must then be created 
manually

---
## Page 17

•Delay Configuration: Adjustable delay between trigger event and letter generation (0 
mins to 30 days)
•Condition Thresholds: Numeric thresholds (e.g., fee balance, absent days) are 
configurable per school
•Suppression Rules: Prevent duplicate notifications:
◦Same letter type to same recipient within X days (configurable, default: 7 days)
◦Parent already contacted via phone/meeting this week
◦Student has pending unacknowledged letter of same type
•Manual Override: Admin can force-trigger or suppress any individual auto-trigger
7.3 Data Flow Diagram
Integration data flows through a centralized Event Bus:
•Source module emits an event (e.g., “suspension.created”)
•Event Bus checks trigger configuration for the school
•If trigger is active and conditions met, Letter Service is invoked
•Letter Service pulls template, fills placeholders from event data
•Approval workflow is initiated based on letter severity
•Upon approval, delivery is executed via configured channels

---
## Page 18

8. Audit Trail & Compliance
Every letter action is logged in an immutable audit trail for legal protection and regulatory 
compliance. This is especially critical for disciplinary letters that may face legal challenge.
8.1 Audit Log Fields
Field Type Description
audit_id UUID Unique audit entry identifier
letter_instance_id UUID (FK) Reference to the letter
action ENUM created | submitted | approved | rejected | sent | 
delivered | read | recalled | voided | reprinted | 
acknowledged
performed_by UUID (FK) User who performed the action
performed_at TIMESTAMP Exact timestamp of the action
ip_address VARCHAR IP address of the user
user_agent TEXT Browser/device information
metadata JSONB Additional context (delivery channel, error details,  
etc.)
checksum VARCHAR SHA-256 hash for tamper detection
8.2 Compliance Requirements
•Retention Period: All letter records and audit logs retained for minimum 7 years
•Tamper Protection: Audit entries are append-only; no update or delete operations 
permitted
•Checksum Verification: Each audit entry includes a SHA-256 hash of the previous 
entry, creating a chain
•Export: Full audit trail exportable as CSV or PDF for legal proceedings
•Access: Only Principal and Proprietor can view full audit trails; other roles see their own 
actions only
8.3 Parent Acknowledgment & Read Receipts
For High and Critical severity letters, the system tracks whether parents have received and 
acknowledged the communication:
8.3.1 Acknowledgment Methods
Method How It Works Applicable When
Digital (Portal) Parent clicks “I have read this letter” 
buttonParent has portal access
Digital (SMS) Parent replies “YES” to 
acknowledgment SMSSMS delivery channel used

---
## Page 19

Physical Sign-off Admin marks “Parent signed physical 
copy”Letter delivered by hand
Phone 
ConfirmationAdmin records “Confirmed via phone 
call on [date]”Follow-up call made
8.3.2 Escalation Rules
•Day 1: Letter sent via configured channels
•Day 3 (configurable): If no acknowledgment, auto-send follow-up via SMS
•Day 7 (configurable): If still no acknowledgment, notify Dean/Principal
•Day 14 (configurable): Final notice sent; case flagged for in-person follow-up
•All escalation steps are logged in the audit trail
8.3.3 Acknowledgment Dashboard
A dedicated dashboard shows acknowledgment rates:
•Acknowledgment rate by letter type (e.g., 85% of fee reminders acknowledged)
•Outstanding acknowledgments by grade/class
•Average time to acknowledgment
•Parents who have never acknowledged any letter (for follow-up)
8.3.4 Acknowledgment Schema
Field Type Description
acknowledgment_id UUID Unique identifier
letter_instance_id UUID (FK) Reference to the letter
acknowledged_by UUID (FK) Parent user ID
method ENUM digital_portal | digital_sms | physical_signoff | 
phone_confirmation
acknowledged_at TIMESTAMP When acknowledgment was recorded
recorded_by UUID (FK) Admin who recorded (for physical/phone)
notes TEXT Additional notes from admin
signature_data TEXT Base64 signature image (for physical)

---
## Page 20

9. Starter Templates
The system ships with pre-built starter templates for all 23 letter types. Schools can use these 
immediately or customize them with their own branding.
9.1 Starter Template List
CategoryTemplate Name Placeholders Used Default Channel
AdmissionsAcceptance Letter student_name, parent_name, 
grade, academic_year, datePDF + Portal
AdmissionsRejection Letter student_name, parent_name, date PDF
AdmissionsWaitlist Notification student_name, parent_name, date,  
waitlist_positionPDF + SMS
AdmissionsTransfer Letter student_name, parent_name, 
school_name, datePDF
DisciplinaryWarning Letter student_name, parent_name, 
incident_date, incident_descriptionPDF + Portal
DisciplinarySuspension Notice student_name, parent_name, 
suspension_start, suspension_end,  
incident_descriptionPDF + SMS
DisciplinaryNTR Notice student_name, parent_name, 
incident_description, 
signatory_name, signatory_titlePDF only
DisciplinaryExpulsion Notice student_name, parent_name, 
incident_description, 
disciplinary_actionPDF only
AcademicReport Card Cover student_name, grade, class, 
semester, academic_yearPDF
AcademicPromotion Letter student_name, parent_name, 
grade, academic_yearPDF + Portal
AcademicRetention Notice student_name, parent_name, 
grade, academic_yearPDF + Portal
AcademicHonor Roll Certificate student_name, grade, semester, 
academic_yearPDF + Portal
FinancialFee Reminder student_name, parent_name, 
fee_amount, outstanding_balance, 
payment_deadlinePDF + SMS
FinancialOutstanding Balance student_name, parent_name, 
outstanding_balance, amount_usd,  
amount_lrdPDF + SMS
FinancialPayment Receipt student_name, parent_name, 
amount_paid, date, 
letter_referencePDF + Portal
AttendanceAbsenteeism Notice student_name, parent_name, 
days_absent, absence_percentagePDF + SMS

---
## Page 21

AttendanceTruancy Notice student_name, parent_name, 
days_absent, last_attendance_datePDF + SMS
Communicati
onPTA Meeting 
Invitationparent_name, date, school_name SMS + Portal
Communicati
onGeneral 
Announcementschool_name, date Portal + SMS
Communicati
onEmergency Notice school_name, date SMS + Portal
AdministrativeEnrollment 
Verificationstudent_name, student_id, grade, 
academic_yearPDF
AdministrativeRecommendation 
Letterstudent_name, grade, 
signatory_name, signatory_titlePDF
AdministrativeWithdrawal 
Confirmationstudent_name, parent_name, date,  
gradePDF + Portal
9.2 Sample Template Structure
Each starter template follows this standard structure:
•[School Logo] — positioned top-left or top-center
•[School Name & Address Header] — full width, centered
•[Date & Reference Number] — right-aligned
•[Recipient Address Block] — parent name and address
•[Subject Line] — bold, underlined
•[Salutation] — “Dear {{parent_name}},”
•[Body Paragraphs] — template-specific content with placeholders
•[Action Required Block] — highlighted box for required parent actions (if any)
•[Signature Block] — signatory name, title, and signature image
•[Footer] — school registration, confidentiality notice

---
## Page 22

10. Role Permissions for Letters
Permissions are mapped across all 12 system roles. Each role has specific draft, approve, and 
send permissions.
10.1 Permission Matrix
RoleDraftApprove SendViewManag
e 
Templa
tes
Proprietor✘Review only 
(Critical)✘✔✔
Principal✔ (all levels)✔ ✔✔✔
Vice Principal✔ (up to High)✔ ✔✔✔
Dean of Students✔ (up to Medium)✔ ✔✔✘
Registrar✔✘  (Admissions)✔✔✘
Bursar✔✘  (Financial)✔✔✘
Department 
Head✔ (Low)✔  (Academic)✔✔✘
Teacher  (limited)✔✘ ✘  (own)✔✘
Admin Officer✔✘  ✔
(Communication)✔✘
IT Administrator✘✘ ✘✔✔
Counselor  (limited)✔✘ ✘  (own)✔✘
Parent✘✘ ✘  (received)✔✘
10.2 Special Permission Rules
•Proprietor: Cannot draft or send letters directly. Can only review Critical letters and view  
audit trails. This enforces the read-only ethics principle from v4.
•Teacher: Can draft recommendation letters and academic notices for their own students  
only. Cannot send without Department Head approval.
•Parent: Can only view letters addressed to them. Can acknowledge receipt but cannot 
draft, approve, or send.
•IT Administrator: Can manage templates and system configuration but cannot draft or 
send letters. Has full access to audit logs for system maintenance.

---
## Page 23

11. Technical Schema
Complete database schema for the Letter Module, including all v2 enhancements.
11.1 Core Tables
11.1.1 letter_templates
Column TypeConstraints Description
id UUIDPK, DEFAULT 
gen_random_uuid()Template unique ID
school_id UUIDFK → schools(id), NOT 
NULLOwning school
name VARCHAR(255)NOT NULL Template display name
category ENUMNOT NULL admissions | disciplinary | 
academic | financial | 
attendance | communication  
| administrative
letter_type VARCHAR(100)NOT NULL Specific letter type
severity ENUMNOT NULL low | medium | high | critical
content_json JSONBNOT NULL Template structure and 
content
placeholders JSONBNOT NULL Required and optional 
placeholders
default_channels JSONBNOT NULL Default delivery channels
approval_chain JSONBNOT NULL Required approval roles
active_version_id UUIDFK → 
letter_template_versions(id)Currently active version
is_starter BOOLEANDEFAULT false System-provided template
created_by UUIDFK → users(id) Creator
created_at TIMESTAMPDEFAULT NOW() Creation timestamp
updated_at TIMESTAMPDEFAULT NOW() Last update
11.1.2 letter_instances
Column TypeConstraints Description
id UUIDPK Letter instance unique ID
template_id UUIDFK → letter_templates(id) Source template
template_version_i
dUUIDFK → 
letter_template_versions(id)Template version used
school_id UUIDFK → schools(id) School
student_id UUIDFK → students(id) Target student

---
## Page 24

recipient_data JSONBNOT NULL Filled placeholder values
generated_pdf_url TEXT URL to generated PDF
status ENUMNOT NULL draft | pending_approval | 
changes_requested | 
approved | sent | recalled | 
voided
delivery_channels JSONB Channels used for delivery
delivery_status JSONB Per-channel delivery status
batch_id UUIDNULLABLE Batch reference for bulk ops
reference_number VARCHAR(50)UNIQUE Human-readable reference
created_by UUIDFK → users(id) Drafter
approved_by UUIDFK → users(id) Approver
sent_at TIMESTAMP When sent
created_at TIMESTAMPDEFAULT NOW() Creation timestamp
11.2 v2 Enhancement Tables
11.2.1 letter_template_versions
Column TypeConstraints Description
id UUIDPK Version unique ID
template_id UUIDFK → letter_templates(id), 
NOT NULLParent template
version_number INTEGERNOT NULL Sequential version (1, 2, 
3...)
content_json JSONBNOT NULL Full template content 
snapshot
status ENUMNOT NULL draft | active | archived
change_summary TEXT Description of changes
created_by UUIDFK → users(id) Version author
created_at TIMESTAMPDEFAULT NOW() Version timestamp
11.2.2 letter_recalls
Column TypeConstraints Description
id UUIDPK Recall record ID
letter_instance_id UUIDFK → letter_instances(id), 
NOT NULLRecalled letter
action_type ENUMNOT NULL recall | void

---
## Page 25

reason ENUMNOT NULL sent_in_error | 
wrong_recipient | 
incorrect_info | other
reason_detail TEXT Detailed explanation
initiated_by UUIDFK → users(id) Who initiated
approved_by UUIDFK → users(id) Who approved (for void)
channels_notified JSONB Channels that received 
retraction
created_at TIMESTAMPDEFAULT NOW() Action timestamp
11.2.3 letter_acknowledgments
Column TypeConstraints Description
id UUIDPK Acknowledgment ID
letter_instance_id UUIDFK → letter_instances(id), 
NOT NULLAcknowledged letter
acknowledged_by UUIDFK → users(id) Parent user
method ENUMNOT NULL digital_portal | digital_sms | 
physical_signoff | 
phone_confirmation
acknowledged_at TIMESTAMPDEFAULT NOW() When acknowledged
recorded_by UUIDFK → users(id) Admin (for physical)
notes TEXT Additional notes
signature_data TEXT Base64 signature image
11.2.4 print_queue
Column TypeConstraints Description
id UUIDPK Queue entry ID
letter_instance_id UUIDFK → letter_instances(id), 
NOT NULLLetter to print
school_id UUIDFK → schools(id) School
status ENUMNOT NULL queued | printing | printed | 
distributed | failed
priority INTEGERDEFAULT 0 Higher = more urgent
distribution_method ENUM handed_to_student | mailed 
| picked_up
distributed_at TIMESTAMP When physically distributed
distributed_by UUIDFK → users(id) Who distributed
page_count INTEGER Number of pages

---
## Page 26

reprint_count INTEGERDEFAULT 0 Times reprinted
created_at TIMESTAMPDEFAULT NOW() Queue entry timestamp
11.2.5 letter_audit_log
Column TypeConstraints Description
id UUIDPK Audit entry ID
letter_instance_id UUIDFK → letter_instances(id) Related letter
action ENUMNOT NULL created | submitted | 
approved | rejected | sent | 
delivered | read | recalled | 
voided | reprinted | 
acknowledged
performed_by UUIDFK → users(id) Actor
performed_at TIMESTAMPDEFAULT NOW() Timestamp
ip_address VARCHAR(45) IP address
user_agent TEXT Browser/device info
metadata JSONB Additional context
checksum VARCHAR(64) SHA-256 tamper-detection 
hash

---
## Page 27

12. API Endpoints
RESTful API endpoints for all Letter Module operations.
12.1 Template Management
Metho
dEndpoint Description Auth Required
GET/api/v1/templates List all templates for school Authenticated
GET/api/v1/templates/:id Get template details Authenticated
POST/api/v1/templates Create new template Admin+
PUT/api/v1/templates/:id Update template (creates new 
version)Admin+
GET/api/v1/templates/:id/versions List all versions Admin+
POST/api/v1/templates/:id/
versions/:vid/activateSet version as active Admin+
POST/api/v1/templates/:id/
versions/:vid/rollbackRollback to version Admin+
DELET
E/api/v1/templates/:id Soft-delete template IT Admin+
12.2 Letter Operations
Metho
dEndpoint Description Auth Required
POST/api/v1/letters Create/draft a letter Role-based
POST/api/v1/letters/bulk Bulk generate letters Admin+
GET/api/v1/letters/:id Get letter details Role-based
POST/api/v1/letters/:id/submit Submit for approval Drafter
POST/api/v1/letters/:id/approve Approve letter Approver role
POST/api/v1/letters/:id/reject Reject with feedback Approver role
POST/api/v1/letters/:id/send Send via channels Authorized sender
POST/api/v1/letters/:id/recall Recall letter Principal+
POST/api/v1/letters/:id/void Void letter Principal+
GET/api/v1/letters/:id/pdf Download generated PDF Authorized viewer
12.3 Acknowledgment & Tracking
Metho
dEndpoint Description Auth Required

---
## Page 28

POST/api/v1/letters/:id/acknowledge Parent acknowledges letter Parent
GET/api/v1/acknowledgments Get acknowledgment 
dashboard dataAdmin+
POST/api/v1/letters/:id/acknowledge/
physicalRecord physical sign-off Admin
GET/api/v1/letters/:id/delivery-status Get delivery status per channel Authorized viewer
12.4 Print Queue
Metho
dEndpoint Description Auth Required
GET/api/v1/print-queue List print queue items Admin+
POST/api/v1/print-queue/:id/status Update print status Admin
POST/api/v1/print-queue/:id/distribute Mark as distributed Admin/Teacher
POST/api/v1/print-queue/:id/reprint Reprint a letter Admin
GET/api/v1/print-queue/stats Queue statistics Admin+
12.5 Audit
Metho
dEndpoint Description Auth Required
GET/api/v1/audit/letters/:id Get audit trail for a letter Principal/Proprietor
GET/api/v1/audit/export Export audit logs (CSV/PDF) Principal/Proprietor
GET/api/v1/audit/search Search audit logs with filters Principal/Proprietor

---
## Page 29

13. Implementation Roadmap
Recommended phased implementation approach:
13.1 Phase 1: Foundation (Weeks 1–4)
•Database schema creation (all tables)
•Template CRUD operations
•Basic letter generation with placeholder filling
•PDF generation engine
•Starter templates loaded for all 23 types
13.2 Phase 2: Workflow & Delivery (Weeks 5–8)
•Approval workflow engine
•In-app notification delivery
•Email delivery with attachments
•SMS integration with gateway
•Print queue management
13.3 Phase 3: Advanced Features (Weeks 9–12)
•Bulk operations and batch generation
•Template versioning and rollback
•Parent acknowledgment system
•Digital signature integration
•Recall and void functionality
13.4 Phase 4: Integration & Polish (Weeks 13–16)
•Module integration triggers (auto-generation)
•Offline draft creation and sync
•Audit trail with checksum verification
•Localization (date format, dual currency)
•Acknowledgment dashboard and analytics
•Performance optimization and load testing

---
## Page 30

14. Summary
This document provides a complete, implementation-ready plan for the Letter & Document 
Template Management Module. It covers:
•23 letter types across 7 categories with defined severity levels
•Visual template builder with school branding and digital signatures
•40+ dynamic placeholders with validation rules
•4 delivery channels optimized for Liberia’s connectivity challenges
•Role-based approval workflows aligned with 12 system roles
•Bulk operations for mass letter generation and batch printing
•Offline-first operation with IndexedDB drafts and sync queues
•Template versioning with rollback capability
•Letter recall and void for error correction
•Parent acknowledgment tracking with escalation rules
•Immutable audit trail with SHA-256 tamper detection
•Complete database schema with 6 tables
•RESTful API with 25+ endpoints
•16-week phased implementation roadmap
— End of Document —