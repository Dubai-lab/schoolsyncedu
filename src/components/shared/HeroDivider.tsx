import type { HeroDivider as DividerShape } from '@/types/siteTheme';

/**
 * The shape cut across the bottom of the hero.
 *
 * The hero ended in a hard horizontal line on every school site — the single
 * most recognisable thing about the top of a page, and identical everywhere.
 *
 * Drawn as an inline SVG rather than a CSS clip-path: clip-path would crop the
 * hero itself, taking the slideshow controls and the scroll indicator with it,
 * and `path()` support is still uneven. An SVG sits over the bottom edge in
 * the colour of whatever follows, so it reads as the next section rising into
 * the hero while the hero's own contents stay untouched.
 */

interface Props {
  shape: DividerShape;
  /** Colour of the section beneath — the shape is painted in it. */
  color: string;
  className?: string;
}

/** viewBox is 0 0 1440 120, scaled to the container width. */
const PATHS: Record<Exclude<DividerShape, 'straight' | 'round'>, string> = {
  wave: 'M0,64 C240,120 480,8 720,40 C960,72 1200,120 1440,72 L1440,120 L0,120 Z',
  curve: 'M0,120 C360,0 1080,0 1440,120 L1440,120 L0,120 Z',
  slant: 'M0,120 L1440,24 L1440,120 Z',
  peak: 'M0,120 L720,24 L1440,120 Z',
};

export default function HeroDividerShape({ shape, color, className = '' }: Props) {
  // 'straight' is the original edge and 'round' is handled with border-radius
  // on the hero itself, so neither needs an overlay.
  if (shape === 'straight' || shape === 'round') return null;

  const d = PATHS[shape];
  if (!d) return null;

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-x-0 bottom-0 z-[2] ${className}`}
      style={{ lineHeight: 0 }}
    >
      <svg
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        className="block w-full"
        style={{ height: 'clamp(40px, 7vw, 110px)' }}
      >
        <path d={d} fill={color} />
      </svg>
    </div>
  );
}
