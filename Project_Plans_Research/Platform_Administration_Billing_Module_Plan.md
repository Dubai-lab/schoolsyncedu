# Platform_Administration_Billing_Module_Plan.pdf


---
## Page 1

Platform Administration & Billing Module Plan
Page 1Platform Administration &
Billing Module Plan
Companion Document to SaaS High School Management System v4
Version 1.0  |  April 2026
Super Admin Dashboard  •  Subscription Lifecycle  •  Payment Integration
Pricing Tiers  •  Currency & Conversion  •  Notification System

---
## Page 2

Platform Administration & Billing Module Plan
Page 2Table of Contents
1. Module Overview & Purpose
2. Super Admin Dashboard
3. Pricing Tiers & Plans
4. Payment Methods & Integration
5. Currency Management (USD/LRD)
6. Subscription Lifecycle
7. Notification & Alerting System
8. Discount & Promotion Management
9. School Onboarding Flow
10. Admin User Management (Future Scaling)
11. Database Schema
12. API Endpoints
13. Security & Compliance
14. Reporting & Analytics

---
## Page 3

Platform Administration & Billing Module Plan
Page 31. Module Overview & Purpose
This module is the central nervous system of the SaaS platform. It gives the platform owner (Super 
Admin) complete control over every school subscription, payment, pricing, promotion, and system-wide 
configuration from a single unified dashboard.
1.1 Core Objectives
•Single dashboard to manage ALL platform operations
•Full billing lifecycle: trial → active → suspended → archived
•Multiple payment methods: Visa card, MTN Mobile Money, Orange Money
•Dual currency support: USD and LRD with real-time conversion
•Automated notifications for subscription expiry and deactivation warnings
•Complete pricing control: create, edit, discount, and promote plans
•Scalable admin roles for future team growth
1.2 Design Philosophy
Start lean. One Super Admin (the platform owner) manages everything. As the platform grows, the same 
dashboard supports adding staff with role-based permissions. No separate tools needed — everything 
lives in one place.

---
## Page 4

Platform Administration & Billing Module Plan
Page 42. Super Admin Dashboard
The Super Admin Dashboard is the single control center for the entire SaaS platform. It provides a bird’s-
eye view of all operations with drill-down capability into any area.
2.1 Dashboard Overview Panel
Widget Description Data Source
Total Schools Count of all registered schools (active + 
inactive)schools table
Active Subscriptions Schools with current paid plans subscriptions table
Revenue This Month Total payments received (USD + LRD 
converted)payments table
Expiring Soon Schools whose subscription ends within 7 days subscriptions table
Overdue Payments Schools past due date with no payment invoices table
New Signups (30d) Schools registered in the last 30 days schools table
System Health Server uptime, storage usage, API response 
timesmonitoring
2.2 Dashboard Sections
School Management
•View all schools with status badges (Active, Trial, Suspended, Archived)
•Search/filter by name, location, plan, status
•Click any school to see full details: subscription, payments, users, usage
•Manually activate/deactivate any school
•Edit school profile, domain, branding settings
Billing & Payments
•View all invoices across all schools
•Payment history with method breakdown (Visa/MTN/Orange)
•Manual payment recording for bank transfers
•Refund processing
•Revenue reports by period, plan, payment method
Pricing & Plans
•Create/edit/delete pricing plans
•Set prices in USD (LRD auto-calculated)
•Manage discounts and promotional offers
•Set trial period duration
•Configure grace periods for late payments

---
## Page 5

Platform Administration & Billing Module Plan
Page 5Notifications Center
•View all sent notifications
•Configure notification templates and timing
•Manual broadcast to all schools or filtered groups
•Email delivery status tracking
System Settings
•Platform branding (logo, colors, name)
•Default currency and conversion rate source
•Email sender configuration
•Domain management
•Backup and maintenance controls
2.3 Super Admin Capabilities
The Super Admin has unrestricted access to every function:
Capability Description
Create/Edit/Delete Plans Full pricing control including custom plans for specific schools
Apply Discounts Percentage or fixed amount, time-limited or permanent
Override Subscriptions Manually extend, upgrade, downgrade any school
Process Payments Record manual payments, issue refunds
Deactivate Schools Instant suspension with data preservation
Edit All Content Modify any notification template, email, or system text
View All Data Access any school’s data for support purposes
Manage Domains Assign/change subdomains and custom domains
Export Reports Download CSV/PDF reports of any data
Create Admin Users Add staff accounts when ready to scale (future)

