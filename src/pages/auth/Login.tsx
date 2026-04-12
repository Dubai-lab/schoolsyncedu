import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Eye, EyeOff, LogIn, Loader2 } from 'lucide-react';

export default function Login() {
  const { signIn, signOut, error, isAuthenticated, isLoading, user, schoolSlug } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const confirmed = searchParams.get('confirmed') === 'true';
  const switchAccount = searchParams.get('switch') === 'true';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const displayError = localError || error;
  const loading = submitting || (isLoading && submitting);

  // If user came with ?switch=true, sign them out first so they can enter new credentials
  useEffect(() => {
    if (switchAccount && isAuthenticated && !signingOut) {
      setSigningOut(true);
      signOut().finally(() => setSigningOut(false));
    }
  }, [switchAccount, isAuthenticated, signOut, signingOut]);

  // Navigate once the user profile is loaded after sign-in
  // But NOT if they're trying to switch accounts
  useEffect(() => {
    if (isAuthenticated && user && !switchAccount) {
      // School-level users must use their school portal — sign them out and show error
      if (schoolSlug && user.role !== 'super_admin' && user.role !== 'proprietor') {
        signOut().then(() => {
          setLocalError(
            `This login is for platform administrators only. Please use your school portal to sign in.`
          );
          setSubmitting(false);
        });
        return;
      }
      const dest = user.role === 'super_admin' ? '/admin' : user.role === 'proprietor' ? '/proprietor' : '/dashboard';
      navigate(dest, { replace: true });
    }
  }, [isAuthenticated, user, navigate, switchAccount, schoolSlug, signOut]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!email.trim() || !password.trim()) {
      setLocalError('Please enter your email and password');
      return;
    }

    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      // signIn resolved — auth succeeded.
      // onAuthStateChange will load the user profile; the useEffect above
      // will navigate once isAuthenticated + user are set.
    } catch {
      // Error is set in context
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center lg:text-left">
        <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
        <p className="mt-2 text-sm text-slate-500">
          Sign in to access your school dashboard
        </p>
      </div>

      {/* Already logged in — offer switch account */}
      {isAuthenticated && user && !switchAccount && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-4 text-sm text-blue-800">
          <p className="font-medium">You are signed in as {user.full_name || user.email} ({user.role?.replace('_', ' ')})</p>
          <div className="mt-3 flex gap-3">
            <button
              onClick={() => {
                const dest = user.role === 'super_admin' ? '/admin' : user.role === 'proprietor' ? '/proprietor' : user.role === 'it_admin' ? '/it-admin' : '/dashboard';
                navigate(dest);
              }}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              Go to Dashboard
            </button>
            <button
              onClick={() => navigate('/auth/login?switch=true')}
              className="rounded-md border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
            >
              Switch Account
            </button>
          </div>
        </div>
      )}

      {/* Email confirmed banner */}
      {confirmed && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Email confirmed successfully! You can now sign in.
        </div>
      )}

      {/* Error */}
      {displayError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {displayError}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Email */}
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm font-medium text-slate-700">
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@school.edu.lr"
            autoComplete="email"
            required
            className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Password
            </label>
            <Link
              to="/auth/forgot-password"
              className="text-xs font-medium text-primary-600 hover:text-primary-700"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
              className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 pr-11 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogIn className="h-4 w-4" />
          )}
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}