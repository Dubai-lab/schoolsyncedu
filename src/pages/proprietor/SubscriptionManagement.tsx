import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { supabase } from '@/lib/supabase';
import {
  proprietorSubscriptionService,
  proprietorBillingService,
  savedCardsService,
  type SavedPaymentToken,
} from '@/services/proprietorService';
import {
  createPaymentIntent,
  recordSubscriptionPayment,
  upgradeSubscriptionPlan,
  savePaymentCard,
  createSetupIntent,
  saveCardFromSetupIntent,
  generateTxRef,
  getStripe,
} from '@/services/stripeService';
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
  Loader2,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Star,
  Shield,
} from 'lucide-react';

type Tab = 'overview' | 'invoices' | 'history' | 'cards';

// ── Stripe card form (must be inside <Elements>) ───────────────────────────────

interface StripeUpgradeFormProps {
  schoolId: string;
  subscriptionId: string;
  plan: SubscriptionPlan;
  currentPlanId: string;
  userEmail: string;
  userName: string;
  onSuccess: (invoiceNumber: string, expiresAt: string | null, amountUsd: number) => void;
  onCancel: () => void;
}

function StripeUpgradeForm({
  schoolId, subscriptionId, plan, currentPlanId, userEmail, userName, onSuccess, onCancel,
}: StripeUpgradeFormProps) {
  const stripe   = useStripe();
  const elements = useElements();

  const [processing, setProcessing] = useState(false);
  const [cardError,  setCardError]  = useState('');

  const handlePay = async () => {
    if (!stripe || !elements) return;
    setProcessing(true);
    setCardError('');

    try {
      const txRef = generateTxRef(schoolId);

      const { clientSecret, paymentIntentId } = await createPaymentIntent({
        amountUsd:      plan.price_usd,
        schoolId,
        subscriptionId,
        planName:       plan.name,
        txRef,
      });

      const cardEl = elements.getElement(CardElement);
      if (!cardEl) throw new Error('Card element unavailable');

      const { paymentIntent, error: stripeError } = await stripe.confirmCardPayment(
        clientSecret,
        {
          payment_method: {
            card: cardEl,
            billing_details: { name: userName, email: userEmail },
          },
        },
      );

      if (stripeError) throw new Error(stripeError.message ?? 'Card declined');
      if (paymentIntent?.status !== 'succeeded') throw new Error('Payment incomplete');

      const isRenewal = plan.id === currentPlanId;

      if (isRenewal) {
        const result = await recordSubscriptionPayment({
          schoolId,
          subscriptionId,
          amountUsd:  plan.price_usd,
          gatewayRef: paymentIntentId,
          txRef,
        });
        savePaymentCard({ paymentIntentId, schoolId });
        onSuccess(result.invoiceNumber, result.expiresAt, plan.price_usd);
      } else {
        const result = await upgradeSubscriptionPlan({
          schoolId,
          subscriptionId,
          newPlanId:  plan.id,
          amountUsd:  plan.price_usd,
          gatewayRef: paymentIntentId,
          txRef,
        });
        savePaymentCard({ paymentIntentId, schoolId });
        onSuccess(result.invoiceNumber, result.expiresAt, plan.price_usd);
      }
    } catch (err) {
      setCardError(err instanceof Error ? err.message : String(err));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary-200 bg-primary-50/40 p-4">
        <p className="text-sm font-semibold text-slate-800">{plan.name} Plan</p>
        <p className="text-2xl font-bold text-slate-900 mt-1">
          ${plan.price_usd}
          <span className="text-sm font-normal text-slate-500">/{plan.billing_cycle}</span>
        </p>
        <p className="text-xs text-slate-500 mt-0.5">Up to {plan.student_limit.toLocaleString()} students</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1.5">
          <CreditCard className="inline h-3.5 w-3.5 mr-1" />
          Card Details
        </label>
        <div className="rounded-lg border border-slate-300 px-3 py-3 focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-400/20 transition-all bg-white">
          <CardElement
            options={{
              hidePostalCode: true,
              style: {
                base: {
                  fontSize: '14px',
                  color: '#1e293b',
                  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
                  '::placeholder': { color: '#94a3b8' },
                },
                invalid: { color: '#dc2626' },
              },
            }}
          />
        </div>
      </div>

      {cardError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {cardError}
        </div>
      )}

      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        <Shield className="h-3.5 w-3.5 shrink-0" />
        Encrypted · Powered by Stripe
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={processing} className="flex-1">
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handlePay}
          disabled={!stripe || processing}
          loading={processing}
          icon={processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
          className="flex-1"
        >
          {processing ? 'Processing...' : `Pay $${plan.price_usd}`}
        </Button>
      </div>
    </div>
  );
}

