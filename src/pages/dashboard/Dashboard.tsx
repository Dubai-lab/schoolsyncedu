import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { USER_ROLES, type UserRole } from '@/utils/constants';
import {
  Users,
  GraduationCap,
  CalendarCheck,
  DollarSign,
  FileText,
  BarChart3,
  TrendingUp,
  BookOpen,
  AlertTriangle,
  Clock,
  CreditCard,
  Brain,
  Mail,
  Nfc,
  ChevronRight,
} from 'lucide-react';

// ==================== DASHBOARD DATA SERVICE ====================

async function fetchDashboardStats(schoolId: string) {
  const today = new Date().toISOString().split('T')[0];

  const [
    { count: totalStudents },
    { count: activeStaff },
    { count: pendingFees },
    { count: presentToday },
    { count: openLetters },
    { data: recentPayments },
    { count: totalClasses },
    { data: recentActivity },
  ] = await Promise.all([
    supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'enrolled'),
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('is_active', true).neq('role', 'student').neq('role', 'parent'),
    supabase.from('student_fees').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).in('status', ['pending', 'partial', 'overdue']),
    supabase.from('attendance_records').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('attendance_date', today).eq('status', 'present'),
    supabase.from('letter_instances').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).in('status', ['draft', 'pending_approval']),
    supabase.from('payments').select('amount_usd').eq('school_id', schoolId).gte('created_at', `${today.slice(0, 7)}-01`),
    supabase.from('classes').select('*', { count: 'exact', head: true }).eq('school_id', schoolId),
    supabase.from('audit_logs').select('action, entity_type, created_at, user_id').eq('school_id', schoolId).order('created_at', { ascending: false }).limit(10),
  ]);

  const monthlyRevenue = (recentPayments ?? []).reduce((sum, p) => sum + Number((p as Record<string, unknown>).amount_usd ?? 0), 0);

  return {
    totalStudents: totalStudents ?? 0,
    activeStaff: activeStaff ?? 0,
    pendingFees: pendingFees ?? 0,
    presentToday: presentToday ?? 0,
    openLetters: openLetters ?? 0,
    monthlyRevenue,
    totalClasses: totalClasses ?? 0,
    recentActivity: recentActivity ?? [],
  };
}

async function fetchTeacherStats(schoolId: string, userId: string) {
  // Uses teacherService for correct teacher-scoped queries
  const { teacherService: ts } = await import('@/services/teacherService');
  return ts.getDashboardStats(schoolId, userId);
}

async function fetchBursarStats(schoolId: string) {
  const today = new Date().toISOString().split('T')[0];
  const monthStart = `${today.slice(0, 7)}-01`;

  const [
    { data: mtdPayments },
    { count: outstandingFees },
    { count: paymentsToday },
  ] = await Promise.all([
    supabase.from('payments').select('amount_usd').eq('school_id', schoolId).gte('created_at', monthStart),
    supabase.from('student_fees').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).in('status', ['pending', 'partial', 'overdue']),
    supabase.from('payments').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).gte('created_at', today),
  ]);

  const revenue = (mtdPayments ?? []).reduce((sum, p) => sum + Number((p as Record<string, unknown>).amount_usd ?? 0), 0);
  const { count: totalFees } = await supabase.from('student_fees').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'paid');
  const paidCount = totalFees ?? 0;
  const collectionRate = totalFees ? Math.round((paidCount / totalFees) * 100) : 0;

  return {
    revenue,
    outstandingFees: outstandingFees ?? 0,
    paymentsToday: paymentsToday ?? 0,
    collectionRate,
  };
}

