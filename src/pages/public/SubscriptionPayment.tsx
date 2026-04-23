import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import {
  fetchPaymentInfo,
  createPaymentIntent,
  recordSubscriptionPayment,
  savePaymentCard,
  generateTxRef,
  getStripe,
  type PaymentPageData,
} from '@/services/stripeService';
import { discountService } from '@/services/adminService';
import { supabase } from '@/lib/supabase';
import type { Discount } from '@/types/report.types';
import {
  CreditCard,
  CheckCircle2,
  Shield,
  Loader2,
  ArrowRight,
  BookOpen,
  AlertTriangle,
  Tag,
  X,
  Lock,
} from 'lucide-react';

// ── Stripe card form (must be inside <Elements>) ───────────────────────────────

interface CardFormProps {
  paymentData: PaymentPageData;
  amount: number;
  appliedDiscount: Discount | null;
  email: string | null;
  onSuccess: (invoiceNumber: string) => void;
}

function StripeCardForm({ paymentData, amount, appliedDiscount, email, onSuccess }: CardFormProps) {
  const stripe   = useStripe();
  const elements = useElements();

  const [processing, setProcessing] = useState(false);
  const [cardError,  setCardError]  = useState('');

  const handlePay = async () => {
    if (!stripe || !elements) return;
    setProcessing(true);
    setCardError('');

    try {
      const txRef = generateTxRef(paymentData.school.id);

      // 1. Create PaymentIntent server-side (secret key stays in Edge Function)
      const { clientSecret, paymentIntentId } = await createPaymentIntent({
        amountUsd:      amount,
        schoolId:       paymentData.school.id,
        subscriptionId: paymentData.subscription.id,
        planName:       paymentData.plan.name,
        txRef,
      });

      // 2. Confirm card payment in the browser
      const cardEl = elements.getElement(CardElement);
      if (!cardEl) throw new Error('Card element unavailable');

      const { paymentIntent, error: stripeError } = await stripe.confirmCardPayment(
        clientSecret,
        {
          payment_method: {
            card: cardEl,
            billing_details: {
              name:  paymentData.owner.name,
              email: paymentData.owner.email,
            },
          },
        },
      );

      if (stripeError) throw new Error(stripeError.message ?? 'Card payment failed');
      if (paymentIntent?.status !== 'succeeded') throw new Error('Payment incomplete');

      // 3. Record payment in database
      const result = await recordSubscriptionPayment({
        schoolId:       paymentData.school.id,
        subscriptionId: paymentData.subscription.id,
        amountUsd:      amount,
        gatewayRef:     paymentIntentId,
        txRef,
      });

      // 4a. Save card details immediately (non-blocking)
      savePaymentCard({ paymentIntentId, schoolId: paymentData.school.id });

      // 4. Increment coupon uses if a discount was applied
      if (appliedDiscount) {
        discountService.incrementCouponUses(appliedDiscount.id).catch(() => {/* non-critical */});
      }

      // 5. Send payment confirmed email (non-blocking)
      supabase.functions.invoke('process-subscription-notifications', {
        body: {
          trigger:        'payment_confirmed',
          school_id:      paymentData.school.id,
          school_name:    paymentData.school.name,
          owner_email:    email,
          plan_name:      paymentData.plan.name,
          amount_usd:     amount,
          invoice_number: result.invoiceNumber ?? '',
          expires_at:     result.expiresAt ?? undefined,
        },
      }).catch(() => {/* non-critical */});

      onSuccess(result.invoiceNumber ?? '');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setCardError(msg);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Card input */}
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
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {cardError}
        </div>
      )}

      <button
        onClick={handlePay}
        disabled={!stripe || processing}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-6 py-3.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 shadow-lg shadow-primary-200/50 transition-all"
      >
        {processing ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
        ) : (
          <><Lock className="h-4 w-4" /> Pay ${amount.toFixed(2)} USD</>
        )}
      </button>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Shield className="h-3.5 w-3.5 shrink-0" />
          256-bit SSL · Powered by Stripe
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <CreditCard className="h-3.5 w-3.5 shrink-0" />
          Visa, Mastercard, American Express accepted
        </div>
      </div>
    </div>
  );
}

// ── Main page component ────────────────────────────────────────────────────────

