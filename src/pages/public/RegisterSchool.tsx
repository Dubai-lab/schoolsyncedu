import { useState, useEffect, type FormEvent } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useFetch } from '@/hooks/useFetch';
import { pricingPlanService } from '@/services/adminService';
import { supabase } from '@/lib/supabase';
import { requestOTPEmail } from '@/services/authService';
import OTPVerificationModal from '@/components/shared/OTPVerificationModal';
import type { SubscriptionPlan } from '@/types/report.types';
import {
  Building2,
  User,
  CreditCard,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  Shield,
} from 'lucide-react';

type Step = 1 | 2 | 3 | 4;

interface OwnerForm {
  full_name: string;
  email: string;
  phone: string;
  password: string;
  confirm_password: string;
}

interface SchoolForm {
  name: string;
  location: string;
  moe_registration_number: string;
  principal_name: string;
  principal_email: string;
  phone: string;
  address: string;
  motto: string;
}

const STEPS = [
  { step: 1, label: 'Your Account', icon: User },
  { step: 2, label: 'School Details', icon: Building2 },
  { step: 3, label: 'Choose Plan', icon: CreditCard },
  { step: 4, label: 'Confirmation', icon: CheckCircle },
] as const;

const LIBERIA_COUNTIES = [
  'Bomi', 'Bong', 'Gbarpolu', 'Grand Bassa', 'Grand Cape Mount',
  'Grand Gedeh', 'Grand Kru', 'Lofa', 'Margibi', 'Maryland',
  'Montserrado', 'Nimba', 'River Cess', 'River Gee', 'Sinoe',
];

