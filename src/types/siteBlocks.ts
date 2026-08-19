/**
 * Blocks — a school's page as a list it composes, rather than a fixed set.
 *
 * What this replaces
 * ------------------
 * SchoolSite.tsx rendered eleven hardcoded sections, one of each, always all
 * eleven. A school could reorder them and hide most of them. It could not add a
 * section, could not have two galleries, and could not make a section we had
 * not thought of. That ceiling is not a missing setting — there was no way to
 * add anything at all.
 *
 * A page is now a list of block instances. Same block type can appear as often
 * as the school likes, each with its own content.
 *
 * What this deliberately is NOT
 * -----------------------------
 * Not a page builder. There is a fixed library of types below, each with a
 * small set of variants, and styling stays governed by the theme. A school
 * composes from blocks we built and tested; it never positions freely, writes
 * CSS, or produces an arrangement we have not seen. Freedom of composition and
 * freedom of styling are separable, and only the first is being handed over.
 *
 * Migration safety
 * ----------------
 * Nothing is stored until a school edits its layout. A site with no `blocks`
 * has one derived at render time by blocksFromLegacy(), which reproduces the
 * existing page exactly — same order, same visibility rules, same content. So
 * every school that has never opened the designer keeps rendering byte for
 * byte as it does today, which is the same standard DEFAULT_THEME already sets.
 */

import type { SiteConfig } from './school.types';
import { DEFAULT_SECTION_ORDER } from './siteTheme';
import type { BandStyle } from './siteTheme';

// ── The library ──────────────────────────────────────────────────────────────

/**
 * Block types available today.
 *
 * The first eleven are the existing sections, so the conversion is a rename
 * rather than a rewrite. New types get added here and nowhere else — the
 * renderer switches on this, and the designer builds its "Add" menu from it.
 */
export type BlockType =
  | 'hero'
  | 'stats'
  | 'about'
  | 'programs'
  | 'announcements'
  | 'gallery'
  | 'administration'
  | 'testimonials'
  | 'app'
  | 'cta'
  | 'contact'
  // The first block type that is not a port of an existing section. Generic on
  // purpose: a heading, some words and one picture covers school history,
  // uniform policy, admissions steps, boarding — everything a school asks for
  // that nobody predicted.
  | 'textImage';

/**
 * Types that may appear more than once on a page.
 *
 * Hero is the page's header and contact is its close; two of either reads as a
 * mistake rather than a choice. Everything else is content a school might
 * legitimately want twice — sports photos and graduation photos as separate
 * galleries, junior and senior programmes as separate lists.
 */
export const REPEATABLE: BlockType[] = [
  'programs', 'announcements', 'gallery', 'administration', 'testimonials',
  'textImage', 'cta',
];

/** Blocks the page cannot lose, and which the designer offers no delete for. */
export const REQUIRED_BLOCKS: BlockType[] = ['hero'];

export const BLOCK_LABELS: Record<BlockType, string> = {
  hero:           'Hero',
  stats:          'Key numbers',
  about:          'About the school',
  programs:       'Programmes',
  announcements:  'Announcements',
  gallery:        'Photo gallery',
  administration: 'Leadership & staff',
  testimonials:   'What people say',
  app:            'Student app',
  cta:            'Apply / call to action',
  contact:        'Contact',
  textImage:      'Text & image',
};

// ── An instance ──────────────────────────────────────────────────────────────

/**
 * One strip of the page.
 *
 * `content` holds this instance's own words and pictures. That is the whole
 * point of the change: content used to live once per site on SiteConfig, which
 * is why a second gallery was impossible — there was only one place to put the
 * photos.
 *
 * `heading` and `label` override the section titles that were hardcoded into
 * the page. Absent means "use the built-in wording", so nothing changes for a
 * school that has not set them.
 */
