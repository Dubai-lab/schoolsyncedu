import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { USER_ROLES } from '@/utils/constants';
import { ClipboardCheck, CreditCard } from 'lucide-react';
import ModePicker from './ModePicker';
import StaffLogin from './StaffLogin';

/**
 * Route tree for SchoolSync Attend.
 *
 * Like the student app, this never imports src/App.tsx, so the staff and admin
 * routes stay out of the bundle.
 *
 * The exam-clearance screens are the existing pages/kiosk ones, mounted at
 * their original /kiosk paths. KioskLogin navigates to '/kiosk/scanner'
 * internally, so matching the web paths means those two screens work here
 * with no changes at all — they were already built mobile-first and dark.
 */

const KioskLogin     = lazy(() => import('@/pages/kiosk/KioskLogin'));
const KioskScanner   = lazy(() => import('@/pages/kiosk/KioskScanner'));
const TeacherSession = lazy(() => import('./TeacherSession'));
const CardAssignment = lazy(() => import('./CardAssignment'));

const TEACHING_ROLES = [
  USER_ROLES.TEACHER,
  USER_ROLES.PRINCIPAL,
  USER_ROLES.VICE_PRINCIPAL,
] as const;

// Same roles the web card screens are gated to, plus leadership.
const CARD_ADMIN_ROLES = [
  USER_ROLES.IT_ADMIN,
  USER_ROLES.PRINCIPAL,
  USER_ROLES.VICE_PRINCIPAL,
] as const;

function ScreenFallback() {
  return (
    <div className="flex h-[100dvh] items-center justify-center bg-slate-900">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-emerald-400 border-t-transparent" />
    </div>
  );
}

export default function AttendApp() {
  return (
    <AuthProvider>
      <Suspense fallback={<ScreenFallback />}>
        <Routes>
          <Route path="/" element={<ModePicker />} />

          {/* Class attendance — authenticated as the teacher */}
          <Route
            path="/teacher/login"
            element={
              <StaffLogin
                title="Teacher sign in"
                subtitle="Use your SchoolSync staff account"
                icon={ClipboardCheck}
                allowedRoles={TEACHING_ROLES}
                redirectTo="/teacher/session"
                wrongRoleMessage="This account is not a teaching account. Class attendance is for teachers."
              />
            }
          />
          <Route path="/teacher/session" element={<TeacherSession />} />

          {/* Card assignment — IT admin pairs a printed card with its chip */}
          <Route
            path="/assign/login"
            element={
              <StaffLogin
                title="Admin sign in"
                subtitle="Assign printed cards to NFC chips"
                icon={CreditCard}
                allowedRoles={CARD_ADMIN_ROLES}
                redirectTo="/assign"
                wrongRoleMessage="Card assignment is limited to IT administrators and school leadership."
              />
            }
          />
          <Route path="/assign" element={<CardAssignment />} />

          {/* Exam clearance — school code + finance PIN, shared device.
              Paths match the web app so the existing screens are unmodified. */}
          <Route path="/kiosk" element={<KioskLogin />} />
          <Route path="/kiosk/scanner" element={<KioskScanner />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}
