import { Smartphone, Nfc, GraduationCap, ArrowRight } from 'lucide-react';

/**
 * Compact "the mobile apps exist" card for staff dashboards.
 *
 * Deliberately not the student download prompt — that lives on each school's
 * own public site, where students actually are. A proprietor or super admin
 * does not need a download button in their dashboard; they need to know the
 * apps exist so they can tell their staff and students about them.
 *
 * The ruled backdrop is the same .bg-grid used on dashboard headers, so this
 * reads as part of the surface rather than an advert dropped onto it.
 */
export default function AppLinksCard() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div aria-hidden className="bg-grid pointer-events-none absolute inset-0" />

      <div className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <Smartphone className="h-3.5 w-3.5" />
            Mobile apps
          </p>
          <h3 className="mt-1.5 text-sm font-bold text-slate-900">
            SchoolSync is available on iOS and Android
          </h3>
          <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-500">
            Students get their grades, attendance, fees and ID card on their phone.
            Teachers take attendance by tapping NFC cards.
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-2">
          {[
            {
              icon: GraduationCap,
              name: 'SchoolSync',
              who: 'For students',
              tone: 'bg-primary-50 text-primary-700',
            },
            {
              icon: Nfc,
              name: 'SchoolSync Attend',
              who: 'For teaching staff',
              tone: 'bg-emerald-50 text-emerald-700',
            },
          ].map((a) => (
            <div key={a.name} className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <span className={`flex h-7 w-7 items-center justify-center rounded-md ${a.tone}`}>
                <a.icon className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-slate-800">{a.name}</span>
                <span className="block text-[10px] text-slate-400">{a.who}</span>
              </span>
            </div>
          ))}

          <p className="flex items-center gap-1 text-[10px] text-slate-400">
            <ArrowRight className="h-3 w-3" />
            Download links appear on your school website
          </p>
        </div>
      </div>
    </div>
  );
}