export interface SiteBlock {
  /** Stable across edits. Used as the React key and the designer's drag handle. */
  id: string;
  type: BlockType;
  /** Hidden blocks stay in the list so the school can bring them back. */
  hidden?: boolean;
  /** Small caps line above the title. Absent uses the built-in wording. */
  label?: string;
  /** Section title. Absent uses the built-in wording. */
  heading?: string;
  /** Sentence under the title, where the section has one. */
  intro?: string;
  /** Anchor for nav links. Derived from type + index when absent. */
  anchor?: string;
  /**
   * Whether this block earns a link in the header nav.
   *
   * Absent follows the type's default, which keeps the nav as it was. Text and
   * image blocks default to off on purpose: a school that writes five of them
   * would otherwise get a nav of five entries and no navigation. A school that
   * builds an Admissions section can switch it on.
   */
  inNav?: boolean;
  content: Record<string, unknown>;

  /**
   * Presentation for this instance alone.
   *
   * Band and layout used to be single theme settings applied to every section
   * of that kind, so a school with two galleries would have had no way to put
   * one on a dark band and leave the other plain. Absent means "follow the
   * theme", which is what every existing block does.
   *
   * Still curated: `band` is one of four named treatments and `variant` one of
   * a type's own named layouts. Nothing here accepts a colour or a measurement.
   */
  design?: {
    band?: BandStyle;
    variant?: string;
  };
}

/** A page is just an ordered list. */
export type SitePageBlocks = SiteBlock[];

// ── Ids ──────────────────────────────────────────────────────────────────────

/**
 * Ids are generated client-side and never collide in practice, but they only
 * have to be unique within one page's list — they are keys, not identifiers
 * anything else stores.
 */
