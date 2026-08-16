import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import Button from '@/components/ui/Button';
import { Hash, Loader2, BookOpen, AlertCircle, CheckCircle2, X } from 'lucide-react';

/**
 * Find a physical book copy by the serial number printed on it.
 *
 * Replaces picking a title from a dropdown of the whole catalog and then a
 * copy from a second dropdown. The serial is on the book in the librarian's
 * hand — typing it is both faster and impossible to get subtly wrong, which a
 * dropdown of similar titles is not.
 *
 * Deliberately typed rather than scanned. Every copy already carries a UNIQUE
 * identifier, so a scanner would only be a faster keyboard — and requiring one
 * would mean schools that cannot buy hardware cannot use the library at all.
 */

export interface FoundCopy {
  copy_id: string;
  serial: string;
  status: string;
  book_id: string;
  title: string;
  author: string | null;
  isbn: string | null;
  current: {
    student_name: string;
    registration_number: string;
    due_date: string;
    overdue: boolean;
  } | null;
}

interface SerialLookupProps {
  /** 'checkout' requires an available copy; 'return' requires one that is out. */
  mode: 'checkout' | 'return';
  onFound: (copy: FoundCopy) => void;
  selected: FoundCopy | null;
  onClear: () => void;
}

export default function SerialLookup({ mode, onFound, selected, onClear }: SerialLookupProps) {
  const [serial, setSerial] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function find() {
    const q = serial.trim();
    if (!q) return;

    setBusy(true);
    setError(null);
    try {
      const { data, error: rpcErr } = await supabase.rpc('lookup_book_copy', { p_serial: q });
      if (rpcErr) throw rpcErr;

      const r = data as ({ found?: boolean; message?: string } & FoundCopy) | null;
      if (!r?.found) {
        setError(r?.message ?? 'No book with that serial number.');
        return;
      }

      // State checks here rather than at submit, so the librarian learns the
      // problem while the student is still at the desk.
      if (mode === 'checkout' && r.status !== 'available') {
        setError(
          r.current
            ? `Already out with ${r.current.student_name} (${r.current.registration_number}), due ${new Date(r.current.due_date).toLocaleDateString()}.`
            : `This copy is marked "${r.status}" and cannot be lent.`,
        );
        return;
      }

      if (mode === 'return' && !r.current) {
        setError('This copy is not currently checked out to anyone.');
        return;
      }

      onFound(r);
      setSerial('');
    } catch {
      setError('Could not look that up. Check your connection.');
    } finally {
      setBusy(false);
    }
  }

  if (selected) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{selected.title}</p>
          <p className="truncate text-xs text-slate-500">
            {selected.author ?? 'Unknown author'} · Serial{' '}
            <span className="font-mono font-medium">{selected.serial}</span>
          </p>
          {mode === 'return' && selected.current && (
            <p className={`mt-1 text-xs ${selected.current.overdue ? 'font-medium text-red-600' : 'text-slate-500'}`}>
              Out to {selected.current.student_name} · due{' '}
              {new Date(selected.current.due_date).toLocaleDateString()}
              {selected.current.overdue ? ' — overdue' : ''}
            </p>
          )}
        </div>
        <button onClick={onClear} className="shrink-0 p-1 text-slate-400" aria-label="Clear book">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-600">
        Book serial number
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={serial}
            onChange={(e) => { setSerial(e.target.value.toUpperCase()); setError(null); }}
            onKeyDown={(e) => e.key === 'Enter' && find()}
            placeholder="NCA-000123"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 font-mono text-sm uppercase focus:border-primary-400 focus:outline-none"
          />
        </div>
        <Button onClick={find} disabled={busy || !serial.trim()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Find'}
        </Button>
      </div>

      {error ? (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-red-600">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
        </p>
      ) : (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-400">
          <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          The serial number printed on the book's label.
        </p>
      )}
    </div>
  );
}
