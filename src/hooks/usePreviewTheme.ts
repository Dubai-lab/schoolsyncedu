import { useEffect, useState } from 'react';
import type { SiteTheme } from '@/types/siteTheme';

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

export function usePreviewTheme(): SiteTheme | null {
  const [theme, setTheme] = useState<SiteTheme | null>(null);

  useEffect(() => {
    // Not framed — this is the real site, being read by a real visitor.
    if (window.parent === window) return;

    const onMessage = (event: MessageEvent) => {
      // Same origin only. The designer and the school site are served from the
      // same host, so anything else has no business setting this.
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; theme?: unknown } | null;
      if (!data || data.type !== MESSAGE) return;
      setTheme(sanitise(data.theme));
    };

    window.addEventListener('message', onMessage);

    // The frame finishes loading after the panel has already sent its first
    // draft, so ask for it rather than waiting for the next change — otherwise
    // the preview opens showing the saved theme and only catches up once
    // something is clicked.
    window.parent.postMessage({ type: READY }, window.location.origin);

    return () => window.removeEventListener('message', onMessage);
  }, []);

  return theme;
}

export const PREVIEW_MESSAGE = MESSAGE;
export const PREVIEW_READY = READY;
