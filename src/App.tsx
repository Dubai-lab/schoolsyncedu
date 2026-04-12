import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { RequireAuth } from '@/middleware/requireAuth';

// Layouts
import AuthLayout from '@/components/layout/AuthLayout';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PublicLayout from '@/components/layout/PublicLayout';

// Public pages
import LandingPage from '@/pages/public/LandingPage';
import PricingPage from '@/pages/public/PricingPage';
import RegisterSchool from '@/pages/public/RegisterSchool';
import SubscriptionPayment from '@/pages/public/SubscriptionPayment';

// Auth pages
import Login from '@/pages/auth/Login';
import ForgotPassword from '@/pages/auth/ForgotPassword';
import PasswordReset from '@/pages/auth/PasswordReset';
import AuthCallback from '@/pages/auth/AuthCallback';

// App pages
import Dashboard from '@/pages/dashboard/Dashboard';
import Analytics from '@/pages/dashboard/Analytics';
import NotFound from '@/pages/NotFound';
import Unauthorized from '@/pages/Unauthorized';

// Student pages
import StudentList from '@/pages/students/StudentList';
import StudentForm from '@/pages/students/StudentForm';
import StudentDetail from '@/pages/students/StudentDetail';
import StudentEnrollment from '@/pages/students/StudentEnrollment';
import StudentIDCards from '@/pages/students/StudentIDCards';

// Attendance pages
import AttendanceList from '@/pages/attendance/AttendanceList';
import AttendanceMarking from '@/pages/attendance/AttendanceMarking';
import AttendanceReports from '@/pages/attendance/AttendanceReports';

// Grade pages
import GradeList from '@/pages/grades/GradeList';
import GradeEntry from '@/pages/grades/GradeEntry';
import GradeApproval from '@/pages/grades/GradeApproval';
import ReportCards from '@/pages/grades/ReportCards';
import Transcript from '@/pages/grades/Transcript';

// Fee pages
import FeeList from '@/pages/fees/FeeList';
import FeePayment from '@/pages/fees/FeePayment';
import PaymentHistory from '@/pages/fees/PaymentHistory';
import FinancialReports from '@/pages/fees/PaymentReceipt';

// Letter pages
import LetterHistory from '@/pages/letters/LetterHistory';
import LetterTemplates from '@/pages/letters/LetterTemplates';
import LetterBuilder from '@/pages/letters/LetterBuilder';
import LetterApproval from '@/pages/letters/LetterApproval';
import PrintQueue from '@/pages/letters/PrintQueue';

// Library pages
import BookCatalog from '@/pages/library/BookCatalog';
import BookCheckout from '@/pages/library/BookCheckout';
import OverdueBooks from '@/pages/library/OverdueBooks';
import BookReports from '@/pages/library/BookReports';

// Communications pages
import AnnouncementList from '@/pages/communications/AnnouncementList';
import SendAnnouncement from '@/pages/communications/SendAnnouncement';
import MessageCenter from '@/pages/communications/MessageCenter';
import Notifications from '@/pages/communications/Notifications';

// Classes pages
import ClassList from '@/pages/classes/ClassList';
import ClassForm from '@/pages/classes/ClassForm';
import ClassTimetable from '@/pages/classes/ClassTimetable';
import SubjectList from '@/pages/classes/SubjectList';
import TermManagement from '@/pages/classes/TermManagement';

// Guidance pages
import CounselingRecords from '@/pages/guidance/CounselingRecords';
import StudentIncidents from '@/pages/guidance/StudentIncidents';
import ParentMeetings from '@/pages/guidance/ParentMeetings';

// ID Cards pages
import CardDesigner from '@/pages/idcards/CardDesigner';
import CardGenerator from '@/pages/idcards/CardGenerator';
import CardPrintQueue from '@/pages/idcards/CardPrintQueue';

// Staff pages
import StaffList from '@/pages/staff/StaffList';
import StaffForm from '@/pages/staff/StaffForm';
import StaffPermissions from '@/pages/staff/StaffPermissions';

// Reports pages
import ReportList from '@/pages/reports/ReportList';
import AcademicReportsPage from '@/pages/reports/AcademicReports';
import AttendanceReportsPage from '@/pages/reports/AttendanceReports';
import FinancialReportsPage from '@/pages/reports/FinancialReports';

// Settings pages
import SchoolSettings from '@/pages/settings/SchoolSettings';
import UserPreferences from '@/pages/settings/UserPreferences';
import SystemConfig from '@/pages/settings/SystemConfig';
import AuditLogs from '@/pages/settings/AuditLogs';

