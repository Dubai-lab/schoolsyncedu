import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { studentPortalService } from '@/services/studentPortalService';
import { Card } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Breadcrumb from '@/components/shared/Breadcrumb';
import {
  BookOpen,
  TrendingUp,
  TrendingDown,
  Award,
  FileText,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Shield,
  X,
} from 'lucide-react';

// ==================== GRADE PRIVACY LOCK ====================
// PIN stored in localStorage per user: `grade_pin_{userId}`
// PIN_ENABLED flag: `grade_pin_enabled_{userId}`

function getPinKey(userId: string) { return `grade_pin_${userId}`; }
function getPinEnabledKey(userId: string) { return `grade_pin_enabled_${userId}`; }

const PIN_SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

function GradePrivacyGate({
  userId,
  onUnlock,
}: {
  userId: string;
  onUnlock: () => void;
}) {
  const [mode, setMode] = useState<'prompt' | 'setup' | 'enter'>('prompt');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');

  const pinEnabled = localStorage.getItem(getPinEnabledKey(userId)) === 'true';

  useEffect(() => {
    if (pinEnabled) {
      setMode('enter');
    } else {
      setMode('prompt');
    }
  }, [pinEnabled]);

  const handleEnterPin = useCallback(() => {
    const stored = localStorage.getItem(getPinKey(userId));
    if (pin === stored) {
      setError('');
      onUnlock();
    } else {
      setError('Incorrect PIN. Try again.');
      setPin('');
    }
  }, [pin, userId, onUnlock]);

  const handleSetPin = useCallback(() => {
    if (pin.length < 4) { setError('PIN must be at least 4 digits'); return; }
    if (pin !== confirmPin) { setError('PINs do not match'); return; }
    localStorage.setItem(getPinKey(userId), pin);
    localStorage.setItem(getPinEnabledKey(userId), 'true');
    setError('');
    onUnlock();
  }, [pin, confirmPin, userId, onUnlock]);

  const handleSkip = () => {
    // User skips — grades shown without lock
    localStorage.removeItem(getPinEnabledKey(userId));
    onUnlock();
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center">
          {/* Icon */}
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
            <Shield className="h-8 w-8 text-blue-600" />
          </div>

          {mode === 'prompt' && (
            <>
              <h2 className="text-xl font-bold text-slate-900">Grade Privacy Lock</h2>
              <p className="mt-2 text-sm text-slate-500">
                Protect your grades with a 4–6 digit PIN. Only you can view them — even on a shared device.
              </p>
              <div className="mt-6 space-y-3">
                <button
                  onClick={() => { setMode('setup'); setPin(''); setConfirmPin(''); setError(''); }}
                  className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                >
                  <Lock className="inline h-4 w-4 mr-2" />
                  Set a PIN
                </button>
                <button
                  onClick={handleSkip}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  Skip for now
                </button>
              </div>
            </>
          )}

          {mode === 'setup' && (
            <>
              <h2 className="text-xl font-bold text-slate-900">Set Your PIN</h2>
              <p className="mt-2 text-sm text-slate-500">
                Choose a 4–6 digit PIN to protect your grades.
              </p>
              <div className="mt-6 space-y-3">
                <PinInput
                  value={pin}
                  onChange={setPin}
                  placeholder="Enter PIN (4–6 digits)"
                  onKeyDown={(e) => { if (e.key === 'Enter' && confirmPin) handleSetPin(); }}
                />
                <PinInput
                  value={confirmPin}
                  onChange={setConfirmPin}
                  placeholder="Confirm PIN"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSetPin(); }}
                />
                {error && <p className="text-xs text-red-600">{error}</p>}
                <button
                  onClick={handleSetPin}
                  disabled={pin.length < 4 || confirmPin.length < 4}
                  className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  Save PIN & View Grades
                </button>
                <button
                  onClick={() => setMode('prompt')}
                  className="w-full text-xs text-slate-400 hover:text-slate-600"
                >
                  Back
                </button>
              </div>
            </>
          )}

          {mode === 'enter' && (
            <>
              <h2 className="text-xl font-bold text-slate-900">Enter Your PIN</h2>
              <p className="mt-2 text-sm text-slate-500">
                Your grades are protected. Enter your PIN to view them.
              </p>
              <div className="mt-6 space-y-3">
                <PinInput
                  value={pin}
                  onChange={setPin}
                  placeholder="Enter your PIN"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleEnterPin(); }}
                />
                {error && <p className="text-xs text-red-600">{error}</p>}
                <button
                  onClick={handleEnterPin}
                  disabled={pin.length < 4}
                  className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <Unlock className="inline h-4 w-4 mr-2" />
                  Unlock Grades
                </button>
                <p className="text-xs text-slate-400">
                  Forgot PIN? Visit the IT office to reset.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Simple controlled PIN input with show/hide
