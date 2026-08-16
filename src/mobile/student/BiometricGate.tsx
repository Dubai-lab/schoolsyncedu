import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { checkBiometric, isBiometricEnabled, verifyBiometric } from './biometric';
import { Fingerprint, Loader2, LogOut } from 'lucide-react';

/**
 * Holds the app locked until the student passes the device biometric check.
 *
 * Sits inside RequireStudent, so it only ever guards an already-valid session.
 * If the check fails or is dismissed the screen stays locked — the only ways
 * past are a successful verification or signing out, which returns the app to
 * the normal login screen.
 *
 * Deliberately does NOT re-lock when the app is backgrounded. A student
 * flicking to WhatsApp to copy their registration number and back should not
 * face another prompt; the lock exists for someone else picking up the phone,
 * which a launch-time check already covers.
 */
export default function BiometricGate({ children }: { children: ReactNode }) {
  const { signOut } = useAuth();
  // Start locked only if the student turned the lock on — otherwise the first
  // paint would flash a lock screen for everyone.
  const [locked, setLocked] = useState(() => isBiometricEnabled());
  const [checking, setChecking] = useState(false);
  const [failed, setFailed] = useState(false);
  const [label, setLabel] = useState('biometrics');

  const attempt = useCallback(async () => {
    setChecking(true);
    setFailed(false);
    const ok = await verifyBiometric();
    setChecking(false);
    if (ok) setLocked(false);
    else setFailed(true);
  }, []);

  useEffect(() => {
    if (!locked) return;
    let cancelled = false;

    void (async () => {
      const status = await checkBiometric();
      if (cancelled) return;

      // Enrolled biometrics can be removed after the lock was switched on.
      // Refusing entry then would strand the student behind a prompt their
      // phone can no longer show, so fall open — the Supabase session is
      // still valid and this was never an authentication boundary.
      if (!status.available) {
        setLocked(false);
        return;
      }

      setLabel(status.label);
      void attempt();
    })();

    return () => { cancelled = true; };
  }, [locked, attempt]);

  if (!locked) return <>{children}</>;

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-white px-8">
      <div className="flex flex-col items-center text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary-50">
          {checking
            ? <Loader2 className="h-9 w-9 animate-spin text-primary-600" />
            : <Fingerprint className="h-9 w-9 text-primary-600" />}
        </div>

        <h1 className="text-lg font-semibold text-slate-900">SchoolSync is locked</h1>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-slate-500">
          {checking
            ? 'Waiting for verification…'
            : failed
              ? `Unlock with ${label} to see your grades, fees and timetable.`
              : `Use ${label} to unlock.`}
        </p>

        {!checking && (
          <button
            onClick={attempt}
            className="mt-7 min-h-12 w-full max-w-xs rounded-xl bg-primary-600 py-3.5 text-base font-semibold text-white active:bg-primary-700"
          >
            {failed ? 'Try again' : 'Unlock'}
          </button>
        )}

        <button
          onClick={() => signOut()}
          className="mt-3 flex items-center gap-1.5 p-3 text-sm font-medium text-slate-400"
        >
          <LogOut className="h-4 w-4" />
          Sign out instead
        </button>
      </div>
    </div>
  );
}
