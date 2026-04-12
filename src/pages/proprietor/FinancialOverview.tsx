import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import {
  proprietorDashboardService,
  proprietorBillingService,
} from '@/services/proprietorService';
import type { BillingInvoice, PlatformPayment } from '@/types/report.types';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Card } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import {
  DollarSign,
  TrendingUp,
  FileText,
  CreditCard,
} from 'lucide-react';

type Tab = 'invoices' | 'payments';

export default function FinancialOverview() {
  const { user } = useAuth();
  const schoolId = user?.school_id;
  const [tab, setTab] = useState<Tab>('invoices');

  const { data: revenue = 0 } = useFetch<number>(
    ['prop-revenue', schoolId!],
    () => proprietorDashboardService.getSchoolRevenue(schoolId!),
    { enabled: !!schoolId }
  );

  const { data: invoices = [], isLoading: loadingInv } = useFetch<BillingInvoice[]>(
    ['prop-invoices', schoolId!],
    () => proprietorBillingService.getInvoices(schoolId!),
    { enabled: !!schoolId }
  );

  const { data: payments = [], isLoading: loadingPay } = useFetch<PlatformPayment[]>(
    ['prop-payments', schoolId!],
    () => proprietorBillingService.getPayments(schoolId!),
    { enabled: !!schoolId }
  );

  const totalPaid = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.amount_usd, 0);
  const totalDue = invoices.filter((i) => i.status === 'sent' || i.status === 'overdue').reduce((s, i) => s + i.amount_usd, 0);

  const invStatusVariant = (s: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
    switch (s) {
      case 'paid': return 'success';
      case 'sent': return 'info';
      case 'overdue': return 'danger';
      case 'void': return 'default';
      default: return 'warning';
    }
  };

  const payStatusVariant = (s: string): 'success' | 'danger' | 'warning' | 'info' => {
    switch (s) {
      case 'success': return 'success';
      case 'failed': return 'danger';
      case 'pending': return 'warning';
      case 'refunded': return 'info';
      default: return 'info';
    }
  };

  const invoiceColumns: Column<BillingInvoice>[] = [
    { key: 'invoice_number', header: 'Invoice', render: (r) => <span className="font-mono text-sm">{r.invoice_number}</span> },
    { key: 'amount_usd', header: 'Amount (USD)', render: (r) => `$${r.amount_usd.toLocaleString()}` },
    { key: 'amount_lrd', header: 'Amount (LRD)', render: (r) => r.amount_lrd ? `L$${r.amount_lrd.toLocaleString()}` : '—' },
    { key: 'status', header: 'Status', render: (r) => <Badge variant={invStatusVariant(r.status)}>{r.status}</Badge> },
    { key: 'due_date', header: 'Due', render: (r) => new Date(r.due_date).toLocaleDateString() },
    { key: 'paid_at', header: 'Paid', render: (r) => r.paid_at ? new Date(r.paid_at).toLocaleDateString() : '—' },
  ];

  const paymentColumns: Column<PlatformPayment>[] = [
    { key: 'amount_usd', header: 'Amount (USD)', render: (r) => `$${r.amount_usd.toLocaleString()}` },
    { key: 'amount_lrd', header: 'Amount (LRD)', render: (r) => r.amount_lrd ? `L$${r.amount_lrd.toLocaleString()}` : '—' },
    { key: 'currency_charged', header: 'Currency', render: (r) => <Badge variant="outline">{r.currency_charged}</Badge> },
    { key: 'payment_method', header: 'Method', render: (r) => <span className="capitalize text-sm">{r.payment_method}</span> },
    { key: 'status', header: 'Status', render: (r) => <Badge variant={payStatusVariant(r.status)}>{r.status}</Badge> },
    { key: 'gateway_ref', header: 'Reference', render: (r) => r.gateway_ref ? <span className="font-mono text-xs">{r.gateway_ref}</span> : '—' },
    { key: 'created_at', header: 'Date', render: (r) => new Date(r.created_at).toLocaleDateString() },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Proprietor', href: '/proprietor' }, { label: 'Financial Overview' }]} />

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Financial Overview</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Track your school's financial health, platform invoices, and payment records.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 text-green-600"><DollarSign className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-gray-500">School Revenue</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">${revenue.toLocaleString()}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-600"><TrendingUp className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-gray-500">Platform Paid</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">${totalPaid.toLocaleString()}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-600"><FileText className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-gray-500">Amount Due</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">${totalDue.toLocaleString()}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100 text-purple-600"><CreditCard className="w-5 h-5" /></div>
            <div>
              <p className="text-sm text-gray-500">Total Payments</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{payments.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['invoices', 'payments'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors ${
              tab === t
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'invoices' ? `Invoices (${invoices.length})` : `Payments (${payments.length})`}
          </button>
        ))}
      </div>

      {tab === 'invoices' && (
        <Table<BillingInvoice>
          columns={invoiceColumns}
          data={invoices}
          keyExtractor={(r) => r.id}
          loading={loadingInv}
          emptyMessage="No invoices found."
        />
      )}

      {tab === 'payments' && (
        <Table<PlatformPayment>
          columns={paymentColumns}
          data={payments}
          keyExtractor={(r) => r.id}
          loading={loadingPay}
          emptyMessage="No payments recorded."
        />
      )}
    </div>
  );
}
