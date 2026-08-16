import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { bookService } from '@/services/libraryService';
import { notify } from '@/components/shared/Toast';
import Dialog, { DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { Loader2, Plus, Printer, Hash, Copy as CopyIcon } from 'lucide-react';

/**
 * Every physical copy of one book, with its serial number.
 *
 * Serials are generated automatically when a book is added, but until now
 * nothing displayed them — so a librarian could not label the books or type a
 * number at checkout. This is where they are read from, printed, and added to.
 */

type CopyRow = {
  id: string;
  barcode: string;
  status: string;
  holder?: { student_name: string; due_date: string } | null;
};

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  available: 'success',
  checked_out: 'warning',
  damaged: 'danger',
  lost: 'danger',
};

export default function BookCopiesDialog({
  bookId, bookTitle, open, onClose, onChanged,
}: {
  bookId: string;
  bookTitle: string;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [rows, setRows] = useState<CopyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [addCount, setAddCount] = useState('1');

  const load = useCallback(async () => {
    if (!bookId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('book_copies')
        .select('id, barcode, status, book_checkouts(due_date, is_returned, students(first_name, last_name))')
        .eq('book_id', bookId)
        .order('barcode');
      if (error) throw error;

      setRows(
        (data ?? []).map((c) => {
          const rec = c as Record<string, unknown>;
          const outs = (rec.book_checkouts ?? []) as Array<Record<string, unknown>>;
          const active = outs.find((o) => o.is_returned !== true);
          const s = active?.students as { first_name?: string; last_name?: string } | undefined;
          return {
            id: rec.id as string,
            barcode: rec.barcode as string,
            status: rec.status as string,
            holder: active
              ? {
                  student_name: `${s?.first_name ?? ''} ${s?.last_name ?? ''}`.trim(),
                  due_date: active.due_date as string,
                }
              : null,
          };
        }),
      );
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  useEffect(() => { if (open) void load(); }, [open, load]);

  async function handleAdd() {
    const n = Number(addCount);
    if (!Number.isFinite(n) || n < 1) return;
    setAdding(true);
    try {
      await bookService.addCopies(bookId, Math.floor(n));
      notify.success(`${Math.floor(n)} cop${n === 1 ? 'y' : 'ies'} added.`);
      setAddCount('1');
      await load();
      onChanged();
    } catch {
      notify.error('Could not add copies.');
    } finally {
      setAdding(false);
    }
  }

  /**
   * Print a plain list of serials for labelling.
   *
   * A separate window rather than window.print() on the dialog: printing the
   * page would carry the whole dashboard with it, and the librarian wants a
   * sheet of numbers to cut up, not a screenshot of an app.
   */
  function handlePrint() {
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) {
      notify.error('Allow pop-ups to print the serial list.');
      return;
    }
    w.document.write(`
      <html><head><title>${bookTitle} — serial numbers</title>
      <style>
        body{font-family:system-ui,sans-serif;margin:24px;color:#111}
        h1{font-size:16px;margin:0 0 2px}
        p{font-size:12px;color:#666;margin:0 0 18px}
        .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
        .lbl{border:1px solid #ccc;border-radius:6px;padding:10px 8px;text-align:center}
        .sn{font-family:ui-monospace,monospace;font-size:14px;font-weight:700}
        .t{font-size:9px;color:#666;margin-top:3px}
        @media print{ .lbl{break-inside:avoid} }
      </style></head><body>
      <h1>${bookTitle}</h1>
      <p>${rows.length} cop${rows.length === 1 ? 'y' : 'ies'} · cut out and attach one label to each book</p>
      <div class="grid">
        ${rows.map((r) => `<div class="lbl"><div class="sn">${r.barcode}</div><div class="t">${bookTitle}</div></div>`).join('')}
      </div>
      </body></html>`);
    w.document.close();
    w.focus();
    w.print();
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogHeader>
        <DialogTitle>Copies — {bookTitle}</DialogTitle>
      </DialogHeader>

      <DialogBody>
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Add copies</label>
            <input
              type="number" min="1"
              value={addCount}
              onChange={(e) => setAddCount(e.target.value)}
              className="w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
            />
          </div>
          <Button size="sm" onClick={handleAdd} disabled={adding}>
            {adding ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
            Add
          </Button>
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={handlePrint} disabled={rows.length === 0}>
            <Printer className="mr-1 h-4 w-4" /> Print labels
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            No copies yet. Add some above — serial numbers are generated automatically.
          </p>
        ) : (
          <div className="max-h-[380px] space-y-1.5 overflow-y-auto pr-1">
            {rows.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2"
              >
                <Hash className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="font-mono text-sm font-semibold text-slate-800">{c.barcode}</span>

                <button
                  onClick={() => {
                    void navigator.clipboard?.writeText(c.barcode);
                    notify.success('Serial copied.');
                  }}
                  title="Copy serial number"
                  className="shrink-0 p-1 text-slate-300 hover:text-slate-500"
                >
                  <CopyIcon className="h-3.5 w-3.5" />
                </button>

                <div className="flex-1" />

                {c.holder && (
                  <span className="truncate text-xs text-slate-500">
                    {c.holder.student_name} · due {new Date(c.holder.due_date).toLocaleDateString()}
                  </span>
                )}
                <Badge variant={STATUS_VARIANT[c.status] ?? 'default'}>
                  {c.status.replace('_', ' ')}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </DialogBody>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Close</Button>
      </DialogFooter>
    </Dialog>
  );
}
