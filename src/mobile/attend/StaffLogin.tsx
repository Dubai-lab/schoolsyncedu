import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/utils/constants';
import { Eye, EyeOff, Loader2, ArrowLeft, AlertCircle } from 'lucide-react';

/**
 * Staff sign-in for SchoolSync Attend.
 *
 * Shared by class attendance (teachers) and card assignment (IT admins).
 * Email and password, the same credentials as the web portal — unlike the
 * student app, which resolves a registration number first. There is no
 * per-school ambiguity to solve here: email is unique across auth.users.
 */

interface StaffLoginProps {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  allowedRoles: readonly UserRole[];
  /** Where to land after a successful sign-in. */
  redirectTo: string;
  /** Shown when the credentials are valid but the role is wrong for this mode. */
  wrongRoleMessage: string;
}

export default function StaffLogin({
  title, subtitle, icon: Icon, allowedRoles, redirectTo, wrongRoleMessage,
}: StaffLoginProps) {
  const { signIn, user } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }

    setBusy(true);
    try {
      await signIn(email.trim(), password);
      navigate(redirectTo, { replace: true });
    } catch {
      setError('Email or password is incorrect.');
    } finally {
      setBusy(false);
    }
  }

  // Valid credentials but the wrong role for this mode — say so rather than
  // dropping them into a screen that will simply be empty.
  const wrongRole = user != null && !allowedRoles.includes(user.role as UserRole);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-slate-900 px-6 pb-[env(safe-area-inset-bottom)] pt-[max(2rem,env(safe-area-inset-top))]">
      <button
        onClick={() => navigate('/')}
        className="-ml-2 flex w-fit items-center gap-1.5 p-2 text-sm text-slate-400"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="mx-auto w-full max-w-sm flex-1 pt-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500">
            <Icon className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">{title}</h1>
          <p className="mt-1.5 text-sm text-slate-400">{subtitle}</p>
        </div>

        {(error || wrongRole) && (
          <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <p className="text-sm text-red-300">{wrongRole ? wrongRoleMessage : error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-slate-300">Email</label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3.5 text-base text-white placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-slate-300">Password</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3.5 pr-12 text-base text-white focus:border-emerald-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-3 text-slate-500"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="mt-2 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-500 py-4 text-base font-semibold text-white active:bg-emerald-600 disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
