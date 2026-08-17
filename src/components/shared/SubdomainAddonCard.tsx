import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { schoolSiteService } from '@/services/schoolSiteService';
import { subdomainAddonService } from '@/services/subdomainAddonService';
import type { SubdomainPricing, SubdomainPayment } from '@/services/subdomainAddonService';
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
  Calendar,
  Sparkles,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Receipt,
  Pencil,
} from 'lucide-react';
import type { School } from '@/types/school.types';

// ── Stripe singleton ───────────────────────────────────────────────────────────


// ── helpers ────────────────────────────────────────────────────────────────────

const PLATFORM_APEX = 'schoolsyncedu.com';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── Status helpers ─────────────────────────────────────────────────────────────

type SubdomainStatus = 'active' | 'grace' | 'expired' | 'fresh' | 'paused';

function getStatus(school: School): SubdomainStatus {
  if (!school.subdomain_active) {
    // Still has paid time — school voluntarily reverted to default URL
    if (school.subdomain_paid_until && new Date(school.subdomain_paid_until) > new Date()) {
      return 'paused';
    }
    return school.subdomain ? 'expired' : 'fresh';
  }
  const paidUntil = new Date(school.subdomain_paid_until!);
  const now = new Date();
  if (paidUntil > now) return 'active';
  const graceCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (paidUntil > graceCutoff) return 'grace';
  return 'expired';
}

// ── Request form ──────────────────────────────────────────────────────────────
//
// This was a Stripe card form. The card was decoration: it confirmed in the
// browser and then the browser called activate_subdomain_addon, which had no
// caller check and was granted to every signed-in user — so the add-on could be
// switched on for nothing by calling the RPC directly. There is also no Stripe
// account operating here, so there was never a charge to reconcile against.
//
// It now does what the subscription does: the school asks, we are paid the way
// schools here actually pay, and only then is anything switched on. Same queue,
// same admin screen, same bell.

interface RequestFormProps {
  subdomain: string;
  plan: 'monthly' | 'yearly';
  amountUsd: number;
  onSubmitted: (reference: string) => void;
  onCancel: () => void;
}

const METHODS = ['Mobile money', 'Bank transfer', 'Cash', 'Not sure yet'];

