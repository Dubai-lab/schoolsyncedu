/**
 * NFC reading, abstracted away from any single platform API.
 *
 * The screens that read cards (pages/kiosk/KioskScanner.tsx and
 * pages/teacher/NfcAttendance.tsx) call `new NDEFReader()` directly. That is
 * Web NFC, which exists only in Chrome on Android — it is the specific reason
 * the kiosk cannot run on iPhone and why teachers must use a particular
 * browser. This module isolates that decision behind one interface so the
 * screens never name a platform API again.
 *
 * Three backends:
 *   web     — Web NFC (NDEFReader). Chrome on Android only.
 *   native  — a Capacitor NFC plugin. Android and iOS. NOT WIRED YET: no
 *             plugin is installed, because choosing one is a decision that
 *             needs a physical device to validate. See selectPlugin() below.
 *   none    — no NFC. Callers fall back to manual entry, which every screen
 *             must support regardless: cards get lost and chips fail.
 *
 * A tag's identity here is its UID (chip serial), uppercased with separators
 * stripped — matching how nfc_cards.nfc_chip_id is stored at encoding time.
 */

export type NfcBackend = 'web' | 'native' | 'none';

/** Stops an active scan. Safe to call more than once. */
export type StopScan = () => void;

export interface NfcCapability {
  backend: NfcBackend;
  available: boolean;
  /** Shown to the user when NFC cannot be used, so they know to type instead. */
  reason?: string;
}

function isCapacitorNative(): boolean {
  const cap = (globalThis as Record<string, unknown>).Capacitor as
    | { isNativePlatform?: () => boolean }
    | undefined;
  return typeof cap?.isNativePlatform === 'function' && cap.isNativePlatform();
}

/** Normalise a tag serial to the form stored in nfc_cards.nfc_chip_id. */
export function normaliseUid(raw: string): string {
  return raw.replace(/[:\s-]/g, '').toUpperCase();
}

export async function detectNfc(): Promise<NfcCapability> {
  if (isCapacitorNative()) {
    try {
      const { CapacitorNfc } = await import('@capgo/capacitor-nfc');
      const { supported } = await CapacitorNfc.isSupported();
      if (!supported) {
        return {
          backend: 'none',
          available: false,
          reason: 'This device has no NFC reader. Use manual entry.',
        };
      }

      // The plugin exposes no isEnabled() — hardware presence is all we can
      // check up front. An adapter switched off in Android settings surfaces
      // later, as a startScanning() rejection, which startNfcScan reports.
      return { backend: 'native', available: true };
    } catch {
      return {
        backend: 'none',
        available: false,
        reason: 'NFC is unavailable in this build. Use manual entry.',
      };
    }
  }

  if ('NDEFReader' in globalThis) {
    return { backend: 'web', available: true };
  }

  return {
    backend: 'none',
    available: false,
    reason:
      'This browser cannot read NFC. Chrome on Android supports it, or use manual entry below.',
  };
}

/**
 * Begin scanning. Resolves with a stop function once the reader is armed.
 *
 * onTag may fire many times — once per card presented. Callers are responsible
 * for de-duplicating repeat taps of the same card; both attendance and
 * clearance want different behaviour there.
 */
export async function startNfcScan(
  onTag: (uid: string) => void,
  onError: (err: Error) => void,
): Promise<StopScan> {
  const cap = await detectNfc();

  if (cap.backend === 'native') {
    return startNativeNfc(onTag, onError);
  }

  if (cap.backend === 'web') {
    return startWebNfc(onTag, onError);
  }

  throw new Error(cap.reason ?? 'NFC is not available on this device.');
}

// ── Web NFC ──────────────────────────────────────────────────────────────────

type NdefReaderLike = {
  scan: (opts: { signal: AbortSignal }) => Promise<void>;
  addEventListener: (type: string, handler: (e: unknown) => void) => void;
};

async function startWebNfc(
  onTag: (uid: string) => void,
  onError: (err: Error) => void,
): Promise<StopScan> {
  const Ctor = (globalThis as Record<string, unknown>).NDEFReader as new () => NdefReaderLike;
  const reader = new Ctor();
  const abort = new AbortController();

  // Throws if the user denies the permission prompt, which Chrome shows on
  // the first scan of a session.
  await reader.scan({ signal: abort.signal });

  reader.addEventListener('reading', (event: unknown) => {
    const { serialNumber } = event as { serialNumber?: string };
    if (serialNumber) onTag(normaliseUid(serialNumber));
  });

  reader.addEventListener('readingerror', () => {
    onError(new Error('Could not read that card. Move it closer and hold still.'));
  });

  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    abort.abort();
  };
}

// ── Native (Capacitor) ───────────────────────────────────────────────────────

/**
 * Native NFC via @capgo/capacitor-nfc.
 *
 * Two settings carry the whole design:
 *
 *   iosSessionType: 'tag'  — uses NFCTagReaderSession rather than
 *     NFCNDEFReaderSession. Our cards are identified by chip serial
 *     (nfc_cards.nfc_chip_id) and are typically raw MIFARE with no NDEF
 *     message at all, so the NDEF session would simply never see them.
 *     Requires the com.apple.developer.nfc.readersession.formats entitlement
 *     with TAG, which in turn requires a paid Apple Developer account.
 *
 *   invalidateAfterFirstRead: false — keeps one session open across many taps.
 *     This is what lets a teacher scan a whole class without re-arming the
 *     reader between students. On iOS the system scan sheet stays up for the
 *     duration, which is the platform's behaviour and not something an app
 *     can override.
 *
 * The plugin returns tag ids as a byte array; nfc_chip_id is stored as an
 * uppercase hex string, so convert before comparing.
 */
export async function startNativeNfc(
  onTag: (uid: string) => void,
  onError: (err: Error) => void,
): Promise<StopScan> {
  const { CapacitorNfc } = await import('@capgo/capacitor-nfc');

  const toHex = (bytes: number[]) =>
    bytes.map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();

  const listener = await CapacitorNfc.addListener('nfcEvent', (event: { tag?: { id?: number[] } }) => {
    const id = event.tag?.id;
    if (id && id.length > 0) onTag(toHex(id));
  });

  // iOS ends the session if the user cancels or it times out. Surface that so
  // the UI can drop out of its scanning state instead of lying about being ready.
  const endListener = await CapacitorNfc.addListener?.(
    'nfcSessionEnd',
    (e: { reason?: string }) => {
      if (e?.reason === 'sessionTimeout') {
        onError(new Error('Scanning timed out. Tap Resume to continue.'));
      }
    },
  );

  await CapacitorNfc.startScanning({
    invalidateAfterFirstRead: false,
    alertMessage: 'Hold the student card against the top of your phone.',
    iosSessionType: 'tag',
  });

  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    void listener.remove();
    void endListener?.remove();
    void CapacitorNfc.stopScanning().catch(() => {
      // Session may already be closed by the OS; nothing useful to do.
    });
  };
}
