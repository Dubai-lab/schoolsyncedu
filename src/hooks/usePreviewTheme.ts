import { useEffect, useState } from 'react';
import type { SiteTheme } from '@/types/siteTheme';
import type { SiteBlock, SitePageBlocks } from '@/types/siteBlocks';

/**
 * A draft theme sent in by the designer's preview frame.
 *
 * The proprietor picks from small thumbnails and then has to open the site in
 * another tab to find out what they actually chose. This lets the designer show
 * the real page — the same component, the same data, the same rendering path —
 * responding to each control as it is changed and before anything is saved.
 *
 * postMessage rather than a URL parameter: the theme keeps growing, a URL has a
 * practical length limit, and a parameter would need the frame to reload on
 * every click. This updates in place.
 *
 * Returns null outside a frame, so the public site is untouched — a visitor
 * cannot put a page into preview mode, because nothing is listening.
 */

const MESSAGE = 'schoolsync:preview-theme';
const READY = 'schoolsync:preview-ready';

/**
 * Only these are read off the message. The theme is presentation, and every
 * value is looked up in a table with a fallback rather than written into CSS
 * directly — but an allow-list means a malformed or hostile payload can only
 * ever produce a wrong-looking page, never an unexpected one.
 */
const ALLOWED: (keyof SiteTheme)[] = [
  'preset', 'surface', 'corners', 'headingFont', 'logoPlacement', 'logoSize',
  'heroDivider', 'heroHeight', 'sectionHeader', 'galleryShape', 'galleryStyle',
  'authLayout', 'authPanelStyle', 'footerStyle', 'ctaStyle', 'density',
  'layouts', 'sectionOrder',
];

function sanitise(input: unknown): SiteTheme | null {
  if (!input || typeof input !== 'object') return null;
  const src = input as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of ALLOWED) {
    if (src[key] !== undefined) out[key] = src[key];
  }
  return out as SiteTheme;
}

/**
 * Blocks arrive over the same channel, and get the same treatment: a shape
 * check rather than trust. A block whose type is not a string, or whose content
 * is not an object, is dropped — the page then renders one strip fewer instead
 * of throwing inside a school's live site.
 *
 * The type itself is not checked against the library here. BlockRenderer
 * already ignores anything it has no component for, and duplicating the list
 * would mean remembering to update two places every time a block is added.
 */
function sanitiseBlocks(input: unknown): SitePageBlocks | null {
  if (!Array.isArray(input)) return null;

  return input.flatMap((raw): SiteBlock[] => {
    if (!raw || typeof raw !== 'object') return [];
    const b = raw as Record<string, unknown>;
    if (typeof b.type !== 'string' || typeof b.id !== 'string') return [];

    return [{
      id: b.id,
      type: b.type as SiteBlock['type'],
      hidden: b.hidden === true || undefined,
      label: typeof b.label === 'string' ? b.label : undefined,
      heading: typeof b.heading === 'string' ? b.heading : undefined,
      intro: typeof b.intro === 'string' ? b.intro : undefined,
      anchor: typeof b.anchor === 'string' ? b.anchor : undefined,
      inNav: typeof b.inNav === 'boolean' ? b.inNav : undefined,
      design: b.design && typeof b.design === 'object'
        ? (b.design as SiteBlock['design'])
        : undefined,
      content: b.content && typeof b.content === 'object'
        ? (b.content as Record<string, unknown>)
        : {},
    }];
  });
}

export interface PreviewDraft {
  theme: SiteTheme | null;
  blocks: SitePageBlocks | null;
}

/**
 * The draft the designer is holding, or nulls outside a preview frame.
 *
 * Theme and blocks travel together because they are edited together — a school
 * moving a gallery and darkening its band wants to see both at once, and two
 * channels would let them arrive out of step.
 */
export function usePreviewDraft(): PreviewDraft {
  const [draft, setDraft] = useState<PreviewDraft>({ theme: null, blocks: null });

  useEffect(() => {
    // Not framed — this is the real site, being read by a real visitor.
    if (window.parent === window) return;

    const onMessage = (event: MessageEvent) => {
      // Same origin only. The designer and the school site are served from the
      // same host, so anything else has no business setting this.
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; theme?: unknown; blocks?: unknown } | null;
      if (!data || data.type !== MESSAGE) return;
      setDraft({
        theme: sanitise(data.theme),
        // undefined means "the panel is not editing blocks", which must leave
        // the saved list alone. An empty array is a real answer and is kept.
        blocks: data.blocks === undefined ? null : sanitiseBlocks(data.blocks),
      });
    };

    window.addEventListener('message', onMessage);

    // The frame finishes loading after the panel has already sent its first
    // draft, so ask for it rather than waiting for the next change — otherwise
    // the preview opens showing the saved theme and only catches up once
    // something is clicked.
    window.parent.postMessage({ type: READY }, window.location.origin);

    return () => window.removeEventListener('message', onMessage);
  }, []);

  return draft;
}

/** Theme only, for callers that do not care about blocks. */
export function usePreviewTheme(): SiteTheme | null {
  return usePreviewDraft().theme;
}

export const PREVIEW_MESSAGE = MESSAGE;
export const PREVIEW_READY = READY;