function RequestForm({ subdomain, plan, amountUsd, onSubmitted, onCancel }: RequestFormProps) {
  const [name, setName]     = useState('');
  const [email, setEmail]   = useState('');
  const [phone, setPhone]   = useState('');
  const [method, setMethod] = useState(METHODS[0]);
  const [note, setNote]     = useState('');
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState('');

  useEffect(() => {
    // Prefill from the signed-in account — the person asking is almost always
    // the person we will be contacting.
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setEmail((e) => e || data.user!.email!);
    });
  }, []);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const { data, error: rpcError } = await supabase.rpc('submit_subdomain_request', {
        p_subdomain:        subdomain,
        p_billing_cycle:    plan,
        p_contact_name:     name.trim() || null,
        p_contact_email:    email.trim(),
        p_contact_phone:    phone.trim() || null,
        p_preferred_method: method,
        p_note:             note.trim() || null,
      });
      if (rpcError) throw new Error(rpcError.message);
      const res = data as { ok: boolean; message?: string; reference?: string };
      if (!res?.ok) throw new Error(res?.message ?? 'Could not send the request.');
      onSubmitted(res.reference ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the request.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Request this subdomain</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          <span className="font-semibold text-slate-700">{subdomain}.eduliberia.com</span> — {plan},
          ${amountUsd.toFixed(2)}. Tell us how to reach you and we will arrange payment,
          then switch it on.
        </p>
      </div>

      <input
        value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name"
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
      />
      <input
        value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email"
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
      />
      <input
        value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)"
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
      />
      <select
        value={method} onChange={(e) => setMethod(e.target.value)}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
      >
        {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
      <textarea
        value={note} onChange={(e) => setNote(e.target.value)} rows={2}
        placeholder="Anything we should know (optional)"
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
      />

      {error && (
        <p className="flex items-start gap-1.5 text-xs text-red-600">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button" onClick={submit} disabled={busy || !email.trim()}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary-600 py-2.5 text-sm font-bold text-white shadow transition hover:bg-primary-700 disabled:opacity-50"
        >
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : <>Send request</>}
        </button>
        <button
          type="button" onClick={onCancel} disabled={busy}
          className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}


// ── Plan picker ────────────────────────────────────────────────────────────────

interface PlanPickerProps {
  selected: 'monthly' | 'yearly';
  onChange: (plan: 'monthly' | 'yearly') => void;
  monthlyPrice: number;
  yearlyPrice: number;
  discountPct: number;
}

function PlanPicker({ selected, onChange, monthlyPrice, yearlyPrice, discountPct }: PlanPickerProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        type="button"
        onClick={() => onChange('monthly')}
        className={`rounded-xl border p-3 text-left transition-all ${
          selected === 'monthly'
            ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
            : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Monthly</p>
        <p className="text-xl font-extrabold text-slate-900">
          ${monthlyPrice.toFixed(2)}
          <span className="text-xs font-normal text-slate-400">/mo</span>
        </p>
      </button>

      <button
        type="button"
        onClick={() => onChange('yearly')}
        className={`rounded-xl border p-3 text-left transition-all ${
          selected === 'yearly'
            ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
            : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Yearly</p>
          {discountPct > 0 && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              {discountPct}% off
            </span>
          )}
        </div>
        <p className="text-xl font-extrabold text-slate-900">
          ${yearlyPrice.toFixed(2)}
          <span className="text-xs font-normal text-slate-400">/yr</span>
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          ${(yearlyPrice / 12).toFixed(2)}/mo effective
        </p>
      </button>
    </div>
  );
}

// ── Payment history ────────────────────────────────────────────────────────────

function PaymentHistory({ schoolId }: { schoolId: string }) {
  const [open, setOpen]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const [records, setRecords]   = useState<SubdomainPayment[]>([]);
  const [loaded, setLoaded]     = useState(false);

  const load = async () => {
    if (loaded) { setOpen((v) => !v); return; }
    setLoading(true);
    try {
      const data = await subdomainAddonService.getPaymentHistory(schoolId);
      setRecords(data);
      setLoaded(true);
      setOpen(true);
    } catch {
      notify.error('Could not load payment history');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border-t border-slate-100 pt-3">
      <button
        type="button"
        onClick={load}
        className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Receipt className="h-3.5 w-3.5" />}
        Payment History
        {!loading && (open ? <ChevronUp className="h-3 w-3 ml-0.5" /> : <ChevronDown className="h-3 w-3 ml-0.5" />)}
      </button>

      {open && loaded && (
        <div className="mt-2 rounded-lg border border-slate-100 overflow-hidden">
          {records.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-400">No payment records found.</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Date</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Plan</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Amount</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-500">Valid Until</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-3 py-2 text-slate-600">{formatDateTime(r.paid_at)}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 font-medium ${
                        r.plan === 'yearly'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {r.plan === 'yearly' ? 'Annual' : 'Monthly'}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-semibold text-slate-700">${Number(r.amount_usd).toFixed(2)}</td>
                    <td className="px-3 py-2 text-slate-600">{formatDate(r.paid_until)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface SubdomainAddonCardProps {
  school: School;
  onRefresh: () => void;
}

export default function SubdomainAddonCard({ school, onRefresh }: SubdomainAddonCardProps) {
  const schoolId = school.id;
  const status   = getStatus(school);

  // Pricing
  const [pricing, setPricing]           = useState<SubdomainPricing | null>(null);
  const [pricingLoading, setPricingLoading] = useState(true);

  useEffect(() => {
    subdomainAddonService.getPricing()
      .then(setPricing)
      .catch(() => {})
      .finally(() => setPricingLoading(false));
  }, []);

  const monthlyPrice = pricing?.monthly_price_usd ?? 1;
  const discountPct  = pricing?.yearly_discount_percent ?? 20;
  const yearlyPrice  = subdomainAddonService.calcYearlyPrice(monthlyPrice, discountPct);

  // UI state
  const [nameInput,    setNameInput]    = useState(school.subdomain ?? '');
  const [nameError,    setNameError]    = useState('');
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');
  const [showPayForm,    setShowPayForm]    = useState(false);
  const [showUpgrade,    setShowUpgrade]    = useState(false);
  const [deactivating,   setDeactivating]   = useState(false);
  const [reactivating,   setReactivating]   = useState(false);
  const [checking,       setChecking]       = useState(false);
  const [showRenameForm, setShowRenameForm] = useState(false);
  const [renameInput,    setRenameInput]    = useState('');
  const [renameError,    setRenameError]    = useState('');
  const [renaming,       setRenaming]       = useState(false);

  // Normalize: lowercase, strip non-allowed chars
  const sanitize = (v: string) => v.toLowerCase().replace(/[^a-z0-9-]/g, '');

  const validateName = (v: string): string => {
    if (v.length < 3) return 'Minimum 3 characters.';
    if (v.length > 30) return 'Maximum 30 characters.';
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(v)) return 'Must start and end with a letter or number.';
    return '';
  };

  const handleNameChange = (v: string) => {
    const s = sanitize(v);
    setNameInput(s);
    setNameError(validateName(s));
  };

  const handleActivateClick = async () => {
    const err = validateName(nameInput);
    if (err) { setNameError(err); return; }
    setChecking(true);
    try {
      const existing = await schoolSiteService.getBySubdomain(nameInput);
      if (existing && existing.id !== schoolId) {
        setNameError('This name is already taken by another school. Please choose a different name.');
        return;
      }
      setShowPayForm(true);
    } catch {
      setShowPayForm(true);
    } finally {
      setChecking(false);
    }
  };

  // Nothing is active yet — the request is queued and the platform owner
  // switches it on once payment has actually been received. Saying "activated"
  // here would be the same lie the card form told.
  const handleRequested = (reference: string) => {
    setShowPayForm(false);
    setShowUpgrade(false);
    notify.success(
      reference
        ? `Request sent — reference ${reference}. We will contact you to arrange payment.`
        : 'Request sent. We will contact you to arrange payment.',
    );
    onRefresh();
  };

  const handleDeactivate = async () => {
    setDeactivating(true);
    try {
      const { error } = await supabase.rpc('deactivate_subdomain_addon', { p_school_id: schoolId });
      if (error) throw error;
      notify.success('Reverted to default URL. You can re-activate any time while your subscription is active.');
      onRefresh();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Failed to deactivate');
    } finally {
      setDeactivating(false);
    }
  };

  const handleReactivate = async () => {
    setReactivating(true);
    try {
      const result = await subdomainAddonService.reactivate(schoolId);
      if (!result.success) throw new Error(result.error ?? 'Re-activation failed');
      notify.success(`Subdomain re-activated! Active until ${formatDate(result.paid_until!)}.`);
      onRefresh();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Failed to re-activate');
    } finally {
      setReactivating(false);
    }
  };

  const openRenameForm = () => {
    setRenameInput(school.subdomain ?? '');
    setRenameError('');
    setShowRenameForm(true);
  };

  const handleRenameInputChange = (v: string) => {
    const s = sanitize(v);
    setRenameInput(s);
    setRenameError(validateName(s));
  };

  const handleRename = async () => {
    if (renameInput === school.subdomain) {
      setRenameError('This is already your current subdomain name.');
      return;
    }
    const err = validateName(renameInput);
    if (err) { setRenameError(err); return; }
    setRenaming(true);
    try {
      const result = await subdomainAddonService.rename(schoolId, renameInput);
      if (!result.success) throw new Error(result.error ?? 'Rename failed');
      notify.success(`Subdomain renamed to ${result.subdomain}.${PLATFORM_APEX}`);
      setShowRenameForm(false);
      onRefresh();
    } catch (e) {
      setRenameError(e instanceof Error ? e.message : 'Rename failed. Please try again.');
    } finally {
      setRenaming(false);
    }
  };

  const activeUrl = school.subdomain ? `https://${school.subdomain}.${PLATFORM_APEX}` : null;
  const amountForPlan = (plan: 'monthly' | 'yearly') => plan === 'yearly' ? yearlyPrice : monthlyPrice;

  // ── GRACE STATE ───────────────────────────────────────────────────────────────
  if (status === 'grace') {
    const graceEnd = new Date(new Date(school.subdomain_paid_until!).getTime() + 24 * 60 * 60 * 1000);
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 space-y-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Subdomain Expired — Grace Period Active</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Your subdomain expired on {formatDate(school.subdomain_paid_until!)}. It still resolves until{' '}
              <strong>{formatDateTime(graceEnd.toISOString())}</strong>. Renew now to avoid interruption.
            </p>
          </div>
        </div>
        <div className="font-mono text-sm font-semibold text-amber-800">{activeUrl}</div>

        {!showPayForm ? (
          <>
            <PlanPicker
              selected={selectedPlan}
              onChange={setSelectedPlan}
              monthlyPrice={monthlyPrice}
              yearlyPrice={yearlyPrice}
              discountPct={discountPct}
            />
            <button
              type="button"
              disabled={pricingLoading}
              onClick={() => setShowPayForm(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-amber-700 disabled:opacity-40"
            >
              <Sparkles className="h-4 w-4" />
              Renew {selectedPlan === 'yearly' ? 'Annual' : 'Monthly'} — ${amountForPlan(selectedPlan).toFixed(2)}
            </button>
          </>
        ) : (
          <RequestForm
            subdomain={school.subdomain!}
            plan={selectedPlan}
            amountUsd={amountForPlan(selectedPlan)}
            onSubmitted={handleRequested}
            onCancel={() => setShowPayForm(false)}
          />
        )}
        <PaymentHistory schoolId={schoolId} />
      </div>
    );
  }

  // ── ACTIVE STATE ──────────────────────────────────────────────────────────────
  if (status === 'active') {
    const paidUntil   = new Date(school.subdomain_paid_until!);
    const daysLeft    = Math.ceil((paidUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const expiresToday = daysLeft <= 1;
    const expiringSoon = daysLeft <= 7;
    const isMonthly   = (school.subdomain_plan ?? 'monthly') === 'monthly';

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

        <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-700">
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {expiresToday ? (
              <strong className="text-amber-700">Expires today! Renew now.</strong>
            ) : (
              <>Paid until {formatDate(school.subdomain_paid_until!)} ({daysLeft} day{daysLeft !== 1 ? 's' : ''} left)</>
            )}
          </span>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium capitalize">
            {school.subdomain_plan ?? 'monthly'} plan
          </span>
          {expiringSoon && !expiresToday && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 font-medium">
              Expiring soon
            </span>
          )}
        </div>

        {/* Renew / Upgrade / Manage buttons */}
        {!showPayForm && !showUpgrade && !showRenameForm && (
          <div className="flex flex-wrap gap-2">
            {(expiringSoon || expiresToday) && (
              <button
                type="button"
                onClick={() => setShowPayForm(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Renew {school.subdomain_plan === 'yearly' ? 'Annual' : 'Monthly'}
              </button>
            )}
            {isMonthly && (
              <button
                type="button"
                onClick={() => setShowUpgrade(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50"
              >
                <TrendingUp className="h-3.5 w-3.5" />
                Upgrade to Annual — ${yearlyPrice.toFixed(2)}/yr
              </button>
            )}
            <button
              type="button"
              onClick={openRenameForm}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              <Pencil className="h-3.5 w-3.5" />
              Change Name
            </button>
            <button
              type="button"
              onClick={handleDeactivate}
              disabled={deactivating}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              {deactivating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              Revert to Default URL
            </button>
          </div>
        )}

        {/* Rename form */}
        {showRenameForm && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Change Subdomain Name</p>
            <div className="flex items-center">
              <input
                type="text"
                value={renameInput}
                onChange={(e) => handleRenameInputChange(e.target.value)}
                placeholder="newname"
                maxLength={30}
                className="flex-1 rounded-l-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <span className="rounded-r-lg border border-l-0 border-slate-300 bg-slate-100 px-3 py-2.5 text-sm text-slate-500 font-mono whitespace-nowrap">
                .{PLATFORM_APEX}
              </span>
            </div>
            {renameError && (
              <p className="flex items-center gap-1 text-xs text-red-600">
                <AlertCircle className="h-3 w-3 shrink-0" /> {renameError}
              </p>
            )}
            {renameInput && !renameError && renameInput !== school.subdomain && (
              <p className="flex items-center gap-1 text-xs text-emerald-600">
                <Globe className="h-3 w-3" /> New URL: <span className="font-mono">https://{renameInput}.{PLATFORM_APEX}</span>
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleRename}
                disabled={renaming || !!renameError || !renameInput || renameInput === school.subdomain}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {renaming ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...</> : <><Pencil className="h-3.5 w-3.5" /> Save New Name</>}
              </button>
              <button
                type="button"
                onClick={() => setShowRenameForm(false)}
                disabled={renaming}
                className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Renew payment form */}
        {showPayForm && (
          <RequestForm
            subdomain={school.subdomain!}
            plan={school.subdomain_plan ?? 'monthly'}
            amountUsd={amountForPlan(school.subdomain_plan ?? 'monthly')}
            onSubmitted={handleRequested}
            onCancel={() => setShowPayForm(false)}
          />
        )}

        {/* Upgrade to yearly form */}
        {showUpgrade && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-blue-800">Upgrade to Annual Plan</p>
                <p className="text-xs text-blue-600 mt-0.5">
                  Your remaining {daysLeft} day{daysLeft !== 1 ? 's' : ''} will be carried over.
                  New expiry: <strong>{formatDate(new Date(paidUntil.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString())}</strong>.
                </p>
              </div>
            </div>
            <RequestForm
                subdomain={school.subdomain!}
                plan="yearly"
                amountUsd={yearlyPrice}
                onSubmitted={handleRequested}
                onCancel={() => setShowUpgrade(false)}
              />
          </div>
        )}

        <PaymentHistory schoolId={schoolId} />
      </div>
    );
  }

  // ── PAUSED STATE (voluntarily reverted, subscription still active) ───────────
  if (status === 'paused') {
    const paidUntil = new Date(school.subdomain_paid_until!);
    const daysLeft  = Math.ceil((paidUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 space-y-4">
        <div className="flex items-start gap-2">
          <Globe className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-800">Subdomain Paused</p>
            <p className="text-xs text-blue-700 mt-1">
              <span className="font-mono font-semibold">{school.subdomain}.{PLATFORM_APEX}</span> is reserved for your school.
              You have <strong>{daysLeft} day{daysLeft !== 1 ? 's' : ''}</strong> of paid access remaining (until {formatDate(school.subdomain_paid_until!)}).
              Re-activate for free to restore your custom URL.
            </p>
          </div>
        </div>

        {!showRenameForm && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleReactivate}
              disabled={reactivating}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-50"
            >
              {reactivating
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Re-activating...</>
                : <><Unlock className="h-4 w-4" /> Re-activate Subdomain — Free</>}
            </button>
            <button
              type="button"
              onClick={openRenameForm}
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50"
            >
              <Pencil className="h-3.5 w-3.5" />
              Change Name
            </button>
          </div>
        )}

        {/* Rename form */}
        {showRenameForm && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Change Subdomain Name</p>
            <div className="flex items-center">
              <input
                type="text"
                value={renameInput}
                onChange={(e) => handleRenameInputChange(e.target.value)}
                placeholder="newname"
                maxLength={30}
                className="flex-1 rounded-l-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <span className="rounded-r-lg border border-l-0 border-slate-300 bg-slate-100 px-3 py-2.5 text-sm text-slate-500 font-mono whitespace-nowrap">
                .{PLATFORM_APEX}
              </span>
            </div>
            {renameError && (
              <p className="flex items-center gap-1 text-xs text-red-600">
                <AlertCircle className="h-3 w-3 shrink-0" /> {renameError}
              </p>
            )}
            {renameInput && !renameError && renameInput !== school.subdomain && (
              <p className="flex items-center gap-1 text-xs text-emerald-600">
                <Globe className="h-3 w-3" /> New URL: <span className="font-mono">https://{renameInput}.{PLATFORM_APEX}</span>
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleRename}
                disabled={renaming || !!renameError || !renameInput || renameInput === school.subdomain}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {renaming ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...</> : <><Pencil className="h-3.5 w-3.5" /> Save New Name</>}
              </button>
              <button
                type="button"
                onClick={() => setShowRenameForm(false)}
                disabled={renaming}
                className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <PaymentHistory schoolId={schoolId} />
      </div>
    );
  }

  // ── LOCKED / EXPIRED STATE ────────────────────────────────────────────────────
  const isExpired = status === 'expired';
  const subdomainUrl = nameInput ? `https://${nameInput}.${PLATFORM_APEX}` : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Lock className="h-5 w-5 text-slate-400 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-slate-800">Custom Subdomain</p>
          <p className="text-xs text-slate-500">
            {isExpired
              ? 'Your subdomain has expired. Renew to restore access.'
              : <>Get a clean URL like <span className="font-mono">yourschool.{PLATFORM_APEX}</span></>}
          </p>
        </div>
      </div>

      {isExpired && school.subdomain && (
        <div className="flex items-center gap-1.5 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>
            <span className="font-mono font-semibold">{school.subdomain}.{PLATFORM_APEX}</span> is reserved for your school.
            Renew to reactivate it.
          </span>
        </div>
      )}

      {/* Name input */}
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">
          {isExpired ? 'Your subdomain name' : 'Choose your subdomain name'}
        </label>
        <div className="flex items-center">
          <input
            type="text"
            value={nameInput}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="yourschool"
            maxLength={30}
            readOnly={isExpired && !!school.subdomain}
            className={`flex-1 rounded-l-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono ${
              isExpired && school.subdomain ? 'bg-slate-50 text-slate-500' : ''
            }`}
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

      {/* Plan picker */}
      {!pricingLoading && (
        <PlanPicker
          selected={selectedPlan}
          onChange={setSelectedPlan}
          monthlyPrice={monthlyPrice}
          yearlyPrice={yearlyPrice}
          discountPct={discountPct}
        />
      )}

      {/* Pay button or card form */}
      {!showPayForm ? (
        <button
          type="button"
          disabled={!nameInput || !!nameError || checking || pricingLoading}
          onClick={handleActivateClick}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {checking
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Checking availability...</>
            : <>
                <Lock className="h-4 w-4" />
                Pay ${amountForPlan(selectedPlan).toFixed(2)} to {isExpired ? 'Reactivate' : 'Activate'}
                <ArrowRight className="h-4 w-4" />
              </>}
        </button>
      ) : (
        <RequestForm
            subdomain={nameInput}
            plan={selectedPlan}
            amountUsd={amountForPlan(selectedPlan)}
            onSubmitted={handleRequested}
                onCancel={() => setShowPayForm(false)}
          />
      )}

      {isExpired && <PaymentHistory schoolId={schoolId} />}
    </div>
  );
}