export default function SubscriptionPayment() {
  const [searchParams] = useSearchParams();

  const schoolId = searchParams.get('school');
  const email    = searchParams.get('email');

  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState('');
  const [paymentData,     setPaymentData]     = useState<PaymentPageData | null>(null);
  const [paymentSuccess,  setPaymentSuccess]  = useState(false);
  const [invoiceNumber,   setInvoiceNumber]   = useState('');

  // Coupon / discount
  const [couponInput,      setCouponInput]      = useState('');
  const [couponLoading,    setCouponLoading]    = useState(false);
  const [appliedDiscount,  setAppliedDiscount]  = useState<Discount | null>(null);
  const [couponError,      setCouponError]      = useState('');
  const [couponSuccess,    setCouponSuccess]    = useState('');

  useEffect(() => {
    if (!schoolId || !email) {
      setError('Invalid payment link. Please register again.');
      setLoading(false);
      return;
    }
    fetchPaymentInfo(schoolId, email)
      .then((data) => setPaymentData(data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load payment details'))
      .finally(() => setLoading(false));
  }, [schoolId, email]);

  function discountedPrice(basePrice: number): number {
    if (!appliedDiscount) return basePrice;
    if (appliedDiscount.type === 'percentage') {
      return Math.max(0, basePrice - (basePrice * appliedDiscount.value) / 100);
    }
    return Math.max(0, basePrice - appliedDiscount.value);
  }

  const handleApplyCoupon = async () => {
    if (!couponInput.trim() || !paymentData) return;
    setCouponLoading(true);
    setCouponError('');
    setCouponSuccess('');
    try {
      const discount = await discountService.validateCoupon(couponInput.trim(), paymentData.plan.id);
      if (!discount) {
        setCouponError('Invalid or expired coupon code.');
        setAppliedDiscount(null);
      } else {
        setAppliedDiscount(discount);
        const saving = discount.type === 'percentage'
          ? `${discount.value}% off`
          : `$${discount.value} off`;
        setCouponSuccess(`Coupon applied! ${saving} — ${discount.name}`);
      }
    } catch {
      setCouponError('Could not validate coupon. Please try again.');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedDiscount(null);
    setCouponInput('');
    setCouponError('');
    setCouponSuccess('');
  };

  const finalAmount = paymentData ? discountedPrice(paymentData.plan.price_usd) : 0;

  // ── SUCCESS ──
  if (paymentSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center px-4">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 shadow-lg shadow-green-200/50">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Payment Successful!</h1>
          <p className="mt-3 text-slate-500 leading-relaxed">
            Your <strong className="text-slate-700">{paymentData?.plan.name}</strong> subscription for{' '}
            <strong className="text-slate-700">{paymentData?.school.name}</strong> is now active.
          </p>
          {invoiceNumber && (
            <p className="mt-2 text-xs text-slate-400">
              Invoice: <span className="font-mono">{invoiceNumber}</span>
            </p>
          )}
          <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4">
            <p className="text-sm text-green-800 font-medium">Your school portal is ready!</p>
            <p className="mt-1 text-xs text-green-600">
              Log in to your proprietor dashboard to set up your school, invite staff, and enroll students.
            </p>
          </div>
          <Link
            to="/auth/login"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary-600 px-8 py-3 text-sm font-semibold text-white hover:bg-primary-700 shadow-lg shadow-primary-200/50 transition-all"
          >
            Go to Login <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  // ── LOADING ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600 mx-auto" />
          <p className="mt-3 text-sm text-slate-500">Loading payment details...</p>
        </div>
      </div>
    );
  }

  // ── ERROR (no data) ──
  if (error && !paymentData) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-7 w-7 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Something went wrong</h2>
          <p className="mt-2 text-sm text-slate-500">{error}</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              to="/register"
              className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Back to Register
            </Link>
            <Link
              to="/auth/login"
              className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!paymentData) return null;

  // ── PAYMENT PAGE ──
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Header */}
      <header className="border-b border-slate-100 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600 text-white">
              <BookOpen className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold text-slate-900">
              School<span className="text-primary-600">Sync</span>
            </span>
          </Link>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Shield className="h-3.5 w-3.5" />
            Secure Payment
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-10 sm:py-16">
        <div className="text-center mb-10">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Activate Your School</h1>
          <p className="mt-2 text-sm text-slate-500">
            Complete your payment to activate <strong>{paymentData.school.name}</strong>'s portal.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
          {/* Order Summary */}
          <div className="lg:col-span-3 space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900 mb-6">Order Summary</h2>

              <div className="rounded-xl border border-primary-200 bg-primary-50/50 p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{paymentData.plan.name} Plan</h3>
                    <p className="mt-1 text-sm text-slate-500">{paymentData.plan.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-slate-900">${paymentData.plan.price_usd}</p>
                    <p className="text-xs text-slate-500">/{paymentData.plan.billing_cycle}</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-primary-200 space-y-2">
                  <p className="text-sm text-slate-600">
                    <span className="text-green-600">✓</span> Up to {paymentData.plan.student_limit?.toLocaleString()} students
                  </p>
                  <p className="text-sm text-slate-600">
                    <span className="text-green-600">✓</span> {paymentData.plan.trial_days}-day trial included
                  </p>
                  {paymentData.plan.features && Object.entries(paymentData.plan.features)
                    .filter(([, v]) => v)
                    .slice(0, 4)
                    .map(([k]) => (
                      <p key={k} className="text-sm text-slate-600">
                        <span className="text-green-600">✓</span>{' '}
                        {k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                      </p>
                    ))}
                </div>
              </div>

              {/* Coupon code */}
              <div className="mt-6">
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  <Tag className="inline h-3.5 w-3.5 mr-1" />
                  Discount / Coupon Code
                </label>
                {appliedDiscount ? (
                  <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm">
                    <span className="flex-1 text-green-700 font-medium">{couponSuccess}</span>
                    <button onClick={handleRemoveCoupon} className="text-green-600 hover:text-green-800">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError(''); }}
                      onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                      placeholder="Enter code"
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase tracking-wider focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20"
                    />
                    <button
                      onClick={handleApplyCoupon}
                      disabled={couponLoading || !couponInput.trim()}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    >
                      {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
                    </button>
                  </div>
                )}
                {couponError && <p className="mt-1.5 text-xs text-red-600">{couponError}</p>}
              </div>

              {/* Totals */}
              <div className="mt-6 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">School</span>
                  <span className="font-medium text-slate-700">{paymentData.school.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Account Owner</span>
                  <span className="font-medium text-slate-700">{paymentData.owner.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Email</span>
                  <span className="font-medium text-slate-700">{paymentData.owner.email}</span>
                </div>
                {appliedDiscount && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Subtotal</span>
                      <span className="text-slate-700">${paymentData.plan.price_usd} USD</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-green-600 font-medium">Discount ({appliedDiscount.name})</span>
                      <span className="text-green-600 font-medium">
                        -{appliedDiscount.type === 'percentage'
                          ? `${appliedDiscount.value}%`
                          : `$${appliedDiscount.value}`}
                      </span>
                    </div>
                  </>
                )}
                <div className="border-t border-slate-100 pt-3 flex justify-between text-base">
                  <span className="font-semibold text-slate-900">Total</span>
                  <span className="font-bold text-slate-900">${finalAmount.toFixed(2)} USD</span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Coming Soon */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-50">
                <CreditCard className="h-7 w-7 text-primary-400" />
              </div>
              <span className="inline-block rounded-full bg-amber-100 text-amber-700 text-xs font-semibold px-3 py-1 mb-3">
                Coming Soon
              </span>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">Online Payment</h2>
              <p className="text-sm text-slate-500 leading-relaxed">
                Online payments are not yet available. Please contact our support team to complete
                your subscription activation.
              </p>
              <a
                href="mailto:support@schoolsyncedu.com"
                className="mt-5 inline-flex items-center justify-center gap-2 w-full rounded-xl bg-primary-600 px-6 py-3.5 text-sm font-semibold text-white hover:bg-primary-700 transition-all"
              >
                <ArrowRight className="h-4 w-4" />
                Contact Support to Activate
              </a>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center">
              <p className="text-xs text-slate-500">
                Need help? Email us at{' '}
                <a href="mailto:support@schoolsyncedu.com" className="text-primary-600 hover:underline">
                  support@schoolsyncedu.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
