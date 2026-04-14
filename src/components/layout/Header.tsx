import { useAuth } from '@/hooks/useAuth';
import { useUiStore } from '@/store/ui.store';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  Menu,
  Bell,
  Search,
  LogOut,
  User,
  ChevronDown,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import GlobalSearch, { ROLES_WITH_SEARCH } from '@/components/shared/GlobalSearch';

export default function Header() {
  const { user, schoolSlug, signOut } = useAuth();
  const { setSidebarOpen } = useUiStore();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSignOut = async () => {
    // Capture slug before signOut clears it from the store
    const slug = schoolSlug;
    const role = user?.role;
    await signOut();
    // Proprietors & super_admins go to the SaaS login; everyone else goes to their school login
    if (slug && role !== 'super_admin' && role !== 'proprietor') {
      navigate(`/school/${slug}/login`);
    } else {
      navigate('/auth/login');
    }
  };

  const showSearch = ROLES_WITH_SEARCH.has(user?.role ?? '');

  const displayName = user
    ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.email
    : 'User';

  const roleLabel = user?.role
    ? user.role.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
    : '';

  const initials = user
    ? `${(user.first_name?.[0] ?? '').toUpperCase()}${(user.last_name?.[0] ?? '').toUpperCase()}` || 'U'
    : 'U';

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm px-4 sm:px-6">
      {/* Mobile menu button */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Search bar — only for roles that have searchable content */}
      {showSearch ? (
        <div className="hidden sm:flex flex-1 items-center max-w-md">
          <GlobalSearch />
        </div>
      ) : (
        <div className="flex-1" />
      )}

      <div className="flex-1 sm:hidden" />

      {/* Right side actions */}
      <div className="flex items-center gap-2">
        {/* Search (mobile) — only for search-enabled roles */}
        {showSearch && (
          <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 sm:hidden">
            <Search className="h-5 w-5" />
          </button>
        )}

        {/* Notifications */}
        <button className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
        </button>

        {/* Profile dropdown */}
        <div ref={profileRef} className="relative">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className={clsx(
              'flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors',
              profileOpen ? 'bg-slate-100' : 'hover:bg-slate-100',
            )}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
              {initials}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-slate-700 leading-tight truncate max-w-[140px]">{displayName}</p>
              <p className="text-[11px] text-slate-400 leading-tight">{roleLabel}</p>
            </div>
            <ChevronDown className={clsx(
              'hidden md:block h-4 w-4 text-slate-400 transition-transform',
              profileOpen && 'rotate-180',
            )} />
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50 py-1 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-sm font-medium text-slate-700">{displayName}</p>
                <p className="text-xs text-slate-400 mt-0.5">{user?.email}</p>
              </div>
              <button
                onClick={() => { navigate('/settings/preferences'); setProfileOpen(false); }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                <User className="h-4 w-4" /> Profile Settings
              </button>
              <div className="border-t border-slate-100" />
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}