import { useState } from 'react';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { billingService } from '@/services/adminService';
import type { BillingInvoice, Subscription, PlatformPayment } from '@/types/report.types';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Card } from '@/components/ui/Card';
import Dialog, { DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/Dialog';
import { notify } from '@/components/shared/Toast';
import { DollarSign, FileText, Clock, CheckCircle, Eye, Ban } from 'lucide-react';

type Tab = 'invoices' | 'subscriptions' | 'payments';
type StatusFilter = 'all' | BillingInvoice['status'];

function fmt(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);
}

const statusVariant = (s: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  switch (s) {
    case 'paid': case 'active': return 'success';
    case 'sent': case 'trial': return 'info';
    case 'overdue': case 'suspended': case 'cancelled': return 'danger';
    case 'draft': case 'grace': return 'default';
    case 'void': case 'archived': return 'warning';
    default: return 'default';
  }
};

export default function BillingCenter() {
  const [tab, setTab] = useState<Tab>('invoices');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [viewInvoice, setViewInvoice] = useState<BillingInvoice | null>(null);
  const [voidTarget, setVoidTarget] = useState<BillingInvoice | null>(null);

  const { data: invoices = [], isLoading: loadingInv } = useFetch<BillingInvoice[]>(
    ['admin-invoices'],
    () => billingService.listInvoices()
  );

  const { data: subscriptions = [], isLoading: loadingSubs } = useFetch<Subscription[]>(
    ['admin-subscriptions'],
    () => billingService.listSubscriptions()
  );

  const { data: platformPayments = [], isLoading: loadingPayments } = useFetch<(PlatformPayment & { schools?: { name: string } })[]>(
    ['admin-platform-payments'],
    () => billingService.listPlatformPayments()
  );

  const markPaidMutation = useMutate(
    (id: string) => billingService.updateInvoiceStatus(id, 'paid'),
    [['admin-invoices']]
  );

  const voidMutation = useMutate(
    (id: string) => billingService.voidInvoice(id),
    [['admin-invoices']]
  );

  const handleMarkPaid = (inv: BillingInvoice) => {
    markPaidMutation.mutate(inv.id, {
      onSuccess: () => notify.success(`Invoice ${inv.invoice_number} marked as paid`),
      onError: () => notify.error('Failed to update invoice'),
    });
  };

  const handleVoid = () => {
    if (!voidTarget) return;
    voidMutation.mutate(voidTarget.id, {
      onSuccess: () => { notify.success(`Invoice ${voidTarget.invoice_number} voided`); setVoidTarget(null); },
      onError: () => notify.error('Failed to void invoice'),
    });
  };

  const filteredInvoices = statusFilter === 'all' ? invoices : invoices.filter((i) => i.status === statusFilter);
  const totalRevenue = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.amount_usd, 0);
  const paidCount = invoices.filter((i) => i.status === 'paid').length;
  const overdueCount = invoices.filter((i) => i.status === 'overdue').length;
  const pendingCount = invoices.filter((i) => i.status === 'sent' || i.status === 'draft').length;

  const invoiceColumns: Column<BillingInvoice>[] = [
    {
      key: 'invoice_number',
      header: 'Invoice',
      render: (row) => <span className="font-mono text-sm">{row.invoice_number}</span>,
    },
    {
      key: 'amount_usd',
      header: 'Amount',
      render: (row) => (
        <div>
          <p className="font-semibold">{fmt(row.amount_usd)}</p>
          {row.amount_lrd > 0 && <p className="text-xs text-gray-500">LRD {row.amount_lrd.toLocaleString()}</p>}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge variant={statusVariant(row.status)}>{row.status}</Badge>,
    },
    {
      key: 'due_date',
      header: 'Due Date',
      render: (row) => new Date(row.due_date).toLocaleDateString(),
    },
    {
      key: 'paid_at',
      header: 'Paid At',
      render: (row) => (row.paid_at ? new Date(row.paid_at).toLocaleDateString() : '—'),
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (row) => new Date(row.created_at).toLocaleDateString(),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setViewInvoice(row)}>
            <Eye className="w-4 h-4" />
          </Button>
          {row.status !== 'paid' && row.status !== 'void' && (
            <>
              <Button variant="ghost" size="sm" onClick={() => handleMarkPaid(row)}>
                <CheckCircle className="w-4 h-4 text-green-600" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setVoidTarget(row)}>
                <Ban className="w-4 h-4 text-red-500" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  const paymentColumns: Column<PlatformPayment & { schools?: { name: string } }>[] = [
    {
      key: 'created_at',
      header: 'Date',
      render: (row) => new Date(row.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
    },
    {
      key: 'schools',
      header: 'School',
      render: (row) => <span className="text-sm font-medium">{row.schools?.name ?? row.school_id.slice(0, 8) + '…'}</span>,
    },
    {
      key: 'amount_usd',
      header: 'Amount',
      render: (row) => <span className="font-semibold text-green-700">{fmt(row.amount_usd)}</span>,
    },
    {
      key: 'payment_method',
      header: 'Method',
      render: (row) => <Badge variant="outline">{row.payment_method}</Badge>,
    },
    {
      key: 'gateway_ref',
      header: 'Gateway Ref',
      render: (row) => <span className="font-mono text-xs text-gray-400">{row.gateway_ref ?? '—'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge variant={row.status === 'success' ? 'success' : row.status === 'failed' ? 'danger' : 'default'}>{row.status}</Badge>,
    },
  ];

  const subColumns: Column<Subscription>[] = [
    { key: 'school_id', header: 'School ID', render: (row) => <span className="font-mono text-xs">{row.school_id.slice(0, 8)}...</span> },
    { key: 'plan_id', header: 'Plan ID', render: (row) => <span className="font-mono text-xs">{row.plan_id.slice(0, 8)}...</span> },
    { key: 'status', header: 'Status', render: (row) => <Badge variant={statusVariant(row.status)}>{row.status}</Badge> },
    { key: 'started_at', header: 'Started', render: (row) => new Date(row.started_at).toLocaleDateString() },
    { key: 'expires_at', header: 'Expires', render: (row) => new Date(row.expires_at).toLocaleDateString() },
    { key: 'auto_renew', header: 'Auto-Renew', render: (row) => row.auto_renew ? <Badge variant="success">Yes</Badge> : <span className="text-gray-400">No</span> },
    { key: 'payment_method', header: 'Payment', render: (row) => row.payment_method ? <Badge variant="outline">{row.payment_method}</Badge> : '—' },
  ];

  const tabClass = (t: Tab) => `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === t ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`;

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Admin', href: '/admin' }, { label: 'Billing Center' }]} />

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Billing Center</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage invoices, subscriptions, and track platform revenue.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 text-green-600"><DollarSign className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-gray-500">Total Revenue</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{fmt(totalRevenue)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-600"><CheckCircle className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-gray-500">Paid Invoices</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{paidCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100 text-red-600"><FileText className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-gray-500">Overdue</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{overdueCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-600"><Clock className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{pendingCount}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-2">
        <button className={tabClass('invoices')} onClick={() => setTab('invoices')}>
          Invoices {invoices.length > 0 && <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-xs">{invoices.length}</span>}
        </button>
        <button className={tabClass('payments')} onClick={() => setTab('payments')}>
          Payments {platformPayments.length > 0 && <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-xs">{platformPayments.length}</span>}
        </button>
        <button className={tabClass('subscriptions')} onClick={() => setTab('subscriptions')}>Subscriptions</button>
      </div>

      {tab === 'invoices' && (
        <>
          {/* Status filter */}
          <div className="flex items-center gap-2 flex-wrap">
            {(['all', 'draft', 'sent', 'paid', 'overdue', 'void'] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                  statusFilter === s ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                {s !== 'all' && ` (${invoices.filter((i) => i.status === s).length})`}
              </button>
            ))}
          </div>
          <Table<BillingInvoice>
            columns={invoiceColumns}
            data={filteredInvoices}
            keyExtractor={(r) => r.id}
            loading={loadingInv}
            emptyMessage="No invoices found."
          />
        </>
      )}

      {tab === 'payments' && (
        <>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="font-semibold text-gray-800">{platformPayments.length}</span> platform payments recorded.
            <span className="ml-auto font-semibold text-green-700">
              Total: {fmt(platformPayments.filter((p) => p.status === 'success').reduce((s, p) => s + p.amount_usd, 0))}
            </span>
          </div>
          <Table<PlatformPayment & { schools?: { name: string } }>
            columns={paymentColumns}
            data={platformPayments}
            keyExtractor={(r) => r.id}
            loading={loadingPayments}
            emptyMessage="No payment records found. Payments are recorded here after a successful Flutterwave transaction."
          />
        </>
      )}

      {tab === 'subscriptions' && (
        <Table<Subscription>
          columns={subColumns}
          data={subscriptions}
          keyExtractor={(r) => r.id}
          loading={loadingSubs}
          emptyMessage="No subscriptions found."
        />
      )}

      {/* ===== VIEW INVOICE MODAL ===== */}
      <Dialog open={!!viewInvoice} onClose={() => setViewInvoice(null)} className="max-w-md">
        <DialogHeader onClose={() => setViewInvoice(null)}>
          <DialogTitle>Invoice Details</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {viewInvoice && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Invoice #</span><span className="font-mono">{viewInvoice.invoice_number}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Amount (USD)</span><span className="font-semibold">{fmt(viewInvoice.amount_usd)}</span></div>
              {viewInvoice.amount_lrd > 0 && <div className="flex justify-between"><span className="text-gray-500">Amount (LRD)</span><span>LRD {viewInvoice.amount_lrd.toLocaleString()}</span></div>}
              <div className="flex justify-between"><span className="text-gray-500">Status</span><Badge variant={statusVariant(viewInvoice.status)}>{viewInvoice.status}</Badge></div>
              <div className="flex justify-between"><span className="text-gray-500">Due Date</span><span>{new Date(viewInvoice.due_date).toLocaleDateString()}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Paid At</span><span>{viewInvoice.paid_at ? new Date(viewInvoice.paid_at).toLocaleDateString() : '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Created</span><span>{new Date(viewInvoice.created_at).toLocaleDateString()}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">School ID</span><span className="font-mono text-xs">{viewInvoice.school_id}</span></div>
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setViewInvoice(null)}>Close</Button>
        </DialogFooter>
      </Dialog>

      {/* ===== VOID CONFIRM ===== */}
      <Dialog open={!!voidTarget} onClose={() => setVoidTarget(null)} className="max-w-sm">
        <DialogHeader onClose={() => setVoidTarget(null)}>
          <DialogTitle>Void Invoice</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p className="text-sm text-gray-600">
            Are you sure you want to void invoice <strong>{voidTarget?.invoice_number}</strong>? This cannot be undone.
          </p>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setVoidTarget(null)}>Cancel</Button>
          <Button variant="danger" size="sm" loading={voidMutation.isPending} onClick={handleVoid}>Void Invoice</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
