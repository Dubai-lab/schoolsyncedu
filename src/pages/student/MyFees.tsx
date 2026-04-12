import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { useFlutterwave, closePaymentModal } from 'flutterwave-react-v3';
import { studentPortalService } from '@/services/studentPortalService';
import { paymentService, invoiceService } from '@/services/feeService';
import { proprietorPaymentService, type PaymentConfigPublic } from '@/services/proprietorPaymentService';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Breadcrumb from '@/components/shared/Breadcrumb';
import {
  DollarSign,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Receipt,
  Banknote,
  X,
  Loader2,
  FileText,
  Smartphone,
  Wallet,
  CheckCircle,
  ArrowRight,
  Info,
  Clock,
} from 'lucide-react';

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtUSD(n: number) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusVariant(s: string) {
  if (s === 'paid')    return 'success' as const;
  if (s === 'partial') return 'warning' as const;
  if (s === 'overdue') return 'danger'  as const;
  return 'default' as const;
}

// ── types ─────────────────────────────────────────────────────────────────────

interface FeeRow {
  id: string;
  student_id: string;
  fee_structure_id: string;
  amount_due: number;
  amount_paid: number;
  balance: number;
  status: string;
  due_date: string | null;
  academic_year: string;
  fee_structures: {
    fee_type: string;
    amount_usd: number;
    academic_year: string;
    grade_level: string;
    due_date: string | null;
  } | null;
}

interface PaymentRow {
  id: string;
  amount_usd: number;
  payment_method: string;
  gateway_ref: string | null;
  status: string;
  payment_date: string;
  created_at: string;
}

// ── PAYMENT MODAL ─────────────────────────────────────────────────────────────

interface PaymentModalProps {
  fee: FeeRow;
  student: Record<string, unknown>;
  schoolId: string;
  userId: string;
  /** Auth email from useAuth() — the student's Supabase login email */
  userEmail: string;
  paymentCfg: PaymentConfigPublic | null;
  schoolName: string;
  onClose: () => void;
  onPaid: () => void;
}

