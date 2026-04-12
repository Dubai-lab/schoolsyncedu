import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { libraryReportService } from '@/services/libraryService';
import { Card } from '@/components/ui/Card';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { BookOpen, BookUp, AlertTriangle, CheckCircle } from 'lucide-react';

export default function BookReports() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const { data: stats, isLoading } = useFetch(
    ['library-stats', schoolId],
    () => libraryReportService.getStats(schoolId),
    { enabled: !!schoolId },
  );

  const { data: outstanding } = useFetch(
    ['library-outstanding', schoolId],
    () => libraryReportService.getOutstandingItems(schoolId),
    { enabled: !!schoolId },
  );

  const overdueItems = (outstanding ?? []).filter((i) => i.status === 'overdue');
  const topOverdue = overdueItems.sort((a, b) => b.days_overdue - a.days_overdue).slice(0, 10);

  const statCards = [
    { icon: BookOpen, label: 'Total Titles', value: stats?.totalTitles ?? 0, color: 'text-primary-600 bg-primary-50' },
    { icon: CheckCircle, label: 'Available Copies', value: stats?.availableBooks ?? 0, color: 'text-emerald-600 bg-emerald-50' },
    { icon: BookUp, label: 'Checked Out', value: stats?.checkedOut ?? 0, color: 'text-amber-600 bg-amber-50' },
    { icon: AlertTriangle, label: 'Overdue', value: overdueItems.length, color: 'text-red-600 bg-red-50' },
  ];

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Breadcrumb items={[{ label: 'Library', href: '/library' }, { label: 'Reports' }]} />
        <p className="text-slate-500 text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Library', href: '/library' }, { label: 'Reports' }]} />

      <h1 className="text-xl font-bold text-slate-900">Library Reports</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <Card key={s.label} className="p-5 flex items-center gap-4">
            <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${s.color}`}>
              <s.icon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{s.value}</p>
              <p className="text-sm text-slate-500">{s.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Utilization Bar */}
      {stats && stats.totalBooks > 0 && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Collection Utilization</h2>
          <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
            <div
              className="bg-primary-500 h-4 rounded-full transition-all"
              style={{ width: `${Math.round(((stats.totalBooks - stats.availableBooks) / stats.totalBooks) * 100)}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {Math.round(((stats.totalBooks - stats.availableBooks) / stats.totalBooks) * 100)}% of collection currently in circulation
          </p>
        </Card>
      )}

      {/* Top Overdue */}
      {topOverdue.length > 0 && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Most Overdue Books</h2>
          <div className="divide-y divide-slate-100">
            {topOverdue.map((item, i) => (
              <div key={`${item.student_id}-${item.copy_number}-${i}`} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm font-medium text-slate-900">{item.book_title}</p>
                  <p className="text-xs text-slate-500">{item.first_name} {item.last_name} • Copy: {item.copy_number}</p>
                </div>
                <span className={`text-sm font-semibold ${item.days_overdue > 14 ? 'text-red-600' : 'text-amber-600'}`}>
                  {item.days_overdue} days
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}