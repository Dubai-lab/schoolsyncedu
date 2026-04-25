import { useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import {
  proprietorSubscriptionService,
  proprietorBillingService,
} from '@/services/proprietorService';
import { mtnInitiatePayment, mtnGetStatus } from '@/services/mtnService';
import type {
  Subscription,
  SubscriptionPlan,
  BillingInvoice,
  SubscriptionHistory,
} from '@/types/report.types';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Card } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Dialog, { DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/Dialog';
import { notify } from '@/components/shared/Toast';
import {
  CreditCard,
  ArrowUpCircle,
  ToggleLeft,
  ToggleRight,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Smartphone,
  Loader2,
} from 'lucide-react';

type Tab = 'overview' | 'invoices' | 'history' | 'cards';


// ── Main component ─────────────────────────────────────────────────────────────

export default function SubscriptionManagement() {
  const { user } = useAuth();
  const schoolId = user?.school_id;
  const [tab, setTab] = useState<Tab>('overview');
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [showCardForm,   setShowCardForm]   = useState(false);

  // MTN MoMo state
  const [mtnPhone,       setMtnPhone]       = useState('');
  const [mtnLoading,     setMtnLoading]     = useState(false);
  const [mtnError,       setMtnError]       = useState('');
  const [mtnReferenceId, setMtnReferenceId] = useState('');
  const [mtnPollStatus,  setMtnPollStatus]  = useState<'PENDING' | 'SUCCESSFUL' | 'FAILED' | ''>('');
  const [mtnSuccess,     setMtnSuccess]     = useState(false);
  const mtnPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: subscription, isLoading: loadingSub } = useFetch<(Subscription & { plan: SubscriptionPlan }) | null>(
    ['prop-subscription', schoolId!],
    () => proprietorSubscriptionService.getSubscription(schoolId!),
    { enabled: !!schoolId }
  );

  const { data: plans = [] } = useFetch<SubscriptionPlan[]>(
    ['prop-plans'],
    () => proprietorSubscriptionService.getAvailablePlans(),
    { enabled: changePlanOpen }
  );

  const { data: invoices = [], isLoading: loadingInvoices } = useFetch<BillingInvoice[]>(
    ['prop-invoices', schoolId!],
    () => proprietorBillingService.getInvoices(schoolId!),
    { enabled: !!schoolId }
  );

  const { data: history = [], isLoading: loadingHistory } = useFetch<SubscriptionHistory[]>(
    ['prop-sub-history', subscription?.id ?? ''],
    () => proprietorSubscriptionService.getHistory(subscription!.id),
    { enabled: !!subscription?.id }
  );


  const toggleAutoRenew = useMutate(
    (autoRenew: boolean) => proprietorSubscriptionService.toggleAutoRenew(subscription!.id, autoRenew),
    [['prop-subscription', schoolId!]]
  );

  const selectedPlan = plans.find((p) => p.id === selectedPlanId)
    ?? (selectedPlanId === '__current__' ? subscription?.plan : undefined);

  const handleToggleRenew = () => {
    if (!subscription) return;
    toggleAutoRenew.mutate(!subscription.auto_renew, {
      onSuccess: () => notify.success(`Auto-renew ${subscription.auto_renew ? 'disabled' : 'enabled'}`),
      onError: () => notify.error('Failed to update auto-renew'),
    });
  };

  const openRenewDialog = () => {
    setSelectedPlanId(subscription?.plan_id ?? null);
    setShowCardForm(false);
    setChangePlanOpen(true);
  };

  const stopMtnPolling = () => {
    if (mtnPollRef.current) { clearInterval(mtnPollRef.current); mtnPollRef.current = null; }
  };

  const startMtnPolling = (refId: string, subId: string) => {
    stopMtnPolling();
    let attempts = 0;
    mtnPollRef.current = setInterval(async () => {
      attempts++;
      try {
        const result = await mtnGetStatus(refId);
        setMtnPollStatus(result.status);
        if (result.status === 'SUCCESSFUL') {
          stopMtnPolling();
          setMtnSuccess(true);
          notify.success('Payment successful! Your subscription has been activated.');
          void subId; // subscription already activated by edge function
        } else if (result.status === 'FAILED') {
          stopMtnPolling();
          setMtnError(result.reason?.message ?? 'Payment declined. Please try again.');
          setMtnReferenceId('');
        } else if (attempts >= 60) {
          stopMtnPolling();
          setMtnError('Payment timed out. If you approved the request, contact support.');
          setMtnReferenceId('');
        }
      } catch { /* silent */ }
    }, 5000);
  };

  const handleMtnPay = async () => {
    if (!selectedPlan || !mtnPhone.trim() || !schoolId) return;
    if (!subscription?.id) { setMtnError('No active subscription found.'); return; }
    setMtnLoading(true);
    setMtnError('');
    try {
      const result = await mtnInitiatePayment({
        school_id:       schoolId,
        subscription_id: subscription.id,
        amount:          selectedPlan.price_usd,
        phone:           mtnPhone.trim(),
      });
      setMtnReferenceId(result.reference_id);
      setMtnPollStatus('PENDING');
      startMtnPolling(result.reference_id, subscription.id);
    } catch (err) {
      setMtnError(err instanceof Error ? err.message : 'Failed to send payment request');
    } finally {
      setMtnLoading(false);
    }
  };

  const resetMtnState = () => {
    stopMtnPolling();
    setMtnPhone('');
    setMtnLoading(false);
    setMtnError('');
    setMtnReferenceId('');
    setMtnPollStatus('');
    setMtnSuccess(false);
  };

  const closeDialog = () => {
    resetMtnState();
    setChangePlanOpen(false);
    setSelectedPlanId(null);
    setShowCardForm(false);
  };


  const [now] = useState(() => Date.now());
  const daysRemaining = subscription?.expires_at
    ? Math.max(0, Math.ceil((new Date(subscription.expires_at).getTime() - now) / 86400000))
    : null;

  const isSuspended     = subscription?.status === 'suspended';
  const isGrace         = subscription?.status === 'grace';
  const isTrial         = subscription?.status === 'trial';
  const isActive        = subscription?.status === 'active';
  const isExpiringSoon  = (isActive || isTrial) && daysRemaining !== null && daysRemaining <= 7;

  const statusVariant = (s: string): 'success' | 'warning' | 'danger' | 'info' => {
    switch (s) {
      case 'active': case 'premier': return 'success';
      case 'trial': case 'grace': return 'warning';
      case 'suspended': case 'cancelled': case 'archived': return 'danger';
      default: return 'info';
    }
  };

  const invoiceStatusVariant = (s: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
    switch (s) {
      case 'paid': return 'success';
      case 'sent': return 'info';
      case 'overdue': return 'danger';
      case 'void': return 'default';
      default: return 'warning';
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview',  label: 'Overview' },
    { key: 'invoices',  label: `Invoices (${invoices.length})` },
    { key: 'history',   label: 'History' },
  ];

  const invoiceColumns: Column<BillingInvoice>[] = [
    { key: 'invoice_number', header: 'Invoice #', render: (r) => <span className="font-mono text-sm">{r.invoice_number}</span> },
    { key: 'amount_usd',     header: 'Amount',    render: (r) => `$${r.amount_usd.toLocaleString()}` },
    { key: 'status',         header: 'Status',    render: (r) => <Badge variant={invoiceStatusVariant(r.status)}>{r.status}</Badge> },
    { key: 'due_date',       header: 'Due Date',  render: (r) => new Date(r.due_date).toLocaleDateString() },
    { key: 'paid_at',        header: 'Paid',      render: (r) => r.paid_at ? new Date(r.paid_at).toLocaleDateString() : '—' },
  ];

  const historyColumns: Column<SubscriptionHistory>[] = [
    { key: 'changed_at',       header: 'Date',    render: (r) => new Date(r.changed_at).toLocaleString() },
    { key: 'previous_status',  header: 'From',    render: (r) => <Badge variant={statusVariant(r.previous_status)}>{r.previous_status}</Badge> },
    { key: 'new_status',       header: 'To',      render: (r) => <Badge variant={statusVariant(r.new_status)}>{r.new_status}</Badge> },
    { key: 'reason',           header: 'Reason',  render: (r) => <span className="text-sm text-gray-600">{r.reason ?? '—'}</span> },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Proprietor', href: '/proprietor' }, { label: 'Subscription & Billing' }]} />

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Subscription & Billing</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage your school's subscription plan, invoices, and payment history.
        </p>
      </div>

      {/* ── Status banners ─────────────────────────────────────────────────── */}
      {isSuspended && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-start gap-3 flex-1">
              <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-800 text-lg">Your school is offline</p>
                <p className="text-sm text-red-700 mt-0.5">
                  Your subscription has expired. Staff and students cannot log in until you renew.
                </p>
              </div>
            </div>
            <Button className="bg-red-600 hover:bg-red-700 text-white shrink-0" onClick={openRenewDialog}>
              <RefreshCw className="w-4 h-4 mr-1.5" /> Renew Now
            </Button>
          </div>
        </div>
      )}

      {isGrace && daysRemaining !== null && (
        <div className="rounded-xl border border-orange-300 bg-orange-50 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-start gap-3 flex-1">
              <AlertTriangle className="w-6 h-6 text-orange-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-orange-800 text-lg">Grace period — {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} left</p>
                <p className="text-sm text-orange-700 mt-0.5">Renew before it ends or your school will go offline automatically.</p>
              </div>
            </div>
            <Button className="bg-orange-600 hover:bg-orange-700 text-white shrink-0" onClick={openRenewDialog}>
              <RefreshCw className="w-4 h-4 mr-1.5" /> Renew Now
            </Button>
          </div>
        </div>
      )}

      {isExpiringSoon && !isSuspended && !isGrace && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800 flex-1">
              <strong>{isTrial ? 'Free trial' : 'Subscription'} ending in {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}.</strong>{' '}
              Renew now to avoid any interruption.
            </p>
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white shrink-0" onClick={openRenewDialog}>
              Renew
            </Button>
          </div>
        </div>
      )}

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ===== OVERVIEW ===== */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {subscription ? (
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="w-5 h-5 text-primary-600" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Current Plan</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Plan</p>
                  <p className="font-semibold text-gray-900 dark:text-white text-lg">{subscription.plan.name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Status</p>
                  <Badge variant={statusVariant(subscription.status)} className="mt-1">{subscription.status}</Badge>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Price</p>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    ${subscription.plan.price_usd}/{subscription.plan.billing_cycle}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Student Limit</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{subscription.plan.student_limit}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Started</p>
                  <p className="text-sm text-gray-700">{new Date(subscription.started_at).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">
                    {isSuspended ? 'Suspended' : isGrace ? 'Grace Ends' : 'Expires'}
                  </p>
                  <p className={`text-sm font-medium ${daysRemaining !== null && daysRemaining <= 7 ? 'text-red-600' : 'text-gray-700'}`}>
                    {new Date(subscription.expires_at).toLocaleDateString()}
                    {daysRemaining !== null && !isSuspended && (
                      <span className="ml-1 text-xs">({daysRemaining}d remaining)</span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Auto-Renew</p>
                  <button onClick={handleToggleRenew} className="flex items-center gap-1.5 mt-1 text-sm">
                    {subscription.auto_renew
                      ? <><ToggleRight className="w-5 h-5 text-green-600" /> <span className="text-green-700">Enabled</span></>
                      : <><ToggleLeft className="w-5 h-5 text-gray-400" /> <span className="text-gray-500">Disabled</span></>
                    }
                  </button>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Features</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {Object.entries(subscription.plan.features ?? {})
                      .filter(([, v]) => v)
                      .slice(0, 4)
                      .map(([k]) => (
                        <Badge key={k} variant="outline" className="text-xs">{k}</Badge>
                      ))}
                    {Object.values(subscription.plan.features ?? {}).filter(Boolean).length > 4 && (
                      <Badge variant="outline" className="text-xs">
                        +{Object.values(subscription.plan.features).filter(Boolean).length - 4}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-200 flex flex-wrap gap-3">
                {(isSuspended || isGrace) && (
                  <Button onClick={openRenewDialog} className="bg-red-600 hover:bg-red-700 text-white">
                    <RefreshCw className="w-4 h-4 mr-1.5" />
                    {isSuspended ? 'Renew & Restore Access' : 'Renew Before Grace Ends'}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant={isSuspended || isGrace ? 'outline' : 'primary'}
                  icon={<ArrowUpCircle className="w-4 h-4" />}
                  onClick={() => { setSelectedPlanId(null); setShowCardForm(false); setChangePlanOpen(true); }}
                >
                  {isSuspended || isGrace ? 'Change Plan' : 'Upgrade / Change Plan'}
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="p-6">
              <p className="text-gray-500">{loadingSub ? 'Loading...' : 'No active subscription found.'}</p>
            </Card>
          )}
        </div>
      )}


      {/* ===== INVOICES ===== */}
      {tab === 'invoices' && (
        <Table<BillingInvoice>
          columns={invoiceColumns}
          data={invoices}
          keyExtractor={(r) => r.id}
          loading={loadingInvoices}
          emptyMessage="No invoices yet."
        />
      )}

      {/* ===== HISTORY ===== */}
      {tab === 'history' && (
        <Table<SubscriptionHistory>
          columns={historyColumns}
          data={history}
          keyExtractor={(r) => r.id}
          loading={loadingHistory}
          emptyMessage="No subscription history."
        />
      )}

      {/* ===== CHANGE / RENEW PLAN DIALOG ===== */}
      <Dialog open={changePlanOpen} onClose={closeDialog} className="max-w-2xl">
        <DialogHeader onClose={closeDialog}>
          <DialogTitle>
            {(isSuspended || isGrace) ? 'Renew Your Subscription' : 'Change Subscription Plan'}
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="max-h-[75vh] overflow-y-auto">
          {(isSuspended || isGrace) && (
            <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-700">
              {isSuspended
                ? 'Your school is currently offline. Select a plan and pay to restore access immediately.'
                : `Grace period: ${daysRemaining} day(s) remaining. Renew now to keep your school online.`}
            </div>
          )}

          {/* Step 1 — Plan selection */}
          {!showCardForm && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {plans.filter(p => !p.is_enterprise && p.is_active && p.is_visible).map((plan) => {
                  const isCurrent = plan.id === subscription?.plan_id;
                  const isSelected = selectedPlanId === plan.id || (isCurrent && selectedPlanId === null && (isSuspended || isGrace));
                  return (
                    <button
                      key={plan.id}
                      onClick={() => setSelectedPlanId(plan.id)}
                      className={`text-left rounded-xl border-2 p-5 transition-all ${
                        isSelected
                          ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-500/20'
                          : 'border-gray-200 hover:border-primary-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                        <div className="flex gap-1">
                          {isCurrent && <Badge variant="info">Current</Badge>}
                          {isSelected && <CheckCircle2 className="w-5 h-5 text-primary-600" />}
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">
                        ${plan.price_usd}
                        <span className="text-sm font-normal text-gray-500">/{plan.billing_cycle}</span>
                      </p>
                      <p className="text-sm text-gray-500 mt-1">Up to {plan.student_limit.toLocaleString()} students</p>
                      {plan.trial_days > 0 && (
                        <p className="text-xs text-green-600 mt-0.5">{plan.trial_days}-day free trial · {plan.grace_days}d grace</p>
                      )}
                      {plan.description && <p className="text-xs text-gray-400 mt-2">{plan.description}</p>}
                      <div className="flex flex-wrap gap-1 mt-3">
                        {Object.entries(plan.features ?? {}).filter(([, v]) => v).slice(0, 5).map(([k]) => (
                          <Badge key={k} variant="outline" className="text-xs">{k}</Badge>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Step 2 — MTN MoMo Payment */}
          {showCardForm && selectedPlan && (
            <div className="space-y-4">
              {/* Plan summary */}
              <div className="rounded-xl border border-primary-200 bg-primary-50/40 p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{selectedPlan.name} Plan</p>
                  <p className="text-xs text-slate-500">{selectedPlan.billing_cycle}</p>
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  ${selectedPlan.price_usd}
                </p>
              </div>

              {/* Success state */}
              {mtnSuccess ? (
                <div className="text-center py-6 space-y-3">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                    <CheckCircle2 className="h-7 w-7 text-green-600" />
                  </div>
                  <p className="font-semibold text-green-800">Payment Successful!</p>
                  <p className="text-sm text-slate-500">Your subscription has been activated.</p>
                  <Button size="sm" onClick={closeDialog} className="w-full">Close</Button>
                </div>
              ) : mtnReferenceId && mtnPollStatus === 'PENDING' ? (
                /* Waiting for approval */
                <div className="text-center py-4 space-y-4">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-yellow-50 border-2 border-yellow-200">
                    <RefreshCw className="h-6 w-6 text-yellow-600 animate-spin" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">Waiting for approval</p>
                    <p className="text-sm text-slate-500 mt-1">
                      A prompt has been sent to <strong>{mtnPhone}</strong>. Open your MTN MoMo app to approve.
                    </p>
                  </div>
                  <button
                    onClick={() => { stopMtnPolling(); setMtnReferenceId(''); setMtnPollStatus(''); setMtnError(''); }}
                    className="text-xs text-slate-400 hover:text-slate-600 underline"
                  >
                    Cancel — try a different number
                  </button>
                </div>
              ) : (
                /* MTN phone form */
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-yellow-50 border border-yellow-200">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-yellow-400 shrink-0">
                      <Smartphone className="h-4 w-4 text-yellow-900" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">MTN Mobile Money</p>
                      <p className="text-xs text-slate-500">Pay securely with your MTN MoMo wallet</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">
                      MTN Mobile Number
                    </label>
                    <input
                      type="tel"
                      value={mtnPhone}
                      onChange={(e) => { setMtnPhone(e.target.value); setMtnError(''); }}
                      placeholder="e.g. 0880123456"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/20"
                    />
                  </div>

                  {mtnError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      {mtnError}
                    </div>
                  )}

                  <button
                    onClick={handleMtnPay}
                    disabled={mtnLoading || !mtnPhone.trim()}
                    className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-yellow-400 px-6 py-3 text-sm font-semibold text-yellow-900 hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {mtnLoading
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</>
                      : <><Smartphone className="h-4 w-4" /> Pay ${selectedPlan.price_usd} with MTN MoMo</>
                    }
                  </button>

                  <Button variant="outline" size="sm" onClick={() => { setShowCardForm(false); resetMtnState(); }} className="w-full">
                    Back to Plans
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogBody>

        {/* Show footer only on step 1 */}
        {!showCardForm && (
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={closeDialog}>Cancel</Button>
            <Button
              size="sm"
              disabled={!selectedPlanId}
              onClick={() => {
                if (!selectedPlanId && (isSuspended || isGrace) && subscription?.plan_id) {
                  setSelectedPlanId(subscription.plan_id);
                }
                setShowCardForm(true);
              }}
              icon={<Smartphone className="w-4 h-4" />}
            >
              {selectedPlan ? `Pay $${selectedPlan.price_usd} with MTN MoMo` : 'Select a Plan'}
            </Button>
          </DialogFooter>
        )}
      </Dialog>

    </div>
  );
}
