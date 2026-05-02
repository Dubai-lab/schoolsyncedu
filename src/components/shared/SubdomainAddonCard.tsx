import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { supabase } from '@/lib/supabase';
import { schoolSiteService } from '@/services/schoolSiteService';
import { subdomainAddonService } from '@/services/subdomainAddonService';
import type { SubdomainPricing, SubdomainPayment } from '@/services/subdomainAddonService';
import { createPaymentIntent, generateTxRef } from '@/services/stripeService';
import { notify } from '@/components/shared/Toast';
import {
  Lock,
  Unlock,
  Globe,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  RotateCcw,
  ShieldCheck,
  Calendar,
  Sparkles,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Receipt,
} from 'lucide-react';
import type { School } from '@/types/school.types';

// ── Stripe singleton ───────────────────────────────────────────────────────────

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY as string);

// ── helpers ────────────────────────────────────────────────────────────────────

const PLATFORM_APEX = 'schoolsyncedu.com';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── Status helpers ─────────────────────────────────────────────────────────────

type SubdomainStatus = 'active' | 'grace' | 'expired' | 'fresh';

function getStatus(school: School): SubdomainStatus {
  if (!school.subdomain_active || !school.subdomain_paid_until) {
    return school.subdomain ? 'expired' : 'fresh';
  }
  const paidUntil = new Date(school.subdomain_paid_until);
  const now = new Date();
  if (paidUntil > now) return 'active';
  const graceCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (paidUntil > graceCutoff) return 'grace';
  return 'expired';
}

// ── Card payment form ──────────────────────────────────────────────────────────

interface CardPaymentFormProps {
  schoolId: string;
  subdomain: string;
  plan: 'monthly' | 'yearly';
  amountUsd: number;
  onSuccess: (paidUntil: string) => void;
  onCancel: () => void;
}