function PaymentModal({
  fee, student, schoolId, userId, userEmail, paymentCfg, schoolName, onClose, onPaid,
}: PaymentModalProps) {
  const [amount, setAmount]           = useState(String(fee.balance));
  const [flwProcessing, setFlw]       = useState(false);
  const [step, setStep]               = useState<'invoice' | 'success' | 'error'>('invoice');
  const [payRef, setPayRef]           = useState<string | null>(null);
  const [invoiceNum, setInvoiceNum]   = useState<string | null>(null);
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);

  const studentName = `${student.first_name as string} ${student.last_name as string}`;
  const feeType     = fee.fee_structures?.fee_type?.replace(/_/g, ' ') ?? 'School Fee';

  // ── Derive best email for Flutterwave ─────────────────────────────────────
  // Students log in with their registration number (no real email), so their
  // auth email is an internal system address. We prefer the parent/guardian
  // email so Flutterwave delivers the receipt to the parent. We fall back to
  // userEmail (the auth email) which is always a valid, non-empty string.
  const guardians    = (student.guardians as Array<{ email?: string | null; phone?: string | null }> | null) ?? [];
  const guardianEmail = guardians.find((g) => g.email?.trim())?.email ?? '';
  const customerEmail = guardianEmail || userEmail;
  const customerPhone = (guardians[0]?.phone as string | undefined) ?? '';

  // ── Flutterwave ──────────────────────────────────────────────────────────────
  const flwKey    = paymentCfg?.flw_public_key ?? (import.meta.env.VITE_FLUTTERWAVE_PUBLIC_KEY as string) ?? '';
  const amountNum = Number(amount);
  const canPay    = amountNum > 0 && amountNum <= fee.balance && !isNaN(amountNum);

  const flutterwaveConfig = paymentCfg?.flw_enabled && canPay
    ? {
        public_key:      flwKey,
        tx_ref:          `INV-${schoolId.slice(0, 5)}-${fee.id.slice(0, 6)}-${Date.now()}`,
        amount:          amountNum,
        currency:        'USD',
        payment_options: (paymentCfg.flw_methods ?? ['card']).join(','),
        customer: {
          email:        customerEmail,
          name:         studentName,
          phone_number: customerPhone,
        },
        customizations: {
          title:       `${schoolName} — ${feeType}`,
          description: `Fee payment for ${studentName}`,
          logo:        `${window.location.origin}/SchoolSync_logo.png`,
        },
        meta: {
          school_id:      schoolId,
          student_fee_id: fee.id,
          student_id:     fee.student_id,
        },
      }
    : null;

  const handleFlutterPayment = useFlutterwave(flutterwaveConfig ?? {
    public_key: flwKey || '',
    tx_ref: 'placeholder',
    amount: 0,
    currency: 'USD',
    payment_options: 'card',
    customer: { email: customerEmail || 'noreply@schoolsync.app', name: studentName, phone_number: '' },
    customizations: { title: '', description: '', logo: '' },
  });

  function handlePay() {
    if (!flutterwaveConfig) return;
    const snapAmt   = amountNum;
    const snapFee   = fee;

    setFlw(true);
    setErrorMsg(null);

    handleFlutterPayment({
      callback: async (response) => {
        closePaymentModal();

        if (response.status !== 'successful' && response.status !== 'completed') {
          setFlw(false);
          setErrorMsg('Payment was cancelled or failed. Please try again.');
          return;
        }

        const ref = String(response.transaction_id ?? response.flw_ref ?? '');

        // Safety timeout — release button if DB call hangs
        const safetyTimer = setTimeout(() => {
          setFlw(false);
          setStep('error');
          setErrorMsg(
            `Your payment was received (ref: ${ref}) but could not be recorded automatically. ` +
            'Please contact the school finance office with this reference number.',
          );
        }, 25_000);

        try {
          // 1. Record the payment → updates student_fees balance via RPC
          await paymentService.recordPayment(schoolId, {
            student_id:       snapFee.student_id,
            student_fee_id:   snapFee.id,
            amount_usd:       snapAmt,
            amount_lrd:       0,
            currency_charged: 'USD',
            payment_method:   'visa',
            gateway_ref:      ref,
            recorded_by:      userId,
          });

          // 2. Generate invoice → finance sees it in their dashboard
          const dueDate = snapFee.due_date ?? new Date().toISOString().split('T')[0];
          const inv = await invoiceService.generate(schoolId, {
            student_id:   snapFee.student_id,
            total_amount: snapAmt,
            due_date:     dueDate,
          });

          clearTimeout(safetyTimer);
          setPayRef(ref);
          setInvoiceNum(inv.invoice_number);
          setStep('success');
          onPaid(); // triggers fee list refetch in parent
        } catch (err) {
          clearTimeout(safetyTimer);
          const msg = err instanceof Error ? err.message : String(err);
          setStep('error');
          setErrorMsg(
            `Payment received (ref: ${ref}) but an error occurred: ${msg}. ` +
            'Please contact the finance office with your reference number.',
          );
        } finally {
          setFlw(false);
        }
      },
      onClose: () => setFlw(false),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={step === 'invoice' ? onClose : undefined} />

      {/* Panel — slides from right */}
      <div className="relative ml-auto flex h-full w-full max-w-lg flex-col bg-white shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {step === 'success' ? 'Payment Complete!' : step === 'error' ? 'Payment Issue' : 'Pay Fee'}
            </h2>
            <p className="text-xs text-gray-400 capitalize">{feeType}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* ── SUCCESS ── */}
          {step === 'success' && (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle className="h-10 w-10 text-emerald-500" />
              </div>
              <h3 className="text-2xl font-extrabold text-gray-900">Payment Successful!</h3>
              <p className="mt-2 text-sm text-gray-500">
                Your payment has been recorded and your fee balance has been updated.
              </p>

              {/* Invoice number */}
              {invoiceNum && (
                <div className="mt-5 w-full rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-left">
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Invoice Number</p>
                  <p className="mt-1 font-mono text-xl font-bold text-emerald-800">{invoiceNum}</p>
                  <p className="mt-1 text-xs text-emerald-600">
                    Keep this for your records. The school finance office has received this invoice.
                  </p>
                </div>
              )}

              {/* Payment ref */}
              {payRef && (
                <div className="mt-3 w-full rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 text-left">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Flutterwave Reference</p>
                  <p className="mt-1 font-mono text-sm font-bold text-gray-700 break-all">{payRef}</p>
                </div>
              )}

              {/* Amount paid */}
              <div className="mt-3 w-full rounded-xl border border-blue-100 bg-blue-50 px-5 py-3 text-left">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-blue-700">Amount Paid</p>
                  <p className="text-lg font-extrabold text-blue-800">{fmtUSD(amountNum)}</p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="mt-6 w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow transition hover:bg-emerald-700"
              >
                Done — View Updated Fees
              </button>
            </div>
          )}

          {/* ── ERROR ── */}
          {step === 'error' && (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-10 w-10 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Payment Issue</h3>
              <div className="mt-4 w-full rounded-xl border border-red-200 bg-red-50 p-4 text-left text-sm text-red-700">
                {errorMsg}
              </div>
              <div className="mt-5 flex gap-3 w-full">
                <button
                  onClick={() => { setStep('invoice'); setErrorMsg(null); }}
                  className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Try Again
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 rounded-xl bg-gray-800 py-3 text-sm font-bold text-white"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {/* ── INVOICE / PAYMENT FORM ── */}
          {step === 'invoice' && (
            <div className="space-y-5">

              {/* Invoice preview */}
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-5">
                {/* Invoice header */}
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Invoice For</p>
                    <p className="mt-0.5 text-base font-bold text-gray-900">{studentName}</p>
                    <p className="text-xs text-gray-400">
                      Reg: {student.registration_number as string} &bull; Grade {student.current_grade_level as string}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">School</p>
                    <p className="mt-0.5 text-sm font-semibold text-gray-700">{schoolName}</p>
                  </div>
                </div>

                {/* Divider */}
                <div className="my-3 border-t border-dashed border-gray-300" />

                {/* Line items */}
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 capitalize">{feeType}</span>
                    <span className="font-semibold text-gray-800">{fmtUSD(fee.amount_due)}</span>
                  </div>
                  {fee.amount_paid > 0 && (
                    <div className="flex items-center justify-between text-emerald-600">
                      <span>Amount Already Paid</span>
                      <span>− {fmtUSD(fee.amount_paid)}</span>
                    </div>
                  )}
                </div>

                {/* Total */}
                <div className="mt-3 flex items-center justify-between rounded-lg bg-white px-4 py-3 shadow-sm">
                  <span className="text-sm font-bold text-gray-700">Balance Due</span>
                  <span className="text-xl font-extrabold text-red-600">{fmtUSD(fee.balance)}</span>
                </div>

                {fee.due_date && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-400">
                    <Clock className="h-3.5 w-3.5" />
                    Due: {new Date(fee.due_date).toLocaleDateString('en-US', { dateStyle: 'medium' })}
                  </div>
                )}
              </div>

              {/* Amount to pay */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Amount to Pay (USD)
                </label>
                <input
                  type="number"
                  min={0.01}
                  max={fee.balance}
                  step={0.01}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="block w-full rounded-xl border border-gray-300 px-4 py-3 text-xl font-bold text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Partial payments allowed &bull; Maximum: {fmtUSD(fee.balance)}
                </p>
              </div>

              {/* ── FLUTTERWAVE ── */}
              {paymentCfg?.flw_enabled && (
                <div className="space-y-3">
                  <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <p>Secure online payment. Pay now with your Visa, Mastercard, or bank transfer. You'll get an email receipt from Flutterwave, and an invoice will be sent to the school finance office.</p>
                  </div>
                  <button
                    onClick={handlePay}
                    disabled={!canPay || flwProcessing}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {flwProcessing ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
                    ) : (
                      <><CreditCard className="h-4 w-4" /> Pay {canPay ? fmtUSD(amountNum) : ''} Online &nbsp;<ArrowRight className="h-4 w-4" /></>
                    )}
                  </button>
                </div>
              )}

              {/* ── MTN MOBILE MONEY ── */}
              {paymentCfg?.mtn_enabled && paymentCfg.mtn_merchant_code && (
                <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-yellow-700" />
                    <p className="text-sm font-bold text-yellow-800">MTN Mobile Money</p>
                  </div>
                  <p className="text-2xl font-extrabold tracking-widest text-yellow-900">
                    {paymentCfg.mtn_merchant_code}
                  </p>
                  <p className="text-xs text-yellow-700 leading-relaxed">
                    Dial the MTN MoMo USSD, select Pay, enter the merchant code above, and send{' '}
                    <strong>{canPay ? fmtUSD(amountNum) : 'the amount'}</strong>.
                    Bring your confirmation SMS to the finance office to update your balance.
                  </p>
                </div>
              )}

              {/* ── ORANGE MONEY ── */}
              {paymentCfg?.orange_enabled && paymentCfg.orange_merchant_code && (
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-orange-700" />
                    <p className="text-sm font-bold text-orange-800">Orange Money</p>
                  </div>
                  <p className="text-2xl font-extrabold tracking-widest text-orange-900">
                    {paymentCfg.orange_merchant_code}
                  </p>
                  <p className="text-xs text-orange-700 leading-relaxed">
                    Use Orange Money to send <strong>{canPay ? fmtUSD(amountNum) : 'the amount'}</strong> to this merchant code.
                    Bring your confirmation to the finance office.
                  </p>
                </div>
              )}

              {/* ── CASH / BANK (always show as fallback) ── */}
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-gray-700">
                  <Banknote className="h-4 w-4" />
                  <p className="text-sm font-semibold">Pay at the Finance Office</p>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Visit the school finance office with your registration number{' '}
                  <strong>{student.registration_number as string}</strong>. The bursar will record your payment and give you a receipt.
                </p>
              </div>

              {/* No online methods at all */}
              {!paymentCfg?.flw_enabled && !paymentCfg?.mtn_enabled && !paymentCfg?.orange_enabled && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Online payment is not enabled for your school yet. Please use the cash or bank option above.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

export default function MyFees() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';
  const userId   = user?.id ?? '';

  const [activeTab,     setActiveTab]     = useState<'fees' | 'history' | 'invoices'>('fees');
  const [selectedFee,   setSelectedFee]   = useState<FeeRow | null>(null);
  const [paymentCfg,    setPaymentCfg]    = useState<PaymentConfigPublic | null>(null);
  const [cfgLoaded,     setCfgLoaded]     = useState(false);
  const [schoolName,    setSchoolName]    = useState('');

  // ── load school payment config + name ──────────────────────────────────────
  useEffect(() => {
    if (!schoolId) return;
    proprietorPaymentService
      .getPublicConfig(schoolId)
      .then((cfg) => setPaymentCfg(cfg))
      .catch(() => setPaymentCfg(null))
      .finally(() => setCfgLoaded(true));

    supabase
      .from('schools')
      .select('name')
      .eq('id', schoolId)
      .single()
      .then(({ data }) => { if (data) setSchoolName((data as { name: string }).name); });
  }, [schoolId]);

  // ── queries ─────────────────────────────────────────────────────────────────
  const { data: student } = useFetch(
    ['my-profile', schoolId, userId],
    () => studentPortalService.getMyProfile(schoolId, userId),
    { enabled: !!schoolId && !!userId },
  );

  const studentId = (student as Record<string, unknown> | undefined)?.id as string ?? '';

  const { data: rawFees = [], isLoading: feesLoading, refetch: refetchFees } = useFetch(
    ['my-fees', schoolId, studentId],
    () => studentPortalService.getMyFees(schoolId, studentId),
    { enabled: !!schoolId && !!studentId },
  );

  const { data: rawPayments = [], isLoading: _paymentsLoading } = useFetch(
    ['my-payments', schoolId, studentId],
    () => studentPortalService.getMyPayments(schoolId, studentId),
    { enabled: !!schoolId && !!studentId },
  );

  const { data: rawInvoices = [], refetch: refetchInvoices } = useFetch(
    ['my-invoices', schoolId, studentId],
    () => (studentId ? invoiceService.list(schoolId, { studentId }).then(r => r.data) : Promise.resolve([])),
    { enabled: !!schoolId && !!studentId },
  );

  const fees     = rawFees     as FeeRow[];
  const payments = rawPayments as PaymentRow[];
  const invoices = rawInvoices as { id: string; invoice_number: string; total_amount: number; status: string; issued_date: string; due_date: string }[];

  // ── computed totals ─────────────────────────────────────────────────────────
  const totalCharged  = fees.reduce((s, f) => s + f.amount_due, 0);
  const totalPaid     = fees.reduce((s, f) => s + f.amount_paid, 0);
  const balance       = totalCharged - totalPaid;
  const unpaidFees    = fees.filter((f) => f.status !== 'paid');

  // ── handle payment success ──────────────────────────────────────────────────
  function handlePaid() {
    refetchFees();
    refetchInvoices();
    // Close modal after a short delay so the success screen is visible
  }


  // ── loading ─────────────────────────────────────────────────────────────────
  const pageLoading = feesLoading || !cfgLoaded || !student;

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'My Portal' }, { label: 'My Fees' }]} />

      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Fees & Payments</h1>
        <p className="mt-1 text-sm text-slate-500">
          View your outstanding fees and pay online from anywhere, anytime.
        </p>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <DollarSign className="h-5 w-5 text-blue-500 mx-auto mb-1" />
          <p className="text-xs text-slate-500">Total Charged</p>
          <p className="text-lg font-bold text-slate-800">{fmtUSD(totalCharged)}</p>
        </Card>
        <Card className="p-4 text-center">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
          <p className="text-xs text-slate-500">Total Paid</p>
          <p className="text-lg font-bold text-emerald-600">{fmtUSD(totalPaid)}</p>
        </Card>
        <Card className="p-4 text-center">
          <AlertTriangle className="h-5 w-5 text-amber-500 mx-auto mb-1" />
          <p className="text-xs text-slate-500">Balance Due</p>
          <p className={`text-lg font-bold ${balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {fmtUSD(balance)}
          </p>
        </Card>
        <Card className="p-4 text-center">
          <Receipt className="h-5 w-5 text-purple-500 mx-auto mb-1" />
          <p className="text-xs text-slate-500">Invoices</p>
          <p className="text-lg font-bold text-slate-800">{invoices.length}</p>
        </Card>
      </div>

      {/* ── Outstanding balance banner ── */}
      {balance > 0 && (
        <div className="flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
            <div className="text-sm text-red-700">
              <p className="font-semibold">You have {unpaidFees.length} outstanding fee{unpaidFees.length > 1 ? 's' : ''}</p>
              <p className="text-xs mt-0.5">Total balance due: <strong>{fmtUSD(balance)}</strong>. Click "Pay Now" on any fee below to pay online instantly.</p>
            </div>
          </div>
          {paymentCfg?.flw_enabled && (
            <button
              onClick={() => { setActiveTab('fees'); if (unpaidFees[0]) setSelectedFee(unpaidFees[0]); }}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-red-700"
            >
              <CreditCard className="h-3.5 w-3.5" /> Pay Now
            </button>
          )}
        </div>
      )}

      {/* All clear */}
      {!pageLoading && balance === 0 && fees.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
          <p className="text-sm font-medium text-emerald-700">All fees paid — your account is fully up to date!</p>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="border-b border-slate-200">
        <div className="flex gap-0">
          {([
            { id: 'fees',     label: 'Fee Assignments',   count: fees.length },
            { id: 'history',  label: 'Payment History',   count: payments.length },
            { id: 'invoices', label: 'My Invoices',       count: invoices.length },
          ] as { id: 'fees' | 'history' | 'invoices'; label: string; count: number }[]).map(({ id, label, count }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {label}
              {count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${
                  activeTab === id ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                }`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Loading state ── */}
      {pageLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      )}

      {/* ── FEE ASSIGNMENTS TAB ── */}
      {!pageLoading && activeTab === 'fees' && (
        <div>
          {fees.length === 0 ? (
            <Card className="p-10 text-center">
              <DollarSign className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="font-medium text-slate-600">No fee assignments found.</p>
              <p className="text-xs text-slate-400 mt-1">The finance office hasn't assigned any fees to your account yet.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {fees.map((f) => {
                const feeType = f.fee_structures?.fee_type?.replace(/_/g, ' ') ?? 'Fee';
                const isPaid  = f.status === 'paid';
                return (
                  <Card
                    key={f.id}
                    className={`overflow-hidden transition-shadow ${!isPaid ? 'hover:shadow-md' : ''}`}
                  >
                    <div className="flex items-center gap-4 p-4">
                      {/* Icon */}
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                        isPaid ? 'bg-emerald-100' : 'bg-blue-100'
                      }`}>
                        {isPaid
                          ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                          : <DollarSign className="h-5 w-5 text-blue-600" />
                        }
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-slate-800 capitalize">{feeType}</p>
                          <Badge variant={statusVariant(f.status)} size="sm">{f.status}</Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
                          <span>Due: {f.due_date ? new Date(f.due_date).toLocaleDateString() : 'N/A'}</span>
                          {f.amount_paid > 0 && (
                            <span className="text-emerald-600">Paid: {fmtUSD(f.amount_paid)}</span>
                          )}
                        </div>
                      </div>

                      {/* Amount + action */}
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <p className="text-xs text-slate-400">Balance</p>
                          <p className={`text-lg font-extrabold ${f.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {fmtUSD(f.balance)}
                          </p>
                        </div>
                        {!isPaid && (
                          <button
                            onClick={() => setSelectedFee(f)}
                            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow transition hover:bg-blue-700"
                          >
                            <CreditCard className="h-4 w-4" />
                            Pay Now
                          </button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── PAYMENT HISTORY TAB ── */}
      {!pageLoading && activeTab === 'history' && (
        <div>
          {payments.length === 0 ? (
            <Card className="p-10 text-center">
              <Receipt className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="font-medium text-slate-600">No payments recorded yet.</p>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Date</th>
                      <th className="px-4 py-3 text-right font-medium text-slate-600">Amount</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Method</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Reference</th>
                      <th className="px-4 py-3 text-center font-medium text-slate-600">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {payments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 text-slate-700">
                          {p.payment_date
                            ? new Date(p.payment_date).toLocaleDateString()
                            : new Date(p.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                          {fmtUSD(p.amount_usd)}
                        </td>
                        <td className="px-4 py-3 text-slate-500 capitalize">
                          {p.payment_method === 'visa'   ? 'Card (Flutterwave)' :
                           p.payment_method === 'manual' ? 'Cash' :
                           p.payment_method}
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs font-mono max-w-[160px] truncate">
                          {p.gateway_ref?.split(' | ')[0] || '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={p.status === 'completed' || p.status === 'success' ? 'success' : 'warning'} size="sm">
                            {p.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── INVOICES TAB ── */}
      {!pageLoading && activeTab === 'invoices' && (
        <div>
          {invoices.length === 0 ? (
            <Card className="p-10 text-center">
              <FileText className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="font-medium text-slate-600">No invoices yet.</p>
              <p className="text-xs text-slate-400 mt-1">Invoices are created automatically when you pay online.</p>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Invoice #</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Issued</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Due Date</th>
                      <th className="px-4 py-3 text-right font-medium text-slate-600">Amount</th>
                      <th className="px-4 py-3 text-center font-medium text-slate-600">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-mono font-semibold text-blue-600">{inv.invoice_number}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {new Date(inv.issued_date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {new Date(inv.due_date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-800">
                          {fmtUSD(inv.total_amount)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge
                            variant={
                              inv.status === 'paid' ? 'success' :
                              inv.status === 'sent' ? 'warning' : 'default'
                            }
                            size="sm"
                          >
                            {inv.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── PAYMENT MODAL ── */}
      {selectedFee && student && (
        <PaymentModal
          fee={selectedFee}
          student={student as Record<string, unknown>}
          schoolId={schoolId}
          userId={userId}
          userEmail={user?.email ?? ''}
          paymentCfg={paymentCfg}
          schoolName={schoolName}
          onClose={() => setSelectedFee(null)}
          onPaid={handlePaid}
        />
      )}
    </div>
  );
}
