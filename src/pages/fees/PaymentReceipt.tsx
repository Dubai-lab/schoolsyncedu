import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { financialReportService } from '@/services/feeService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Breadcrumb from '@/components/shared/Breadcrumb';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  BarChart3,
} from 'lucide-react';

function fmt(amount: number) {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PaymentReceipt() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const { data: classSummary, isLoading: classLoading } = useFetch(
    ['financial-class-summary', schoolId],
    () => financialReportService.getClassSummary(schoolId),
    { enabled: !!schoolId },
  );

  const { data: monthlyRevenue, isLoading: revenueLoading } = useFetch(
    ['monthly-revenue', schoolId],
    () => financialReportService.getMonthlyRevenue(schoolId),
    { enabled: !!schoolId },
  );

  const { data: latePayments, isLoading: lateLoading } = useFetch(
    ['late-payments', schoolId],
    () => financialReportService.getLatePayments(schoolId),
    { enabled: !!schoolId },
  );

  const isLoading = classLoading || revenueLoading || lateLoading;

  // Totals from class summary
  const totalDue = (classSummary ?? []).reduce((s, c) => s + c.total_fees_due, 0);
  const totalPaid = (classSummary ?? []).reduce((s, c) => s + c.total_paid, 0);
  const totalOutstanding = (classSummary ?? []).reduce((s, c) => s + c.outstanding_balance, 0);
  const overallRate = totalDue > 0 ? (totalPaid / totalDue) * 100 : 0;

  const lateTotalOverdue = (latePayments ?? []).reduce((s: number, l: Record<string, unknown>) => s + (l.total_overdue as number ?? 0), 0);
  const lateStudents = (latePayments ?? []).reduce((s: number, l: Record<string, unknown>) => s + (l.students_with_late_fees as number ?? 0), 0);

  if (isLoading) return <LoadingSpinner label="Loading financial reports..." />;

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Fees', href: '/fees' }, { label: 'Financial Reports' }]} />

      <h1 className="text-xl font-bold text-slate-900">Financial Reports</h1>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={DollarSign} label="Total Fees Due" value={fmt(totalDue)} color="text-slate-700" bg="bg-slate-50" />
        <StatCard icon={TrendingUp} label="Total Collected" value={fmt(totalPaid)} color="text-emerald-700" bg="bg-emerald-50" />
        <StatCard icon={TrendingDown} label="Outstanding" value={fmt(totalOutstanding)} color="text-red-700" bg="bg-red-50" />
        <StatCard icon={BarChart3} label="Collection Rate" value={`${overallRate.toFixed(1)}%`} color="text-primary-700" bg="bg-primary-50" />
      </div>

      {/* Late payments warning */}
      {lateStudents > 0 && (
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-slate-900">{lateStudents} student(s) with overdue fees</p>
              <p className="text-xs text-slate-400">Total overdue: {fmt(lateTotalOverdue)}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Class-level summary */}
      <Card>
        <CardHeader><CardTitle>Collection by Class</CardTitle></CardHeader>
        <CardContent>
          {!classSummary || classSummary.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No class fee data available.</p>
          ) : (
            <div className="space-y-3">
              {classSummary.map((c) => (
                <div key={c.class_id} className="flex items-center gap-3">
                  <span className="w-40 text-sm text-slate-700 shrink-0 font-medium">{c.class_name}</span>
                  <div className="flex-1 h-5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${c.collection_percentage}%` }}
                    />
                  </div>
                  <span className="w-14 text-right text-xs font-medium text-slate-500">{c.collection_percentage.toFixed(0)}%</span>
                  <span className="w-24 text-right text-xs text-slate-400">{fmt(c.outstanding_balance)} due</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly revenue */}
      <Card>
        <CardHeader><CardTitle>Monthly Revenue (Last 12 Months)</CardTitle></CardHeader>
        <CardContent>
          {!monthlyRevenue || monthlyRevenue.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No revenue data available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="pb-2 pr-4 font-medium">Month</th>
                    <th className="pb-2 pr-4 font-medium text-right">Transactions</th>
                    <th className="pb-2 pr-4 font-medium text-right">Revenue</th>
                    <th className="pb-2 pr-4 font-medium text-right">Avg Transaction</th>
                    <th className="pb-2 font-medium text-right">Students Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyRevenue.map((m) => (
                    <tr key={m.month} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium text-slate-900">
                        {new Date(m.month).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
                      </td>
                      <td className="py-2 pr-4 text-right">{m.transaction_count}</td>
                      <td className="py-2 pr-4 text-right font-medium text-emerald-600">{fmt(m.total_revenue)}</td>
                      <td className="py-2 pr-4 text-right text-slate-500">{fmt(m.average_transaction)}</td>
                      <td className="py-2 text-right">{m.students_paid}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== HELPER ====================

function StatCard({ icon: Icon, label, value, color, bg }: {
  icon: React.ElementType; label: string; value: string; color: string; bg: string;
}) {
  return (
    <div className={`rounded-xl ${bg} px-4 py-4`}>
      <Icon className={`h-5 w-5 ${color} mb-2`} />
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}