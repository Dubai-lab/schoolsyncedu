import type { ReactNode } from 'react';
import { LogOut } from 'lucide-react';

/**
 * Shared top bar for the dark scanning screens — exam clearance, class
 * attendance and card assignment.
 *
 * Exists because those three drifted apart: two had a "Back" link, one had a
 * bare logout icon, and none reserved space for the status bar. Inside a
 * fullscreen app the icon ended up underneath the battery indicator, where it
 * could be seen but not reliably tapped.
 *
 * Two rules it enforces:
 *
 *   Safe area. pt uses max(0.75rem, env(safe-area-inset-top)) so content
 *   clears the notch and status bar on a phone, while collapsing to ordinary
 *   padding in a browser where the inset is 0.
 *
 *   Sign out, not back. Every one of these screens is entered by
 *   authenticating — a teacher account, an admin account, or a school PIN — so
 *   the way out is to end that session. "Back" implied the session survived,
 *   which on a shared exam-hall phone is the wrong default.
 *
 * Lives in components/shared rather than mobile/attend because KioskScanner is
 * a web page too, and pages must not import from the mobile app folders.
 */

interface ScannerHeaderProps {
  title: string;
  subtitle?: string;
  /** Status chips or extra actions, shown left of the sign-out button. */
  children?: ReactNode;
  onSignOut: () => void;
  /** "Sign out" for staff accounts; "Exit" reads better for a shared kiosk. */
  signOutLabel?: string;
}

export default function ScannerHeader({
  title, subtitle, children, onSignOut, signOutLabel = 'Sign out',
}: ScannerHeaderProps) {
  return (
    <header
      className="sticky top-0 z-30 border-b border-slate-700 bg-slate-800"
      style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
    >
      <div className="flex items-center gap-3 px-4 pb-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white">{title}</p>
          {subtitle && (
            <p className="truncate text-xs text-slate-400">{subtitle}</p>
          )}
        </div>

        {children && (
          <div className="flex shrink-0 items-center gap-2">{children}</div>
        )}

        {/* Always labelled, at every width. An unlabelled icon among other
            unlabelled icons is a guess, and this is the one control that ends
            someone's session. The title truncates instead, so the label never
            has to be sacrificed for space. min-h-11 keeps it above the 44px
            touch target both platforms recommend. */}
        <button
          onClick={onSignOut}
          className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg bg-slate-700 px-3 text-xs font-semibold text-slate-200 active:bg-slate-600"
        >
          <LogOut className="h-4 w-4" />
          <span>{signOutLabel}</span>
        </button>
      </div>
    </header>
  );
}
