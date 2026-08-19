import { useEffect, useState, type ComponentType } from 'react';
import GridBackdrop from '@/components/shared/GridBackdrop';

/**
 * Opening screen for both mobile apps.
 *
 * An overlay rather than a route: the app behind it mounts, resolves its
 * session and reads cached branding while this is still on screen, so the
 * login it reveals is already settled instead of flashing through a spinner.
 * That is the whole reason it exists — not decoration, but somewhere for the
 * first 1.3 seconds of work to happen out of sight.
 *
 * It dismisses itself and never returns, so no caller has to manage it. Under
 * prefers-reduced-motion it holds briefly and cuts, rather than scaling and
 * fading.
 */

interface MobileSplashProps {
  appName: string;
  tagline: string;
  icon: ComponentType<{ className?: string }>;
  /** Matches the accent the app's own screens use. */
  accent: 'amber' | 'emerald';
}

const ACCENT = {
  amber:   { chip: 'bg-amber-500',   text: 'text-amber-300/70',   glow: 'amber'   as const },
  emerald: { chip: 'bg-emerald-500', text: 'text-emerald-300/70', glow: 'emerald' as const },
};

export default function MobileSplash({ appName, tagline, icon: Icon, accent }: MobileSplashProps) {
  const [phase, setPhase] = useState<'in' | 'out' | 'gone'>('in');
  const tone = ACCENT[accent];

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const hold = reduced ? 600 : 1300;
    const fade = reduced ? 0 : 450;

    const toOut  = setTimeout(() => setPhase('out'), hold);
    const toGone = setTimeout(() => setPhase('gone'), hold + fade);
    return () => { clearTimeout(toOut); clearTimeout(toGone); };
  }, []);

  if (phase === 'gone') return null;

  return (
    <div
      // aria-hidden: it is decorative and self-dismissing, and a screen reader
      // announcing it would only delay reaching the sign-in form behind it.
      aria-hidden
      className={`fixed inset-0 z-[100] transition-opacity duration-[450ms] ease-out ${
        phase === 'out' ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <GridBackdrop glow={tone.glow} className="flex h-full w-full flex-col items-center justify-center">
        <div className="relative flex flex-col items-center px-8 text-center">
          <div
            className={`mb-5 flex h-20 w-20 items-center justify-center rounded-[1.375rem] ${tone.chip} shadow-lg shadow-black/40 motion-safe:animate-[splash-rise_600ms_ease-out_both]`}
          >
            <Icon className="h-10 w-10 text-white" />
          </div>

          <h1 className="text-[1.6rem] font-bold tracking-tight text-white motion-safe:animate-[splash-rise_600ms_ease-out_120ms_both]">
            {appName}
          </h1>
          <p className={`mt-1.5 text-sm ${tone.text} motion-safe:animate-[splash-rise_600ms_ease-out_200ms_both]`}>
            {tagline}
          </p>
        </div>

        {/* Sits in the safe area rather than the flow, so the mark stays
            optically centred on tall and short phones alike. */}
        <p className="absolute inset-x-0 bottom-[max(2rem,env(safe-area-inset-bottom))] text-center text-[0.6875rem] tracking-wide text-white/25">
          EduLiberia · Monrovia
        </p>
      </GridBackdrop>
    </div>
  );
}