// Admin pages
import AdminDashboard from '@/pages/admin/AdminDashboard';
import SchoolManagement from '@/pages/admin/SchoolManagement';
import PricingPlans from '@/pages/admin/PricingPlans';
import BillingCenter from '@/pages/admin/BillingCenter';
import AdminDiscounts from '@/pages/admin/Discounts';
import SystemHealth from '@/pages/admin/SystemHealth';

// Timetable pages
import TimetableView from '@/pages/timetable/TimetableView';
import TimetableBuilder from '@/pages/timetable/TimetableBuilder';

// Proprietor pages
import ProprietorDashboard from '@/pages/proprietor/ProprietorDashboard';
import ITAdminSetup from '@/pages/proprietor/ITAdminSetup';
import OnboardingWizard from '@/pages/proprietor/OnboardingWizard';
import SubscriptionManagement from '@/pages/proprietor/SubscriptionManagement';
import FinancialOverview from '@/pages/proprietor/FinancialOverview';
import AuditTrailViewer from '@/pages/proprietor/AuditTrailViewer';
import SiteCustomizer from '@/pages/proprietor/SiteCustomizer';
import PaymentMethods from '@/pages/proprietor/PaymentMethods';

// WAEC pages
import WaecDashboard from '@/pages/waec/WaecDashboard';
import CandidateRegistration from '@/pages/waec/CandidateRegistration';
import CandidateList from '@/pages/waec/CandidateList';
import ExamResults from '@/pages/waec/ExamResults';

// IT Admin pages
import ITAdminDashboard from '@/pages/it-admin/ITAdminDashboard';
import UserManagement from '@/pages/it-admin/UserManagement';
import SiteManagement from '@/pages/it-admin/SiteManagement';
import SystemOverview from '@/pages/it-admin/SystemOverview';
import ITCardDesigner from '@/pages/it-admin/ITCardDesigner';
import ITCardGenerator from '@/pages/it-admin/ITCardGenerator';
import NfcAssignment from '@/pages/it-admin/NfcAssignment';
import StudentAccounts from '@/pages/it-admin/StudentAccounts';
import EmailSettings from '@/pages/it-admin/EmailSettings';
import FeeScheduleEditor from '@/pages/it-admin/FeeScheduleEditor';
import AuthPageDesigner from '@/pages/it-admin/AuthPageDesigner';

// School public site
import SchoolSite from '@/pages/public/SchoolSite';
import SchoolApplicationForm from '@/pages/public/SchoolApplicationForm';
import ApplicationStatus from '@/pages/public/ApplicationStatus';
import SchoolFees from '@/pages/public/SchoolFees';
import SchoolLogin from '@/pages/public/SchoolLogin';

// Fee receipt page
import ReceiptView from '@/pages/fees/ReceiptView';

// Registrar pages
import RegistrarDashboard from '@/pages/registrar/RegistrarDashboard';
import ApplicationReview from '@/pages/registrar/ApplicationReview';
import ApplicationDetail from '@/pages/registrar/ApplicationDetail';

// Bursar pages
import BursarDashboard from '@/pages/bursar/BursarDashboard';
import FeeStructures from '@/pages/bursar/FeeStructures';
import ApplicationFeePayments from '@/pages/bursar/ApplicationFeePayments';

// IT Admin school settings
import SchoolSettingsITAdmin from '@/pages/it-admin/SchoolSettings';

// Teacher portal pages
import TeacherDashboard from '@/pages/teacher/TeacherDashboard';
import TeacherClasses from '@/pages/teacher/TeacherClasses';
import TeacherSchedule from '@/pages/teacher/TeacherSchedule';
import TeacherAttendance from '@/pages/teacher/TeacherAttendance';
import NfcAttendance from '@/pages/teacher/NfcAttendance';
import TeacherGradeEntry from '@/pages/teacher/TeacherGradeEntry';

