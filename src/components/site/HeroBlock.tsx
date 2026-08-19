import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Award, ClipboardEdit, ChevronRight, ChevronLeft, ChevronDown, Clock } from 'lucide-react';
import HeroDividerShape from '@/components/shared/HeroDivider';
import type { BlockProps } from './shared';

interface HeroSlide { image_url: string }

/**
 * The page header.
 *
 * Pinned first and not repeatable — two heroes reads as a mistake rather than a
 * choice, and a page whose first block is something else has no header at all.
 *
 * The slideshow index lives here rather than in the page, which is the point of
 * the extraction: a block owns its own state, so adding another block cannot
 * disturb it and the page does not accumulate a variable per section.
 */
export function HeroBlock({ block, ctx, anchor }: BlockProps) {
  const { school, siteStyles, primary, secondary, linkBase } = ctx;
  const c = block.content as Record<string, unknown>;

  const slides = (c.slides ?? []) as HeroSlide[];
  const imageUrl = (c.image_url ?? null) as string | null;
  const hours = (c.hours ?? null) as string | null;

  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => setSlideIndex((i) => (i + 1) % slides.length), 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const headline = block.heading ?? school.hero_headline ?? `Welcome to ${school.name}`;
  const subtext =
    block.intro
    ?? school.hero_subtext
    ?? school.motto
    ?? 'Dedicated to academic excellence and character building.';

  const applyLabel   = (c.apply_label as string)   ?? 'Apply Now';
  const secondLabel  = (c.second_label as string)  ?? 'Discover More';
  const secondTarget = (c.second_target as string) ?? '#about';

  return (
    <section
      id={anchor}
      className={`ss-hero ss-hero--${siteStyles.theme.layouts.hero} ss-hero--h-${siteStyles.theme.heroHeight} ss-hero--d-${siteStyles.theme.heroDivider} relative flex min-h-screen items-center overflow-hidden`}
      style={{
        ...(!imageUrl && slides.length === 0 && {
          background: `linear-gradient(145deg, ${primary} 0%, ${primary}e0 40%, ${primary}b0 100%)`,
        }),
      }}
    >
      {/* Background — slideshow, single image, or gradient */}
      {slides.length > 0 ? (
        <>
          {slides.map((slide, i) => (
            <div
              key={i}
              className="absolute inset-0 transition-opacity duration-1000"
              style={{ opacity: slideIndex === i ? 1 : 0 }}
            >
              <img src={slide.image_url} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/50 to-black/30" />
              <div className="absolute inset-0" style={{ background: `linear-gradient(145deg, ${primary}70 0%, transparent 60%)` }} />
            </div>
          ))}
          {slides.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => setSlideIndex((i) => (i - 1 + slides.length) % slides.length)}
                className="absolute left-4 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/25"
                aria-label="Previous slide"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setSlideIndex((i) => (i + 1) % slides.length)}
                className="absolute right-4 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/25"
                aria-label="Next slide"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <div className="absolute bottom-16 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSlideIndex(i)}
                    className={`rounded-full transition-all duration-300 ${
                      slideIndex === i ? 'h-2 w-8 bg-white' : 'h-2 w-2 bg-white/40 hover:bg-white/60'
                    }`}
                    aria-label={`Go to slide ${i + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </>
      ) : imageUrl ? (
        <>
          <div className="absolute inset-0">
            <img src={imageUrl} alt="School campus" className="h-full w-full object-cover" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/50 to-black/30" />
          <div className="absolute inset-0" style={{ background: `linear-gradient(145deg, ${primary}70 0%, transparent 60%)` }} />
        </>
      ) : (
        <>
          <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full opacity-20 blur-3xl" style={{ backgroundColor: secondary }} />
          <div className="absolute bottom-0 -left-20 h-72 w-72 rounded-full opacity-15 blur-3xl" style={{ backgroundColor: secondary }} />
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          />
        </>
      )}

      <div className="relative mx-auto w-full max-w-6xl px-5 pb-24 pt-28 sm:px-8 lg:pt-36">
        <div className="flex flex-col items-center gap-10 lg:flex-row lg:items-center lg:gap-16">
          {school.logo_url && (
            <div className="ss-logo-wrap shrink-0 flex justify-center">
              <img
                src={school.logo_url}
                alt={school.name}
                className="ss-logo-img h-52 w-52 object-contain drop-shadow-2xl sm:h-64 sm:w-64 lg:h-72 lg:w-72"
              />
            </div>
          )}

          <div className="ss-hero-content flex-1 text-center lg:text-left">
            {(school.founded_year || school.county) && (
              <div className="ss-hero-badge mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
                <Award className="h-3.5 w-3.5 opacity-80" />
                {school.founded_year && `Est. ${school.founded_year}`}
                {school.founded_year && school.county && ' · '}
                {school.county && `${school.county} County`}
              </div>
            )}

            <h1 className="ss-hero-h1 text-4xl font-extrabold leading-[1.1] text-white sm:text-5xl lg:text-6xl">
              {headline}
            </h1>

            <p className="ss-hero-sub mt-5 text-base leading-relaxed text-white/70 sm:text-lg">
              {subtext}
            </p>

            <div className="ss-hero-btns mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
              <Link
                to={`${linkBase}/apply`}
                className="inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-bold text-white shadow-xl transition-all hover:scale-[1.03] hover:shadow-2xl sm:text-base"
                style={{ backgroundColor: secondary }}
              >
                <ClipboardEdit className="h-4 w-4" /> {applyLabel}
              </Link>
              <button
                type="button"
                onClick={() => ctx.scrollToSection(secondTarget)}
                className="inline-flex items-center gap-2 rounded-xl border-2 border-white/25 bg-white/10 px-8 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/20 sm:text-base"
              >
                {secondLabel} <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {hours && (
              <p className="ss-hero-hours mt-5 inline-flex items-center gap-1.5 text-xs text-white/40">
                <Clock className="h-3.5 w-3.5" /> {hours}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="ss-hero-cue absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/30">
        <ChevronDown className="h-5 w-5 animate-bounce" />
      </div>

      {/* Painted in the colour of whatever sits below, so it reads as that
          section rising into the hero. An overlay rather than a clip, which is
          why the slideshow controls and the scroll cue above survive it. */}
      <HeroDividerShape
        shape={siteStyles.theme.heroDivider}
        color={siteStyles.isDark ? 'var(--site-page-bg)' : 'var(--site-surface)'}
      />
    </section>
  );
}

export default HeroBlock;
