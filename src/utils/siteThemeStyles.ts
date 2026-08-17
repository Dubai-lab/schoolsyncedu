import type { CSSProperties } from 'react';
import { resolveTheme, type SiteTheme } from '@/types/siteTheme';

/**
 * Turns a SiteTheme into the CSS variables and class names SchoolSite renders
 * with.
 *
 * Everything is expressed as custom properties on one wrapper element rather
 * than conditional classNames scattered through the page. Two reasons: the
 * designer's live preview can re-theme instantly by swapping variables, and a
 * new preset is a few values here instead of an edit in twelve sections.
 *
 * A school's own primary colour still drives accents. The preset governs
 * surface, rhythm and type — the things that were previously identical
 * everywhere and made every site read the same.
 */

interface PresetTokens {
  pageBg: string;
  surfaceBg: string;
  altSurfaceBg: string;
  textStrong: string;
  textMuted: string;
  headingWeight: string;
  headingTracking: string;
  sectionPadY: string;
  maxWidth: string;
  border: string;
  shadow: string;
}

const PRESETS: Record<string, PresetTokens> = {
  classic: {
    pageBg: '#ffffff', surfaceBg: '#ffffff', altSurfaceBg: '#f8fafc',
    textStrong: '#0f172a', textMuted: '#475569',
    headingWeight: '700', headingTracking: '-0.01em',
    sectionPadY: '4.5rem', maxWidth: '72rem',
    border: '1px solid #e2e8f0', shadow: '0 1px 2px rgba(15,23,42,.06)',
  },
  modern: {
    pageBg: '#ffffff', surfaceBg: '#ffffff', altSurfaceBg: '#f8fafc',
    textStrong: '#0f172a', textMuted: '#64748b',
    headingWeight: '800', headingTracking: '-0.025em',
    sectionPadY: '6rem', maxWidth: '80rem',
    border: '1px solid #e2e8f0', shadow: '0 10px 30px -12px rgba(15,23,42,.15)',
  },
  bold: {
    pageBg: '#0b1020', surfaceBg: '#111930', altSurfaceBg: '#0b1020',
    textStrong: '#ffffff', textMuted: 'rgba(255,255,255,.7)',
    headingWeight: '900', headingTracking: '-0.03em',
    sectionPadY: '6.5rem', maxWidth: '78rem',
    border: '1px solid rgba(255,255,255,.12)', shadow: '0 20px 50px -20px rgba(0,0,0,.6)',
  },
  editorial: {
    pageBg: '#fffdf9', surfaceBg: '#fffdf9', altSurfaceBg: '#f6f2ea',
    textStrong: '#1c1917', textMuted: '#57534e',
    headingWeight: '700', headingTracking: '-0.015em',
    sectionPadY: '5rem', maxWidth: '68rem',
    border: '1px solid #e7e0d4', shadow: 'none',
  },
  warm: {
    pageBg: '#fffaf5', surfaceBg: '#ffffff', altSurfaceBg: '#fff3e6',
    textStrong: '#3b2a1d', textMuted: '#7c6250',
    headingWeight: '800', headingTracking: '-0.02em',
    sectionPadY: '5.5rem', maxWidth: '76rem',
    border: '1px solid #f0e0cf', shadow: '0 8px 24px -12px rgba(120,80,40,.25)',
  },
};

const CORNERS: Record<string, string> = {
  sharp: '0px', soft: '0.75rem', round: '1.25rem', pill: '2rem',
};

const HEADING_FONTS: Record<string, string> = {
  sans: "'Inter', system-ui, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  slab: "'Rockwell', Georgia, serif",
  display: "'Trebuchet MS', 'Segoe UI', sans-serif",
};

const DENSITY: Record<string, number> = { compact: 0.72, normal: 1, airy: 1.35 };

/**
 * Surface texture, as a background-image on the wrapper.
 *
 * currentColor is deliberate: the pattern picks up whatever text colour the
 * preset sets, so it stays legible on the dark 'bold' preset without needing a
 * second set of values per preset.
 */
