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
