import { Suspense } from 'react';
import { lazyWithReload } from '@/utils/lazyWithReload';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import RequireStudent from './RequireStudent';
import TabShell from './TabShell';
import BiometricGate from './BiometricGate';
import LoginScreen from './LoginScreen';
import MobileSplash from '../MobileSplash';
import { GraduationCap } from 'lucide-react';

/**
 * Route tree for the SchoolSync student app.
 *
 * This file is the reason the mobile bundle is small: it never imports
 * src/App.tsx, so none of the ~120 staff and admin routes are reachable from
 * this entry and Rollup drops them entirely.
 *
 * Screens are lazy so first paint ships login only. MyFees especially — it
 * pulls Stripe, Flutterwave and the mobile-money forms, which no student
 * needs until they actually open the fees screen.
 *
 * LoginScreen is eager on purpose: it is the first thing an unauthenticated
 * user sees, and a spinner before the login form is a poor cold start.
 */

const Dashboard      = lazyWithReload(() => import('@/pages/student/StudentDashboard'));
const MyGrades       = lazyWithReload(() => import('@/pages/student/MyGrades'));
const MyAttendance   = lazyWithReload(() => import('@/pages/student/MyAttendance'));
const MyFees         = lazyWithReload(() => import('@/pages/student/MyFees'));
const MyTimetable    = lazyWithReload(() => import('@/pages/student/MyTimetable'));
const MyLibrary      = lazyWithReload(() => import('@/pages/student/MyLibrary'));
const MyIDCard       = lazyWithReload(() => import('@/pages/student/MyIDCard'));
// Profile goes through a mobile wrapper that adds sign-out — the shared page
// has none, because on the web that lives in the dashboard Header.
const ProfileScreen  = lazyWithReload(() => import('./ProfileScreen'));

function ScreenFallback() {
  return (
    <div className="flex h-[60dvh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary-500 border-t-transparent" />
    </div>
  );
}

export default function StudentApp() {
  return (
    <AuthProvider>
      {/* Sits over the app while the session resolves and cached branding is
          read, so what it uncovers is a settled screen rather than a spinner.
          Dismisses itself; nothing here has to manage it. */}
      <MobileSplash
        appName="SchoolSync"
        tagline="Your student portal"
        icon={GraduationCap}
        accent="amber"
      />
      <Suspense fallback={<ScreenFallback />}>
        <Routes>
          <Route path="/login" element={<LoginScreen />} />

          {/* Paths deliberately mirror the web app's /student/* routes. The
              shared pages link to each other with absolute paths — e.g.
              StudentDashboard's quick links navigate to /student/grades — so
              matching them keeps those pages working with no changes. */}
          <Route
            element={
              <RequireStudent>
                <BiometricGate>
                  <TabShell />
                </BiometricGate>
              </RequireStudent>
            }
          >
            <Route path="/student/dashboard"  element={<Dashboard />} />
            <Route path="/student/grades"     element={<MyGrades />} />
            <Route path="/student/attendance" element={<MyAttendance />} />
            <Route path="/student/fees"       element={<MyFees />} />
            <Route path="/student/timetable"  element={<MyTimetable />} />
            <Route path="/student/library"    element={<MyLibrary />} />
            <Route path="/student/id-card"    element={<MyIDCard />} />
            <Route path="/student/profile"    element={<ProfileScreen />} />
          </Route>

          <Route path="/" element={<Navigate to="/student/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/student/dashboard" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}
