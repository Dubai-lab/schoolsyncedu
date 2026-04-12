import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFlutterwave, closePaymentModal } from 'flutterwave-react-v3';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import {
  proprietorSubscriptionService,
  proprietorBillingService,
} from '@/services/proprietorService';
import {
  buildFlutterwaveConfig,
  upgradeSubscriptionPlan,
  mapFlutterwaveMethod,
} from '@/services/flutterwaveService';
import type {
  Subscription,
  SubscriptionPlan,
  BillingInvoice,
  PaymentMethodRecord,
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
  Wallet,
  Loader2,
} from 'lucide-react';

type Tab = 'overview' | 'invoices' | 'history';

export default function SubscriptionManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const schoolId = user?.school_id;
  const [tab, setTab] = useState<Tab>('overview');
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [upgradeProcessing, setUpgradeProcessing] = useState(false);

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

  const { data: paymentMethods = [] } = useFetch<PaymentMethodRecord[]>(
    ['prop-payment-methods', schoolId!],
    () => proprietorBillingService.getPaymentMethods(schoolId!),
    { enabled: !!schoolId }
  );

  const toggleAutoRenew = useMutate(
    (autoRenew: boolean) => proprietorSubscriptionService.toggleAutoRenew(subscription!.id, autoRenew),
    [['prop-subscription', schoolId!]]
  );

  // Build Flutterwave config for the selected plan
  const selectedPlan = plans.find((p) => p.id === selectedPlanId);
  const upgradeFlutterwaveConfig = selectedPlan && subscription && user
    ? buildFlutterwaveConfig({
        amount: selectedPlan.price_usd,
        email: user.email,
        name: user.full_name || user.email,
        phone: user.phone || '',
        planName: selectedPlan.name,
        schoolId: schoolId!,
        subscriptionId: subscription.id,
      })
    : null;

  const handleFlutterPayment = useFlutterwave(upgradeFlutterwaveConfig ?? {
    public_key: '',
    tx_ref: '',
    amount: 0,
    currency: 'USD',
    payment_options: '',
    customer: { email: '', name: '', phone_number: '' },
    customizations: { title: '', description: '', logo: '' },
  });

  const handleToggleRenew = () => {
    if (!subscription) return;
    toggleAutoRenew.mutate(!subscription.auto_renew, {
      onSuccess: () => notify.success(`Auto-renew ${subscription.auto_renew ? 'disabled' : 'enabled'}`),
      onError: () => notify.error('Failed to update auto-renew'),
    });
  };

  const handleChangePlan = () => {
    if (!selectedPlanId || !selectedPlan || !subscription || !upgradeFlutterwaveConfig) return;

    handleFlutterPayment({
      callback: async (response) => {
        closePaymentModal();

        if (response.status === 'successful' || response.status === 'completed') {
          setUpgradeProcessing(true);
          try {
            const result = await upgradeSubscriptionPlan({
              schoolId: schoolId!,
              subscriptionId: subscription.id,
              newPlanId: selectedPlanId,
              amountUsd: selectedPlan.price_usd,
              gatewayRef: String(response.transaction_id ?? response.flw_ref ?? ''),
              txRef: upgradeFlutterwaveConfig.tx_ref,
              paymentMethod: mapFlutterwaveMethod((response as unknown as Record<string, string>).payment_type),
            });
            setChangePlanOpen(false);
            setSelectedPlanId(null);
            notify.success(
              `Plan upgraded to ${result.newPlan}! Invoice: ${result.invoiceNumber}`
            );
            // Redirect back to proprietor dashboard
            navigate('/proprietor');
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error('Upgrade failed:', msg);
            const ref = String(response.transaction_id ?? response.flw_ref ?? '');
            notify.error(`Activation failed: ${msg}. Payment ref: ${ref}. Contact support with this reference.`);
          } finally {
            setUpgradeProcessing(false);
          }
        } else {
          notify.error('Payment was not completed. Please try again.');
        }
      },
      onClose: () => {
        // User closed the Flutterwave modal without completing
      },
    });
  };

  const [now] = useState(() => Date.now());
  const daysRemaining = subscription?.expires_at
    ? Math.max(0, Math.ceil((new Date(subscription.expires_at).getTime() - now) / 86400000))
    : null;

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
    { key: 'overview', label: 'Overview' },
    { key: 'invoices', label: `Invoices (${invoices.length})` },
    { key: 'history', label: 'History' },
  ];

  const invoiceColumns: Column<BillingInvoice>[] = [
    { key: 'invoice_number', header: 'Invoice #', render: (r) => <span className="font-mono text-sm">{r.invoice_number}</span> },
    { key: 'amount_usd', header: 'Amount', render: (r) => `$${r.amount_usd.toLocaleString()}` },
    { key: 'status', header: 'Status', render: (r) => <Badge variant={invoiceStatusVariant(r.status)}>{r.status}</Badge> },
    { key: 'due_date', header: 'Due Date', render: (r) => new Date(r.due_date).toLocaleDateString() },
    { key: 'paid_at', header: 'Paid', render: (r) => r.paid_at ? new Date(r.paid_at).toLocaleDateString() : '—' },
  ];

  const historyColumns: Column<SubscriptionHistory>[] = [
    { key: 'changed_at', header: 'Date', render: (r) => new Date(r.changed_at).toLocaleString() },
    { key: 'previous_status', header: 'From', render: (r) => <Badge variant={statusVariant(r.previous_status)}>{r.previous_status}</Badge> },
    { key: 'new_status', header: 'To', render: (r) => <Badge variant={statusVariant(r.new_status)}>{r.new_status}</Badge> },
    { key: 'reason', header: 'Reason', render: (r) => <span className="text-sm text-gray-600">{r.reason ?? '—'}</span> },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Proprietor', href: '/proprietor' }, { label: 'Subscription' }]} />

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Subscription & Billing</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage your school's subscription plan, invoices, and payment methods.
        </p>
      </div>

      {/* Tabs */}
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

      {/* ===== OVERVIEW TAB ===== */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {/* Current Plan Card */}
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
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Expires</p>
                  <p className="text-sm text-gray-700">
                    {new Date(subscription.expires_at).toLocaleDateString()}
                    {daysRemaining !== null && (
                      <span className={`ml-1 ${daysRemaining <= 7 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                        ({daysRemaining}d)
                      </span>
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
                      <Badge variant="outline" className="text-xs">+{Object.values(subscription.plan.features).filter(Boolean).length - 4}</Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-gray-200 flex gap-3">
                <Button size="sm" icon={<ArrowUpCircle className="w-4 h-4" />} onClick={() => setChangePlanOpen(true)}>
                  Change Plan
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="p-6">
              <p className="text-gray-500">{loadingSub ? 'Loading...' : 'No active subscription found.'}</p>
            </Card>
          )}

          {/* Payment Methods */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Wallet className="w-5 h-5 text-primary-600" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Payment Methods</h2>
            </div>
            {paymentMethods.length === 0 ? (
              <p className="text-sm text-gray-500">No payment methods on file.</p>
            ) : (
              <div className="space-y-3">
                {paymentMethods.map((pm) => (
                  <div key={pm.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                          {pm.method_type} {pm.last_four ? `•••• ${pm.last_four}` : ''}
                        </p>
                      </div>
                    </div>
                    {pm.is_default && <Badge variant="success">Default</Badge>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ===== INVOICES TAB ===== */}
      {tab === 'invoices' && (
        <Table<BillingInvoice>
          columns={invoiceColumns}
          data={invoices}
          keyExtractor={(r) => r.id}
          loading={loadingInvoices}
          emptyMessage="No invoices yet."
        />
      )}

      {/* ===== HISTORY TAB ===== */}
      {tab === 'history' && (
        <Table<SubscriptionHistory>
          columns={historyColumns}
          data={history}
          keyExtractor={(r) => r.id}
          loading={loadingHistory}
          emptyMessage="No subscription history."
        />
      )}

      {/* ===== CHANGE PLAN MODAL ===== */}
      <Dialog open={changePlanOpen} onClose={() => setChangePlanOpen(false)} className="max-w-2xl">
        <DialogHeader onClose={() => setChangePlanOpen(false)}>
          <DialogTitle>Change Subscription Plan</DialogTitle>
        </DialogHeader>
        <DialogBody className="max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {plans.map((plan) => {
              const isCurrent = plan.id === subscription?.plan_id;
              const isSelected = selectedPlanId === plan.id;
              return (
                <button
                  key={plan.id}
                  disabled={isCurrent}
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={`text-left rounded-xl border-2 p-5 transition-all ${
                    isCurrent
                      ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                      : isSelected
                        ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-500/20'
                        : 'border-gray-200 hover:border-primary-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                    {isCurrent && <Badge variant="info">Current</Badge>}
                    {isSelected && <CheckCircle2 className="w-5 h-5 text-primary-600" />}
                  </div>
                  <p className="text-2xl font-bold text-gray-900">${plan.price_usd}<span className="text-sm font-normal text-gray-500">/{plan.billing_cycle}</span></p>
                  <p className="text-sm text-gray-500 mt-1">Up to {plan.student_limit} students</p>
                  {plan.description && <p className="text-xs text-gray-400 mt-2">{plan.description}</p>}
                  <div className="flex flex-wrap gap-1 mt-3">
                    {Object.entries(plan.features ?? {}).filter(([, v]) => v).map(([k]) => (
                      <Badge key={k} variant="outline" className="text-xs">{k}</Badge>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => { setChangePlanOpen(false); setSelectedPlanId(null); }}>Cancel</Button>
          <Button
            size="sm"
            loading={upgradeProcessing}
            disabled={!selectedPlanId || upgradeProcessing}
            onClick={handleChangePlan}
            icon={upgradeProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
          >
            {selectedPlan ? `Pay $${selectedPlan.price_usd} & Upgrade` : 'Select a Plan'}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