// Student portal pages
import StudentLogin from '@/pages/auth/StudentLogin';
import MyGrades from '@/pages/student/MyGrades';
import MyAttendance from '@/pages/student/MyAttendance';
import MyFees from '@/pages/student/MyFees';
import MyTimetable from '@/pages/student/MyTimetable';
import MyIDCard from '@/pages/student/MyIDCard';
import MyLibrary from '@/pages/student/MyLibrary';
import StudentProfile from '@/pages/student/StudentProfile';
import StudentDashboard from '@/pages/student/StudentDashboard';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public — Marketing pages */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/register" element={<RegisterSchool />} />
        </Route>

        {/* Payment page — standalone (no PublicLayout nav) */}
        <Route path="/payment" element={<SubscriptionPayment />} />

        {/* School public site — accessed via /school/:slug */}
        <Route path="/school/:slug" element={<SchoolSite />} />
        <Route path="/school/:slug/apply" element={<SchoolApplicationForm />} />
        <Route path="/school/:slug/status" element={<ApplicationStatus />} />
        <Route path="/school/:slug/fees" element={<SchoolFees />} />
        <Route path="/school/:slug/login" element={<SchoolLogin />} />

        {/* Auth callback — no layout, handles token exchange */}
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Public — Auth routes */}
        <Route element={<AuthLayout />}>
          <Route path="/auth/login" element={<Login />} />
          <Route path="/auth/signup" element={<Navigate to="/register" replace />} />
          <Route path="/auth/forgot-password" element={<ForgotPassword />} />
          <Route path="/auth/reset-password" element={<PasswordReset />} />
          <Route path="/auth/student-login" element={<StudentLogin />} />
        </Route>

        {/* Protected — App shell with Sidebar + Header */}
        <Route
          element={
            <RequireAuth>
              <DashboardLayout />
            </RequireAuth>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/analytics" element={<Analytics />} />

          {/* Students module */}
          <Route path="/students" element={<StudentList />} />
          <Route path="/students/new" element={<StudentForm />} />
          <Route path="/students/enrollment" element={<StudentEnrollment />} />
          <Route path="/students/idcards" element={<StudentIDCards />} />
          <Route path="/students/:id" element={<StudentDetail />} />
          <Route path="/students/:id/edit" element={<StudentForm />} />

          {/* Classes module */}
          <Route path="/classes" element={<ClassList />} />
          <Route path="/classes/new" element={<ClassForm />} />
          <Route path="/classes/:id/edit" element={<ClassForm />} />
          {/* Subjects */}
          <Route path="/subjects" element={<SubjectList />} />
          {/* Terms */}
          <Route path="/classes/terms" element={<TermManagement />} />
          <Route path="/classes/timetable" element={<ClassTimetable />} />
          {/* Timetable module */}
          <Route path="/timetable" element={<TimetableView />} />
          <Route path="/timetable/builder" element={<TimetableBuilder />} />
          {/* Grades module */}
          <Route path="/grades" element={<GradeList />} />
          <Route path="/grades/entry" element={<GradeEntry />} />
          <Route path="/grades/approval" element={<GradeApproval />} />
          <Route path="/grades/reports" element={<ReportCards />} />
          <Route path="/grades/transcript" element={<Transcript />} />
          {/* Attendance module */}
          <Route path="/attendance" element={<AttendanceList />} />
          <Route path="/attendance/mark" element={<AttendanceMarking />} />
          <Route path="/attendance/reports" element={<AttendanceReports />} />
          {/* Fees module */}
          <Route path="/fees" element={<FeeList />} />
          <Route path="/fees/payment" element={<FeePayment />} />
          <Route path="/fees/history" element={<PaymentHistory />} />
          <Route path="/fees/reports" element={<FinancialReports />} />
          <Route path="/fees/receipt/:id" element={<ReceiptView />} />
          {/* Letters module */}
          <Route path="/letters" element={<LetterHistory />} />
          <Route path="/letters/templates" element={<LetterTemplates />} />
          <Route path="/letters/create" element={<LetterBuilder />} />
          <Route path="/letters/approvals" element={<LetterApproval />} />
          <Route path="/letters/print-queue" element={<PrintQueue />} />
          {/* Communications module */}
          <Route path="/communications" element={<AnnouncementList />} />
          <Route path="/communications/announce" element={<SendAnnouncement />} />
          <Route path="/communications/messages" element={<MessageCenter />} />
          <Route path="/communications/notifications" element={<Notifications />} />
          {/* Library module */}
          <Route path="/library" element={<BookCatalog />} />
          <Route path="/library/checkout" element={<BookCheckout />} />
          <Route path="/library/overdue" element={<OverdueBooks />} />
          <Route path="/library/reports" element={<BookReports />} />
          {/* Guidance module */}
          <Route path="/guidance" element={<CounselingRecords />} />
          <Route path="/guidance/incidents" element={<StudentIncidents />} />
          <Route path="/guidance/meetings" element={<ParentMeetings />} />
          {/* ID Cards module */}
          <Route path="/idcards" element={<CardDesigner />} />
          <Route path="/idcards/generate" element={<CardGenerator />} />
          <Route path="/idcards/queue" element={<CardPrintQueue />} />
          {/* Staff module */}
          <Route path="/staff" element={<StaffList />} />
          <Route path="/staff/new" element={<StaffForm />} />
          <Route path="/staff/:id/edit" element={<StaffForm />} />
          <Route path="/staff/permissions" element={<StaffPermissions />} />
          {/* Reports module */}
          <Route path="/reports" element={<ReportList />} />
          <Route path="/reports/academic" element={<AcademicReportsPage />} />
          <Route path="/reports/attendance" element={<AttendanceReportsPage />} />
          <Route path="/reports/financial" element={<FinancialReportsPage />} />
          {/* Settings module */}
          <Route path="/settings" element={<SchoolSettings />} />
          <Route path="/settings/preferences" element={<UserPreferences />} />
          <Route path="/settings/system" element={<SystemConfig />} />
          <Route path="/settings/audit" element={<AuditLogs />} />
          {/* Proprietor module */}
          <Route path="/proprietor" element={<ProprietorDashboard />} />
          <Route path="/proprietor/setup" element={<OnboardingWizard />} />
          <Route path="/proprietor/it-admin" element={<ITAdminSetup />} />
          <Route path="/proprietor/subscription" element={<SubscriptionManagement />} />
          <Route path="/proprietor/financial" element={<FinancialOverview />} />
          <Route path="/proprietor/audit" element={<AuditTrailViewer />} />
          <Route path="/proprietor/site" element={<SiteCustomizer />} />
          <Route path="/proprietor/fees" element={<FeeScheduleEditor />} />
          <Route path="/proprietor/login-page" element={<AuthPageDesigner />} />
          <Route path="/proprietor/payment-methods" element={<PaymentMethods />} />
          {/* IT Admin module */}
          <Route path="/it-admin" element={<ITAdminDashboard />} />
          <Route path="/it-admin/users" element={<UserManagement />} />
          <Route path="/it-admin/users/new" element={<UserManagement />} />
          <Route path="/it-admin/site" element={<SiteManagement />} />
          <Route path="/it-admin/fees" element={<FeeScheduleEditor />} />
          <Route path="/it-admin/login-page" element={<AuthPageDesigner />} />
          <Route path="/it-admin/system" element={<SystemOverview />} />
          <Route path="/it-admin/settings" element={<SchoolSettingsITAdmin />} />
          <Route path="/it-admin/cards" element={<ITCardDesigner />} />
          <Route path="/it-admin/cards/generate" element={<ITCardGenerator />} />
          <Route path="/it-admin/cards/nfc" element={<NfcAssignment />} />
          <Route path="/it-admin/students" element={<StudentAccounts />} />
          <Route path="/it-admin/email" element={<EmailSettings />} />
          {/* Registrar module */}
          <Route path="/registrar" element={<RegistrarDashboard />} />
          <Route path="/registrar/applications" element={<ApplicationReview />} />
          <Route path="/registrar/applications/:id" element={<ApplicationDetail />} />
          {/* Bursar / Finance module */}
          <Route path="/bursar" element={<BursarDashboard />} />
          <Route path="/bursar/fee-structures" element={<FeeStructures />} />
          <Route path="/bursar/application-fees" element={<ApplicationFeePayments />} />
          {/* Admin module */}
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/schools" element={<SchoolManagement />} />
          <Route path="/admin/pricing" element={<PricingPlans />} />
          <Route path="/admin/billing" element={<BillingCenter />} />
          <Route path="/admin/discounts" element={<AdminDiscounts />} />
          <Route path="/admin/health" element={<SystemHealth />} />
          {/* WAEC module */}
          <Route path="/waec" element={<WaecDashboard />} />
          <Route path="/waec/register" element={<CandidateRegistration />} />
          <Route path="/waec/candidates" element={<CandidateList />} />
          <Route path="/waec/results" element={<ExamResults />} />

          {/* Teacher portal */}
          <Route path="/teacher" element={<TeacherDashboard />} />
          <Route path="/teacher/classes" element={<TeacherClasses />} />
          <Route path="/teacher/schedule" element={<TeacherSchedule />} />
          <Route path="/teacher/attendance" element={<TeacherAttendance />} />
          <Route path="/teacher/nfc-attendance" element={<NfcAttendance />} />
          <Route path="/teacher/grades" element={<TeacherGradeEntry />} />

          {/* Student portal */}
          <Route path="/student/dashboard" element={<StudentDashboard />} />
          <Route path="/student" element={<Navigate to="/student/dashboard" replace />} />
          <Route path="/student/grades" element={<MyGrades />} />
          <Route path="/student/attendance" element={<MyAttendance />} />
          <Route path="/student/fees" element={<MyFees />} />
          <Route path="/student/timetable" element={<MyTimetable />} />
          <Route path="/student/id-card" element={<MyIDCard />} />
          <Route path="/student/library" element={<MyLibrary />} />
          <Route path="/student/profile" element={<StudentProfile />} />
        </Route>

        {/* Error pages */}
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}