export function newBlockId(type: BlockType): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${type}-${rand}`;
}

/**
 * A fresh block, ready to edit.
 *
 * Starts with placeholder wording rather than empty fields: a block that
 * renders as a blank strip looks broken, and a school adding one wants to see
 * where it landed before it has written anything.
 */
export function newBlock(type: BlockType): SiteBlock {
  const base: SiteBlock = { id: newBlockId(type), type, content: {} };

  switch (type) {
    case 'textImage':
      return {
        ...base,
        heading: 'A heading for this section',
        content: {
          body: 'Write about your school here — its history, its uniform policy, what a school day looks like. Anything you want visitors to know.',
          image_url: null,
          image_side: 'right',
        },
      };
    case 'gallery':       return { ...base, heading: 'Photo gallery', content: { images: [] } };
    case 'programs':      return { ...base, heading: 'Programmes', content: { items: [] } };
    case 'announcements': return { ...base, heading: 'News', content: { items: [], limit: 6 } };
    case 'testimonials':  return { ...base, heading: 'What people say', content: { items: [] } };
    case 'administration':return { ...base, heading: 'Our team', content: { members: [] } };
    case 'cta':           return { ...base, content: { button_text: 'Apply Now' } };
    default:              return base;
  }
}

/** Copy a block, with a new id so React and the list can tell them apart. */
export function duplicateBlock(block: SiteBlock): SiteBlock {
  return {
    ...block,
    id: newBlockId(block.type),
    // Deep enough: content holds arrays of plain objects, and a shallow copy
    // would leave the duplicate sharing its photo list with the original.
    content: structuredClone(block.content ?? {}),
    design: block.design ? { ...block.design } : undefined,
  };
}

/** May another of this type be added? */
export function canAddBlock(type: BlockType, blocks: SitePageBlocks): boolean {
  if (REPEATABLE.includes(type)) return true;
  return !blocks.some((b) => b.type === type);
}

// ── Legacy conversion ────────────────────────────────────────────────────────

/**
 * Build the block list for a school that has never edited its layout.
 *
 * Reproduces today's page exactly:
 *   - order comes from theme.sectionOrder, falling back to the original order
 *   - visibility comes from sections_visible, the same map show() reads
 *   - content is copied from the SiteConfig fields each section reads today
 *
 * Two sections are marked hidden here that the live page renders regardless —
 * 'app' and 'cta' never checked sections_visible, so switching them off in the
 * designer did nothing. Honouring the flag is a behaviour change, and a
 * deliberate one: the switch existed and silently failed. Any school that had
 * turned either off will now actually see them go, which is what it asked for.
 */
export function blocksFromLegacy(cfg: SiteConfig, sectionOrder?: string[]): SitePageBlocks {
  const order = sectionOrder?.length ? sectionOrder : DEFAULT_SECTION_ORDER;
  const visible = (cfg.sections_visible ?? {}) as Record<string, boolean>;
  const isHidden = (name: string) => visible[name] === false;

  // Anything the order does not mention keeps its place at the end rather than
  // jumping to the front, which is what indexOf's -1 would otherwise produce.
  const known = new Set<string>(Object.keys(BLOCK_LABELS));
  const ordered = [
    ...order.filter((n) => known.has(n)),
    ...DEFAULT_SECTION_ORDER.filter((n) => known.has(n) && !order.includes(n)),
  ];

  return ordered.map((type) => ({
    id: `${type}-legacy`,
    type: type as BlockType,
    hidden: isHidden(type) || undefined,
    // Deliberately empty. Content is merged in at render time by
    // resolveContent, so the existing Content tab stays authoritative for the
    // first block of each type. Snapshotting here would mean a school that
    // saved a layout then edited its programmes in the Content tab would see
    // nothing change on the page, with nothing to explain why.
    content: {},
  }));
}

/**
 * The content each section reads from SiteConfig today, lifted into the block.
 *
 * Kept as a copy rather than a reference so that the moment a school adds a
 * second gallery, the two have genuinely separate photo lists. Until then the
 * values are identical to what the page already renders.
 */
export function legacyContent(type: BlockType, cfg: SiteConfig): Record<string, unknown> {
  const c = cfg as Record<string, unknown>;

  switch (type) {
    case 'hero':
      return {
        image_url:  c.hero_image_url ?? null,
        slides:     c.hero_slides ?? [],
        hours:      c.school_hours ?? null,
      };

    case 'stats':
      return { items: c.stats ?? [] };

    case 'about':
      return {
        mission:          c.mission_text ?? null,
        vision:           c.vision_text ?? null,
        building_image:   c.building_image_url ?? null,
        principal_message: c.principal_message ?? null,
        principal_image:  c.principal_image_url ?? null,
        principal_title:  c.principal_title ?? null,
      };

    case 'programs':
      return { items: c.programs ?? [] };

    case 'announcements':
      return { items: c.announcements ?? [] };

    case 'gallery':
      return { images: c.gallery_images ?? [] };

    case 'administration':
      return { members: c.staff ?? [] };

    case 'testimonials':
      return { items: c.testimonials ?? [] };

    case 'contact':
      return { hours: c.school_hours ?? null };

    // 'app' and 'cta' render entirely from the school record and the theme.
    case 'app':
    case 'cta':
    default:
      return {};
  }
}

/**
 * The list a page should render.
 *
 * A stored list wins. Absent, one is derived from the old fields — which is
 * every school today, and stays true until each one saves a layout of its own.
 */
export function resolveBlocks(cfg: SiteConfig, sectionOrder?: string[]): SitePageBlocks {
  const stored = (cfg as Record<string, unknown>).blocks as SitePageBlocks | undefined;
  if (Array.isArray(stored) && stored.length > 0) return stored;
  return blocksFromLegacy(cfg, sectionOrder);
}

/**
 * Anchor for nav links and in-page scrolling.
 *
 * The first block of a type keeps the id the old page used — '#about',
 * '#gallery' — so existing links, bookmarks and the nav keep working. Later
 * instances of the same type get a suffix.
 */
export function blockAnchor(block: SiteBlock, indexOfType: number): string {
  if (block.anchor) return block.anchor;
  const base = block.type === 'hero' ? 'home' : block.type;
  return indexOfType === 0 ? base : `${base}-${indexOfType + 1}`;
}

// ── Navigation ───────────────────────────────────────────────────────────────

/**
 * Does this block have anything to show?
 *
 * The page skips empty blocks, so the nav must use the same test or it ends up
 * linking to a section that is not on the page.
 */
export function blockHasContent(
  block: SiteBlock,
  cfg?: SiteConfig,
  isFirstOfType = true,
): boolean {
  // Same merge the renderer does, so the nav and the page agree on whether a
  // block is empty. Without it every first-of-type block looks empty, because
  // its content lives on the site config rather than on the block.
  const c = cfg ? resolveContent(block, cfg, isFirstOfType) : (block.content ?? {});
  switch (block.type) {
    case 'stats':          return ((c.items as unknown[]) ?? []).length > 0;
    case 'programs':       return ((c.items as unknown[]) ?? []).length > 0;
    case 'announcements':  return ((c.items as unknown[]) ?? []).length > 0;
    case 'testimonials':   return ((c.items as unknown[]) ?? []).length > 0;
    case 'gallery':        return ((c.images as unknown[]) ?? []).length > 0;
    case 'administration': return ((c.members as unknown[]) ?? []).length > 0;
    // hero, about, app, cta and contact always render something.
    default: return true;
  }
}

/**
 * Which block types earn a nav link, and what it is called.
 *
 * Matches the links the page carried before: stats, announcements,
 * testimonials, app and cta were never in the nav, and are not added here —
 * a nav that lists everything stops being navigation.
 */
const NAV_LABELS: Partial<Record<BlockType, string>> = {
  hero:           'Home',
  about:          'About',
  programs:       'Programmes',
  gallery:        'Gallery',
  administration: 'Team',
  contact:        'Contact',
};

export interface NavEntry { label: string; href: string }

/**
 * Build the header and footer navigation from the page itself.
 *
 * Previously the nav was assembled from the old config fields while the page
 * was assembled from something else. They agreed only by coincidence, and
 * would have parted company the moment a school saved a layout: a second
 * gallery would get no link, and a hidden block would still be listed.
 *
 * A repeated block takes its own heading as the link text where the school has
 * written one, so two galleries read as "Sports Day" and "Graduation" rather
 * than "Gallery" and "Gallery 2".
 */
export function navEntriesFromBlocks(blocks: SitePageBlocks, cfg?: SiteConfig): NavEntry[] {
  const seen: Record<string, number> = {};
  const entries: NavEntry[] = [];

  for (const block of blocks) {
    const indexOfType = seen[block.type] ?? 0;
    seen[block.type] = indexOfType + 1;

    if (block.hidden) continue;
    if (!blockHasContent(block, cfg, indexOfType === 0)) continue;

    const base = NAV_LABELS[block.type] ?? block.heading;
    // Explicit choice wins; otherwise only the types that were in the nav
    // before are, so an existing school's header is unchanged.
    const wanted = block.inNav ?? (NAV_LABELS[block.type] !== undefined);
    if (!wanted || !base) continue;

    const label = indexOfType === 0
      ? (block.heading ?? base)
      : (block.heading ?? `${base} ${indexOfType + 1}`);

    entries.push({ label, href: `#${blockAnchor(block, indexOfType)}` });
  }

  return entries;
}

/**
 * A block's content, with the site-wide fields behind it.
 *
 * The first gallery on a page has no content of its own and falls through to
 * cfg.gallery_images, which is what the Content tab writes. A second gallery,
 * added in the designer, carries its own photos and shadows the fallback
 * entirely.
 *
 * That split is what lets both editors coexist: the Content tab keeps managing
 * the school's main programmes, gallery and staff, and the block designer adds
 * extra instances without either overwriting the other.
 */
export function resolveContent(
  block: SiteBlock,
  cfg: SiteConfig,
  isFirstOfType: boolean,
): Record<string, unknown> {
  const own = block.content ?? {};
  if (!isFirstOfType) return own;
  return { ...legacyContent(block.type, cfg), ...own };
}
