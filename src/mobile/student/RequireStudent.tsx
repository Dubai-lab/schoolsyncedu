import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { USER_ROLES } from '@/utils/constants';

/**
 * Auth guard for the student app.
 *
 * Deliberately NOT reusing middleware/requireAuth.ts: that guard depends on
 * DomainContext for custom-domain redirects, which only matter on the web.
 * Pulling it in would drag the domain lookup into the mobile bundle for no
 * benefit — the app always talks to Supabase directly.
 */

function Splash() {
  return (
    <div className="flex h-[100dvh] items-center justify-center bg-white">
      <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-primary-500 border-t-transparent" />
    </div>
  );
}

export default function RequireStudent({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, user, signOut } = useAuth();
  const location = useLocation();

  if (isLoading) return <Splash />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }


  // This app ships student screens only. Staff accounts are valid credentials
  // but have nothing to see here, so say so plainly instead of showing an
  // empty dashboard or bouncing them back to a login they just passed.
  if (user?.role !== USER_ROLES.STUDENT) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-4 bg-white px-8 text-center">
        <h1 className="text-lg font-semibold text-slate-900">This app is for students</h1>
        <p className="max-w-xs text-sm text-slate-500">
          Staff accounts are managed from the SchoolSync web portal. Sign in there to reach your
          dashboard.
        </p>
        <button
          onClick={() => signOut()}
          className="mt-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Sign out
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
