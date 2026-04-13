import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFlutterwave, closePaymentModal } from 'flutterwave-react-v3';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import {
  proprietorSubscriptionService,
  proprietorBillingService,
  savedCardsService,
  type SavedPaymentToken,
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
  Plus,
  ShieldCheck,
} from 'lucide-react';

type Tab = 'overview' | 'invoices' | 'history' | 'cards';

// Card brand icon map
const CARD_BRAND: Record<string, string> = {
  visa: '💳',
  mastercard: '💳',
  verve: '💳',
  mtn: '📱',
  orange: '📱',
};

export default function SubscriptionManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const schoolId = user?.school_id;
  const [tab, setTab] = useState<Tab>('overview');
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [upgradeProcessing, setUpgradeProcessing] = useState(false);
  // After payment — offer to save card
  const [capturedCard, setCapturedCard] = useState<{
    token: string; last4: string; type: string; expiry: string; name: string; email: string;
  } | null>(null);
  const [savingCard, setSavingCard] = useState(false);

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

  // Derive plan to use for payment — for renewal, default to current plan
  const selectedPlan = plans.find((p) => p.id === selectedPlanId)
    ?? (selectedPlanId === '__current__' ? subscription?.plan : undefined);

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

  const openRenewDialog = () => {
    // Pre-select current plan for renewal
    setSelectedPlanId(subscription?.plan_id ?? null);
    setChangePlanOpen(true);
  };

  const handleChangePlan = () => {
    const planId = selectedPlanId === '__current__' ? subscription?.plan_id : selectedPlanId;
    if (!planId || !subscription || !upgradeFlutterwaveConfig) return;

    handleFlutterPayment({
      callback: async (response) => {
        closePaymentModal();

        if (response.status === 'successful' || response.status === 'completed') {
          setUpgradeProcessing(true);
          try {
            const r = response as unknown as Record<string, unknown>;
            const result = await upgradeSubscriptionPlan({
              schoolId: schoolId!,
              subscriptionId: subscription.id,
              newPlanId: planId,
              amountUsd: selectedPlan!.price_usd,
              gatewayRef: String(r.transaction_id ?? r.flw_ref ?? ''),
              txRef: upgradeFlutterwaveConfig.tx_ref,
              paymentMethod: mapFlutterwaveMethod(String(r.payment_type ?? '')),
            });
            setChangePlanOpen(false);
            setSelectedPlanId(null);
            notify.success(`Subscription activated! Invoice: ${result.invoiceNumber}`);

            // Capture card token if paid by card (for saving)
            const card = r.card as Record<string, string> | undefined;
            if (card?.token) {
              setCapturedCard({
                token: card.token,
                last4: card.last_4digits ?? card.last4 ?? '',
                type: card.type ?? card.issuer ?? 'card',
                expiry: card.expiry ?? '',
                name: (r.customer as Record<string, string>)?.name ?? user?.full_name ?? '',
                email: (r.customer as Record<string, string>)?.email ?? user?.email ?? '',
              });
            }

            navigate('/proprietor');
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            const r = response as unknown as Record<string, unknown>;
            notify.error(`Activation failed: ${msg}. Payment ref: ${String(r.transaction_id ?? r.flw_ref ?? '')}. Contact support.`);
          } finally {
            setUpgradeProcessing(false);
          }
        } else {
          notify.error('Payment was not completed. Please try again.');
        }
      },
      onClose: () => {},
    });
  };

  const handleSaveCard = async () => {
    if (!capturedCard || !schoolId) return;
    setSavingCard(true);
    try {
      await savedCardsService.save(schoolId, {
        provider: 'flutterwave',
        flw_token: capturedCard.token,
        card_last4: capturedCard.last4,
        card_type: capturedCard.type.toLowerCase(),
        card_expiry: capturedCard.expiry,
        card_name: capturedCard.name,
        email: capturedCard.email,
        is_default: savedCards.length === 0,
      });
      notify.success('Card saved for future payments');
      setCapturedCard(null);
      refetchCards();
    } catch {
      notify.error('Failed to save card');
    }
    setSavingCard(false);
  };

  const [now] = useState(() => Date.now());
  const daysRemaining = subscription?.expires_at
    ? Math.max(0, Math.ceil((new Date(subscription.expires_at).getTime() - now) / 86400000))
    : null;

  const isSuspended = subscription?.status === 'suspended';
  const isGrace = subscription?.status === 'grace';
  const isTrial = subscription?.status === 'trial';
  const isActive = subscription?.status === 'active';
  const isExpiringSoon = (isActive || isTrial) && daysRemaining !== null && daysRemaining <= 7;

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
    { key: 'cards', label: `Saved Cards (${savedCards.length})` },
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
      <Breadcrumb items={[{ label: 'Proprietor', href: '/proprietor' }, { label: 'Subscription & Billing' }]} />

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Subscription & Billing</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage your school's subscription plan, invoices, and saved payment cards.
        </p>
      </div>

      {/* ── Urgent status banners ─────────────────────────────────────────── */}
      {isSuspended && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-start gap-3 flex-1">
              <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-800 text-lg">Your school is offline</p>
                <p className="text-sm text-red-700 mt-0.5">
                  Your subscription has expired. Staff and students cannot log in until you renew.
                  Renew now to restore access immediately.
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
                <p className="text-sm text-orange-700 mt-0.5">
                  Your subscription expired but you have a grace period. Renew before it ends or your
                  school will go offline automatically.
                </p>
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
              Renew now to avoid any interruption to your school.
            </p>
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white shrink-0" onClick={openRenewDialog}>
              Renew
            </Button>
          </div>
        </div>
      )}

      {/* ── Offer to save card after payment ─────────────────────────────── */}
      {capturedCard && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-3 flex-1">
              <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-blue-800">Save your card for future renewals?</p>
                <p className="text-xs text-blue-600 mt-0.5">
                  {capturedCard.type.toUpperCase()} •••• {capturedCard.last4} · expires {capturedCard.expiry}
                </p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" loading={savingCard} onClick={handleSaveCard}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Save Card
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setCapturedCard(null)}>Dismiss</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
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
                <Button size="sm" variant={isSuspended || isGrace ? 'outline' : 'primary'} icon={<ArrowUpCircle className="w-4 h-4" />} onClick={() => { setSelectedPlanId(null); setChangePlanOpen(true); }}>
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

      {/* ===== SAVED CARDS TAB ===== */}
      {tab === 'cards' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Saved Payment Cards</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Cards saved here are used for subscription renewals. Pay once via Flutterwave and save your card to avoid re-entering details.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={openRenewDialog}>
              <Plus className="w-4 h-4 mr-1.5" /> Add via Payment
            </Button>
          </div>

          {savedCards.length === 0 ? (
            <Card className="p-10 text-center">
              <CreditCard className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No saved cards yet</p>
              <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">
                After making a payment via Flutterwave, you'll be offered the option to save your card for faster future renewals.
              </p>
              <Button className="mt-4" size="sm" onClick={openRenewDialog}>
                Make a Payment to Save Card
              </Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {savedCards.map((card) => (
                <Card key={card.id} className={`p-4 ${card.is_default ? 'border-primary-300 bg-primary-50/40' : ''}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{CARD_BRAND[card.card_type?.toLowerCase() ?? ''] ?? '💳'}</div>
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
                          onSuccess: () => notify.success('Card removed'),
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

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-500">
              Card tokens are securely stored via Flutterwave. We never store your full card number or CVV.
              You can remove a saved card at any time.
            </p>
          </div>
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

      {/* ===== CHANGE / RENEW PLAN DIALOG ===== */}
      <Dialog open={changePlanOpen} onClose={() => { setChangePlanOpen(false); setSelectedPlanId(null); }} className="max-w-2xl">
        <DialogHeader onClose={() => { setChangePlanOpen(false); setSelectedPlanId(null); }}>
          <DialogTitle>
            {(isSuspended || isGrace) ? 'Renew Your Subscription' : 'Change Subscription Plan'}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="max-h-[70vh] overflow-y-auto">
          {(isSuspended || isGrace) && (
            <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-700">
              {isSuspended
                ? 'Your school is currently offline. Select a plan below and pay to restore access immediately.'
                : `Grace period: ${daysRemaining} day(s) remaining. Renew now to keep your school online.`}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <p className="text-sm text-gray-500 mt-1">Up to {plan.student_limit} students</p>
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
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => { setChangePlanOpen(false); setSelectedPlanId(null); }}>Cancel</Button>
          <Button
            size="sm"
            loading={upgradeProcessing}
            disabled={!selectedPlanId || upgradeProcessing}
            onClick={() => {
              // If nothing explicitly selected, default to current plan for renewal
              if (!selectedPlanId && (isSuspended || isGrace) && subscription?.plan_id) {
                setSelectedPlanId(subscription.plan_id);
              }
              handleChangePlan();
            }}
            icon={upgradeProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
          >
            {selectedPlan
              ? `Pay $${selectedPlan.price_usd} & ${isSuspended || isGrace ? 'Renew' : 'Switch Plan'}`
              : 'Select a Plan'}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
