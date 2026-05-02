import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { publicApplicationService } from '@/services/registrarService';
import { schoolSiteService } from '@/services/schoolSiteService';
import { useDomainContext } from '@/context/DomainContext';
import { supabase } from '@/lib/supabase';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import MobileMoneyForm from '@/components/payment/MobileMoneyForm';
import FlutterwaveForm from '@/components/payment/FlutterwaveForm';
import type { PaymentConfigPublic } from '@/services/proprietorPaymentService';
import {
  Search,
  ArrowLeft,
  CheckCircle,
  Clock,
  FileText,
  XCircle,
  AlertCircle,
  Loader2,
  GraduationCap,
  Calendar,
  User,
  BookOpen,
  Landmark,
  CreditCard,
  Lock,
  ShieldCheck,
  Copy,
  CheckCheck,
  CheckCircle2,
  Building2,
} from 'lucide-react';

type StatusResult = Awaited<ReturnType<typeof publicApplicationService.checkStatus>>;

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType; description: string }> = {
  submitted: { label: 'Submitted', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Clock, description: 'Your application has been received and is awaiting review.' },
  under_review: { label: 'Under Review', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: FileText, description: 'Your application is currently being reviewed by the admissions team.' },
  documents_requested: { label: 'Documents Requested', color: 'bg-orange-100 text-orange-800 border-orange-200', icon: AlertCircle, description: 'Additional documents are needed. Please contact the school.' },
  accepted: { label: 'Accepted', color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle, description: 'Congratulations! Your application has been accepted.' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800 border-red-200', icon: XCircle, description: 'Unfortunately, your application was not accepted at this time.' },
  waitlisted: { label: 'Waitlisted', color: 'bg-slate-100 text-slate-800 border-slate-200', icon: Clock, description: 'You have been placed on the waiting list. We will contact you if a spot becomes available.' },
  enrolled: { label: 'Enrolled', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: GraduationCap, description: 'You have been enrolled! Please contact the school for next steps.' },
  withdrawn: { label: 'Withdrawn', color: 'bg-gray-100 text-gray-700 border-gray-200', icon: XCircle, description: 'This application has been withdrawn.' },
};

const TIMELINE_ORDER = ['submitted', 'under_review', 'accepted', 'enrolled'];

// ── Stripe card form for application fee on status page ───────────────────────

interface StatusStripeCardFormProps {
  schoolId: string;
  applicationId: string;
  amountUsd: number;
  onSuccess: () => void;
  onError: (msg: string) => void;
}

function StatusStripeCardForm({ schoolId, applicationId, amountUsd, onSuccess, onError }: StatusStripeCardFormProps) {
  const stripe   = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  const handlePay = async () => {
    if (!stripe || !elements) return;
    setProcessing(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('school-stripe-payment', {
        body: { school_id: schoolId, application_id: applicationId, amount_usd: amountUsd },
      });
      if (fnError) {
        let msg = fnError.message;
        try {
          const body = await (fnError as unknown as { context: Response }).context?.json?.();
          if (body?.error) msg = body.error;
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);

      const { clientSecret, paymentIntentId } = data as { clientSecret: string; paymentIntentId: string };
      const cardEl = elements.getElement(CardElement);
      if (!cardEl) throw new Error('Card element unavailable');

      const { paymentIntent, error: stripeError } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: cardEl },
      });
      if (stripeError) throw new Error(stripeError.message ?? 'Card payment failed');
      if (paymentIntent?.status !== 'succeeded') throw new Error('Payment did not complete');

      const { createClient } = await import('@supabase/supabase-js');
      const anonClient = createClient(
        import.meta.env.VITE_SUPABASE_URL as string,
        import.meta.env.VITE_SUPABASE_ANON_KEY as string,
        { auth: { persistSession: false, autoRefreshToken: false, storageKey: 'sb-statfee-token' } },
      );
      await anonClient.rpc('mark_application_fee_paid_stripe', {
        p_application_id:    applicationId,
        p_payment_intent_id: paymentIntentId,
      });

      onSuccess();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">Card Details</label>
        <div className="rounded-lg border border-gray-300 px-3 py-3 focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-400/20 transition-all bg-white">
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
      </div>
      <button
        onClick={handlePay}
        disabled={!stripe || processing}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-purple-600 py-3 text-sm font-bold text-white shadow transition hover:bg-purple-700 disabled:opacity-50"
      >
        {processing
          ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
          : <><Lock className="h-4 w-4" /> Pay ${amountUsd.toFixed(2)} with Card</>}
      </button>
      <p className="text-center text-xs text-gray-400 flex items-center justify-center gap-1">
        <ShieldCheck className="h-3.5 w-3.5" /> Secure payment powered by Stripe
      </p>
    </div>
  );
}

