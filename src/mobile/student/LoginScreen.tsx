import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import {
  fetchBranding, applyBranding, cacheBranding, getCachedBranding,
  type SchoolBranding,
} from './branding';
import { Eye, EyeOff, Loader2, GraduationCap, AlertCircle } from 'lucide-react';
import GridBackdrop from '@/components/shared/GridBackdrop';

/**
 * Student sign-in for the mobile app.
 *
 * Separate from pages/auth/StudentLogin.tsx because that screen is written to
 * sit inside the web AuthLayout card and assumes a desktop viewport.
 *
 * Calls the two-argument lookup_student_login added in migration 200. The
 * one-argument version searches every school and can hand a student another
 * school's account, since registration numbers are only unique per school.
 */

type LookupResult = {
  found: boolean;
  email: string | null;
  school_id?: string;
  school_name?: string;
  message?: string;
};

export default function LoginScreen() {
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const [schoolCode, setSchoolCode] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Branding starts from cache so a returning student sees their school on
  // first paint, before any network call resolves.
  const [branding, setBranding] = useState<SchoolBranding | null>(getCachedBranding);
  const [brandingLoading, setBrandingLoading] = useState(false);
  const lastLookedUp = useRef<string>('');

  useEffect(() => { applyBranding(branding); }, [branding]);

  // School codes are exactly 3 characters, so the lookup fires as soon as the
  // field is complete — no extra button, no waiting until submit to find out
  // the code was wrong.
  useEffect(() => {
    const code = schoolCode.trim().toUpperCase();
    if (code.length !== 3) return;
    if (branding && code === lastLookedUp.current) return;

    let cancelled = false;
    lastLookedUp.current = code;
    setBrandingLoading(true);

    void fetchBranding(code)
      .then((result) => {
        if (cancelled) return;
        setBranding(result);
        cacheBranding(result);
        if (!result) setError('School code not recognised.');
        else setError(null);
      })
      .finally(() => { if (!cancelled) setBrandingLoading(false); });

    return () => { cancelled = true; };
  }, [schoolCode, branding]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const code = schoolCode.trim().toUpperCase();
    const reg = regNumber.trim().toUpperCase();
    if (!code || !reg || !password) {
      setError('Fill in all three fields to sign in.');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error: rpcErr } = await supabase.rpc('lookup_student_login', {
        p_school_code: code,
        p_reg_number: reg,
      });

      if (rpcErr) {
        setError('Cannot reach SchoolSync right now. Check your connection and try again.');
        return;
      }

      const lookup = data as LookupResult | null;
      if (!lookup?.found || !lookup.email) {
        setError(lookup?.message ?? 'We could not find that account.');
        return;
      }

      await signIn(lookup.email, password);
      navigate('/dashboard', { replace: true });
    } catch {
      // signIn surfaces its own message through AuthContext; this catches the
      // wrong-password case so the button doesn't stay stuck in a loading state.
      setError('Incorrect password. Try again, or ask your IT office to reset it.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    // The ruled backdrop the marketing site and the web sign-in already use, so
    // a student arriving from either recognises where they are. It was the last
    // screen still on white with the old blue accent.
    <GridBackdrop
      glow="amber"
      className="flex min-h-[100dvh] flex-col px-6 pb-[env(safe-area-inset-bottom)] pt-[max(3rem,env(safe-area-inset-top))]"
    >
      <div className="relative mx-auto w-full max-w-sm flex-1">
        {/* Header — shows the school's own identity once the code resolves,
            so a universal app still feels like it belongs to their school. */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-amber-500 shadow-lg shadow-black/30">
            {branding?.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt=""
                className="h-full w-full object-cover"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <GraduationCap className="h-8 w-8 text-white" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-white">
            {branding?.name ?? 'SchoolSync'}
          </h1>
          <p className="mt-1 text-sm text-white/50">
            {brandingLoading
              ? 'Looking up your school…'
              : branding
                ? 'Sign in to your student portal'
                : 'Enter your school code to begin'}
          </p>
        </div>

        {error && (
          <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <p className="text-sm text-red-200">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="schoolCode" className="text-sm font-medium text-white/70">
              School code
            </label>
            <input
              id="schoolCode"
              value={schoolCode}
              onChange={(e) => setSchoolCode(e.target.value.toUpperCase())}
              placeholder="LAC"
              maxLength={3}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              // 16px minimum stops iOS auto-zooming on focus without us
              // having to disable pinch-zoom for everyone.
              className="rounded-xl border border-white/12 bg-white/[0.06] px-4 py-3.5 text-center text-[1.25rem] font-bold uppercase tracking-[0.35em] text-white placeholder:font-normal placeholder:tracking-normal placeholder:text-white/20 focus:border-amber-400/60 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
            />
            <p className="text-xs text-white/35">The 3-letter code from your school office</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="regNumber" className="text-sm font-medium text-white/70">
              Registration number
            </label>
            <input
              id="regNumber"
              value={regNumber}
              onChange={(e) => setRegNumber(e.target.value.toUpperCase())}
              placeholder="SLR-2026-0001"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="username"
              className="rounded-xl border border-white/12 bg-white/[0.06] px-4 py-3.5 text-base uppercase text-white placeholder:normal-case placeholder:text-white/20 focus:border-amber-400/60 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
            />
            <p className="text-xs text-white/35">Printed on your student ID card</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-white/70">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full rounded-xl border border-white/12 bg-white/[0.06] px-4 py-3.5 pr-12 text-base text-white focus:border-amber-400/60 focus:outline-none focus:ring-2 focus:ring-amber-400/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-3 text-white/40"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-amber-500 py-4 text-base font-semibold text-[#1c1300] shadow-lg shadow-amber-500/20 active:bg-amber-600 disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-8 text-center text-xs leading-relaxed text-white/35">
          No account yet? Your school's IT office creates student accounts.
        </p>
      </div>
    </GridBackdrop>
  );
}