---
## Page 6

Platform Administration & Billing Module Plan
Page 63. Pricing Tiers & Plans
All prices are set in USD as the base currency. LRD equivalent is calculated automatically using real-time 
exchange rates. The Super Admin can edit all pricing at any time.
3.1 Plan Structure
PlanBillingPrice (USD) Student LimitFeatures
Basic MonthlyMonthly$25/mo Up to 200Core modules only
Basic YearlyYearly$250/yr (save 
17%)Up to 200Core modules only
Standard 
MonthlyMonthly$50/mo Up to 500Core + Reports + Letters
Standard 
YearlyYearly$500/yr (save 
17%)Up to 500Core + Reports + Letters
Premium 
MonthlyMonthly$100/mo Up to 1500All modules + Priority support
Premium 
YearlyYearly$1,000/yr (save 
17%)Up to 1500All modules + Priority support
Premier 
(Enterprise)CustomContact Us UnlimitedLifetime partnership + Dedicated  
support
3.2 Premier Partnership Plan
The Premier plan is for schools that want a lifetime partnership with the platform. This is not a self-service  
plan — schools contact the Super Admin directly to negotiate terms.
•Custom pricing based on school size and needs
•One-time setup fee + reduced ongoing rate, OR lump-sum lifetime fee
•Dedicated account manager (when team grows)
•Custom feature development priority
•White-label branding included
•SLA with guaranteed uptime
3.3 Editable Plan Properties
Every aspect of a plan can be edited by the Super Admin at any time:
Property Editable?Notes
Plan Name YesRename plans freely
Price (USD) YesChanges apply to new subscriptions only
Price (LRD) Auto-calculatedBased on current exchange rate
Student Limit YesCan increase/decrease per plan

---
## Page 7

Platform Administration & Billing Module Plan
Page 7Feature Set YesToggle modules on/off per plan
Trial Duration YesDefault 30 days, configurable 7–90 days
Grace Period YesDefault 7 days after expiry
Billing Cycle YesMonthly, Yearly, or Custom
Visibility YesShow/hide plans from public pricing page
Custom Plans YesCreate one-off plans for specific schools

---
## Page 8

Platform Administration & Billing Module Plan
Page 84. Payment Methods & Integration
The platform supports three payment methods to accommodate the Liberian market:
4.1 Visa/Mastercard (Stripe)
•Integration via Stripe payment gateway
•Supports Visa, Mastercard, and international cards
•Automatic recurring billing for monthly/yearly plans
•PCI-DSS compliant — card data never touches our servers
•Instant payment confirmation
•Automatic retry for failed payments (3 attempts over 7 days)
4.2 MTN Mobile Money
•Integration via MTN MoMo API (Liberia)
•School admin enters phone number, receives payment prompt on phone
•Payment confirmed via API callback
•Supports both USD and LRD wallets
•Manual reconciliation dashboard for failed callbacks
•Transaction reference stored for audit
4.3 Orange Money
•Integration via Orange Money API (Liberia)
•Same flow as MTN: enter number → approve on phone → confirmed
•Supports LRD primarily
•Webhook-based confirmation
•Fallback: manual payment recording by Super Admin
4.4 Payment Processing Flow
1. School selects plan and billing cycle
2. School chooses payment method (Visa / MTN / Orange)
3. Payment is processed through respective gateway
4. On success: invoice generated, subscription activated
5. On failure: school notified, retry scheduled (card) or manual retry (mobile money)
6. Super Admin can see all transactions in real-time
4.5 Manual Payment Recording
For bank transfers or cash payments, the Super Admin can manually record payments:
•Select school → Record Payment → Enter amount, method, reference
•System auto-generates invoice and activates/extends subscription

