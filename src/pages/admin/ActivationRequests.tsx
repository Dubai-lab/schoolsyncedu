import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { notify } from '@/components/shared/Toast';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Card } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import {
  Inbox, Loader2, Mail, Phone, CheckCircle2, XCircle, Clock, Building2,
} from 'lucide-react';

/**
 * Queue of schools waiting to be activated.
 *
 * The counterpart to ActivationRequestForm. Previously these arrived as emails
 * to support@, where a message lost to a spam folder and a message never sent
 * were indistinguishable. This is the list that replaces that inbox.
 *
 * Marking a request "activated" records who handled it and when — it does NOT
 * change the subscription. Activating billing stays a separate, deliberate step
 * in School Management, because a status change here should never silently
 * alter what a school is charged.
 */

type Row = {
  id: string;
  reference: string;
  status: 'pending' | 'contacted' | 'activated' | 'declined';
  contact_name: string | null;
  contact_email: string;
  contact_phone: string | null;
  preferred_method: string | null;
  note: string | null;
  created_at: string;
  handled_at: string | null;
  schools: { name: string; school_code: string } | null;
};

const METHOD_LABEL: Record<string, string> = {
  mtn_momo: 'MTN Mobile Money',
  orange_money: 'Orange Money',
  bank_transfer: 'Bank transfer',
  cash: 'Cash / in person',
  other: 'Other',
};

const STATUS_VARIANT: Record<Row['status'], 'warning' | 'info' | 'success' | 'danger'> = {
  pending: 'warning',
  contacted: 'info',
  activated: 'success',
  declined: 'danger',
};

export default function ActivationRequests() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase
        .from('activation_requests')
        .select('*, schools(name, school_code)')
        .order('created_at', { ascending: false });

      if (!showResolved) q = q.in('status', ['pending', 'contacted']);

      const { data, error } = await q;
      if (error) throw error;
      setRows((data ?? []) as Row[]);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [showResolved]);

  useEffect(() => { void load(); }, [load]);

  async function resolve(id: string, status: Row['status']) {
    setBusy(id);
    try {
      const { data, error } = await supabase.rpc('resolve_activation_request', {
        p_id: id,
        p_status: status,
      });
      if (error) throw error;
      const result = data as { ok?: boolean; message?: string } | null;
      if (!result?.ok) {
        notify.error(result?.message ?? 'Could not update the request.');
        return;
      }
      notify.success('Request updated.');
      await load();
    } catch {
      notify.error('Could not update the request.');
    } finally {
      setBusy(null);
    }
  }

  const open = rows.filter((r) => r.status === 'pending' || r.status === 'contacted');

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Admin', href: '/admin' }, { label: 'Activation Requests' }]} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <Inbox className="h-5 w-5 text-primary-600" />
            Activation Requests
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Schools waiting for their subscription to be activated manually.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowResolved((v) => !v)}>
          {showResolved ? 'Show open only' : 'Show all'}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="p-12 text-center">
          <Inbox className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm text-slate-500">
            {showResolved ? 'No requests yet.' : 'No open requests.'}
          </p>
        </Card>
      ) : (
        <>
          {!showResolved && open.length > 0 && (
            <p className="text-sm text-slate-500">
              {open.length} request{open.length === 1 ? '' : 's'} waiting.
            </p>
          )}

          <div className="space-y-3">
            {rows.map((r) => (
              <Card key={r.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold text-slate-900">
                        {r.reference}
                      </span>
                      <Badge variant={STATUS_VARIANT[r.status]}>{r.status}</Badge>
                      <span className="text-xs text-slate-400">
                        {new Date(r.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                      <Building2 className="h-4 w-4 text-slate-400" />
                      {r.schools?.name ?? 'Unknown school'}
                      {r.schools?.school_code && (
                        <span className="font-mono text-xs text-slate-400">
                          ({r.schools.school_code})
                        </span>
                      )}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      {r.contact_name && <span>{r.contact_name}</span>}
                      <a
                        href={`mailto:${r.contact_email}`}
                        className="flex items-center gap-1 text-primary-600 hover:underline"
                      >
                        <Mail className="h-3 w-3" /> {r.contact_email}
                      </a>
                      {r.contact_phone && (
                        <a
                          href={`tel:${r.contact_phone}`}
                          className="flex items-center gap-1 text-primary-600 hover:underline"
                        >
                          <Phone className="h-3 w-3" /> {r.contact_phone}
                        </a>
                      )}
                      {r.preferred_method && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">
                          {METHOD_LABEL[r.preferred_method] ?? r.preferred_method}
                        </span>
                      )}
                    </div>

                    {r.note && (
                      <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
                        {r.note}
                      </p>
                    )}
                  </div>

                  {(r.status === 'pending' || r.status === 'contacted') && (
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {r.status === 'pending' && (
                        <Button
                          size="sm" variant="outline"
                          disabled={busy === r.id}
                          onClick={() => resolve(r.id, 'contacted')}
                        >
                          <Clock className="mr-1 h-3.5 w-3.5" /> Contacted
                        </Button>
                      )}
                      <Button
                        size="sm"
                        disabled={busy === r.id}
                        onClick={() => resolve(r.id, 'activated')}
                      >
                        {busy === r.id
                          ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                          : <CheckCircle2 className="mr-1 h-3.5 w-3.5" />}
                        Mark activated
                      </Button>
                      <Button
                        size="sm" variant="outline"
                        disabled={busy === r.id}
                        onClick={() => resolve(r.id, 'declined')}
                      >
                        <XCircle className="mr-1 h-3.5 w-3.5" /> Decline
                      </Button>
                    </div>
                  )}
                </div>

                {r.status === 'activated' && (
                  <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-400">
                    Marking this activated records that you handled it. Activate the
                    subscription itself in School Management.
                  </p>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
