import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { bursarService } from '@/services/bursarService';
import { registrarService } from '@/services/registrarService';
import { useNavigate } from 'react-router-dom';
import Breadcrumb from '@/components/shared/Breadcrumb';
import Button from '@/components/ui/Button';
import {
  DollarSign,
  CreditCard,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  FileText,
  ArrowRight,
  Layers,
  Users,
  Mail,
  Wifi,
} from 'lucide-react';

// ==================== STAT CARD ====================

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ElementType;
  color: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'slate';
  trend?: string;
}

const colorMap = {
  blue: { bg: 'bg-blue-50', icon: 'text-blue-600', value: 'text-blue-700' },
  green: { bg: 'bg-emerald-50', icon: 'text-emerald-600', value: 'text-emerald-700' },
  amber: { bg: 'bg-amber-50', icon: 'text-amber-600', value: 'text-amber-700' },
  red: { bg: 'bg-red-50', icon: 'text-red-600', value: 'text-red-700' },
  purple: { bg: 'bg-purple-50', icon: 'text-purple-600', value: 'text-purple-700' },
  slate: { bg: 'bg-slate-50', icon: 'text-slate-600', value: 'text-slate-700' },
};

function StatCard({ label, value, icon: Icon, color, trend }: StatCardProps) {
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

function formatCurrency(amount: number) {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ==================== MAIN COMPONENT ====================

export default function BursarDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const schoolId = user?.school_id ?? '';

  // Fetch current academic year from school settings (set by IT Admin)
  const { data: currentAcademicYear } = useFetch(
    ['school-setting-academic-year', schoolId],
    () => registrarService.getSetting(schoolId, 'current_academic_year'),
    { enabled: !!schoolId },
  );

  const { data: stats } = useFetch(
    ['bursar-stats', schoolId],
    () => bursarService.getDashboardStats(schoolId),
    { enabled: !!schoolId },
  );

  const { data: feeStructures } = useFetch(
    ['bursar-fee-structures', schoolId, currentAcademicYear ?? ''],
    () => bursarService.listFeeStructures(schoolId, currentAcademicYear || undefined),
    { enabled: !!schoolId },
  );

  const greeting = getGreeting();

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Finance' }]} />

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {greeting}, {user?.first_name || 'Bursar'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Finance Dashboard &mdash; Manage fees, payments, and financial reports.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" icon={<BarChart3 className="h-4 w-4" />} onClick={() => navigate('/reports/financial')}>
            Reports
          </Button>
          <Button size="sm" icon={<CreditCard className="h-4 w-4" />} onClick={() => navigate('/fees/payment')}>
            Record Payment
          </Button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Fee Structures"
          value={String(stats?.totalFeeStructures ?? 0)}
          icon={Layers}
          color="blue"
        />
        <StatCard
          label="Total Collected"
          value={formatCurrency(stats?.totalCollected ?? 0)}
          icon={DollarSign}
          color="green"
        />
        <StatCard
          label="Outstanding"
          value={formatCurrency(stats?.totalOutstanding ?? 0)}
          icon={AlertTriangle}
          color="red"
        />
        <StatCard
          label="Student Fees"
          value={String(stats?.totalStudentFees ?? 0)}
          icon={Users}
          color="purple"
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Application Fees', desc: 'Approve cash app. fee payments', icon: Users, path: '/bursar/application-fees' },
            { label: 'Record Payment', desc: 'Process a school fee payment', icon: CreditCard, path: '/fees/payment' },
            { label: 'Fee Structures', desc: 'Create & manage class fees', icon: Layers, path: '/bursar/fee-structures' },
            { label: 'Student Fees', desc: 'View all student fees', icon: DollarSign, path: '/fees' },
            { label: 'Payment History', desc: 'All transactions', icon: FileText, path: '/fees/history' },
            { label: 'Fee Letters', desc: 'Reminders & receipts', icon: Mail, path: '/letters' },
            { label: 'Kiosk Settings', desc: 'Set PIN for exam clearance kiosk', icon: Wifi, path: '/bursar/kiosk-settings' },
          ].map((action) => (
            <button
              key={action.label}
              onClick={() => navigate(action.path)}
              className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3.5 text-left hover:border-primary-200 hover:bg-primary-50/30 transition-all"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                <action.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">{action.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{action.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Fee Structures Overview */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">Fee Structures</h2>
          <button
            onClick={() => navigate('/bursar/fee-structures')}
            className="flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
          >
            Manage <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {!feeStructures || feeStructures.length === 0 ? (
          <div className="text-center py-8">
            <Layers className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-2 text-sm text-slate-400">No fee structures defined yet</p>
            <Button size="sm" className="mt-3" onClick={() => navigate('/bursar/fee-structures')}>
              Create Fee Structure
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-2 text-left font-medium text-slate-500">Fee Type</th>
                  <th className="pb-2 text-left font-medium text-slate-500">Class</th>
                  <th className="pb-2 text-left font-medium text-slate-500">Year</th>
                  <th className="pb-2 text-right font-medium text-slate-500">USD</th>
                  <th className="pb-2 text-right font-medium text-slate-500">LRD</th>
                  <th className="pb-2 text-left font-medium text-slate-500">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {feeStructures.slice(0, 10).map((fee) => (
                  <tr key={fee.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 capitalize text-slate-700 font-medium">{fee.fee_type}</td>
                    <td className="py-2.5 text-slate-600 font-medium">{fee.grade_level}</td>
                    <td className="py-2.5 text-slate-500">{fee.academic_year}</td>
                    <td className="py-2.5 text-right font-medium text-slate-800">{formatCurrency(fee.amount_usd)}</td>
                    <td className="py-2.5 text-right text-slate-600">
                      L${(fee.amount_lrd ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 text-xs text-slate-400">
                      {fee.due_date ? new Date(fee.due_date).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {feeStructures.length > 10 && (
              <p className="mt-2 text-xs text-slate-400 text-center">
                Showing 10 of {feeStructures.length} fee structures
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