---
## Page 9

Platform Administration & Billing Module Plan
Page 9•Audit trail shows “Manually recorded by Super Admin”

---
## Page 10

Platform Administration & Billing Module Plan
Page 105. Currency Management (USD/LRD)
5.1 Dual Currency Display
All prices throughout the platform display in both USD and LRD:
•Base price always set in USD by Super Admin
•LRD equivalent calculated automatically using current exchange rate
•Example: $25 USD = L$4,875 LRD (at rate of 1 USD = 195 LRD)
5.2 Exchange Rate Management
Method Description Priority
Automatic API Fetch from exchangerate-api.com or similar every 6 
hoursPrimary
Manual Override Super Admin sets a fixed rate manually Override
Fallback Rate Last known rate used if API fails Fallback
5.3 Rate Configuration (Super Admin)
•View current rate with last update timestamp
•Toggle between automatic and manual rate
•Set rate update frequency (1hr, 6hr, 12hr, 24hr)
•Rate change history log
•Alert if rate changes more than 10% in 24 hours (unusual volatility)
5.4 Payment Currency Rules
•Visa/Mastercard: charged in USD
•MTN Mobile Money: charged in USD or LRD (based on wallet type)
•Orange Money: charged in LRD (converted from USD at current rate)
•All revenue reports can toggle between USD and LRD views

---
## Page 11

Platform Administration & Billing Module Plan
Page 116. Subscription Lifecycle
6.1 Lifecycle States
StateDescription School Access Duration
TrialFree trial period after signup Full access 30 days (configurable)
ActivePaid subscription current Full access Until billing period ends
Grace PeriodSubscription expired, payment 
pendingLimited access (read-
only)7 days (configurable)
SuspendedNo payment after grace period Login blocked, data 
safeUntil payment or 90 
days
ArchivedLong-term non-payment No access, data in cold 
storageRecoverable for a fee
CancelledSchool voluntarily cancelled Access until period 
endsUntil billing period ends
PremierLifetime partnership Full access forever Indefinite
6.2 Automatic State Transitions
The system automatically transitions schools between states:
Trial (30 days) → If payment: Active | If no payment: Grace Period (7 days) → If payment: Active | If no 
payment: Suspended → After 90 days: Archived
Every transition triggers a notification to the school and logs in the audit trail.
6.3 Super Admin Overrides
•Extend trial for any school (e.g., extra 15 days for a promising lead)
•Skip grace period and suspend immediately
•Reactivate suspended school instantly after payment
•Move school to Premier status
•Override any automatic transition

---
## Page 12

Platform Administration & Billing Module Plan
Page 127. Notification & Alerting System
Automated notifications keep schools informed about their subscription status and prevent unexpected 
deactivations.
7.1 Notification Schedule
TriggerWhen ChannelMessage Summary
Trial Ending7 days before trial 
expiresEmailYour free trial ends in 7 days. 
Subscribe to continue.
Trial Ending3 days before trial 
expiresEmail + SMS3 days left! Choose a plan now.
Trial ExpiredDay of expiry Email + SMSTrial ended. Subscribe or lose access 
in 7 days.
Payment Due7 days before billing 
dateEmailYour subscription renews on [date]. 
Ensure payment is ready.
Payment Due3 days before billing 
dateEmailPayment due in 3 days for [plan name].
Payment DueDay of billing Email + SMSPayment due today. Process now to 
avoid interruption.
Payment FailedImmediately Email + SMSPayment failed. Please update 
payment method.
Payment RetryDay 3 and Day 5 EmailWe’ll retry your payment. Update 
method if needed.
Grace Period 
StartDay after expiry Email + SMSYour subscription has expired. You 
have 7 days to pay.
Grace Period 
WarningDay 5 of grace Email + SMS2 days left! Your school site will be 
deactivated.
Suspension 
NoticeDay of suspension Email + SMSYour school site has been deactivated. 
Pay to reactivate.
Payment 
ReceivedImmediately EmailPayment confirmed! Your subscription 
is active until [date].
Plan UpgradeImmediately EmailYou’ve been upgraded to [plan]. New 
features unlocked!
Price Change30 days before 
effectiveEmailYour plan price will change on [date]. 
See details.
7.2 Notification Templates (Editable)
All notification content is editable by the Super Admin:
•Email subject line and body (rich text editor)
•SMS message (160 character limit)

