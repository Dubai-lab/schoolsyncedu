import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { libraryReportService } from '@/services/libraryService';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { AlertTriangle } from 'lucide-react';

type OverdueRow = {
  id: string;
  studentName: string;
  bookTitle: string;
  copyBarcode: string;
  dueDate: string;
  daysOverdue: number;
  status: string;
};

function overdueVariant(status: string) {
  if (status === 'critical') return 'danger' as const;
  if (status === 'overdue') return 'warning' as const;
  return 'info' as const;
}

export default function OverdueBooks() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const { data: outstanding, isLoading } = useFetch(
    ['library-outstanding', schoolId],
    () => libraryReportService.getOutstandingItems(schoolId),
    { enabled: !!schoolId },
  );

  const rows: OverdueRow[] = (outstanding ?? [])
    .filter((item) => item.status === 'overdue' || item.status === 'due_soon')
    .map((item, idx) => ({
      id: `${item.student_id}-${item.copy_number}-${idx}`,
      studentName: `${item.first_name} ${item.last_name}`,
      bookTitle: item.book_title,
      copyBarcode: item.copy_number,
      dueDate: item.due_date,
      daysOverdue: item.days_overdue,
      status: item.status,
    }));

  const criticalCount = rows.filter((r) => r.daysOverdue > 14).length;
  const overdueCount = rows.filter((r) => r.daysOverdue > 0 && r.daysOverdue <= 14).length;
  const dueSoonCount = rows.filter((r) => r.status === 'due_soon').length;

  const columns: Column<OverdueRow>[] = [
    { key: 'studentName', header: 'Student', render: (r) => <span className="font-medium text-slate-900">{r.studentName}</span> },
    { key: 'bookTitle', header: 'Book', render: (r) => <span className="font-medium">{r.bookTitle}</span> },
    { key: 'copyBarcode', header: 'Copy', render: (r) => <span className="font-mono text-xs text-slate-500">{r.copyBarcode}</span> },
    { key: 'dueDate', header: 'Due Date', render: (r) => (
      <span className="text-sm text-slate-700">{new Date(r.dueDate).toLocaleDateString()}</span>
    )},
    { key: 'daysOverdue', header: 'Days Overdue', render: (r) => (
      <span className={`text-sm font-semibold ${r.daysOverdue > 7 ? 'text-red-600' : r.daysOverdue > 0 ? 'text-amber-600' : 'text-slate-500'}`}>
        {r.daysOverdue > 0 ? `${r.daysOverdue} days` : 'Due soon'}
      </span>
    )},
    { key: 'status', header: 'Severity', render: (r) => {
      const label = r.daysOverdue > 14 ? 'critical' : r.daysOverdue > 0 ? 'overdue' : 'due_soon';
      return <Badge variant={overdueVariant(label)} size="sm">{label.replace('_', ' ')}</Badge>;
    }},
  ];

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Library', href: '/library' }, { label: 'Overdue Books' }]} />

      <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-amber-500" /> Overdue Books
      </h1>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-red-700">{criticalCount}</p>
          <p className="text-sm text-red-600">Critical (&gt;14 days)</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-amber-700">{overdueCount}</p>
          <p className="text-sm text-amber-600">Overdue (1–14 days)</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-blue-700">{dueSoonCount}</p>
          <p className="text-sm text-blue-600">Due Soon</p>
        </div>
      </div>

      <Table columns={columns} data={rows} keyExtractor={(r) => r.id} loading={isLoading} emptyMessage="No overdue books — great news!" />
    </div>
  );
}