async function fetchStudentStats(schoolId: string, userId: string) {
  const { data: student } = await supabase.from('students').select('id').eq('school_id', schoolId).eq('user_id', userId).single();
  if (!student) return { attendance: 0, gpa: 0, outstandingFees: 0, libraryBooks: 0 };

  const [
    { count: totalDays },
    { count: presentDays },
    { count: outstandingFees },
    { count: libraryBooks },
    { data: grades },
  ] = await Promise.all([
    supabase.from('attendance_records').select('*', { count: 'exact', head: true }).eq('student_id', student.id),
    supabase.from('attendance_records').select('*', { count: 'exact', head: true }).eq('student_id', student.id).eq('status', 'present'),
    supabase.from('student_fees').select('*', { count: 'exact', head: true }).eq('student_id', student.id).eq('status', 'unpaid'),
    supabase.from('book_checkouts').select('*', { count: 'exact', head: true }).eq('student_id', student.id).eq('is_returned', false),
    supabase.from('grades').select('score').eq('student_id', student.id).not('score', 'is', null),
  ]);

  const attendancePercent = totalDays ? Math.round(((presentDays ?? 0) / totalDays) * 100) : 0;
  const avgGrade = grades?.length ? (grades.reduce((s, g) => s + Number(g.score ?? 0), 0) / grades.length).toFixed(1) : '0';

  return {
    attendance: attendancePercent,
    gpa: avgGrade,
    outstandingFees: outstandingFees ?? 0,
    libraryBooks: libraryBooks ?? 0,
  };
}

// ==================== STAT CARD ====================

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ElementType;
  trend?: string;
  color: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'slate';
}

const colorMap = {
  blue: { bg: 'bg-primary-50', icon: 'text-primary-600', value: 'text-primary-700' },
  green: { bg: 'bg-emerald-50', icon: 'text-emerald-600', value: 'text-emerald-700' },
  amber: { bg: 'bg-amber-50', icon: 'text-amber-600', value: 'text-amber-700' },
  red: { bg: 'bg-red-50', icon: 'text-red-600', value: 'text-red-700' },
  purple: { bg: 'bg-purple-50', icon: 'text-purple-600', value: 'text-purple-700' },
  slate: { bg: 'bg-slate-50', icon: 'text-slate-600', value: 'text-slate-700' },
};

