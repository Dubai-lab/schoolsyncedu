import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import RequireStudent from './RequireStudent';
import TabShell from './TabShell';
import BiometricGate from './BiometricGate';
import LoginScreen from './LoginScreen';

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

const Dashboard      = lazy(() => import('@/pages/student/StudentDashboard'));
const MyGrades       = lazy(() => import('@/pages/student/MyGrades'));
const MyAttendance   = lazy(() => import('@/pages/student/MyAttendance'));
const MyFees         = lazy(() => import('@/pages/student/MyFees'));
const MyTimetable    = lazy(() => import('@/pages/student/MyTimetable'));
const MyLibrary      = lazy(() => import('@/pages/student/MyLibrary'));
const MyIDCard       = lazy(() => import('@/pages/student/MyIDCard'));
// Profile goes through a mobile wrapper that adds sign-out — the shared page
// has none, because on the web that lives in the dashboard Header.
const ProfileScreen  = lazy(() => import('./ProfileScreen'));

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
