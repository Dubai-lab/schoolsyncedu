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
  /** What the device calls it, for honest button copy. */
  label: string;
}

export async function checkBiometric(): Promise<BiometricStatus> {
  if (!isCapacitorNative()) return { available: false, label: '' };

  try {
    const { NativeBiometric } = await import('@capgo/capacitor-native-biometric');
    const result = await NativeBiometric.isAvailable({ useFallback: true });
    if (!result.isAvailable) return { available: false, label: '' };

    // biometryType is an enum; map the common cases to the name the user sees
    // on their own device. Calling Face ID "biometrics" reads as generic and
    // slightly untrustworthy.
    const type = String((result as { biometryType?: unknown }).biometryType ?? '');
    const label =
      type.includes('FACE') || type === '1'
        ? 'Face ID'
        : type.includes('TOUCH') || type.includes('FINGERPRINT') || type === '3'
          ? 'fingerprint'
          : 'biometrics';

    return { available: true, label };
  } catch {
    return { available: false, label: '' };
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
