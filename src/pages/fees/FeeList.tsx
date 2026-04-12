import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { studentFeeService } from '@/services/feeService';
import { registrarService } from '@/services/registrarService';
import { FEE_TYPES } from '@/utils/constants';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Pagination from '@/components/ui/Pagination';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { DollarSign, CreditCard } from 'lucide-react';

type FeeRow = {
  id: string;
  studentName: string;
  studentId: string | null;
  feeType: string;
  gradeLevel: string;
  amountDue: number;
  amountPaid: number;
  balance: number;
  status: string;
  dueDate: string;
};

const feeTypeOptions = Object.entries(FEE_TYPES).map(([, v]) => ({
  label: v.charAt(0).toUpperCase() + v.slice(1),
  value: v,
}));

const statusOptions = [
  { label: 'Pending', value: 'pending' },
  { label: 'Partial', value: 'partial' },
  { label: 'Paid', value: 'paid' },
  { label: 'Overdue', value: 'overdue' },
];

function statusVariant(status: string) {
  if (status === 'paid') return 'success' as const;
  if (status === 'partial') return 'warning' as const;
  if (status === 'overdue') return 'danger' as const;
  return 'default' as const;
}

function formatCurrency(amount: number) {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function FeeList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ feeType: '', status: '' });

  // Fetch current academic year from school settings (set by IT Admin)
  const { data: currentAcademicYear } = useFetch(
    ['school-setting-academic-year', schoolId],
    () => registrarService.getSetting(schoolId, 'current_academic_year'),
    { enabled: !!schoolId },
  );

  const { data: result, isLoading } = useFetch(
    ['student-fees', schoolId, String(page), JSON.stringify(filters), currentAcademicYear ?? ''],
    () =>
      studentFeeService.list(schoolId, {
        page,
        pageSize: 25,
        feeType: (filters.feeType as 'tuition') || undefined,
        status: (filters.status as 'pending') || undefined,
        academicYear: currentAcademicYear || undefined,
      }),
    { enabled: !!schoolId },
  );

  const rows: FeeRow[] = (result?.data ?? []).map((f) => {
    const student = f.students as Record<string, string> | undefined;
    const structure = f.fee_structures as Record<string, string> | undefined;
    return {
      id: f.id,
      studentName: student ? `${student.first_name} ${student.last_name}` : '',
      studentId: student?.registration_number ?? null,
      feeType: structure?.fee_type ?? '',
      gradeLevel: structure?.grade_level ?? '',
      amountDue: f.amount_due,
      amountPaid: f.amount_paid,
      balance: f.balance,
      status: f.status,
      dueDate: f.due_date,
    };
  });

  const totalPages = Math.ceil((result?.count ?? 0) / 25);

  const columns: Column<FeeRow>[] = [
    {
      key: 'studentName', header: 'Student', render: (r) => (
        <div>
          <p className="font-medium text-slate-900">{r.studentName}</p>
          {r.studentId && <p className="text-xs text-slate-400">{r.studentId}</p>}
        </div>
      ),
    },
    {
      key: 'feeType', header: 'Fee Type', render: (r) => (
        <span className="text-sm capitalize">{r.feeType}</span>
      ),
    },
    { key: 'gradeLevel', header: 'Grade' },
    {
      key: 'amountDue', header: 'Due', render: (r) => (
        <span className="font-medium">{formatCurrency(r.amountDue)}</span>
      ),
    },
    {
      key: 'amountPaid', header: 'Paid', render: (r) => (
        <span className="text-emerald-600">{formatCurrency(r.amountPaid)}</span>
      ),
    },
    {
      key: 'balance', header: 'Balance', render: (r) => (
        <span className={`font-semibold ${r.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
          {formatCurrency(r.balance)}
        </span>
      ),
    },
    {
      key: 'status', header: 'Status', render: (r) => (
        <Badge variant={statusVariant(r.status)} size="sm">{r.status}</Badge>
      ),
    },
    {
      key: 'dueDate', header: 'Due Date', render: (r) => (
        <span className="text-sm text-slate-500">{r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '—'}</span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Fees' }]} />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Student Fees</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/fees/history')}>
            <DollarSign className="h-4 w-4 mr-1" /> Payment History
          </Button>
          <Button size="sm" onClick={() => navigate('/fees/payment')}>
            <CreditCard className="h-4 w-4 mr-1" /> Record Payment
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select
          label="Fee Type"
          options={feeTypeOptions}
          value={filters.feeType}
          onChange={(e) => { setFilters((f) => ({ ...f, feeType: e.target.value })); setPage(1); }}
          placeholder="All Types"
          className="w-44"
        />
        <Select
          label="Status"
          options={statusOptions}
          value={filters.status}
          onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setPage(1); }}
          placeholder="All Statuses"
          className="w-40"
        />
      </div>

      <Table columns={columns} data={rows} keyExtractor={(r) => r.id} loading={isLoading} emptyMessage="No fees found." />

      {totalPages > 1 && <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />}
    </div>
  );
}