function PinInput({
  value, onChange, placeholder, onKeyDown,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pr-11 text-center text-xl font-mono tracking-widest text-slate-900 placeholder:text-sm placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

// ==================== MAIN COMPONENT ====================

export default function MyGrades() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';
  const userId = user?.id ?? '';
  const [termFilter, setTermFilter] = useState('');

  // Privacy lock state
  const [unlocked, setUnlocked] = useState(false);
  const [showLockBanner, setShowLockBanner] = useState(false);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Lock again after 5 minutes of inactivity
  const resetLockTimer = useCallback(() => {
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    const pinEnabled = localStorage.getItem(getPinEnabledKey(userId)) === 'true';
    if (pinEnabled) {
      lockTimerRef.current = setTimeout(() => {
        setUnlocked(false);
      }, PIN_SESSION_TIMEOUT_MS);
    }
  }, [userId]);

  useEffect(() => {
    if (unlocked) resetLockTimer();
    return () => {
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    };
  }, [unlocked, resetLockTimer]);

  const handleUnlock = useCallback(() => {
    setUnlocked(true);
    resetLockTimer();
  }, [resetLockTimer]);

  const handleLockNow = () => {
    setUnlocked(false);
    setShowLockBanner(false);
  };

  const handleDisablePin = () => {
    localStorage.removeItem(getPinKey(userId));
    localStorage.removeItem(getPinEnabledKey(userId));
    setShowLockBanner(false);
  };

  // Get student profile first to get student_id
  const { data: student } = useFetch(
    ['my-profile', schoolId, userId],
    () => studentPortalService.getMyProfile(schoolId, userId),
    { enabled: !!schoolId && !!userId },
  );

  const studentId = (student as Record<string, unknown> | null)?.id as string ?? '';

  const { data: grades = [], isLoading } = useFetch(
    ['my-grades', schoolId, studentId],
    () => studentPortalService.getMyGrades(schoolId, studentId),
    { enabled: !!schoolId && !!studentId },
  );

  const { data: reportCards = [] } = useFetch(
    ['my-report-cards', schoolId, studentId],
    () => studentPortalService.getMyReportCards(schoolId, studentId),
    { enabled: !!schoolId && !!studentId },
  );

  const pinEnabled = localStorage.getItem(getPinEnabledKey(userId)) === 'true';

  // Show PIN gate if not yet unlocked
  if (!unlocked) {
    return (
      <div className="space-y-6">
        <Breadcrumb items={[{ label: 'My Portal' }, { label: 'My Grades' }]} />
        <GradePrivacyGate userId={userId} onUnlock={handleUnlock} />
      </div>
    );
  }

  // Group grades by term/semester
  const terms = [...new Set(grades.map((g: Record<string, unknown>) => (g.term as string) || (g.academic_term as string) || 'Current'))];

  const filteredGrades = termFilter
    ? grades.filter((g: Record<string, unknown>) => ((g.term as string) || (g.academic_term as string) || 'Current') === termFilter)
    : grades;

  // Calculate summary
  const scores = filteredGrades.filter((g: Record<string, unknown>) => g.score != null).map((g: Record<string, unknown>) => Number(g.score));
  const avgScore = scores.length > 0 ? (scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0;
  const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
  const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;

  function getGradeColor(score: number): string {
    if (score >= 90) return 'text-emerald-600';
    if (score >= 80) return 'text-blue-600';
    if (score >= 70) return 'text-amber-600';
    if (score >= 60) return 'text-orange-600';
    return 'text-red-600';
  }

  function getGradeLetter(score: number): string {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'My Portal' }, { label: 'My Grades' }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            <BookOpen className="inline-block h-6 w-6 mr-2 text-blue-600" />
            My Grades
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            View your academic performance across all subjects.
          </p>
        </div>

        {/* Lock controls */}
        <div className="flex items-center gap-2">
          {pinEnabled ? (
            <button
              onClick={handleLockNow}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-500 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50"
            >
              <Lock className="h-3.5 w-3.5" />
              Lock Now
            </button>
          ) : (
            <button
              onClick={() => setShowLockBanner(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg px-3 py-2 hover:bg-blue-50"
            >
              <Shield className="h-3.5 w-3.5" />
              Enable PIN Lock
            </button>
          )}
        </div>
      </div>

      {/* PIN Setup Banner */}
      {showLockBanner && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex items-start gap-3">
          <Shield className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-blue-900 text-sm">Set a Grade Privacy PIN</p>
            <p className="text-xs text-blue-700 mt-1">
              This will require a PIN next time you open your grades. Protect your academic records on shared devices.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => { setUnlocked(false); }}
                className="text-xs font-semibold text-white bg-blue-600 rounded-lg px-3 py-1.5 hover:bg-blue-700"
              >
                Set PIN Now
              </button>
              <button onClick={() => setShowLockBanner(false)} className="text-xs text-blue-500">
                Cancel
              </button>
            </div>
          </div>
          <button onClick={() => setShowLockBanner(false)}>
            <X className="h-4 w-4 text-blue-400" />
          </button>
        </div>
      )}

      {/* Disable PIN link */}
      {pinEnabled && (
        <div className="text-right">
          <button onClick={handleDisablePin} className="text-xs text-slate-400 hover:text-red-500">
            Remove PIN lock
          </button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <TrendingUp className="h-5 w-5 text-blue-500 mx-auto mb-1" />
          <p className="text-xs text-slate-500">Average</p>
          <p className="text-xl font-bold text-slate-800">{avgScore.toFixed(1)}%</p>
        </Card>
        <Card className="p-4 text-center">
          <Award className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
          <p className="text-xs text-slate-500">Highest</p>
          <p className="text-xl font-bold text-emerald-600">{highestScore}%</p>
        </Card>
        <Card className="p-4 text-center">
          <TrendingDown className="h-5 w-5 text-amber-500 mx-auto mb-1" />
          <p className="text-xs text-slate-500">Lowest</p>
          <p className="text-xl font-bold text-amber-600">{lowestScore}%</p>
        </Card>
        <Card className="p-4 text-center">
          <FileText className="h-5 w-5 text-purple-500 mx-auto mb-1" />
          <p className="text-xs text-slate-500">Subjects</p>
          <p className="text-xl font-bold text-slate-800">{scores.length}</p>
        </Card>
      </div>

      {/* Term filter */}
      {terms.length > 1 && (
        <div className="flex gap-2">
          <button
            onClick={() => setTermFilter('')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              !termFilter ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-slate-50 text-slate-500 border-slate-200'
            }`}
          >
            All Terms
          </button>
          {terms.map((t) => (
            <button
              key={t}
              onClick={() => setTermFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                termFilter === t ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-slate-50 text-slate-500 border-slate-200'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Grades table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 rounded-full border-b-2 border-blue-600" />
        </div>
      ) : filteredGrades.length === 0 ? (
        <Card className="p-12 text-center">
          <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-600">No grades yet</h3>
          <p className="text-sm text-slate-400 mt-1">Your grades will appear here once your teachers record them.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Subject</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-600">Score</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-600">Grade</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Term</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredGrades.map((g: Record<string, unknown>, i: number) => {
                  const score = Number(g.score ?? 0);
                  const subject = g.subjects as Record<string, unknown> | null;
                  return (
                    <tr key={i} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{(subject?.name as string) || 'Unknown Subject'}</p>
                        {subject?.code ? <p className="text-xs text-slate-400">{subject.code as string}</p> : null}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-lg font-bold ${getGradeColor(score)}`}>{score}%</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={score >= 70 ? 'success' : score >= 60 ? 'warning' : 'danger'} size="sm">
                          {getGradeLetter(score)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {(g.term as string) || (g.academic_term as string) || 'Current'}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {g.created_at ? new Date(g.created_at as string).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Report Cards */}
      {reportCards.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-3">Report Cards</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {reportCards.map((rc: Record<string, unknown>) => (
              <Card key={rc.id as string} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-slate-800">{(rc.academic_year as string) || 'Report Card'}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{(rc.term as string) || ''}</p>
                  </div>
                  <Badge variant="info" size="sm">
                    {(rc.overall_grade as string) || '—'}
                  </Badge>
                </div>
                {rc.pdf_url ? (
                  <a
                    href={rc.pdf_url as string}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700"
                  >
                    <FileText className="h-3.5 w-3.5" /> View Report Card
                  </a>
                ) : null}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
