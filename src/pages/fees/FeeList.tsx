import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { studentFeeService } from '@/services/feeService';
import { feeInstallmentService } from '@/services/bursarService';
import { registrarService } from '@/services/registrarService';
import { FEE_TYPES, USER_ROLES } from '@/utils/constants';
import type { UserRole } from '@/utils/constants';
import type { StudentFeeInstallment } from '@/types/fee.types';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Pagination from '@/components/ui/Pagination';
import Dialog, { DialogHeader, DialogTitle, DialogBody } from '@/components/ui/Dialog';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { DollarSign, CreditCard, CalendarDays, Search } from 'lucide-react';

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
  hasInstallments: boolean;
};

const feeTypeOptions = Object.entries(FEE_TYPES).map(([, v]) => ({
  label: v.charAt(0).toUpperCase() + v.slice(1),
  value: v,
}));

const statusOptions = [
  { label: 'Pending',  value: 'pending' },
  { label: 'Partial',  value: 'partial' },
  { label: 'Paid',     value: 'paid' },
  { label: 'Overdue',  value: 'overdue' },
];

function statusVariant(status: string) {
  if (status === 'paid')    return 'success' as const;
  if (status === 'partial') return 'warning' as const;
  if (status === 'overdue') return 'danger' as const;
  return 'default' as const;
}

function installmentStatusVariant(status: string) {
  if (status === 'paid')    return 'success' as const;
  if (status === 'partial') return 'warning' as const;
  if (status === 'overdue') return 'danger' as const;
  return 'default' as const;
}

