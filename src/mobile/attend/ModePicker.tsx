import { useNavigate } from 'react-router-dom';
import GridBackdrop from '@/components/shared/GridBackdrop';
import { ClipboardCheck, ShieldCheck, ChevronRight, Nfc, CreditCard } from 'lucide-react';

/**
 * Launch screen for SchoolSync Attend.
 *
 * The app does two jobs that share a card reader but nothing else — including
 * how they authenticate:
 *
 *   Class attendance — signs in as the teacher. Attendance records who marked
 *     them, and the class and subject list is scoped to that teacher, so the
 *     app needs a real identity.
 *
 *   Exam clearance — signs in with a school code and the finance PIN. This
 *     runs on a shared device at an exam hall door; whoever is holding it is
 *     not the point, and making examiners share a staff password would be
 *     worse security, not better.
 *
 * Presenting the choice up front is what keeps those two models from leaking
 * into each other.
 */
export default function ModePicker() {
  const navigate = useNavigate();

  return (
    <GridBackdrop glow="emerald" className="flex min-h-[100dvh] flex-col px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(4rem,env(safe-area-inset-top))]">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 shadow-lg shadow-black/30">
            <Nfc className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">SchoolSync Attend</h1>
          <p className="mt-1.5 text-sm text-white/50">Tap student cards to record attendance</p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => navigate('/teacher/login')}
            className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.055] p-5 text-left backdrop-blur-sm active:bg-white/[0.09]"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
              <ClipboardCheck className="h-5 w-5 text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-white">Class attendance</p>
              <p className="mt-0.5 text-xs leading-relaxed text-white/45">
                Sign in with your teacher account
              </p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-white/25" />
          </button>

          <button
            onClick={() => navigate('/kiosk')}
            className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.055] p-5 text-left backdrop-blur-sm active:bg-white/[0.09]"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15">
              <ShieldCheck className="h-5 w-5 text-amber-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-white">Exam clearance</p>
              <p className="mt-0.5 text-xs leading-relaxed text-white/45">
                School code and finance PIN
              </p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-white/25" />
          </button>

          <button
            onClick={() => navigate('/assign/login')}
            className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.055] p-5 text-left backdrop-blur-sm active:bg-white/[0.09]"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-500/15">
              <CreditCard className="h-5 w-5 text-sky-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-white">Assign cards</p>
              <p className="mt-0.5 text-xs leading-relaxed text-white/45">
                Pair a printed card with its chip
              </p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-white/25" />
          </button>
        </div>

        <p className="mt-auto pt-10 text-center text-xs text-white/30">
          Works at any school on SchoolSync
        </p>
      </div>
    </GridBackdrop>
  );
}
