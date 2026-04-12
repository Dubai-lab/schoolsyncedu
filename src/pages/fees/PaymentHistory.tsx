import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { paymentService, invoiceService } from '@/services/feeService';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Select from '@/components/ui/Select';
import Input from '@/components/ui/Input';
import Pagination from '@/components/ui/Pagination';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Receipt, FileText } from 'lucide-react';

type Tab = 'payments' | 'invoices';

type PaymentRow = {
  id: string;
  studentName: string;
  amountUsd: number;
  amountLrd: number;
  currency: string;
  method: string;
  status: string;
  ref: string | null;
  date: string;
};

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  studentName: string;
  amount: number;
  status: string;
  issuedDate: string;
  dueDate: string;
};

const statusOptions = [
  { label: 'Success',  value: 'success'  },
  { label: 'Pending',  value: 'pending'  },
  { label: 'Failed',   value: 'failed'   },
  { label: 'Refunded', value: 'refunded' },
];

function payStatusVariant(s: string) {
  if (s === 'success')  return 'success' as const;
  if (s === 'pending')  return 'warning' as const;
  if (s === 'failed')   return 'danger'  as const;
  return 'info' as const;
}

function invStatusVariant(s: string) {
  if (s === 'paid')    return 'success' as const;
  if (s === 'sent')    return 'warning' as const;
  if (s === 'overdue') return 'danger'  as const;
  return 'default' as const;
}