---
## Page 13

Platform Administration & Billing Module Plan
Page 13•Dynamic variables: {{school_name}}, {{plan_name}}, {{expiry_date}}, {{amount_usd}}, 
{{amount_lrd}}, {{payment_link}}
•Preview before saving
•Test send to Super Admin email
7.3 Manual Notifications
•Broadcast to all schools (e.g., maintenance notice, new feature)
•Send to filtered group (e.g., all Basic plan schools)
•Individual school notification
•Notification delivery log with read receipts

---
## Page 14

Platform Administration & Billing Module Plan
Page 148. Discount & Promotion Management
The Super Admin has full control over discounts and promotional pricing:
8.1 Discount Types
Type Description Example
Percentage Discount Reduce price by X% 20% off first 3 months
Fixed Amount Reduce price by $X $10 off monthly plan
Coupon Code Redeemable code for discount Code: LAUNCH2026 for 15% off
School-Specific Custom price for one school Lincoln High gets $40/mo 
instead of $50
Bulk Discount Discount for multiple school signups Register 3+ schools, get 25% off  
each
Seasonal Promotion Time-limited campaign Back-to-school: 30% off yearly 
plans in August
Referral Discount Discount when school refers another Refer a school, both get $5 off 
next month
Loyalty Discount Automatic after X months After 12 months, get 10% off 
renewal
8.2 Promotion Configuration
Each promotion has these editable properties:
•Name and description
•Discount type and value
•Start date and end date
•Applicable plans (all or specific)
•Usage limit (total redemptions or per-school)
•Coupon code (auto-generated or custom)
•Stackable: can this combine with other discounts?
•Active/Inactive toggle
8.3 Promotion Dashboard
•List all promotions with status (Active, Scheduled, Expired)
•Usage stats: how many times redeemed, revenue impact
•Quick duplicate: copy an existing promotion and modify
•Promotion performance chart: signups attributed to each promo

---
## Page 15

Platform Administration & Billing Module Plan
Page 159. School Onboarding Flow
When a new school signs up, the system follows this automated flow:
9.1 Self-Service Signup
Step 1: School visits the platform website
Step 2: Fills registration form (school name, location, admin email, phone)
Step 3: Email verification sent
Step 4: School admin verifies email and sets password
Step 5: System auto-creates:
•School profile with unique school_id
•Subdomain: schoolname.yoursystem.com
•30-day free trial subscription
•Default letter templates (23 pre-loaded)
•Admin account for the school
Step 6: School admin logs in and starts configuring their school
Step 7: Super Admin receives notification of new signup
9.2 Domain Setup
•Every school gets: schoolname.yoursystem.com (automatic)
•Optional: school connects their own domain (e.g., www.lincolnhigh.edu.lr)
•Domain connection requires DNS CNAME record pointing to your platform
•SSL certificate auto-provisioned via Let’s Encrypt
•Super Admin can manage all domains from the dashboard
9.3 White-Label Branding
Each school’s site is white-labeled:
•School’s logo, colors, and name displayed
•No mention of the SaaS platform name visible to students/parents
•Custom login page with school branding
•Under the hood, it’s your system — just like Lovable apps

---
## Page 16

