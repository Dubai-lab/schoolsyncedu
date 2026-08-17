import { Link, Outlet, useSearchParams } from 'react-router-dom';
import { ArrowLeft, BookOpen } from 'lucide-react';
import GridBackdrop from '@/components/shared/GridBackdrop';
import '@/styles/authDark.css';

/**
 * Platform sign-in shell.
 *
 * Was a blue gradient panel beside a white one. Both sides now sit on the
 * ruled backdrop the marketing pages use — which is what GridBackdrop was
 * written for; its own note says it exists to replace that blue gradient.
 *
 * One backdrop across the whole viewport rather than two, so the seam between
 * the halves is a hairline rather than a colour change. The forms are unchanged
 * files; authDark.css re-points the light utilities they were written with.
 */
export default function AuthLayout() {
  const [searchParams] = useSearchParams();
  const schoolSlug = searchParams.get('school');
  const backTo = schoolSlug ? `/school/${schoolSlug}` : '/';
  const backLabel = schoolSlug ? 'Back to School Site' : 'Back to Home';

  return (
    <GridBackdrop glow="amber" className="auth-dark min-h-screen">
      <div className="flex min-h-screen">
        {/* ── Left: branding ───────────────────────────────────────────────
            The blur blobs are gone with the gradient. On a ruled ground they
            softened the very grid that is now the point of the panel. */}
        <div className="relative hidden lg:flex lg:w-1/2">
          {/* Seam. The two halves share a backdrop, so this hairline is what
              separates them — a colour change would undo the whole idea. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-px"
            style={{
              background:
                'linear-gradient(to bottom, transparent, rgba(255,255,255,0.14) 20%, rgba(255,255,255,0.14) 80%, transparent)',
            }}
          />

          <div className="relative z-10 flex w-full flex-col justify-between p-12 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/10">
                <BookOpen className="h-6 w-6" />
              </div>
              <span className="text-2xl font-bold tracking-tight">SchoolSync</span>
            </div>

            <div className="max-w-lg space-y-8">
              <h1 className="text-4xl font-bold leading-tight xl:text-5xl">
                Transform School
                <br />
                Management in
                <br />
                <span className="text-accent-500">Liberia</span>
              </h1>
              <p className="text-lg leading-relaxed text-white/60">
                A unified platform for enrollment, grades, attendance, fees,
                communication, and more — designed for Liberian schools.
              </p>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Multi-Tenant', desc: 'One platform, many schools' },
                  { label: 'NFC Cards', desc: 'Smart ID & attendance' },
                  { label: 'Real-time', desc: 'Live dashboards & data' },
                  { label: 'Secure', desc: 'Role-based access control' },
                ].map((f) => (
                  <div
                    key={f.label}
                    className="rounded-xl border border-white/10 bg-white/[0.04] p-4"
                  >
                    <p className="text-sm font-semibold">{f.label}</p>
                    <p className="mt-1 text-xs text-white/45">{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-sm text-white/35">
              &copy; {new Date().getFullYear()} EduLiberia &middot; SchoolSync v4.0
            </p>
          </div>
        </div>

        {/* ── Right: the form ─────────────────────────────────────────────── */}
        <div className="relative flex w-full flex-col items-center justify-center px-6 py-12 lg:w-1/2">
          <Link
            to={backTo}
            className="absolute left-6 top-6 flex items-center gap-1.5 text-sm font-medium text-white/55 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>

          {/* Shown only where the branding panel is not — below lg. */}
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white">
              <BookOpen className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold text-white">SchoolSync</span>
          </div>

          {/* A panel, not a white card: enough lift to hold the form together
              against the ruling without punching a bright hole in it. */}
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl backdrop-blur-sm sm:p-10">
            <Outlet />
          </div>
        </div>
      </div>
    </GridBackdrop>
  );
}
