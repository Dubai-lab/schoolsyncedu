import { supabase } from '@/lib/supabase';
import { attendanceService } from '@/services/attendanceService';
import type { QueuedTap, CachedRoster } from './offlineQueue';
import { removeFromQueue } from './offlineQueue';

/**
 * Data access for the attendance session.
 *
 * Two jobs the existing services don't cover:
 *   1. Load a roster together with each student's NFC chip id, so a tap can be
 *      resolved to a student with no network at all.
 *   2. Flush the offline queue back to Supabase.
 */

/**
 * Fetch the class roster plus chip ids in two queries.
 *
 * Deliberately not one embedded join: nfc_cards has no foreign key PostgREST
 * can traverse from class_assignments, and the existing code hits this same
 * wall (studentPortalService.getMyGrades splits its query for the same reason).
 */
export async function loadRoster(
  schoolId: string,
  classId: string,
  subjectId: string | null,
): Promise<CachedRoster> {
  const students = await attendanceService.getClassStudents(classId);

  const ids = students.map((s) => s.id);
  const chipByStudent = new Map<string, string>();

  if (ids.length > 0) {
    const { data: cards } = await supabase
      .from('nfc_cards')
      .select('student_id, nfc_chip_id')
      .eq('school_id', schoolId)
      .eq('status', 'active')
      .in('student_id', ids);

    for (const card of cards ?? []) {
      const c = card as { student_id: string; nfc_chip_id: string | null };
      if (c.nfc_chip_id) chipByStudent.set(c.student_id, c.nfc_chip_id.toUpperCase());
    }
  }

  return {
    classId,
    subjectId,
    cachedAt: new Date().toISOString(),
    students: students.map((s) => ({
      studentId: s.id,
      firstName: s.first_name,
      lastName: s.last_name,
      registrationNumber: s.registration_number,
      chipId: chipByStudent.get(s.id) ?? null,
    })),
  };
}

export interface FlushResult {
  synced: number;
  failed: number;
  error?: string;
}

/**
 * Push queued taps to Supabase.
 *
 * Grouped by class + subject + date because markAttendance takes one batch per
 * combination. Each group is upserted on
 * (student_id, attendance_date, subject_id), so re-sending a group that
 * partially landed is safe — that guarantee is what lets this retry blindly
 * rather than tracking which individual rows made it.
 */
export async function flushQueue(taps: QueuedTap[], markedBy: string): Promise<FlushResult> {
  if (taps.length === 0) return { synced: 0, failed: 0 };

  const groups = new Map<string, QueuedTap[]>();
  for (const tap of taps) {
    const key = `${tap.classId}|${tap.subjectId ?? ''}|${tap.date}`;
    const existing = groups.get(key);
    if (existing) existing.push(tap);
    else groups.set(key, [tap]);
  }

  let synced = 0;
  let failed = 0;
  let firstError: string | undefined;

  for (const group of groups.values()) {
    const { classId, subjectId, date } = group[0];
    try {
      await attendanceService.markAttendance(
        classId,
        date,
        group.map((t) => ({ studentId: t.studentId, status: t.status })),
        markedBy,
        subjectId ?? undefined,
      );
      // Only drop from the queue once the write is confirmed. A group that
      // throws stays queued and is retried on the next flush.
      removeFromQueue(group.map((t) => t.id));
      synced += group.length;
    } catch (err) {
      failed += group.length;
      firstError ??= err instanceof Error ? err.message : 'Sync failed';
    }
  }

  return { synced, failed, error: firstError };
}
