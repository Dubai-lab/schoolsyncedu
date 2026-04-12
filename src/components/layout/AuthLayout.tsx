import { Link, Outlet, useSearchParams } from 'react-router-dom';
import { ArrowLeft, BookOpen } from 'lucide-react';

export default function AuthLayout() {
  const [searchParams] = useSearchParams();
  const schoolSlug = searchParams.get('school');
  const backTo = schoolSlug ? `/school/${schoolSlug}` : '/';
  const backLabel = schoolSlug ? 'Back to School Site' : 'Back to Home';

  return (
    <div className="flex min-h-screen">
      {/* Left panel — Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary-900 via-primary-700 to-primary-600">
        {/* Animated background shapes */}
        <div className="absolute inset-0">
          <div className="absolute -top-20 -left-20 h-80 w-80 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute bottom-10 right-10 h-96 w-96 rounded-full bg-accent-500/10 blur-3xl" />
          <div className="absolute top-1/2 left-1/3 h-64 w-64 rounded-full bg-primary-500/20 blur-2xl" />
          {/* Grid pattern overlay */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }}
          />
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
              <BookOpen className="h-6 w-6" />
            </div>
            <span className="text-2xl font-bold tracking-tight">SchoolSync</span>
          </div>

          {/* Hero content */}
          <div className="space-y-8 max-w-lg">
            <h1 className="text-4xl font-bold leading-tight xl:text-5xl">
              Transform School
              <br />
              Management in
              <br />
              <span className="text-accent-500">Liberia</span>
            </h1>
            <p className="text-lg text-white/70 leading-relaxed">
              A unified platform for enrollment, grades, attendance, fees,
              communication, and more — designed for Liberian schools.
            </p>

            {/* Feature cards */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Multi-Tenant', desc: 'One platform, many schools' },
                { label: 'NFC Cards', desc: 'Smart ID & attendance' },
                { label: 'Real-time', desc: 'Live dashboards & data' },
                { label: 'Secure', desc: 'Role-based access control' },
              ].map((f) => (
                <div
                  key={f.label}
                  className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
                >
                  <p className="font-semibold text-sm">{f.label}</p>
                  <p className="text-xs text-white/50 mt-1">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <p className="text-sm text-white/40">
            &copy; {new Date().getFullYear()} EduLiberia &middot; SchoolSync v4.0
          </p>
        </div>
      </div>

      {/* Right panel — Auth form */}
      <div className="flex w-full flex-col items-center justify-center bg-slate-50 px-6 py-12 lg:w-1/2 relative">
        {/* Back to home / school site */}
        <Link
          to={backTo}
          className="absolute top-6 left-6 flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-primary-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>

        {/* Mobile logo */}
        <div className="mb-8 flex items-center gap-2 lg:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600 text-white">
            <BookOpen className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold text-slate-900">SchoolSync</span>
        </div>

        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </div>
    </div>
  );
}