function StatCard({ label, value, icon: Icon, trend, color }: StatCardProps) {
  const c = colorMap[color];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 hover:shadow-md hover:shadow-slate-100 transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className={`mt-1.5 text-2xl font-bold ${c.value}`}>{value}</p>
          {trend && (
            <div className="mt-2 flex items-center gap-1 text-xs font-medium text-emerald-600">
              <TrendingUp className="h-3 w-3" />
              {trend}
            </div>
          )}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${c.bg}`}>
          <Icon className={`h-5 w-5 ${c.icon}`} />
        </div>
      </div>
    </div>
  );
}

// ==================== QUICK ACTION ====================

interface QuickActionProps {
  label: string;
  description: string;
  icon: React.ElementType;
  path?: string;
}

function QuickAction({ label, description, icon: Icon, path }: QuickActionProps) {
  const navigate = useNavigate();
  return (
    <button
      onClick={path ? () => navigate(path) : undefined}
      className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3.5 text-left hover:border-primary-200 hover:bg-primary-50/30 transition-all group"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <p className="text-xs text-slate-400 mt-0.5">{description}</p>
      </div>
      {path && <ChevronRight className="h-4 w-4 text-slate-300 mt-1 group-hover:text-primary-400 transition-colors" />}
    </button>
  );
}

// ==================== ROLE-BASED CONFIGS ====================

type DashboardConfig = {
  stats: StatCardProps[];
  quickActions: QuickActionProps[];
};

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
  return `$${amount.toLocaleString()}`;
}

function getAdminDashboard(data: Awaited<ReturnType<typeof fetchDashboardStats>> | null): DashboardConfig {
  const d = data;
  return {
    stats: [
      { label: 'Total Students', value: d ? String(d.totalStudents) : '—', icon: GraduationCap, color: 'blue' },
      { label: 'Present Today', value: d ? String(d.presentToday) : '—', icon: CalendarCheck, color: 'green' },
      { label: 'Revenue (MTD)', value: d ? formatCurrency(d.monthlyRevenue) : '—', icon: DollarSign, color: 'amber' },
      { label: 'Active Staff', value: d ? String(d.activeStaff) : '—', icon: Users, color: 'purple' },
      { label: 'Pending Fees', value: d ? String(d.pendingFees) : '—', icon: AlertTriangle, color: 'red' },
      { label: 'Open Letters', value: d ? String(d.openLetters) : '—', icon: Mail, color: 'slate' },
    ],
    quickActions: [
      { label: 'Enroll Student', description: 'Register a new student', icon: GraduationCap, path: '/students/new' },
      { label: 'Take Attendance', description: 'Mark daily attendance', icon: CalendarCheck, path: '/attendance/mark' },
      { label: 'Enter Grades', description: 'Record student grades', icon: FileText, path: '/grades/entry' },
      { label: 'View Analytics', description: 'School-wide analytics', icon: BarChart3, path: '/dashboard/analytics' },
      { label: 'Manage Classes', description: 'Classes & timetable', icon: BookOpen, path: '/classes' },
      { label: 'Create Letter', description: 'Draft official letter', icon: Mail, path: '/letters/create' },
      { label: 'View Reports', description: 'Academic & financial reports', icon: BarChart3, path: '/reports' },
      { label: 'Staff Directory', description: 'Manage staff members', icon: Users, path: '/staff' },
    ],
  };
}

function getTeacherDashboard(data: Awaited<ReturnType<typeof fetchTeacherStats>> | null): DashboardConfig {
  const d = data;
  return {
    stats: [
      { label: 'My Classes', value: d ? String(d.myClasses) : '—', icon: BookOpen, color: 'blue' },
      { label: 'My Students', value: d ? String(d.myStudents) : '—', icon: GraduationCap, color: 'purple' },
      { label: 'Attendance Today', value: d ? String(d.todayAttendance) : '—', icon: CalendarCheck, color: 'green' },
      { label: 'Pending Grades', value: d ? String((d as Record<string, unknown>).pendingGrades ?? 0) : '—', icon: FileText, color: 'amber' },
    ],
    quickActions: [
      { label: 'Take Attendance', description: 'Mark today\'s attendance', icon: CalendarCheck, path: '/attendance/mark' },
      { label: 'Enter Grades', description: 'Record student grades', icon: FileText, path: '/grades/entry' },
      { label: 'View Reports', description: 'Class performance reports', icon: BarChart3, path: '/reports/academic' },
    ],
  };
}

function getBursarDashboard(data: Awaited<ReturnType<typeof fetchBursarStats>> | null): DashboardConfig {
  const d = data;
  return {
    stats: [
      { label: 'Revenue (MTD)', value: d ? formatCurrency(d.revenue) : '—', icon: DollarSign, color: 'green' },
      { label: 'Outstanding Fees', value: d ? String(d.outstandingFees) : '—', icon: AlertTriangle, color: 'red' },
      { label: 'Payments Today', value: d ? String(d.paymentsToday) : '—', icon: CreditCard, color: 'blue' },
      { label: 'Collection Rate', value: d ? `${d.collectionRate}%` : '—', icon: TrendingUp, color: 'amber' },
    ],
    quickActions: [
      { label: 'Record Payment', description: 'Process a fee payment', icon: DollarSign, path: '/fees/payment' },
      { label: 'Send Reminders', description: 'Notify overdue accounts', icon: Mail, path: '/communications/announce' },
      { label: 'Financial Report', description: 'Generate report', icon: BarChart3, path: '/reports/financial' },
    ],
  };
}

function getStudentDashboardConfig(data: Awaited<ReturnType<typeof fetchStudentStats>> | null): DashboardConfig {
  const d = data;
  return {
    stats: [
      { label: 'My Attendance', value: d ? `${d.attendance}%` : '—', icon: CalendarCheck, color: 'green' },
      { label: 'Average Grade', value: d ? String(d.gpa) : '—', icon: TrendingUp, color: 'blue' },
      { label: 'Outstanding Fees', value: d ? String(d.outstandingFees) : '—', icon: DollarSign, color: 'amber' },
      { label: 'Library Books', value: d ? String(d.libraryBooks) : '—', icon: BookOpen, color: 'purple' },
    ],
    quickActions: [
      { label: 'View Grades', description: 'Check your grades', icon: FileText, path: '/grades' },
      { label: 'Fee Status', description: 'View payment status', icon: DollarSign, path: '/fees' },
      { label: 'My ID Card', description: 'View digital ID', icon: Nfc, path: '/idcards' },
    ],
  };
}

function getParentDashboard(): DashboardConfig {
  return {
    stats: [
      { label: 'Child Attendance', value: '—', icon: CalendarCheck, color: 'green' },
      { label: 'Academic Standing', value: '—', icon: TrendingUp, color: 'blue' },
      { label: 'Fee Balance', value: '—', icon: DollarSign, color: 'amber' },
      { label: 'Next Meeting', value: '—', icon: Clock, color: 'purple' },
    ],
    quickActions: [
      { label: 'View Report Card', description: 'Latest academic report', icon: FileText, path: '/grades/reports' },
      { label: 'Pay Fees', description: 'Make a payment', icon: DollarSign, path: '/fees/payment' },
      { label: 'Contact Teacher', description: 'Send a message', icon: Mail, path: '/communications/messages' },
    ],
  };
}

function getDefaultDashboard(): DashboardConfig {
  return {
    stats: [
      { label: 'Schedule', value: '—', icon: Clock, color: 'blue' },
      { label: 'Tasks', value: '—', icon: FileText, color: 'amber' },
      { label: 'Notifications', value: '—', icon: Mail, color: 'slate' },
    ],
    quickActions: [],
  };
}

// ==================== ACTIVITY ITEM ====================

function ActivityItem({ action, entity_type, created_at }: { action: string; entity_type: string; created_at: string }) {
  const timeAgo = getTimeAgo(created_at);
  const actionLabel = action.replace(/_/g, ' ');
  const entityLabel = entity_type.replace(/_/g, ' ');
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="h-8 w-8 rounded-full bg-primary-50 flex items-center justify-center">
        <Clock className="h-3.5 w-3.5 text-primary-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-700 truncate capitalize">{actionLabel} — <span className="text-slate-500">{entityLabel}</span></p>
        <p className="text-xs text-slate-400">{timeAgo}</p>
      </div>
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ==================== MAIN COMPONENT ====================

export default function Dashboard() {
  const { user } = useAuth();
  const role = (user?.role ?? '') as UserRole;
  const schoolId = user?.school_id ?? '';
  const userId = user?.id ?? '';

  // Super admin should go to the platform admin dashboard
  if (role === USER_ROLES.SUPER_ADMIN) {
    return <Navigate to="/admin" replace />;
  }
  if (role === USER_ROLES.PROPRIETOR) {
    return <Navigate to="/proprietor" replace />;
  }

  // Fetch live data based on role
  const isAdmin = ([USER_ROLES.PRINCIPAL, USER_ROLES.VICE_PRINCIPAL, USER_ROLES.ADMIN_STAFF, USER_ROLES.DEAN, USER_ROLES.COUNSELOR, USER_ROLES.LIBRARIAN] as string[]).includes(role);
  const isTeacher = role === USER_ROLES.TEACHER;
  const isBursar = role === USER_ROLES.BURSAR;
  const isStudent = role === USER_ROLES.STUDENT;

  const { data: adminData } = useFetch(
    ['dashboard-admin', schoolId],
    () => fetchDashboardStats(schoolId),
    { enabled: !!schoolId && isAdmin },
  );

  const { data: teacherData } = useFetch(
    ['dashboard-teacher', schoolId, userId],
    () => fetchTeacherStats(schoolId, userId),
    { enabled: !!schoolId && isTeacher },
  );

  const { data: bursarData } = useFetch(
    ['dashboard-bursar', schoolId],
    () => fetchBursarStats(schoolId),
    { enabled: !!schoolId && isBursar },
  );

  const { data: studentData } = useFetch(
    ['dashboard-student', schoolId, userId],
    () => fetchStudentStats(schoolId, userId),
    { enabled: !!schoolId && isStudent },
  );

  // Build config based on role
  let config: DashboardConfig;
  switch (role) {
    case USER_ROLES.PRINCIPAL:
    case USER_ROLES.VICE_PRINCIPAL:
    case USER_ROLES.ADMIN_STAFF:
    case USER_ROLES.REGISTRAR:
      config = getAdminDashboard(adminData ?? null);
      break;
    case USER_ROLES.DEAN:
      config = {
        ...getAdminDashboard(adminData ?? null),
        stats: [
          ...getAdminDashboard(adminData ?? null).stats.slice(0, 4),
          { label: 'Student Incidents', value: '—', icon: Brain, color: 'red' as const },
          { label: 'Counseling Sessions', value: '—', icon: Brain, color: 'purple' as const },
        ],
      };
      break;
    case USER_ROLES.TEACHER:
      config = getTeacherDashboard(teacherData ?? null);
      break;
    case USER_ROLES.BURSAR:
      config = getBursarDashboard(bursarData ?? null);
      break;
    case USER_ROLES.STUDENT:
      config = getStudentDashboardConfig(studentData ?? null);
      break;
    case USER_ROLES.PARENT:
      config = getParentDashboard();
      break;
    case USER_ROLES.COUNSELOR:
      config = {
        stats: [
          { label: 'Active Cases', value: '—', icon: Brain, color: 'blue' },
          { label: 'Meetings Today', value: '—', icon: Clock, color: 'green' },
          { label: 'Incidents (MTD)', value: '—', icon: AlertTriangle, color: 'red' },
        ],
        quickActions: [
          { label: 'New Session', description: 'Record counseling session', icon: Brain, path: '/guidance' },
          { label: 'View Incidents', description: 'Student incident reports', icon: FileText, path: '/guidance/incidents' },
        ],
      };
      break;
    case USER_ROLES.LIBRARIAN:
      config = {
        stats: [
          { label: 'Books Out', value: '—', icon: BookOpen, color: 'blue' },
          { label: 'Overdue', value: '—', icon: AlertTriangle, color: 'red' },
          { label: 'Returns Today', value: '—', icon: Clock, color: 'green' },
        ],
        quickActions: [
          { label: 'Check Out Book', description: 'Issue a book', icon: BookOpen, path: '/library/checkout' },
          { label: 'Overdue List', description: 'View overdue books', icon: AlertTriangle, path: '/library/overdue' },
        ],
      };
      break;
    default:
      config = getDefaultDashboard();
  }

  const greeting = getGreeting();
  const roleName = user?.role?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) ?? '';
  const activity = (adminData?.recentActivity ?? []) as { action: string; entity_type: string; created_at: string }[];

  return (
    <div className="space-y-6">
      {/* Welcome section */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {greeting}, {user?.first_name || 'User'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {roleName} Dashboard &mdash; Here&apos;s an overview of your school today.
          </p>
        </div>
        {isAdmin && (
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
            <Clock className="h-3.5 w-3.5" />
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {config.stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      {/* Quick actions */}
      {config.quickActions.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-3">Quick Actions</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {config.quickActions.map((action) => (
              <QuickAction key={action.label} {...action} />
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity — admin only */}
      {isAdmin && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-800">Recent Activity</h2>
          {activity.length > 0 ? (
            <div className="mt-3 divide-y divide-slate-50">
              {activity.map((a, i) => (
                <ActivityItem key={i} {...a} />
              ))}
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-slate-400">No recent activity yet. Activity will appear as users interact with the system.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}