function surfaceLayer(surface: string, primary: string): CSSProperties {
  switch (surface) {
    case 'grid':
      return {
        backgroundImage:
          'linear-gradient(to right, currentColor 1px, transparent 1px),' +
          'linear-gradient(to bottom, currentColor 1px, transparent 1px)',
        backgroundSize: '48px 48px',
        opacity: 0.05,
      };
    case 'checker':
      // Two offset 45° gradients produce squares without an image asset.
      return {
        backgroundImage:
          'linear-gradient(45deg, currentColor 25%, transparent 25%, transparent 75%, currentColor 75%),' +
          'linear-gradient(45deg, currentColor 25%, transparent 25%, transparent 75%, currentColor 75%)',
        backgroundSize: '64px 64px',
        backgroundPosition: '0 0, 32px 32px',
        opacity: 0.035,
      };
    case 'dots':
      return {
        backgroundImage: 'radial-gradient(currentColor 1.5px, transparent 1.5px)',
        backgroundSize: '28px 28px',
        opacity: 0.07,
      };
    case 'gradient':
      return {
        backgroundImage: `radial-gradient(ellipse 70% 50% at 50% 0%, ${primary}, transparent 70%)`,
        opacity: 0.14,
      };
    case 'diagonal':
      return {
        backgroundImage:
          'repeating-linear-gradient(45deg, currentColor 0 1px, transparent 1px 14px)',
        opacity: 0.05,
      };
    default:
      return { display: 'none' };
  }
}

export interface ResolvedSiteStyles {
  /** Custom properties for the site wrapper. */
  vars: CSSProperties;
  /** Absolutely-positioned texture layer, or null for 'plain'. */
  surface: CSSProperties | null;
  /** True when the preset is dark, so sections can flip their own contrast. */
  isDark: boolean;
  theme: ReturnType<typeof resolveTheme>;
}

export function buildSiteStyles(
  theme: SiteTheme | null | undefined,
  primaryColor: string,
  secondaryColor: string,
): ResolvedSiteStyles {
  const t = resolveTheme(theme);
  const p = PRESETS[t.preset] ?? PRESETS.modern;
  const densityScale = DENSITY[t.density] ?? 1;

  const padY = `calc(${p.sectionPadY} * ${densityScale})`;

  return {
    theme: t,
    isDark: t.preset === 'bold',
    surface: t.surface === 'plain' ? null : surfaceLayer(t.surface, primaryColor),
    vars: {
      '--site-primary': primaryColor,
      '--site-secondary': secondaryColor,
      '--site-page-bg': p.pageBg,
      '--site-surface': p.surfaceBg,
      '--site-surface-alt': p.altSurfaceBg,
      '--site-text': p.textStrong,
      '--site-text-muted': p.textMuted,
      '--site-heading-weight': p.headingWeight,
      '--site-heading-tracking': p.headingTracking,
      '--site-heading-font': HEADING_FONTS[t.headingFont] ?? HEADING_FONTS.sans,
      '--site-section-pad': padY,
      '--site-max-width': p.maxWidth,
      '--site-radius': CORNERS[t.corners] ?? CORNERS.soft,
      '--site-border': p.border,
      '--site-shadow': p.shadow,
    } as CSSProperties,
  };
}

/** Logo box size, kept in one place so header and footer agree. */
export const LOGO_SIZE: Record<string, string> = {
  sm: '2.25rem', md: '3rem', lg: '4rem',
};

/** Mix a hex colour toward black. ratio 0 = unchanged, 1 = black. */
function darken(hex: string, ratio: number): string {
  const c = hex.replace('#', '');
  const full = c.length === 3 ? c.split('').map((x) => x + x).join('') : c;
  if (!/^[0-9a-f]{6}$/i.test(full)) return hex;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  const mix = (v: number) => Math.round(v * (1 - ratio));
  return '#' + [r, g, b].map((v) => mix(v).toString(16).padStart(2, '0')).join('');
}

/**
 * The school's own colour, lifted only as far as it must be to stay visible.
 *
 * Figures, labels and icons are painted with the school's colour through an
 * inline style, which no stylesheet can re-point. A school whose brand is a
 * deep navy gets near-black marks on the near-black 'bold' page — present,
 * selectable, invisible.
 *
 * The first attempt at this swapped the colour for the theme's text colour
 * whenever it failed. That fixed the reading and quietly took the school's
 * decision away: every navy school on a dark preset would have got the same
 * white numbers, with no way to ask for navy ones. Hard-coding a look is
 * exactly what this design system exists to avoid — the school chooses, and
 * the only thing that should happen automatically is that their choice stays
 * legible on the preset they chose.
 *
 * So the hue is kept and raised toward white until it clears the threshold:
 * the same navy, light enough to see. A colour that already passes — most of
 * them — is returned untouched, and nothing happens at all on a light preset.
 */
