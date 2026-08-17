import { useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Home, BookOpen, CalendarCheck, DollarSign, User } from 'lucide-react';
import { initPush } from './push';

/**
 * Phone shell for the signed-in student screens.
 *
 * The web app renders these same pages inside DashboardLayout, which assumes a
 * 256px sidebar and a desktop header. On a phone that layout wastes the whole
 * viewport, so this replaces it with a fixed bottom tab bar.
 *
 * Five tabs is the practical maximum before targets get too small to hit;
 * timetable, library and ID card live one level deeper off the dashboard.
 */

const TABS = [
  { to: '/student/dashboard',  label: 'Home',       icon: Home },
  { to: '/student/grades',     label: 'Grades',     icon: BookOpen },
  { to: '/student/attendance', label: 'Attendance', icon: CalendarCheck },
  { to: '/student/fees',       label: 'Fees',       icon: DollarSign },
  { to: '/student/profile',    label: 'Profile',    icon: User },
] as const;

export default function TabShell() {
  const location = useLocation();
  const navigate = useNavigate();

  // Registered here rather than at app start: this only mounts behind the auth
  // guard, so a token is never stored before we know which student it belongs to.
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    void initPush((route) => navigate(route)).then((fn) => { cleanup = fn; });
    return () => cleanup?.();
  }, [navigate]);

  return (
    <div className="mobile-shell flex min-h-[100dvh] flex-col bg-slate-50">
      {/* Scroll region. pb leaves room for the tab bar plus the iOS home
          indicator; key on pathname so each screen starts at the top. */}
      {/* data-scroll-region: on the web the page scrolls on <body>, but here it
          scrolls on this element. A full-screen overlay that wants to hold the
          page still needs to know which one to freeze — see PaymentModal. */}
      <main
        key={location.pathname}
        data-scroll-region
        className="flex-1 overflow-y-auto px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[calc(4.5rem+env(safe-area-inset-bottom))]"
      >
        <Outlet />
      </main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        <ul className="flex">
          {TABS.map(({ to, label, icon: Icon }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                className={({ isActive }) =>
                  [
                    // min-h-14 keeps every target at/above the 44px both
                    // platforms recommend for touch.
                    'flex min-h-14 flex-col items-center justify-center gap-1 py-2 text-[0.6875rem] font-medium transition-colors',
                    isActive ? 'text-primary-600' : 'text-slate-400',
                  ].join(' ')
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className="h-5 w-5" strokeWidth={isActive ? 2.4 : 1.8} />
                    <span>{label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
