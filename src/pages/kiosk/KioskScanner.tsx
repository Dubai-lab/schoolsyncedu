import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { kioskService } from '@/services/kioskService';
import type { KioskSchool, KioskClass, ClearanceResult, ScanRecord } from '@/services/kioskService';
import {
  Wifi, WifiOff, CheckCircle2, XCircle, Download, LogOut,
  Lock, Loader2, Users, ChevronDown, AlertCircle,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────
type ScanState = 'idle' | 'scanning' | 'result' | 'error';

// ── Helpers ────────────────────────────────────────────────────────────────
function fmt(n: number) { return n.toFixed(2); }

// ── Result Card ────────────────────────────────────────────────────────────
function ResultCard({ result, onDismiss }: { result: ClearanceResult; onDismiss: () => void }) {
  const cleared = result.is_cleared;
  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center px-6 transition-colors ${
        cleared ? 'bg-emerald-950' : 'bg-red-950'
      }`}
      onClick={onDismiss}
    >
      <div className={`w-full max-w-sm rounded-3xl p-8 text-center shadow-2xl ${
        cleared ? 'bg-emerald-900 border-2 border-emerald-400' : 'bg-red-900 border-2 border-red-400'
      }`}>
        {cleared ? (
          <CheckCircle2 className="h-24 w-24 text-emerald-400 mx-auto mb-4" />
        ) : (
          <XCircle className="h-24 w-24 text-red-400 mx-auto mb-4" />
        )}

        <h2 className={`text-4xl font-black mb-2 ${cleared ? 'text-emerald-300' : 'text-red-300'}`}>
          {cleared ? 'CLEARED' : 'NOT CLEARED'}
        </h2>

        <p className="text-white text-xl font-bold mb-1">{result.student_name}</p>
        <p className="text-slate-400 text-sm font-mono mb-4">{result.registration_number}</p>

        {!cleared && (
          <div className="rounded-xl bg-black/30 p-4 mb-4">
            <p className="text-red-300 text-sm font-medium mb-2">Outstanding Balance</p>
            <p className="text-red-200 text-3xl font-black">${fmt(result.total_balance_usd)}</p>
            {result.fee_details.length > 0 && (
              <div className="mt-3 space-y-1 text-left">
                {result.fee_details.map((f, i) => (
                  <div key={i} className="flex justify-between text-xs text-red-300">
                    <span>{f.fee_type} ({f.term})</span>
                    <span>${fmt(f.balance)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <p className="text-slate-400 text-xs mt-2">Tap anywhere to continue</p>
      </div>
    </div>
  );
}

// ── PIN Lock Dialog ────────────────────────────────────────────────────────
const PAD = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

function PinDialog({
  title, onConfirm, onCancel, storedPin,
}: { title: string; onConfirm: () => void; onCancel: () => void; storedPin: string }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  function handleKey(key: string) {
    if (key === '⌫') setPin((p) => p.slice(0, -1));
    else if (pin.length < 6) setPin((p) => p + key);
  }

  function handleConfirm() {
    if (pin === storedPin) { onConfirm(); }
    else { setError('Incorrect PIN'); setPin(''); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-4">
      <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-xs">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="h-5 w-5 text-slate-400" />
          <h3 className="text-white font-bold">{title}</h3>
        </div>

        <div className="flex justify-center gap-3 mb-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`w-3.5 h-3.5 rounded-full ${i < pin.length ? 'bg-emerald-400' : 'bg-slate-600'}`} />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {PAD.map((key, i) => (
            <button
              key={i}
              onClick={() => key && handleKey(key)}
              disabled={!key}
              className={`rounded-xl py-3.5 text-lg font-bold transition-all ${
                !key ? 'invisible' :
                key === '⌫' ? 'bg-slate-600 hover:bg-slate-500 text-slate-300' :
                'bg-slate-700 hover:bg-slate-600 active:bg-emerald-600 text-white'
              }`}
            >
              {key}
            </button>
          ))}
        </div>

        {error && (
          <p className="text-red-400 text-sm text-center mb-3 flex items-center justify-center gap-1">
            <AlertCircle className="h-3.5 w-3.5" /> {error}
          </p>
        )}

        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 py-3 font-medium text-sm">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={pin.length < 4}
            className="flex-1 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-600 disabled:text-slate-400 text-white py-3 font-bold text-sm"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function KioskScanner() {
  const navigate = useNavigate();

  // Load school from sessionStorage (set during login)
  const [school] = useState<KioskSchool | null>(() => {
    try { return JSON.parse(sessionStorage.getItem('kiosk_school') ?? 'null'); }
    catch { return null; }
  });

  const [classes,       setClasses]       = useState<KioskClass[]>([]);
  const [selectedClass, setSelectedClass] = useState<KioskClass | null>(null);
  const [semester,      setSemester]      = useState('Semester 1');
  const [sessionId,     setSessionId]     = useState<string | null>(null);
  const [records,       setRecords]       = useState<ScanRecord[]>([]);

  const [scanning,     setScanning]     = useState(false);
  const [scanState,    setScanState]    = useState<ScanState>('idle');
  const [lastResult,   setLastResult]   = useState<ClearanceResult | null>(null);
  const [scanError,    setScanError]    = useState('');

  const [showLogoutPin, setShowLogoutPin]   = useState(false);
  const [showEndPin,    setShowEndPin]      = useState(false);
  const [setupDone,     setSetupDone]       = useState(false);
  const [setupLoading,  setSetupLoading]    = useState(false);

  const nfcAbortRef = useRef<AbortController | null>(null);
  const resultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nfcSupported = 'NDEFReader' in window;

  // Redirect if no school in session
  useEffect(() => {
    if (!school) navigate('/kiosk', { replace: true });
  }, [school, navigate]);

  // Load classes
  useEffect(() => {
    if (!school) return;
    kioskService.getClasses(school.school_id).then(setClasses).catch(console.error);
  }, [school]);

  // Auto-dismiss result after 6 seconds
  useEffect(() => {
    if (lastResult) {
      resultTimeoutRef.current = setTimeout(() => {
        setLastResult(null);
        setScanState('idle');
      }, 6000);
    }
    return () => { if (resultTimeoutRef.current) clearTimeout(resultTimeoutRef.current); };
  }, [lastResult]);

  // ── NFC Scanning ──────────────────────────────────────────────────────────
  const stopNfc = useCallback(() => {
    nfcAbortRef.current?.abort();
    nfcAbortRef.current = null;
    setScanning(false);
  }, []);

  const processChip = useCallback(async (chipId: string) => {
    if (!school || !sessionId) return;
    setScanState('scanning');
    try {
      const result = await kioskService.checkClearance(school.school_id, chipId, semester);
      await kioskService.saveScan(sessionId, school.school_id, result);
      setLastResult(result);
      setScanState('result');
      // Add to local records list
      setRecords((prev) => {
        const filtered = prev.filter((r) => r.registration_number !== result.registration_number);
        return [{
          id:                  crypto.randomUUID(),
          student_name:        result.student_name,
          registration_number: result.registration_number,
          class_name:          result.class_name,
          is_cleared:          result.is_cleared,
          total_balance_usd:   result.total_balance_usd,
          scanned_at:          new Date().toISOString(),
          fee_details:         result.fee_details,
        }, ...filtered];
      });
    } catch (err) {
      setScanError((err as Error).message ?? 'Card lookup failed');
      setScanState('error');
      setTimeout(() => { setScanState('idle'); setScanError(''); }, 3000);
    }
  }, [school, sessionId, semester]);

  async function startNfc() {
    if (!('NDEFReader' in window)) {
      setScanError('NFC not supported on this device. Use Android Chrome.');
      return;
    }
    setScanning(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ndef = new (window as any).NDEFReader();
      const abort = new AbortController();
      nfcAbortRef.current = abort;
      await ndef.scan({ signal: abort.signal });

      ndef.addEventListener('reading', ({ serialNumber }: { serialNumber: string }) => {
        const chipId = serialNumber.replace(/:/g, '').toUpperCase();
        processChip(chipId);
      });

      ndef.addEventListener('readingerror', () => {
        setScanError('Could not read NFC chip. Try again.');
        setScanState('error');
        setTimeout(() => { setScanState('idle'); setScanError(''); }, 3000);
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setScanError((err as Error).message ?? 'NFC start failed');
      setScanning(false);
    }
  }

  // ── Session Start ─────────────────────────────────────────────────────────
  async function handleStartSession() {
    if (!school || !selectedClass) return;
    setSetupLoading(true);
    try {
      const id = await kioskService.startSession(
        school.school_id, semester,
        selectedClass.id, selectedClass.name,
        school.academic_year,
      );
      setSessionId(id);
      setSetupDone(true);
      await startNfc();
    } catch (err) {
      setScanError((err as Error).message ?? 'Failed to start session');
    } finally {
      setSetupLoading(false);
    }
  }

  // ── Export ────────────────────────────────────────────────────────────────
  function handleExport() {
    kioskService.exportToCsv(
      records,
      `${selectedClass?.name ?? 'class'}-${semester.replace(' ', '')}`,
    );
  }

  // ── Logout ────────────────────────────────────────────────────────────────
  function handleLogout() {
    stopNfc();
    sessionStorage.removeItem('kiosk_school');
    navigate('/kiosk', { replace: true });
  }

  const clearedCount  = records.filter((r) => r.is_cleared).length;
  const pendingCount  = records.filter((r) => !r.is_cleared).length;

  if (!school) return null;

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">

      {/* ── Top Bar ── */}
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="font-bold text-white text-sm">{school.school_name}</p>
          <p className="text-slate-400 text-xs">{semester} · {selectedClass?.name ?? 'No class selected'}</p>
        </div>
        <div className="flex items-center gap-2">
          {scanning ? (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <Wifi className="h-3.5 w-3.5 animate-pulse" /> NFC Active
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <WifiOff className="h-3.5 w-3.5" /> NFC Off
            </span>
          )}
          <button
            onClick={() => setShowLogoutPin(true)}
            className="ml-2 p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white transition"
            title="Exit Kiosk"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* ── Setup Panel (shown before session starts) ── */}
      {!setupDone ? (
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-sm bg-slate-800 rounded-2xl p-6 space-y-5">
            <h2 className="text-xl font-bold text-center">Configure Session</h2>

            {/* Semester */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">Semester (Exam)</label>
              <div className="grid grid-cols-2 gap-2">
                {['Semester 1', 'Semester 2'].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSemester(s)}
                    className={`rounded-xl py-3 font-bold text-sm transition-all ${
                      semester === s
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Class */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">Select Class</label>
              <div className="relative">
                <select
                  value={selectedClass?.id ?? ''}
                  onChange={(e) => {
                    const cls = classes.find((c) => c.id === e.target.value) ?? null;
                    setSelectedClass(cls);
                  }}
                  className="w-full rounded-xl bg-slate-700 border border-slate-600 text-white px-4 py-3 pr-10 appearance-none focus:outline-none focus:border-emerald-500"
                >
                  <option value="">-- Select a class --</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.grade_level ? ` — Grade ${c.grade_level}` : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {scanError && (
              <p className="text-red-400 text-sm flex items-center gap-1">
                <AlertCircle className="h-4 w-4" /> {scanError}
              </p>
            )}

            <button
              onClick={handleStartSession}
              disabled={!selectedClass || setupLoading}
              className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-600 disabled:text-slate-400 text-white font-bold py-4 text-lg transition-colors flex items-center justify-center gap-2"
            >
              {setupLoading ? (
                <><Loader2 className="h-5 w-5 animate-spin" /> Starting…</>
              ) : (
                <><Wifi className="h-5 w-5" /> Start Scanning</>
              )}
            </button>

            {!nfcSupported && (
              <p className="text-amber-400 text-xs text-center">
                ⚠ NFC not detected. Use Android Chrome for NFC scanning.
              </p>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* ── Active Session ── */}
          <div className="flex-1 flex flex-col">

            {/* Scan status banner */}
            <div className={`px-4 py-3 flex items-center justify-between ${
              scanning ? 'bg-emerald-900/40 border-b border-emerald-800' : 'bg-slate-800 border-b border-slate-700'
            }`}>
              <div className="flex items-center gap-2">
                {scanning ? (
                  <>
                    <Wifi className="h-5 w-5 text-emerald-400 animate-pulse" />
                    <span className="text-emerald-300 font-medium text-sm">Ready — tap a student card</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-5 w-5 text-slate-500" />
                    <span className="text-slate-400 text-sm">NFC paused</span>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                {!scanning ? (
                  <button
                    onClick={startNfc}
                    className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 flex items-center gap-1"
                  >
                    <Wifi className="h-3.5 w-3.5" /> Resume
                  </button>
                ) : (
                  <button
                    onClick={stopNfc}
                    className="rounded-lg bg-slate-600 hover:bg-slate-500 text-white text-xs font-bold px-3 py-1.5"
                  >
                    Pause
                  </button>
                )}
                <button
                  onClick={() => setShowEndPin(true)}
                  className="rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-bold px-3 py-1.5"
                >
                  End
                </button>
              </div>
            </div>

            {/* Scanning feedback */}
            {scanState === 'scanning' && (
              <div className="flex items-center justify-center gap-2 py-3 bg-blue-900/30 text-blue-300 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Checking fees…
              </div>
            )}
            {scanState === 'error' && (
              <div className="flex items-center justify-center gap-2 py-3 bg-red-900/30 text-red-300 text-sm">
                <AlertCircle className="h-4 w-4" /> {scanError}
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 px-4 pt-4">
              <div className="bg-slate-800 rounded-xl p-3 text-center">
                <p className="text-slate-400 text-xs">Scanned</p>
                <p className="text-white text-2xl font-black">{records.length}</p>
              </div>
              <div className="bg-emerald-900/40 rounded-xl p-3 text-center">
                <p className="text-emerald-400 text-xs">Cleared</p>
                <p className="text-emerald-300 text-2xl font-black">{clearedCount}</p>
              </div>
              <div className="bg-red-900/40 rounded-xl p-3 text-center">
                <p className="text-red-400 text-xs">Owed</p>
                <p className="text-red-300 text-2xl font-black">{pendingCount}</p>
              </div>
            </div>

            {/* Records Table */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Users className="h-4 w-4" />
                <span>Scan Records</span>
              </div>
              {records.length > 0 && (
                <button
                  onClick={handleExport}
                  className="flex items-center gap-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium px-3 py-1.5"
                >
                  <Download className="h-3.5 w-3.5" /> Download CSV
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-6">
              {records.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Wifi className="h-12 w-12 text-slate-700 mb-3" />
                  <p className="text-slate-500 text-sm">No cards scanned yet.</p>
                  <p className="text-slate-600 text-xs mt-1">Tap a student's NFC card to check their clearance.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {records.map((r) => (
                    <div
                      key={r.id}
                      className={`rounded-xl p-3 flex items-center gap-3 ${
                        r.is_cleared ? 'bg-emerald-900/30 border border-emerald-800/50' : 'bg-red-900/30 border border-red-800/50'
                      }`}
                    >
                      {r.is_cleared ? (
                        <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="h-6 w-6 text-red-400 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{r.student_name}</p>
                        <p className="text-xs text-slate-400 font-mono">{r.registration_number}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {r.is_cleared ? (
                          <span className="text-xs font-bold text-emerald-400">CLEARED</span>
                        ) : (
                          <span className="text-xs font-bold text-red-400">${fmt(r.total_balance_usd)}</span>
                        )}
                        <p className="text-[10px] text-slate-500">{new Date(r.scanned_at).toLocaleTimeString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Full-screen Result Card ── */}
      {lastResult && (
        <ResultCard
          result={lastResult}
          onDismiss={() => { setLastResult(null); setScanState('idle'); }}
        />
      )}

      {/* ── Logout PIN Dialog ── */}
      {showLogoutPin && (
        <PinDialog
          title="Exit Kiosk"
          storedPin={school ? JSON.parse(sessionStorage.getItem('kiosk_school') ?? '{}')?.pin ?? '' : ''}
          onConfirm={() => { setShowLogoutPin(false); handleLogout(); }}
          onCancel={() => setShowLogoutPin(false)}
        />
      )}

      {/* ── End Session PIN Dialog ── */}
      {showEndPin && (
        <PinDialog
          title="End Session"
          storedPin={school ? JSON.parse(sessionStorage.getItem('kiosk_school') ?? '{}')?.pin ?? '' : ''}
          onConfirm={() => {
            setShowEndPin(false);
            stopNfc();
            setSetupDone(false);
            setSessionId(null);
            setRecords([]);
            setScanState('idle');
          }}
          onCancel={() => setShowEndPin(false)}
        />
      )}
    </div>
  );
}
