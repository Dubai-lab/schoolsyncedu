/**
 * Visual identity for a school's public site.
 *
 * The problem this solves: every school site rendered from the same twelve
 * hardcoded sections in a fixed order, with `sections_visible` offering only
 * show/hide. Schools could change the words and the colour and nothing else,
 * so every site looked like every other site in a different shade.
 *
 * The approach is curated rather than open. A school picks from designs that
 * are known to work instead of positioning elements freely — the goal is that
 * every school gets a site that looks good, not that every school gets a
 * canvas it can wreck. Each choice below is a small set of named options, and
 * every combination of them is intended to be presentable.
 */

// ── Whole-site presets ───────────────────────────────────────────────────────

/**
 * A preset sets the overall character: surface treatment, corner radius,
 * type scale and section rhythm. It is the single choice that changes the most,
 * and is what makes two schools look genuinely different rather than
 * differently tinted.
 */
export type ThemePreset =
  | 'classic'    // white surfaces, restrained, serif headings — traditional schools
  | 'modern'     // generous whitespace, large type, soft shadows
  | 'bold'       // saturated colour blocks, heavy headings, high contrast
  | 'editorial'  // wide measures, rules between sections, magazine-like
  | 'warm';      // cream surfaces, rounded corners, friendly — primary schools

/** Background treatment behind full-width sections. */
export type SurfaceStyle =
  | 'plain'
  | 'grid'        // ruled lines
  | 'checker'     // alternating tint, the checkerboard look
  | 'dots'
  | 'gradient'
  | 'diagonal';   // angled section dividers

/** How corners are treated throughout — one of the strongest style signals. */
export type CornerStyle = 'sharp' | 'soft' | 'round' | 'pill';

/** Heading typeface. Body text stays consistently readable. */
export type HeadingFont = 'sans' | 'serif' | 'slab' | 'display';

// ── Per-section layout variants ──────────────────────────────────────────────

/**
 * Variants change arrangement, not content. A school that has written its hero
 * text can try every hero layout without re-entering anything.
 */
export type HeroLayout =
  | 'centered'      // text centred over the image — today's only option
  | 'split'         // text one side, image the other
  | 'full-image'    // edge-to-edge photo, text overlaid low
  | 'minimal'       // no image, colour field and type
  | 'card';         // text in a raised card over the image

export type StatsLayout = 'bar' | 'cards' | 'inline' | 'hidden';
export type ProgramsLayout = 'grid' | 'list' | 'carousel' | 'feature';
export type GalleryLayout = 'grid' | 'masonry' | 'carousel' | 'strip';
export type StaffLayout = 'cards' | 'circles' | 'rows';

/** Where the logo sits in the header — a small change that reads as identity. */
export type LogoPlacement = 'left' | 'center' | 'right';

// ── The theme object ─────────────────────────────────────────────────────────

export interface SiteTheme {
  preset?: ThemePreset;
  surface?: SurfaceStyle;
  corners?: CornerStyle;
  headingFont?: HeadingFont;
  logoPlacement?: LogoPlacement;

  /** Larger logo for schools whose crest carries the identity. */
  logoSize?: 'sm' | 'md' | 'lg';

  layouts?: {
    hero?: HeroLayout;
    stats?: StatsLayout;
    programs?: ProgramsLayout;
    gallery?: GalleryLayout;
    staff?: StaffLayout;
  };

  /**
   * Section order. Absent means the default below.
   *
   * Kept as names rather than free positioning: a school can lead with
   * programmes instead of statistics, without being able to produce a page
   * with no header.
   */
  sectionOrder?: string[];

  /** Vertical rhythm. Cramped suits content-heavy sites, airy suits sparse ones. */
  density?: 'compact' | 'normal' | 'airy';
}

export const DEFAULT_SECTION_ORDER = [
  'hero', 'stats', 'about', 'programs', 'announcements',
  'gallery', 'administration', 'testimonials', 'cta', 'contact',
];

/**
 * Defaults reproduce the current site exactly.
 *
 * That matters: every existing school has no theme saved, so they must keep
 * rendering byte-for-byte as they do now until someone deliberately changes
 * something. A redesign that silently rearranges live school websites would
 * be indefensible.
 */
export const DEFAULT_THEME: Required<Omit<SiteTheme, 'layouts' | 'sectionOrder'>> & {
  layouts: Required<NonNullable<SiteTheme['layouts']>>;
  sectionOrder: string[];
} = {
  preset: 'modern',
  surface: 'plain',
  corners: 'soft',
  headingFont: 'sans',
  logoPlacement: 'left',
  logoSize: 'md',
  density: 'normal',
  layouts: {
    hero: 'centered',
    stats: 'bar',
    programs: 'grid',
    gallery: 'grid',
    staff: 'cards',
  },
  sectionOrder: DEFAULT_SECTION_ORDER,
};

/** Merge a stored partial theme over the defaults. */
export function resolveTheme(theme?: SiteTheme | null): typeof DEFAULT_THEME {
  return {
    ...DEFAULT_THEME,
    ...(theme ?? {}),
    layouts: { ...DEFAULT_THEME.layouts, ...(theme?.layouts ?? {}) },
    sectionOrder: theme?.sectionOrder?.length ? theme.sectionOrder : DEFAULT_SECTION_ORDER,
  };
}

// ── Preset descriptions, for the designer UI ─────────────────────────────────

export const PRESET_INFO: Record<ThemePreset, { label: string; description: string }> = {
  classic:   { label: 'Classic',   description: 'Restrained and traditional. Serif headings, white surfaces.' },
  modern:    { label: 'Modern',    description: 'Open whitespace, large type, soft shadows.' },
  bold:      { label: 'Bold',      description: 'Strong colour blocks and heavy headings.' },
  editorial: { label: 'Editorial', description: 'Magazine-like, with rules between sections.' },
  warm:      { label: 'Warm',      description: 'Cream surfaces and rounded corners. Suits primary schools.' },
};

export const SURFACE_INFO: Record<SurfaceStyle, { label: string; description: string }> = {
  plain:    { label: 'Plain',        description: 'Flat colour.' },
  grid:     { label: 'Ruled grid',   description: 'Faint lines, like graph paper.' },
  checker:  { label: 'Checkerboard', description: 'Alternating tinted squares.' },
  dots:     { label: 'Dotted',       description: 'Regular dot texture.' },
  gradient: { label: 'Gradient',     description: 'Soft colour transition.' },
  diagonal: { label: 'Diagonal',     description: 'Angled dividers between sections.' },
};
