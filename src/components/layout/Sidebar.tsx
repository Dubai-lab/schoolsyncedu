import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUiStore } from '@/store/ui.store';
import { USER_ROLES, type UserRole } from '@/utils/constants';
import { clsx } from 'clsx';
import {
  BookOpen,
  LayoutDashboard,
  Users,
  GraduationCap,
  CalendarCheck,

  DollarSign,
  Mail,
  Library,
  FileText,
  Shield,
  CreditCard,
  MessageSquare,
  BarChart3,
  Settings,
  UserCog,
  Brain,
  Nfc,
  ClipboardList,
  Calendar,
  Building2,
  Monitor,
  Globe,
  ChevronLeft,
  ChevronRight,
  X,
  ClipboardCheck,
  Layers,
  KeyRound,
  AlertTriangle,
  ShieldOff,
  HeartPulse,
  TrendingDown,
} from 'lucide-react';

// ==================== NAV CONFIG ====================

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  roles: UserRole[];
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const ALL_STAFF: UserRole[] = [
  USER_ROLES.PRINCIPAL,
  USER_ROLES.VICE_PRINCIPAL,
  USER_ROLES.DEAN, USER_ROLES.ADMIN_STAFF,
  USER_ROLES.LIBRARIAN, USER_ROLES.COUNSELOR,
];

const ADMIN_ROLES: UserRole[] = [
  USER_ROLES.PRINCIPAL, USER_ROLES.VICE_PRINCIPAL,
  USER_ROLES.ADMIN_STAFF,
];

const FINANCE_ROLES: UserRole[] = [
  USER_ROLES.PRINCIPAL,
  USER_ROLES.ADMIN_STAFF,
];