// ── Add Card form (inside <Elements>) ─────────────────────────────────────────

interface AddCardFormProps {
  schoolId: string;
  userEmail: string;
  userName: string;
  onSuccess: () => void;
  onCancel: () => void;
}

function AddCardForm({ schoolId, userEmail, userName, onSuccess, onCancel }: AddCardFormProps) {
  const stripe   = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [cardError,  setCardError]  = useState('');

  const handleSave = async () => {
    if (!stripe || !elements) return;
    setProcessing(true);
    setCardError('');
    try {
      const { clientSecret, setupIntentId } = await createSetupIntent(schoolId);

      const cardEl = elements.getElement(CardElement);
      if (!cardEl) throw new Error('Card element unavailable');

      const { error: stripeError } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: {
          card: cardEl,
          billing_details: { name: userName, email: userEmail },
        },
      });

      if (stripeError) throw new Error(stripeError.message ?? 'Card could not be saved');

      await saveCardFromSetupIntent({ setupIntentId, schoolId });
      onSuccess();
    } catch (err) {
      setCardError(err instanceof Error ? err.message : String(err));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1.5">
          <CreditCard className="inline h-3.5 w-3.5 mr-1" />
          Card Details
        </label>
        <div className="rounded-lg border border-slate-300 px-3 py-3 focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-400/20 transition-all bg-white">
          <CardElement
            options={{
              hidePostalCode: true,
              style: {
                base: {
                  fontSize: '14px',
                  color: '#1e293b',
                  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
                  '::placeholder': { color: '#94a3b8' },
                },
                invalid: { color: '#dc2626' },
              },
            }}
          />
        </div>
      </div>

      {cardError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {cardError}
        </div>
      )}

      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        <Shield className="h-3.5 w-3.5 shrink-0" />
        Card is saved securely via Stripe — no charge will be made
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={processing} className="flex-1">
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!stripe || processing}
          loading={processing}
          icon={<CreditCard className="w-4 h-4" />}
          className="flex-1"
        >
          {processing ? 'Saving...' : 'Save Card'}
        </Button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function SubscriptionManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const schoolId = user?.school_id;
  const [tab, setTab] = useState<Tab>('overview');
  const [changePlanOpen, setChangePlanOpen]     = useState(false);
  const [selectedPlanId, setSelectedPlanId]     = useState<string | null>(null);
  const [showCardForm,   setShowCardForm]        = useState(false);
  const [addCardOpen,    setAddCardOpen]         = useState(false);

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

  const { data: savedCards = [], refetch: refetchCards } = useFetch<SavedPaymentToken[]>(
    ['prop-saved-cards', schoolId!],
    () => savedCardsService.list(schoolId!),
    { enabled: !!schoolId }
  );

  const toggleAutoRenew = useMutate(
    (autoRenew: boolean) => proprietorSubscriptionService.toggleAutoRenew(subscription!.id, autoRenew),
    [['prop-subscription', schoolId!]]
  );

  const removeCard = useMutate(
    (id: string) => savedCardsService.remove(id),
    [['prop-saved-cards', schoolId!]]
  );

  const setDefaultCard = useMutate(
    (id: string) => savedCardsService.setDefault(id, schoolId!),
    [['prop-saved-cards', schoolId!]]
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

  const closeDialog = () => {
    setChangePlanOpen(false);
    setSelectedPlanId(null);
    setShowCardForm(false);
  };

  const handlePaymentSuccess = (invoiceNumber: string, expiresAt: string | null, amountUsd: number) => {
    // Capture plan name before closeDialog() clears selectedPlanId
    const planName = selectedPlan?.name ?? subscription?.plan.name ?? '';
    closeDialog();
    notify.success(`Subscription activated! Invoice: ${invoiceNumber}`);

    // Send billing confirmation email (non-blocking)
    void (async () => {
      try {
        const { data: school } = await supabase.from('schools').select('name').eq('id', schoolId!).single();
        await supabase.functions.invoke('process-subscription-notifications', {
          body: {
            trigger:        'payment_confirmed',
            school_id:      schoolId,
            school_name:    school?.name ?? '',
            owner_email:    user?.email ?? '',
            plan_name:      planName,
            amount_usd:     amountUsd,
            invoice_number: invoiceNumber,
            expires_at:     expiresAt ?? undefined,
          },
        });
      } catch {
        // non-critical — never block navigation on email failure
      }
    })();

    navigate('/proprietor');
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
    { key: 'cards',     label: `Saved Cards (${savedCards.length})` },
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

      {/* ===== SAVED CARDS ===== */}
      {tab === 'cards' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Saved Payment Cards</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Cards saved here will be used for subscription renewals.
              </p>
            </div>
            <Button size="sm" icon={<CreditCard className="w-4 h-4" />} onClick={() => setAddCardOpen(true)}>
              Add Card
            </Button>
          </div>

          {savedCards.length === 0 ? (
            <Card className="p-10 text-center">
              <CreditCard className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No saved cards yet</p>
              <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">
                Add a card now or it will be saved automatically after your first payment.
              </p>
              <Button size="sm" className="mt-4" onClick={() => setAddCardOpen(true)} icon={<CreditCard className="w-4 h-4" />}>
                Add Card
              </Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {savedCards.map((card) => (
                <Card key={card.id} className={`p-4 ${card.is_default ? 'border-primary-300 bg-primary-50/40' : ''}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">💳</div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white capitalize">
                          {card.card_type ?? 'Card'} •••• {card.card_last4 ?? '****'}
                          {card.is_default && (
                            <Badge variant="success" className="ml-2 text-xs">Default</Badge>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">
                          {card.card_name && `${card.card_name} · `}
                          {card.card_expiry ? `Expires ${card.card_expiry}` : ''}
                          {card.email && ` · ${card.email}`}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Saved {new Date(card.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!card.is_default && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDefaultCard.mutate(card.id, {
                            onSuccess: () => notify.success('Default card updated'),
                          })}
                        >
                          <Star className="w-3.5 h-3.5 mr-1" /> Set Default
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-700"
                        onClick={() => removeCard.mutate(card.id, {
                          onSuccess: () => { notify.success('Card removed'); refetchCards(); },
                        })}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
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

          {/* Step 2 — Card payment form */}
          {showCardForm && selectedPlan && (
            <Elements stripe={getStripe()}>
              <StripeUpgradeForm
                schoolId={schoolId!}
                subscriptionId={subscription!.id}
                plan={selectedPlan}
                currentPlanId={subscription?.plan_id ?? ''}
                userEmail={user?.email ?? ''}
                userName={user?.full_name || user?.email || ''}
                onSuccess={handlePaymentSuccess}
                onCancel={() => setShowCardForm(false)}
              />
            </Elements>
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
              icon={<CreditCard className="w-4 h-4" />}
            >
              {selectedPlan ? `Pay $${selectedPlan.price_usd} with Card` : 'Select a Plan'}
            </Button>
          </DialogFooter>
        )}
      </Dialog>

      {/* ===== ADD CARD DIALOG ===== */}
      <Dialog open={addCardOpen} onClose={() => setAddCardOpen(false)} className="max-w-md">
        <DialogHeader onClose={() => setAddCardOpen(false)}>
          <DialogTitle>Add Payment Card</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p className="text-sm text-gray-500 mb-4">
            Save a card for future subscription renewals. No charge will be made now.
          </p>
          <Elements stripe={getStripe()}>
            <AddCardForm
              schoolId={schoolId!}
              userEmail={user?.email ?? ''}
              userName={user?.full_name || user?.email || ''}
              onSuccess={() => {
                setAddCardOpen(false);
                refetchCards();
                notify.success('Card saved successfully');
              }}
              onCancel={() => setAddCardOpen(false)}
            />
          </Elements>
        </DialogBody>
      </Dialog>
    </div>
  );
}
