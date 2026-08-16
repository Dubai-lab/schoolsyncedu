import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * Live attendance updates for the web portal.
 *
 * When a teacher taps cards in SchoolSync Attend, the rows land in
 * attendance_records. Without this, the office PC only sees them after a
 * manual refresh. Subscribing means the roll fills in as it happens.
 *
 * Follows the same postgres_changes pattern already used in
 * NotificationBell.tsx, so Realtime needs no new configuration — beyond the
 * table being in the publication (see the note below).
 *
 * Rather than merging payloads into local state, this invalidates the query
 * and lets React Query refetch. Attendance rows arrive from three different
 * paths — the mobile app, this page, and bulk marking — and a refetch keeps
 * one source of truth instead of three partial reducers that can disagree.
 *
 * @param classId    Class to watch. Falsy disables the subscription.
 * @param queryKey   React Query key to invalidate when a row changes.
 */
export function useLiveAttendance(classId: string | undefined, queryKey: string[]) {
  const qc = useQueryClient();
  // Join on the value, not the array identity — callers build the key inline
  // and would otherwise resubscribe on every render.
  const keyId = queryKey.join('|');

  useEffect(() => {
    if (!classId) return;

    const channel = supabase
      .channel(`attendance-live-${classId}`)
      .on(
        'postgres_changes',
        {
          // Taps are upserts: a first scan INSERTs, a re-scan UPDATEs. Watching
          // '*' catches both, plus any correction made elsewhere.
          event: '*',
          schema: 'public',
          table: 'attendance_records',
          filter: `class_id=eq.${classId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: keyId.split('|'), refetchType: 'active' });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [classId, keyId, qc]);
}
