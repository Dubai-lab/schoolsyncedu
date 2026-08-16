import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import StudentProfile from '@/pages/student/StudentProfile';
import { useAuth } from '@/hooks/useAuth';
import {
  checkBiometric, isBiometricEnabled, setBiometricEnabled, verifyBiometric,
  markPrompted, type BiometricStatus,
} from './biometric';
import { teardownPush } from './push';
import { LogOut, Loader2, Fingerprint } from 'lucide-react';

/**
 * Profile tab for the mobile app.
 *
 * Wraps the shared StudentProfile page and appends sign-out beneath it.
 *
 * Why a wrapper rather than editing StudentProfile: that page is rendered by
 * the web dashboard too, where signing out already lives in the Header. Adding
 * a button there would put two logouts on the web page. Wrapping keeps the
 * shared page untouched and the web behaviour exactly as it was.
 *
 * Signing out clears the Supabase session, RequireStudent sees an
 * unauthenticated user and routes to the app's own /login — not the school
 * website's login, which is where the web guard sends people.
 */
export default function ProfileScreen() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const [bio, setBio] = useState<BiometricStatus>({ available: false, label: '' });
  const [lockOn, setLockOn] = useState(isBiometricEnabled);

  useEffect(() => { void checkBiometric().then(setBio); }, []);

  async function toggleLock() {
    // Turning it ON verifies first. Enabling a lock the student cannot then
    // pass would strand them behind their own setting.
    if (!lockOn) {
      const ok = await verifyBiometric();
      if (!ok) return;
    }
    const next = !lockOn;
    setBiometricEnabled(next);
    setLockOn(next);
    markPrompted();
  }

  async function handleSignOut() {
    setBusy(true);
    try {
      // Detach this device first, so a shared phone stops delivering this
      // student's notifications to whoever signs in next.
      await teardownPush();
      await signOut();
      navigate('/login', { replace: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <StudentProfile />

      {bio.available && (
        <div className="mt-8 border-t border-slate-200 pt-6">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50">
              <Fingerprint className="h-5 w-5 text-primary-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800">App lock</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                Require {bio.label} to open SchoolSync
              </p>
            </div>
            <button
              role="switch"
              aria-checked={lockOn}
              aria-label={`App lock with ${bio.label}`}
              onClick={toggleLock}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                lockOn ? 'bg-primary-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                  lockOn ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>
      )}

      <div className="mt-8 border-t border-slate-200 pt-6">
        {user?.email && (
          <p className="mb-4 text-center text-xs text-slate-400">
            Signed in as <span className="font-medium text-slate-500">{user.email}</span>
          </p>
        )}

        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white py-3.5 text-sm font-semibold text-slate-700 active:bg-slate-50"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        ) : (
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-center text-sm text-slate-600">
              Sign out of SchoolSync? You'll need your registration number and password to get back
              in.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirming(false)}
                disabled={busy}
                className="min-h-12 flex-1 rounded-xl border border-slate-300 bg-white py-3 text-sm font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSignOut}
                disabled={busy}
                className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-sm font-semibold text-white active:bg-red-700 disabled:opacity-60"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {busy ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
