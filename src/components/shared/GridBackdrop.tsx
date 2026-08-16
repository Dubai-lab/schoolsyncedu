/**
 * Dark ruled backdrop.
 *
 * Replaces the blue gradient on the marketing surfaces. Four layers, because a
 * single uniform grid goes flat once it covers a whole hero:
 *
 *   1. base       near-black navy, warm enough not to look like pure #000
 *   2. fine grid  48px cells — the texture you actually notice
 *   3. major grid every 4th line brighter, so the eye finds structure instead
 *                 of an even mesh. This is what stops it reading as graph paper
 *   4. vignette   radial darkening at the edges, so content in the middle sits
 *                 forward instead of the panel looking like a flat swatch
 *
 * An optional glow adds a single soft light source. It is deliberately not
 * blue by default — the whole point of this backdrop is to get away from the
 * blue gradient it replaces.
 */

interface GridBackdropProps {
  /** Soft light bloom behind the content. 'none' keeps it purely monochrome. */
  glow?: 'none' | 'emerald' | 'violet' | 'amber';
  className?: string;
  children?: React.ReactNode;
}

const GLOW: Record<string, string> = {
  none: 'transparent',
  emerald: 'rgba(16,185,129,0.14)',
  violet: 'rgba(139,92,246,0.16)',
  amber: 'rgba(245,158,11,0.12)',
};

export default function GridBackdrop({
  glow = 'none', className = '', children,
}: GridBackdropProps) {
  return (
    <div className={`relative isolate overflow-hidden ${className}`} style={{ backgroundColor: '#060a16' }}>
      {/* Fine grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.045) 1px, transparent 1px),' +
            'linear-gradient(to bottom, rgba(255,255,255,0.045) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Major grid — every 4th line, brighter. Structure over uniformity. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.075) 1px, transparent 1px),' +
            'linear-gradient(to bottom, rgba(255,255,255,0.075) 1px, transparent 1px)',
          backgroundSize: '192px 192px',
        }}
      />

      {/* Glow */}
      {glow !== 'none' && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 60% 50% at 50% 0%, ${GLOW[glow]}, transparent 70%)`,
          }}
        />
      )}

      {/* Vignette. Pushes the corners down so the middle reads as lit. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 100% 80% at 50% 45%, transparent 30%, rgba(2,4,10,0.75) 100%)',
        }}
      />

      {/* Hairline along the top edge, so the panel meets whatever is above it
          with a defined boundary rather than a soft fade. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            'linear-gradient(to right, transparent, rgba(255,255,255,0.18), transparent)',
        }}
      />

      <div className="relative">{children}</div>
    </div>
  );
}
