import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { kioskService } from '@/services/kioskService';
import type { KioskSchool } from '@/services/kioskService';
import { Wifi, Lock, SchoolIcon, Loader2, AlertCircle } from 'lucide-react';

// PIN pad digits
const PAD = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

export default function KioskLogin() {
  const navigate = useNavigate();

  const [schoolCode, setSchoolCode] = useState('');
  const [pin,        setPin]        = useState('');
  const [step,       setStep]       = useState<'code' | 'pin'>('code');
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  function handleCodeNext() {
    if (!schoolCode.trim()) { setError('Enter your school code.'); return; }
    setError('');
    setStep('pin');
  }

  function handlePadPress(key: string) {
    if (key === '⌫') {
      setPin((p) => p.slice(0, -1));
    } else if (pin.length < 6) {
      setPin((p) => p + key);
    }
  }

  async function handleLogin() {
    if (pin.length < 4) { setError('PIN must be at least 4 digits.'); return; }
    setLoading(true);
    setError('');
    try {
      const school: KioskSchool = await kioskService.verifyAccess(schoolCode, pin);
      // Store school info in sessionStorage for the scanner page
      sessionStorage.setItem('kiosk_school', JSON.stringify(school));
      navigate('/kiosk/scanner');
    } catch (err) {
      setError((err as Error).message ?? 'Access denied. Check your school code and PIN.');
      setPin('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-4">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Wifi className="h-8 w-8 text-emerald-400" />
          <span className="text-2xl font-bold text-white tracking-wide">SchoolSync</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white">Exam Clearance Kiosk</h1>
        <p className="text-slate-400 mt-1 text-sm">NFC fee clearance for students</p>
      </div>

      <div className="w-full max-w-sm bg-slate-800 rounded-2xl p-6 shadow-2xl">

        {step === 'code' ? (
          <>
            <div className="flex items-center gap-2 mb-4">
              <SchoolIcon className="h-5 w-5 text-emerald-400" />
              <h2 className="text-lg font-semibold text-white">Enter School Code</h2>
            </div>
            <input
              type="text"
              value={schoolCode}
              onChange={(e) => { setSchoolCode(e.target.value.toUpperCase()); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleCodeNext()}
              placeholder="e.g. LAC"
              maxLength={10}
              autoFocus
              className="w-full rounded-xl bg-slate-700 border border-slate-600 text-white text-2xl font-bold text-center tracking-[0.3em] px-4 py-4 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 uppercase"
            />
            {error && (
              <div className="mt-3 flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}
            <button
              onClick={handleCodeNext}
              className="mt-4 w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-4 text-lg transition-colors"
            >
              Next →
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-1">
              <Lock className="h-5 w-5 text-emerald-400" />
              <h2 className="text-lg font-semibold text-white">Enter Finance PIN</h2>
            </div>
            <p className="text-slate-400 text-xs mb-4">
              School: <span className="text-emerald-400 font-bold">{schoolCode}</span>
              <button
                onClick={() => { setStep('code'); setPin(''); setError(''); }}
                className="ml-2 text-slate-500 hover:text-slate-300 underline text-xs"
              >
                change
              </button>
            </p>

            {/* PIN dots */}
            <div className="flex items-center justify-center gap-3 mb-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full transition-all ${
                    i < pin.length ? 'bg-emerald-400 scale-110' : 'bg-slate-600'
                  }`}
                />
              ))}
            </div>

            {/* PIN Pad */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {PAD.map((key, i) => (
                <button
                  key={i}
                  onClick={() => key && handlePadPress(key)}
                  disabled={!key}
                  className={`rounded-xl py-4 text-xl font-bold transition-all ${
                    !key
                      ? 'invisible'
                      : key === '⌫'
                      ? 'bg-slate-600 hover:bg-slate-500 text-slate-300'
                      : 'bg-slate-700 hover:bg-slate-600 active:bg-emerald-600 text-white'
                  }`}
                >
                  {key}
                </button>
              ))}
            </div>

            {error && (
              <div className="mb-3 flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={loading || pin.length < 4}
              className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-600 disabled:text-slate-400 text-white font-bold py-4 text-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Loader2 className="h-5 w-5 animate-spin" /> Verifying…</>
              ) : (
                'Access Kiosk'
              )}
            </button>
          </>
        )}
      </div>

      <p className="mt-6 text-slate-600 text-xs text-center">
        Finance PIN is set in the Bursar dashboard → Kiosk Settings
      </p>
    </div>
  );
}