const navGroups: NavGroup[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: [...ALL_STAFF, USER_ROLES.PARENT] },
      { label: 'Analytics', path: '/dashboard/analytics', icon: BarChart3, roles: ADMIN_ROLES },
    ],
  },
  {
    title: 'Academic',
    items: [
      { label: 'Students', path: '/students', icon: GraduationCap, roles: [...ADMIN_ROLES, USER_ROLES.DEAN] },
      { label: 'Classes', path: '/classes', icon: Users, roles: ADMIN_ROLES },
      { label: 'Subjects', path: '/subjects', icon: BookOpen, roles: ADMIN_ROLES },
      { label: 'Terms', path: '/classes/terms', icon: Calendar, roles: [USER_ROLES.PRINCIPAL, USER_ROLES.VICE_PRINCIPAL, USER_ROLES.IT_ADMIN] },
      { label: 'Grades', path: '/grades', icon: FileText, roles: [...ADMIN_ROLES, USER_ROLES.PARENT] },
      { label: 'Grade Approval', path: '/grades/approval', icon: ClipboardCheck, roles: [USER_ROLES.PRINCIPAL, USER_ROLES.VICE_PRINCIPAL] },
      { label: 'Attendance', path: '/attendance', icon: CalendarCheck, roles: [...ADMIN_ROLES, USER_ROLES.DEAN, USER_ROLES.PARENT] },
      { label: 'Timetable', path: '/timetable', icon: Calendar, roles: [...ALL_STAFF, USER_ROLES.PARENT] },
      { label: 'WAEC Exams', path: '/waec', icon: ClipboardList, roles: ADMIN_ROLES },
    ],
  },
  {
    title: 'My Portal',
    items: [
      { label: 'My Dashboard', path: '/student/dashboard', icon: LayoutDashboard, roles: [USER_ROLES.STUDENT] },
      { label: 'My Grades', path: '/student/grades', icon: FileText, roles: [USER_ROLES.STUDENT] },
      { label: 'My Attendance', path: '/student/attendance', icon: CalendarCheck, roles: [USER_ROLES.STUDENT] },
      { label: 'My Timetable', path: '/student/timetable', icon: Calendar, roles: [USER_ROLES.STUDENT] },
      { label: 'My Fees', path: '/student/fees', icon: DollarSign, roles: [USER_ROLES.STUDENT] },
      { label: 'My Library', path: '/student/library', icon: Library, roles: [USER_ROLES.STUDENT] },
      { label: 'My ID Card', path: '/student/id-card', icon: CreditCard, roles: [USER_ROLES.STUDENT] },
      { label: 'My Profile', path: '/student/profile', icon: BookOpen, roles: [USER_ROLES.STUDENT] },
    ],
  },
  {
    title: 'Teacher Portal',
    items: [
      { label: 'Teacher Home', path: '/teacher', icon: LayoutDashboard, roles: [USER_ROLES.TEACHER] },
      { label: 'My Classes', path: '/teacher/classes', icon: Users, roles: [USER_ROLES.TEACHER] },
      { label: 'My Schedule', path: '/teacher/schedule', icon: Calendar, roles: [USER_ROLES.TEACHER] },
      { label: 'Mark Attendance', path: '/teacher/attendance', icon: CalendarCheck, roles: [USER_ROLES.TEACHER] },
      { label: 'NFC Attendance', path: '/teacher/nfc-attendance', icon: Nfc, roles: [USER_ROLES.TEACHER] },
      { label: 'Enter Grades', path: '/teacher/grades', icon: FileText, roles: [USER_ROLES.TEACHER] },
    ],
  },
  {
    title: 'Finance',
    items: [
      { label: 'Fees', path: '/fees', icon: DollarSign, roles: [USER_ROLES.ADMIN_STAFF, USER_ROLES.PARENT] },
      { label: 'Reports', path: '/reports/financial', icon: BarChart3, roles: FINANCE_ROLES },
    ],
  },
  {
    title: 'Communication',
    items: [
      { label: 'Letters', path: '/letters', icon: Mail, roles: [...ADMIN_ROLES, USER_ROLES.DEAN, USER_ROLES.BURSAR, USER_ROLES.REGISTRAR] },
      { label: 'Messages', path: '/communications', icon: MessageSquare, roles: ALL_STAFF },
    ],
  },
  {
    title: 'Services',
    items: [
      { label: 'Library', path: '/library', icon: Library, roles: [USER_ROLES.VICE_PRINCIPAL, USER_ROLES.ADMIN_STAFF, USER_ROLES.LIBRARIAN] },
      { label: 'Guidance', path: '/guidance', icon: Brain, roles: [USER_ROLES.VICE_PRINCIPAL, USER_ROLES.DEAN, USER_ROLES.COUNSELOR] },
      { label: 'ID Cards', path: '/idcards', icon: Nfc, roles: [USER_ROLES.VICE_PRINCIPAL, USER_ROLES.ADMIN_STAFF] },
    ],
  },
  {
    title: 'Librarian',
    items: [
      { label: 'Dashboard', path: '/librarian', icon: LayoutDashboard, roles: [USER_ROLES.LIBRARIAN] },
      { label: 'NFC Checkout', path: '/librarian/nfc-checkout', icon: Nfc, roles: [USER_ROLES.LIBRARIAN] },
      { label: 'Book Catalog', path: '/library', icon: BookOpen, roles: [USER_ROLES.LIBRARIAN] },
      { label: 'Checkouts', path: '/library/checkout', icon: ClipboardList, roles: [USER_ROLES.LIBRARIAN] },
      { label: 'Overdue Books', path: '/library/overdue', icon: AlertTriangle, roles: [USER_ROLES.LIBRARIAN] },
      { label: 'Reports', path: '/library/reports', icon: BarChart3, roles: [USER_ROLES.LIBRARIAN] },
    ],
  },
  {
    title: 'Principal',
    items: [
      { label: 'Dashboard', path: '/principal', icon: LayoutDashboard, roles: [USER_ROLES.PRINCIPAL, USER_ROLES.VICE_PRINCIPAL] },
      { label: 'Students', path: '/students', icon: GraduationCap, roles: [USER_ROLES.PRINCIPAL, USER_ROLES.VICE_PRINCIPAL] },
      { label: 'Staff', path: '/staff', icon: UserCog, roles: [USER_ROLES.PRINCIPAL, USER_ROLES.VICE_PRINCIPAL] },
      { label: 'Classes', path: '/classes', icon: Users, roles: [USER_ROLES.PRINCIPAL, USER_ROLES.VICE_PRINCIPAL] },
      { label: 'Subjects', path: '/subjects', icon: BookOpen, roles: [USER_ROLES.PRINCIPAL, USER_ROLES.VICE_PRINCIPAL] },
      { label: 'Terms', path: '/classes/terms', icon: Calendar, roles: [USER_ROLES.PRINCIPAL, USER_ROLES.VICE_PRINCIPAL] },
      { label: 'Timetable', path: '/timetable', icon: Calendar, roles: [USER_ROLES.PRINCIPAL, USER_ROLES.VICE_PRINCIPAL] },
      { label: 'Attendance', path: '/attendance', icon: CalendarCheck, roles: [USER_ROLES.PRINCIPAL, USER_ROLES.VICE_PRINCIPAL] },
      { label: 'WAEC Exams', path: '/waec', icon: ClipboardList, roles: [USER_ROLES.PRINCIPAL, USER_ROLES.VICE_PRINCIPAL] },
      { label: 'Grades', path: '/grades', icon: FileText, roles: [USER_ROLES.PRINCIPAL, USER_ROLES.VICE_PRINCIPAL] },
      { label: 'Grade Approval', path: '/grades/approval', icon: ClipboardCheck, roles: [USER_ROLES.PRINCIPAL, USER_ROLES.VICE_PRINCIPAL] },
      { label: 'Letters', path: '/letters', icon: Mail, roles: [USER_ROLES.PRINCIPAL, USER_ROLES.VICE_PRINCIPAL] },
      { label: 'Letter Approvals', path: '/letters/approvals', icon: ClipboardCheck, roles: [USER_ROLES.PRINCIPAL, USER_ROLES.VICE_PRINCIPAL] },
      { label: 'Communications', path: '/communications', icon: MessageSquare, roles: [USER_ROLES.PRINCIPAL, USER_ROLES.VICE_PRINCIPAL] },
      { label: 'Reports', path: '/reports', icon: BarChart3, roles: [USER_ROLES.PRINCIPAL, USER_ROLES.VICE_PRINCIPAL] },
      { label: 'Year-End Promotion', path: '/registrar/promotion', icon: GraduationCap, roles: [USER_ROLES.PRINCIPAL, USER_ROLES.VICE_PRINCIPAL] },
      { label: 'Analytics', path: '/dashboard/analytics', icon: BarChart3, roles: [USER_ROLES.PRINCIPAL] },
      { label: 'Settings', path: '/settings', icon: Settings, roles: [USER_ROLES.PRINCIPAL] },
    ],
  },
  {
    title: 'Dean of Students',
    items: [
      { label: 'Dean Home', path: '/dean', icon: LayoutDashboard, roles: [USER_ROLES.DEAN] },
      { label: 'Incident Log', path: '/dean/incidents', icon: AlertTriangle, roles: [USER_ROLES.DEAN] },
      { label: 'Teacher Referrals', path: '/dean/referrals', icon: Users, roles: [USER_ROLES.DEAN] },
      { label: 'Suspensions', path: '/dean/suspensions', icon: ShieldOff, roles: [USER_ROLES.DEAN] },
      { label: 'Parent Meetings', path: '/dean/meetings', icon: Calendar, roles: [USER_ROLES.DEAN] },
      { label: 'Student Welfare', path: '/dean/welfare', icon: HeartPulse, roles: [USER_ROLES.DEAN] },
      { label: 'Attendance Monitor', path: '/dean/attendance', icon: TrendingDown, roles: [USER_ROLES.DEAN] },
      { label: 'Reports', path: '/dean/reports', icon: BarChart3, roles: [USER_ROLES.DEAN] },
    ],
  },
  {
    title: 'Registrar',
    items: [
      { label: 'Registrar Home', path: '/registrar', icon: ClipboardCheck, roles: [USER_ROLES.REGISTRAR] },
      { label: 'Applications', path: '/registrar/applications', icon: ClipboardList, roles: [USER_ROLES.REGISTRAR] },
      { label: 'Year-End Promotion', path: '/registrar/promotion', icon: GraduationCap, roles: [USER_ROLES.REGISTRAR, USER_ROLES.PRINCIPAL] },
    ],
  },
  {
    title: 'Bursar',
    items: [
      { label: 'Finance Home', path: '/bursar', icon: DollarSign, roles: [USER_ROLES.BURSAR] },
      { label: 'Application Fees', path: '/bursar/application-fees', icon: ClipboardList, roles: [USER_ROLES.BURSAR] },
      { label: 'Record Payment', path: '/fees/payment', icon: CreditCard, roles: [USER_ROLES.BURSAR] },
      { label: 'Fee Structures', path: '/bursar/fee-structures', icon: Layers, roles: [USER_ROLES.BURSAR] },
      { label: 'Student Fees', path: '/fees', icon: DollarSign, roles: [USER_ROLES.BURSAR] },
      { label: 'Payment History', path: '/fees/history', icon: FileText, roles: [USER_ROLES.BURSAR] },
    ],
  },
  {
    title: 'Administration',
    items: [
      { label: 'Staff', path: '/staff', icon: UserCog, roles: [USER_ROLES.PRINCIPAL, USER_ROLES.VICE_PRINCIPAL, USER_ROLES.ADMIN_STAFF] },
      { label: 'Settings', path: '/settings', icon: Settings, roles: [USER_ROLES.PROPRIETOR, USER_ROLES.PRINCIPAL] },
    ],
  },
  {
    title: 'IT Management',
    items: [
      { label: 'IT Dashboard', path: '/it-admin', icon: Monitor, roles: [USER_ROLES.IT_ADMIN] },
      { label: 'User Accounts', path: '/it-admin/users', icon: Users, roles: [USER_ROLES.IT_ADMIN] },
      { label: 'Card Designer', path: '/it-admin/cards', icon: CreditCard, roles: [USER_ROLES.IT_ADMIN] },
      { label: 'Generate Cards', path: '/it-admin/cards/generate', icon: ClipboardList, roles: [USER_ROLES.IT_ADMIN] },
      { label: 'NFC Assignment', path: '/it-admin/cards/nfc', icon: Nfc, roles: [USER_ROLES.IT_ADMIN] },
      { label: 'Student Accounts', path: '/it-admin/students', icon: GraduationCap, roles: [USER_ROLES.IT_ADMIN] },
      { label: 'School Website', path: '/it-admin/site', icon: Globe, roles: [USER_ROLES.IT_ADMIN] },
      { label: 'Fee Schedule', path: '/it-admin/fees', icon: DollarSign, roles: [USER_ROLES.IT_ADMIN] },
      { label: 'Login Page', path: '/it-admin/login-page', icon: KeyRound, roles: [USER_ROLES.IT_ADMIN] },
      { label: 'Email Settings', path: '/it-admin/email', icon: Mail, roles: [USER_ROLES.IT_ADMIN] },
      { label: 'School Settings', path: '/it-admin/settings', icon: Settings, roles: [USER_ROLES.IT_ADMIN] },
      { label: 'System', path: '/it-admin/system', icon: Shield, roles: [USER_ROLES.IT_ADMIN] },
    ],
  },
  {
    title: 'Proprietor',
    items: [
      { label: 'Overview', path: '/proprietor', icon: LayoutDashboard, roles: [USER_ROLES.PROPRIETOR] },
      { label: 'IT Admin', path: '/proprietor/it-admin', icon: Monitor, roles: [USER_ROLES.PROPRIETOR] },
      { label: 'School Site', path: '/proprietor/site', icon: Globe, roles: [USER_ROLES.PROPRIETOR] },
      { label: 'Fee Schedule', path: '/proprietor/fees', icon: DollarSign, roles: [USER_ROLES.PROPRIETOR] },
      { label: 'Login Page', path: '/proprietor/login-page', icon: KeyRound, roles: [USER_ROLES.PROPRIETOR] },
      { label: 'Payment Methods', path: '/proprietor/payment-methods', icon: CreditCard, roles: [USER_ROLES.PROPRIETOR] },
      { label: 'Subscription', path: '/proprietor/subscription', icon: DollarSign, roles: [USER_ROLES.PROPRIETOR] },
      { label: 'Financial', path: '/proprietor/financial', icon: BarChart3, roles: [USER_ROLES.PROPRIETOR] },
      { label: 'Audit Trail', path: '/proprietor/audit', icon: Shield, roles: [USER_ROLES.PROPRIETOR] },
    ],
  },
  {
    title: 'Platform',
    items: [
      { label: 'Dashboard', path: '/admin', icon: LayoutDashboard, roles: [USER_ROLES.SUPER_ADMIN] },
      { label: 'Schools', path: '/admin/schools', icon: Building2, roles: [USER_ROLES.SUPER_ADMIN] },
      { label: 'Pricing Plans', path: '/admin/pricing', icon: CreditCard, roles: [USER_ROLES.SUPER_ADMIN] },
      { label: 'Billing', path: '/admin/billing', icon: CreditCard, roles: [USER_ROLES.SUPER_ADMIN] },
      { label: 'Discounts', path: '/admin/discounts', icon: DollarSign, roles: [USER_ROLES.SUPER_ADMIN] },
      { label: 'System Health', path: '/admin/health', icon: Shield, roles: [USER_ROLES.SUPER_ADMIN] },
    ],
  },
];

