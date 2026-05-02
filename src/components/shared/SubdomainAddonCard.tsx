import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { supabase } from '@/lib/supabase';
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
} from 'lucide-react';
import type { School } from '@/types/school.types';

// ── Stripe singleton ───────────────────────────────────────────────────────────

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY as string);

// ── helpers ────────────────────────────────────────────────────────────────────

const PLATFORM_APEX = 'schoolsyncedu.com';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isExpiringSoon(iso: string | null) {
  if (!iso) return false;
  return new Date(iso).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;
}

function isExpired(iso: string | null) {
  if (!iso) return true;
  return new Date(iso).getTime() < Date.now();
}

// ── inner Stripe card form (must live inside <Elements>) ──────────────────────

interface CardFormProps {
  schoolId: string;
  subdomain: string;
  onSuccess: (paidUntil: string) => void;
  onCancel: () => void;
}

function CardPaymentForm({ schoolId, subdomain, onSuccess, onCancel }: CardFormProps) {
  const stripe   = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [cardError, setCardError] = useState('');

  const handlePay = async () => {
    if (!stripe || !elements) return;
    setProcessing(true);
    setCardError('');
    try {
      // Fetch the school's active subscription_id (needed by the PaymentIntent edge fn)
      const { data: subs } = await supabase
        .from('school_subscriptions')
        .select('id')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })
        .limit(1);

      const subscriptionId = subs?.[0]?.id ?? schoolId;
      const txRef = generateTxRef(schoolId);

      const { clientSecret, paymentIntentId } = await createPaymentIntent({
        amountUsd:      1,
        schoolId,
        subscriptionId,
        planName:       'Subdomain Add-on',
        txRef,
      });

      const cardEl = elements.getElement(CardElement);
      if (!cardEl) throw new Error('Card element unavailable');

      const { paymentIntent, error: stripeError } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: cardEl },
      });
      if (stripeError) throw new Error(stripeError.message ?? 'Card payment failed');
      if (paymentIntent?.status !== 'succeeded') throw new Error('Payment did not complete');

      // Activate the subdomain in the database
      const { data: result, error: rpcError } = await supabase.rpc('activate_subdomain_addon', {
        p_school_id:   schoolId,
        p_subdomain:   subdomain,
        p_gateway_ref: paymentIntentId,
        p_tx_ref:      txRef,
      });

      if (rpcError) throw new Error(rpcError.message);
      if (!result?.success) throw new Error(result?.error ?? 'Activation failed');

      onSuccess(result.paid_until as string);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setCardError(msg);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
      <p className="text-xs font-semibold text-blue-800">Enter card details — $1.00 USD / month</p>
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
            : <><ShieldCheck className="h-4 w-4" /> Pay $1.00 &amp; Activate</>}
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
        <ShieldCheck className="h-3.5 w-3.5" /> Secure payment · Renew monthly to keep your subdomain
      </p>
    </div>
  );
}

// ── public component ──────────────────────────────────────────────────────────

interface SubdomainAddonCardProps {
  school: School;
  /** Called after a successful activation/deactivation so the parent can refetch */
  onRefresh: () => void;
}

export default function SubdomainAddonCard({ school, onRefresh }: SubdomainAddonCardProps) {
  const schoolId = school.id;

  // Whether the add-on is paid and active
  const isPaid   = school.subdomain_active && !isExpired(school.subdomain_paid_until);
  const hasName  = !!school.subdomain;

  // Local UI state
  const [nameInput,    setNameInput]    = useState(school.subdomain ?? '');
  const [nameError,    setNameError]    = useState('');
  const [showPayForm,  setShowPayForm]  = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  // Normalize: lowercase, strip non-allowed chars
  const sanitize = (v: string) => v.toLowerCase().replace(/[^a-z0-9-]/g, '');

  const validateName = (v: string): string => {
    if (v.length < 3) return 'Minimum 3 characters.';
    if (v.length > 30) return 'Maximum 30 characters.';
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(v)) return 'Must start and end with a letter or number. Only letters, numbers, and hyphens allowed.';
    return '';
  };

  const handleNameChange = (v: string) => {
    const s = sanitize(v);
    setNameInput(s);
    setNameError(validateName(s));
  };

  const handlePaySuccess = (paidUntil: string) => {
    setShowPayForm(false);
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

  const subdomainUrl = nameInput
    ? `https://${nameInput}.${PLATFORM_APEX}`
    : null;

  const activeUrl = school.subdomain && isPaid
    ? `https://${school.subdomain}.${PLATFORM_APEX}`
    : null;

  // ── ACTIVE STATE ──────────────────────────────────────────────────────────────
  if (isPaid && hasName) {
    const expiringSoon = isExpiringSoon(school.subdomain_paid_until);
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

        <div className="flex items-center gap-1.5 text-xs text-emerald-700">
          <Calendar className="h-3.5 w-3.5" />
          Paid until {formatDate(school.subdomain_paid_until!)}
          {expiringSoon && (
            <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 font-medium">
              Expiring soon
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {expiringSoon && (
            <button
              type="button"
              onClick={() => setShowPayForm(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              <Sparkles className="h-3.5 w-3.5" /> Renew $1
            </button>
          )}
          <button
            type="button"
            onClick={handleDeactivate}
            disabled={deactivating}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            {deactivating
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <RotateCcw className="h-3.5 w-3.5" />}
            Revert to Default URL
          </button>
        </div>

        {showPayForm && (
          <Elements stripe={stripePromise}>
            <CardPaymentForm
              schoolId={schoolId}
              subdomain={school.subdomain!}
              onSuccess={handlePaySuccess}
              onCancel={() => setShowPayForm(false)}
            />
          </Elements>
        )}
      </div>
    );
  }

  // ── LOCKED / UNPAID STATE ─────────────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Lock className="h-5 w-5 text-slate-400 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-slate-800">Custom Subdomain</p>
          <p className="text-xs text-slate-500">
            Get a clean URL like <span className="font-mono">yourschool.{PLATFORM_APEX}</span> — $1 / month
          </p>
        </div>
        <span className="ml-auto rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
          $1 / mo
        </span>
      </div>

      {/* Name input */}
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Choose your subdomain name</label>
        <div className="flex items-center gap-0">
          <input
            type="text"
            value={nameInput}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="yourschool"
            maxLength={30}
            className="flex-1 rounded-l-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono"
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

      {/* Pay button or card form */}
      {!showPayForm ? (
        <button
          type="button"
          disabled={!nameInput || !!nameError}
          onClick={() => setShowPayForm(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Lock className="h-4 w-4" />
          Pay $1 to Activate
          <ArrowRight className="h-4 w-4" />
        </button>
      ) : (
        <Elements stripe={stripePromise}>
          <CardPaymentForm
            schoolId={schoolId}
            subdomain={nameInput}
            onSuccess={handlePaySuccess}
            onCancel={() => setShowPayForm(false)}
          />
        </Elements>
      )}

      <p className="text-xs text-slate-400">
        Your default URL (<span className="font-mono">schoolsyncedu.com/school/{school.slug}</span>) always stays active. The subdomain is an optional extra.
      </p>
    </div>
  );
}
