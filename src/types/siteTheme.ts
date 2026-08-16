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

/**
 * Shape of the hero's bottom edge.
 *
 * The hero was a rectangle with a straight cut across the bottom, on every
 * school site. That hard horizontal line is one of the most recognisable
 * things about a page, and it was identical everywhere.
 */
export type HeroDivider =
  | 'straight'  // a flat edge — as before
  | 'wave'      // a soft S-curve
  | 'curve'     // one broad arc, rising at the edges
  | 'slant'     // a single diagonal
  | 'peak'      // a shallow triangle
  | 'round';    // the whole block rounded at the base

/**
 * Hero height.
 *
 * It was min-h-screen with no alternative, so the hero always filled the whole
 * window and everything else began below the fold. A visitor had to scroll
 * past a full screen before reaching anything the school had written.
 */
export type HeroHeight = 'full' | 'tall' | 'medium' | 'compact';

export type StatsLayout = 'bar' | 'cards' | 'inline' | 'hidden';
export type ProgramsLayout = 'grid' | 'list' | 'carousel' | 'feature';
/**
 * Gallery arrangement.
 *
 * The gallery was CSS masonry with no alternative, so its height grew with
 * every photo a school added — twenty pictures produced a section several
 * screens tall that visitors had to scroll past. Three of these cap the height
 * regardless of how many photos there are.
 */
export type GalleryLayout =
  | 'masonry'    // varied heights, grows with the number of photos — as before
  | 'grid'       // uniform tiles, fixed rows
  | 'carousel'   // one swipeable row, height fixed whatever the count
  | 'strip';     // compact single row of small thumbnails

/** Tile shape. Not every school wants squares. */
export type GalleryShape = 'square' | 'rounded' | 'circle' | 'arch' | 'portrait';
export type StaffLayout = 'cards' | 'circles' | 'rows';

/** Where the logo sits in the header — a small change that reads as identity. */
export type LogoPlacement = 'left' | 'center' | 'right';

/**
 * Treatment for the footer and the call-to-action band.
 *
 * These two were the only blocks painted with the school's colour through an
 * inline style, so a dark preset produced a dark page with two bright bands
 * still in the old colour — the page looked like two designs stitched
 * together. They now follow whichever treatment is chosen.
 *
 *   brand    the school's primary colour, as before
 *   deep     a darkened version of it — brand identity without the glare
 *   ink      near-black, letting the accent colour do the work
 *   surface  follows the preset's own surfaces, so it disappears into the page
 */
/**
 * Login page arrangement.
 *
 * The sign-in page had content options — heading, background image, feature
 * cards — but exactly one layout, so every school's login screen was the same
 * two-panel split in a different colour. It is the first thing staff and
 * students see, and it carried none of the branding the site now has.
 */
export type AuthLayout =
  | 'split'     // branding panel beside the form — today's only option
  | 'centered'  // form centred on a branded background
  | 'card'      // form in a raised card over a full-bleed image
  | 'minimal'   // form on a plain surface, logo above
  | 'cover';    // full-screen image, form in a translucent panel

/**
 * How every section heading is presented.
 *
 * Each section opened with a centred small-caps label between two rules, then
 * a large centred title — identical on every school site and in every section.
 * It is one of the strongest reasons two sites read the same even after the
 * colours and layouts differ.
 */
export type SectionHeaderStyle =
  | 'centered'  // label between rules, centred title — as before
  | 'left'      // aligned left, no rules
  | 'underline' // left aligned with a coloured rule beneath the title
  | 'stacked'   // oversized title, label beneath it
  | 'minimal';  // title only, no label at all

export type BandStyle = 'brand' | 'deep' | 'ink' | 'surface';

// ── The theme object ─────────────────────────────────────────────────────────

export interface SiteTheme {
  preset?: ThemePreset;
  surface?: SurfaceStyle;
  corners?: CornerStyle;
  headingFont?: HeadingFont;
  logoPlacement?: LogoPlacement;

  /** Shape of the hero's bottom edge. */
  heroDivider?: HeroDivider;
  /** How much of the window the hero fills. */
  heroHeight?: HeroHeight;

  /** Section heading presentation. */
  sectionHeader?: SectionHeaderStyle;

  /** Treatment for the login page branding panel. */
  authPanelStyle?: BandStyle;

  /** Gallery tile shape. */
  galleryShape?: GalleryShape;

  /** Background band behind the gallery section. See BandStyle. */
  galleryStyle?: BandStyle;

  /** Login page arrangement. See AuthLayout. */
  authLayout?: AuthLayout;

  /** Footer treatment. See BandStyle. */
  footerStyle?: BandStyle;
  /** Call-to-action band treatment. */
  ctaStyle?: BandStyle;

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
  heroDivider: 'straight',
  heroHeight: 'full',
  sectionHeader: 'centered',
  authPanelStyle: 'brand',
  galleryShape: 'rounded',
  // 'surface' is the alt page surface, which is #f8fafc on the light presets —
  // the exact colour the section was hardcoded to, so nothing moves by default.
  galleryStyle: 'surface',
  authLayout: 'split',
  footerStyle: 'brand',
  ctaStyle: 'brand',
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