Platform Administration & Billing Module Plan
Page 1610. Admin User Management (Future Scaling)
Initially, one Super Admin (the platform owner) manages everything. As the platform grows, the 
dashboard supports adding team members:
10.1 Planned Admin Roles
Role Access Level When to Hire
Super Admin (You) Full unrestricted access to everything Day 1 — this is you
Billing Manager Payments, invoices, subscriptions, refunds 50+ schools
Support Agent View school data, respond to tickets, basic 
troubleshooting100+ schools
Technical Admin System health, backups, server management 200+ schools
Sales/Onboarding School registration, trial management, 
promotionsWhen actively marketing
10.2 Role-Based Access Control
When you add staff, each role has defined permissions:
•Billing Manager: cannot change system settings or delete schools
•Support Agent: read-only access to school data, can escalate issues
•Technical Admin: server access but no billing or school data editing
•All actions logged with user ID for accountability
•Super Admin can revoke any role instantly
10.3 For Now: Single Admin Dashboard
Until the platform grows, the Super Admin dashboard gives you everything in one place. No need to 
switch between tools. The role-based system is built in but dormant — flip it on when you’re ready to hire.

---
## Page 17

Platform Administration & Billing Module Plan
Page 1711. Database Schema
Core tables for the billing and administration module:
subscription_plans
Column Type / Constraint
id UUID, PK
name VARCHAR(100)
slug VARCHAR(50), unique
description TEXT
price_usd DECIMAL(10,2)
billing_cycle ENUM(monthly, yearly, custom, lifetime)
student_limit INTEGER
features JSONB
is_active BOOLEAN
is_visible BOOLEAN
trial_days INTEGER DEFAULT 30
grace_days INTEGER DEFAULT 7
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
subscriptions
Column Type / Constraint
id UUID, PK
school_id UUID FK → schools
plan_id UUID FK → subscription_plans
status ENUM(trial, active, grace, suspended, archived, cancelled, premier)
started_at TIMESTAMPTZ
expires_at TIMESTAMPTZ
cancelled_at TIMESTAMPTZ NULL
payment_method ENUM(visa, mtn, orange, bank, manual)
auto_renew BOOLEAN DEFAULT true
discount_id UUID FK → discounts NULL
created_at TIMESTAMPTZ

---
## Page 18

Platform Administration & Billing Module Plan
Page 18payments
Column Type / Constraint
id UUID, PK
school_id UUID FK → schools
subscription_id UUID FK → subscriptions
amount_usd DECIMAL(10,2)
amount_lrd DECIMAL(12,2)
exchange_rate DECIMAL(10,4)
currency_charged ENUM(USD, LRD)
payment_method ENUM(visa, mtn, orange, bank, manual)
gateway_ref VARCHAR(255)
status ENUM(success, failed, pending, refunded)
recorded_by UUID FK → admin_users NULL
created_at TIMESTAMPTZ
invoices
Column Type / Constraint
id UUID, PK
school_id UUID FK
subscription_id UUID FK
invoice_number VARCHAR(20) unique
amount_usd DECIMAL(10,2)
amount_lrd DECIMAL(12,2)
status ENUM(draft, sent, paid, overdue, void)
due_date DATE
paid_at TIMESTAMPTZ NULL
pdf_url TEXT NULL
created_at TIMESTAMPTZ
discounts
Column Type / Constraint
id UUID, PK
name VARCHAR(100)

---
## Page 19

Platform Administration & Billing Module Plan
Page 19type ENUM(percentage, fixed, coupon, school_specific, bulk, seasonal, 
referral, loyalty)
value DECIMAL(10,2)
coupon_code VARCHAR(50) NULL unique
start_date DATE
end_date DATE NULL
applicable_plans UUID[] NULL
max_uses INTEGER NULL
current_uses INTEGER DEFAULT 0
stackable BOOLEAN DEFAULT false
is_active BOOLEAN
created_at TIMESTAMPTZ
notifications_log
Column Type / Constraint
id UUID, PK
school_id UUID FK NULL
type ENUM(trial_warning, payment_due, payment_failed, ...)
channel ENUM(email, sms, both)
subject VARCHAR(255)
body TEXT
status ENUM(sent, delivered, failed, read)
sent_at TIMESTAMPTZ
exchange_rates
Column Type / Constraint
id UUID, PK
from_currency VARCHAR(3)
to_currency VARCHAR(3)
rate DECIMAL(10,4)
source ENUM(api, manual)
fetched_at TIMESTAMPTZ

