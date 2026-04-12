schoolsync/
├── src/
│   ├── api/                          ← ADD: API service layer
│   │   ├── client.ts                 (Supabase client config)
│   │   ├── auth.ts                   (Auth API calls)
│   │   ├── students.ts               (Student CRUD)
│   │   ├── attendance.ts             (Attendance API)
│   │   ├── fees.ts                   (Financial API)
│   │   ├── grades.ts                 (Academic API)
│   │   ├── letters.ts                (Letter template API)
│   │   ├── users.ts                  (User management API)
│   │   └── reports.ts                (Reports API)
│   │
│   ├── assets/
│   │   ├── icons/                    ← ADD: Icons folder
│   │   ├── images/                   ← ADD: Images folder
│   │   └── logos/                    ← ADD: Logo folder
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── DashboardLayout.tsx   ← ADD if missing
│   │   │   └── AuthLayout.tsx        ← ADD if missing
│   │   ├── shared/
│   │   │   ├── Modal.tsx
│   │   │   ├── LoadingSpinner.tsx    ← ADD
│   │   │   ├── ErrorBoundary.tsx     ← ADD
│   │   │   ├── Toast.tsx             ← ADD
│   │   │   ├── Breadcrumb.tsx        ← ADD
│   │   │   └── Skeleton.tsx          ← ADD
│   │   └── ui/                       (Shadcn or your UI library)
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── Select.tsx
│   │       ├── Card.tsx
│   │       ├── Table.tsx
│   │       ├── Badge.tsx
│   │       ├── Dialog.tsx
│   │       ├── Tabs.tsx
│   │       └── Pagination.tsx        ← ADD if using tables
│   │
│   ├── context/                      ← ADD FILL: State management
│   │   ├── AuthContext.tsx           (User auth state)
│   │   ├── SchoolContext.tsx         (Current school context)
│   │   ├── ThemeContext.tsx          (Dark/light theme)
│   │   └── NotificationContext.tsx   (Toast/notifications)
│   │
│   ├── hooks/                        ← ADD FILL: Custom hooks
│   │   ├── useAuth.ts                (Auth hook)
│   │   ├── useSchool.ts              (School data hook)
│   │   ├── useFetch.ts               (Generic fetch hook)
│   │   ├── useLocalStorage.ts        (Local storage hook)
│   │   ├── useNotification.ts        (Toast notifications)
│   │   ├── useForm.ts                (Common form patterns)
│   │   ├── usePagination.ts          (Table pagination)
│   │   └── useDebounce.ts            (Debounce hook)
│   │
│   ├── lib/
│   │   ├── supabase.ts               (Already exists)
│   │   ├── axios.ts                  ← ADD: Axios instance
│   │   └── queryClient.ts            ← ADD: React Query config
│   │
│   ├── middleware/                   ← ADD: New folder
│   │   ├── requireAuth.ts            (Auth guard)
│   │   ├── requireRole.ts            (Role-based guard)
│   │   └── errorHandler.ts           (Error middleware)
│   │
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── Login.tsx
│   │   │   ├── Signup.tsx
│   │   │   ├── ForgotPassword.tsx    ← ADD if missing
│   │   │   └── PasswordReset.tsx     ← ADD if missing
│   │   ├── dashboard/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Analytics.tsx         ← ADD
│   │   │   └── Reports.tsx           ← ADD
│   │   ├── students/
│   │   │   ├── StudentList.tsx
│   │   │   ├── StudentDetail.tsx     ← ADD if missing
│   │   │   ├── StudentForm.tsx       ← ADD if missing
│   │   │   ├── StudentEnrollment.tsx ← ADD
│   │   │   └── StudentIDCards.tsx    ← ADD (for card generation)
│   │   ├── attendance/
│   │   │   ├── AttendanceList.tsx
│   │   │   ├── AttendanceMarking.tsx ← ADD
│   │   │   └── AttendanceReports.tsx ← ADD
│   │   ├── grades/
│   │   │   ├── GradeList.tsx
│   │   │   ├── GradeEntry.tsx        ← ADD
│   │   │   ├── Transcript.tsx        ← ADD
│   │   │   └── ReportCards.tsx       ← ADD
│   │   ├── fees/
│   │   │   ├── FeeList.tsx
│   │   │   ├── FeePayment.tsx        ← ADD
│   │   │   ├── PaymentReceipt.tsx    ← ADD
│   │   │   └── PaymentHistory.tsx    ← ADD
│   │   ├── letters/                  ← ADD ENTIRE FOLDER
│   │   │   ├── LetterTemplates.tsx
│   │   │   ├── LetterBuilder.tsx
│   │   │   ├── LetterApproval.tsx
│   │   │   ├── LetterHistory.tsx
│   │   │   └── PrintQueue.tsx
│   │   ├── communications/           ← ADD ENTIRE FOLDER
│   │   │   ├── AnnouncementList.tsx
│   │   │   ├── SendAnnouncement.tsx
│   │   │   ├── MessageCenter.tsx
│   │   │   └── Notifications.tsx
│   │   ├── library/                  ← ADD ENTIRE FOLDER
│   │   │   ├── BookCatalog.tsx
│   │   │   ├── BookCheckout.tsx
│   │   │   ├── OverdueBooks.tsx
│   │   │   └── BookReports.tsx
│   │   ├── guidance/                 ← ADD ENTIRE FOLDER
│   │   │   ├── CounselingRecords.tsx
│   │   │   ├── StudentIncidents.tsx
│   │   │   └── ParentMeetings.tsx
│   │   ├── staff/
│   │   │   ├── StaffList.tsx
│   │   │   ├── StaffForm.tsx         ← ADD if missing
│   │   │   └── StaffPermissions.tsx  ← ADD
│   │   ├── classes/
│   │   │   ├── ClassList.tsx
│   │   │   ├── ClassForm.tsx         ← ADD if missing
│   │   │   └── ClassTimetable.tsx    ← ADD
│   │   ├── reports/
│   │   │   ├── ReportList.tsx
│   │   │   ├── AcademicReports.tsx   ← ADD
│   │   │   ├── FinancialReports.tsx  ← ADD
│   │   │   └── AttendanceReports.tsx ← Already there
│   │   ├── settings/
│   │   │   ├── SchoolSettings.tsx
│   │   │   ├── UserPreferences.tsx   ← ADD
│   │   │   ├── RolePermissions.tsx   ← ADD
│   │   │   ├── AuditLogs.tsx         ← ADD
│   │   │   └── SystemConfig.tsx      ← ADD
│   │   ├── idcards/
│   │   │   ├── CardDesigner.tsx
│   │   │   ├── CardGenerator.tsx     ← ADD
│   │   │   └── CardPrintQueue.tsx    ← ADD
│   │   ├── admin/                    ← ADD ENTIRE FOLDER (Super Admin)
│   │   │   ├── AdminDashboard.tsx
│   │   │   ├── PricingPlans.tsx
│   │   │   ├── SchoolManagement.tsx
│   │   │   ├── BillingCenter.tsx
│   │   │   ├── Discounts.tsx
│   │   │   └── SystemHealth.tsx
│   │   ├── NotFound.tsx              ← ADD (404 page)
│   │   └── Unauthorized.tsx          ← ADD (403 page)
│   │
│   ├── services/                     ← FILL: Business logic layer
│   │   ├── authService.ts            (Auth logic)
│   │   ├── studentService.ts         (Student business logic)
│   │   ├── attendanceService.ts      (Attendance calculations)
│   │   ├── gradeService.ts           (GPA, grade calculations)
│   │   ├── feeService.ts             (Fee calculations)
│   │   ├── letterService.ts          (Letter generation)
│   │   ├── paymentService.ts         (Payment processing)
│   │   ├── reportService.ts          (Report generation)
│   │   └── notificationService.ts    (Email/SMS sending)
│   │
│   ├── store/                        ← ADD: State management
│   │   ├── auth.store.ts             (Zustand or Redux)
│   │   ├── school.store.ts
│   │   └── ui.store.ts
│   │
│   ├── types/                        ← FILL: TypeScript types
│   │   ├── index.ts
│   │   ├── auth.types.ts            (Auth-related types)
│   │   ├── student.types.ts         (Student models)
│   │   ├── attendance.types.ts      (Attendance models)
│   │   ├── grade.types.ts           (Grade/Academic models)
│   │   ├── fee.types.ts             (Financial models)
│   │   ├── letter.types.ts          (Letter models)
│   │   ├── user.types.ts            (User roles/permissions)
│   │   ├── report.types.ts          (Report models)
│   │   ├── api.types.ts             (API response types)
│   │   └── common.types.ts          (Shared types)
│   │
│   ├── utils/                        ← FILL: Utilities
│   │   ├── constants.ts              (Constants, enums)
│   │   ├── helpers.ts                (Common helper functions)
│   │   ├── validation.ts             (Zod schemas)
│   │   ├── formatters.ts             (Date, currency formatters)
│   │   ├── errors.ts                 (Custom error classes)
│   │   ├── logger.ts                 (Logging utility)
│   │   ├── storage.ts                (Local storage helpers)
│   │   ├── api.ts                    (API helper functions)
│   │   └── regex.ts                  (Regex patterns)
│   │
│   ├── App.tsx
│   ├── App.css
│   ├── index.css
│   └── main.tsx
│
├── public/                           ← Update with assets
│   ├── favicon.ico
│   ├── logo.png
│   └── logo-white.png
│
├── tests/                            ← ADD: Testing
│   ├── setup.ts
│   ├── __mocks__/
│   ├── utils/
│   └── pages/
│       ├── auth.test.tsx
│       └── dashboard.test.tsx
│
├── .env                              ← FILL: Environment vars
├── .env.example                      ← ADD: Template
├── .env.local                        ← ADD: Local override
├── vite.config.ts                    ← Update with aliases
├── tsconfig.json                     ← Update with path aliases
├── vitest.config.ts                  ← ADD: Test config
├── jest.config.js                    ← ADD if using Jest
├── .prettierrc                        ← ADD: Code formatter
├── README.md
└── package.json

Note: I added this 3 files after the structure was created

src/api/nfc.ts
src/types/nfc.types.ts
src/services/nfcService.ts
