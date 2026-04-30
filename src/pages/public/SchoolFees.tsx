import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { schoolSiteService } from '@/services/schoolSiteService';
import { studentPortalService } from '@/services/studentPortalService';
import { proprietorPaymentService, type PaymentConfigPublic } from '@/services/proprietorPaymentService';
import { supabase } from '@/lib/supabase';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import MobileMoneyForm from '@/components/payment/MobileMoneyForm';
import type { School, SiteConfig, FeeScheduleConfig } from '@/types/school.types';
import {
  GraduationCap,
  DollarSign,
  ArrowLeft,
  Phone,
  MapPin,
  LogIn,
  Info,
  BookOpen,
  CreditCard,
  CheckCircle,
  AlertCircle,
  Lock,
  Loader2,
  ChevronRight,
  Receipt,
  ArrowRight,
  X,
  ShieldCheck,
} from 'lucide-react';

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusColor(status: string) {
  if (status === 'paid') return 'bg-emerald-100 text-emerald-700';
  if (status === 'partial') return 'bg-amber-100 text-amber-700';
  if (status === 'overdue') return 'bg-red-100 text-red-700';
  return 'bg-gray-100 text-gray-600';
}

// ── types ─────────────────────────────────────────────────────────────────────

type Tab = 'schedule' | 'pay';

interface StudentFeeRow {
  id: string;
  student_id: string;
  amount_due: number;
  amount_paid: number;
  balance: number;
  status: string;
  due_date: string | null;
  fee_structures: {
    fee_type: string;
    amount_usd: number;
    academic_year: string;
    grade_level: string;
    due_date: string | null;
  } | null;
}

// ── Stripe card form (must be inside <Elements>) ───────────────────────────────

interface StripeCardFormProps {
  schoolId: string;
  studentId: string;
  studentFeeId: string;
  amountUsd: number;
  primaryColor: string;
  onSuccess: (paymentIntentId: string) => void;
  onError: (msg: string) => void;
}

function StripeCardForm({
  schoolId, studentId, studentFeeId, amountUsd, primaryColor, onSuccess, onError,
}: StripeCardFormProps) {
  const stripe   = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  const handlePay = async () => {
    if (!stripe || !elements) return;
    setProcessing(true);

    try {
      // 1. Create PaymentIntent using school's own Stripe keys (server-side)
      const { data, error: fnError } = await supabase.functions.invoke('school-stripe-payment', {
        body: { school_id: schoolId, student_id: studentId, student_fee_id: studentFeeId, amount_usd: amountUsd },
      });

      if (fnError || data?.error) {
        throw new Error(data?.error ?? fnError?.message ?? 'Failed to initiate payment');
      }

      const { clientSecret, paymentIntentId } = data as { clientSecret: string; paymentIntentId: string };

      // 2. Confirm card payment in the browser
      const cardEl = elements.getElement(CardElement);
      if (!cardEl) throw new Error('Card element unavailable');

      const { paymentIntent, error: stripeError } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: cardEl },
      });

      if (stripeError) throw new Error(stripeError.message ?? 'Card payment failed');
      if (paymentIntent?.status !== 'succeeded') throw new Error('Payment did not complete');

      // 3. Record the payment in the database
      const { error: rpcError } = await supabase.rpc('record_fee_payment', {
        p_school_id:        schoolId,
        p_student_id:       studentId,
        p_student_fee_id:   studentFeeId,
        p_amount_usd:       amountUsd,
        p_amount_lrd:       0,
        p_currency_charged: 'USD',
        p_payment_method:   'visa',
        p_gateway_ref:      paymentIntentId,
        p_recorded_by:      null,
      });

      if (rpcError) throw new Error(rpcError.message);

      onSuccess(paymentIntentId);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1.5">Card Details</label>
        <div className="rounded-lg border border-slate-200 px-3 py-3 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-400/20 transition-all bg-white">
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
        className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white shadow transition hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: primaryColor }}
      >
        {processing ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
        ) : (
          <><Lock className="h-4 w-4" /> Pay ${amountUsd.toFixed(2)} with Card</>
        )}
      </button>

      <p className="text-center text-xs text-slate-400 flex items-center justify-center gap-1">
        <ShieldCheck className="h-3.5 w-3.5" /> Secure card payment powered by Stripe
      </p>
    </div>
  );
}

