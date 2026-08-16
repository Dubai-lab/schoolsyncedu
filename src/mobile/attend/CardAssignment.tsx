import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import ScannerHeader from '@/components/shared/ScannerHeader';
import { useFetch } from '@/hooks/useFetch';
import { nfcCardService } from '@/services/nfcService';
import { startNfcScan, detectNfc, normaliseUid, type StopScan } from '@/lib/nfc';
import {
  Nfc, Search, CheckCircle2, Loader2, AlertCircle,
  CreditCard, Keyboard, X,
} from 'lucide-react';

/**
 * Assign a printed card to a physical NFC chip, from a phone.
 *
 * Why this exists: assignment currently only happens in the web app
 * (pages/it-admin/NfcAssignment.tsx) using Web NFC, which works in Chrome on
 * Android and nowhere else. Schools without a USB reader attached to the PC
 * have no practical way to do it.
 *
 * This does NOT replace the web flow — that stays for schools that buy a USB
 * reader. It is the alternative for everyone else.
 *
 * The important detail: assignment never writes to the chip. nfcCardService's
 * encodeNfc only stores the chip's UID against the card record, and the
 * scanners match on that UID. Reading a UID is something iOS Core NFC can do,
 * so this flow works on iPhone as well as Android — unlike writing NDEF.
 *
 * Cards are still created and printed from the PC. The phone does one job:
 * pair an existing card record with the chip embedded in the plastic.
 */

type CardRow = {
  id: string;
  card_number: string;
  status: string;
  student_id: string;
  nfc_chip_id: string | null;
  valid_until: string | null;
  students: {
    first_name: string;
    last_name: string;
    registration_number: string;
    current_grade_level?: string | null;
  } | null;
};

