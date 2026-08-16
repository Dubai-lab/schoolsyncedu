import { Smartphone, Nfc, GraduationCap, Apple, Play, Check } from 'lucide-react';
import GridBackdrop from './GridBackdrop';

/**
 * 3D showcase of the two SchoolSync mobile apps.
 *
 * The phones are built from CSS rather than screenshots: real perspective and
 * rotateY on a shared 3D context, with the app interfaces drawn inside. That
 * keeps them sharp at every density, themeable when a school's brand colour
 * applies, and adds nothing to the page weight — three screenshots at retina
 * resolution would cost more than this entire component.
 *
 * `variant` controls where it sits:
 *   'marketing' — full section for the SchoolSync landing page
 *   'school'    — compact, for a school's own site, where the audience is
 *                 students and only the student app is relevant
 */

interface AppShowcaseProps {
  variant?: 'marketing' | 'school';
  schoolName?: string;
  /** Store links, once the apps are published. Absent renders "coming soon"
   *  rather than a dead link — a button that goes nowhere is worse than an
   *  honest label. */
  iosUrl?: string;
  androidUrl?: string;
}

// ── Phone frame ──────────────────────────────────────────────────────────────

function Phone({
  children, className = '', tilt = 'left',
}: {
  children: React.ReactNode;
  className?: string;
  tilt?: 'left' | 'right';
}) {
  return (
    <div
      className={`relative ${className}`}
      style={{
        transform:
          tilt === 'left'
            ? 'rotateY(18deg) rotateX(6deg) rotateZ(-2deg)'
            : 'rotateY(-14deg) rotateX(6deg) rotateZ(2deg)',
        transformStyle: 'preserve-3d',
      }}
    >
      {/* Body. The inset highlight along the top-left edge is what reads as a
          metal rail catching light — without it the frame looks like a
          rounded rectangle rather than a phone. */}
      <div
        className="relative overflow-hidden rounded-[2rem] border border-slate-700 bg-slate-900 p-2"
        style={{
          boxShadow:
            '0 50px 80px -20px rgba(15,23,42,0.45), 0 20px 30px -15px rgba(15,23,42,0.3), inset 1px 1px 0 rgba(255,255,255,0.12)',
        }}
      >
        <div className="relative overflow-hidden rounded-[1.6rem] bg-white">
          {/* Notch */}
          <div className="absolute left-1/2 top-0 z-20 h-4 w-16 -translate-x-1/2 rounded-b-xl bg-slate-900" />
          {children}
        </div>
      </div>
    </div>
  );
}

function StatusBar({ dark = false }: { dark?: boolean }) {
  const c = dark ? 'bg-white/70' : 'bg-slate-400';
  return (
    <div className="flex items-center justify-between px-4 pb-1 pt-2.5">
      <span className={`text-[9px] font-semibold ${dark ? 'text-white' : 'text-slate-700'}`}>9:41</span>
      <div className="flex items-center gap-0.5">
        <span className={`h-1.5 w-1.5 rounded-full ${c}`} />
        <span className={`h-2 w-1 rounded-sm ${c}`} />
        <span className={`h-2.5 w-3 rounded-sm ${c}`} />
      </div>
    </div>
  );
}

// ── The student app screen ───────────────────────────────────────────────────