// ── component ─────────────────────────────────────────────────────────────────

export default function SchoolFees() {
  const { slug } = useParams<{ slug: string }>();
  const { user, isAuthenticated } = useAuth();

  const [school, setSchool] = useState<School | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<Tab>('schedule');

  // Payment config
  const [paymentCfg, setPaymentCfg] = useState<PaymentConfigPublic | null>(null);

  // Stripe: lazy-load Stripe.js only when school has Stripe enabled
  const stripePromise = useMemo(
    () => (paymentCfg?.stripe_enabled && paymentCfg.stripe_public_key
      ? loadStripe(paymentCfg.stripe_public_key)
      : null),
    [paymentCfg?.stripe_enabled, paymentCfg?.stripe_public_key],
  );

  // Student / fees
  const [studentLoading, setStudentLoading] = useState(false);
  const [studentData, setStudentData] = useState<Record<string, unknown> | null>(null);
  const [fees, setFees] = useState<StudentFeeRow[]>([]);

  // Payment flow
  const [selectedFee, setSelectedFee] = useState<StudentFeeRow | null>(null);
  const [amount, setAmount] = useState('');
  const [paySuccess, setPaySuccess] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [lastRef, setLastRef] = useState<string | null>(null);

  // ── load school ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!slug) return;
    setPageLoading(true);
    schoolSiteService
      .getBySlug(slug)
      .then((data) => {
        if (!data) { setNotFound(true); return; }
        setSchool(data as School);
        // Load payment config in parallel
        proprietorPaymentService
          .getPublicConfig((data as School).id)
          .then((cfg) => setPaymentCfg(cfg))
          .catch(() => setPaymentCfg(null));
      })
      .catch(() => setNotFound(true))
      .finally(() => setPageLoading(false));
  }, [slug]);

  // ── load student fees when "Pay My Fees" tab active ──────────────────────────
  useEffect(() => {
    if (tab !== 'pay' || !isAuthenticated || !user || !school) return;
    if (studentData) return; // already loaded
    setStudentLoading(true);
    studentPortalService
      .getMyProfile(user.school_id ?? '', user.id)
      .then((s) => {
        setStudentData(s as Record<string, unknown>);
        return studentPortalService.getMyFees(user.school_id ?? '', (s as Record<string, unknown>).id as string);
      })
      .then((f) => setFees((f ?? []) as StudentFeeRow[]))
      .catch(() => { /* ignore — user may belong to a different school */ })
      .finally(() => setStudentLoading(false));
  }, [tab, isAuthenticated, user, school, studentData]);

  // ── Student name ─────────────────────────────────────────────────────────────
  const studentName =
    studentData
      ? `${studentData.first_name as string} ${studentData.last_name as string}`
      : 'Student';


  if (pageLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-gray-500">Loading fee information...</p>
        </div>
      </div>
    );
  }

  if (notFound || !school) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4">
        <GraduationCap className="mb-4 h-16 w-16 text-gray-300" />
        <h1 className="text-2xl font-bold text-gray-900">School Not Found</h1>
        <p className="mt-2 text-gray-500">This school doesn't exist or hasn't published their site yet.</p>
        <Link to="/" className="mt-6 text-blue-600 underline hover:text-blue-800">Go to SchoolSync</Link>
      </div>
    );
  }

  const primary   = school.primary_color   || '#1e40af';
  const secondary = school.secondary_color || '#f59e0b';
  const cfg: SiteConfig          = school.site_config ?? {};
  const fees_cfg: FeeScheduleConfig | undefined = cfg.fee_schedule;

  const unpaidFees = fees.filter((f) => f.status !== 'paid');
  const totalBalance = unpaidFees.reduce((s, f) => s + f.balance, 0);

  // Whether the logged-in user belongs to THIS school
  const wrongSchool = isAuthenticated && user && user.school_id && user.school_id !== school.id;

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">

      {/* ===== HEADER ===== */}
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to={`/school/${slug}`} className="flex items-center gap-3">
            {school.logo_url ? (
              <img src={school.logo_url} alt={school.name} className="h-9 w-9 rounded-lg object-cover" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg text-white" style={{ backgroundColor: primary }}>
                <GraduationCap className="h-5 w-5" />
              </div>
            )}
            <div>
              <p className="text-sm font-bold text-gray-900">{school.name}</p>
              <p className="text-xs text-gray-400">Fees Portal</p>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to={`/school/${slug}`}
              className="hidden sm:flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
            <Link
              to={`/school/${slug}/login`}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
              style={{ backgroundColor: primary }}
            >
              <LogIn className="h-4 w-4" />
              {isAuthenticated ? 'My Portal' : 'Sign In'}
            </Link>
          </div>
        </div>
      </header>

      {/* ===== HERO ===== */}
      <section className="px-4 py-10 sm:py-14" style={{ background: `linear-gradient(135deg, ${primary} 0%, ${primary}cc 100%)` }}>
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-xs font-medium text-white/90 backdrop-blur-sm">
            <BookOpen className="h-3.5 w-3.5" />
            {fees_cfg?.academic_year || 'Current Academic Year'}
          </div>
          <h1 className="text-3xl font-extrabold text-white sm:text-4xl">
            {fees_cfg?.page_title || `${school.name} — Fee Portal`}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-white/70 sm:text-base">
            {fees_cfg?.header_text || 'View published fee information or sign in to check and pay your outstanding fees.'}
          </p>
        </div>
      </section>

      {/* ===== TABS ===== */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex border-b border-gray-200 bg-white shadow-sm mt-6 rounded-xl overflow-hidden">
          {([
            { id: 'schedule', label: 'Fee Schedule', icon: BookOpen },
            { id: 'pay',      label: 'Pay My Fees',   icon: CreditCard },
          ] as { id: Tab; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex flex-1 items-center justify-center gap-2 px-4 py-3.5 text-sm font-semibold transition-colors ${
                tab === id
                  ? 'border-b-2 text-primary-700'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
              style={tab === id ? { borderColor: primary, color: primary } : {}}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* ── FEE SCHEDULE TAB ── */}
        {tab === 'schedule' && (
          <div className="py-8">
            {(!fees_cfg?.published || !fees_cfg.categories?.length) ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <DollarSign className="mb-4 h-12 w-12 text-gray-300" />
                <h2 className="text-lg font-bold text-gray-800">Fee Information Not Yet Published</h2>
                <p className="mt-2 text-sm text-gray-500">
                  This school hasn't published their fee schedule yet. Please check back later or contact the school directly.
                </p>
                <button
                  onClick={() => setTab('pay')}
                  className="mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow"
                  style={{ backgroundColor: primary }}
                >
                  <CreditCard className="h-4 w-4" /> Pay My Fees Instead
                </button>
              </div>
            ) : (
              <div className="space-y-10">
                {fees_cfg.categories.map((cat, ci) => (
                  <div key={ci}>
                    <div className="mb-5">
                      <h2 className="text-xl font-bold text-gray-900">{cat.name}</h2>
                      {cat.description && <p className="mt-1 text-sm text-gray-500">{cat.description}</p>}
                      <div className="mt-2 h-1 w-12 rounded-full" style={{ backgroundColor: secondary }} />
                    </div>
                    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                      <table className="w-full text-left">
                        <thead>
                          <tr style={{ backgroundColor: primary + '0a' }}>
                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 sm:px-6">Grade / Class</th>
                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 sm:px-6">Fee Type</th>
                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-right text-gray-500 sm:px-6">
                              Amount ({fees_cfg.currency_label || 'USD'})
                            </th>
                            {fees_cfg.show_lrd && (
                              <th className="hidden sm:table-cell px-4 py-3 text-xs font-semibold uppercase tracking-wider text-right text-gray-500 sm:px-6">
                                Amount (LRD)
                              </th>
                            )}
                            <th className="hidden md:table-cell px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 sm:px-6">
                              Description
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {cat.items.map((item, ii) => (
                            <tr key={ii} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-4 py-3.5 text-sm font-medium text-gray-800 sm:px-6">{item.grade_or_class}</td>
                              <td className="px-4 py-3.5 sm:px-6">
                                <span
                                  className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize"
                                  style={{ backgroundColor: primary + '12', color: primary }}
                                >
                                  {item.fee_type.replace(/_/g, ' ')}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 text-sm font-bold text-gray-900 text-right sm:px-6">
                                ${item.amount_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </td>
                              {fees_cfg.show_lrd && (
                                <td className="hidden sm:table-cell px-4 py-3.5 text-sm text-gray-600 text-right sm:px-6">
                                  {item.amount_lrd != null
                                    ? `L$${item.amount_lrd.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                                    : '—'}
                                </td>
                              )}
                              <td className="hidden md:table-cell px-4 py-3.5 text-xs text-gray-500 sm:px-6">
                                {item.description || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}

                {fees_cfg.footnote && (
                  <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
                    <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                    <p className="text-sm text-blue-800 whitespace-pre-wrap">{fees_cfg.footnote}</p>
                  </div>
                )}

                {/* Pay My Fees CTA */}
                <div className="rounded-2xl p-8 text-center" style={{ background: `linear-gradient(135deg, ${primary}0d 0%, ${secondary}0d 100%)`, border: `1px solid ${primary}20` }}>
                  <CreditCard className="mx-auto mb-3 h-10 w-10" style={{ color: primary }} />
                  <h3 className="text-lg font-bold text-gray-900">Ready to Pay?</h3>
                  <p className="mt-1 text-sm text-gray-500">Sign in to your student portal to check your balance and make a payment online.</p>
                  <button
                    onClick={() => setTab('pay')}
                    className="mt-5 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white shadow-md transition hover:opacity-90"
                    style={{ backgroundColor: primary }}
                  >
                    <CreditCard className="h-4 w-4" /> Pay My Fees
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PAY MY FEES TAB ── */}
        {tab === 'pay' && (
          <div className="py-8">

            {/* Not logged in */}
            {!isAuthenticated && (
              <div className="mx-auto max-w-lg rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
                <div
                  className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: primary + '12' }}
                >
                  <Lock className="h-8 w-8" style={{ color: primary }} />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Sign In to Pay Your Fees</h2>
                <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                  Please sign in to your student or parent portal to view your outstanding fees and make a payment.
                </p>
                <Link
                  to={`/school/${slug}/login`}
                  state={{ redirect: `/school/${slug}/fees?tab=pay` }}
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white shadow-md transition hover:opacity-90"
                  style={{ backgroundColor: primary }}
                >
                  <LogIn className="h-4 w-4" />
                  Sign In to Portal
                </Link>
                <p className="mt-4 text-xs text-gray-400">
                  Don't have a portal account?{' '}
                  <a href={`mailto:${(school as unknown as Record<string, string>).contact_email || ''}`} className="font-medium hover:underline" style={{ color: primary }}>
                    Contact the school
                  </a>
                </p>
              </div>
            )}

            {/* Wrong school */}
            {isAuthenticated && wrongSchool && (
              <div className="mx-auto max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-10 text-center">
                <AlertCircle className="mx-auto mb-3 h-12 w-12 text-amber-500" />
                <h2 className="text-lg font-bold text-gray-900">Different School Account</h2>
                <p className="mt-2 text-sm text-gray-600">
                  You are signed in to a different school's portal. Please sign out and sign in to{' '}
                  <strong>{school.name}</strong>'s portal.
                </p>
                <Link
                  to={`/school/${slug}/login`}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
                  style={{ backgroundColor: primary }}
                >
                  <LogIn className="h-4 w-4" /> Sign into {school.name}
                </Link>
              </div>
            )}

            {/* Correct user — show fees */}
            {isAuthenticated && !wrongSchool && (
              <div className="space-y-6">

                {/* Student header */}
                {studentData && (
                  <div
                    className="flex items-center justify-between rounded-2xl p-5"
                    style={{ background: `linear-gradient(135deg, ${primary}0f 0%, ${secondary}0f 100%)`, border: `1px solid ${primary}20` }}
                  >
                    <div className="flex items-center gap-4">
                      {(studentData.photo_url as string) ? (
                        <img
                          src={studentData.photo_url as string}
                          alt={studentName}
                          className="h-12 w-12 rounded-full object-cover ring-2 ring-white shadow"
                        />
                      ) : (
                        <div
                          className="flex h-12 w-12 items-center justify-center rounded-full text-white font-bold text-lg shadow"
                          style={{ backgroundColor: primary }}
                        >
                          {(studentData.first_name as string)?.[0]}{(studentData.last_name as string)?.[0]}
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-gray-900">{studentName}</p>
                        <p className="text-xs text-gray-500">
                          Reg: {studentData.registration_number as string} &bull;{' '}
                          Grade {studentData.current_grade_level as string}
                        </p>
                      </div>
                    </div>
                    {totalBalance > 0 && (
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Total Balance</p>
                        <p className="text-xl font-extrabold text-red-600">{fmt(totalBalance)}</p>
                      </div>
                    )}
                  </div>
                )}

                {studentLoading && (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin" style={{ color: primary }} />
                  </div>
                )}

                {!studentLoading && fees.length === 0 && (
                  <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
                    <CheckCircle className="mx-auto mb-3 h-12 w-12 text-emerald-400" />
                    <h3 className="text-lg font-bold text-gray-800">All Clear!</h3>
                    <p className="mt-1 text-sm text-gray-500">No fees have been assigned to your account yet.</p>
                  </div>
                )}

                {!studentLoading && fees.length > 0 && !selectedFee && !paySuccess && (
                  <div>
                    <h2 className="mb-4 text-lg font-bold text-gray-900">Your Fee Assignments</h2>
                    <div className="space-y-3">
                      {fees.map((f) => {
                        const feeType = f.fee_structures?.fee_type ?? 'fee';
                        const year    = f.fee_structures?.academic_year ?? '';
                        return (
                          <div
                            key={f.id}
                            className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md"
                          >
                            <div>
                              <p className="font-semibold capitalize text-gray-800">{feeType.replace(/_/g, ' ')}</p>
                              <p className="text-xs text-gray-400">{year} &bull; Due: {f.due_date ? new Date(f.due_date).toLocaleDateString() : 'N/A'}</p>
                              <div className="mt-1 flex items-center gap-2">
                                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusColor(f.status)}`}>{f.status}</span>
                                {f.amount_paid > 0 && (
                                  <span className="text-xs text-emerald-600">Paid: {fmt(f.amount_paid)}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="text-xs text-gray-400">Balance</p>
                                <p className={`text-lg font-extrabold ${f.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                  {fmt(f.balance)}
                                </p>
                              </div>
                              {f.status !== 'paid' && (paymentCfg?.flw_enabled || paymentCfg?.stripe_enabled || paymentCfg?.mtn_enabled || paymentCfg?.orange_enabled) && (
                                <button
                                  onClick={() => {
                                    setSelectedFee(f);
                                    setAmount(String(f.balance));
                                    setPayError(null);
                                    setPaySuccess(false);
                                  }}
                                  className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold text-white shadow transition hover:opacity-90"
                                  style={{ backgroundColor: primary }}
                                >
                                  Pay <ChevronRight className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* No online payment configured */}
                    {unpaidFees.length > 0 && !paymentCfg?.flw_enabled && !paymentCfg?.stripe_enabled && !paymentCfg?.mtn_enabled && !paymentCfg?.orange_enabled && (
                      <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                        <div className="text-sm text-amber-800">
                          <p className="font-semibold">Online payment not available yet.</p>
                          <p className="mt-1">
                            {school.name} has not set up online payments. Please visit the school finance office to pay
                            your balance of <strong>{fmt(totalBalance)}</strong>.
                          </p>
                          {(paymentCfg?.mtn_enabled || paymentCfg?.orange_enabled) && (
                            <div className="mt-3 space-y-1.5">
                              {paymentCfg.mtn_enabled && paymentCfg.mtn_merchant_code && (
                                <p>MTN MoMo merchant code: <strong className="tracking-widest">{paymentCfg.mtn_merchant_code}</strong></p>
                              )}
                              {paymentCfg.orange_enabled && paymentCfg.orange_merchant_code && (
                                <p>Orange Money merchant code: <strong className="tracking-widest">{paymentCfg.orange_merchant_code}</strong></p>
                              )}
                              <p className="text-xs text-amber-700">After sending mobile money, bring the confirmation SMS to the school office to update your balance.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Payment form ── */}
                {!studentLoading && selectedFee && !paySuccess && (
                  <div className="mx-auto max-w-lg">
                    <div className="rounded-2xl border border-gray-200 bg-white shadow-md overflow-hidden">

                      {/* Header */}
                      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100" style={{ backgroundColor: primary + '0c' }}>
                        <div>
                          <p className="font-bold text-gray-900 capitalize">
                            {selectedFee.fee_structures?.fee_type?.replace(/_/g, ' ')}
                          </p>
                          <p className="text-xs text-gray-400">Balance: {fmt(selectedFee.balance)}</p>
                        </div>
                        <button
                          onClick={() => { setSelectedFee(null); setPayError(null); }}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="p-5 space-y-5">
                        {/* Amount */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount to Pay (USD)</label>
                          <input
                            type="number"
                            min={0.01}
                            max={selectedFee.balance}
                            step={0.01}
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="block w-full rounded-xl border border-gray-300 px-4 py-2.5 text-lg font-bold text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            placeholder="0.00"
                          />
                          <p className="mt-1 text-xs text-gray-400">
                            Maximum: {fmt(selectedFee.balance)} &bull; Partial payments allowed
                          </p>
                        </div>

                        {/* Error */}
                        {payError && (
                          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            <p>{payError}</p>
                          </div>
                        )}

                        {/* MTN MoMo */}
                        {paymentCfg?.mtn_enabled && studentData && (
                          paymentCfg.mtn_has_api ? (
                            <MobileMoneyForm
                              gateway="mtn"
                              schoolId={school.id}
                              paymentType="student_fee"
                              studentFeeId={selectedFee.id}
                              amountUsd={Number(amount) || selectedFee.balance}
                              onSuccess={(ref) => {
                                setLastRef(ref);
                                setPaySuccess(true);
                                setSelectedFee(null);
                                studentPortalService
                                  .getMyFees(school.id, (studentData as Record<string, unknown>).id as string)
                                  .then((f) => setFees((f ?? []) as StudentFeeRow[]))
                                  .catch(() => {});
                              }}
                              onError={(msg) => setPayError(msg)}
                            />
                          ) : (
                            <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-3 space-y-1">
                              <p className="font-semibold text-yellow-800 text-sm">MTN MoMo</p>
                              <p className="text-2xl font-extrabold tracking-widest text-yellow-900">{paymentCfg.mtn_merchant_code}</p>
                              <p className="text-xs text-yellow-700">Send {amount ? fmt(Number(amount)) : 'the amount'} to this merchant code, then bring your confirmation SMS to the school office.</p>
                            </div>
                          )
                        )}

                        {/* Orange Money */}
                        {paymentCfg?.orange_enabled && studentData && (
                          paymentCfg.orange_has_api ? (
                            <MobileMoneyForm
                              gateway="orange"
                              schoolId={school.id}
                              paymentType="student_fee"
                              studentFeeId={selectedFee.id}
                              amountUsd={Number(amount) || selectedFee.balance}
                              onSuccess={(ref) => {
                                setLastRef(ref);
                                setPaySuccess(true);
                                setSelectedFee(null);
                                studentPortalService
                                  .getMyFees(school.id, (studentData as Record<string, unknown>).id as string)
                                  .then((f) => setFees((f ?? []) as StudentFeeRow[]))
                                  .catch(() => {});
                              }}
                              onError={(msg) => setPayError(msg)}
                            />
                          ) : (
                            <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 space-y-1">
                              <p className="font-semibold text-orange-800 text-sm">Orange Money</p>
                              <p className="text-2xl font-extrabold tracking-widest text-orange-900">{paymentCfg.orange_merchant_code}</p>
                              <p className="text-xs text-orange-700">Send {amount ? fmt(Number(amount)) : 'the amount'} to this merchant code, then bring your confirmation SMS to the school office.</p>
                            </div>
                          )
                        )}

                        {/* Stripe card payment */}
                        {paymentCfg?.stripe_enabled && stripePromise && studentData && (
                          <div className="space-y-2">
                            <p className="font-medium text-sm text-slate-700">Pay by Card (Stripe)</p>
                            <Elements stripe={stripePromise}>
                              <StripeCardForm
                                schoolId={school.id}
                                studentId={(studentData as Record<string, unknown>).id as string}
                                studentFeeId={selectedFee.id}
                                amountUsd={Number(amount) || selectedFee.balance}
                                primaryColor={primary}
                                onSuccess={(ref) => {
                                  setLastRef(ref);
                                  setPaySuccess(true);
                                  setSelectedFee(null);
                                  // Refresh fee list
                                  studentPortalService
                                    .getMyFees(school.id, (studentData as Record<string, unknown>).id as string)
                                    .then((f) => setFees((f ?? []) as StudentFeeRow[]))
                                    .catch(() => {});
                                }}
                                onError={(msg) => setPayError(msg)}
                              />
                            </Elements>
                          </div>
                        )}

                        {/* No online payment methods at all */}
                        {!paymentCfg?.mtn_enabled && !paymentCfg?.orange_enabled && !paymentCfg?.stripe_enabled && !paymentCfg?.flw_enabled && (
                          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                            <p className="font-semibold">Online payment not available</p>
                            <p className="mt-1">Please visit the school finance office to pay your fees in person.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Payment success ── */}
                {paySuccess && (
                  <div className="mx-auto max-w-lg rounded-2xl border border-emerald-200 bg-emerald-50 p-10 text-center shadow-sm">
                    <CheckCircle className="mx-auto mb-4 h-16 w-16 text-emerald-500" />
                    <h2 className="text-2xl font-extrabold text-gray-900">Payment Successful!</h2>
                    <p className="mt-2 text-sm text-gray-600">
                      Your payment has been recorded and your fee balance has been updated.
                    </p>
                    {lastRef && (
                      <div className="mt-4 rounded-xl bg-white border border-emerald-200 px-4 py-3">
                        <p className="text-xs text-gray-500">Payment Reference</p>
                        <p className="mt-0.5 font-mono text-sm font-bold text-gray-800 break-all">{lastRef}</p>
                      </div>
                    )}
                    <div className="mt-6 flex flex-col gap-3">
                      <button
                        onClick={() => {
                          setPaySuccess(false);
                          setSelectedFee(null);
                          setAmount('');
                          setLastRef(null);
                        }}
                        className="inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white shadow"
                        style={{ backgroundColor: primary }}
                      >
                        <Receipt className="h-4 w-4" /> View All Fees
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== FOOTER ===== */}
      <footer className="mt-16 border-t border-gray-100 bg-gray-900 px-4 py-8">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {school.logo_url ? (
              <img src={school.logo_url} alt={school.name} className="h-8 w-8 rounded-lg object-cover" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg text-white" style={{ backgroundColor: primary }}>
                <GraduationCap className="h-4 w-4" />
              </div>
            )}
            <p className="text-sm font-semibold text-white">{school.name}</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            {school.phone && (
              <a href={`tel:${school.phone}`} className="flex items-center gap-1 hover:text-white transition">
                <Phone className="h-3 w-3" /> {school.phone}
              </a>
            )}
            {school.address && (
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {school.address}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Link to={`/school/${slug}`}             className="text-xs text-gray-400 hover:text-white transition">Home</Link>
            <Link to={`/school/${slug}/apply`}        className="text-xs text-gray-400 hover:text-white transition">Apply</Link>
            <Link to={`/school/${slug}/login`}
              className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-white transition"
            >
              <LogIn className="h-3 w-3" /> Portal
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
