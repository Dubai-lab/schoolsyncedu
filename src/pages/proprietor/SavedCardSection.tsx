import { useState, useEffect, useCallback } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements, PaymentElement, useStripe, useElements,
} from '@stripe/react-stripe-js';
import { supabase } from '@/lib/supabase';
import { savedCardsService, type SavedPaymentToken } from '@/services/proprietorService';
import { notify } from '@/components/shared/Toast';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { CreditCard, ShieldCheck, Loader2, Trash2, Lock, AlertCircle } from 'lucide-react';

/**
 * Card on file for subscription renewals.
 *
 * This screen did not exist. The proprietor dashboard linked to
 * /proprietor/subscription?tab=cards, but 'cards' was never in the tab list and
 * had no render block, so the button appeared to do nothing — and because no
 * card could ever be saved, the "Save a payment card" prompt returned every
 * time. Only the UI was missing; the three edge functions behind it were
 * already written.
 *
 * Flow, all server-side except the card entry itself:
 *   create-setup-intent  → clientSecret
 *   Stripe Elements      → card details go straight to Stripe, never here
 *   save-payment-card    → stores brand/last4/expiry plus the reusable token
 *
 * Removal is governed by can_remove_payment_method (migration 207): a school
 * may replace its card freely, but may only remove one once nothing is owed
 * and nothing is about to renew.
 */

// ── Card entry form (inside <Elements>) ──────────────────────────────────────

function CardForm({ schoolId, onSaved, onCancel }: {
  schoolId: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setBusy(true);
    setError(null);
    try {
      // redirect: 'if_required' keeps the proprietor on this page for ordinary
      // cards, while still allowing the redirect that 3-D Secure needs.
      const { error: confirmErr, setupIntent } = await stripe.confirmSetup({
        elements,
        confirmParams: { return_url: `${window.location.origin}/proprietor/subscription?tab=cards` },
        redirect: 'if_required',
      });

      if (confirmErr) {
        setError(confirmErr.message ?? 'Could not verify that card.');
        return;
      }

      if (!setupIntent?.id) {
        setError('Card verification did not complete. Try again.');
        return;
      }

      const { data, error: saveErr } = await supabase.functions.invoke('save-payment-card', {
        body: { setup_intent_id: setupIntent.id, school_id: schoolId },
      });
      if (saveErr) throw new Error(saveErr.message);
      if (data?.error) throw new Error(String(data.error));

      notify.success('Card saved.');
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the card.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement options={{ layout: 'tabs' }} />

      {error && (
        <p className="flex items-start gap-2 text-sm text-red-600">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!stripe || busy}>
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          {busy ? 'Saving…' : 'Save card'}
        </Button>
      </div>

      <p className="flex items-start gap-1.5 text-xs text-slate-400">
        <Lock className="mt-0.5 h-3 w-3 shrink-0" />
        Card details go directly to Stripe. SchoolSync stores only the brand,
        last four digits and expiry.
      </p>
    </form>
  );
}

// ── Section ──────────────────────────────────────────────────────────────────

export default function SavedCardSection({ schoolId }: { schoolId: string }) {
  const [cards, setCards] = useState<SavedPaymentToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [removal, setRemoval] = useState<{ allowed: boolean; reason?: string }>({ allowed: false });
  const [removing, setRemoving] = useState<string | null>(null);
  const [stripePromise] = useState(() => {
    const key = import.meta.env.VITE_STRIPE_PUBLIC_KEY as string | undefined;
    return key ? loadStripe(key) : null;
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [list, check] = await Promise.all([
        savedCardsService.list(schoolId),
        supabase.rpc('can_remove_payment_method'),
      ]);
      setCards(list);
      const c = check.data as { allowed?: boolean; reason?: string } | null;
      setRemoval({ allowed: c?.allowed === true, reason: c?.reason });
    } catch {
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function startAdding() {
    setPreparing(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-setup-intent', {
        body: { school_id: schoolId },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(String(data.error));
      setClientSecret(data.clientSecret as string);
      setAdding(true);
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Could not start card setup.');
    } finally {
      setPreparing(false);
    }
  }

  async function handleRemove(id: string) {
    setRemoving(id);
    try {
      const { data, error } = await supabase.rpc('remove_payment_method', { p_id: id });
      if (error) throw error;
      const result = data as { ok?: boolean; message?: string } | null;
      if (!result?.ok) {
        notify.error(result?.message ?? 'Could not remove the card.');
        return;
      }
      notify.success('Card removed.');
      await refresh();
    } catch {
      notify.error('Could not remove the card.');
    } finally {
      setRemoving(null);
    }
  }

  if (!stripePromise) {
    return (
      <Card className="p-5">
        <p className="text-sm text-slate-500">
          Card payments are not configured. Set VITE_STRIPE_PUBLIC_KEY to enable saved cards.
        </p>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      <Card className="p-5">
        <div className="mb-4 flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" />
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Card on file</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
              Saving a card lets your subscription renew without re-entering details.
              It is optional, and you can replace it at any time.
            </p>
          </div>
        </div>

        {cards.length === 0 ? (
          <p className="mb-4 text-sm text-slate-400">No card saved.</p>
        ) : (
          <ul className="mb-4 space-y-2">
            {cards.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <CreditCard className="h-5 w-5 shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium capitalize text-slate-800">
                    {c.card_type ?? 'Card'} •••• {c.card_last4 ?? '____'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {c.card_expiry ? `Expires ${c.card_expiry}` : 'Saved'}
                    {c.is_default ? ' · Default' : ''}
                  </p>
                </div>

                <button
                  onClick={() => handleRemove(c.id)}
                  disabled={!removal.allowed || removing === c.id}
                  title={removal.allowed ? 'Remove card' : removal.reason}
                  className="flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-medium text-red-600 disabled:cursor-not-allowed disabled:text-slate-300"
                >
                  {removing === c.id
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Trash2 className="h-4 w-4" />}
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* The reason matters more than the disabled state — a greyed-out bin
            icon with no explanation is where support tickets come from. */}
        {cards.length > 0 && !removal.allowed && removal.reason && (
          <p className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-700">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {removal.reason}
          </p>
        )}

        {!adding && (
          <Button size="sm" onClick={startAdding} disabled={preparing}>
            {preparing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            {cards.length > 0 ? 'Replace card' : 'Add card'}
          </Button>
        )}
      </Card>

      {adding && clientSecret && (
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-800">
            {cards.length > 0 ? 'Replace your card' : 'Add a card'}
          </h3>
          <Elements
            stripe={stripePromise}
            options={{ clientSecret, appearance: { theme: 'stripe' } }}
          >
            <CardForm
              schoolId={schoolId}
              onSaved={() => { setAdding(false); setClientSecret(null); void refresh(); }}
              onCancel={() => { setAdding(false); setClientSecret(null); }}
            />
          </Elements>
        </Card>
      )}
    </div>
  );
}