function StudentScreen() {
  return (
    <div className="h-[340px] w-[168px] bg-white">
      <StatusBar />
      <div className="px-3 pt-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-600">
            <GraduationCap className="h-3.5 w-3.5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[8px] font-bold text-slate-800">Good morning</p>
            <p className="truncate text-[7px] text-slate-400">Grade 10 · SLR-2026-0041</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-1.5">
          {[
            { label: 'Average', value: '87%', tone: 'bg-primary-50 text-primary-700' },
            { label: 'Present', value: '96%', tone: 'bg-emerald-50 text-emerald-700' },
          ].map((s) => (
            <div key={s.label} className={`rounded-lg p-2 ${s.tone}`}>
              <p className="text-[11px] font-bold leading-none">{s.value}</p>
              <p className="mt-1 text-[6px] opacity-70">{s.label}</p>
            </div>
          ))}
        </div>

        <p className="mt-3 text-[6px] font-semibold uppercase tracking-wide text-slate-400">
          Recent grades
        </p>
        <div className="mt-1.5 space-y-1">
          {[
            ['Mathematics', 'A'],
            ['Biology', 'B+'],
            ['Literature', 'A-'],
          ].map(([subject, grade]) => (
            <div key={subject} className="flex items-center justify-between rounded-md border border-slate-100 px-2 py-1.5">
              <span className="text-[7px] font-medium text-slate-600">{subject}</span>
              <span className="text-[8px] font-bold text-primary-600">{grade}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-around border-t border-slate-100 bg-white/95 px-1 py-2">
        {['Home', 'Grades', 'Fees', 'Me'].map((t, i) => (
          <div key={t} className="flex flex-col items-center gap-0.5">
            <span className={`h-2.5 w-2.5 rounded-sm ${i === 0 ? 'bg-primary-600' : 'bg-slate-200'}`} />
            <span className={`text-[5px] ${i === 0 ? 'font-semibold text-primary-600' : 'text-slate-300'}`}>{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── The Attend app screen ────────────────────────────────────────────────────

function AttendScreen() {
  return (
    <div className="h-[340px] w-[168px] bg-slate-900">
      <StatusBar dark />
      <div className="px-3 pt-3">
        <p className="text-[8px] font-bold text-white">Grade 10 — Biology</p>
        <p className="text-[6px] text-slate-400">Attendance · today</p>

        <div className="mt-3 grid grid-cols-3 gap-1">
          {[
            { v: '28', l: 'Marked', tone: 'bg-emerald-500/15 text-emerald-300' },
            { v: '31', l: 'Class', tone: 'bg-slate-800 text-slate-300' },
            { v: '0', l: 'Unsynced', tone: 'bg-slate-800 text-slate-300' },
          ].map((s) => (
            <div key={s.l} className={`rounded-lg p-1.5 text-center ${s.tone}`}>
              <p className="text-[10px] font-bold leading-none">{s.v}</p>
              <p className="mt-0.5 text-[5px] opacity-70">{s.l}</p>
            </div>
          ))}
        </div>

        {/* Scan target */}
        <div className="mt-3 flex flex-col items-center gap-1 rounded-xl border border-dashed border-emerald-500/40 bg-emerald-500/5 py-4">
          <Nfc className="h-5 w-5 animate-pulse text-emerald-400" />
          <span className="text-[6px] font-medium text-emerald-300">Tap a student card</span>
        </div>

        <div className="mt-2.5 space-y-1">
          {['Amara Johnson', 'Joseph Kollie', 'Grace Weah'].map((n) => (
            <div key={n} className="flex items-center gap-1.5 rounded-md border border-emerald-800/50 bg-emerald-500/10 px-2 py-1">
              <Check className="h-2 w-2 shrink-0 text-emerald-400" />
              <span className="truncate text-[6px] text-white">{n}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Store buttons ────────────────────────────────────────────────────────────

function StoreButtons({ iosUrl, androidUrl, dark = false }: {
  iosUrl?: string; androidUrl?: string; dark?: boolean;
}) {
  const base =
    'flex items-center gap-2.5 rounded-xl px-4 py-2.5 transition-transform active:scale-[0.98]';
  const solid = dark
    ? 'bg-white text-slate-900 hover:bg-slate-100'
    : 'bg-slate-900 text-white hover:bg-slate-800';
  const muted = dark
    ? 'border border-white/25 text-white/60'
    : 'border border-slate-300 text-slate-400';

  const Btn = ({ url, icon: Icon, small, big }: {
    url?: string; icon: React.ElementType; small: string; big: string;
  }) =>
    url ? (
      <a href={url} target="_blank" rel="noopener noreferrer" className={`${base} ${solid}`}>
        <Icon className="h-6 w-6" />
        <span className="text-left leading-tight">
          <span className="block text-[9px] opacity-70">{small}</span>
          <span className="block text-sm font-semibold">{big}</span>
        </span>
      </a>
    ) : (
      // No link yet. An honest label beats a button that goes nowhere.
      <span className={`${base} ${muted} cursor-default`}>
        <Icon className="h-6 w-6" />
        <span className="text-left leading-tight">
          <span className="block text-[9px] opacity-70">Coming soon to</span>
          <span className="block text-sm font-semibold">{big}</span>
        </span>
      </span>
    );

  return (
    <div className="flex flex-wrap gap-3">
      <Btn url={iosUrl} icon={Apple} small="Download on the" big="App Store" />
      <Btn url={androidUrl} icon={Play} small="Get it on" big="Google Play" />
    </div>
  );
}

// ── Section ──────────────────────────────────────────────────────────────────

export default function AppShowcase({
  variant = 'marketing', schoolName, iosUrl, androidUrl,
}: AppShowcaseProps) {
  const isSchool = variant === 'school';

  // On a school's own site this sits between light sections, so it stays
  // light. On the SchoolSync landing page it shares the hero's ruled panel,
  // which is what makes the two read as one surface rather than two designs.
  const Wrapper = isSchool
    ? ({ children }: { children: React.ReactNode }) => (
        <section className="relative overflow-hidden py-14">{children}</section>
      )
    : ({ children }: { children: React.ReactNode }) => (
        <GridBackdrop glow="emerald" className="py-20 sm:py-28">{children}</GridBackdrop>
      );

  return (
    <Wrapper>
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Copy */}
          <div className={isSchool ? '' : 'text-white'}>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                isSchool
                  ? 'bg-primary-50 text-primary-700'
                  : 'bg-white/10 text-white/80'
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" />
              Mobile apps
            </span>

            <h2
              className={`mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl ${
                isSchool ? 'text-slate-900' : 'text-white'
              }`}
            >
              {isSchool
                ? 'Your school, in your pocket'
                : 'Two apps. One platform.'}
            </h2>

            <p
              className={`mt-4 max-w-md text-base leading-relaxed ${
                isSchool ? 'text-slate-600' : 'text-slate-300'
              }`}
            >
              {isSchool
                ? `Check your grades, attendance, fees and timetable from your phone. Sign in with your ${schoolName ?? 'school'} registration number.`
                : 'A student portal students actually open, and an NFC scanner that takes attendance in seconds. Both work offline.'}
            </p>

            {!isSchool && (
              <ul className="mt-6 space-y-2.5">
                {[
                  ['SchoolSync', 'Grades, attendance, fees and ID card for students'],
                  ['SchoolSync Attend', 'Tap cards for class attendance and exam clearance'],
                ].map(([name, desc]) => (
                  <li key={name} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    <span className="text-sm text-slate-300">
                      <strong className="font-semibold text-white">{name}</strong> — {desc}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-7">
              <StoreButtons iosUrl={iosUrl} androidUrl={androidUrl} dark={!isSchool} />
            </div>
          </div>

          {/* Phones. perspective lives on the parent so both children share one
              vanishing point — set per-phone they would each tilt toward their
              own centre and the pair would look unrelated. */}
          <div
            className="relative flex items-center justify-center gap-4 sm:gap-8"
            style={{ perspective: '1400px' }}
          >
            <Phone tilt="left" className="z-10">
              <StudentScreen />
            </Phone>

            {isSchool ? null : (
              <Phone tilt="right" className="-ml-6 mt-10 hidden sm:block">
                <AttendScreen />
              </Phone>
            )}
          </div>
        </div>
      </div>
    </Wrapper>
  );
}