function CardPaymentForm({ schoolId, subdomain, plan, amountUsd, onSuccess, onCancel }: CardPaymentFormProps) {
  const stripe   = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [cardError, setCardError]   = useState('');

  const handlePay = async () => {
    if (!stripe || !elements) return;
    const cardEl = elements.getElement(CardElement);
    if (!cardEl) return;
    setProcessing(true);
    setCardError('');
    try {
      const txRef    = generateTxRef();
      const { clientSecret, paymentIntentId } = await createPaymentIntent(amountUsd, txRef);

      const { paymentIntent, error: stripeError } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: cardEl },
      });
      if (stripeError) throw new Error(stripeError.message ?? 'Card payment failed');
      if (paymentIntent?.status !== 'succeeded') throw new Error('Payment did not complete');

      const { data: result, error: rpcError } = await supabase.rpc('activate_subdomain_addon', {
        p_school_id:   schoolId,
        p_subdomain:   subdomain,
        p_gateway_ref: paymentIntentId,
        p_tx_ref:      txRef,
        p_plan:        plan,
        p_amount_usd:  amountUsd,
      });

      if (rpcError) throw new Error(rpcError.message);
      if (!result?.success) throw new Error(result?.error ?? 'Activation failed');

      onSuccess(result.paid_until as string);
    } catch (err) {
      setCardError(err instanceof Error ? err.message : 'Payment failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Card Details</p>
      <div className="rounded-lg border border-gray-300 bg-white px-3 py-3 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-400/20 transition-all">
        <CardElement
          options={{
            hidePostalCode: true,
            style: {
              base: { fontSize: '14px', color: '#1e293b', fontFamily: 'ui-sans-serif, system-ui, sans-serif', '::placeholder': { color: '#94a3b8' } },
              invalid: { color: '#dc2626' },
            },
          }}
        />
      </div>
      {cardError && (
        <p className="flex items-center gap-1.5 text-xs text-red-600">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {cardError}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handlePay}
          disabled={!stripe || processing}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-bold text-white shadow transition hover:bg-blue-700 disabled:opacity-50"
        >
          {processing
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
            : <><ShieldCheck className="h-4 w-4" /> Pay ${amountUsd.toFixed(2)} &amp; Activate</>}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={processing}
          className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
      <p className="text-center text-xs text-gray-400 flex items-center justify-center gap-1">
        <ShieldCheck className="h-3.5 w-3.5" /> Secure payment powered by Stripe
      </p>
    </div>
  );
}

// ── Plan picker ────────────────────────────────────────────────────────────────

interface PlanPickerProps {
  selected: 'monthly' | 'yearly';
  onChange: (plan: 'monthly' | 'yearly') => void;
  monthlyPrice: number;
  yearlyPrice: number;
  discountPct: number;
}

function PlanPicker({ selected, onChange, monthlyPrice, yearlyPrice, discountPct }: PlanPickerProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        type="button"
        onClick={() => onChange('monthly')}
        className={`rounded-xl border p-3 text-left transition-all ${
          selected === 'monthly'
            ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
            : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Monthly</p>
        <p className="text-xl font-extrabold text-slate-900">
          ${monthlyPrice.toFixed(2)}
          <span className="text-xs font-normal text-slate-400">/mo</span>
        </p>
      </button>

      <button
        type="button"
        onClick={() => onChange('yearly')}
        className={`rounded-xl border p-3 text-left transition-all ${
          selected === 'yearly'
            ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
            : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Yearly</p>
          {discountPct > 0 && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              {discountPct}% off
            </span>
          )}
        </div>
        <p className="text-xl font-extrabold text-slate-900">
          ${yearlyPrice.toFixed(2)}
          <span className="text-xs font-normal text-slate-400">/yr</span>
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          ${(yearlyPrice / 12).toFixed(2)}/mo effective
        </p>
      </button>
    </div>
  );
}

// ── Payment history ────────────────────────────────────────────────────────────

function PaymentHistory({ schoolId }: { schoolId: string }) {
  const [open, setOpen]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const [records, setRecords]   = useState<SubdomainPayment[]>([]);
  const [loaded, setLoaded]     = useState(false);

  const load = async () => {
    if (loaded) { setOpen((v) => !v); return; }
    setLoading(true);
    try {
      const data = await subdomainAddonService.getPaymentHistory(schoolId);
      setRecords(data);
      setLoaded(true);
      setOpen(true);
    } catch {
      notify.error('Could not load payment history');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border-t border-slate-100 pt-3">
      <button
        type="button"
        onClick={load}
        className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Receipt className="h-3.5 w-3.5" />}
        Payment History
        {!loading && (open ? <ChevronUp className="h-3 w-3 ml-0.5" /> : <ChevronDown className="h-3 w-3 ml-0.5" />)}
      </button>

      {open && loaded && (
        <div className="mt-2 rounded-lg border border-slate-100 overflow-hidden">
          {records.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-400">No payment records found.</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Date</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Plan</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Amount</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Valid Until</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-3 py-2 text-slate-600">{formatDateTime(r.paid_at)}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 font-medium ${
                        r.plan === 'yearly'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {r.plan === 'yearly' ? 'Annual' : 'Monthly'}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-semibold text-slate-700">${Number(r.amount_usd).toFixed(2)}</td>
                    <td className="px-3 py-2 text-slate-600">{formatDate(r.paid_until)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface SubdomainAddonCardProps {
  school: School;
  onRefresh: () => void;
}

export default function SubdomainAddonCard({ school, onRefresh }: SubdomainAddonCardProps) {
  const schoolId = school.id;
  const status   = getStatus(school);

  // Pricing
  const [pricing, setPricing]           = useState<SubdomainPricing | null>(null);
  const [pricingLoading, setPricingLoading] = useState(true);

  useEffect(() => {
    subdomainAddonService.getPricing()
      .then(setPricing)
      .catch(() => {})
      .finally(() => setPricingLoading(false));
  }, []);

  const monthlyPrice = pricing?.monthly_price_usd ?? 1;
  const discountPct  = pricing?.yearly_discount_percent ?? 20;
  const yearlyPrice  = subdomainAddonService.calcYearlyPrice(monthlyPrice, discountPct);

  // UI state
  const [nameInput,    setNameInput]    = useState(school.subdomain ?? '');
  const [nameError,    setNameError]    = useState('');
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');
  const [showPayForm,  setShowPayForm]  = useState(false);
  const [showUpgrade,  setShowUpgrade]  = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [checking,     setChecking]     = useState(false);

  // Normalize: lowercase, strip non-allowed chars
  const sanitize = (v: string) => v.toLowerCase().replace(/[^a-z0-9-]/g, '');

  const validateName = (v: string): string => {
    if (v.length < 3) return 'Minimum 3 characters.';
    if (v.length > 30) return 'Maximum 30 characters.';
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(v)) return 'Must start and end with a letter or number.';
    return '';
  };

  const handleNameChange = (v: string) => {
    const s = sanitize(v);
    setNameInput(s);
    setNameError(validateName(s));
  };

  const handleActivateClick = async () => {
    const err = validateName(nameInput);
    if (err) { setNameError(err); return; }
    setChecking(true);
    try {
      const existing = await schoolSiteService.getBySubdomain(nameInput);
      if (existing && existing.id !== schoolId) {
        setNameError('This name is already taken by another school. Please choose a different name.');
        return;
      }
      setShowPayForm(true);
    } catch {
      setShowPayForm(true);
    } finally {
      setChecking(false);
    }
  };

  const handlePaySuccess = (paidUntil: string) => {
    setShowPayForm(false);
    setShowUpgrade(false);
    notify.success(`Subdomain activated! Paid until ${formatDate(paidUntil)}.`);
    onRefresh();
  };

  const handleDeactivate = async () => {
    setDeactivating(true);
    try {
      const { error } = await supabase.rpc('deactivate_subdomain_addon', { p_school_id: schoolId });
      if (error) throw error;
      notify.success('Reverted to default URL.');
      onRefresh();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Failed to deactivate');
    } finally {
      setDeactivating(false);
    }
  };

  const activeUrl = school.subdomain ? `https://${school.subdomain}.${PLATFORM_APEX}` : null;
  const amountForPlan = (plan: 'monthly' | 'yearly') => plan === 'yearly' ? yearlyPrice : monthlyPrice;

  // ── GRACE STATE ───────────────────────────────────────────────────────────────
  if (status === 'grace') {
    const graceEnd = new Date(new Date(school.subdomain_paid_until!).getTime() + 24 * 60 * 60 * 1000);
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 space-y-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Subdomain Expired — Grace Period Active</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Your subdomain expired on {formatDate(school.subdomain_paid_until!)}. It still resolves until{' '}
              <strong>{formatDateTime(graceEnd.toISOString())}</strong>. Renew now to avoid interruption.
            </p>
          </div>
        </div>
        <div className="font-mono text-sm font-semibold text-amber-800">{activeUrl}</div>

        {!showPayForm ? (
          <>
            <PlanPicker
              selected={selectedPlan}
              onChange={setSelectedPlan}
              monthlyPrice={monthlyPrice}
              yearlyPrice={yearlyPrice}
              discountPct={discountPct}
            />
            <button
              type="button"
              disabled={pricingLoading}
              onClick={() => setShowPayForm(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-amber-700 disabled:opacity-40"
            >
              <Sparkles className="h-4 w-4" />
              Renew {selectedPlan === 'yearly' ? 'Annual' : 'Monthly'} — ${amountForPlan(selectedPlan).toFixed(2)}
            </button>
          </>
        ) : (
          <Elements stripe={stripePromise}>
            <CardPaymentForm
              schoolId={schoolId}
              subdomain={school.subdomain!}
              plan={selectedPlan}
              amountUsd={amountForPlan(selectedPlan)}
              onSuccess={handlePaySuccess}
              onCancel={() => setShowPayForm(false)}
            />
          </Elements>
        )}
        <PaymentHistory schoolId={schoolId} />
      </div>
    );
  }

  // ── ACTIVE STATE ──────────────────────────────────────────────────────────────
  if (status === 'active') {
    const paidUntil   = new Date(school.subdomain_paid_until!);
    const daysLeft    = Math.ceil((paidUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const expiresToday = daysLeft <= 1;
    const expiringSoon = daysLeft <= 7;
    const isMonthly   = (school.subdomain_plan ?? 'monthly') === 'monthly';

    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Unlock className="h-5 w-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-800">Custom Subdomain — Active</p>
              <a
                href={activeUrl ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-mono text-emerald-700 hover:underline"
              >
                {activeUrl}
              </a>
            </div>
          </div>
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-700">
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {expiresToday ? (
              <strong className="text-amber-700">Expires today! Renew now.</strong>
            ) : (
              <>Paid until {formatDate(school.subdomain_paid_until!)} ({daysLeft} day{daysLeft !== 1 ? 's' : ''} left)</>
            )}
          </span>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium capitalize">
            {school.subdomain_plan ?? 'monthly'} plan
          </span>
          {expiringSoon && !expiresToday && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 font-medium">
              Expiring soon
            </span>
          )}
        </div>

        {/* Renew / Upgrade buttons */}
        {!showPayForm && !showUpgrade && (
          <div className="flex flex-wrap gap-2">
            {(expiringSoon || expiresToday) && (
              <button
                type="button"
                onClick={() => setShowPayForm(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Renew {school.subdomain_plan === 'yearly' ? 'Annual' : 'Monthly'}
              </button>
            )}
            {isMonthly && (
              <button
                type="button"
                onClick={() => setShowUpgrade(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50"
              >
                <TrendingUp className="h-3.5 w-3.5" />
                Upgrade to Annual — ${yearlyPrice.toFixed(2)}/yr
              </button>
            )}
            <button
              type="button"
              onClick={handleDeactivate}
              disabled={deactivating}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              {deactivating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              Revert to Default URL
            </button>
          </div>
        )}

        {/* Renew payment form */}
        {showPayForm && (
          <Elements stripe={stripePromise}>
            <CardPaymentForm
              schoolId={schoolId}
              subdomain={school.subdomain!}
              plan={school.subdomain_plan ?? 'monthly'}
              amountUsd={amountForPlan(school.subdomain_plan ?? 'monthly')}
              onSuccess={handlePaySuccess}
              onCancel={() => setShowPayForm(false)}
            />
          </Elements>
        )}

        {/* Upgrade to yearly form */}
        {showUpgrade && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-blue-800">Upgrade to Annual Plan</p>
                <p className="text-xs text-blue-600 mt-0.5">
                  Your remaining {daysLeft} day{daysLeft !== 1 ? 's' : ''} will be carried over.
                  New expiry: <strong>{formatDate(new Date(paidUntil.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString())}</strong>.
                </p>
              </div>
            </div>
            <Elements stripe={stripePromise}>
              <CardPaymentForm
                schoolId={schoolId}
                subdomain={school.subdomain!}
                plan="yearly"
                amountUsd={yearlyPrice}
                onSuccess={handlePaySuccess}
                onCancel={() => setShowUpgrade(false)}
              />
            </Elements>
          </div>
        )}

        <PaymentHistory schoolId={schoolId} />
      </div>
    );
  }

  // ── LOCKED / EXPIRED STATE ────────────────────────────────────────────────────
  const isExpired = status === 'expired';
  const subdomainUrl = nameInput ? `https://${nameInput}.${PLATFORM_APEX}` : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Lock className="h-5 w-5 text-slate-400 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-slate-800">Custom Subdomain</p>
          <p className="text-xs text-slate-500">
            {isExpired
              ? 'Your subdomain has expired. Renew to restore access.'
              : <>Get a clean URL like <span className="font-mono">yourschool.{PLATFORM_APEX}</span></>}
          </p>
        </div>
      </div>

      {isExpired && school.subdomain && (
        <div className="flex items-center gap-1.5 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>
            <span className="font-mono font-semibold">{school.subdomain}.{PLATFORM_APEX}</span> is reserved for your school.
            Renew to reactivate it.
          </span>
        </div>
      )}

      {/* Name input */}
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">
          {isExpired ? 'Your subdomain name' : 'Choose your subdomain name'}
        </label>
        <div className="flex items-center">
          <input
            type="text"
            value={nameInput}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="yourschool"
            maxLength={30}
            readOnly={isExpired && !!school.subdomain}
            className={`flex-1 rounded-l-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono ${
              isExpired && school.subdomain ? 'bg-slate-50 text-slate-500' : ''
            }`}
          />
          <span className="rounded-r-lg border border-l-0 border-slate-300 bg-slate-100 px-3 py-2.5 text-sm text-slate-500 font-mono whitespace-nowrap">
            .{PLATFORM_APEX}
          </span>
        </div>
        {nameError && (
          <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
            <AlertCircle className="h-3 w-3" /> {nameError}
          </p>
        )}
        {subdomainUrl && !nameError && (
          <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
            <Globe className="h-3 w-3" /> Preview: <span className="font-mono">{subdomainUrl}</span>
          </p>
        )}
      </div>

      {/* Plan picker */}
      {!pricingLoading && (
        <PlanPicker
          selected={selectedPlan}
          onChange={setSelectedPlan}
          monthlyPrice={monthlyPrice}
          yearlyPrice={yearlyPrice}
          discountPct={discountPct}
        />
      )}

      {/* Pay button or card form */}
      {!showPayForm ? (
        <button
          type="button"
          disabled={!nameInput || !!nameError || checking || pricingLoading}
          onClick={handleActivateClick}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {checking
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Checking availability...</>
            : <>
                <Lock className="h-4 w-4" />
                Pay ${amountForPlan(selectedPlan).toFixed(2)} to {isExpired ? 'Reactivate' : 'Activate'}
                <ArrowRight className="h-4 w-4" />
              </>}
        </button>
      ) : (
        <Elements stripe={stripePromise}>
          <CardPaymentForm
            schoolId={schoolId}
            subdomain={nameInput}
            plan={selectedPlan}
            amountUsd={amountForPlan(selectedPlan)}
            onSuccess={handlePaySuccess}
            onCancel={() => setShowPayForm(false)}
          />
        </Elements>
      )}

      {isExpired && <PaymentHistory schoolId={schoolId} />}
    </div>
  );
}
