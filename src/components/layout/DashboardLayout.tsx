import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import ErrorBoundary from '@/components/shared/ErrorBoundary';
import { useUiStore } from '@/store/ui.store';
import { clsx } from 'clsx';

export default function DashboardLayout() {
  const { sidebarCollapsed } = useUiStore();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <div
        className={clsx(
          'flex flex-col transition-all duration-300',
          sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-64',
        )}
      >
        <Header />
        <main className="flex-1 p-4 sm:p-6">
          {/*
            ErrorBoundary existed in the codebase but was mounted nowhere, so
            any render error anywhere in the app produced a blank white page
            with no message and no way back except a manual browser refresh.
            That is what a teacher hit on Enter Grades.

            Inside <main>, so the sidebar and header survive and the page is
            still navigable. Keyed on the path so moving to another page clears
            the error by itself — without the key, one crash would leave every
            later page showing the same message.
          */}
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
