import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { useQueryClient } from '@tanstack/react-query';
import {
  proprietorPaymentService,
  FLW_METHODS,
  type PaymentConfig,
} from '@/services/proprietorPaymentService';
import { proprietorSchoolService } from '@/services/proprietorService';
import type { School } from '@/types/school.types';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Breadcrumb from '@/components/shared/Breadcrumb';
import {
  CreditCard,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Info,
  Save,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
  ExternalLink,
  Smartphone,
  Building2,
  Globe,
  Landmark,
} from 'lucide-react';

function KeyInput({
  label,
  value,
  onChange,
  placeholder,
  required,
  note,
  isSecret = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  required?: boolean;
  note?: string;
  isSecret?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <input
          type={isSecret && !show ? 'password' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono
            focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
            placeholder:text-slate-300 pr-10"
        />
        {isSecret && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {note && <p className="mt-1 text-xs text-slate-400">{note}</p>}
    </div>
  );
}

function GatewayToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all
        ${enabled
          ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
          : 'bg-slate-100 text-slate-500 border border-slate-200'}`}
    >
      {enabled
        ? <><ToggleRight className="h-3.5 w-3.5" /> Enabled</>
        : <><ToggleLeft className="h-3.5 w-3.5" /> Disabled</>}
    </button>
  );
}

export default function PaymentMethods() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';
  const queryClient = useQueryClient();

  const { data: savedConfig, isLoading } = useFetch<PaymentConfig | null>(
    ['payment-config', schoolId],
    () => proprietorPaymentService.getConfig(schoolId),
    { enabled: !!schoolId },
  );

  const { data: school } = useFetch<School | null>(
    ['school', schoolId],
    () => proprietorSchoolService.getSchool(schoolId),
    { enabled: !!schoolId },
  );

  // ── Form state ──────────────────────────────────────────────────
  // Flutterwave
  const [flwPublicKey, setFlwPublicKey] = useState('');
  const [flwSecretKey, setFlwSecretKey] = useState('');
  const [flwEnabled, setFlwEnabled] = useState(false);
  const [flwMethods, setFlwMethods] = useState<string[]>(['card']);
  const [flwCurrency, setFlwCurrency] = useState('USD');

  // MTN MoMo
  const [mtnCode,    setMtnCode]    = useState('');
  const [mtnKey,     setMtnKey]     = useState(''); // subscription key
  const [mtnUserId,  setMtnUserId]  = useState(''); // API user ID
  const [mtnEnabled, setMtnEnabled] = useState(false);

  // Orange Money
  const [orangeCode,    setOrangeCode]    = useState('');
  const [orangeKey,     setOrangeKey]     = useState(''); // API / client key
  const [orangeUserId,  setOrangeUserId]  = useState(''); // API user ID
  const [orangeEnabled, setOrangeEnabled] = useState(false);

  // Stripe
  const [stripePublicKey,  setStripePublicKey]  = useState('');
  const [stripeSecretKey,  setStripeSecretKey]  = useState('');
  const [stripeEnabled,    setStripeEnabled]    = useState(false);
  const [stripeCurrency,   setStripeCurrency]   = useState('USD');

  // Bank Transfer
  const [bankEnabled,        setBankEnabled]        = useState(false);
  const [bankAccountName,    setBankAccountName]    = useState('');
  const [bankAccountNumber,  setBankAccountNumber]  = useState('');
  const [bankName,           setBankName]           = useState('');
  const [bankRoutingNumber,  setBankRoutingNumber]  = useState('');
  const [bankSwiftCode,      setBankSwiftCode]      = useState('');
  const [bankInstructions,   setBankInstructions]   = useState('');

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (savedConfig) {
      setFlwPublicKey(savedConfig.flw_public_key ?? '');
      setFlwSecretKey(savedConfig.flw_secret_key ?? '');
      setFlwEnabled(savedConfig.flw_enabled ?? false);
      setFlwMethods(savedConfig.flw_methods?.length ? savedConfig.flw_methods : ['card']);
      setFlwCurrency(savedConfig.flw_currency ?? 'USD');
      setMtnCode(savedConfig.mtn_merchant_code ?? '');
      setMtnKey(savedConfig.mtn_api_key ?? '');
      setMtnUserId(savedConfig.mtn_user_id ?? '');
      setMtnEnabled(savedConfig.mtn_enabled ?? false);
      setOrangeCode(savedConfig.orange_merchant_code ?? '');
      setOrangeKey(savedConfig.orange_api_key ?? '');
      setOrangeUserId(savedConfig.orange_user_id ?? '');
      setOrangeEnabled(savedConfig.orange_enabled ?? false);
      setStripePublicKey(savedConfig.stripe_public_key ?? '');
      setStripeSecretKey(savedConfig.stripe_secret_key ?? '');
      setStripeEnabled(savedConfig.stripe_enabled ?? false);
      setStripeCurrency(savedConfig.stripe_currency ?? 'USD');
      setBankEnabled(savedConfig.bank_enabled ?? false);
      setBankAccountName(savedConfig.bank_account_name ?? '');
      setBankAccountNumber(savedConfig.bank_account_number ?? '');
      setBankName(savedConfig.bank_name ?? '');
      setBankRoutingNumber(savedConfig.bank_routing_number ?? '');
      setBankSwiftCode(savedConfig.bank_swift_code ?? '');
      setBankInstructions(savedConfig.bank_instructions ?? '');
    }
  }, [savedConfig]);

  function toggleFlwMethod(value: string) {
    setFlwMethods((prev) =>
      prev.includes(value) ? prev.filter((m) => m !== value) : [...prev, value],
    );
  }

  async function handleSave() {
    setSaving(true);
    setSaveError('');
    setSaveSuccess(false);
    try {
      await proprietorPaymentService.saveConfig(schoolId, {
        flw_public_key: flwPublicKey.trim(),
        flw_secret_key: flwSecretKey.trim(),
        flw_enabled: flwEnabled,
        flw_methods: flwMethods,
        flw_currency: flwCurrency,
        mtn_merchant_code: mtnCode.trim(),
        mtn_api_key: mtnKey.trim(),
        mtn_user_id: mtnUserId.trim(),
        mtn_enabled: mtnEnabled,
        orange_merchant_code: orangeCode.trim(),
        orange_api_key: orangeKey.trim(),
        orange_user_id: orangeUserId.trim(),
        orange_enabled: orangeEnabled,
        stripe_public_key: stripePublicKey.trim(),
        stripe_secret_key: stripeSecretKey.trim(),
        stripe_enabled: stripeEnabled,
        stripe_currency: stripeCurrency,
        bank_enabled: bankEnabled,
        bank_account_name: bankAccountName.trim(),
        bank_account_number: bankAccountNumber.trim(),
        bank_name: bankName.trim(),
        bank_routing_number: bankRoutingNumber.trim(),
        bank_swift_code: bankSwiftCode.trim(),
        bank_instructions: bankInstructions.trim(),
        payment_title: school?.name ?? '',
        payment_logo: school?.logo_url ?? '',
      });
      setSaveSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['payment-config', schoolId] });
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save configuration.');
    } finally {
      setSaving(false);
    }
  }

  const anyEnabled = flwEnabled || mtnEnabled || orangeEnabled || bankEnabled || stripeEnabled;

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Proprietor' }, { label: 'Payment Methods' }]} />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-indigo-600" />
          Payment Methods
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Configure how parents and students pay fees online. Only you (the school owner) can
          manage this — IT Admin and other staff have no access to these settings.
        </p>
      </div>

      {/* Liberia payment landscape notice */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
        <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
        <div className="text-sm text-blue-700 space-y-1">
          <p className="font-semibold">Liberia Payment Options</p>
          <p className="text-xs">
            Three payment gateways are available for schools in Liberia. Enable whichever ones
            apply to your school:
          </p>
          <ul className="list-disc list-inside text-xs space-y-0.5 mt-1">
            <li><strong>Flutterwave</strong> — for international Visa/MasterCard payments charged in USD.</li>
            <li><strong>MTN MoMo</strong> — Lonestar Cell MTN "MoMo", Liberia's most-used mobile money. Dial <strong>*156#</strong>.</li>
            <li><strong>Orange Money</strong> — Orange Liberia mobile money, second major provider.</li>
            <li><strong>Bank Transfer</strong> — students transfer directly to your school bank account and upload proof; bursar verifies.</li>
          </ul>
          <p className="text-xs mt-1 text-blue-600">
            Note: Flutterwave does not support LRD or Liberia mobile money directly.
            MTN and Orange are configured via their own merchant APIs.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin h-8 w-8 rounded-full border-b-2 border-indigo-600" />
        </div>
      ) : (
        <div className="space-y-6">

          {/* ── 1. Flutterwave ── */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100">
                  <Globe className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">Flutterwave</p>
                  <p className="text-xs text-slate-500">
                    Visa / MasterCard — international cards, charged in USD
                  </p>
                </div>
              </div>
              <GatewayToggle enabled={flwEnabled} onToggle={() => setFlwEnabled((v) => !v)} />
            </div>

            <div className={`p-5 space-y-4 ${!flwEnabled && 'opacity-60 pointer-events-none'}`}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <KeyInput
                  label="Public Key"
                  value={flwPublicKey}
                  onChange={setFlwPublicKey}
                  placeholder="FLWPUBK_TEST-xxxx"
                  required
                  note="Safe to display — used in the payment widget."
                />
                <KeyInput
                  label="Secret Key"
                  value={flwSecretKey}
                  onChange={setFlwSecretKey}
                  placeholder="FLWSECK_TEST-xxxx"
                  required
                  isSecret
                  note="Keep private — used for server-side verification only."
                />
              </div>

              {/* Currency */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Currency</label>
                <select
                  value={flwCurrency}
                  onChange={(e) => setFlwCurrency(e.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm w-40
                    focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="USD">USD — US Dollar</option>
                  <option value="NGN">NGN — Nigerian Naira</option>
                  <option value="GHS">GHS — Ghanaian Cedi</option>
                </select>
                <p className="mt-1 text-xs text-slate-400">
                  USD is recommended for Liberian schools — LRD is not yet supported by Flutterwave.
                </p>
              </div>

              {/* Payment channels */}
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Payment Channels</p>
                <div className="flex flex-wrap gap-3">
                  {FLW_METHODS.map((m) => {
                    const checked = flwMethods.includes(m.value);
                    return (
                      <label
                        key={m.value}
                        className={`flex items-start gap-2 rounded-xl border p-3 cursor-pointer text-sm transition-all
                          ${checked
                            ? 'border-orange-300 bg-orange-50'
                            : 'border-slate-200 hover:border-slate-300'}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleFlwMethod(m.value)}
                          className="mt-0.5 h-4 w-4 accent-orange-500"
                        />
                        <div>
                          <p className={`font-medium ${checked ? 'text-orange-800' : 'text-slate-700'}`}>
                            {m.label}
                          </p>
                          <p className="text-xs text-slate-400">{m.description}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <a
                href="https://dashboard.flutterwave.com/dashboard/settings/apis"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-orange-600 hover:underline font-medium"
              >
                Get your Flutterwave API keys <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </Card>

          {/* ── 2. MTN MoMo ── */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-yellow-100">
                  <Smartphone className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">MTN Mobile Money (MoMo)</p>
                  <p className="text-xs text-slate-500">
                    Lonestar Cell MTN — Liberia's most-used mobile money network
                  </p>
                </div>
              </div>
              <GatewayToggle enabled={mtnEnabled} onToggle={() => setMtnEnabled((v) => !v)} />
            </div>

            <div className={`p-5 space-y-4 ${!mtnEnabled && 'opacity-60 pointer-events-none'}`}>
              <div className="flex items-start gap-3 rounded-lg bg-yellow-50 border border-yellow-200 p-3 text-xs text-yellow-800">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Get your merchant credentials from{' '}
                  <a
                    href="https://lonestarcell.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline"
                  >
                    lonestarcell.com
                  </a>{' '}
                  or by contacting Lonestar Cell MTN's merchant services. Customers pay via the
                  MoMo app or by dialing <strong>*156#</strong>.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <KeyInput
                  label="Merchant Code"
                  value={mtnCode}
                  onChange={setMtnCode}
                  placeholder="MTN merchant code"
                  note="Your MTN MoMo merchant identifier shown to payers."
                />
                <KeyInput
                  label="API Subscription Key"
                  value={mtnKey}
                  onChange={setMtnKey}
                  placeholder="Ocp-Apim-Subscription-Key"
                  isSecret
                  note="From MTN MoMo Developer Portal — Collections subscription key."
                />
                <KeyInput
                  label="API User ID"
                  value={mtnUserId}
                  onChange={setMtnUserId}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  note="UUID created when you provision an API user in the MTN MoMo Developer Portal."
                />
              </div>
              {mtnKey && mtnUserId ? (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  <span><strong>Automated push payments enabled</strong> — parents will receive a push notification to approve payment directly on their phone.</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-500">
                  <Info className="h-3.5 w-3.5 shrink-0" />
                  <span>Add both <strong>API Subscription Key</strong> and <strong>API User ID</strong> to enable automatic push payments. With only a merchant code, parents will see USSD manual instructions.</span>
                </div>
              )}
            </div>
          </Card>

          {/* ── 3. Orange Money ── */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100">
                  <Smartphone className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">Orange Money</p>
                  <p className="text-xs text-slate-500">
                    Orange Liberia — second major mobile money provider in Liberia
                  </p>
                </div>
              </div>
              <GatewayToggle enabled={orangeEnabled} onToggle={() => setOrangeEnabled((v) => !v)} />
            </div>

            <div className={`p-5 space-y-4 ${!orangeEnabled && 'opacity-60 pointer-events-none'}`}>
              <div className="flex items-start gap-3 rounded-lg bg-orange-50 border border-orange-200 p-3 text-xs text-orange-800">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Register as an Orange Money merchant at{' '}
                  <a
                    href="https://www.orange.com.lr/en/orange-money.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline"
                  >
                    orange.com.lr
                  </a>{' '}
                  to receive your merchant code and API credentials. Customers pay via the
                  Orange Money app or USSD menu.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <KeyInput
                  label="Merchant Code"
                  value={orangeCode}
                  onChange={setOrangeCode}
                  placeholder="Orange merchant code"
                  note="Your Orange Money merchant identifier shown to payers."
                />
                <KeyInput
                  label="API Key / Client Secret"
                  value={orangeKey}
                  onChange={setOrangeKey}
                  placeholder="Orange Money API client secret"
                  isSecret
                  note="From Orange Money Developer portal — client_credentials secret."
                />
                <KeyInput
                  label="API User ID / Client ID"
                  value={orangeUserId}
                  onChange={setOrangeUserId}
                  placeholder="Orange Money client_id"
                  note="Client ID from the Orange Money Developer portal, used alongside the API secret."
                />
              </div>
              {orangeKey && orangeUserId ? (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  <span><strong>Automated push payments enabled</strong> — parents will receive a push notification to approve payment directly on their phone.</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-500">
                  <Info className="h-3.5 w-3.5 shrink-0" />
                  <span>Add both <strong>API Key</strong> and <strong>Client ID</strong> to enable automatic push payments. With only a merchant code, parents will see USSD manual instructions.</span>
                </div>
              )}
            </div>
          </Card>

          {/* ── 4. Stripe ── */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100">
                  <CreditCard className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">Stripe</p>
                  <p className="text-xs text-slate-500">
                    Visa / MasterCard / Amex — international card payments charged directly
                  </p>
                </div>
              </div>
              <GatewayToggle enabled={stripeEnabled} onToggle={() => setStripeEnabled((v) => !v)} />
            </div>

            <div className={`p-5 space-y-4 ${!stripeEnabled && 'opacity-60 pointer-events-none'}`}>
              <div className="flex items-start gap-3 rounded-lg bg-indigo-50 border border-indigo-200 p-3 text-xs text-indigo-800">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Parents pay directly via a card form on the fee page — no redirect needed.
                  Get your API keys at{' '}
                  <a
                    href="https://dashboard.stripe.com/apikeys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline"
                  >
                    dashboard.stripe.com/apikeys
                  </a>
                  . Use <strong>test keys</strong> (pk_test_ / sk_test_) while setting up, then switch to live keys.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <KeyInput
                  label="Publishable Key"
                  value={stripePublicKey}
                  onChange={setStripePublicKey}
                  placeholder="pk_live_... or pk_test_..."
                  required
                  note="Safe to display — used in the card payment form."
                />
                <KeyInput
                  label="Secret Key"
                  value={stripeSecretKey}
                  onChange={setStripeSecretKey}
                  placeholder="sk_live_... or sk_test_..."
                  required
                  isSecret
                  note="Keep private — used server-side to create payment intents."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Currency</label>
                <select
                  value={stripeCurrency}
                  onChange={(e) => setStripeCurrency(e.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="USD">USD — US Dollar</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="GBP">GBP — British Pound</option>
                </select>
                <p className="mt-1 text-xs text-slate-400">
                  USD is recommended for Liberian schools.
                </p>
              </div>

              <a
                href="https://dashboard.stripe.com/apikeys"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline font-medium"
              >
                Get your Stripe API keys <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </Card>

          {/* ── 5. Bank Transfer ── */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100">
                  <Landmark className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">Bank Transfer</p>
                  <p className="text-xs text-slate-500">
                    Students upload proof of payment — your bursar verifies and marks fees paid
                  </p>
                </div>
              </div>
              <GatewayToggle enabled={bankEnabled} onToggle={() => setBankEnabled((v) => !v)} />
            </div>

            <div className={`p-5 space-y-4 ${!bankEnabled && 'opacity-60 pointer-events-none'}`}>
              <div className="flex items-start gap-3 rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  When enabled, students will see your bank account details and can upload a proof of
                  payment (receipt / screenshot). Your bursar then reviews each submission and
                  marks the fee as paid with one click.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <KeyInput
                  label="Account Holder Name"
                  value={bankAccountName}
                  onChange={setBankAccountName}
                  placeholder="e.g. Springfield Academy Inc."
                  note="Name on the bank account — exactly as shown on your bank statement."
                />
                <KeyInput
                  label="Account Number"
                  value={bankAccountNumber}
                  onChange={setBankAccountNumber}
                  placeholder="e.g. 0012345678"
                  note="Your school's bank account number."
                />
                <KeyInput
                  label="Bank Name"
                  value={bankName}
                  onChange={setBankName}
                  placeholder="e.g. Liberia Bank for Development"
                  note="Full name of the bank."
                />
                <KeyInput
                  label="Routing / Sort Code (optional)"
                  value={bankRoutingNumber}
                  onChange={setBankRoutingNumber}
                  placeholder="e.g. 012-345"
                  note="Bank routing or sort code, if applicable."
                />
                <KeyInput
                  label="SWIFT / BIC Code (optional)"
                  value={bankSwiftCode}
                  onChange={setBankSwiftCode}
                  placeholder="e.g. LBDCLRLM"
                  note="Required for international transfers."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Additional Instructions (optional)
                </label>
                <textarea
                  value={bankInstructions}
                  onChange={(e) => setBankInstructions(e.target.value)}
                  rows={3}
                  placeholder="e.g. Use student registration number as payment reference. Send proof to finance@school.com after transferring."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm
                    focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
                <p className="mt-1 text-xs text-slate-400">
                  These instructions appear on the student fee payment page.
                </p>
              </div>
            </div>
          </Card>

          {/* ── Branding ── */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="h-5 w-5 text-slate-500" />
              <h2 className="font-semibold text-slate-800">Payment Modal Branding</h2>
            </div>
            <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
              {school?.logo_url ? (
                <img
                  src={school.logo_url}
                  alt="School logo"
                  className="h-12 w-12 rounded-lg border border-slate-200 object-contain bg-white p-1 shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="h-12 w-12 rounded-lg border border-slate-200 bg-white flex items-center justify-center shrink-0">
                  <Building2 className="h-6 w-6 text-slate-300" />
                </div>
              )}
              <div>
                <p className="font-medium text-slate-800 text-sm">{school?.name ?? '—'}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Automatically pulled from your school profile. To update, change your school name or logo via IT Admin → School Settings.
                </p>
              </div>
            </div>
          </Card>

          {/* ── Status summary ── */}
          {savedConfig && (
            <Card className="p-4">
              <p className="text-sm font-semibold text-slate-700 mb-3">Active Gateways</p>
              <div className="flex flex-wrap gap-3">
                {[
                  { label: 'Flutterwave (Cards)', active: savedConfig.flw_enabled, color: 'orange' },
                  { label: 'MTN MoMo', active: savedConfig.mtn_enabled, color: 'yellow' },
                  { label: 'Orange Money', active: savedConfig.orange_enabled, color: 'orange' },
                  { label: 'Stripe (Cards)', active: savedConfig.stripe_enabled, color: 'indigo' },
                  { label: 'Bank Transfer', active: savedConfig.bank_enabled, color: 'blue' },
                ].map((g) => (
                  <span
                    key={g.label}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border
                      ${g.active
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                  >
                    {g.active
                      ? <CheckCircle2 className="h-3.5 w-3.5" />
                      : <ToggleLeft className="h-3.5 w-3.5" />}
                    {g.label}
                  </span>
                ))}
                {!savedConfig.flw_enabled && !savedConfig.mtn_enabled && !savedConfig.orange_enabled && !savedConfig.stripe_enabled && !savedConfig.bank_enabled && (
                  <span className="text-xs text-slate-400">No payment gateways are active yet.</span>
                )}
              </div>
            </Card>
          )}

          {/* Security reminder */}
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <ShieldCheck className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-xs text-amber-700 space-y-1">
              <p className="font-semibold text-sm">Security Reminder</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Never share your API keys or secret keys with anyone.</li>
                <li>Use test/sandbox keys while setting up — switch to live keys only when ready.</li>
                <li>Rotate any key immediately if you suspect it has been compromised.</li>
                <li>IT Admin and all other school staff have no access to this page.</li>
              </ul>
            </div>
          </div>

          {/* Feedback */}
          {saveError && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {saveError}
            </div>
          )}
          {saveSuccess && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Payment configuration saved successfully!
            </div>
          )}

          {!anyEnabled && !saveSuccess && (
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              <Info className="h-4 w-4 shrink-0" />
              No payment gateway is enabled yet. Enable at least one gateway above, then save.
            </div>
          )}

          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save Payment Configuration'}
          </Button>
        </div>
      )}
    </div>
  );
}
