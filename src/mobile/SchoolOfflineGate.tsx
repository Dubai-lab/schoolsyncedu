import { useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { WifiOff } from 'lucide-react';

/**
 * Blocks a signed-in user whose school has been suspended.
 *
 * The school-code screens are already handled on the server: lookup_student_login
 * and verify_kiosk_access refuse an offline school before they hand anything
 * back (migration 234). This covers the two cases they cannot:
 *
 *   1. Attend's teacher and card-admin sign-in, which is email and password
 *      only — the school is not known until there is a session.
 *   2. Sessions that already exist. Both apps keep people signed in, so a
 *      device that signed in last week would otherwise keep working straight
 *      through a suspension until someone signed out.
 *
 * Checked on mount and whenever the app returns to the foreground, rather than
 * on a timer: a kiosk left on a desk all day is exactly the device that would
 * miss a suspension, and it is also the one that gets picked up and looked at.
 *
 * Fails open. If the check itself cannot complete — no signal, RPC missing
 * because 234 has not run — the app carries on. A school that is paid up must
 * never be locked out of attendance by a network blip, and the school-code
 * screens still enforce the rule on the server regardless.
 */

type Access = { online: boolean; school_name?: string };

export default function SchoolOfflineGate({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [access, setAccess] = useState<Access | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setAccess(null);
      return;
    }

    let cancelled = false;

    async function check() {
      try {
        const { data, error } = await supabase.rpc('my_school_access');
        if (error) throw error;
        if (!cancelled) setAccess(data as Access);
      } catch {
        // Fails open — see the note above.
        if (!cancelled) setAccess({ online: true });
      }
    }

    check();

    function onVisible() {
      if (document.visibilityState === 'visible') check();
    }
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isAuthenticated]);

  if (access && access.online === false) {
    return <OfflineNotice schoolName={access.school_name} />;
  }

  return <>{children}</>;
}

function OfflineNotice({ schoolName }: { schoolName?: string }) {
  const { signOut } = useAuth();

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-slate-900 px-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/15">
        <WifiOff className="h-8 w-8 text-amber-400" />
      </div>

      <h1 className="text-lg font-semibold text-white">
        {schoolName ?? 'This school'} is currently offline
      </h1>

      {/* Says nothing about payment. The person holding the phone is a student
          or a teacher, not the person who owes anything, and their school's
          billing status is not theirs to be told. */}
      <p className="max-w-xs text-sm leading-relaxed text-slate-400">
        Your school&rsquo;s access to SchoolSync has been suspended, so this app is
        unavailable for now. Please contact your school administration.
      </p>

      <p className="max-w-xs text-xs text-slate-500">
        Nothing has been lost — records and attendance are safe and return as soon
        as the school is active again.
      </p>

      <button
        onClick={() => signOut()}
        className="mt-2 rounded-lg bg-white/10 px-5 py-2.5 text-sm font-semibold text-white"
      >
        Sign out
      </button>
    </div>
  );
}
