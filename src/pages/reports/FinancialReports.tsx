import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { financialReportService } from '@/services/reportService';
import type { FinancialSummaryByClass, LatePaymentSummary, MonthlyRevenueSummary } from '@/types/fee.types';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Card } from '@/components/ui/Card';
import { DollarSign, AlertTriangle, TrendingUp, Users } from 'lucide-react';

function fmt(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);
}

export default function FinancialReports() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const { data: classSummaries = [], isLoading: loadingClass } = useFetch<FinancialSummaryByClass[]>(
    ['financial-class', schoolId],
    () => financialReportService.getSummaryByClass(schoolId),
    { enabled: !!schoolId }
  );

  const { data: latePayments = [] } = useFetch<LatePaymentSummary[]>(
    ['financial-late', schoolId],
    () => financialReportService.getLatePayments(schoolId),
    { enabled: !!schoolId }
  );

  const { data: revenue = [], isLoading: loadingRevenue } = useFetch<MonthlyRevenueSummary[]>(
    ['financial-revenue', schoolId],
    () => financialReportService.getMonthlyRevenue(schoolId),
    { enabled: !!schoolId }
  );

  // Summary stats from class summaries
  const totalDue = classSummaries.reduce((s, r) => s + r.total_fees_due, 0);
  const totalPaid = classSummaries.reduce((s, r) => s + r.total_paid, 0);
  const totalOutstanding = classSummaries.reduce((s, r) => s + r.outstanding_balance, 0);
  const overallCollection = totalDue > 0 ? ((totalPaid / totalDue) * 100).toFixed(1) : '—';

  const lateStudents = latePayments.reduce((s, r) => s + r.students_with_late_fees, 0);
  const totalOverdue = latePayments.reduce((s, r) => s + r.total_overdue, 0);

  const collectionColor = (pct: number): 'success' | 'warning' | 'danger' => {
    if (pct >= 85) return 'success';
    if (pct >= 60) return 'warning';
    return 'danger';
  };

  const classColumns: Column<FinancialSummaryByClass>[] = [
    { key: 'class_name', header: 'Class', render: (row) => row.class_name },
    { key: 'total_students', header: 'Students', render: (row) => row.total_students },
    { key: 'total_fees_due', header: 'Fees Due', render: (row) => fmt(row.total_fees_due) },
    { key: 'total_paid', header: 'Paid', render: (row) => fmt(row.total_paid) },
    {
      key: 'outstanding_balance',
      header: 'Outstanding',
      render: (row) => (
        <span className={row.outstanding_balance > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>
          {fmt(row.outstanding_balance)}
        </span>
      ),
    },
    {
      key: 'collection_percentage',
      header: 'Collection %',
      render: (row) => <Badge variant={collectionColor(row.collection_percentage)}>{row.collection_percentage.toFixed(1)}%</Badge>,
    },
  ];

  const revenueColumns: Column<MonthlyRevenueSummary>[] = [
    {
      key: 'month',
      header: 'Month',
      render: (row) => new Date(row.month).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
    },
    { key: 'transaction_count', header: 'Transactions', render: (row) => row.transaction_count },
    { key: 'total_revenue', header: 'Revenue', render: (row) => fmt(row.total_revenue) },
    { key: 'average_transaction', header: 'Avg Transaction', render: (row) => fmt(row.average_transaction) },
    { key: 'students_paid', header: 'Students Paid', render: (row) => row.students_paid },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Reports', href: '/reports' }, { label: 'Financial Reports' }]} />

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Financial Reports</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Fee collections, revenue trends, and outstanding balance summaries.
        </p>
      </div>

      {/* Top-level Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-600"><DollarSign className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Fees Due</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{fmt(totalDue)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 text-green-600"><TrendingUp className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Collected</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{fmt(totalPaid)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-600"><DollarSign className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Outstanding</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{fmt(totalOutstanding)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100 text-red-600"><AlertTriangle className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Late Students</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{lateStudents}</p>
              {totalOverdue > 0 && (
                <p className="text-xs text-red-500">{fmt(totalOverdue)} overdue</p>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Collection Rate Banner */}
      <Card className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-gray-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Overall Collection Rate</span>
        </div>
        <span className="text-2xl font-bold text-gray-900 dark:text-white">{overallCollection}%</span>
      </Card>

      {/* Class Breakdown */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Collection by Class</h2>
        <Table<FinancialSummaryByClass>
          columns={classColumns}
          data={classSummaries}
          keyExtractor={(r) => r.class_id}
          loading={loadingClass}
          emptyMessage="No financial data available."
        />
      </div>

      {/* Monthly Revenue */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Monthly Revenue</h2>
        <Table<MonthlyRevenueSummary>
          columns={revenueColumns}
          data={revenue}
          keyExtractor={(r) => `${r.month}-${r.school_id}`}
          loading={loadingRevenue}
          emptyMessage="No revenue data available."
        />
      </div>
    </div>
  );
}
