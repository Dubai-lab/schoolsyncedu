import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { notify } from '@/components/shared/Toast';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Card } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import {
  MessageSquare, Loader2, Mail, CheckCircle2, Ban, Reply,
} from 'lucide-react';

/**
 * Messages from the public contact form.
 *
 * These used to go nowhere: the form displayed a success screen after a 1200ms
 * timer and discarded the message. This is where they land now.
 *
 * Read straight from the table rather than waiting on email, because the row
 * is the reliable part — a message that fails to send, or lands in a spam
 * folder, is still here.
 */

type Row = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  source_page: string | null;
  status: 'new' | 'read' | 'replied' | 'spam';
  created_at: string;
};

const STATUS_VARIANT: Record<Row['status'], 'warning' | 'info' | 'success' | 'default'> = {
  new: 'warning',
  read: 'info',
  replied: 'success',
  spam: 'default',
};

export default function ContactMessages() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase
        .from('contact_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (!showAll) q = q.in('status', ['new', 'read']);

      const { data, error } = await q;
      if (error) throw error;
      setRows((data ?? []) as Row[]);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [showAll]);

  useEffect(() => { void load(); }, [load]);

  async function setStatus(id: string, status: Row['status']) {
    setBusy(id);
    try {
      const { data, error } = await supabase.rpc('set_contact_message_status', {
        p_id: id, p_status: status,
      });
      if (error) throw error;
      const result = data as { ok?: boolean; message?: string } | null;
      if (!result?.ok) {
        notify.error(result?.message ?? 'Could not update.');
        return;
      }
      await load();
    } catch {
      notify.error('Could not update.');
    } finally {
      setBusy(null);
    }
  }

  const unread = rows.filter((r) => r.status === 'new').length;

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Admin', href: '/admin' }, { label: 'Messages' }]} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <MessageSquare className="h-5 w-5 text-primary-600" />
            Contact Messages
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Enquiries from the public contact form.
            {unread > 0 && <span className="ml-1 font-medium text-slate-700">{unread} unread.</span>}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Show open only' : 'Show all'}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="p-12 text-center">
          <MessageSquare className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm text-slate-500">
            {showAll ? 'No messages yet.' : 'Nothing waiting.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.id} className={`p-5 ${r.status === 'new' ? 'border-l-4 border-l-amber-400' : ''}`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">{r.name}</span>
                    <Badge variant={STATUS_VARIANT[r.status]}>{r.status}</Badge>
                    <span className="text-xs text-slate-400">
                      {new Date(r.created_at).toLocaleString()}
                    </span>
                  </div>

                  <a
                    href={`mailto:${r.email}`}
                    className="mt-1 flex items-center gap-1 text-xs text-primary-600 hover:underline"
                  >
                    <Mail className="h-3 w-3" /> {r.email}
                  </a>

                  {r.subject && (
                    <p className="mt-2 text-sm font-medium text-slate-700">{r.subject}</p>
                  )}

                  <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-600">
                    {r.message}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col gap-2">
                  <a
                    href={`mailto:${r.email}?subject=${encodeURIComponent(`Re: ${r.subject ?? 'Your message to SchoolSync'}`)}`}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700"
                  >
                    <Reply className="h-3.5 w-3.5" /> Reply
                  </a>
                  {r.status !== 'replied' && (
                    <Button
                      size="sm" variant="outline"
                      disabled={busy === r.id}
                      onClick={() => setStatus(r.id, 'replied')}
                    >
                      {busy === r.id
                        ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        : <CheckCircle2 className="mr-1 h-3.5 w-3.5" />}
                      Done
                    </Button>
                  )}
                  {r.status !== 'spam' && (
                    <Button
                      size="sm" variant="outline"
                      disabled={busy === r.id}
                      onClick={() => setStatus(r.id, 'spam')}
                    >
                      <Ban className="mr-1 h-3.5 w-3.5" /> Spam
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
