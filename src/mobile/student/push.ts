import { supabase } from '@/lib/supabase';

/**
 * Push notification registration for the student app.
 *
 * Flow:
 *   1. ask the OS for permission
 *   2. register with FCM/APNs, which hands back a device token
 *   3. store that token against the signed-in user via register_device_token
 *
 * The token identifies a device, not a person, so the same phone passed to a
 * sibling would keep receiving the previous student's notifications. The RPC
 * upserts on the token to reassign it, and signing out removes it.
 *
 * Web is a no-op — the plugin has no browser implementation, and the app runs
 * in Safari during development.
 */

const TOKEN_KEY = 'schoolsync.student.pushToken';

function isCapacitorNative(): boolean {
  const cap = (globalThis as Record<string, unknown>).Capacitor as
    | { isNativePlatform?: () => boolean; getPlatform?: () => string }
    | undefined;
  return typeof cap?.isNativePlatform === 'function' && cap.isNativePlatform();
}

function platformName(): 'android' | 'ios' | 'web' {
  const cap = (globalThis as Record<string, unknown>).Capacitor as
    | { getPlatform?: () => string }
    | undefined;
  const p = cap?.getPlatform?.();
  return p === 'android' || p === 'ios' ? p : 'web';
}

/**
 * Set up push for the signed-in student.
 *
 * @param onNavigate called when a notification is tapped, with the route the
 *        edge function attached — so tapping "New grade published" opens
 *        grades rather than the dashboard.
 * @returns a cleanup function that detaches the listeners.
 */
export async function initPush(onNavigate: (route: string) => void): Promise<() => void> {
  if (!isCapacitorNative()) return () => {};

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    let permission = await PushNotifications.checkPermissions();
    if (permission.receive === 'prompt' || permission.receive === 'prompt-with-rationale') {
      permission = await PushNotifications.requestPermissions();
    }
    if (permission.receive !== 'granted') {
      // Declining is a legitimate choice; the app keeps working without push.
      return () => {};
    }

    const listeners: Array<{ remove: () => Promise<void> }> = [];

    listeners.push(
      await PushNotifications.addListener('registration', async ({ value }) => {
        try {
          // Skip the round trip when the token has not changed since last launch.
          if (localStorage.getItem(TOKEN_KEY) === value) return;
          const { error } = await supabase.rpc('register_device_token', {
            p_token: value,
            p_platform: platformName(),
            p_device_name: navigator.userAgent.slice(0, 120),
          });
          if (!error) localStorage.setItem(TOKEN_KEY, value);
        } catch {
          // Offline at launch. The next launch re-registers, and a student
          // with no token simply receives nothing in the meantime.
        }
      }),
    );

    listeners.push(
      await PushNotifications.addListener('registrationError', (err) => {
        console.error('Push registration failed:', err);
      }),
    );

    listeners.push(
      await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        const route = action.notification?.data?.route;
        if (typeof route === 'string' && route.startsWith('/')) onNavigate(route);
      }),
    );

    await PushNotifications.register();

    return () => {
      for (const l of listeners) void l.remove();
    };
  } catch {
    return () => {};
  }
}

/**
 * Detach this device on sign-out, so a shared phone stops delivering the
 * previous student's notifications.
 */
export async function teardownPush(): Promise<void> {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return;
  try {
    await supabase.rpc('unregister_device_token', { p_token: token });
  } catch {
    // Best effort — the token is also reassigned when the next user registers.
  } finally {
    localStorage.removeItem(TOKEN_KEY);
  }
}
