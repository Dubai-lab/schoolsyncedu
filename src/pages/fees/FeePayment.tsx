import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { studentFeeService, paymentService } from '@/services/feeService';
import { proprietorPaymentService, type PaymentConfigPublic } from '@/services/proprietorPaymentService';
import { supabase } from '@/lib/supabase';
import { CURRENCY } from '@/utils/constants';
import { notify } from '@/components/shared/Toast';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Breadcrumb from '@/components/shared/Breadcrumb';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import {
  CreditCard,
  Search,
  CheckCircle,
  Upload,
  Receipt,
  Banknote,
  FileText,
  AlertTriangle,
  Smartphone,
  Building2,
  Wallet,
  Printer,
} from 'lucide-react';
import Dialog, { DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/Dialog';

const PRINT_STYLES = `
@media print {
  body * { visibility: hidden !important; }
  #fee-receipt-printable, #fee-receipt-printable * { visibility: visible !important; }
  #fee-receipt-printable {
    position: fixed !important;
    top: 0; left: 0;
    width: 80mm;
    padding: 8mm;
    font-size: 11px;
    background: white;
  }
}
`;

interface ReceiptData {
  studentName: string;
  feeType: string;
  gradeLevel: string;
  amountPaid: string;
  currency: string;
  method: string;
  receiptNumber: string;
  payerName: string;
}

function PaymentReceiptModal({ data, onClose }: { data: ReceiptData; onClose: () => void }) {
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  return (
    <>
      <style>{PRINT_STYLES}</style>
      <Dialog open onClose={onClose}>
        <DialogHeader><DialogTitle>Payment Receipt</DialogTitle></DialogHeader>
        <DialogBody>
          <div id="fee-receipt-printable" className="p-3 space-y-3 text-sm">
            <div className="text-center border-b border-slate-200 pb-3">
              <div className="flex h-9 w-9 mx-auto items-center justify-center rounded-full bg-emerald-100 mb-1.5">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <h2 className="text-base font-bold text-slate-900">Payment Receipt</h2>
              <p className="text-xs text-slate-400">{date}</p>
            </div>
            <div className="space-y-1.5">
              {[
                { label: 'Receipt #',   value: data.receiptNumber, mono: true },
                { label: 'Student',     value: data.studentName },
                { label: 'Fee Type',    value: data.feeType },
                { label: 'Grade',       value: data.gradeLevel },
                { label: 'Method',      value: data.method },
                ...(data.payerName ? [{ label: 'Paid By', value: data.payerName }] : []),
              ].map(({ label, value, mono }) => (
                <div key={label} className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">{label}</span>
                  <span className={`text-slate-800 font-medium ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
                </div>
              ))}
              <div className="flex justify-between py-1.5 border-t border-slate-300 mt-1">
                <span className="font-semibold text-slate-700">Amount Paid</span>
                <span className="font-bold text-emerald-700">
                  {data.currency === 'LRD' ? 'L$' : '$'}{data.amountPaid} {data.currency}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Status</span>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">PAID</span>
              </div>
            </div>
            <p className="text-center text-xs text-slate-500 border-t border-slate-100 pt-2">
              Keep this receipt as proof of payment.
            </p>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
          <Button size="sm" onClick={() => window.print()} icon={<Printer className="h-4 w-4" />}>Print</Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}

const currencyOptions = Object.entries(CURRENCY).map(([, v]) => ({
  label: v,
  value: v,
}));

function statusVariant(status: string) {
  if (status === 'paid') return 'success' as const;
  if (status === 'partial') return 'warning' as const;
  if (status === 'overdue') return 'danger' as const;
  return 'default' as const;
}

function formatCurrency(amount: number) {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Payment method option type ──────────────────────────────────────────────
type MethodOption = {
  value: string;
  label: string;
  icon: React.ElementType;
  description: string;
  requiresUpload?: boolean;
  requiresRef?: boolean;
  isOnline?: boolean;
};

function buildMethodOptions(cfg: PaymentConfigPublic | null): MethodOption[] {
  const options: MethodOption[] = [];

  // Cash is ALWAYS available (student/parent walks in to the office)
  options.push({
    value: 'cash',
    label: 'Cash Payment',
    icon: Banknote,
    description: 'Student or parent pays cash at the school office.',
    requiresRef: false,
  });

  // Bank transfer (manual — student visits bank and returns with receipt)
  options.push({
    value: 'bank',
    label: 'Bank Deposit / Transfer',
    icon: Building2,
    description: 'Student visits the bank and returns with a deposit slip.',
    requiresUpload: true,
    requiresRef: true,
  });

  if (!cfg) return options;

  // MTN Mobile Money
  if (cfg.mtn_enabled && cfg.mtn_merchant_code) {
    options.push({
      value: 'mtn',
      label: 'MTN Mobile Money',
      icon: Smartphone,
      description: `Send to MTN MoMo merchant code: ${cfg.mtn_merchant_code}. Enter the transaction ID below.`,
      requiresRef: true,
      requiresUpload: true,
    });
  }

  // Orange Money
  if (cfg.orange_enabled && cfg.orange_merchant_code) {
    options.push({
      value: 'orange',
      label: 'Orange Money',
      icon: Wallet,
      description: `Send to Orange Money merchant code: ${cfg.orange_merchant_code}. Enter the transaction ID below.`,
      requiresRef: true,
      requiresUpload: true,
    });
  }

  return options;
}

// ── Derive payment_method enum value for DB from UI value ────────────────────
function toDbMethod(v: string): 'visa' | 'mtn' | 'orange' | 'bank' | 'manual' {
  if (v === 'flutterwave') return 'visa';
  if (v === 'cash') return 'manual';
  if (v === 'bank') return 'bank';
  if (v === 'mtn') return 'mtn';
  if (v === 'orange') return 'orange';
  return 'manual';
}

export default function FeePayment() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const schoolId = user?.school_id ?? '';
  const userId = user?.id ?? '';
  const receiptInputRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState('');
  const [selectedFeeId, setSelectedFeeId] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<'USD' | 'LRD'>('USD');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [gatewayRef, setGatewayRef] = useState('');

  // Auto-generate a receipt number when cash is selected
  function generateReceiptNumber() {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
    return `REC-${ts}-${rand}`;
  }
  const [payerName, setPayerName] = useState('');
  const [payerNotes, setPayerNotes] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [lastPaymentId, setLastPaymentId] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  // ── Fetch school payment config ─────────────────────────────
  const [paymentCfg, setPaymentCfg] = useState<PaymentConfigPublic | null>(null);
  const [cfgLoading, setCfgLoading] = useState(true);

  useEffect(() => {
    if (!schoolId) return;
    proprietorPaymentService
      .getPublicConfig(schoolId)
      .then((cfg) => setPaymentCfg(cfg))
      .catch(() => setPaymentCfg(null))
      .finally(() => setCfgLoading(false));
  }, [schoolId]);

  const methodOptions = buildMethodOptions(paymentCfg);

  // ── Fetch unpaid/partial fees ────────────────────────────────
  const { data: feesResult, isLoading: feesLoading } = useFetch(
    ['unpaid-fees', schoolId],
    () => studentFeeService.list(schoolId, { pageSize: 200 }),
    { enabled: !!schoolId },
  );

  const allFees = feesResult?.data ?? [];
  const unpaidFees = allFees.filter((f) => f.status !== 'paid');
  const filteredFees = unpaidFees.filter((f) => {
    if (!search) return true;
    const student = f.students as Record<string, string> | undefined;
    const name = student ? `${student.first_name} ${student.last_name}` : '';
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const selectedFee = allFees.find((f) => f.id === selectedFeeId);
  const selectedStudent = selectedFee?.students as Record<string, string> | undefined;
  const selectedStructure = selectedFee?.fee_structures as Record<string, string> | undefined;

  // ── Core record-payment helper (manual methods) ─────────────
  async function doRecord(opts: {
    dbMethod: 'visa' | 'mtn' | 'orange' | 'bank' | 'manual';
    ref?: string;
    receiptUrl?: string;
  }) {
    if (!selectedFee) throw new Error('No fee selected');
    const amountNum = Number(amount);
    if (isNaN(amountNum) || amountNum <= 0) throw new Error('Enter a valid amount');

    return paymentService.recordPayment(schoolId, {
      student_id:       selectedFee.student_id,
      student_fee_id:   selectedFee.id,
      amount_usd:       currency === 'USD' ? amountNum : 0,
      amount_lrd:       currency === 'LRD' ? amountNum : 0,
      currency_charged: currency,
      payment_method:   opts.dbMethod,
      gateway_ref:      [
        opts.ref,
        payerName ? `Payer: ${payerName}` : '',
        payerNotes ? `Notes: ${payerNotes}` : '',
        opts.receiptUrl ? `Receipt: ${opts.receiptUrl}` : '',
      ].filter(Boolean).join(' | ') || undefined,
      recorded_by: userId,
    });
  }

  // ── Upload receipt if attached ───────────────────────────────
  async function uploadReceipt(): Promise<string | undefined> {
    if (!receiptFile) return undefined;
    setUploadingReceipt(true);
    const ext = receiptFile.name.split('.').pop();
    const path = `receipts/${schoolId}/${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const { error } = await supabase.storage
      .from('documents')
      .upload(path, receiptFile, { contentType: receiptFile.type });
    setUploadingReceipt(false);
    if (error) throw new Error('Failed to upload receipt: ' + error.message);
    const { data } = supabase.storage.from('documents').getPublicUrl(path);
    return data.publicUrl;
  }

  // ── Manual payment mutation ──────────────────────────────────
  const payMutation = useMutate(
    async () => {
      const receiptUrl = await uploadReceipt();
      return doRecord({
        dbMethod: toDbMethod(paymentMethod),
        ref: gatewayRef || undefined,
        receiptUrl,
      });
    },
    [['student-fees'], ['unpaid-fees'], ['payments']],
    {
      onSuccess: (data) => {
        notify.success('Payment recorded! Student balance has been updated.');
        setPaymentSuccess(true);
        const p = data as unknown as Record<string, string> | null;
        setLastPaymentId(p?.id ?? null);
        setReceiptData({
          studentName: `${selectedStudent?.first_name ?? ''} ${selectedStudent?.last_name ?? ''}`.trim(),
          feeType: selectedStructure?.fee_type ?? '—',
          gradeLevel: selectedStructure?.grade_level ?? '—',
          amountPaid: Number(amount).toFixed(2),
          currency,
          method: paymentMethod === 'cash' ? 'Cash' : paymentMethod === 'bank' ? 'Bank Deposit' : paymentMethod.toUpperCase(),
          receiptNumber: gatewayRef || '—',
          payerName: payerName,
        });
        resetForm();
      },
    },
  );

  function resetForm() {
    setAmount('');
    setGatewayRef('');
    setPayerName('');
    setPayerNotes('');
    setReceiptFile(null);
  }

  const canPay = selectedFeeId && amount && Number(amount) > 0 && paymentMethod;

  if (cfgLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Fees', href: '/fees' }, { label: 'Record Payment' }]} />
      <h1 className="text-xl font-bold text-slate-900">Record Payment</h1>

      {/* No payment methods configured warning */}
      {!paymentCfg && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <p className="text-sm text-amber-800">
            <strong>No online payment methods configured.</strong> The proprietor has not set up Flutterwave, MTN, or
            Orange Money. Only cash and bank deposit are available. Contact the school owner to configure payment settings.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* ── Left: Fee list ───────────────────────────── */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <Input
              placeholder="Search student..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search className="h-4 w-4" />}
            />
          </CardHeader>
          <CardContent className="max-h-[500px] overflow-y-auto p-0">
            {feesLoading ? (
              <LoadingSpinner label="Loading fees..." fullPage={false} />
            ) : filteredFees.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">No outstanding fees found.</p>
            ) : (
              <ul className="divide-y">
                {filteredFees.map((f) => {
                  const student = f.students as Record<string, string> | undefined;
                  const structure = f.fee_structures as Record<string, string> | undefined;
                  return (
                    <li key={f.id}>
                      <button
                        onClick={() => { setSelectedFeeId(f.id); setPaymentSuccess(false); setPaymentMethod(''); }}
                        className={`w-full px-4 py-3 text-left transition-colors hover:bg-slate-50 ${
                          selectedFeeId === f.id ? 'border-l-2 border-primary-500 bg-primary-50' : ''
                        }`}
                      >
                        <p className="text-sm font-medium text-slate-900">
                          {student ? `${student.first_name} ${student.last_name}` : 'Unknown'}
                        </p>
                        <div className="mt-0.5 flex items-center gap-2">
                          <span className="text-xs capitalize text-slate-400">{structure?.fee_type}</span>
                          <Badge variant={statusVariant(f.status)} size="sm">{f.status}</Badge>
                        </div>
                        <p className="mt-0.5 text-xs font-medium text-red-500">Balance: {formatCurrency(f.balance)}</p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* ── Right: Payment form ──────────────────────── */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              {selectedFee
                ? `Pay for ${selectedStudent?.first_name} ${selectedStudent?.last_name}`
                : 'Select a Fee'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedFee ? (
              <div className="py-12 text-center">
                <CreditCard className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                <p className="text-sm text-slate-400">Select a student fee from the list to record a payment.</p>
              </div>
            ) : paymentSuccess ? (
              <div className="py-12 text-center">
                <CheckCircle className="mx-auto mb-3 h-12 w-12 text-emerald-500" />
                <p className="text-lg font-semibold text-slate-900">Payment Recorded!</p>
                <p className="mt-1 text-sm text-slate-400">The student's balance has been updated.</p>
                <div className="mt-4 flex justify-center gap-3">
                  <Button onClick={() => setReceiptData(receiptData)}>
                    <Printer className="mr-1 h-4 w-4" /> Print Receipt
                  </Button>
                  {lastPaymentId && (
                    <Button variant="outline" onClick={() => navigate(`/fees/receipt/${lastPaymentId}`)}>
                      <Receipt className="mr-1 h-4 w-4" /> Full Receipt
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => { setPaymentSuccess(false); setLastPaymentId(null); setReceiptData(null); }}>
                    Record Another
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Fee summary */}
                <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-4 text-sm">
                  <div>
                    <p className="text-slate-400">Fee Type</p>
                    <p className="font-medium capitalize">{selectedStructure?.fee_type}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Grade</p>
                    <p className="font-medium">{selectedStructure?.grade_level}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Amount Due</p>
                    <p className="font-medium">{formatCurrency(selectedFee.amount_due)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Amount Paid</p>
                    <p className="font-medium text-emerald-600">{formatCurrency(selectedFee.amount_paid)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Balance</p>
                    <p className="font-bold text-red-600">{formatCurrency(selectedFee.balance)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Due Date</p>
                    <p className="font-medium">
                      {selectedFee.due_date ? new Date(selectedFee.due_date).toLocaleDateString() : '—'}
                    </p>
                  </div>
                </div>

                {/* Amount + currency */}
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Amount"
                    type="number"
                    min={0}
                    max={selectedFee.balance}
                    step={0.01}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={`Max: ${selectedFee.balance}`}
                  />
                  <Select
                    label="Currency"
                    options={currencyOptions}
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as 'USD' | 'LRD')}
                  />
                </div>

                {/* ── Payment method selector ──────────────── */}
                <div>
                  <p className="mb-2 text-sm font-medium text-slate-700">Payment Method</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {methodOptions.map((m) => {
                      const Icon = m.icon;
                      return (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => {
                            setPaymentMethod(m.value);
                            if (m.value === 'cash') setGatewayRef(generateReceiptNumber());
                            else if (m.value !== 'bank') setGatewayRef('');
                          }}
                          className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all ${
                            paymentMethod === m.value
                              ? 'border-primary-400 bg-primary-50 ring-1 ring-primary-400'
                              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                            paymentMethod === m.value ? 'bg-primary-100' : 'bg-slate-100'
                          }`}>
                            <Icon className={`h-4 w-4 ${paymentMethod === m.value ? 'text-primary-600' : 'text-slate-500'}`} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{m.label}</p>
                            <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{m.description}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ── MTN / Orange: show merchant code + ref field ── */}
                {(paymentMethod === 'mtn' || paymentMethod === 'orange') && (
                  <div className={`rounded-xl border p-4 space-y-4 ${
                    paymentMethod === 'mtn' ? 'border-yellow-200 bg-yellow-50' : 'border-orange-200 bg-orange-50'
                  }`}>
                    <p className={`flex items-center gap-2 text-sm font-semibold ${
                      paymentMethod === 'mtn' ? 'text-yellow-800' : 'text-orange-800'
                    }`}>
                      <Smartphone className="h-4 w-4" />
                      {paymentMethod === 'mtn' ? 'MTN Mobile Money' : 'Orange Money'}
                    </p>
                    <div className={`rounded-lg p-3 text-sm ${
                      paymentMethod === 'mtn' ? 'bg-yellow-100 text-yellow-900' : 'bg-orange-100 text-orange-900'
                    }`}>
                      <p className="font-semibold">Merchant Code:</p>
                      <p className="text-xl font-extrabold tracking-widest mt-1">
                        {paymentMethod === 'mtn' ? paymentCfg?.mtn_merchant_code : paymentCfg?.orange_merchant_code}
                      </p>
                      <p className="mt-2 text-xs opacity-70">
                        Instruct the payer to dial the USSD code, select Pay, enter the merchant code above, then enter amount{' '}
                        {currency === 'USD' ? `$${amount}` : `LD${amount}`}.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Input
                        label="Transaction ID / Reference *"
                        value={gatewayRef}
                        onChange={(e) => setGatewayRef(e.target.value)}
                        placeholder="From the MoMo confirmation SMS"
                      />
                      <Input
                        label="Payer Name"
                        value={payerName}
                        onChange={(e) => setPayerName(e.target.value)}
                        placeholder="Name on the MoMo account"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        <Upload className="inline mr-1 h-3.5 w-3.5" /> Screenshot / Confirmation (optional)
                      </label>
                      <input
                        ref={receiptInputRef}
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                      />
                      <button
                        type="button"
                        onClick={() => receiptInputRef.current?.click()}
                        className="w-full rounded-lg border-2 border-dashed border-amber-300 bg-white px-3 py-2.5 text-sm text-amber-700 transition-colors hover:border-amber-400 hover:bg-amber-50"
                      >
                        {receiptFile ? (
                          <span className="flex items-center gap-2">
                            <FileText className="h-4 w-4" /> {receiptFile.name}
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <Upload className="h-4 w-4" /> Upload confirmation screenshot
                          </span>
                        )}
                      </button>
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => payMutation.mutate(undefined)}
                      loading={payMutation.isPending || uploadingReceipt}
                      disabled={!canPay || !gatewayRef}
                    >
                      <Smartphone className="mr-1.5 h-4 w-4" /> Confirm {paymentMethod === 'mtn' ? 'MTN MoMo' : 'Orange Money'} Payment
                    </Button>
                  </div>
                )}

                {/* ── Cash / Bank deposit ─────────────────── */}
                {(paymentMethod === 'cash' || paymentMethod === 'bank') && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-4">
                    <p className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                      {paymentMethod === 'bank' ? <Building2 className="h-4 w-4" /> : <Banknote className="h-4 w-4" />}
                      {paymentMethod === 'bank' ? 'Bank Deposit Details' : 'Cash Payment Details'}
                    </p>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Input
                        label={paymentMethod === 'bank' ? 'Bank Slip / Reference #' : 'Receipt Number'}
                        value={gatewayRef}
                        onChange={(e) => paymentMethod === 'bank' && setGatewayRef(e.target.value)}
                        placeholder={paymentMethod === 'bank' ? 'Bank deposit slip number' : ''}
                        readOnly={paymentMethod === 'cash'}
                        hint={paymentMethod === 'cash' ? 'Auto-generated' : undefined}
                      />
                      <Input
                        label="Payer Name"
                        value={payerName}
                        onChange={(e) => setPayerName(e.target.value)}
                        placeholder="Name of person who paid"
                      />
                    </div>
                    {paymentMethod === 'bank' && (
                      <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">
                          <Upload className="inline mr-1 h-3.5 w-3.5" /> Bank Deposit Slip
                        </label>
                        <input
                          ref={receiptInputRef}
                          type="file"
                          accept="image/*,.pdf"
                          className="hidden"
                          onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                        />
                        <button
                          type="button"
                          onClick={() => receiptInputRef.current?.click()}
                          className="w-full rounded-lg border-2 border-dashed border-amber-300 bg-white px-3 py-2.5 text-sm text-amber-700 transition-colors hover:border-amber-400 hover:bg-amber-50"
                        >
                          {receiptFile ? (
                            <span className="flex items-center gap-2">
                              <FileText className="h-4 w-4" /> {receiptFile.name}
                            </span>
                          ) : (
                            <span className="flex items-center gap-2">
                              <Upload className="h-4 w-4" /> Upload deposit slip
                            </span>
                          )}
                        </button>
                      </div>
                    )}
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
                      <textarea
                        rows={2}
                        value={payerNotes}
                        onChange={(e) => setPayerNotes(e.target.value)}
                        placeholder={
                          paymentMethod === 'bank'
                            ? 'Bank name, date, branch...'
                            : 'Any additional notes...'
                        }
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button
                        onClick={() => payMutation.mutate(undefined)}
                        loading={payMutation.isPending || uploadingReceipt}
                        disabled={!canPay}
                      >
                        {paymentMethod === 'bank'
                          ? <><Building2 className="mr-1 h-4 w-4" /> Record Bank Payment</>
                          : <><Banknote className="mr-1 h-4 w-4" /> Record Cash Payment</>
                        }
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {receiptData && (
        <PaymentReceiptModal data={receiptData} onClose={() => setReceiptData(null)} />
      )}
    </div>
  );
}