function fmt(amount: number) {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PaymentHistory() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const [activeTab, setActiveTab] = useState<Tab>('payments');
  const [page,      setPage]      = useState(1);
  const [filters,   setFilters]   = useState({ status: '', dateFrom: '', dateTo: '' });

  // ── Payments query ─────────────────────────────────────────────────────────
  const { data: result, isLoading: paymentsLoading } = useFetch(
    ['payments', schoolId, String(page), JSON.stringify(filters)],
    () =>
      paymentService.list(schoolId, {
        page,
        pageSize: 25,
        status:   filters.status   || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo:   filters.dateTo   || undefined,
      }),
    { enabled: !!schoolId },
  );

  // ── Invoices query ─────────────────────────────────────────────────────────
  const { data: invoiceResult, isLoading: invoicesLoading } = useFetch(
    ['invoices', schoolId],
    () => invoiceService.list(schoolId),
    { enabled: !!schoolId && activeTab === 'invoices' },
  );

  // ── Map data ───────────────────────────────────────────────────────────────
  const paymentRows: PaymentRow[] = (result?.data ?? []).map((p) => {
    const student = p.students as Record<string, string> | undefined;
    return {
      id:          p.id,
      studentName: student ? `${student.first_name} ${student.last_name}` : '',
      amountUsd:   p.amount_usd,
      amountLrd:   p.amount_lrd,
      currency:    p.currency_charged,
      method:      p.payment_method,
      status:      p.status,
      ref:         p.gateway_ref,
      date:        p.payment_date,
    };
  });

  const invoiceRows: InvoiceRow[] = (invoiceResult?.data ?? []).map((inv) => {
    const student = inv.students as Record<string, string> | undefined;
    return {
      id:            inv.id,
      invoiceNumber: inv.invoice_number,
      studentName:   student ? `${student.first_name} ${student.last_name}` : '—',
      amount:        inv.total_amount,
      status:        inv.status,
      issuedDate:    inv.issued_date,
      dueDate:       inv.due_date,
    };
  });

  const totalPages    = Math.ceil((result?.count ?? 0) / 25);
  const totalReceived = paymentRows.reduce((s, r) => s + (r.status === 'success' ? r.amountUsd : 0), 0);

  // ── Columns ────────────────────────────────────────────────────────────────
  const paymentColumns: Column<PaymentRow>[] = [
    {
      key: 'date', header: 'Date',
      render: (r) => <span className="text-sm">{new Date(r.date).toLocaleDateString()}</span>,
    },
    { key: 'studentName', header: 'Student' },
    {
      key: 'amountUsd', header: 'Amount',
      render: (r) => (
        <div>
          <span className="font-medium">{r.currency === 'USD' ? fmt(r.amountUsd) : `L$${r.amountLrd.toLocaleString()}`}</span>
          <span className="ml-1 text-xs text-slate-400">{r.currency}</span>
        </div>
      ),
    },
    {
      key: 'method', header: 'Method',
      render: (r) => (
        <span className="text-sm capitalize">
          {r.method === 'visa'   ? 'Card (Online)' :
           r.method === 'manual' ? 'Cash'          : r.method}
        </span>
      ),
    },
    {
      key: 'status', header: 'Status',
      render: (r) => <Badge variant={payStatusVariant(r.status)} size="sm">{r.status}</Badge>,
    },
    {
      key: 'ref', header: 'Reference',
      render: (r) => (
        <span className="text-xs text-slate-400 font-mono max-w-[160px] block truncate">
          {r.ref?.split(' | ')[0] || '—'}
        </span>
      ),
    },
  ];

  const invoiceColumns: Column<InvoiceRow>[] = [
    {
      key: 'invoiceNumber', header: 'Invoice #',
      render: (r) => <span className="font-mono font-semibold text-blue-600">{r.invoiceNumber}</span>,
    },
    { key: 'studentName', header: 'Student' },
    {
      key: 'issuedDate', header: 'Issued',
      render: (r) => <span className="text-sm">{new Date(r.issuedDate).toLocaleDateString()}</span>,
    },
    {
      key: 'dueDate', header: 'Due Date',
      render: (r) => <span className="text-sm">{new Date(r.dueDate).toLocaleDateString()}</span>,
    },
    {
      key: 'amount', header: 'Amount',
      render: (r) => <span className="font-semibold text-slate-800">{fmt(r.amount)}</span>,
    },
    {
      key: 'status', header: 'Status',
      render: (r) => <Badge variant={invStatusVariant(r.status)} size="sm">{r.status}</Badge>,
    },
  ];

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Fees', href: '/fees' }, { label: 'Payment History' }]} />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Payment History</h1>
        {activeTab === 'payments' && totalReceived > 0 && (
          <div className="text-sm text-slate-500">
            Total received: <span className="font-semibold text-emerald-600">{fmt(totalReceived)}</span>
          </div>
        )}
        {activeTab === 'invoices' && (
          <div className="text-sm text-slate-500">
            {invoiceRows.length} invoice{invoiceRows.length !== 1 ? 's' : ''} — including online payments from student portal
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-slate-200">
        {([
          { id: 'payments', label: 'Payments',        icon: Receipt,   count: result?.count ?? 0 },
          { id: 'invoices', label: 'Student Invoices', icon: FileText,  count: invoiceResult?.count ?? 0 },
        ] as { id: Tab; label: string; icon: React.ElementType; count: number }[]).map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
            {count > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${
                activeTab === id ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
              }`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Payments tab ── */}
      {activeTab === 'payments' && (
        <>
          <div className="flex flex-wrap gap-3">
            <Select
              label="Status"
              options={statusOptions}
              value={filters.status}
              onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setPage(1); }}
              placeholder="All Statuses"
              className="w-40"
            />
            <Input label="From" type="date" value={filters.dateFrom}
              onChange={(e) => { setFilters((f) => ({ ...f, dateFrom: e.target.value })); setPage(1); }}
              className="w-40"
            />
            <Input label="To" type="date" value={filters.dateTo}
              onChange={(e) => { setFilters((f) => ({ ...f, dateTo: e.target.value })); setPage(1); }}
              className="w-40"
            />
          </div>
          <Table
            columns={paymentColumns}
            data={paymentRows}
            keyExtractor={(r) => r.id}
            loading={paymentsLoading}
            emptyMessage="No payments found."
          />
          {totalPages > 1 && (
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          )}
        </>
      )}

      {/* ── Invoices tab ── */}
      {activeTab === 'invoices' && (
        <Table
          columns={invoiceColumns}
          data={invoiceRows}
          keyExtractor={(r) => r.id}
          loading={invoicesLoading}
          emptyMessage="No invoices found. Invoices are created when students pay online through their portal."
        />
      )}
    </div>
  );
}
