import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { libraryReportService } from '@/services/libraryService';
import { Card } from '@/components/ui/Card';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  BookUp,
  AlertTriangle,
  CheckCircle,
  Nfc,
  ChevronRight,
  RotateCcw,
  BarChart3,
  Plus,
  Library,
  Clock,
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
      className={`p-5 flex items-center gap-4 hover:shadow-md transition-shadow ${to ? 'cursor-pointer' : ''} ${urgent && Number(value) > 0 ? 'ring-2 ring-red-400' : ''}`}
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

export default function LibrarianDashboard() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const { data: stats, isLoading: statsLoading } = useFetch(
    ['library-stats', schoolId],
    () => libraryReportService.getStats(schoolId),
    { enabled: !!schoolId },
  );

  const { data: today, isLoading: todayLoading } = useFetch(
    ['library-today', schoolId],
    () => libraryReportService.getTodayActivity(schoolId),
    { enabled: !!schoolId },
  );

  const { data: outstanding } = useFetch(
    ['library-outstanding', schoolId],
    () => libraryReportService.getOutstandingItems(schoolId),
    { enabled: !!schoolId },
  );

  const overdueCount = (outstanding ?? []).filter((i) => i.status === 'overdue').length;
  const criticalCount = (outstanding ?? []).filter((i) => i.days_overdue > 14).length;
  const isLoading = statsLoading || todayLoading;

  const statCards = [
    {
      label: 'Total Titles',
      value: stats?.totalTitles ?? 0,
      icon: BookOpen,
      color: 'bg-primary-500',
      to: '/library',
    },
    {
      label: 'Available Copies',
      value: stats?.availableBooks ?? 0,
      icon: CheckCircle,
      color: 'bg-emerald-500',
      to: '/library',
    },
    {
      label: 'Checked Out',
      value: stats?.checkedOut ?? 0,
      icon: BookUp,
      color: 'bg-amber-500',
      to: '/library/checkout',
    },
    {
      label: 'Overdue Books',
      value: overdueCount,
      icon: AlertTriangle,
      color: 'bg-red-500',
      to: '/library/overdue',
      urgent: true,
    },
    {
      label: 'Checkouts Today',
      value: today?.checkoutsToday ?? 0,
      icon: Clock,
      color: 'bg-blue-500',
      to: '/library/checkout',
    },
    {
      label: 'Returns Today',
      value: today?.returnsToday ?? 0,
      icon: RotateCcw,
      color: 'bg-teal-500',
      to: '/library/checkout',
    },
  ];

  const quickActions = [
    {
      label: 'NFC Checkout / Return',
      desc: 'Tap student card to check out or return a book',
      to: '/librarian/nfc-checkout',
      icon: Nfc,
      color: 'text-violet-700 bg-violet-50 border-violet-200',
    },
    {
      label: 'Manual Checkout',
      desc: 'Check out a book by entering details',
      to: '/library/checkout',
      icon: BookUp,
      color: 'text-amber-700 bg-amber-50 border-amber-200',
    },
    {
      label: 'Overdue Books',
      desc: 'View and manage overdue items',
      to: '/library/overdue',
      icon: AlertTriangle,
      color: 'text-red-700 bg-red-50 border-red-200',
    },
    {
      label: 'Book Catalog',
      desc: 'Browse, add and manage books',
      to: '/library',
      icon: BookOpen,
      color: 'text-primary-700 bg-primary-50 border-primary-200',
    },
    {
      label: 'Reports',
      desc: 'Collection stats and utilization',
      to: '/library/reports',
      icon: BarChart3,
      color: 'text-slate-700 bg-slate-50 border-slate-200',
    },
    {
      label: 'Add New Book',
      desc: 'Register a new title in the catalog',
      to: '/library',
      icon: Plus,
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Library Dashboard' }]} />

      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Library Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          Welcome, {user?.full_name ?? 'Librarian'}. Here is today's library overview.
        </p>
      </div>

      {/* Overdue alert */}
      {!isLoading && criticalCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <p className="text-sm text-red-800 flex-1">
            <strong>{criticalCount} book{criticalCount !== 1 ? 's' : ''}</strong> critically overdue (more than 14 days). Follow up with students immediately.
          </p>
          <Link to="/library/overdue" className="text-xs font-medium text-red-700 underline shrink-0">
            View All
          </Link>
        </div>
      )}

      {/* Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-3 gap-4">
          {statCards.map((card) => (
            <StatCard key={card.label} {...card} />
          ))}
        </div>
      )}

      {/* NFC highlight banner */}
      <Link to="/librarian/nfc-checkout">
        <div className="flex items-center gap-4 rounded-xl border-2 border-violet-200 bg-gradient-to-r from-violet-50 to-indigo-50 px-5 py-4 hover:shadow-md transition-shadow cursor-pointer">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600 shrink-0">
            <Nfc className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-violet-900">NFC Smart Checkout</p>
            <p className="text-sm text-violet-600 mt-0.5">
              Students tap their ID card — instantly checkout or return books without typing anything.
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-violet-400 shrink-0" />
        </div>
      </Link>

      {/* Quick Actions */}
      <div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <Library className="w-4 h-4 text-slate-400" />
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {quickActions.map((action) => (
            <QuickAction key={action.to + action.label} {...action} />
          ))}
        </div>
      </div>

      {/* Top overdue */}
      {(outstanding ?? []).filter((i) => i.status === 'overdue').length > 0 && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Most Overdue
            </h2>
            <Link to="/library/overdue" className="text-xs text-primary-600 hover:underline">
              View all
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {(outstanding ?? [])
              .filter((i) => i.status === 'overdue')
              .sort((a, b) => b.days_overdue - a.days_overdue)
              .slice(0, 5)
              .map((item, i) => (
                <div key={`${item.student_id}-${item.copy_number}-${i}`} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate">{item.book_title}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {item.first_name} {item.last_name} &middot; Copy: {item.copy_number}
                    </p>
                  </div>
                  <span className={`ml-3 text-sm font-semibold shrink-0 ${item.days_overdue > 14 ? 'text-red-600' : 'text-amber-600'}`}>
                    {item.days_overdue}d overdue
                  </span>
                </div>
              ))}
          </div>
        </Card>
      )}
    </div>
  );
}