export default function CardAssignment() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const schoolId = user?.school_id ?? '';

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<CardRow | null>(null);
  const [chipId, setChipId] = useState('');
  const [scanning, setScanning] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);
  const [nfcReason, setNfcReason] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const stopRef = useRef<StopScan | null>(null);

  const { data, isLoading, refetch } = useFetch(
    ['attend-nfc-cards', schoolId],
    () => nfcCardService.list(schoolId),
    { enabled: !!schoolId },
  );

  const pending = useMemo(() => {
    const all = ((data as { data?: unknown[] } | undefined)?.data ?? []) as CardRow[];
    // Same set the web screen treats as assignable: printed but not yet live.
    return all.filter((c) => ['designed', 'printed', 'encoded'].includes(c.status));
  }, [data]);

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return pending;
    return pending.filter((c) => {
      const s = c.students;
      return (
        c.card_number?.toUpperCase().includes(q) ||
        s?.registration_number?.toUpperCase().includes(q) ||
        `${s?.first_name ?? ''} ${s?.last_name ?? ''}`.toUpperCase().includes(q)
      );
    });
  }, [pending, query]);

  useEffect(() => () => { stopRef.current?.(); }, []);

  async function beginScan() {
    setNfcReason(null);
    const cap = await detectNfc();
    if (!cap.available) {
      setNfcReason(cap.reason ?? 'NFC unavailable on this device.');
      setManualEntry(true);
      return;
    }
    try {
      stopRef.current = await startNfcScan(
        (uid) => {
          setChipId(uid);
          stopRef.current?.();
          setScanning(false);
        },
        (e) => setNfcReason(e.message),
      );
      setScanning(true);
    } catch (err) {
      setNfcReason(err instanceof Error ? err.message : 'Could not start NFC.');
      setManualEntry(true);
    }
  }

  async function handleSignOut() {
    stopRef.current?.();
    await signOut();
    navigate('/', { replace: true });
  }

  function closeSheet() {
    stopRef.current?.();
    setScanning(false);
    setSelected(null);
    setChipId('');
    setManualEntry(false);
    setNfcReason(null);
  }

  async function handleAssign() {
    if (!selected || !chipId.trim()) return;
    setSaving(true);
    setNfcReason(null);
    try {
      const expiry =
        selected.valid_until ??
        new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Mirrors the web flow exactly so both paths produce identical records.
      await nfcCardService.encodeNfc(
        selected.id,
        chipId.trim(),
        {
          student_id: selected.student_id,
          school_id: schoolId,
          permissions: ['attendance', 'library', 'gate_access'],
          expiry,
        },
        user?.id ?? '',
      );

      await nfcCardService.assignCard({
        card_id: selected.id,
        assigned_to_student: selected.student_id,
        assigned_by: user?.id ?? '',
        // 'pwa_scan' is the existing value for a scan performed on a phone.
        assignment_method: 'pwa_scan',
      });

      const name = `${selected.students?.first_name ?? ''} ${selected.students?.last_name ?? ''}`.trim();
      setDone(name || selected.card_number);
      closeSheet();
      void refetch();
      setTimeout(() => setDone(null), 3000);
    } catch (err) {
      setNfcReason(
        err instanceof Error
          ? `Could not save: ${err.message}`
          : 'Could not save the assignment. Check your connection.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-slate-900">
      <ScannerHeader
        title="Assign cards"
        subtitle={`${pending.length} card${pending.length === 1 ? '' : 's'} waiting for a chip`}
        onSignOut={handleSignOut}
      />

      <div className="border-b border-slate-800 px-4 pb-3 pt-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, reg number or card"
            className="w-full rounded-xl border border-slate-700 bg-slate-800 py-3 pl-10 pr-4 text-base text-white placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-emerald-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <CreditCard className="mb-3 h-10 w-10 text-slate-700" />
            <p className="text-sm text-slate-400">
              {pending.length === 0 ? 'No cards waiting for a chip' : 'Nothing matches that search'}
            </p>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-600">
              Cards are created and printed from the web portal. They appear here once printed.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {filtered.map((card) => (
              <li key={card.id}>
                <button
                  onClick={() => { setSelected(card); setChipId(''); void beginScan(); }}
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-800 bg-slate-800/50 p-3 text-left active:bg-slate-800"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-700">
                    <CreditCard className="h-5 w-5 text-slate-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">
                      {card.students?.first_name} {card.students?.last_name}
                    </p>
                    <p className="truncate font-mono text-xs text-slate-500">
                      {card.students?.registration_number} · {card.card_number}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-md bg-slate-700 px-2 py-1 text-[0.625rem] font-medium uppercase text-slate-300">
                    {card.status}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Assignment sheet */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70" onClick={closeSheet}>
          <div
            className="w-full rounded-t-3xl bg-slate-800 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-white">
                  {selected.students?.first_name} {selected.students?.last_name}
                </p>
                <p className="truncate font-mono text-xs text-slate-400">
                  {selected.students?.registration_number} · {selected.card_number}
                </p>
              </div>
              <button onClick={closeSheet} aria-label="Close" className="-mr-2 -mt-2 p-2 text-slate-400">
                <X className="h-5 w-5" />
              </button>
            </div>

            {chipId ? (
              <div className="mb-4 rounded-xl border border-emerald-700/50 bg-emerald-500/10 p-4">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-emerald-400">
                  Chip detected
                </p>
                <p className="break-all font-mono text-sm text-white">{chipId}</p>
              </div>
            ) : (
              <div className={`mb-4 flex flex-col items-center gap-2 rounded-xl border-2 border-dashed py-8 ${
                scanning ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-slate-700'
              }`}>
                <Nfc className={`h-8 w-8 ${scanning ? 'animate-pulse text-emerald-400' : 'text-slate-600'}`} />
                <p className={`text-sm font-medium ${scanning ? 'text-emerald-300' : 'text-slate-500'}`}>
                  {scanning ? 'Hold the card against the phone' : 'NFC not active'}
                </p>
              </div>
            )}

            {nfcReason && (
              <p className="mb-3 flex items-start gap-2 text-xs text-amber-400">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {nfcReason}
              </p>
            )}

            {manualEntry && (
              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-medium text-slate-400">
                  Type the chip ID
                </label>
                <input
                  value={chipId}
                  onChange={(e) => setChipId(normaliseUid(e.target.value))}
                  placeholder="04A2B3C4D5E6"
                  autoCapitalize="characters"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 font-mono text-base text-white placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            )}

            <div className="flex gap-3">
              {!manualEntry && (
                <button
                  onClick={() => setManualEntry(true)}
                  className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-slate-600 px-4 text-sm font-medium text-slate-300"
                >
                  <Keyboard className="h-4 w-4" /> Type
                </button>
              )}
              <button
                onClick={handleAssign}
                disabled={!chipId.trim() || saving}
                className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 text-base font-semibold text-white active:bg-emerald-600 disabled:bg-slate-700 disabled:text-slate-500"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? 'Assigning…' : 'Assign card'}
              </button>
            </div>
          </div>
        </div>
      )}

      {done && (
        <div className="pointer-events-none fixed inset-x-0 bottom-8 z-50 flex justify-center px-6">
          <div className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 shadow-2xl">
            <CheckCircle2 className="h-5 w-5 text-white" />
            <span className="text-sm font-semibold text-white">{done} — card active</span>
          </div>
        </div>
      )}
    </div>
  );
}
