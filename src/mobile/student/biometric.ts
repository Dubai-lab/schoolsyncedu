/**
 * Biometric app lock for the student app.
 *
 * What this is NOT: a second way to authenticate against Supabase. The session
 * is already persisted in localStorage, so a returning student is technically
 * signed in the moment the app opens. Nothing here creates or verifies a
 * Supabase session.
 *
 * What it IS: a lock screen over an existing session. Phones get shared,
 * borrowed and left on desks, and a student's grades, fees and attendance
 * should not be readable by whoever picks it up. The alternative — expiring
 * the session and demanding a registration number and password each time — is
 * exactly the friction that stops people opening an app at all.
 *
 * Web is a no-op: browsers have no equivalent, and the app runs in Safari
 * during development.
 */

const ENABLED_KEY = 'schoolsync.student.biometric.enabled';
const PROMPTED_KEY = 'schoolsync.student.biometric.prompted';

function isCapacitorNative(): boolean {
  const cap = (globalThis as Record<string, unknown>).Capacitor as
    | { isNativePlatform?: () => boolean }
    | undefined;
  return typeof cap?.isNativePlatform === 'function' && cap.isNativePlatform();
}

export interface BiometricStatus {
  /** Hardware present and enrolled, so a prompt would actually succeed. */
  available: boolean;
  /** What this device calls it — "Face ID", "fingerprint", and so on. */
  label: string;
  /** Which icon to show. A fingerprint glyph beside "Face ID" reads as a bug. */
  kind: 'face' | 'fingerprint' | 'iris' | 'passcode' | 'unknown';
}

/**
 * Name the sensor the way the platform does.
 *
 * Apple's marketing names are the words on the system prompt the student is
 * about to see, so the app should use them too — "Unlock with Face ID", not
 * "Unlock with biometrics". Android has no equivalent brand name, so it gets
 * the plain description.
 *
 * BiometryType is a numeric enum (TOUCH_ID = 1, FACE_ID = 2, FINGERPRINT = 3,
 * FACE_AUTHENTICATION = 4, IRIS = 5, MULTIPLE = 6, DEVICE_CREDENTIAL = 7).
 */
function describeBiometry(
  type: number,
  platform: string,
): { label: string; kind: BiometricStatus['kind'] } {
  switch (type) {
    case 1: return { label: 'Touch ID', kind: 'fingerprint' };
    case 2: return { label: 'Face ID', kind: 'face' };
    case 3: return { label: 'fingerprint', kind: 'fingerprint' };
    case 4: return { label: 'face unlock', kind: 'face' };
    case 5: return { label: 'iris unlock', kind: 'iris' };
    case 7: return { label: 'your screen lock', kind: 'passcode' };
    case 6:
      // Several sensors enrolled. iOS devices ship one or the other, so this
      // is effectively Android — where "biometric unlock" is the term the
      // system itself uses.
      return platform === 'ios'
        ? { label: 'Face ID', kind: 'face' }
        : { label: 'biometric unlock', kind: 'fingerprint' };
    default:
      return platform === 'ios'
        ? { label: 'Face ID', kind: 'face' }
        : { label: 'biometric unlock', kind: 'fingerprint' };
  }
}

export async function checkBiometric(): Promise<BiometricStatus> {
  if (!isCapacitorNative()) return { available: false, label: '', kind: 'unknown' };

  try {
    const { NativeBiometric } = await import('@capgo/capacitor-native-biometric');
    const result = await NativeBiometric.isAvailable({ useFallback: true });
    if (!result.isAvailable) return { available: false, label: '', kind: 'unknown' };

    const cap = (globalThis as Record<string, unknown>).Capacitor as
      | { getPlatform?: () => string }
      | undefined;
    const platform = cap?.getPlatform?.() ?? '';

    const type = Number((result as { biometryType?: unknown }).biometryType ?? 0);
    const { label, kind } = describeBiometry(type, platform);

    return { available: true, label, kind };
  } catch {
    return { available: false, label: '', kind: 'unknown' };
  }
}

/** True when the student has switched the lock on. */
export function isBiometricEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === '1';
  } catch {
    return false;
  }
}

export function setBiometricEnabled(on: boolean): void {
  try {
    localStorage.setItem(ENABLED_KEY, on ? '1' : '0');
  } catch {
    // Storage unavailable — the lock simply stays off rather than failing.
  }
}

/** Whether we've already offered to turn it on, so we ask only once. */
export function hasBeenPrompted(): boolean {
  try {
    return localStorage.getItem(PROMPTED_KEY) === '1';
  } catch {
    return true;
  }
}

export function markPrompted(): void {
  try {
    localStorage.setItem(PROMPTED_KEY, '1');
  } catch {
    /* no-op */
  }
}

/**
 * Show the system biometric prompt.
 *
 * Resolves true only on a successful verification. A rejection covers both a
 * failed match and the user dismissing the sheet — callers should treat those
 * identically and keep the app locked.
 *
 * useFallback lets the device offer its PIN or pattern, which matters for
 * students whose fingerprint stops being recognised with wet or dusty hands.
 */
export async function verifyBiometric(): Promise<boolean> {
  if (!isCapacitorNative()) return true;

  try {
    const { NativeBiometric } = await import('@capgo/capacitor-native-biometric');
    await NativeBiometric.verifyIdentity({
      reason: 'Unlock your SchoolSync portal',
      title: 'SchoolSync',
      subtitle: '',
      description: '',
      useFallback: true,
    });
    return true;
  } catch {
    return false;
  }
}
