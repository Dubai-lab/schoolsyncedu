import { blockAnchor, type SiteBlock, type SitePageBlocks } from '@/types/siteBlocks';
import type { SiteCtx } from './shared';
import { HeroBlock } from './HeroBlock';
import {
  StatsBlock, AboutBlock, ProgramsBlock, AnnouncementsBlock, GalleryBlock,
  AdministrationBlock, TestimonialsBlock, AppBlock, CtaBlock, ContactBlock,
} from './contentBlocks';

/**
 * Turns a school's block list into the page.
 *
 * The switch is the whole library: a new block type is added here and in
 * BlockType, and nowhere else. Anything unrecognised renders nothing rather
 * than throwing — a site saved by a newer build should degrade to a page
 * missing one strip, not to a blank screen.
 */

const REGISTRY = {
  hero:           HeroBlock,
  stats:          StatsBlock,
  about:          AboutBlock,
  programs:       ProgramsBlock,
  announcements:  AnnouncementsBlock,
  gallery:        GalleryBlock,
  administration: AdministrationBlock,
  testimonials:   TestimonialsBlock,
  app:            AppBlock,
  cta:            CtaBlock,
  contact:        ContactBlock,
} as const;

export function BlockRenderer({ blocks, ctx }: { blocks: SitePageBlocks; ctx: SiteCtx }) {
  // Anchors are per type: the first gallery keeps '#gallery' so existing links
  // and the nav still resolve, and a second becomes '#gallery-2'.
  const seen: Record<string, number> = {};

  return (
    <>
      {blocks.map((block: SiteBlock) => {
        if (block.hidden) return null;

        const Component = REGISTRY[block.type as keyof typeof REGISTRY];
        if (!Component) return null;

        const indexOfType = seen[block.type] ?? 0;
        seen[block.type] = indexOfType + 1;

        return (
          <Component
            key={block.id}
            block={block}
            ctx={ctx}
            anchor={blockAnchor(block, indexOfType)}
          />
        );
      })}
    </>
  );
}

export default BlockRenderer;