export function readableBrandColor(
  hex: string,
  isDark: boolean,
  /**
   * WCAG asks 4.5:1 of body text and 3:1 of large text and of icons, and the
   * difference decides real cases: a red brand at 3.6:1 carries a 40px figure
   * and not an 11px label. A single threshold would either dull headlines that
   * could hold the colour, or leave small text unreadable.
   */
  size: 'small' | 'large' = 'small',
): string {
  if (!isDark) return hex;

  const c = hex.replace('#', '');
  const full = c.length === 3 ? c.split('').map((x) => x + x).join('') : c;
  if (!/^[0-9a-f]{6}$/i.test(full)) return hex;

  const rgb = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));

  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const luminance = (v: number[]) =>
    0.2126 * channel(v[0]) + 0.7152 * channel(v[1]) + 0.0722 * channel(v[2]);

  // Solved against the 'bold' page background rather than guessed: with the
  // page at roughly L=0.011, contrast = (L + 0.05) / (0.011 + 0.05), so 3:1
  // needs L >= 0.133 and 4.5:1 needs L >= 0.225.
  const floor = size === 'large' ? 0.133 : 0.225;
  if (luminance(rgb) >= floor) return hex;

  // Mixed toward white in small steps, stopping at the first that clears.
  // Stepped rather than solved because luminance is not linear in the channel
  // values, and 4% lands close enough that the extra lift is not visible.
  const toHex = (v: number[]) =>
    '#' + v.map((n) => Math.round(n).toString(16).padStart(2, '0')).join('');

  for (let mix = 0.04; mix < 1; mix += 0.04) {
    const lifted = rgb.map((v) => v + (255 - v) * mix);
    if (luminance(lifted) >= floor) return toHex(lifted);
  }
  return '#ffffff';
}

/**
 * A tint of the school's colour for the small rounded tiles behind icons.
 *
 * The page builds these as `primary + '12'` — the brand colour at 7% over
 * whatever is behind. On a light page that reads as a soft wash; on a dark one
 * a dark colour at 7% over a dark ground is nothing at all, which is why the
 * icons in the report sat on tiles that were not there.
 *
 * Derived from the lifted colour and given more opacity on a dark preset, so
 * the tile is still the school's colour and still just a tint — only visible.
 */
export function brandTint(hex: string, isDark: boolean): string {
  const base = readableBrandColor(hex, isDark, 'large');
  if (base.startsWith('var(')) return 'rgba(255,255,255,0.08)';
  const c = base.replace('#', '');
  const full = c.length === 3 ? c.split('').map((x) => x + x).join('') : c;
  if (!/^[0-9a-f]{6}$/i.test(full)) return hex + '12';
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${isDark ? 0.16 : 0.07})`;
}

/**
 * Background for the footer and the call-to-action band.
 *
 * These two were the only blocks painted with the school's colour through an
 * inline style, so they ignored the preset entirely — a dark page ended up with
 * two bright bands still in the old colour, and the page read as two designs
 * stitched together.
 *
 * Returned as a style object rather than a class because the source colour is
 * the school's own and cannot be known at build time.
 */
export function bandStyle(
  band: string,
  primary: string,
  isDark: boolean,
): { background: string; color: string; muted: string } {
  switch (band) {
    case 'deep':
      return { background: darken(primary, 0.55), color: '#ffffff', muted: 'rgba(255,255,255,.65)' };
    case 'ink':
      return { background: '#0b1020', color: '#ffffff', muted: 'rgba(255,255,255,.6)' };
    case 'surface':
      // Follows the preset. On a dark preset that means the band disappears
      // into the page, which is the point — some schools want one continuous
      // surface rather than a stack of coloured blocks.
      return {
        background: 'var(--site-surface-alt)',
        color: 'var(--site-text)',
        muted: 'var(--site-text-muted)',
      };
    default:
      return {
        background: primary,
        color: '#ffffff',
        muted: isDark ? 'rgba(255,255,255,.6)' : 'rgba(255,255,255,.7)',
      };
  }
}
