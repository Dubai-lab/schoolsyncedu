import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { billingService, schoolManagementService, enterpriseService } from '@/services/adminService';
import type { BillingInvoice, SubscriptionWithSchool, PlatformPayment, EnterpriseInquiry } from '@/types/report.types';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Card } from '@/components/ui/Card';
import Dialog, { DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/Dialog';
import { notify } from '@/components/shared/Toast';
import { supabase } from '@/lib/supabase';
import { DollarSign, FileText, Clock, CheckCircle, Eye, Ban, WifiOff, Wifi, CalendarClock, Sparkles, Mail, Phone, Users, MessageSquare, Layers, Send, Globe } from 'lucide-react';

type Tab = 'invoices' | 'subscriptions' | 'payments' | 'addons' | 'enterprise' | 'notify';
type StatusFilter = 'all' | BillingInvoice['status'];

function fmt(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);
}

const statusVariant = (s: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  switch (s) {
    case 'paid': case 'active':                          return 'success';
    case 'sent': case 'trial':                           return 'info';
    case 'overdue': case 'suspended': case 'cancelled':  return 'danger';
    case 'draft': case 'grace':                          return 'default';
    case 'void': case 'archived':                        return 'warning';
    default:                                             return 'default';
  }
};

export default function BillingCenter() {
  const qc = useQueryClient();
  const [tab, setTab]               = useState<Tab>('invoices');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [viewInvoice, setViewInvoice]   = useState<BillingInvoice | null>(null);
  const [voidTarget, setVoidTarget]     = useState<BillingInvoice | null>(null);

  // Subscription actions
  const [suspendSub, setSuspendSub]           = useState<SubscriptionWithSchool | null>(null);
  const [graceSub, setGraceSub]               = useState<SubscriptionWithSchool | null>(null);
  const [graceExtendDays, setGraceExtendDays] = useState(7);

  // Manual notification push state
  type NotifyType = 'payment_confirmed' | 'payment_pending' | 'reactivated' | 'grace_reminder';
  const [notifySchoolId, setNotifySchoolId]     = useState('');
  const [notifyType, setNotifyType]             = useState<NotifyType>('payment_confirmed');
  const [notifyAmountUsd, setNotifyAmountUsd]   = useState('');
  const [notifyAmountLrd, setNotifyAmountLrd]   = useState('');
  const [notifyPayMethod, setNotifyPayMethod]   = useState('bank');
  const [notifyExpiresAt, setNotifyExpiresAt]   = useState('');
  const [notifySending, setNotifySending]       = useState(false);
  const [notifyResult, setNotifyResult]         = useState<{ invoice_number: string; expires_at: string } | null>(null);

  const { data: invoices = [], isLoading: loadingInv } = useFetch<BillingInvoice[]>(
    ['admin-invoices'],
    () => billingService.listInvoices()
  );

  const { data: subscriptions = [], isLoading: loadingSubs } = useFetch<SubscriptionWithSchool[]>(
    ['admin-subscriptions-detail'],
    () => billingService.listSubscriptionsWithDetails()
  );

  const { data: platformPayments = [], isLoading: loadingPayments } = useFetch<(PlatformPayment & { schools?: { name: string } })[]>(
    ['admin-platform-payments'],
    () => billingService.listPlatformPayments()
  );

  const { data: enterpriseInquiries = [], isLoading: loadingEnterprise } = useFetch<EnterpriseInquiry[]>(
    ['admin-enterprise-inquiries'],
    () => enterpriseService.list()
  );

  type SubdomainPaymentRow = {
    id: string; school_id: string; school_name: string | null;
    amount_usd: number; plan: 'monthly' | 'yearly';
    gateway_ref: string | null; paid_at: string; paid_until: string;
  };
  const { data: addonPayments = [], isLoading: loadingAddons } = useFetch<SubdomainPaymentRow[]>(
    ['admin-subdomain-payments'],
    async () => {
      const { data, error } = await supabase.rpc('get_all_subdomain_payments');
      if (error) throw error;
      return (data ?? []) as SubdomainPaymentRow[];
    }
  );

  const [viewInquiry, setViewInquiry] = useState<EnterpriseInquiry | null>(null);

  const updateInquiryMutation = useMutate(
    ({ id, status, notes }: { id: string; status: EnterpriseInquiry['status']; notes?: string }) =>
      enterpriseService.updateStatus(id, status, notes),
    [['admin-enterprise-inquiries']]
  );

  const markPaidMutation = useMutate(
    (id: string) => billingService.updateInvoiceStatus(id, 'paid'),
    [['admin-invoices']]
  );

  const voidMutation = useMutate(
    (id: string) => billingService.voidInvoice(id),
    [['admin-invoices']]
  );

  const suspendMutation = useMutate(
    (schoolId: string) => schoolManagementService.suspendSchool(schoolId, 'Suspended from Billing Center'),
    [['admin-subscriptions-detail'], ['admin-schools']]
  );

  const reactivateMutation = useMutate(
    ({ schoolId, days }: { schoolId: string; days: number }) =>
      schoolManagementService.reactivateSchool(schoolId, days),
    [['admin-subscriptions-detail'], ['admin-schools']]
  );

  const extendGraceMutation = useMutate(
    ({ subId, days }: { subId: string; days: number }) =>
      billingService.extendGracePeriod(subId, days),
    [['admin-subscriptions-detail']]
  );

  const handleMarkPaid = (inv: BillingInvoice) => {
    markPaidMutation.mutate(inv.id, {
      onSuccess: () => notify.success(`Invoice ${inv.invoice_number} marked as paid`),
      onError:   () => notify.error('Failed to update invoice'),
    });
  };

  const handleVoid = () => {
    if (!voidTarget) return;
    voidMutation.mutate(voidTarget.id, {
      onSuccess: () => { notify.success(`Invoice ${voidTarget.invoice_number} voided`); setVoidTarget(null); },
      onError:   () => notify.error('Failed to void invoice'),
    });
  };

  const handleSuspendSub = () => {
    if (!suspendSub) return;
    suspendMutation.mutate(suspendSub.school_id, {
      onSuccess: () => { notify.success(`${suspendSub.school_name} suspended`); setSuspendSub(null); },
      onError:   () => notify.error('Failed to suspend school'),
    });
  };

  const handleExtendGrace = () => {
    if (!graceSub) return;
    extendGraceMutation.mutate({ subId: graceSub.id, days: graceExtendDays }, {
      onSuccess: () => {
        notify.success(`Grace period extended by ${graceExtendDays} days for ${graceSub.school_name}`);
        setGraceSub(null);
        setGraceExtendDays(7);
      },
      onError: () => notify.error('Failed to extend grace period'),
    });
  };

  const handleSendNotification = async () => {
    const sub = subscriptions.find((s) => s.school_id === notifySchoolId);
    if (!sub) { notify.error('Select a school first'); return; }

    if (notifyType === 'payment_confirmed') {
      if (!notifyAmountUsd || parseFloat(notifyAmountUsd) <= 0) {
        notify.error('Enter the USD amount paid'); return;
      }
    }
    if (notifyType === 'reactivated' && !notifyExpiresAt) {
      notify.error('Enter the new subscription expiry date'); return;
    }

    setNotifySending(true);
    setNotifyResult(null);
    try {
      const payload: Record<string, unknown> = {
        trigger:    notifyType,
        school_id:  sub.school_id,
        school_name: sub.school_name,
        owner_email: sub.owner_email,
        owner_name:  sub.owner_name,
        plan_name:   sub.plan_name,
      };

      if (notifyType === 'payment_confirmed') {
        payload.amount_usd     = parseFloat(notifyAmountUsd);
        payload.amount_lrd     = notifyAmountLrd ? parseFloat(notifyAmountLrd) : null;
        payload.payment_method = notifyPayMethod;
      } else if (notifyType === 'reactivated') {
        payload.expires_at = notifyExpiresAt;
      }

      const { data, error } = await supabase.functions.invoke('process-subscription-notifications', { body: payload });
      if (error) throw error;

      if (notifyType === 'payment_confirmed' && data?.invoice_number) {
        setNotifyResult({ invoice_number: data.invoice_number, expires_at: data.expires_at });
      }

      notify.success(`Email sent to ${sub.owner_email} — subscription updated`);
      setNotifyAmountUsd('');
      setNotifyAmountLrd('');
      setNotifyExpiresAt('');
      // Refresh all billing data so totals and tables update immediately
      qc.invalidateQueries({ queryKey: ['admin-invoices'] });
      qc.invalidateQueries({ queryKey: ['admin-platform-payments'] });
      qc.invalidateQueries({ queryKey: ['admin-subscriptions-detail'] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      notify.error(`Failed: ${msg}`);
    } finally {
      setNotifySending(false);
    }
  };

  const filteredInvoices = statusFilter === 'all' ? invoices : invoices.filter((i) => i.status === statusFilter);
  const subscriptionRevenue = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.amount_usd, 0);
  const addonRevenue        = addonPayments.reduce((s, p) => s + Number(p.amount_usd), 0);
  const totalRevenue  = subscriptionRevenue + addonRevenue;
  const paidCount     = invoices.filter((i) => i.status === 'paid').length;
  const overdueCount  = invoices.filter((i) => i.status === 'overdue').length;
  const pendingCount  = invoices.filter((i) => i.status === 'sent' || i.status === 'draft').length;

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
              <Button variant="ghost" size="sm" onClick={() => handleMarkPaid(row)} title="Mark Paid">
                <CheckCircle className="w-4 h-4 text-green-600" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setVoidTarget(row)} title="Void">
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

  const subColumns: Column<SubscriptionWithSchool>[] = [
    {
      key: 'school_name',
      header: 'School',
      render: (row) => <span className="font-medium text-gray-900">{row.school_name}</span>,
    },
    {
      key: 'plan_name',
      header: 'Plan',
      render: (row) => <Badge variant="outline">{row.plan_name}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge variant={statusVariant(row.status)}>{row.status}</Badge>,
    },
    {
      key: 'started_at',
      header: 'Started',
      render: (row) => new Date(row.started_at).toLocaleDateString(),
    },
    {
      key: 'expires_at',
      header: 'Expires',
      render: (row) => {
        const d = new Date(row.expires_at);
        const expired = d < new Date();
        return (
          <span className={expired ? 'text-red-600 font-medium' : ''}>
            {d.toLocaleDateString()}
          </span>
        );
      },
    },
    {
      key: 'auto_renew',
      header: 'Auto-Renew',
      render: (row) => row.auto_renew ? <Badge variant="success">Yes</Badge> : <span className="text-gray-400">No</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex items-center gap-1">
          {row.status === 'suspended' ? (
            <Button
              variant="ghost" size="sm"
              onClick={() => { setGraceSub(row); setGraceExtendDays(7); }}
              title="Reactivate with grace period"
            >
              <Wifi className="w-4 h-4 text-green-600" />
            </Button>
          ) : (
            <>
              <Button
                variant="ghost" size="sm"
                onClick={() => { setGraceSub(row); setGraceExtendDays(7); }}
                title="Extend grace period"
              >
                <CalendarClock className="w-4 h-4 text-blue-600" />
              </Button>
              <Button
                variant="ghost" size="sm"
                onClick={() => setSuspendSub(row)}
                title="Suspend school"
              >
                <WifiOff className="w-4 h-4 text-amber-500" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  const tabClass = (t: Tab) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      tab === t ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'
    }`;

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
      <div className="flex items-center gap-2 flex-wrap">
        <button className={tabClass('invoices')} onClick={() => setTab('invoices')}>
          Invoices {invoices.length > 0 && <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-xs">{invoices.length}</span>}
        </button>
        <button className={tabClass('payments')} onClick={() => setTab('payments')}>
          Payments {platformPayments.length > 0 && <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-xs">{platformPayments.length}</span>}
        </button>
        <button className={tabClass('subscriptions')} onClick={() => setTab('subscriptions')}>
          Subscriptions {subscriptions.length > 0 && <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-xs">{subscriptions.length}</span>}
        </button>
        <button className={tabClass('addons')} onClick={() => setTab('addons')}>
          <span className="flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5" />
            Add-ons
            {addonPayments.length > 0 && <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-xs">{addonPayments.length}</span>}
          </span>
        </button>
        <button className={tabClass('enterprise')} onClick={() => setTab('enterprise')}>
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Enterprise Inquiries
            {enterpriseInquiries.filter((i) => i.status === 'new').length > 0 && (
              <span className="ml-1 rounded-full bg-violet-200 text-violet-800 px-1.5 py-0.5 text-xs font-bold">
                {enterpriseInquiries.filter((i) => i.status === 'new').length}
              </span>
            )}
          </span>
        </button>
        <button className={tabClass('notify')} onClick={() => setTab('notify')}>
          <span className="flex items-center gap-1.5">
            <Send className="w-3.5 h-3.5" />
            Send Notification
          </span>
        </button>
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
            emptyMessage="No payment records found."
          />
        </>
      )}

      {tab === 'subscriptions' && (
        <>
          <div className="text-sm text-gray-500 mb-2">
            <span className="font-semibold text-gray-800">{subscriptions.filter((s) => s.status === 'active').length}</span> active,{' '}
            <span className="font-semibold text-amber-600">{subscriptions.filter((s) => s.status === 'grace').length}</span> in grace period,{' '}
            <span className="font-semibold text-red-600">{subscriptions.filter((s) => s.status === 'suspended').length}</span> suspended.
          </div>
          <Table<SubscriptionWithSchool>
            columns={subColumns}
            data={subscriptions}
            keyExtractor={(r) => r.id}
            loading={loadingSubs}
            emptyMessage="No subscriptions found."
          />
        </>
      )}

      {tab === 'addons' && (
        <>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Globe className="w-4 h-4 text-blue-500" />
            <span>
              <span className="font-semibold text-gray-800">{addonPayments.length}</span> subdomain add-on payment{addonPayments.length !== 1 ? 's' : ''}.
            </span>
            <span className="ml-auto font-semibold text-green-700">
              Total: {fmt(addonRevenue)}
            </span>
          </div>
          <Table<SubdomainPaymentRow>
            columns={[
              {
                key: 'paid_at',
                header: 'Date',
                render: (row) => new Date(row.paid_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
              },
              {
                key: 'school_name',
                header: 'School',
                render: (row) => <span className="text-sm font-medium">{row.school_name ?? row.school_id.slice(0, 8) + '…'}</span>,
              },
              {
                key: 'plan',
                header: 'Plan',
                render: (row) => (
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${row.plan === 'yearly' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                    {row.plan === 'yearly' ? 'Annual' : 'Monthly'}
                  </span>
                ),
              },
              {
                key: 'amount_usd',
                header: 'Amount',
                render: (row) => <span className="font-semibold">{fmt(Number(row.amount_usd))}</span>,
              },
              {
                key: 'paid_until',
                header: 'Valid Until',
                render: (row) => new Date(row.paid_until).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
              },
              {
                key: 'gateway_ref',
                header: 'Gateway Ref',
                render: (row) => <span className="font-mono text-xs text-gray-500">{row.gateway_ref ?? '—'}</span>,
              },
            ]}
            data={addonPayments}
            keyExtractor={(r) => r.id}
            loading={loadingAddons}
            emptyMessage="No subdomain add-on payments yet."
          />
        </>
      )}

      {tab === 'enterprise' && (
        <>
          <div className="flex items-center gap-3 text-sm text-gray-500 mb-2">
            <Sparkles className="w-4 h-4 text-violet-500" />
            <span>
              <span className="font-semibold text-violet-700">{enterpriseInquiries.filter((i) => i.status === 'new').length}</span> new,{' '}
              <span className="font-semibold text-blue-600">{enterpriseInquiries.filter((i) => i.status === 'contacted').length}</span> contacted,{' '}
              <span className="font-semibold text-gray-500">{enterpriseInquiries.filter((i) => i.status === 'closed').length}</span> closed.
            </span>
          </div>
          <Table<EnterpriseInquiry>
            columns={[
              {
                key: 'school_name',
                header: 'School',
                render: (row) => (
                  <div>
                    <p className="font-medium text-gray-900">{row.school_name}</p>
                    <p className="text-xs text-gray-400">{new Date(row.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                  </div>
                ),
              },
              {
                key: 'contact_name',
                header: 'Contact',
                render: (row) => (
                  <div>
                    <p className="text-sm font-medium">{row.contact_name}</p>
                    <p className="text-xs text-gray-400 flex items-center gap-1"><Mail className="w-3 h-3" />{row.email}</p>
                    {row.phone && <p className="text-xs text-gray-400 flex items-center gap-1"><Phone className="w-3 h-3" />{row.phone}</p>}
                  </div>
                ),
              },
              {
                key: 'student_count',
                header: 'Students',
                render: (row) => (
                  <span className="flex items-center gap-1 text-sm text-gray-600">
                    <Users className="w-3.5 h-3.5 text-gray-400" />{row.student_count || '—'}
                  </span>
                ),
              },
              {
                key: 'modules_needed',
                header: 'Modules',
                render: (row) => <span className="text-xs text-gray-500 line-clamp-2">{row.modules_needed || '—'}</span>,
              },
              {
                key: 'status',
                header: 'Status',
                render: (row) => (
                  <Badge variant={row.status === 'new' ? 'info' : row.status === 'contacted' ? 'success' : 'default'}>
                    {row.status}
                  </Badge>
                ),
              },
              {
                key: 'actions',
                header: '',
                render: (row) => (
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setViewInquiry(row)} title="View details">
                      <Eye className="w-4 h-4" />
                    </Button>
                    {row.status !== 'contacted' && (
                      <Button variant="ghost" size="sm" title="Mark as Contacted"
                        onClick={() => updateInquiryMutation.mutate({ id: row.id, status: 'contacted' }, {
                          onSuccess: () => notify.success('Marked as contacted'),
                        })}>
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      </Button>
                    )}
                    {row.status !== 'closed' && (
                      <Button variant="ghost" size="sm" title="Close inquiry"
                        onClick={() => updateInquiryMutation.mutate({ id: row.id, status: 'closed' }, {
                          onSuccess: () => notify.success('Inquiry closed'),
                        })}>
                        <Ban className="w-4 h-4 text-gray-400" />
                      </Button>
                    )}
                  </div>
                ),
              },
            ] as Column<EnterpriseInquiry>[]}
            data={enterpriseInquiries}
            keyExtractor={(r) => r.id}
            loading={loadingEnterprise}
            emptyMessage="No enterprise inquiries yet."
          />
        </>
      )}

      {tab === 'notify' && (
        <div className="max-w-xl space-y-5">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
            Use this panel to manually send billing emails — for schools that paid by bank transfer or mobile money.
          </div>

          {/* School selector */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-600">School</label>
            <select
              value={notifySchoolId}
              onChange={(e) => setNotifySchoolId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20"
            >
              <option value="">— Select a school —</option>
              {subscriptions.map((s) => (
                <option key={s.school_id} value={s.school_id}>
                  {s.school_name} ({s.status})
                </option>
              ))}
            </select>
            {notifySchoolId && (() => {
              const s = subscriptions.find((sub) => sub.school_id === notifySchoolId);
              return s ? (
                <p className="text-xs text-gray-500 pt-1">
                  Owner email: <strong>{s.owner_email || 'unknown'}</strong> · Plan: <strong>{s.plan_name}</strong>
                </p>
              ) : null;
            })()}
          </div>

          {/* Notification type */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-600">Email Type</label>
            <select
              value={notifyType}
              onChange={(e) => setNotifyType(e.target.value as typeof notifyType)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20"
            >
              <option value="payment_confirmed">Payment Confirmed (receipt from billing@)</option>
              <option value="payment_pending">Payment Pending reminder (from billing@)</option>
              <option value="reactivated">School Reactivated (from support@)</option>
              <option value="grace_reminder">Grace Period Reminder (via batch — use daily cron)</option>
            </select>
          </div>

          {/* Conditional extra fields */}
          {notifyType === 'payment_confirmed' && (
            <div className="space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Payment Details</p>

              {/* Invoice auto-generated notice */}
              <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-700">
                <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                Invoice number is auto-generated by the system (e.g. INV-2026-0001). No need to enter it manually.
              </div>

              {/* Amounts */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-600">Amount in USD <span className="text-red-500">*</span></label>
                  <input
                    type="number" min="0" step="0.01" placeholder="e.g. 150.00"
                    value={notifyAmountUsd}
                    onChange={(e) => setNotifyAmountUsd(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-600">Amount in LRD <span className="text-gray-400">(optional)</span></label>
                  <input
                    type="number" min="0" step="1" placeholder="e.g. 24000"
                    value={notifyAmountLrd}
                    onChange={(e) => setNotifyAmountLrd(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20"
                  />
                </div>
              </div>

              {/* Payment method */}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-600">Payment Method</label>
                <select
                  value={notifyPayMethod}
                  onChange={(e) => setNotifyPayMethod(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20"
                >
                  <option value="bank">Bank Transfer</option>
                  <option value="mtn">MTN Mobile Money</option>
                  <option value="orange">Orange Money</option>
                  <option value="manual">Cash / Manual</option>
                </select>
              </div>

              {/* Expiry info */}
              {notifySchoolId && (() => {
                const s = subscriptions.find((sub) => sub.school_id === notifySchoolId);
                return s ? (
                  <p className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded px-3 py-2">
                    New expiry will be calculated automatically from the <strong>{s.plan_name}</strong> billing cycle.
                  </p>
                ) : null;
              })()}
            </div>
          )}

          {notifyType === 'reactivated' && (
            <div className="space-y-1 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <label className="block text-xs font-medium text-gray-600">New Subscription Expiry Date</label>
              <input
                type="date"
                value={notifyExpiresAt}
                onChange={(e) => setNotifyExpiresAt(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20"
              />
            </div>
          )}

          {notifyType === 'grace_reminder' && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
              Grace period reminders are sent automatically by the daily 8am cron. They cannot be sent manually — the cron handles deduplication.
            </div>
          )}

          <Button
            onClick={handleSendNotification}
            loading={notifySending}
            disabled={!notifySchoolId || notifyType === 'grace_reminder'}
            className="w-full"
          >
            <Send className="w-4 h-4 mr-2" />
            {notifyType === 'payment_confirmed'
              ? 'Confirm Payment & Send Receipt'
              : `Send ${notifyType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} Email`}
          </Button>

          {/* Success result */}
          {notifyResult && (
            <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-800 space-y-1">
              <p className="font-semibold flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Payment confirmed successfully</p>
              <p>Invoice: <strong className="font-mono">{notifyResult.invoice_number}</strong></p>
              <p>Subscription active until: <strong>{new Date(notifyResult.expires_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</strong></p>
            </div>
          )}
        </div>
      )}

      {/* ===== ENTERPRISE INQUIRY DETAIL ===== */}
      <Dialog open={!!viewInquiry} onClose={() => setViewInquiry(null)} className="max-w-lg">
        <DialogHeader onClose={() => setViewInquiry(null)}>
          <DialogTitle>Enterprise Inquiry — {viewInquiry?.school_name}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {viewInquiry && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-gray-400">School</p><p className="font-semibold">{viewInquiry.school_name}</p></div>
                <div><p className="text-xs text-gray-400">Contact</p><p className="font-semibold">{viewInquiry.contact_name}</p></div>
                <div><p className="text-xs text-gray-400 flex items-center gap-1"><Mail className="w-3 h-3" />Email</p>
                  <a href={`mailto:${viewInquiry.email}`} className="text-primary-600 hover:underline">{viewInquiry.email}</a>
                </div>
                <div><p className="text-xs text-gray-400 flex items-center gap-1"><Phone className="w-3 h-3" />Phone</p><p>{viewInquiry.phone || '—'}</p></div>
                <div><p className="text-xs text-gray-400 flex items-center gap-1"><Users className="w-3 h-3" />Students</p><p>{viewInquiry.student_count || '—'}</p></div>
                <div><p className="text-xs text-gray-400">Submitted</p><p>{new Date(viewInquiry.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p></div>
              </div>
              {viewInquiry.modules_needed && (
                <div>
                  <p className="text-xs text-gray-400 flex items-center gap-1 mb-1"><Layers className="w-3 h-3" />Modules Needed</p>
                  <p className="text-sm text-gray-700 bg-slate-50 rounded-lg p-3">{viewInquiry.modules_needed}</p>
                </div>
              )}
              {viewInquiry.message && (
                <div>
                  <p className="text-xs text-gray-400 flex items-center gap-1 mb-1"><MessageSquare className="w-3 h-3" />Message</p>
                  <p className="text-sm text-gray-700 bg-slate-50 rounded-lg p-3 whitespace-pre-wrap">{viewInquiry.message}</p>
                </div>
              )}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <span className="text-xs text-gray-400">Status:</span>
                <Badge variant={viewInquiry.status === 'new' ? 'info' : viewInquiry.status === 'contacted' ? 'success' : 'default'}>
                  {viewInquiry.status}
                </Badge>
              </div>
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          {viewInquiry?.status !== 'contacted' && (
            <Button size="sm" onClick={() => { updateInquiryMutation.mutate({ id: viewInquiry!.id, status: 'contacted' }, { onSuccess: () => { notify.success('Marked as contacted'); setViewInquiry(null); } }); }}>
              Mark Contacted
            </Button>
          )}
          {viewInquiry?.status !== 'closed' && (
            <Button variant="outline" size="sm" onClick={() => { updateInquiryMutation.mutate({ id: viewInquiry!.id, status: 'closed' }, { onSuccess: () => { notify.success('Inquiry closed'); setViewInquiry(null); } }); }}>
              Close Inquiry
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setViewInquiry(null)}>Done</Button>
        </DialogFooter>
      </Dialog>

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

      {/* ===== SUSPEND SUBSCRIPTION CONFIRM ===== */}
      <Dialog open={!!suspendSub} onClose={() => setSuspendSub(null)} className="max-w-sm">
        <DialogHeader onClose={() => setSuspendSub(null)}>
          <DialogTitle>Suspend School</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p className="text-sm text-gray-600">
            This will take <strong>{suspendSub?.school_name}</strong> offline immediately and set their subscription to <em>suspended</em>. They will lose portal access.
          </p>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setSuspendSub(null)}>Cancel</Button>
          <Button variant="danger" size="sm" loading={suspendMutation.isPending} onClick={handleSuspendSub}>
            <WifiOff className="w-4 h-4 mr-1" /> Suspend
          </Button>
        </DialogFooter>
      </Dialog>

      {/* ===== EXTEND GRACE / REACTIVATE ===== */}
      <Dialog open={!!graceSub} onClose={() => { setGraceSub(null); setGraceExtendDays(7); }} className="max-w-sm">
        <DialogHeader onClose={() => { setGraceSub(null); setGraceExtendDays(7); }}>
          <DialogTitle>
            {graceSub?.status === 'suspended' ? 'Reactivate School' : 'Extend Grace Period'}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p className="text-sm text-gray-600 mb-4">
            {graceSub?.status === 'suspended'
              ? `Reactivate ${graceSub?.school_name} and give them a grace period to make payment.`
              : `Extend grace period for ${graceSub?.school_name}.`}
          </p>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-600">Number of Days</label>
            <input
              type="number"
              min={1}
              max={90}
              value={graceExtendDays}
              onChange={(e) => setGraceExtendDays(Math.max(1, Number(e.target.value)))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20"
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => { setGraceSub(null); setGraceExtendDays(7); }}>Cancel</Button>
          {graceSub?.status === 'suspended' ? (
            <Button
              size="sm"
              loading={reactivateMutation.isPending}
              onClick={() => {
                if (!graceSub) return;
                reactivateMutation.mutate({ schoolId: graceSub.school_id, days: graceExtendDays }, {
                  onSuccess: () => { notify.success(`${graceSub.school_name} reactivated`); setGraceSub(null); },
                  onError:   () => notify.error('Failed to reactivate'),
                });
              }}
            >
              <Wifi className="w-4 h-4 mr-1" /> Reactivate ({graceExtendDays}d)
            </Button>
          ) : (
            <Button size="sm" loading={extendGraceMutation.isPending} onClick={handleExtendGrace}>
              <CalendarClock className="w-4 h-4 mr-1" /> Extend ({graceExtendDays}d)
            </Button>
          )}
        </DialogFooter>
      </Dialog>
    </div>
  );
}
