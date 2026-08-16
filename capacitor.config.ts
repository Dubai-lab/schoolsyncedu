import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor config for both mobile apps.
 *
 * The CLI has no --config flag, so one file serves both targets and switches
 * on the CAP_APP environment variable:
 *
 *   npm run cap:student   → SchoolSync         → android/        ios/
 *   npm run cap:attend    → SchoolSync Attend  → android-attend/ ios-attend/
 *
 * Separate binaries rather than one app with modes:
 *   - different audiences and separate store listings
 *   - Attend requests NFC permission, which a student app has no business asking for
 *   - a teacher's phone should not carry the student portal, and vice versa
 *
 * android.path / ios.path keep Attend's native projects beside the student
 * app's instead of overwriting them.
 *
 * Run the matching build first (build:student / build:attend) or the native
 * project will be synced with stale web assets.
 */

const student: CapacitorConfig = {
  appId: 'com.schoolsync.student',
  appName: 'SchoolSync',
  webDir: 'dist-student',
  android: { allowMixedContent: false },
  server: { androidScheme: 'https', iosScheme: 'https' },
};

const attend: CapacitorConfig = {
  appId: 'com.schoolsync.attend',
  appName: 'SchoolSync Attend',
  webDir: 'dist-attend',
  android: { path: 'android-attend', allowMixedContent: false },
  ios: { path: 'ios-attend' },
  server: { androidScheme: 'https', iosScheme: 'https' },
};

// Supabase auth and storage need a secure context; the https scheme keeps the
// WebView origin secure so tokens persist in localStorage exactly as on web.
const config: CapacitorConfig = process.env.CAP_APP === 'attend' ? attend : student;

export default config;
