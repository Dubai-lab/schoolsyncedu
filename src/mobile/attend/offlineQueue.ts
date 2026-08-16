/**
 * Offline queue for attendance taps.
 *
 * You made offline a hard requirement, and attendance is where it bites: a
 * teacher marking forty students on a school network that drops halfway
 * through must not lose the roll.
 *
 * Design rests on one fact already true in the schema — markAttendance upserts
 * with onConflict 'student_id,attendance_date,subject_id' (migration 067's
 * unique index). Replaying the same tap is therefore harmless, which means the
 * queue can retry freely without inventing dedupe logic or risking double
 * marks. Flushing a batch twice produces the same rows.
 *
 * Storage is localStorage rather than IndexedDB: a class roll is tens of
 * records, not thousands, and localStorage is synchronous. That matters when
 * the app is backgrounded mid-session — an async write can be cut off before
 * it lands, and a lost tap is exactly what this exists to prevent.
 */

const QUEUE_KEY = 'schoolsync.attend.queue.v1';
const ROSTER_KEY = 'schoolsync.attend.roster.v1';

export interface QueuedTap {
  /** Client-side id so the UI can reconcile before a server round trip. */
  id: string;
  schoolId: string;
  classId: string;
  subjectId: string | null;
  /** YYYY-MM-DD. Captured at tap time, not sync time — a session that spans
   *  midnight, or syncs the next morning, must still record the right day. */
  date: string;
  studentId: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  tappedAt: string;
  markedBy: string;
}

/** A roster cached at session start so scanning works with no network. */
export interface CachedRoster {
  classId: string;
  subjectId: string | null;
  cachedAt: string;
  students: Array<{
    studentId: string;
    firstName: string;
    lastName: string;
    registrationNumber: string;
    /** nfc_chip_id, so a tap resolves to a student entirely offline. */
    chipId: string | null;
  }>;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    // Corrupt or unavailable storage must not take the app down mid-class.
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded or private-mode storage. The caller keeps its in-memory
    // copy, so the current session still works — only persistence is lost.
  }
}

// ── Queue ────────────────────────────────────────────────────────────────────

export function getQueue(): QueuedTap[] {
  return readJson<QueuedTap[]>(QUEUE_KEY, []);
}

export function enqueueTap(tap: QueuedTap): void {
  const queue = getQueue();
  // Same student, same subject, same day is the same fact. Replace rather than
  // append so a double tap doesn't inflate the queue.
  const filtered = queue.filter(
    (q) =>
      !(
        q.studentId === tap.studentId &&
        q.subjectId === tap.subjectId &&
        q.date === tap.date
      ),
  );
  writeJson(QUEUE_KEY, [...filtered, tap]);
}

export function queueSize(): number {
  return getQueue().length;
}

/** Drop taps confirmed as written to the server. */
export function removeFromQueue(ids: string[]): void {
  const drop = new Set(ids);
  writeJson(
    QUEUE_KEY,
    getQueue().filter((q) => !drop.has(q.id)),
  );
}

export function clearQueue(): void {
  writeJson(QUEUE_KEY, []);
}

// ── Roster cache ─────────────────────────────────────────────────────────────

export function cacheRoster(roster: CachedRoster): void {
  writeJson(ROSTER_KEY, roster);
}

export function getCachedRoster(): CachedRoster | null {
  return readJson<CachedRoster | null>(ROSTER_KEY, null);
}

/**
 * Resolve a tapped chip to a student using only the cached roster.
 * Returns null when the chip is not in this class — which is itself useful:
 * it means a student from another class tapped, and the UI should say so.
 */
export function resolveChipOffline(
  chipId: string,
): CachedRoster['students'][number] | null {
  const roster = getCachedRoster();
  if (!roster) return null;
  return roster.students.find((s) => s.chipId === chipId) ?? null;
}

// ── Connectivity ─────────────────────────────────────────────────────────────

export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

/**
 * Subscribe to connectivity changes. navigator.onLine only reports whether a
 * network interface exists, not whether Supabase is reachable — a school WiFi
 * with no upstream still reads as "online". Callers should treat this as a
 * hint to attempt a flush, and rely on the flush itself failing gracefully.
 */
export function onConnectivityChange(handler: (online: boolean) => void): () => void {
  const goOnline = () => handler(true);
  const goOffline = () => handler(false);
  window.addEventListener('online', goOnline);
  window.addEventListener('offline', goOffline);
  return () => {
    window.removeEventListener('online', goOnline);
    window.removeEventListener('offline', goOffline);
  };
}