export default function RegisterSchool() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const preselectedPlan = searchParams.get('plan');

  const [step, setStep] = useState<Step>(1);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [registered, setRegistered] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');

  // Email verification OTP states
  const [emailVerified, setEmailVerified] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [showOTPModal, setShowOTPModal] = useState(false);

  const [owner, setOwner] = useState<OwnerForm>({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
  });

  const [school, setSchool] = useState<SchoolForm>({
    name: '',
    location: '',
    moe_registration_number: '',
    principal_name: '',
    principal_email: '',
    phone: '',
    address: '',
    motto: '',
  });

  const [selectedPlanId, setSelectedPlanId] = useState<string>('');

  const { data: plans = [] } = useFetch<SubscriptionPlan[]>(
    ['register-plans'],
    () => pricingPlanService.list(),
  );
  const visiblePlans = plans.filter((p) => p.is_visible && p.is_active);

  // Pre-select plan from URL param
  useEffect(() => {
    if (preselectedPlan && visiblePlans.length > 0 && !selectedPlanId) {
      const match = visiblePlans.find((p) => p.slug === preselectedPlan);
      if (match) setSelectedPlanId(match.id);
    }
  }, [preselectedPlan, visiblePlans, selectedPlanId]);

  const updateOwner = (field: keyof OwnerForm, value: string) =>
    setOwner((prev) => ({ ...prev, [field]: value }));

  const updateSchool = (field: keyof SchoolForm, value: string) =>
    setSchool((prev) => ({ ...prev, [field]: value }));

  const validateStep1 = () => {
    if (!owner.full_name.trim()) return 'Full name is required';
    if (!owner.email.trim()) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(owner.email)) return 'Invalid email address';
    if (!owner.phone.trim()) return 'Phone number is required';
    if (owner.password.length < 8) return 'Password must be at least 8 characters';
    if (owner.password !== owner.confirm_password) return 'Passwords do not match';
    return '';
  };

  const validateStep2 = () => {
    if (!school.name.trim()) return 'School name is required';
    if (!school.location.trim()) return 'County is required';
    if (!school.principal_name.trim()) return 'Principal name is required';
    if (!school.principal_email.trim()) return 'Principal email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(school.principal_email)) return 'Invalid principal email';
    if (!school.phone.trim()) return 'School phone number is required';
    return '';
  };

  const validateStep3 = () => {
    if (!selectedPlanId) return 'Please select a plan';
    return '';
  };

  const handleNext = () => {
    setError('');
    let err = '';
    if (step === 1) {
      err = validateStep1();
      // Step 1: Check if email is verified before allowing next step
      if (!err && !emailVerified) {
        setError('Please verify your email before proceeding');
        return;
      }
    } else if (step === 2) err = validateStep2();
    else if (step === 3) err = validateStep3();
    if (err) { setError(err); return; }
    setStep((s) => Math.min(s + 1, 4) as Step);
  };

  const handleBack = () => {
    setError('');
    setStep((s) => Math.max(s - 1, 1) as Step);
  };

  const handleRequestOTP = async () => {
    if (!owner.full_name.trim()) { setError('Please enter your full name first'); return; }
    if (!owner.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(owner.email)) {
      setError('Please enter a valid email address');
      return;
    }

    setVerifyingEmail(true);
    setError('');

    try {
      await requestOTPEmail(owner.email, school.name || 'SchoolSync');
      setShowOTPModal(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send verification email. Please try again.';
      setError(message);
    } finally {
      setVerifyingEmail(false);
    }
  };

  const handleEmailVerified = async () => {
    setEmailVerified(true);
    setShowOTPModal(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      // 1. Sign up the owner in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: owner.email,
        password: owner.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            full_name: owner.full_name,
            phone: owner.phone,
            role: 'proprietor',
          },
        },
      });
      if (authError) {
        if (
          authError.message?.toLowerCase().includes('already registered') ||
          authError.message?.toLowerCase().includes('already exists') ||
          (authError as { code?: string }).code === 'user_already_exists'
        ) {
          setError('An account with this email already exists. Please sign in instead.');
        } else {
          setError(authError.message || 'Registration failed. Please try again.');
        }
        setSubmitting(false);
        return;
      }

      const userId = authData.user?.id;
      if (!userId) throw new Error('Failed to create account');

      // 2. Generate a unique 3-char school code from school name
      const baseCode = school.name
        .replace(/[^a-zA-Z]/g, '')
        .substring(0, 2)
        .toUpperCase()
        .padEnd(2, 'X');
      const schoolCode = baseCode + String.fromCharCode(65 + Math.floor(Math.random() * 26));

      // 3. Split owner name into first/last
      const nameParts = owner.full_name.trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      // 4. Call the register_school RPC (SECURITY DEFINER — bypasses RLS)
      const { data: rpcData, error: rpcError } = await supabase.rpc('register_school', {
        p_auth_id: userId,
        p_owner_email: owner.email,
        p_owner_name: owner.full_name,
        p_owner_phone: owner.phone,
        p_first_name: firstName,
        p_last_name: lastName,
        p_school_name: school.name,
        p_school_code: schoolCode,
        p_location: school.location || null,
        p_moe_reg: school.moe_registration_number || null,
        p_principal_name: school.principal_name || null,
        p_principal_email: school.principal_email || null,
        p_school_phone: school.phone || null,
        p_address: school.address || null,
        p_motto: school.motto || null,
        p_plan_id: selectedPlanId || null,
      });
      if (rpcError) {
        // Auth account was created but school setup failed — sign out and clean up
        // so the user can try again with the same email without hitting "already exists"
        await supabase.auth.signOut();
        throw rpcError;
      }

      // Fire welcome email + billing pending notification (non-blocking)
      const result = rpcData as { school_id?: string } | null;
      const newSchoolId = result?.school_id ?? '';
      try {
        await supabase.functions.invoke('send-welcome-email', {
          body: {
            owner_name: owner.full_name,
            owner_email: owner.email,
            school_name: school.name,
            school_id: newSchoolId || undefined,
          },
        });
      } catch (emailErr) {
        console.warn('Welcome email failed (non-fatal):', emailErr);
      }

      // Fire billing "payment pending" notification from billing@
      if (newSchoolId) {
        try {
          await supabase.functions.invoke('process-subscription-notifications', {
            body: {
              trigger: 'payment_pending',
              school_id: newSchoolId,
              school_name: school.name,
              owner_email: owner.email,
              owner_name: owner.full_name,
              plan_name: selectedPlan?.name || 'Free Trial',
            },
          });
        } catch (billingErr) {
          console.warn('Billing pending notification failed (non-fatal):', billingErr);
        }
      }

      // Sign out so user doesn't stay logged in during payment
      await supabase.auth.signOut();

      // Redirect to payment page with school info
      if (newSchoolId && selectedPlanId) {
        navigate(`/payment?school=${newSchoolId}&email=${encodeURIComponent(owner.email)}`);
      } else {
        // No plan selected — just show success & go to login
        setRegisteredEmail(owner.email);
        setRegistered(true);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed. Please try again.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── SUCCESS SCREEN ───
  if (registered) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4 py-20">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <Mail className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Registration Successful!</h2>
          <p className="mt-3 text-sm text-slate-500 leading-relaxed">
            We've sent a confirmation email to <strong>{registeredEmail}</strong>.
            Please verify your email address to activate your school account.
          </p>
          <p className="mt-4 text-sm text-slate-500">
            Once verified, you can sign in and start setting up your school — invite staff, enroll students, and more.
          </p>
          <Link
            to="/auth/login"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
          >
            Go to Sign In <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  const selectedPlan = visiblePlans.find((p) => p.id === selectedPlanId);

  return (
    <div className="py-12 sm:py-20">
      <div className="mx-auto max-w-3xl px-4">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-900">Register Your School</h1>
          <p className="mt-2 text-sm text-slate-500">
            Create your school account in just a few minutes. Start your free trial today.
          </p>
        </div>

        {/* Step indicators */}
        <div className="mx-auto mt-10 flex max-w-xl items-center justify-between">
          {STEPS.map((s, i) => {
            const isActive = step === s.step;
            const isCompleted = step > s.step;
            return (
              <div key={s.step} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition-all ${
                      isCompleted
                        ? 'bg-green-500 text-white'
                        : isActive
                        ? 'bg-primary-600 text-white ring-4 ring-primary-100'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      <s.icon className="h-5 w-5" />
                    )}
                  </div>
                  <span
                    className={`mt-2 text-xs font-medium ${
                      isActive ? 'text-primary-600' : isCompleted ? 'text-green-600' : 'text-slate-400'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`mx-3 mt-[-1.25rem] h-0.5 w-12 sm:w-20 ${
                      step > s.step ? 'bg-green-400' : 'bg-slate-200'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
            {error.includes('already exists') && (
              <Link to="/auth/login" className="ml-2 font-semibold underline hover:text-red-900">
                Sign in →
              </Link>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-8">
          {/* ─── STEP 1: Account ─── */}
          {step === 1 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-5">
              <h2 className="text-lg font-semibold text-slate-900">Create your admin account</h2>
              <p className="text-sm text-slate-500">This will be the school owner / proprietor account.</p>

              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700">Full Name *</label>
                <input
                  type="text"
                  value={owner.full_name}
                  onChange={(e) => updateOwner('full_name', e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  placeholder="John Doe"
                />
              </div>

              {/* Email with inline verify button */}
              <div>
                <label className="block text-sm font-medium text-slate-700">Email Address *</label>
                <div className="relative mt-1 flex items-center">
                  <input
                    type="email"
                    value={owner.email}
                    onChange={(e) => { updateOwner('email', e.target.value); if (emailVerified) setEmailVerified(false); }}
                    disabled={emailVerified}
                    className={`block w-full rounded-lg border px-3 py-2.5 pr-32 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 ${
                      emailVerified
                        ? 'border-green-400 bg-green-50 text-slate-700'
                        : 'border-slate-300 bg-white'
                    }`}
                    placeholder="you@example.com"
                  />
                  <div className="absolute right-1.5 flex items-center">
                    {emailVerified ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-700">
                        <CheckCircle className="h-3.5 w-3.5" /> Verified
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleRequestOTP}
                        disabled={verifyingEmail || !owner.email.trim()}
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {verifyingEmail ? (
                          <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending…</>
                        ) : (
                          <><Shield className="h-3.5 w-3.5" /> Verify Email</>
                        )}
                      </button>
                    )}
                  </div>
                </div>
                {!emailVerified && (
                  <p className="mt-1.5 text-xs text-slate-400">Enter your email and click Verify Email to receive a code</p>
                )}
              </div>

              {/* Rest of form — only shown after email verified */}
              {emailVerified && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Phone Number *</label>
                    <input
                      type="tel"
                      value={owner.phone}
                      onChange={(e) => updateOwner('phone', e.target.value)}
                      maxLength={60}
                      className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                      placeholder="+231 ..."
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Password *</label>
                      <div className="relative mt-1">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={owner.password}
                          onChange={(e) => updateOwner('password', e.target.value)}
                          className="block w-full rounded-lg border border-slate-300 px-3 py-2.5 pr-10 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                          placeholder="Min. 8 characters"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Confirm Password *</label>
                      <input
                        type="password"
                        value={owner.confirm_password}
                        onChange={(e) => updateOwner('confirm_password', e.target.value)}
                        className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                        placeholder="Repeat password"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ─── STEP 2: School Details ─── */}
          {step === 2 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-5">
              <h2 className="text-lg font-semibold text-slate-900">School Information</h2>
              <p className="text-sm text-slate-500">Tell us about your school.</p>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">School Name *</label>
                  <input
                    type="text"
                    value={school.name}
                    onChange={(e) => updateSchool('name', e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    placeholder="Monrovia Academy"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">County / Location *</label>
                  <select
                    value={school.location}
                    onChange={(e) => updateSchool('location', e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="">Select county</option>
                    {LIBERIA_COUNTIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">MOE Registration #</label>
                  <input
                    type="text"
                    value={school.moe_registration_number}
                    onChange={(e) => updateSchool('moe_registration_number', e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    placeholder="Optional"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Principal Name *</label>
                  <input
                    type="text"
                    value={school.principal_name}
                    onChange={(e) => updateSchool('principal_name', e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    placeholder="Full name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Principal Email *</label>
                  <input
                    type="email"
                    value={school.principal_email}
                    onChange={(e) => updateSchool('principal_email', e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    placeholder="principal@school.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">School Phone *</label>
                  <input
                    type="tel"
                    value={school.phone}
                    onChange={(e) => updateSchool('phone', e.target.value)}
                    maxLength={60}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    placeholder="+231 ..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">School Motto</label>
                  <input
                    type="text"
                    value={school.motto}
                    onChange={(e) => updateSchool('motto', e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    placeholder="Optional"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">Full Address</label>
                  <textarea
                    value={school.address}
                    onChange={(e) => updateSchool('address', e.target.value)}
                    rows={2}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    placeholder="Street address, city"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ─── STEP 3: Select Plan ─── */}
          {step === 3 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-5">
              <h2 className="text-lg font-semibold text-slate-900">Choose Your Plan</h2>
              <p className="text-sm text-slate-500">
                All plans include a free trial. You won't be charged until the trial ends.
              </p>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {visiblePlans.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={`relative rounded-xl border-2 p-5 text-left transition-all ${
                      selectedPlanId === plan.id
                        ? 'border-primary-500 bg-primary-50/50 ring-2 ring-primary-200'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {selectedPlanId === plan.id && (
                      <div className="absolute top-3 right-3">
                        <CheckCircle className="h-5 w-5 text-primary-600" />
                      </div>
                    )}
                    <h3 className="font-semibold text-slate-900">{plan.name}</h3>
                    <p className="mt-1 text-xs text-slate-500">{plan.description}</p>
                    <div className="mt-3">
                      <span className="text-2xl font-bold text-slate-900">${plan.price_usd}</span>
                      <span className="text-sm text-slate-500">/{plan.billing_cycle}</span>
                    </div>
                    <div className="mt-3 space-y-1.5">
                      <p className="text-xs text-slate-600">
                        ✓ Up to {plan.student_limit.toLocaleString()} students
                      </p>
                      <p className="text-xs text-green-600 font-medium">
                        ✓ {plan.trial_days} day free trial
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              <Link
                to="/pricing"
                className="text-xs font-medium text-primary-600 hover:text-primary-700"
              >
                Compare all plan features →
              </Link>
            </div>
          )}

          {/* ─── STEP 4: Review & Submit ─── */}
          {step === 4 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
              <h2 className="text-lg font-semibold text-slate-900">Review & Confirm</h2>
              <p className="text-sm text-slate-500">Please review your details before submitting.</p>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-5 space-y-2">
                  <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <User className="h-4 w-4" /> Account
                  </h3>
                  <p className="text-sm text-slate-600"><span className="text-slate-400">Name:</span> {owner.full_name}</p>
                  <p className="text-sm text-slate-600"><span className="text-slate-400">Email:</span> {owner.email}</p>
                  <p className="text-sm text-slate-600"><span className="text-slate-400">Phone:</span> {owner.phone}</p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50 p-5 space-y-2">
                  <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Building2 className="h-4 w-4" /> School
                  </h3>
                  <p className="text-sm text-slate-600"><span className="text-slate-400">Name:</span> {school.name}</p>
                  <p className="text-sm text-slate-600"><span className="text-slate-400">County:</span> {school.location}</p>
                  <p className="text-sm text-slate-600"><span className="text-slate-400">Principal:</span> {school.principal_name}</p>
                  <p className="text-sm text-slate-600"><span className="text-slate-400">Phone:</span> {school.phone}</p>
                </div>
              </div>

              {selectedPlan && (
                <div className="rounded-xl border border-primary-200 bg-primary-50/50 p-5 space-y-2">
                  <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <CreditCard className="h-4 w-4" /> Selected Plan
                  </h3>
                  <p className="text-lg font-bold text-slate-900">
                    {selectedPlan.name} — ${selectedPlan.price_usd}/{selectedPlan.billing_cycle}
                  </p>
                  <p className="text-xs text-primary-600 font-medium">
                    You'll be redirected to a secure payment page after registration.
                  </p>
                </div>
              )}

              <p className="text-xs text-slate-400 leading-relaxed">
                By clicking "Create School," you agree to our Terms of Service and Privacy Policy.
                A confirmation email will be sent to <strong>{owner.email}</strong>.
              </p>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="mt-6 flex items-center justify-between">
            <div>
              {step > 1 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
              )}
              {step === 1 && (
                <Link
                  to="/auth/login"
                  className="text-sm font-medium text-slate-500 hover:text-slate-700"
                >
                  Already have an account? Sign in
                </Link>
              )}
            </div>

            <div>
              {step < 4 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
                >
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Creating School...
                    </>
                  ) : (
                    <>
                      Create School <CheckCircle className="h-4 w-4" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </form>

        {/* OTP Verification Modal */}
        <OTPVerificationModal
          email={owner.email}
          schoolName={school.name || 'SchoolSync'}
          isOpen={showOTPModal}
          onVerified={handleEmailVerified}
          onCancel={() => setShowOTPModal(false)}
        />
      </div>
    </div>
  );
}
