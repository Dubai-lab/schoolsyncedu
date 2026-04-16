import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { studentPortalService } from '@/services/studentPortalService';
import { invoiceService } from '@/services/feeService';
import { proprietorPaymentService, type PaymentConfigPublic } from '@/services/proprietorPaymentService';
import { bankTransferService, generateBankRef, type BankTransferProof } from '@/services/bankTransferService';
import { supabase } from '@/lib/supabase';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
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
  Clock,
  Landmark,
  Upload,
  Copy,
  CheckCheck,
  Image,
  Lock,
  ShieldCheck,
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

// ── Stripe Card Form (must be inside <Elements>) ──────────────────────────────

interface StripeCardFormProps {
  schoolId: string;
  studentId: string;
  studentFeeId: string;
  amountUsd: number;
  onSuccess: () => void;
  onError: (msg: string) => void;
}

function StripeCardForm({ schoolId, studentId, studentFeeId, amountUsd, onSuccess, onError }: StripeCardFormProps) {
  const stripe   = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  const handlePay = async () => {
    if (!stripe || !elements) return;
    setProcessing(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('school-stripe-payment', {
        body: { school_id: schoolId, student_id: studentId, student_fee_id: studentFeeId, amount_usd: amountUsd },
      });
      if (fnError) {
        // Extract the real error message from the Edge Function response body
        let msg = fnError.message;
        try {
          const body = await (fnError as unknown as { context: Response }).context?.json?.();
          if (body?.error) msg = body.error;
        } catch { /* ignore parse errors */ }
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
        <div className="rounded-lg border border-gray-300 px-3 py-3 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-400/20 transition-all bg-white">
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
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow transition hover:bg-blue-700 disabled:opacity-50"
      >
        {processing
          ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
          : <><Lock className="h-4 w-4" /> Pay {fmtUSD(amountUsd)} with Card</>}
      </button>
      <p className="text-center text-xs text-gray-400 flex items-center justify-center gap-1">
        <ShieldCheck className="h-3.5 w-3.5" /> Secure payment powered by Stripe
      </p>
    </div>
  );
}

// ── PAYMENT MODAL ─────────────────────────────────────────────────────────────

interface PaymentModalProps {
  fee: FeeRow;
  student: Record<string, unknown>;
  schoolId: string;
  userId: string;
  studentDbId: string;
  /** Auth email from useAuth() — the student's Supabase login email */
  userEmail: string;
  paymentCfg: PaymentConfigPublic | null;
  schoolName: string;
  onClose: () => void;
  onPaid: () => void;
}

function PaymentModal({
  fee, student, schoolId, studentDbId, paymentCfg, schoolName, onClose, onPaid,
}: PaymentModalProps) {
  const [amount, setAmount] = useState(String(fee.balance));

  // Stripe state
  const stripePromise = useMemo(
    () => paymentCfg?.stripe_enabled && paymentCfg.stripe_public_key
      ? loadStripe(paymentCfg.stripe_public_key)
      : null,
    [paymentCfg?.stripe_enabled, paymentCfg?.stripe_public_key],
  );
  const [stripeSuccess, setStripeSuccess] = useState(false);
  const [stripeError,   setStripeError]   = useState('');

  // Bank transfer state
  const [existingProof,     setExistingProof]     = useState<BankTransferProof | null | undefined>(undefined);
  const [bankRef,           setBankRef]           = useState('');
  const [proofFile,         setProofFile]         = useState<File | null>(null);
  const [proofPreview,      setProofPreview]       = useState<string | null>(null);
  const [bankNotes,         setBankNotes]         = useState('');
  const [submittingProof,   setSubmittingProof]   = useState(false);
  const [proofSubmitted,    setProofSubmitted]    = useState(false);
  const [proofError,        setProofError]        = useState('');
  const [copied,            setCopied]            = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const studentName = `${student.first_name as string} ${student.last_name as string}`;
  const feeType     = fee.fee_structures?.fee_type?.replace(/_/g, ' ') ?? 'School Fee';
  const regNumber   = student.registration_number as string;

  const amountNum = Number(amount);
  const canPay    = amountNum > 0 && amountNum <= fee.balance && !isNaN(amountNum);

  // Check if student already submitted proof for this fee
  useEffect(() => {
    bankTransferService.getProofForFee(fee.id)
      .then(setExistingProof)
      .catch(() => setExistingProof(null));
    setBankRef(generateBankRef(schoolId, regNumber));
  }, [fee.id, schoolId, regNumber]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setProofFile(f);
    if (f.type.startsWith('image/')) {
      setProofPreview(URL.createObjectURL(f));
    } else {
      setProofPreview(null);
    }
  }

  async function handleSubmitProof() {
    if (!proofFile && !bankNotes) {
      setProofError('Please upload your proof of payment or add a note about your transfer.');
      return;
    }
    setSubmittingProof(true);
    setProofError('');
    try {
      let proofUrl: string | null = null;
      let proofFilename: string | null = null;

      if (proofFile) {
        proofUrl = await bankTransferService.uploadProof(proofFile, schoolId, bankRef);
        proofFilename = proofFile.name;
      }

      await bankTransferService.submitProof({
        schoolId,
        studentId:       studentDbId,
        studentFeeId:    fee.id,
        amountUsd:       amountNum,
        referenceNumber: bankRef,
        proofUrl,
        proofFilename,
        studentNotes:    bankNotes,
      });
      setProofSubmitted(true);
      onPaid();
    } catch (err) {
      setProofError(err instanceof Error ? err.message : 'Failed to submit proof');
    } finally {
      setSubmittingProof(false);
    }
  }

  function copyRef() {
    navigator.clipboard.writeText(bankRef).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel — slides from right */}
      <div className="relative ml-auto flex h-full w-full max-w-lg flex-col bg-white shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Pay Fee</h2>
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

              {/* ── STRIPE CARD PAYMENT ── */}
              {paymentCfg?.stripe_enabled && stripePromise && canPay && (
                <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-purple-700" />
                    <p className="text-sm font-bold text-purple-800">Pay by Card (Stripe)</p>
                  </div>
                  {stripeSuccess ? (
                    <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 p-3 text-xs text-green-700">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      Card payment successful! Your fee balance has been updated.
                    </div>
                  ) : (
                    <>
                      {stripeError && (
                        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">{stripeError}</p>
                      )}
                      <Elements stripe={stripePromise}>
                        <StripeCardForm
                          schoolId={schoolId}
                          studentId={studentDbId}
                          studentFeeId={fee.id}
                          amountUsd={amountNum}
                          onSuccess={() => { setStripeSuccess(true); setStripeError(''); onPaid(); }}
                          onError={(msg) => setStripeError(msg)}
                        />
                      </Elements>
                    </>
                  )}
                </div>
              )}

              {/* ── BANK TRANSFER ── */}
              {paymentCfg?.bank_enabled && paymentCfg.bank_account_number && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Landmark className="h-4 w-4 text-blue-700" />
                    <p className="text-sm font-bold text-blue-800">Bank Transfer</p>
                  </div>

                  {/* Bank details */}
                  <div className="rounded-lg bg-white border border-blue-100 p-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500 text-xs">Account Name</span>
                      <span className="font-semibold text-gray-800 text-xs">{paymentCfg.bank_account_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 text-xs">Account Number</span>
                      <span className="font-mono font-bold text-gray-900">{paymentCfg.bank_account_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 text-xs">Bank</span>
                      <span className="font-medium text-gray-800 text-xs">{paymentCfg.bank_name}</span>
                    </div>
                    {paymentCfg.bank_routing_number && (
                      <div className="flex justify-between">
                        <span className="text-gray-500 text-xs">Routing / Sort Code</span>
                        <span className="font-mono text-gray-800 text-xs">{paymentCfg.bank_routing_number}</span>
                      </div>
                    )}
                    {paymentCfg.bank_swift_code && (
                      <div className="flex justify-between">
                        <span className="text-gray-500 text-xs">SWIFT / BIC</span>
                        <span className="font-mono text-gray-800 text-xs">{paymentCfg.bank_swift_code}</span>
                      </div>
                    )}
                  </div>

                  {/* Unique reference */}
                  <div>
                    <p className="text-xs font-semibold text-blue-700 mb-1">Your Payment Reference</p>
                    <div className="flex items-center gap-2 rounded-lg bg-white border border-blue-200 px-3 py-2">
                      <span className="font-mono text-sm font-bold text-blue-900 flex-1 break-all">{bankRef}</span>
                      <button
                        type="button"
                        onClick={copyRef}
                        className="text-blue-500 hover:text-blue-700 shrink-0"
                        title="Copy reference"
                      >
                        {copied ? <CheckCheck className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-blue-600 mt-1">
                      Use this as the payment narration/reference when making your transfer.
                    </p>
                  </div>

                  {paymentCfg.bank_instructions && (
                    <p className="text-xs text-blue-700 leading-relaxed border-t border-blue-100 pt-2">
                      {paymentCfg.bank_instructions}
                    </p>
                  )}

                  {/* Proof upload */}
                  {existingProof === undefined ? (
                    <div className="text-xs text-blue-500 animate-pulse">Checking submission status…</div>
                  ) : existingProof?.status === 'verified' ? (
                    <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 p-2 text-xs text-green-700">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      Payment verified — your fee has been updated.
                    </div>
                  ) : existingProof?.status === 'pending' ? (
                    <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 p-2 text-xs text-amber-700">
                      <Clock className="h-4 w-4 shrink-0" />
                      Proof submitted — awaiting bursar verification.
                    </div>
                  ) : existingProof?.status === 'rejected' ? (
                    <div className="rounded-lg bg-red-50 border border-red-200 p-2 text-xs text-red-700 space-y-1">
                      <p className="font-semibold">Proof rejected by bursar.</p>
                      {existingProof.bursar_notes && <p>{existingProof.bursar_notes}</p>}
                      <p>Please re-transfer and upload a new proof below.</p>
                    </div>
                  ) : null}

                  {/* Upload form — show if no pending/verified proof */}
                  {(existingProof === null || existingProof?.status === 'rejected') && !proofSubmitted && canPay && (
                    <div className="space-y-2 border-t border-blue-100 pt-3">
                      <p className="text-xs font-semibold text-blue-700">Upload Proof of Payment</p>

                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-blue-300 bg-white p-4 cursor-pointer hover:border-blue-400 transition-colors"
                      >
                        {proofPreview ? (
                          <img src={proofPreview} alt="proof" className="max-h-28 rounded object-contain" />
                        ) : proofFile ? (
                          <div className="flex items-center gap-2 text-xs text-blue-700">
                            <FileText className="h-5 w-5" />
                            {proofFile.name}
                          </div>
                        ) : (
                          <>
                            <Image className="h-8 w-8 text-blue-300 mb-1" />
                            <p className="text-xs text-blue-500">Tap to upload receipt / screenshot</p>
                            <p className="text-xs text-blue-400">JPG, PNG, PDF — max 5 MB</p>
                          </>
                        )}
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          className="hidden"
                          onChange={handleFileChange}
                        />
                      </div>

                      <textarea
                        rows={2}
                        placeholder="Optional note (e.g. transfer date, sender name)"
                        value={bankNotes}
                        onChange={(e) => setBankNotes(e.target.value)}
                        className="w-full rounded-lg border border-blue-200 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                      />

                      {proofError && (
                        <p className="text-xs text-red-600">{proofError}</p>
                      )}

                      <button
                        type="button"
                        onClick={handleSubmitProof}
                        disabled={submittingProof}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
                      >
                        {submittingProof
                          ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>
                          : <><Upload className="h-4 w-4" /> Submit Proof</>}
                      </button>
                    </div>
                  )}

                  {proofSubmitted && (
                    <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 p-2 text-xs text-green-700">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      Proof submitted! The bursar will verify your payment shortly.
                    </div>
                  )}
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

              {/* No payment method configured */}
              {!paymentCfg?.mtn_enabled && !paymentCfg?.orange_enabled && !paymentCfg?.bank_enabled && !paymentCfg?.stripe_enabled && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  No online payment method is configured for your school. Please pay in person at the finance office.
                </div>
              )}
          </div>
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
          <button
            onClick={() => { setActiveTab('fees'); if (unpaidFees[0]) setSelectedFee(unpaidFees[0]); }}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-red-700"
          >
            <CreditCard className="h-3.5 w-3.5" /> View Fees
          </button>
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
          studentDbId={studentId}
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
