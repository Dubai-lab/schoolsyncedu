import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Eye, EyeOff, LogIn, Loader2, GraduationCap } from 'lucide-react';

export default function StudentLogin() {
  const { signIn, error } = useAuth();
  const navigate = useNavigate();
  const [regNumber, setRegNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const displayError = localError || error;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const trimmed = regNumber.trim().toUpperCase();
    if (!trimmed || !password.trim()) {
      setLocalError('Please enter your registration number and password');
      return;
    }

    setSubmitting(true);
    try {
      // Use SECURITY DEFINER RPC — works without auth, bypasses RLS on students table
      const { data: lookup, error: lookupErr } = await supabase
        .rpc('lookup_student_login', { p_reg_number: trimmed });

      if (lookupErr) {
        setLocalError('Login service unavailable. Please try again or contact your IT administrator.');
        setSubmitting(false);
        return;
      }

      if (!lookup?.found) {
        setLocalError(
          lookup?.message ||
          'No student account found for that registration number. Visit the IT office to have your account created.'
        );
        setSubmitting(false);
        return;
      }

      // Sign in using the internal system email
      await signIn(lookup.email, password);
      navigate('/student/dashboard', { replace: true });
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center lg:text-left">
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 mb-3">
          <GraduationCap className="h-3.5 w-3.5" />
          Student Portal
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Student Sign In</h2>
        <p className="mt-2 text-sm text-slate-500">
          Use your registration number and password to access your portal
        </p>
      </div>

      {/* Error */}
      {displayError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {displayError}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Registration Number */}
        <div className="space-y-1.5">
          <label htmlFor="regNumber" className="block text-sm font-medium text-slate-700">
            Registration Number
          </label>
          <input
            id="regNumber"
            type="text"
            value={regNumber}
            onChange={(e) => setRegNumber(e.target.value)}
            placeholder="e.g. SLR-2026-0001"
            autoComplete="username"
            autoCapitalize="characters"
            required
            className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 uppercase"
          />
          <p className="text-xs text-slate-400">This is the number on your student ID card</p>
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label htmlFor="studentPassword" className="block text-sm font-medium text-slate-700">
            Password
          </label>
          <div className="relative">
            <input
              id="studentPassword"
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
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogIn className="h-4 w-4" />
          )}
          {submitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-slate-50 px-4 text-xs text-slate-400">or</span>
        </div>
      </div>

      {/* Staff login link */}
      <div className="text-center text-sm text-slate-500">
        Staff member?{' '}
        <Link
          to="/auth/login"
          className="font-medium text-primary-600 hover:text-primary-700"
        >
          Sign in with email
        </Link>
      </div>
    </div>
  );
}
