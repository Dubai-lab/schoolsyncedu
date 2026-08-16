import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import ScannerHeader from '@/components/shared/ScannerHeader';
import { useFetch } from '@/hooks/useFetch';
import { teacherService } from '@/services/teacherService';
import { loadRoster, flushQueue } from './attendService';
import {
  enqueueTap, getQueue, cacheRoster, getCachedRoster, resolveChipOffline,
  isOnline, onConnectivityChange, type CachedRoster,
} from './offlineQueue';
import { startNfcScan, detectNfc, normaliseUid, type StopScan } from '@/lib/nfc';
import {
  Nfc, WifiOff, CheckCircle2, Loader2, Users,
  CloudUpload, Keyboard, AlertCircle, ChevronDown,
} from 'lucide-react';

/**
 * Class attendance session.
 *
 * Once "Start session" caches the roster, everything works with no network:
 * taps resolve against the cached chip ids and queue locally. Sync happens
 * opportunistically and is safe to retry, because attendance upserts on
 * (student_id, attendance_date, subject_id).
 */

type Phase = 'setup' | 'scanning';

function today() {
  return new Date().toISOString().split('T')[0];
}

export default function TeacherSession() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const schoolId = user?.school_id ?? '';
  const teacherId = user?.id ?? '';

  const [phase, setPhase] = useState<Phase>('setup');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [roster, setRoster] = useState<CachedRoster | null>(null);
  const [present, setPresent] = useState<Set<string>>(new Set());
  const [starting, setStarting] = useState(false);

  const [scanning, setScanning] = useState(false);
  const [nfcReason, setNfcReason] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ name: string; ok: boolean } | null>(null);
  const [manual, setManual] = useState('');
  const [showManual, setShowManual] = useState(false);

  const [online, setOnline] = useState(isOnline());
  const [pending, setPending] = useState(getQueue().length);
  const [syncing, setSyncing] = useState(false);

  const stopRef = useRef<StopScan | null>(null);
  const rosterRef = useRef<CachedRoster | null>(null);
  useEffect(() => { rosterRef.current = roster; }, [roster]);

  const { data: myClasses } = useFetch(
    ['attend-classes', schoolId, teacherId],
    () => teacherService.getMyClasses(schoolId, teacherId),
    { enabled: !!schoolId && !!teacherId },
  );
  const { data: mySubjects } = useFetch(
    ['attend-subjects', schoolId, teacherId],
    () => teacherService.getMySubjects(schoolId, teacherId),
    { enabled: !!schoolId && !!teacherId },
  );

  const subjectsForClass = (mySubjects ?? []).filter(
    (s: { class_id: string }) => s.class_id === classId,
  );

  // Restore an interrupted session — the app being backgrounded mid-class
  // must not lose the roll.
  useEffect(() => {
    const cached = getCachedRoster();
    if (cached && phase === 'setup' && !classId) {
      setRoster(cached);
      setClassId(cached.classId);
      setSubjectId(cached.subjectId ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => onConnectivityChange(setOnline), []);

  useEffect(() => () => { stopRef.current?.(); }, []);

  const sync = useCallback(async () => {
    const queue = getQueue();
    if (queue.length === 0 || !teacherId) return;
    setSyncing(true);
    try {
      await flushQueue(queue, teacherId);
    } finally {
      setPending(getQueue().length);
      setSyncing(false);
    }
  }, [teacherId]);

  // Opportunistic flush whenever the network returns.
  useEffect(() => { if (online && pending > 0) void sync(); }, [online, pending, sync]);

  const recordPresent = useCallback((studentId: string, name: string) => {
    setPresent((prev) => {
      if (prev.has(studentId)) return prev;
      const next = new Set(prev);
      next.add(studentId);
      return next;
    });

    const r = rosterRef.current;
    enqueueTap({
      id: crypto.randomUUID(),
      schoolId,
      classId: r?.classId ?? classId,
      subjectId: r?.subjectId ?? (subjectId || null),
      date: today(),
      studentId,
      status: 'present',
      tappedAt: new Date().toISOString(),
      markedBy: teacherId,
    });
    setPending(getQueue().length);
    setFlash({ name, ok: true });
    setTimeout(() => setFlash(null), 1600);
  }, [schoolId, classId, subjectId, teacherId]);

  const handleTag = useCallback((uid: string) => {
    const match = resolveChipOffline(uid);
    if (!match) {
      setFlash({ name: 'Card not in this class', ok: false });
      setTimeout(() => setFlash(null), 2200);
      return;
    }
    recordPresent(match.studentId, `${match.firstName} ${match.lastName}`);
  }, [recordPresent]);

  async function beginScanning() {
    const cap = await detectNfc();
    if (!cap.available) {
      setNfcReason(cap.reason ?? 'NFC unavailable');
      setShowManual(true);
      return;
    }
    try {
      stopRef.current = await startNfcScan(handleTag, (e) => setNfcReason(e.message));
      setScanning(true);
      setNfcReason(null);
    } catch (err) {
      setNfcReason(err instanceof Error ? err.message : 'Could not start NFC');
      setShowManual(true);
    }
  }

  async function handleSignOut() {
    stopRef.current?.();
    await signOut();
    navigate('/', { replace: true });
  }

  async function handleStart() {
    if (!classId) return;
    setStarting(true);
    try {
      const r = await loadRoster(schoolId, classId, subjectId || null);
      cacheRoster(r);
      setRoster(r);
      setPhase('scanning');
      await beginScanning();
    } catch {
      setNfcReason('Could not load the class list. Connect to the internet and try again.');
    } finally {
      setStarting(false);
    }
  }

  function handleManual() {
    const q = manual.trim().toUpperCase();
    if (!q || !roster) return;
    const match =
      roster.students.find((s) => s.registrationNumber.toUpperCase() === q) ??
      resolveChipOffline(normaliseUid(q));
    if (!match) {
      setFlash({ name: 'No student with that number', ok: false });
      setTimeout(() => setFlash(null), 2200);
    } else {
      recordPresent(match.studentId, `${match.firstName} ${match.lastName}`);
    }
    setManual('');
  }

  // ── Setup ──────────────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <div className="min-h-[100dvh] bg-slate-900">
        <ScannerHeader
          title="Class attendance"
          subtitle={user?.email ?? undefined}
          onSignOut={handleSignOut}
        />

        <div className="mx-auto w-full max-w-sm px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-6">
          <h1 className="text-xl font-bold text-white">Start attendance</h1>
          <p className="mt-1 text-sm text-slate-400">{today()}</p>

          <div className="mt-7 flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Class
              </label>
              <div className="relative">
                <select
                  value={classId}
                  onChange={(e) => { setClassId(e.target.value); setSubjectId(''); }}
                  className="w-full appearance-none rounded-xl border border-slate-700 bg-slate-800 px-4 py-3.5 pr-10 text-base text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">Select a class</option>
                  {(myClasses ?? []).map((c: { id: string; name: string; grade_level?: string }) => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.grade_level ? ` — Grade ${c.grade_level}` : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Subject
              </label>
              <div className="relative">
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  disabled={!classId}
                  className="w-full appearance-none rounded-xl border border-slate-700 bg-slate-800 px-4 py-3.5 pr-10 text-base text-white disabled:opacity-50 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">Whole day (no subject)</option>
                  {subjectsForClass.map((s: { subject_id: string; subject_name: string }) => (
                    <option key={s.subject_id} value={s.subject_id}>{s.subject_name}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              </div>
            </div>

            {nfcReason && (
              <p className="flex items-start gap-2 text-sm text-amber-400">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {nfcReason}
              </p>
            )}

            <button
              onClick={handleStart}
              disabled={!classId || starting}
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-500 py-4 text-base font-semibold text-white active:bg-emerald-600 disabled:bg-slate-700 disabled:text-slate-500"
            >
              {starting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Nfc className="h-5 w-5" />}
              {starting ? 'Loading class…' : 'Start session'}
            </button>

            <p className="text-center text-xs leading-relaxed text-slate-500">
              The class list is saved to this phone, so scanning keeps working without internet.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Scanning ───────────────────────────────────────────────────────────────
  const total = roster?.students.length ?? 0;
  const marked = present.size;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-slate-900">
      <ScannerHeader
        title={
          (myClasses ?? []).find((c: { id: string }) => c.id === classId)?.name ?? 'Class'
        }
        subtitle={
          subjectsForClass.find((s: { subject_id: string }) => s.subject_id === subjectId)
            ?.subject_name ?? 'Whole day'
        }
        onSignOut={handleSignOut}
      >
        {!online && (
          <span className="flex items-center gap-1 rounded-lg bg-amber-500/15 px-2 py-1 text-xs font-medium text-amber-400">
            <WifiOff className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Offline</span>
          </span>
        )}
        <button
          onClick={() => { stopRef.current?.(); setPhase('setup'); setScanning(false); }}
          className="flex min-h-11 items-center rounded-lg bg-slate-700 px-3 text-xs font-semibold text-slate-200 active:bg-slate-600"
        >
          End
        </button>
      </ScannerHeader>

      <div className="grid grid-cols-3 gap-3 px-4 pt-4">
        <Stat label="Marked" value={marked} tone="emerald" />
        <Stat label="Class size" value={total} tone="slate" />
        <Stat label="Not synced" value={pending} tone={pending > 0 ? 'amber' : 'slate'} />
      </div>

      {pending > 0 && (
        <div className="px-4 pt-3">
          <button
            onClick={sync}
            disabled={syncing || !online}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 py-3 text-sm font-medium text-slate-200 disabled:opacity-50"
          >
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
            {syncing ? 'Syncing…' : online ? `Sync ${pending} record${pending === 1 ? '' : 's'}` : 'Will sync when back online'}
          </button>
        </div>
      )}

      <div className="px-4 pt-4">
        <div className={`flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed py-8 ${
          scanning ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-slate-700 bg-slate-800/40'
        }`}>
          <Nfc className={`h-6 w-6 ${scanning ? 'animate-pulse text-emerald-400' : 'text-slate-600'}`} />
          <span className={`text-sm font-medium ${scanning ? 'text-emerald-300' : 'text-slate-500'}`}>
            {scanning ? 'Ready — tap a student card' : 'NFC not active'}
          </span>
        </div>

        {nfcReason && (
          <p className="mt-2 flex items-start gap-2 text-xs text-amber-400">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {nfcReason}
          </p>
        )}

        <button
          onClick={() => setShowManual((v) => !v)}
          className="mt-3 flex w-full items-center justify-center gap-2 py-2 text-xs font-medium text-slate-400"
        >
          <Keyboard className="h-3.5 w-3.5" />
          {showManual ? 'Hide manual entry' : 'Enter a number instead'}
        </button>

        {showManual && (
          <div className="flex gap-2">
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleManual()}
              placeholder="Registration number"
              autoCapitalize="characters"
              className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-base text-white placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none"
            />
            <button
              onClick={handleManual}
              className="rounded-xl bg-emerald-500 px-5 text-sm font-semibold text-white"
            >
              Mark
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
          <Users className="h-3.5 w-3.5" /> Class list
        </p>
        <ul className="flex flex-col gap-1.5">
          {(roster?.students ?? []).map((s) => {
            const here = present.has(s.studentId);
            return (
              <li
                key={s.studentId}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                  here ? 'border-emerald-800/60 bg-emerald-500/10' : 'border-slate-800 bg-slate-800/40'
                }`}
              >
                {here
                  ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                  : <span className="h-5 w-5 shrink-0 rounded-full border-2 border-slate-700" />}
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm ${here ? 'font-semibold text-white' : 'text-slate-400'}`}>
                    {s.firstName} {s.lastName}
                  </p>
                  <p className="font-mono text-xs text-slate-500">{s.registrationNumber}</p>
                </div>
                {!s.chipId && (
                  <span className="shrink-0 text-[0.625rem] font-medium uppercase text-slate-600">
                    No card
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {flash && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-6">
          <div className={`flex items-center gap-2 rounded-xl px-5 py-3 shadow-2xl ${
            flash.ok ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
          }`}>
            {flash.ok ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
            <span className="text-sm font-semibold">{flash.name}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'emerald' | 'amber' | 'slate' }) {
  const tones = {
    emerald: 'bg-emerald-500/10 text-emerald-300',
    amber: 'bg-amber-500/10 text-amber-300',
    slate: 'bg-slate-800 text-slate-300',
  };
  return (
    <div className={`rounded-xl p-3 text-center ${tones[tone]}`}>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="mt-0.5 text-[0.6875rem] opacity-70">{label}</p>
    </div>
  );
}
