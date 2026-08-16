import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import Button from '@/components/ui/Button';
import { Mail, CheckCircle2, Loader2, AlertCircle, Clock } from 'lucide-react';

/**
 * Request account activation when no payment gateway is available.
 *
 * Replaces a `mailto:support@schoolsyncedu.com` link. That link opened a blank
 * email — or, on any device with no mail client registered, opened nothing at
 * all and left the school staring at a button that appeared broken. Either way
 * nothing was recorded, so a request that was never sent and a request lost to
 * a spam folder looked identical from this end: silence.
 *
 * Payment is still arranged out-of-band. This does not pretend otherwise. What
 * changes is that the request leaves a row, the school gets a reference it can
 * quote, and it lands in a queue rather than an inbox.
 */

const METHODS = [
  { value: 'mtn_momo',      label: 'MTN Mobile Money' },
  { value: 'orange_money',  label: 'Orange Money' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cash',          label: 'Cash / in person' },
  { value: 'other',         label: 'Something else' },
];

interface ActivationRequestFormProps {
  /** Plan the school is trying to buy, when the page knows it. */
  planId?: string | null;
  /** Shown above the form — differs between suspended and first-time schools. */
  intro?: string;
  /**
   * School id, for the registration flow.
   *
   * When present the form uses the public RPC instead of resolving the school
   * from the session. RegisterSchool signs up through supabase.auth.signUp,
   * which establishes no session while email confirmation is on, so a school
   * registering for the first time reaches the payment page unauthenticated —
   * precisely the case this form exists to serve.
   */
  schoolId?: string | null;
  /** Prefill when the page knows it from the URL, as registration does. */
  defaultEmail?: string | null;
}

export default function ActivationRequestForm({
  planId, intro, schoolId, defaultEmail,
}: ActivationRequestFormProps) {
  const { user } = useAuth();
  const isPublic = !!schoolId;

  const [checking, setChecking] = useState(true);
  const [existing, setExisting] = useState<{ reference: string; status: string } | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [method, setMethod] = useState('mtn_momo');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  // Prefill from the signed-in user. Anything that saves a school retyping
  // details we already hold is one less reason to abandon the form.
  useEffect(() => {
    if (defaultEmail && !email) setEmail(defaultEmail);
    const u = user as Record<string, unknown> | null;
    if (u?.email && !email) setEmail(String(u.email));
    const first = u?.first_name ? String(u.first_name) : '';
    const last = u?.last_name ? String(u.last_name) : '';
    if ((first || last) && !name) setName(`${first} ${last}`.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, defaultEmail]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        // my_activation_request reads auth.uid(), which is null in the
        // registration flow — hence the school-keyed variant there.
        const { data } = isPublic
          ? await supabase.rpc('activation_request_status', { p_school_id: schoolId })
          : await supabase.rpc('my_activation_request');
        const r = data as { found?: boolean; reference?: string; status?: string } | null;
        if (!cancelled && r?.found) {
          setExisting({ reference: r.reference!, status: r.status! });
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isPublic, schoolId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim()) { setError('Enter an email address we can reply to.'); return; }

    setBusy(true);
    try {
      const { data, error: rpcErr } = isPublic
        ? await supabase.rpc('submit_activation_request_public', {
            p_school_id: schoolId,
            p_contact_name: name.trim() || null,
            p_contact_email: email.trim(),
            p_plan_id: planId ?? null,
            p_contact_phone: phone.trim() || null,
            p_preferred_method: method,
            p_note: note.trim() || null,
          })
        : await supabase.rpc('submit_activation_request', {
            p_plan_id: planId ?? null,
            p_contact_name: name.trim() || null,
            p_contact_email: email.trim(),
            p_contact_phone: phone.trim() || null,
            p_preferred_method: method,
            p_note: note.trim() || null,
          });
      if (rpcErr) throw rpcErr;

      const result = data as { ok?: boolean; reference?: string; message?: string } | null;
      if (!result?.ok) {
        setError(result?.message ?? 'Could not send your request.');
        return;
      }
      setReference(result.reference ?? null);
    } catch {
      setError('Could not send your request. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  // Already submitted — show the reference rather than the form again.
  if (reference || existing) {
    const ref = reference ?? existing!.reference;
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
        <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-600" />
        <p className="text-sm font-semibold text-emerald-900">Request received</p>
        <p className="mt-1 text-sm text-emerald-800">
          Your reference is <span className="font-mono font-bold">{ref}</span>
        </p>
        <p className="mx-auto mt-3 max-w-sm text-xs leading-relaxed text-emerald-700">
          We will contact you to arrange payment and activate your account. Quote this
          reference if you get in touch. There is no need to submit again.
        </p>
        {existing?.status === 'contacted' && (
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs font-medium text-emerald-800">
            <Clock className="h-3.5 w-3.5" /> We have started working on this.
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-left">
      {intro && (
        <p className="text-sm leading-relaxed text-slate-600">{intro}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Your name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Phone</label>
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="077 000 0000"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            How you would like to pay
          </label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
          >
            {METHODS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">
          Anything else we should know
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
        />
      </div>

      {error && (
        <p className="flex items-start gap-2 text-sm text-red-600">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      <Button type="submit" disabled={busy} className="w-full sm:w-auto">
        {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Mail className="mr-1.5 h-4 w-4" />}
        {busy ? 'Sending…' : 'Request activation'}
      </Button>

      <p className="text-xs text-slate-400">
        Your school name and code are included automatically.
      </p>
    </form>
  );
}
