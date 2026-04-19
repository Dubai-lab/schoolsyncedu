import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { principalService } from '@/services/principalService';
import { Card } from '@/components/ui/Card';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Link } from 'react-router-dom';
import { USER_ROLES } from '@/utils/constants';
import {
  GraduationCap,
  Users,
  BookOpen,
  Mail,
  BarChart3,
  Settings,
  FileText,
  Calendar,
  ClipboardList,
  UserCog,
  LayoutDashboard,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  to,
  urgent,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  to?: string;
  urgent?: boolean;
}) {
  const content = (
    <Card
      className={`p-5 flex items-center gap-4 hover:shadow-md transition-shadow ${to ? 'cursor-pointer' : ''} ${urgent && Number(value) > 0 ? 'ring-2 ring-amber-400' : ''}`}
    >
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${color} shrink-0`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
        <p className="text-sm text-slate-500 truncate">{label}</p>
      </div>
      {to && <ChevronRight className="h-5 w-5 text-slate-300 shrink-0" />}
    </Card>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

function QuickAction({
  label,
  desc,
  to,
  icon: Icon,
  color,
}: {
  label: string;
  desc: string;
  to: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Link to={to}>
      <Card className={`p-4 flex items-center gap-3 border hover:shadow-md transition-shadow cursor-pointer ${color}`}>
        <Icon className="h-5 w-5 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight">{label}</p>
          <p className="text-xs text-slate-500 mt-0.5 truncate">{desc}</p>
        </div>
        <ChevronRight className="h-4 w-4 ml-auto shrink-0 text-slate-400" />
      </Card>
    </Link>
  );
}

export default function PrincipalDashboard() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';
  const isPrincipal = user?.role === USER_ROLES.PRINCIPAL;

  const { data: stats, isLoading } = useFetch(
    ['principal-stats', schoolId],
    () => principalService.getStats(schoolId),
    { enabled: !!schoolId },
  );

  const statCards = [
    {
      label: 'Total Students',
      value: stats?.studentCount ?? 0,
      icon: GraduationCap,
      color: 'bg-blue-500',
      to: '/students',
    },
    {
      label: 'Active Staff',
      value: stats?.staffCount ?? 0,
      icon: UserCog,
      color: 'bg-violet-500',
      to: '/staff',
    },
    {
      label: 'Classes',
      value: stats?.classCount ?? 0,
      icon: BookOpen,
      color: 'bg-emerald-500',
      to: '/classes',
    },
    {
      label: 'Letters Pending Approval',
      value: stats?.pendingLetterApprovals ?? 0,
      icon: Mail,
      color: 'bg-orange-500',
      to: '/letters/approvals',
      urgent: true,
    },
  ];

  const quickActions = [
    {
      label: 'Letter Approvals',
      desc: 'Approve outgoing letters',
      to: '/letters/approvals',
      icon: Mail,
      color: 'text-orange-700 bg-orange-50 border-orange-200',
    },
    {
      label: 'Students',
      desc: 'Browse & manage students',
      to: '/students',
      icon: GraduationCap,
      color: 'text-blue-700 bg-blue-50 border-blue-200',
    },
    {
      label: 'Staff',
      desc: 'View and manage staff',
      to: '/staff',
      icon: UserCog,
      color: 'text-violet-700 bg-violet-50 border-violet-200',
    },
    {
      label: 'Timetable',
      desc: 'View school timetable',
      to: '/timetable',
      icon: Calendar,
      color: 'text-indigo-700 bg-indigo-50 border-indigo-200',
    },
    {
      label: 'WAEC Exams',
      desc: 'Manage WAEC candidates',
      to: '/waec',
      icon: ClipboardList,
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    },
    {
      label: 'Reports',
      desc: 'Academic & attendance reports',
      to: '/reports',
      icon: BarChart3,
      color: 'text-slate-700 bg-slate-50 border-slate-200',
    },
    {
      label: 'Communications',
      desc: 'Announcements & messages',
      to: '/communications',
      icon: Mail,
      color: 'text-cyan-700 bg-cyan-50 border-cyan-200',
    },
    {
      label: 'Year-End Promotion',
      desc: 'Promote students to next class',
      to: '/registrar/promotion',
      icon: GraduationCap,
      color: 'text-green-700 bg-green-50 border-green-200',
    },
    ...(isPrincipal
      ? [
          {
            label: 'Analytics',
            desc: 'School performance analytics',
            to: '/dashboard/analytics',
            icon: BarChart3,
            color: 'text-purple-700 bg-purple-50 border-purple-200',
          },
          {
            label: 'Settings',
            desc: 'School profile & settings',
            to: '/settings',
            icon: Settings,
            color: 'text-gray-700 bg-gray-50 border-gray-200',
          },
        ]
      : []),
  ];

  const roleLabel = isPrincipal ? 'Principal' : 'Vice Principal';

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: `${roleLabel} Dashboard` }]} />

      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{roleLabel} Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          Welcome, {user?.full_name ?? roleLabel}. Here is your school overview for today.
        </p>
      </div>

      {/* Urgent alerts */}
      {!isLoading && (stats?.pendingLetterApprovals ?? 0) > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800 flex-1">
            You have{' '}
            <strong>{stats!.pendingLetterApprovals} letter{stats!.pendingLetterApprovals !== 1 ? 's' : ''}</strong>{' '}
            awaiting your approval.
          </p>
          <Link to="/letters/approvals" className="text-xs font-medium text-amber-700 underline shrink-0">
            Letters
          </Link>
        </div>
      )}

      {/* Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
          {statCards.map((card) => (
            <StatCard key={card.label} {...card} />
          ))}
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <LayoutDashboard className="w-4 h-4 text-slate-400" />
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {quickActions.map((action) => (
            <QuickAction key={action.to} {...action} />
          ))}
        </div>
      </div>

      {/* Navigation tiles for modules */}
      <div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-slate-400" />
          Academic Modules
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[
            { label: 'Classes', path: '/classes', icon: BookOpen },
            { label: 'Subjects', path: '/subjects', icon: BookOpen },
            { label: 'Terms', path: '/classes/terms', icon: Calendar },
            { label: 'Letters', path: '/letters', icon: Mail },
            { label: 'Users', path: '/staff', icon: Users },
          ].map((item) => (
            <Link key={item.path} to={item.path}>
              <Card className="p-3 flex items-center gap-2 hover:shadow-md transition-shadow cursor-pointer">
                <item.icon className="h-4 w-4 text-primary-600 shrink-0" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{item.label}</span>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
