import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { schoolSiteService } from '@/services/schoolSiteService';
import { publicApplicationService } from '@/services/registrarService';
import { supabase } from '@/lib/supabase';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import type { School } from '@/types/school.types';
import {
  GraduationCap,
  User,
  Users,
  FileText,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Send,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  Calendar,
  BookOpen,
  Search,
  Upload,
  X,
  Smartphone,
  Building2,
  CheckCircle2,
  Landmark,
  CreditCard,
  Lock,
  ShieldCheck,
  Copy,
  CheckCheck,
  Loader2,
} from 'lucide-react';

const RELATIONSHIPS = ['Mother', 'Father', 'Guardian', 'Relative'];

// ── Stripe card form for application fee (must be inside <Elements>) ──────────

interface AppStripeCardFormProps {
  schoolId: string;
  applicationId: string;
  amountUsd: number;
  onSuccess: () => void;
  onError: (msg: string) => void;
}

function AppStripeCardForm({ schoolId, applicationId, amountUsd, onSuccess, onError }: AppStripeCardFormProps) {
  const stripe   = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  const handlePay = async () => {
    if (!stripe || !elements) return;
    setProcessing(true);
    try {
      // Create PaymentIntent using school's own Stripe keys
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

      // Mark application fee paid via anon-safe RPC
      const { createClient } = await import('@supabase/supabase-js');
      const anonClient = createClient(
        import.meta.env.VITE_SUPABASE_URL as string,
        import.meta.env.VITE_SUPABASE_ANON_KEY as string,
        { auth: { persistSession: false, autoRefreshToken: false, storageKey: 'sb-appfee-token' } },
      );
      await anonClient.rpc('mark_application_fee_paid_stripe', {
        p_application_id:   applicationId,
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

type Step = 'student' | 'guardian' | 'documents' | 'review';

const STEPS: { key: Step; label: string; icon: React.ElementType }[] = [
  { key: 'student', label: 'Student Info', icon: User },
  { key: 'guardian', label: 'Guardian Info', icon: Users },
  { key: 'documents', label: 'Documents', icon: FileText },
  { key: 'review', label: 'Review & Submit', icon: CheckCircle },
];

export default function SchoolApplicationForm() {
  const { slug } = useParams<{ slug: string }>();
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [step, setStep] = useState<Step>('student');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ application_number: string; application_fee: number; application_id: string } | null>(null);
  const [error, setError] = useState('');
  const [paymentFeePaid] = useState(false);

  // School payment config (loaded after school is known)
  const [payConfig, setPayConfig] = useState<{
    flw_enabled: boolean; flw_public_key: string; flw_methods: string[];
    flw_currency: string; mtn_enabled: boolean; mtn_merchant_code: string;
    orange_enabled: boolean; orange_merchant_code: string;
    bank_enabled: boolean; bank_account_name: string; bank_account_number: string;
    bank_name: string; bank_routing_number: string; bank_swift_code: string;
    bank_instructions: string;
    stripe_enabled: boolean; stripe_public_key: string; stripe_currency: string;
    payment_title: string; payment_logo: string;
  } | null>(null);
  // Stripe state for application fee payment
  const stripeAppPromise = useMemo(
    () => payConfig?.stripe_enabled && payConfig.stripe_public_key
      ? loadStripe(payConfig.stripe_public_key)
      : null,
    [payConfig?.stripe_enabled, payConfig?.stripe_public_key],
  );
  const [appStripeSuccess, setAppStripeSuccess] = useState(false);
  const [appStripeError,   setAppStripeError]   = useState('');
  const [copiedBankRef,    setCopiedBankRef]     = useState(false);

  // Form state
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
    gradeLevel: '',
    classId: '',
    previousSchool: '',
    previousGrade: '',
    guardianFullName: '',
    guardianRelationship: '',
    guardianEmail: '',
    guardianPhone: '',
    guardianAddress: '',
    guardianOccupation: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelationship: '',
  });

  // School classes for the grade/class picker
  const [schoolClasses, setSchoolClasses] = useState<{ id: string; name: string; grade_level: string | null; section: string | null }[]>([]);

  // Document uploads
  const [documents, setDocuments] = useState<{ name: string; file: File; label: string }[]>([]);
  const [uploadingDocs, setUploadingDocs] = useState(false);

  const REQUIRED_DOCS = [
    { key: 'birth_certificate', label: 'Birth Certificate' },
    { key: 'report_card', label: 'Previous School Report Card / Transcript' },
    { key: 'passport_photo', label: 'Passport Photo' },
    { key: 'transfer_cert', label: 'Transfer Certificate (if applicable)' },
    { key: 'immunization', label: 'Immunization Records' },
  ];

  const addDocument = (label: string, file: File) => {
    setDocuments((prev) => [...prev.filter((d) => d.label !== label), { name: file.name, file, label }]);
  };

  const removeDocument = (label: string) => {
    setDocuments((prev) => prev.filter((d) => d.label !== label));
  };

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    Promise.all([
      schoolSiteService.getBySlug(slug),
    ])
      .then(async ([schoolData]) => {
        if (!schoolData) {
          setNotFound(true);
          return;
        }
        setSchool(schoolData);
        // Fetch public settings
        try {
          const s = await publicApplicationService.getPublicSettings(schoolData.id);
          setSettings(s);
        } catch {
          // Settings may not exist yet — use defaults
        }
        // Fetch classes for the school (public — no auth needed)
        try {
          const { data: cls } = await supabase
            .from('classes')
            .select('id, name, grade_level, section')
            .eq('school_id', schoolData.id)
            .order('grade_level')
            .order('name');
          setSchoolClasses(cls ?? []);
        } catch {
          // Classes may not be set up yet
        }
        // Fetch payment gateway config (public RPC)
        try {
          const pc = await publicApplicationService.getPublicPaymentConfig(schoolData.id);
          setPayConfig(pc);
        } catch {
          // Payment config not set up yet — cash-only fallback
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const currentYear = new Date().getFullYear();
  const academicYear = settings.current_academic_year || `${currentYear}-${currentYear + 1}`;
  const applicationFee = Number(settings.application_fee_usd) || 0;
  const isAccepting = settings.accepting_applications !== 'false';

  const validateStep = (s: Step): string | null => {
    if (s === 'student') {
      if (!form.firstName.trim()) return 'First name is required';
      if (!form.lastName.trim()) return 'Last name is required';
      if (!form.dateOfBirth) return 'Date of birth is required';
      if (!form.gradeLevel) return 'Class / grade level is required';
    }
    if (s === 'guardian') {
      if (!form.guardianFullName.trim()) return 'Guardian name is required';
      if (!form.guardianPhone.trim()) return 'Guardian phone is required';
    }
    return null;
  };

  const nextStep = () => {
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setError('');
    const idx = STEPS.findIndex((s) => s.key === step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1].key);
  };

  const prevStep = () => {
    setError('');
    const idx = STEPS.findIndex((s) => s.key === step);
    if (idx > 0) setStep(STEPS[idx - 1].key);
  };

  const handleSubmit = async () => {
    if (!school) return;
    const studentErr = validateStep('student');
    const guardianErr = validateStep('guardian');
    if (studentErr || guardianErr) {
      setError(studentErr || guardianErr || 'Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      // Upload documents to Supabase storage if any
      const documentUrls: Record<string, string> = {};
      if (documents.length > 0) {
        setUploadingDocs(true);
        for (const doc of documents) {
          const ext = doc.file.name.split('.').pop();
          const path = `applications/${school.id}/${Date.now()}_${doc.label.replace(/[^a-zA-Z0-9]/g, '_')}.${ext}`;
          const { error: uploadErr } = await supabase.storage
            .from('documents')
            .upload(path, doc.file, { contentType: doc.file.type });
          if (!uploadErr) {
            const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path);
            documentUrls[doc.label] = urlData.publicUrl;
          }
        }
        setUploadingDocs(false);
      }

      const res = await publicApplicationService.submitApplication({
        schoolId: school.id,
        academicYear,
        gradeLevel: form.gradeLevel,
        classId: form.classId || undefined,
        firstName: form.firstName,
        lastName: form.lastName,
        dateOfBirth: form.dateOfBirth,
        gender: form.gender || undefined,
        previousSchool: form.previousSchool || undefined,
        previousGrade: form.previousGrade || undefined,
        guardianFullName: form.guardianFullName,
        guardianRelationship: form.guardianRelationship || undefined,
        guardianEmail: form.guardianEmail || undefined,
        guardianPhone: form.guardianPhone,
        guardianAddress: form.guardianAddress || undefined,
        guardianOccupation: form.guardianOccupation || undefined,
        emergencyContactName: form.emergencyContactName || undefined,
        emergencyContactPhone: form.emergencyContactPhone || undefined,
        emergencyContactRelationship: form.emergencyContactRelationship || undefined,
        documents: Object.keys(documentUrls).length > 0 ? documentUrls as unknown as Array<{ type: string; file_url: string; uploaded_at: string }> : undefined,
      });
      setResult({ application_number: res.application_number, application_fee: res.application_fee, application_id: res.application_id });
      setSubmitted(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit application';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-gray-500">Loading application form...</p>
        </div>
      </div>
    );
  }

  if (notFound || !school) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4">
        <GraduationCap className="mb-4 h-16 w-16 text-gray-300" />
        <h1 className="text-2xl font-bold text-gray-900">School Not Found</h1>
        <p className="mt-2 text-gray-500">The school you're looking for doesn't exist.</p>
        <Link to="/" className="mt-6 text-blue-600 underline hover:text-blue-800">Go Home</Link>
      </div>
    );
  }

  if (!isAccepting) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4">
        <AlertCircle className="mb-4 h-16 w-16 text-amber-400" />
        <h1 className="text-2xl font-bold text-gray-900">Applications Closed</h1>
        <p className="mt-2 text-gray-500">{school.name} is not currently accepting applications.</p>
        <Link to={`/school/${slug}`} className="mt-6 text-blue-600 underline hover:text-blue-800">
          Back to School Site
        </Link>
      </div>
    );
  }

  const primary = school.primary_color || '#1e40af';

  if (submitted && result) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-12">
        <div className="mx-auto max-w-lg">
          <div className="rounded-2xl bg-white p-8 shadow-lg text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Application Submitted!</h1>
            <p className="mt-2 text-gray-500">
              Your application to <strong>{school.name}</strong> has been submitted successfully.
            </p>
            <div className="mt-6 rounded-xl bg-gray-50 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Application Number</span>
                <span className="font-mono font-bold text-gray-900">{result.application_number}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Student</span>
                <span className="font-medium text-gray-900">{form.firstName} {form.lastName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Grade Applied For</span>
                <span className="font-medium text-gray-900">{form.gradeLevel}</span>
              </div>
              {result.application_fee > 0 && (
                <div className="flex justify-between text-sm border-t border-gray-200 pt-2 mt-2">
                  <span className="text-gray-500">Application Fee</span>
                  <span className="font-bold text-amber-600">${result.application_fee.toFixed(2)} USD</span>
                </div>
              )}
            </div>
            {result.application_fee > 0 && (
              <div className="mt-4 space-y-3 text-left">
                {/* ── Paid confirmation ── */}
                {paymentFeePaid ? (
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
                        <strong>${result.application_fee.toFixed(2)} USD</strong> must
                        be paid before the Registrar can review your application.
                      </p>
                    </div>

                    {/* ── Online payment options ── */}
                    {(payConfig?.mtn_enabled || payConfig?.orange_enabled) && (
                      <div className="rounded-xl border border-slate-200 overflow-hidden">
                        <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200">
                          <p className="text-sm font-semibold text-slate-700">Pay via Mobile Money</p>
                        </div>
                        <div className="p-4 space-y-3">

                          {/* MTN MoMo */}
                          {payConfig?.mtn_enabled && (
                            <div className="rounded-xl border-2 border-yellow-200 bg-yellow-50 px-4 py-3.5">
                              <div className="flex items-center gap-3 mb-2">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-yellow-400">
                                  <Smartphone className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                  <p className="font-semibold text-yellow-900 text-sm">MTN Mobile Money (MoMo)</p>
                                  <p className="text-xs text-yellow-700">Lonestar Cell MTN</p>
                                </div>
                              </div>
                              <ol className="text-xs text-yellow-800 list-decimal list-inside space-y-0.5 pl-1">
                                <li>Dial <strong>*156#</strong> on your MTN line or open the MoMo app</li>
                                <li>Select <strong>Pay Bill</strong> or <strong>Merchant Payment</strong></li>
                                <li>Enter merchant code: <strong className="font-mono">{payConfig.mtn_merchant_code || '(see school office)'}</strong></li>
                                <li>Enter amount: <strong>${result.application_fee.toFixed(2)} USD</strong></li>
                                <li>Use reference: <strong className="font-mono">{result.application_number}</strong></li>
                                <li>Confirm with your PIN — keep the receipt SMS</li>
                              </ol>
                              <p className="mt-2 text-xs text-yellow-700 bg-yellow-100 rounded px-2 py-1">
                                After paying, visit the Finance Office with your SMS receipt to confirm.
                              </p>
                            </div>
                          )}

                          {/* Orange Money */}
                          {payConfig?.orange_enabled && (
                            <div className="rounded-xl border-2 border-orange-200 bg-orange-50 px-4 py-3.5">
                              <div className="flex items-center gap-3 mb-2">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-500">
                                  <Smartphone className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                  <p className="font-semibold text-orange-900 text-sm">Orange Money</p>
                                  <p className="text-xs text-orange-700">Orange Liberia</p>
                                </div>
                              </div>
                              <ol className="text-xs text-orange-800 list-decimal list-inside space-y-0.5 pl-1">
                                <li>Open the Orange Money app or dial the Orange Money USSD menu</li>
                                <li>Select <strong>Pay Merchant</strong> or <strong>Bill Payment</strong></li>
                                <li>Enter merchant code: <strong className="font-mono">{payConfig.orange_merchant_code || '(see school office)'}</strong></li>
                                <li>Enter amount: <strong>${result.application_fee.toFixed(2)} USD</strong></li>
                                <li>Use reference: <strong className="font-mono">{result.application_number}</strong></li>
                                <li>Confirm with your PIN — keep the confirmation SMS</li>
                              </ol>
                              <p className="mt-2 text-xs text-orange-700 bg-orange-100 rounded px-2 py-1">
                                After paying, visit the Finance Office with your SMS receipt to confirm.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ── Bank Transfer ── */}
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
                                  navigator.clipboard.writeText(result.application_number).catch(() => {});
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

                    {/* ── Stripe Card Payment ── */}
                    {payConfig?.stripe_enabled && stripeAppPromise && result.application_id && (
                      <div className="rounded-xl border border-purple-200 overflow-hidden">
                        <div className="bg-purple-50 px-4 py-2.5 border-b border-purple-200">
                          <p className="text-sm font-semibold text-purple-800 flex items-center gap-2">
                            <CreditCard className="h-4 w-4" />
                            Pay by Card (Stripe)
                          </p>
                        </div>
                        <div className="p-4">
                          {appStripeSuccess ? (
                            <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 p-3 text-xs text-green-700">
                              <CheckCircle2 className="h-4 w-4 shrink-0" />
                              Card payment successful! The Registrar will now review your application.
                            </div>
                          ) : (
                            <>
                              {appStripeError && (
                                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2 mb-3">{appStripeError}</p>
                              )}
                              <Elements stripe={stripeAppPromise}>
                                <AppStripeCardForm
                                  schoolId={school.id}
                                  applicationId={result.application_id}
                                  amountUsd={result.application_fee}
                                  onSuccess={() => { setAppStripeSuccess(true); setAppStripeError(''); }}
                                  onError={(msg) => setAppStripeError(msg)}
                                />
                              </Elements>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ── Campus cash option (always shown) ── */}
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200">
                        <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          {payConfig?.mtn_enabled || payConfig?.orange_enabled || payConfig?.bank_enabled || payConfig?.stripe_enabled
                            ? 'Or Pay at Campus'
                            : 'Pay at Campus Finance Office'}
                        </p>
                      </div>
                      <div className="p-4">
                        <ol className="text-xs text-slate-700 list-decimal list-inside space-y-1">
                          <li>Visit the <strong>Finance Office</strong> at {school.name}</li>
                          <li>Provide your application number: <strong className="font-mono">{result.application_number}</strong></li>
                          <li>Pay <strong>${result.application_fee.toFixed(2)} USD</strong> in cash — get a receipt</li>
                          <li>Finance records your payment → Registrar proceeds with your review</li>
                        </ol>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
            <p className="mt-4 text-xs text-gray-400">
              Keep your application number safe. The school's registrar will review your application and contact you.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to={`/school/${slug}/status`}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <Search className="h-4 w-4" /> Check Status
              </Link>
              <Link
                to={`/school/${slug}`}
                className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-colors"
                style={{ backgroundColor: primary }}
              >
                <ArrowLeft className="h-4 w-4" /> Back to School Site
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {school.logo_url ? (
              <img src={school.logo_url} alt={school.name} className="h-9 w-9 rounded-lg object-cover" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: primary }}>
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
            )}
            <div>
              <p className="text-sm font-bold text-gray-900">{school.name}</p>
              <p className="text-xs text-gray-400">Student Application Form</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to={`/school/${slug}/status`}
              className="text-sm font-medium flex items-center gap-1 transition-colors hover:opacity-80"
              style={{ color: primary }}
            >
              <Search className="h-4 w-4" /> Check Status
            </Link>
            <span className="text-gray-300">|</span>
            <Link
              to={`/school/${slug}`}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Academic Year Banner */}
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-white border border-gray-200 px-4 py-3">
          <Calendar className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-600">
            Academic Year: <strong>{academicYear}</strong>
          </span>
          {applicationFee > 0 && (
            <>
              <span className="text-gray-300 mx-2">|</span>
              <span className="text-sm text-gray-600">
                Application Fee: <strong className="text-amber-600">${applicationFee.toFixed(2)} USD</strong>
              </span>
            </>
          )}
        </div>

        {/* Step Indicator */}
        <div className="mb-8 flex items-center justify-between">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${
                    i < stepIndex
                      ? 'border-green-500 bg-green-500 text-white'
                      : i === stepIndex
                      ? 'text-white'
                      : 'border-gray-200 bg-white text-gray-400'
                  }`}
                  style={i === stepIndex ? { borderColor: primary, backgroundColor: primary } : undefined}
                >
                  {i < stepIndex ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <s.icon className="h-5 w-5" />
                  )}
                </div>
                <span className={`mt-1 text-xs font-medium ${i <= stepIndex ? 'text-gray-900' : 'text-gray-400'}`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`mx-2 h-0.5 w-12 sm:w-20 ${i < stepIndex ? 'bg-green-500' : 'bg-gray-200'}`}
                />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        {/* Form Card */}
        <div className="rounded-2xl bg-white shadow-sm border border-gray-200 p-6 sm:p-8">
          {/* Step 1: Student Info */}
          {step === 'student' && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <User className="h-5 w-5" style={{ color: primary }} /> Student Information
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    value={form.firstName}
                    onChange={(e) => updateField('firstName', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Enter first name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    value={form.lastName}
                    onChange={(e) => updateField('lastName', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Enter last name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
                  <input
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(e) => updateField('dateOfBirth', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                  <select
                    value={form.gender}
                    onChange={(e) => updateField('gender', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Class Applying For *</label>
                  <select
                    value={form.classId}
                    onChange={(e) => {
                      const cls = schoolClasses.find((c) => c.id === e.target.value);
                      updateField('classId', e.target.value);
                      updateField('gradeLevel', cls ? `${cls.name}${cls.grade_level ? ` (${cls.grade_level})` : ''}` : '');
                    }}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select class</option>
                    {schoolClasses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}{c.grade_level ? ` — ${c.grade_level}` : ''}{c.section ? ` (${c.section})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Previous School</label>
                  <input
                    type="text"
                    value={form.previousSchool}
                    onChange={(e) => updateField('previousSchool', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Name of previous school"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Previous Grade</label>
                  <input
                    type="text"
                    value={form.previousGrade}
                    onChange={(e) => updateField('previousGrade', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Last grade completed"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Guardian Info */}
          {step === 'guardian' && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Users className="h-5 w-5" style={{ color: primary }} /> Parent / Guardian Information
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <User className="inline h-3.5 w-3.5 mr-1" /> Full Name *
                  </label>
                  <input
                    type="text"
                    value={form.guardianFullName}
                    onChange={(e) => updateField('guardianFullName', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Guardian full name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Relationship</label>
                  <select
                    value={form.guardianRelationship}
                    onChange={(e) => updateField('guardianRelationship', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select relationship</option>
                    {RELATIONSHIPS.map((r) => (
                      <option key={r} value={r.toLowerCase()}>{r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Phone className="inline h-3.5 w-3.5 mr-1" /> Phone Number *
                  </label>
                  <input
                    type="tel"
                    value={form.guardianPhone}
                    onChange={(e) => updateField('guardianPhone', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="+231 XXX XXX XXXX"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Mail className="inline h-3.5 w-3.5 mr-1" /> Email
                  </label>
                  <input
                    type="email"
                    value={form.guardianEmail}
                    onChange={(e) => updateField('guardianEmail', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="email@example.com"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <MapPin className="inline h-3.5 w-3.5 mr-1" /> Address
                  </label>
                  <input
                    type="text"
                    value={form.guardianAddress}
                    onChange={(e) => updateField('guardianAddress', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Home address"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Briefcase className="inline h-3.5 w-3.5 mr-1" /> Occupation
                  </label>
                  <input
                    type="text"
                    value={form.guardianOccupation}
                    onChange={(e) => updateField('guardianOccupation', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Occupation"
                  />
                </div>
              </div>
              <hr className="border-gray-200" />
              <h3 className="text-sm font-semibold text-gray-700">Emergency Contact</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
                  <input
                    type="text"
                    value={form.emergencyContactName}
                    onChange={(e) => updateField('emergencyContactName', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Emergency contact name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
                  <input
                    type="tel"
                    value={form.emergencyContactPhone}
                    onChange={(e) => updateField('emergencyContactPhone', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="+231 XXX XXX XXXX"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Relationship</label>
                  <select
                    value={form.emergencyContactRelationship}
                    onChange={(e) => updateField('emergencyContactRelationship', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select relationship</option>
                    {RELATIONSHIPS.map((r) => (
                      <option key={r} value={r.toLowerCase()}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Documents */}
          {step === 'documents' && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <FileText className="h-5 w-5" style={{ color: primary }} /> Required Documents
              </h2>
              <p className="text-sm text-gray-500">
                Upload documents now, or bring physical copies to the school upon acceptance. Accepted formats: images and PDFs.
              </p>
              <div className="space-y-3">
                {REQUIRED_DOCS.map((doc) => {
                  const uploaded = documents.find((d) => d.label === doc.label);
                  return (
                    <div key={doc.key} className="rounded-lg border border-gray-200 bg-white p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {uploaded ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
                          )}
                          <span className="text-sm font-medium text-gray-700">{doc.label}</span>
                        </div>
                        {uploaded ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 max-w-[150px] truncate">{uploaded.name}</span>
                            <button
                              type="button"
                              onClick={() => removeDocument(doc.label)}
                              className="text-red-400 hover:text-red-600 p-1"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <label className="cursor-pointer inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                            <Upload className="h-3.5 w-3.5" /> Upload
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) addDocument(doc.label, file);
                                e.target.value = '';
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-700">
                <AlertCircle className="inline h-3.5 w-3.5 mr-1" />
                Document upload is optional. You can proceed without uploading and bring physical copies to the school.
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 'review' && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <CheckCircle className="h-5 w-5" style={{ color: primary }} /> Review Application
              </h2>
              <p className="text-sm text-gray-500">Please review your information before submitting.</p>

              <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
                {/* Student Info */}
                <div className="p-4">
                  <h3 className="text-xs font-semibold uppercase text-gray-400 mb-3 flex items-center gap-1">
                    <User className="h-3.5 w-3.5" /> Student Information
                  </h3>
                  <div className="grid grid-cols-2 gap-y-2 text-sm">
                    <span className="text-gray-500">Name</span>
                    <span className="font-medium text-gray-900">{form.firstName} {form.lastName}</span>
                    <span className="text-gray-500">Date of Birth</span>
                    <span className="font-medium text-gray-900">{form.dateOfBirth || '—'}</span>
                    <span className="text-gray-500">Gender</span>
                    <span className="font-medium text-gray-900 capitalize">{form.gender || '—'}</span>
                    <span className="text-gray-500">Grade Level</span>
                    <span className="font-medium text-gray-900">{form.gradeLevel}</span>
                    {form.previousSchool && (
                      <>
                        <span className="text-gray-500">Previous School</span>
                        <span className="font-medium text-gray-900">{form.previousSchool}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Guardian Info */}
                <div className="p-4">
                  <h3 className="text-xs font-semibold uppercase text-gray-400 mb-3 flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> Guardian Information
                  </h3>
                  <div className="grid grid-cols-2 gap-y-2 text-sm">
                    <span className="text-gray-500">Name</span>
                    <span className="font-medium text-gray-900">{form.guardianFullName}</span>
                    <span className="text-gray-500">Relationship</span>
                    <span className="font-medium text-gray-900 capitalize">{form.guardianRelationship || '—'}</span>
                    <span className="text-gray-500">Phone</span>
                    <span className="font-medium text-gray-900">{form.guardianPhone}</span>
                    {form.guardianEmail && (
                      <>
                        <span className="text-gray-500">Email</span>
                        <span className="font-medium text-gray-900">{form.guardianEmail}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Fee */}
                {applicationFee > 0 && (
                  <div className="p-4 bg-amber-50/50">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-700 flex items-center gap-1">
                        <BookOpen className="h-4 w-4 text-amber-500" /> Application Fee
                      </span>
                      <span className="text-lg font-bold text-amber-600">${applicationFee.toFixed(2)} USD</span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Payment instructions will be provided after submission.
                    </p>
                  </div>
                )}

                {/* Documents */}
                {documents.length > 0 && (
                  <div className="p-4">
                    <h3 className="text-xs font-semibold uppercase text-gray-400 mb-3 flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" /> Uploaded Documents
                    </h3>
                    <div className="space-y-1">
                      {documents.map((doc) => (
                        <div key={doc.label} className="flex items-center gap-2 text-sm">
                          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                          <span className="text-gray-700">{doc.label}</span>
                          <span className="text-xs text-gray-400">({doc.name})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="mt-8 flex items-center justify-between border-t border-gray-100 pt-5">
            {stepIndex > 0 ? (
              <button
                onClick={prevStep}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
            ) : (
              <div />
            )}

            {step === 'review' ? (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-60"
                style={{ backgroundColor: primary }}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {uploadingDocs ? 'Uploading documents...' : submitting ? 'Submitting...' : 'Submit Application'}
              </button>
            ) : (
              <button
                onClick={nextStep}
                className="inline-flex items-center gap-1 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors"
                style={{ backgroundColor: primary }}
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