export default function ApplicationStatus() {
  const { slug } = useParams<{ slug: string }>();
  const { isCustomDomain } = useDomainContext();
  const [applicationNumber, setApplicationNumber] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<StatusResult | null>(null);

  // Payment state
  const [payConfig, setPayConfig]           = useState<PaymentConfigPublic | null>(null);
  const [payFeePaid, setPayFeePaid]         = useState(false);
  const [paySuccess, setPaySuccess]         = useState(false);
  const [payError, setPayError]             = useState('');
  const [copiedBankRef, setCopiedBankRef]   = useState(false);

  const stripePromise = useMemo(
    () => payConfig?.stripe_enabled && payConfig.stripe_public_key
      ? loadStripe(payConfig.stripe_public_key)
      : null,
    [payConfig?.stripe_enabled, payConfig?.stripe_public_key],
  );

  // Clean URL on subdomain (hide /school/slug/status → /status)
  useEffect(() => {
    if (isCustomDomain) window.history.replaceState(null, '', '/status');
  }, [isCustomDomain]);

  // Redirect to subdomain if the school has one active and we're on the default URL
  useEffect(() => {
    if (!slug || isCustomDomain) return;
    schoolSiteService.getBySlug(slug).then((data) => {
      if (data?.subdomain_active && data.subdomain) {
        window.location.replace(`https://${data.subdomain}.schoolsyncedu.com/status`);
      }
    }).catch(() => {});
  }, [slug, isCustomDomain]);

  // Load payment config when we have a result with school_id and unpaid fee
  useEffect(() => {
    if (
      result?.found &&
      result.school_id &&
      (result.application_fee_amount ?? 0) > 0 &&
      !result.application_fee_paid
    ) {
      publicApplicationService.getPublicPaymentConfig(result.school_id)
        .then((cfg) => setPayConfig(cfg))
        .catch(() => {});
    }
  }, [result]);

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applicationNumber.trim() || !dateOfBirth) return;
    setLoading(true);
    setError('');
    setResult(null);
    setPayConfig(null);
    setPayFeePaid(false);
    setPaySuccess(false);
    setPayError('');
    try {
      const data = await publicApplicationService.checkStatus(applicationNumber.trim(), dateOfBirth);
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to check application status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    setPayFeePaid(true);
    setPaySuccess(true);
    setPayError('');
    // Update local result so the Paid badge appears
    if (result) setResult({ ...result, application_fee_paid: true });
  };

  const statusInfo = result?.status ? STATUS_CONFIG[result.status] : null;
  const StatusIcon = statusInfo?.icon ?? Clock;

  const currentStepIndex = result?.status ? TIMELINE_ORDER.indexOf(result.status) : -1;

  const feeAmount   = result?.application_fee_amount ?? 0;
  const feePaid     = result?.application_fee_paid ?? false;
  const showPayment = result?.found && feeAmount > 0 && !feePaid && !payFeePaid;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-6 py-4">
          <Link
            to={slug ? `/school/${slug}` : '/'}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-primary-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to School Site
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-10">
        {/* Title */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-100">
            <Search className="h-7 w-7 text-primary-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Check Application Status</h1>
          <p className="mt-2 text-slate-500">
            Enter your application number and date of birth to view your application status.
          </p>
        </div>

        {/* Search Form */}
        <form onSubmit={handleCheck} className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
          <div className="space-y-4">
            <div>
              <label htmlFor="appNumber" className="mb-1 block text-sm font-medium text-slate-700">
                Application Number
              </label>
              <input
                id="appNumber"
                type="text"
                placeholder="e.g. APP-BHA-2026-0001"
                value={applicationNumber}
                onChange={(e) => setApplicationNumber(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition"
                required
              />
            </div>
            <div>
              <label htmlFor="dob" className="mb-1 block text-sm font-medium text-slate-700">
                Date of Birth
              </label>
              <input
                id="dob"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition"
                required
              />
              <p className="mt-1 text-xs text-slate-400">Must match the date of birth on the application.</p>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading || !applicationNumber.trim() || !dateOfBirth}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                Check Status
              </>
            )}
          </button>
        </form>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          </div>
        )}

        {/* Not Found */}
        {result && !result.found && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
            <AlertCircle className="mx-auto mb-3 h-10 w-10 text-amber-500" />
            <p className="font-medium text-amber-800">{result.message}</p>
            <p className="mt-1 text-sm text-amber-600">
              Double-check your application number and date of birth and try again.
            </p>
          </div>
        )}

        {/* Result */}
        {result?.found && statusInfo && (
          <div className="space-y-6">
            {/* Status Card */}
            <div className={`rounded-xl border-2 p-6 ${statusInfo.color}`}>
              <div className="flex items-center gap-3">
                <StatusIcon className="h-8 w-8" />
                <div>
                  <h2 className="text-lg font-bold">{statusInfo.label}</h2>
                  <p className="text-sm opacity-80">{statusInfo.description}</p>
                </div>
              </div>
            </div>

            {/* Application Details */}
            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <h3 className="mb-4 font-semibold text-slate-800">Application Details</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-3">
                  <FileText className="mt-0.5 h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-400">Application #</p>
                    <p className="font-mono text-sm font-medium text-slate-700">{result.application_number}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <User className="mt-0.5 h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-400">Student Name</p>
                    <p className="text-sm font-medium text-slate-700">{result.student_name}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <BookOpen className="mt-0.5 h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-400">Grade Applied</p>
                    <p className="text-sm font-medium text-slate-700">{result.grade_level}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Calendar className="mt-0.5 h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-400">Academic Year</p>
                    <p className="text-sm font-medium text-slate-700">{result.academic_year}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="mt-0.5 h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-400">Submitted</p>
                    <p className="text-sm font-medium text-slate-700">
                      {result.submitted_at ? new Date(result.submitted_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
                    </p>
                  </div>
                </div>
                {result.reviewed_at && (
                  <div className="flex items-start gap-3">
                    <CheckCircle className="mt-0.5 h-4 w-4 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-400">Reviewed</p>
                      <p className="text-sm font-medium text-slate-700">
                        {new Date(result.reviewed_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Application Fee */}
              {feeAmount > 0 && (
                <div className="mt-4 rounded-lg border bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Application Fee</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-800">${feeAmount.toFixed(2)}</span>
                      {(feePaid || payFeePaid) ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Paid</span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Unpaid</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Payment Section ── */}
              {feeAmount > 0 && (
                <div className="mt-4 space-y-3 text-left">
                  {/* Paid confirmation */}
                  {(feePaid || payFeePaid) ? (
                    <div className="flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                      <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
                      <div>
                        <p className="font-semibold text-emerald-800">Payment Confirmed!</p>
                        <p className="text-sm text-emerald-700 mt-0.5">
                          Your application fee has been paid. The Registrar will now review your application.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
                        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
                        <p className="text-sm text-amber-800">
                          Your application fee of{' '}
                          <strong>${feeAmount.toFixed(2)} USD</strong> must be paid before
                          the Registrar can review your application.
                        </p>
                      </div>

                      {showPayment && !payConfig && (
                        <div className="flex items-center justify-center gap-2 py-4 text-sm text-slate-400">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading payment options…
                        </div>
                      )}

                      {payError && (
                        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">{payError}</p>
                      )}

                      {/* MTN Mobile Money */}
                      {payConfig?.mtn_enabled && (
                        payConfig.mtn_has_api ? (
                          <MobileMoneyForm
                            gateway="mtn"
                            schoolId={result.school_id ?? ''}
                            paymentType="application_fee"
                            applicationId={result.application_id}
                            amountUsd={feeAmount}
                            onSuccess={handlePaymentSuccess}
                            onError={(msg) => setPayError(msg)}
                          />
                        ) : (
                          <div className="rounded-xl border-2 border-yellow-200 bg-yellow-50 px-4 py-3.5 space-y-1.5">
                            <p className="font-semibold text-yellow-900 text-sm">MTN Mobile Money (MoMo)</p>
                            <p className="font-mono text-2xl font-extrabold tracking-widest text-yellow-900">{payConfig.mtn_merchant_code || '—'}</p>
                            <ol className="text-xs text-yellow-800 list-decimal list-inside space-y-0.5">
                              <li>Dial <strong>*156#</strong> or open MoMo app → Pay Bill / Merchant</li>
                              <li>Enter merchant code above, amount <strong>${feeAmount.toFixed(2)}</strong></li>
                              <li>Reference: <strong className="font-mono">{result.application_number}</strong></li>
                            </ol>
                            <p className="text-xs text-yellow-700 bg-yellow-100 rounded px-2 py-1">Bring your SMS receipt to the Finance Office to confirm.</p>
                          </div>
                        )
                      )}

                      {/* Orange Money */}
                      {payConfig?.orange_enabled && (
                        payConfig.orange_has_api ? (
                          <MobileMoneyForm
                            gateway="orange"
                            schoolId={result.school_id ?? ''}
                            paymentType="application_fee"
                            applicationId={result.application_id}
                            amountUsd={feeAmount}
                            onSuccess={handlePaymentSuccess}
                            onError={(msg) => setPayError(msg)}
                          />
                        ) : (
                          <div className="rounded-xl border-2 border-orange-200 bg-orange-50 px-4 py-3.5 space-y-1.5">
                            <p className="font-semibold text-orange-900 text-sm">Orange Money</p>
                            <p className="font-mono text-2xl font-extrabold tracking-widest text-orange-900">{payConfig.orange_merchant_code || '—'}</p>
                            <ol className="text-xs text-orange-800 list-decimal list-inside space-y-0.5">
                              <li>Open Orange Money app → Pay Merchant</li>
                              <li>Enter merchant code above, amount <strong>${feeAmount.toFixed(2)}</strong></li>
                              <li>Reference: <strong className="font-mono">{result.application_number}</strong></li>
                            </ol>
                            <p className="text-xs text-orange-700 bg-orange-100 rounded px-2 py-1">Bring your SMS receipt to the Finance Office to confirm.</p>
                          </div>
                        )
                      )}

                      {/* Bank Transfer */}
                      {payConfig?.bank_enabled && payConfig.bank_account_number && (
                        <div className="rounded-xl border border-blue-200 overflow-hidden">
                          <div className="bg-blue-50 px-4 py-2.5 border-b border-blue-200">
                            <p className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                              <Landmark className="h-4 w-4" />
                              Bank Transfer
                            </p>
                          </div>
                          <div className="p-4 space-y-3">
                            <div className="rounded-lg bg-white border border-blue-100 p-3 space-y-2 text-xs">
                              <div className="flex justify-between">
                                <span className="text-gray-500">Account Name</span>
                                <span className="font-semibold text-gray-800">{payConfig.bank_account_name}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Account Number</span>
                                <span className="font-mono font-bold text-gray-900">{payConfig.bank_account_number}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Bank</span>
                                <span className="font-medium text-gray-800">{payConfig.bank_name}</span>
                              </div>
                              {payConfig.bank_routing_number && (
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Routing / Sort Code</span>
                                  <span className="font-mono text-gray-800">{payConfig.bank_routing_number}</span>
                                </div>
                              )}
                              {payConfig.bank_swift_code && (
                                <div className="flex justify-between">
                                  <span className="text-gray-500">SWIFT / BIC</span>
                                  <span className="font-mono text-gray-800">{payConfig.bank_swift_code}</span>
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-blue-700 mb-1">Payment Reference</p>
                              <div className="flex items-center gap-2 rounded-lg bg-white border border-blue-200 px-3 py-2">
                                <span className="font-mono text-sm font-bold text-blue-900 flex-1 break-all">{result.application_number}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(result.application_number ?? '').catch(() => {});
                                    setCopiedBankRef(true);
                                    setTimeout(() => setCopiedBankRef(false), 2000);
                                  }}
                                  className="text-blue-500 hover:text-blue-700 shrink-0"
                                >
                                  {copiedBankRef ? <CheckCheck className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                </button>
                              </div>
                              <p className="text-xs text-blue-600 mt-1">Use your application number as the transfer reference.</p>
                            </div>
                            {payConfig.bank_instructions && (
                              <p className="text-xs text-blue-700 leading-relaxed border-t border-blue-100 pt-2">{payConfig.bank_instructions}</p>
                            )}
                            <p className="text-xs text-blue-600 bg-blue-50 rounded px-2 py-1">
                              After transferring, visit the Finance Office with your receipt to confirm payment.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Flutterwave Card Payment */}
                      {payConfig?.flw_enabled && payConfig.flw_public_key && result.application_id && (
                        paySuccess ? (
                          <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 p-3 text-xs text-green-700">
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                            Card payment successful! The Registrar will now review your application.
                          </div>
                        ) : (
                          <FlutterwaveForm
                            schoolId={result.school_id ?? ''}
                            publicKey={payConfig.flw_public_key}
                            currency={payConfig.flw_currency || 'USD'}
                            paymentType="application_fee"
                            applicationId={result.application_id}
                            amountUsd={feeAmount}
                            customer={{
                              name:  result.student_name ?? '',
                              email: '',
                              phone: '',
                            }}
                            paymentTitle={payConfig.payment_title || 'Application Fee'}
                            onSuccess={handlePaymentSuccess}
                            onError={(msg) => setPayError(msg)}
                          />
                        )
                      )}

                      {/* Stripe Card Payment */}
                      {payConfig?.stripe_enabled && stripePromise && result.application_id && (
                        <div className="rounded-xl border border-purple-200 overflow-hidden">
                          <div className="bg-purple-50 px-4 py-2.5 border-b border-purple-200">
                            <p className="text-sm font-semibold text-purple-800 flex items-center gap-2">
                              <CreditCard className="h-4 w-4" />
                              Pay by Card (Stripe)
                            </p>
                          </div>
                          <div className="p-4">
                            {paySuccess ? (
                              <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 p-3 text-xs text-green-700">
                                <CheckCircle2 className="h-4 w-4 shrink-0" />
                                Card payment successful! The Registrar will now review your application.
                              </div>
                            ) : (
                              <Elements stripe={stripePromise}>
                                <StatusStripeCardForm
                                  schoolId={result.school_id ?? ''}
                                  applicationId={result.application_id}
                                  amountUsd={feeAmount}
                                  onSuccess={handlePaymentSuccess}
                                  onError={(msg) => setPayError(msg)}
                                />
                              </Elements>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Pay at Campus (always shown when fee is unpaid) */}
                      <div className="rounded-xl border border-slate-200 overflow-hidden">
                        <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200">
                          <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            {payConfig?.flw_enabled || payConfig?.mtn_enabled || payConfig?.orange_enabled || payConfig?.bank_enabled || payConfig?.stripe_enabled
                              ? 'Or Pay at Campus'
                              : 'Pay at Campus Finance Office'}
                          </p>
                        </div>
                        <div className="p-4">
                          <ol className="text-xs text-slate-700 list-decimal list-inside space-y-1">
                            <li>Visit the <strong>Finance Office</strong> at the school</li>
                            <li>Provide your application number: <strong className="font-mono">{result.application_number}</strong></li>
                            <li>Pay <strong>${feeAmount.toFixed(2)} USD</strong> in cash — get a receipt</li>
                            <li>Finance records your payment → Registrar proceeds with your review</li>
                          </ol>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Registration Number */}
              {result.registration_number && (
                <div className="mt-4 rounded-lg border-2 border-green-200 bg-green-50 p-4">
                  <p className="text-xs text-green-600">Assigned Registration Number</p>
                  <p className="text-lg font-bold font-mono text-green-800">{result.registration_number}</p>
                </div>
              )}

              {/* Review Notes */}
              {result.review_notes && (
                <div className="mt-4 rounded-lg border bg-blue-50 p-4">
                  <p className="mb-1 text-xs font-medium text-blue-600">Message from Registrar</p>
                  <p className="text-sm text-blue-800">{result.review_notes}</p>
                </div>
              )}
            </div>

            {/* Progress Timeline */}
            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <h3 className="mb-4 font-semibold text-slate-800">Application Progress</h3>
              <div className="flex items-center justify-between">
                {TIMELINE_ORDER.map((step, i) => {
                  const stepConf = STATUS_CONFIG[step];
                  const isCompleted = currentStepIndex >= i;
                  const isCurrent = currentStepIndex === i;
                  return (
                    <div key={step} className="flex flex-1 items-center">
                      <div className="flex flex-col items-center">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all ${
                            isCompleted
                              ? 'border-green-500 bg-green-500 text-white'
                              : isCurrent
                              ? 'border-primary-500 bg-primary-100 text-primary-700'
                              : 'border-slate-200 bg-white text-slate-300'
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle className="h-4 w-4" />
                          ) : (
                            <span className="text-xs font-bold">{i + 1}</span>
                          )}
                        </div>
                        <span
                          className={`mt-1.5 text-center text-[10px] leading-tight sm:text-xs ${
                            isCompleted ? 'font-medium text-green-700' : 'text-slate-400'
                          }`}
                        >
                          {stepConf.label}
                        </span>
                      </div>
                      {i < TIMELINE_ORDER.length - 1 && (
                        <div
                          className={`mx-1 h-0.5 flex-1 ${
                            currentStepIndex > i ? 'bg-green-400' : 'bg-slate-200'
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Show special statuses outside normal flow */}
              {result.status && !TIMELINE_ORDER.includes(result.status) && (
                <p className="mt-4 text-center text-sm text-slate-500">
                  Current status: <strong className="capitalize">{result.status.replace(/_/g, ' ')}</strong>
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => { setResult(null); setApplicationNumber(''); setDateOfBirth(''); setPayConfig(null); setPayFeePaid(false); setPaySuccess(false); setPayError(''); }}
                className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Check Another
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 rounded-lg bg-primary-600 py-2.5 text-sm font-medium text-white transition hover:bg-primary-700"
              >
                Print Status
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
