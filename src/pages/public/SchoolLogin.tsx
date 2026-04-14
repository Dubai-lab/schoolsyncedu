import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { schoolSiteService } from '@/services/schoolSiteService';
import { getHomePath } from '@/middleware/requireAuth';
import type { School, SiteConfig, AuthPageConfig } from '@/types/school.types';
import {
  Eye,
  EyeOff,
  LogIn,
  Loader2,
  GraduationCap,
  ArrowLeft,
  AlertCircle,
  Megaphone,
  WifiOff,
} from 'lucide-react';

export default function SchoolLogin() {
  const { slug } = useParams<{ slug: string }>();
  const { signIn, signOut, error, isAuthenticated, isLoading, user } = useAuth();
  const navigate = useNavigate();

  const [school, setSchool] = useState<School | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [loginMode, setLoginMode] = useState<'email' | 'registration'>('email');
  const [email, setEmail] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  // Track whether the user actively submitted the login form (vs page load)
  const [justSignedIn, setJustSignedIn] = useState(false);

  const displayError = localError || error;
  const loading = submitting || (isLoading && submitting);

  // Load school data
  useEffect(() => {
    if (!slug) return;
    setPageLoading(true);
    schoolSiteService
      .getBySlug(slug)
      .then((data) => {
        if (!data) setNotFound(true);
        else setSchool(data as School);
      })
      .catch(() => setNotFound(true))
      .finally(() => setPageLoading(false));
  }, [slug]);

  // Only navigate after a fresh sign-in (not on page load with stale session)
  useEffect(() => {
    if (isAuthenticated && user && justSignedIn) {
      // Proprietors and super admins must use the platform login, not the school portal
      if (user.role === 'super_admin' || user.role === 'proprietor') {
        signOut().then(() => {
          setLocalError(
            'Platform administrators must sign in at the SchoolSync platform login page, not the school portal.'
          );
          setJustSignedIn(false);
          setSubmitting(false);
        });
        return;
      }
      navigate(getHomePath(user.role ?? ''), { replace: true });
    }
  }, [isAuthenticated, user, navigate, justSignedIn, signOut]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (loginMode === 'registration') {
      const trimmed = regNumber.trim().toUpperCase();
      if (!trimmed || !password.trim()) {
        setLocalError('Please enter your registration number and password');
        return;
      }
      setSubmitting(true);
      setJustSignedIn(true);
      try {
        const { data: lookup, error: lookupErr } = await supabase
          .rpc('lookup_student_login', { p_reg_number: trimmed });

        if (lookupErr) {
          setLocalError('Login service unavailable. Please try again or contact your IT administrator.');
          setSubmitting(false);
          setJustSignedIn(false);
          return;
        }
        if (!lookup?.found) {
          setLocalError(
            lookup?.message ||
            'No student account found for that registration number. Visit the IT office to have your account created.'
          );
          setSubmitting(false);
          setJustSignedIn(false);
          return;
        }
        await signIn(lookup.email, password);
      } catch {
        setSubmitting(false);
        setJustSignedIn(false);
      }
      return;
    }

    // Email mode
    if (!email.trim() || !password.trim()) {
      setLocalError('Please enter your email and password');
      return;
    }
    setSubmitting(true);
    setJustSignedIn(true);
    try {
      await signIn(email.trim(), password);
    } catch {
      setSubmitting(false);
      setJustSignedIn(false);
    }
  };

  const switchMode = (mode: 'email' | 'registration') => {
    setLoginMode(mode);
    setLocalError(null);
    setPassword('');
    setShowPassword(false);
  };

  // ── Loading state ──
  if (pageLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  // ── Not found ──
  if (notFound || !school) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4">
        <GraduationCap className="mb-4 h-16 w-16 text-gray-300" />
        <h1 className="text-2xl font-bold text-gray-900">School Not Found</h1>
        <p className="mt-2 text-gray-500">The school you're looking for doesn't exist or hasn't published their site yet.</p>
        <Link to="/auth/login" className="mt-6 text-blue-600 underline hover:text-blue-800">Go to SchoolSync Login</Link>
      </div>
    );
  }

  // ── School is offline (subscription suspended/expired) ──
  if (!school.is_online) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
        <div className="mx-auto max-w-sm text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100">
            <WifiOff className="h-10 w-10 text-amber-600" />
          </div>
          {school.logo_url && (
            <img src={school.logo_url} alt={school.name} className="mx-auto mb-3 h-12 w-12 rounded-lg object-cover" />
          )}
          <h1 className="text-xl font-bold text-slate-900">{school.name}</h1>
          <h2 className="mt-3 text-lg font-semibold text-amber-700">Portal Temporarily Offline</h2>
          <p className="mt-3 text-sm text-slate-500 leading-relaxed">
            This school's portal is currently unavailable. This usually happens when a subscription payment is overdue.
            Please contact your school administration to resolve the issue.
          </p>
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-left text-sm text-amber-800">
            <p className="font-medium mb-1">For school administrators:</p>
            <p>Contact SchoolSync support to renew your subscription or request a grace period.</p>
          </div>
          <Link
            to={`/school/${slug}`}
            className="mt-6 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" /> Back to school site
          </Link>
        </div>
      </div>
    );
  }

  const primary = school.primary_color || '#1e40af';
  const secondary = school.secondary_color || '#f59e0b';
  const cfg: SiteConfig = school.site_config ?? {};
  const auth: AuthPageConfig = cfg.auth_page ?? {};

  const heading = auth.welcome_heading || `Welcome to ${school.name}`;
  const subtext = auth.welcome_subtext || 'Sign in to access your school portal';
  const accentColor = auth.accent_color || primary;
  const bgColor = auth.background_color || primary;
  const showStudentLogin = auth.show_student_login !== false;
  const showForgot = auth.show_forgot_password !== false;
  const features = auth.features?.length
    ? auth.features
    : [
        { label: 'Grades & Reports', description: 'View academic performance' },
        { label: 'Attendance', description: 'Track daily attendance' },
        { label: 'Fees & Payments', description: 'Manage school fees' },
        { label: 'Communication', description: 'Stay connected with school' },
      ];

  return (
    <div className="flex min-h-screen">
      {/* ===== LEFT PANEL — School Branding ===== */}
      <div
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden"
        style={{
          background: auth.background_image_url
            ? `url(${auth.background_image_url}) center/cover no-repeat`
            : `linear-gradient(135deg, ${bgColor} 0%, ${bgColor}cc 50%, ${bgColor}99 100%)`,
        }}
      >
        {/* Overlay for readability when using background image */}
        {auth.background_image_url && (
          <div className="absolute inset-0 bg-black/50" />
        )}

        {/* Decorative shapes (shown when no background image) */}
        {!auth.background_image_url && (
          <div className="absolute inset-0">
            <div className="absolute -top-20 -left-20 h-80 w-80 rounded-full bg-white/5 blur-3xl" />
            <div className="absolute bottom-10 right-10 h-96 w-96 rounded-full bg-white/5 blur-3xl" />
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
                backgroundSize: '60px 60px',
              }}
            />
          </div>
        )}

        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          {/* School logo & name */}
          <div className="flex items-center gap-3">
            {school.logo_url ? (
              <img src={school.logo_url} alt={school.name} className="h-12 w-12 rounded-xl object-cover shadow-lg" />
            ) : (
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm"
                style={{ borderColor: secondary, borderWidth: 2 }}
              >
                <GraduationCap className="h-6 w-6" />
              </div>
            )}
            <div>
              <span className="text-xl font-bold tracking-tight">{school.name}</span>
              {school.motto && <p className="text-xs text-white/60">{school.motto}</p>}
            </div>
          </div>

          {/* Hero content */}
          <div className="space-y-8 max-w-lg">
            <h1 className="text-4xl font-bold leading-tight xl:text-5xl">
              {heading}
            </h1>
            {subtext && (
              <p className="text-lg text-white/70 leading-relaxed">{subtext}</p>
            )}

            {/* Feature cards */}
            <div className="grid grid-cols-2 gap-4">
              {features.slice(0, 4).map((f) => (
                <div
                  key={f.label}
                  className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
                >
                  <p className="font-semibold text-sm">{f.label}</p>
                  <p className="text-xs text-white/50 mt-1">{f.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <p className="text-sm text-white/40">
            {auth.footer_text || `© ${new Date().getFullYear()} ${school.name}`}
          </p>
        </div>
      </div>

      {/* ===== RIGHT PANEL — Login Form ===== */}
      <div className="flex w-full flex-col items-center justify-center bg-slate-50 px-6 py-12 lg:w-1/2 relative">
        {/* Back to school site */}
        <Link
          to={`/school/${slug}`}
          className="absolute top-6 left-6 flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to School Site
        </Link>

        {/* Mobile logo */}
        <div className="mb-8 flex items-center gap-3 lg:hidden">
          {school.logo_url ? (
            <img src={school.logo_url} alt={school.name} className="h-10 w-10 rounded-lg object-cover" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg text-white" style={{ backgroundColor: primary }}>
              <GraduationCap className="h-5 w-5" />
            </div>
          )}
          <span className="text-xl font-bold text-slate-900">{school.name}</span>
        </div>

        <div className="w-full max-w-md">
          {/* Heading */}
          <div className="text-center lg:text-left mb-8">
            <h2 className="text-2xl font-bold text-slate-900">{heading}</h2>
            <p className="mt-2 text-sm text-slate-500">{subtext}</p>
          </div>

          {/* Announcement banner */}
          {auth.announcement && (
            <div
              className="mb-6 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm"
              style={{
                borderColor: accentColor + '40',
                backgroundColor: accentColor + '08',
                color: accentColor,
              }}
            >
              <Megaphone className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{auth.announcement}</span>
            </div>
          )}

          {/* Already logged in */}
          {isAuthenticated && user && (
            <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-4 text-sm text-blue-800">
              <p className="font-medium">You are signed in as {user.full_name || user.email} ({user.role?.replace(/_/g, ' ')})</p>
              <div className="mt-3 flex gap-3">
                <button
                  onClick={() => {
                      navigate(getHomePath(user.role ?? ''));
                  }}
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                  style={{ backgroundColor: accentColor }}
                >
                  Go to Dashboard
                </button>
                <button
                  onClick={() => signOut()}
                  className="rounded-md border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
                >
                  Sign Out
                </button>
              </div>
            </div>
          )}

          {/* Error */}
          {displayError && (
            <div className="mb-6 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{displayError}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email field (email mode) */}
            {loginMode === 'email' && (
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
                  className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0"
                  style={{ '--tw-ring-color': accentColor + '40' } as React.CSSProperties}
                />
              </div>
            )}

            {/* Registration number field (registration mode) */}
            {loginMode === 'registration' && (
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
                  className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 uppercase"
                  style={{ '--tw-ring-color': accentColor + '40' } as React.CSSProperties}
                />
                <p className="text-xs text-slate-400">This is the number on your student ID card</p>
              </div>
            )}

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                  Password
                </label>
                {showForgot && (
                  <Link
                    to="/auth/forgot-password"
                    className="text-xs font-medium hover:opacity-80"
                    style={{ color: accentColor }}
                  >
                    Forgot password?
                  </Link>
                )}
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
                  className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 pr-11 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0"
                  style={{ '--tw-ring-color': accentColor + '40' } as React.CSSProperties}
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
              className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundColor: accentColor, '--tw-ring-color': accentColor + '40' } as React.CSSProperties}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="h-4 w-4" />
              )}
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          {/* Toggle between email and registration number login */}
          {showStudentLogin && (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-slate-50 px-4 text-xs text-slate-400">or</span>
                </div>
              </div>
              <div className="text-center text-sm text-slate-500">
                {loginMode === 'email' ? (
                  <>
                    Student?{' '}
                    <button
                      type="button"
                      onClick={() => switchMode('registration')}
                      className="font-medium hover:opacity-80"
                      style={{ color: accentColor }}
                    >
                      Sign in with registration number
                    </button>
                  </>
                ) : (
                  <>
                    Staff?{' '}
                    <button
                      type="button"
                      onClick={() => switchMode('email')}
                      className="font-medium hover:opacity-80"
                      style={{ color: accentColor }}
                    >
                      Sign in with email
                    </button>
                  </>
                )}
              </div>
            </>
          )}

          {/* Powered by */}
          <p className="mt-8 text-center text-xs text-slate-400">
            Powered by{' '}
            <Link to="/" className="font-medium text-slate-500 hover:text-slate-700">SchoolSync</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
