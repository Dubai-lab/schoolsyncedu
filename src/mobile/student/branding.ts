import { supabase } from '@/lib/supabase';

/**
 * Per-school branding for the universal student app.
 *
 * One binary serves every school, so the app has to repaint itself once it
 * knows which school the student belongs to — their logo, name and colours
 * instead of generic SchoolSync purple.
 *
 * How the colour actually applies: tailwind.config.js defines the `primary`
 * scale as CSS custom properties with the original hex values as fallbacks
 * (`var(--brand-600, #2d4fd6)`). Setting those variables on :root retints
 * every primary-* utility at once. The web app never sets them, so it keeps
 * its original palette untouched.
 *
 * Cached in localStorage so a returning student sees their school's colours
 * on first paint, before any network call resolves.
 */

const CACHE_KEY = 'schoolsync.student.branding.v1';

export interface SchoolBranding {
  schoolId: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  motto: string | null;
}

// ── Colour scale ─────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean.split('').map((c) => c + c).join('')
      : clean;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/**
 * Tailwind consumes these as `rgb(var(--brand-600-rgb) / <alpha-value>)`, so
 * the variables hold space-separated channels — "45 79 214" — not hex.
 */
function channels([r, g, b]: [number, number, number]): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `${clamp(r)} ${clamp(g)} ${clamp(b)}`;
}

/** ratio > 0 mixes toward white, < 0 toward black. */
function mix(rgb: [number, number, number], ratio: number): string {
  const target = ratio > 0 ? 255 : 0;
  const amount = Math.abs(ratio);
  return channels([
    rgb[0] + (target - rgb[0]) * amount,
    rgb[1] + (target - rgb[1]) * amount,
    rgb[2] + (target - rgb[2]) * amount,
  ]);
}

/**
 * Schools store a single brand colour, but the UI needs a scale. Derive the
 * tints and shades around it rather than asking schools to pick seven colours
 * they do not have opinions about.
 */
function buildScale(hex: string): Record<string, string> | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return {
    '--brand-50-rgb': mix(rgb, 0.92),
    '--brand-100-rgb': mix(rgb, 0.84),
    '--brand-500-rgb': mix(rgb, 0.08),
    '--brand-600-rgb': channels(rgb),
    '--brand-700-rgb': mix(rgb, -0.16),
    '--brand-900-rgb': mix(rgb, -0.45),
  };
}

// ── Apply ────────────────────────────────────────────────────────────────────

export function applyBranding(branding: SchoolBranding | null): void {
  const root = document.documentElement;
  const vars = branding?.primaryColor ? buildScale(branding.primaryColor) : null;

  if (!vars) {
    // Clear the overrides so the Tailwind fallbacks take over again — this is
    // what makes signing out of one school and into another repaint correctly.
    for (const key of [
      '--brand-50-rgb', '--brand-100-rgb', '--brand-500-rgb',
      '--brand-600-rgb', '--brand-700-rgb', '--brand-900-rgb',
    ]) {
      root.style.removeProperty(key);
    }
    return;
  }

  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }

  // Keep the Android status bar in step with the school's colour.
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta && branding?.primaryColor) meta.content = branding.primaryColor;
}

// ── Cache ────────────────────────────────────────────────────────────────────

export function getCachedBranding(): SchoolBranding | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as SchoolBranding) : null;
  } catch {
    return null;
  }
}

export function cacheBranding(branding: SchoolBranding | null): void {
  try {
    if (branding) localStorage.setItem(CACHE_KEY, JSON.stringify(branding));
    else localStorage.removeItem(CACHE_KEY);
  } catch {
    /* storage unavailable — branding just won't persist */
  }
}

// ── Fetch ────────────────────────────────────────────────────────────────────

/**
 * Look up a school's public branding by its 3-letter code.
 * Returns null for an unknown code — the caller decides what to say.
 */
export async function fetchBranding(schoolCode: string): Promise<SchoolBranding | null> {
  const code = schoolCode.trim().toUpperCase();
  if (code.length < 2) return null;

  const { data, error } = await supabase.rpc('get_public_school_by_code', {
    p_school_code: code,
  });
  if (error) return null;

  const row = data as {
    found?: boolean;
    school_id?: string;
    name?: string;
    logo_url?: string | null;
    primary_color?: string | null;
    motto?: string | null;
  } | null;

  if (!row?.found) return null;

  return {
    schoolId: row.school_id ?? '',
    name: row.name ?? '',
    logoUrl: row.logo_url ?? null,
    primaryColor: row.primary_color ?? null,
    motto: row.motto ?? null,
  };
}

/** Restore cached branding immediately at startup, before any network call. */
export function restoreBranding(): SchoolBranding | null {
  const cached = getCachedBranding();
  if (cached) applyBranding(cached);
  return cached;
}