function formatCurrency(amount: number) {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Roles that can access payment recording
const PAYMENT_ROLES: UserRole[] = [
  USER_ROLES.BURSAR, USER_ROLES.ADMIN_STAFF, USER_ROLES.IT_ADMIN,
  USER_ROLES.PRINCIPAL, USER_ROLES.VICE_PRINCIPAL,
];

export default function FeeList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';
  const userRole = (user?.role ?? '') as UserRole;
  const canRecordPayment = PAYMENT_ROLES.includes(userRole);

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ feeType: '', status: '' });
  const [studentSearch, setStudentSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedYear, setSelectedYear] = useState('');

  // Term installments dialog
  const [installmentFee, setInstallmentFee] = useState<FeeRow | null>(null);
  const [installments, setInstallments] = useState<StudentFeeInstallment[]>([]);
  const [installmentsLoading, setInstallmentsLoading] = useState(false);

  // Debounce student search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(studentSearch); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [studentSearch]);

  // Academic years from school settings
  const { data: currentAcademicYear } = useFetch(
    ['school-setting-academic-year', schoolId],
    () => registrarService.getSetting(schoolId, 'current_academic_year'),
    { enabled: !!schoolId },
  );
  const { data: nextAcademicYear } = useFetch(
    ['school-setting-next-academic-year', schoolId],
    () => registrarService.getSetting(schoolId, 'next_academic_year'),
    { enabled: !!schoolId },
  );

  // selectedYear = '' means All Years (default — shows complete history)
  const activeYear = selectedYear;

  const yearOptions = [
    { label: 'All Years', value: '' },
    currentAcademicYear ? { label: `${currentAcademicYear} (Current)`, value: currentAcademicYear as string } : null,
    nextAcademicYear    ? { label: `${nextAcademicYear} (Next)`,    value: nextAcademicYear as string }    : null,
  ].filter(Boolean) as { label: string; value: string }[];

  const { data: result, isLoading } = useFetch(
    ['student-fees', schoolId, String(page), JSON.stringify(filters), activeYear, debouncedSearch],
    () =>
      studentFeeService.list(schoolId, {
        page,
        pageSize: 25,
        feeType:       (filters.feeType as 'tuition') || undefined,
        status:        (filters.status as 'pending') || undefined,
        academicYear:  activeYear || undefined,
        studentSearch: debouncedSearch || undefined,
      }),
    { enabled: !!schoolId },
  );

  const rows: FeeRow[] = (result?.data ?? []).map((f) => {
    const student   = f.students   as Record<string, string> | undefined;
    const structure = f.fee_structures as Record<string, unknown> | undefined;
    return {
      id:              f.id,
      studentName:     student ? `${student.first_name} ${student.last_name}` : '',
      studentId:       student?.registration_number ?? null,
      feeType:         String(structure?.fee_type ?? ''),
      gradeLevel:      String(structure?.grade_level ?? ''),
      amountDue:       f.amount_due,
      amountPaid:      f.amount_paid,
      balance:         f.balance,
      status:          f.status,
      dueDate:         f.due_date,
      hasInstallments: Boolean((structure as Record<string, unknown> | undefined)?.has_installments ?? false),
    };
  });

  const totalPages = Math.ceil((result?.count ?? 0) / 25);

  const openInstallments = async (row: FeeRow) => {
    setInstallmentFee(row);
    setInstallments([]);
    setInstallmentsLoading(true);
    try {
      const data = await feeInstallmentService.getForStudentFee(row.id);
      setInstallments(data);
    } finally {
      setInstallmentsLoading(false);
    }
  };

  // Determine active term: first unpaid/partial installment
  const activeTermId = installments.find((i) => i.status !== 'paid')?.id ?? null;

  const columns: Column<FeeRow>[] = [
    {
      key: 'studentName', header: 'Student',
      render: (r) => (
        <div>
          <p className="font-medium text-slate-900">{r.studentName}</p>
          {r.studentId && <p className="text-xs text-slate-400">{r.studentId}</p>}
        </div>
      ),
    },
    {
      key: 'feeType', header: 'Fee Type',
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <span className="text-sm capitalize">{r.feeType}</span>
          {r.hasInstallments && (
            <Badge variant="info" size="sm" className="flex items-center gap-0.5">
              <CalendarDays className="h-2.5 w-2.5" /> Terms
            </Badge>
          )}
        </div>
      ),
    },
    { key: 'gradeLevel', header: 'Grade' },
    {
      key: 'amountDue', header: 'Annual Fee',
      render: (r) => <span className="font-medium">{formatCurrency(r.amountDue)}</span>,
    },
    {
      key: 'amountPaid', header: 'Paid',
      render: (r) => <span className="text-emerald-600">{formatCurrency(r.amountPaid)}</span>,
    },
    {
      key: 'balance', header: 'Balance',
      render: (r) => (
        <span className={`font-semibold ${r.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
          {formatCurrency(r.balance)}
        </span>
      ),
    },
    {
      key: 'status', header: 'Status',
      render: (r) => <Badge variant={statusVariant(r.status)} size="sm">{r.status}</Badge>,
    },
    {
      key: 'dueDate', header: 'Due Date',
      render: (r) => (
        <span className="text-sm text-slate-500">
          {r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '—'}
        </span>
      ),
    },
    {
      key: 'actions', header: '',
      render: (r) =>
        r.hasInstallments ? (
          <button
            onClick={() => void openInstallments(r)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-violet-600 hover:bg-violet-50 transition-colors border border-violet-200"
            title="View term-by-term breakdown"
          >
            <CalendarDays className="h-3.5 w-3.5" /> View Terms
          </button>
        ) : null,
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
          {canRecordPayment && (
            <Button size="sm" onClick={() => navigate('/fees/payment')}>
              <CreditCard className="h-4 w-4 mr-1" /> Record Payment
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        {/* Student search */}
        <div className="w-56">
          <label className="block text-xs font-medium text-slate-600 mb-1">Search Student</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="Name or reg number..."
              className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-sm focus:border-primary-400 focus:outline-none"
            />
          </div>
        </div>
        {/* Academic year selector */}
        <div className="w-48">
          <label className="block text-xs font-medium text-slate-600 mb-1">Academic Year</label>
          <select
            value={selectedYear}
            onChange={(e) => { setSelectedYear(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
          >
            {yearOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
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

      <Table
        columns={columns}
        data={rows}
        keyExtractor={(r) => r.id}
        loading={isLoading}
        emptyMessage="No fees found."
      />

      {totalPages > 1 && <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />}

      {/* ── Term Installments Dialog ── */}
      <Dialog open={!!installmentFee} onClose={() => setInstallmentFee(null)}>
        <DialogHeader>
          <DialogTitle>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-violet-600" />
              Term Breakdown
            </div>
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {installmentFee && (
            <>
              {/* Fee summary */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-sm font-semibold text-slate-800">{installmentFee.studentName}</p>
                <p className="text-xs text-slate-500 capitalize mt-0.5">
                  {installmentFee.feeType} · Grade {installmentFee.gradeLevel}
                </p>
                <div className="mt-2 flex gap-4 text-xs">
                  <span>Annual fee: <strong>{formatCurrency(installmentFee.amountDue)}</strong></span>
                  <span className="text-emerald-600">Paid: <strong>{formatCurrency(installmentFee.amountPaid)}</strong></span>
                  <span className={installmentFee.balance > 0 ? 'text-red-600' : 'text-emerald-600'}>
                    Balance: <strong>{formatCurrency(installmentFee.balance)}</strong>
                  </span>
                </div>
              </div>

              {installmentsLoading ? (
                <div className="py-8 text-center text-sm text-slate-400">Loading term breakdown…</div>
              ) : installments.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No installment records found.</p>
              ) : (
                <div className="space-y-2">
                  {installments.map((inst) => {
                    const isActive = inst.id === activeTermId;
                    return (
                      <div
                        key={inst.id}
                        className={`rounded-lg border px-4 py-3 ${
                          isActive
                            ? 'border-violet-200 bg-violet-50'
                            : inst.status === 'paid'
                              ? 'border-emerald-100 bg-emerald-50'
                              : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-slate-800">{inst.term_name}</span>
                            {isActive && (
                              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700 uppercase tracking-wide">
                                Current Term
                              </span>
                            )}
                          </div>
                          <Badge variant={installmentStatusVariant(inst.status)} size="sm">
                            {inst.status === 'paid' ? '✓ Clear' : inst.status}
                          </Badge>
                        </div>

                        <div className="mt-2 grid grid-cols-3 gap-3 text-xs">
                          <div>
                            <p className="text-slate-500">Term Amount</p>
                            <p className="font-semibold text-slate-800">{formatCurrency(inst.amount_due)}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Paid</p>
                            <p className={`font-semibold ${inst.amount_paid > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {formatCurrency(inst.amount_paid)}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-500">Balance</p>
                            <p className={`font-semibold ${inst.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                              {formatCurrency(inst.balance)}
                            </p>
                          </div>
                        </div>

                        <p className="mt-1.5 text-xs text-slate-400">
                          Due: {inst.due_date ? new Date(inst.due_date).toLocaleDateString() : '—'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Reminder for non-bursar users */}
              {!canRecordPayment && installmentFee.balance > 0 && (
                <p className="text-xs text-slate-500 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  To make a payment, please visit the school finance office. You may pay the current term amount or the full annual balance.
                </p>
              )}
            </>
          )}
        </DialogBody>
      </Dialog>
    </div>
  );
}