// ==================== COMPONENT ====================

export default function Sidebar() {
  const { user } = useAuth();
  const { sidebarOpen, sidebarCollapsed, setSidebarOpen, toggleCollapsed } = useUiStore();
  const location = useLocation();
  const role = (user?.role ?? '') as UserRole;

  // Filter nav items by current user's role
  // For specialized roles (Dean, Registrar, Bursar, IT Admin, Proprietor), show only their section
  let filteredGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.roles.includes(role)),
    }))
    .filter((group) => group.items.length > 0);

  // For specialized roles, show only their dedicated section
  const roleToSectionMap: { [key in UserRole]?: string } = {
    [USER_ROLES.LIBRARIAN]: 'Librarian',
    [USER_ROLES.PRINCIPAL]: 'Principal',
    [USER_ROLES.VICE_PRINCIPAL]: 'Principal',
    [USER_ROLES.DEAN]: 'Dean of Students',
    [USER_ROLES.REGISTRAR]: 'Registrar',
    [USER_ROLES.BURSAR]: 'Bursar',
    [USER_ROLES.IT_ADMIN]: 'IT Management',
    [USER_ROLES.PROPRIETOR]: 'Proprietor',
  };

  const sectionTitle = roleToSectionMap[role];
  if (sectionTitle) {
    filteredGroups = filteredGroups.filter((group) => group.title === sectionTitle);
  }

  const navContent = (
    <nav className="flex flex-col h-full">
      {/* Logo */}
      <div className={clsx(
        'flex items-center border-b border-slate-200/80 px-4 h-16 shrink-0',
        sidebarCollapsed ? 'justify-center' : 'gap-3',
      )}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-600 text-white">
          <BookOpen className="h-5 w-5" />
        </div>
        {!sidebarCollapsed && (
          <span className="text-lg font-bold text-slate-900 truncate">SchoolSync</span>
        )}
      </div>

      {/* Nav items */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin">
        {filteredGroups.map((group) => (
          <div key={group.title}>
            {!sidebarCollapsed && (
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                {group.title}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = location.pathname === item.path ||
                  (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={clsx(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
                      sidebarCollapsed && 'justify-center',
                      isActive
                        ? 'bg-primary-50 text-primary-700 shadow-sm shadow-primary-100'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                    )}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    <item.icon className={clsx('h-[18px] w-[18px] shrink-0', isActive && 'text-primary-600')} />
                    {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Collapse toggle (desktop only) */}
      <div className="hidden lg:flex items-center border-t border-slate-200/80 px-3 py-3">
        <button
          onClick={toggleCollapsed}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        >
          {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {!sidebarCollapsed && <span>Collapse</span>}
        </button>
      </div>
    </nav>
  );

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-xl transition-transform duration-300 lg:hidden',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <button
          onClick={() => setSidebarOpen(false)}
          className="absolute right-3 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-5 w-5" />
        </button>
        {navContent}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={clsx(
          'hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-slate-200/80 transition-all duration-300',
          sidebarCollapsed ? 'lg:w-[72px]' : 'lg:w-64',
        )}
      >
        {navContent}
      </aside>
    </>
  );
}