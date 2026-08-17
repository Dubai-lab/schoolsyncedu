import { Nfc, FileText, ClipboardCheck, Smartphone } from 'lucide-react';
import GridBackdrop from './GridBackdrop';

/**
 * One school day, end to end.
 *
 * The point the landing page kept asserting — that SchoolSync makes managing a
 * school easier — was only ever stated in prose. This shows it: a card tap at
 * the classroom door travelling all the way to a parent's phone, as one
 * continuous movement rather than four separate features.
 *
 * CSS animation only. No library, no JS timers, nothing to fall out of sync
 * with React, and it costs nothing on a slow connection — which matters when
 * the audience is on Liberian mobile data.
 *
 * The whole thing is decorative, so it is aria-hidden to a screen reader and
 * the steps are also written out as plain text beneath.
 */

const STEPS = [
  {
    icon: Nfc,
    title: 'Student taps in',
    desc: 'Attendance marked at the door, with or without a signal.',
  },
  {
    icon: FileText,
    title: 'Teacher enters marks',
    desc: 'Assignment, quiz and test scores for their own classes.',
  },
  {
    icon: ClipboardCheck,
    title: 'Principal approves',
    desc: 'Nothing reaches a report card until leadership signs it off.',
  },
  {
    icon: Smartphone,
    title: 'Parent sees it',
    desc: 'Grades, attendance and fees on the phone, the same day.',
  },
];

export default function SchoolDayFlow() {
  return (
    <GridBackdrop glow="amber" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-accent-500">
            One school day
          </p>
          <h2 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
            From the classroom door to the parent&apos;s phone
          </h2>
          <p className="mt-4 text-base leading-relaxed text-white/55">
            Four things that used to be four separate books, four separate people,
            and a week of chasing. Now one movement.
          </p>
        </div>

        <div className="relative mt-16">
          {/* The track the pulse runs along. Behind the nodes, and only drawn
              from lg where the steps sit in a row. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-7 hidden lg:block"
          >
            <div className="relative mx-auto h-px w-full bg-white/10">
              <span className="ssf-pulse absolute inset-y-0 block w-40 rounded-full" />
            </div>
          </div>

          <ol className="relative grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative text-center lg:text-left">
                <div
                  className="ssf-node mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.04] lg:mx-0"
                  style={{ animationDelay: `${i * 1.6}s` }}
                >
                  <s.icon className="h-6 w-6 text-white/85" />
                </div>
                <p className="mt-5 text-xs font-bold uppercase tracking-wider text-accent-500">
                  Step {i + 1}
                </p>
                <p className="mt-1 text-base font-semibold text-white">{s.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-white/50">{s.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </GridBackdrop>
  );
}
