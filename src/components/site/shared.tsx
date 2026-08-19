import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Users, GraduationCap, BookOpen, Star, Award, Trophy, Calculator, Music,
  Palette, Globe, Laptop, Heart, Shield, Target, Zap, Brain, Lightbulb,
  Building2, Eye, PenTool,
} from 'lucide-react';
import type { School, SiteConfig } from '@/types/school.types';
import type { buildSiteStyles } from '@/utils/siteThemeStyles';
import type { SiteBlock } from '@/types/siteBlocks';

/**
 * Everything a block needs that is not its own content.
 *
 * Passed as one object rather than a dozen props because every block wants
 * most of it, and because a block should be addable without threading five
 * more arguments through the page. The colours are pre-resolved for contrast
 * here rather than in each block — see readableBrandColor: a deep brand colour
 * on the dark preset is unreadable, and every block would otherwise have to
 * remember to do it.
 */
export interface SiteCtx {
  school: School;
  cfg: SiteConfig;
  slug: string;
  /** '' on a custom domain, '/school/:slug' otherwise. */
  linkBase: string;

  primary: string;
  secondary: string;
  primaryText: string;
  secondaryText: string;
  primaryDisplay: string;
  primaryIcon: string;
  secondaryIcon: string;
  primaryTint: string;
  secondaryTint: string;

  siteStyles: ReturnType<typeof buildSiteStyles>;
  scrollToSection: (hash: string) => void;
}

/** Props every block component takes. */
export interface BlockProps {
  block: SiteBlock;
  ctx: SiteCtx;
  /** Resolved anchor — '#gallery' for the first, '#gallery-2' for the next. */
  anchor: string;
}

// ── Icons ────────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  users: Users,
  'graduation-cap': GraduationCap,
  'book-open': BookOpen,
  star: Star,
  award: Award,
  trophy: Trophy,
  flask: Zap,
  calculator: Calculator,
  music: Music,
  palette: Palette,
  globe: Globe,
  laptop: Laptop,
  heart: Heart,
  shield: Shield,
  target: Target,
  zap: Zap,
  brain: Brain,
  lightbulb: Lightbulb,
  building: Building2,
  library: BookOpen,
  microscope: Eye,
  'pen-tool': PenTool,
};

export const getIcon = (name: string) => ICON_MAP[name] || Star;

// ── Scroll reveal ────────────────────────────────────────────────────────────

/**
 * Callback ref rather than useEffect with an empty dependency list: the element
 * mounts after the school data loads, and an effect that ran once on mount
 * would be observing nothing.
 */
export function useInView(threshold = 0.12) {
  const [visible, setVisible] = useState(false);
  const obsRef = useRef<IntersectionObserver | null>(null);

  const ref = useCallback((el: HTMLDivElement | null) => {
    if (obsRef.current) { obsRef.current.disconnect(); obsRef.current = null; }
    if (!el) return;
    obsRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obsRef.current?.disconnect();
          obsRef.current = null;
        }
      },
      { threshold },
    );
    obsRef.current.observe(el);
  }, [threshold]);

  return [ref, visible] as const;
}

export const fadeUp = (delay: number, visible: boolean) => ({
  opacity: visible ? 1 : 0,
  transform: visible ? 'none' : 'translateY(30px)',
  transition: `opacity 0.65s ease ${delay}ms, transform 0.65s ease ${delay}ms`,
});

export const scaleUp = (delay: number, visible: boolean) => ({
  opacity: visible ? 1 : 0,
  transform: visible ? 'none' : 'scale(0.88)',
  transition: `opacity 0.55s ease ${delay}ms, transform 0.55s cubic-bezier(0.34,1.56,0.64,1) ${delay}ms`,
});

export const slideLeft = (delay: number, visible: boolean) => ({
  opacity: visible ? 1 : 0,
  transform: visible ? 'none' : 'translateX(-44px)',
  transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
});

export const slideRight = (delay: number, visible: boolean) => ({
  opacity: visible ? 1 : 0,
  transform: visible ? 'none' : 'translateX(44px)',
  transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
});

// ── Counting statistic ───────────────────────────────────────────────────────

function useCountUp(target: number, active: boolean, duration = 1400) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active || !target) return;
    let frame: number;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - p) ** 3;
      setCount(Math.floor(eased * target));
      if (p < 1) { frame = requestAnimationFrame(tick); }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, target, duration]);
  return count;
}

export function StatValue({ raw, active }: { raw: string; active: boolean }) {
  const numeric = parseInt(raw.replace(/\D/g, ''), 10) || 0;
  const suffix  = raw.replace(/[\d,]+/, '');
  const count   = useCountUp(numeric, active);
  return <>{active && numeric > 0 ? `${count.toLocaleString()}${suffix}` : raw}</>;
}

// ── Section heading ──────────────────────────────────────────────────────────

export const SectionLabel = ({ text, color }: { text: string; color: string }) => (
  <div className="flex items-center justify-center gap-2 mb-3">
    <div className="h-px w-8 rounded-full" style={{ backgroundColor: color }} />
    <p className="text-xs font-bold uppercase tracking-[0.15em]" style={{ color }}>{text}</p>
    <div className="h-px w-8 rounded-full" style={{ backgroundColor: color }} />
  </div>
);

/**
 * A section's label, title and optional intro.
 *
 * The wording used to be hardcoded into each section, which is the single
 * biggest reason two school sites read the same: every school in the country
 * told visitors it was "committed to educational excellence", in those words,
 * because the sentence was in the source. The built-in wording is now a
 * default the block can override, so a school that has set nothing is
 * unchanged and one that has something better to say can say it.
 */
export function BlockHead({
  block, ctx, defaultLabel, defaultHeading, defaultIntro,
}: {
  block: SiteBlock;
  ctx: SiteCtx;
  defaultLabel: string;
  defaultHeading: string;
  defaultIntro?: string;
}) {
  const label   = block.label   ?? defaultLabel;
  const heading = block.heading ?? defaultHeading;
  const intro   = block.intro   ?? defaultIntro;

  return (
    <div className="ss-section-head text-center mb-14">
      {label && <SectionLabel text={label} color={ctx.secondary} />}
      <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl lg:text-5xl">
        {heading}
      </h2>
      {intro && (
        <p className="mx-auto mt-4 max-w-2xl text-base text-gray-500">{intro}</p>
      )}
    </div>
  );
}
