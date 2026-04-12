import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useUiStore } from '@/store/ui.store';
import { clsx } from 'clsx';

export default function DashboardLayout() {
  const { sidebarCollapsed } = useUiStore();

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
          <Outlet />
        </main>
      </div>
    </div>
  );
}