---
## Page 20

Platform Administration & Billing Module Plan
Page 20admin_users
Column Type / Constraint
id UUID, PK
email VARCHAR(255)
name VARCHAR(100)
role ENUM(super_admin, billing, support, technical, sales)
is_active BOOLEAN
last_login TIMESTAMPTZ NULL
created_at TIMESTAMPTZ

---
## Page 21

Platform Administration & Billing Module Plan
Page 2112. API Endpoints
MethodEndpoint Description
GET/api/admin/dashboard Overview stats
GET/api/admin/schools List all schools with filters
GET/api/admin/schools/:id School detail with subscription
PATCH/api/admin/schools/:id/status Activate/suspend/archive school
GET/api/admin/plans List all plans
POST/api/admin/plans Create new plan
PUT/api/admin/plans/:id Update plan
DELET
E/api/admin/plans/:id Soft-delete plan
GET/api/admin/subscriptions List all subscriptions
POST/api/admin/subscriptions/:id/extend Extend subscription
POST/api/admin/subscriptions/:id/override Override status
GET/api/admin/payments List all payments
POST/api/admin/payments/record Record manual payment
POST/api/admin/payments/:id/refund Process refund
GET/api/admin/invoices List all invoices
GET/api/admin/discounts List all discounts
POST/api/admin/discounts Create discount/promo
PUT/api/admin/discounts/:id Update discount
GET/api/admin/exchange-rate Current rate
PUT/api/admin/exchange-rate Manual rate override
GET/api/admin/notifications Notification log
POST/api/admin/notifications/broadcast Send broadcast
PUT/api/admin/notifications/templates/:id Edit template
POST/api/payments/checkout School-facing: initiate payment
POST/api/payments/webhook/stripe Stripe webhook
POST/api/payments/webhook/mtn MTN callback
POST/api/payments/webhook/orange Orange callback

---
## Page 22

Platform Administration & Billing Module Plan
Page 2213. Security & Compliance
13.1 Payment Security
•PCI-DSS compliance via Stripe (card data never stored on our servers)
•Mobile Money tokens stored encrypted, never raw phone numbers in logs
•All payment APIs over HTTPS with TLS 1.3
•Webhook signature verification for all payment callbacks
13.2 Admin Security
•Super Admin login with email + password + 2FA (TOTP)
•Session timeout after 30 minutes of inactivity
•IP allowlisting option for admin dashboard
•All admin actions logged with timestamp, IP, and user ID
•Sensitive actions (delete, suspend) require confirmation
13.3 Data Protection
•Multi-tenant isolation: school_id enforced on every query via RLS
•Encrypted backups daily with 30-day retention
•GDPR-style data export: school can request all their data
•Data deletion: when school is archived beyond retention, data is permanently purged

---
## Page 23

Platform Administration & Billing Module Plan
Page 2314. Reporting & Analytics
The Super Admin dashboard includes comprehensive reporting:
14.1 Financial Reports
•Monthly Recurring Revenue (MRR) with trend chart
•Annual Recurring Revenue (ARR) projection
•Revenue breakdown by plan, payment method, currency
•Outstanding invoices aging report
•Refund and churn analysis
14.2 Subscription Reports
•Active subscriptions by plan type (pie chart)
•Trial conversion rate (what % of trials become paid)
•Churn rate (monthly cancellations / total subscribers)
•Subscription growth over time (line chart)
•Schools by status breakdown
14.3 Notification Reports
•Delivery success rates by channel (email vs SMS)
•Open/read rates for email notifications
•Notification-to-payment conversion (did the reminder work?)
14.4 Export Options
•CSV export for all report data
•PDF summary reports (branded with platform logo)
•Scheduled reports: auto-email weekly/monthly summary to Super Admin
•Date range filtering on all reports