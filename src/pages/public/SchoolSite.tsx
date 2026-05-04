import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { schoolSiteService } from '@/services/schoolSiteService';
import { useDomainContext } from '@/context/DomainContext';
import type { School, SiteConfig } from '@/types/school.types';
import {
  GraduationCap,
  Users,
  BookOpen,
  Phone,
  MapPin,
  Mail,
  LogIn,
  Star,
  Award,
  Globe,
  ClipboardEdit,
  Clock,
  ChevronRight,
  Building2,
  Target,
  Eye,
  Heart,
  Shield,
  Zap,
  Brain,
  Lightbulb,
  Trophy,
  Palette,
  Music,
  Calculator,
  Laptop,
  PenTool,
  ArrowRight,
  ArrowUp,
  Menu,
  X,
  ChevronDown,
  ChevronLeft,
} from 'lucide-react';

// ==================== ICON RESOLVER ====================
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
const getIcon = (name: string) => ICON_MAP[name] || Star;

// ==================== SOCIAL ICON ====================
const SocialIcon = ({ platform }: { platform: string }) => {
  const paths: Record<string, string> = {
    facebook: 'M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z',
    twitter: 'M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z',
    instagram: 'M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37zM17.5 6.5h.01M7.5 2h9A5.5 5.5 0 0122 7.5v9a5.5 5.5 0 01-5.5 5.5h-9A5.5 5.5 0 012 16.5v-9A5.5 5.5 0 017.5 2z',
    youtube: 'M22.54 6.42a2.78 2.78 0 00-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 00-1.94 2A29 29 0 001 11.75a29 29 0 00.46 5.33A2.78 2.78 0 003.4 19.1c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 001.94-2 29 29 0 00.46-5.25 29 29 0 00-.46-5.43zM9.75 15.02V8.48l5.75 3.27-5.75 3.27z',
    linkedin: 'M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-4 0v7h-4v-7a6 6 0 016-6zM2 9h4v12H2zM4 2a2 2 0 110 4 2 2 0 010-4z',
    tiktok: 'M9 12a4 4 0 104 4V4a5 5 0 005 5',
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d={paths[platform] || paths.tiktok} />
    </svg>
  );
};

// ==================== SECTION LABEL ====================
const SectionLabel = ({ text, color }: { text: string; color: string }) => (
  <div className="flex items-center justify-center gap-2 mb-3">
    <div className="h-px w-8 rounded-full" style={{ backgroundColor: color }} />
    <p className="text-xs font-bold uppercase tracking-[0.15em]" style={{ color }}>{text}</p>
    <div className="h-px w-8 rounded-full" style={{ backgroundColor: color }} />
  </div>
);

// ==================== ANIMATION HELPERS ====================
function useInView(threshold = 0.12) {
  const [visible, setVisible] = useState(false);
  const obsRef = useRef<IntersectionObserver | null>(null);

  // Callback ref fires whenever the DOM element mounts/unmounts, including
  // after async data loads — avoids the stale-ref bug with useEffect+[].
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

function StatValue({ raw, active }: { raw: string; active: boolean }) {
  const numeric = parseInt(raw.replace(/\D/g, ''), 10) || 0;
  const suffix  = raw.replace(/[\d,]+/, '');
  const count   = useCountUp(numeric, active);
  return <>{active && numeric > 0 ? `${count.toLocaleString()}${suffix}` : raw}</>;
}

const fadeUp = (delay: number, visible: boolean) => ({
  opacity: visible ? 1 : 0,
  transform: visible ? 'none' : 'translateY(30px)',
  transition: `opacity 0.65s ease ${delay}ms, transform 0.65s ease ${delay}ms`,
});

const scaleUp = (delay: number, visible: boolean) => ({
  opacity: visible ? 1 : 0,
  transform: visible ? 'none' : 'scale(0.88)',
  transition: `opacity 0.55s ease ${delay}ms, transform 0.55s cubic-bezier(0.34,1.56,0.64,1) ${delay}ms`,
});

const slideLeft = (delay: number, visible: boolean) => ({
  opacity: visible ? 1 : 0,
  transform: visible ? 'none' : 'translateX(-44px)',
  transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
});

const slideRight = (delay: number, visible: boolean) => ({
  opacity: visible ? 1 : 0,
  transform: visible ? 'none' : 'translateX(44px)',
  transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
});

function scrollToSection(hash: string) {
  const id = hash.startsWith('#') ? hash.slice(1) : hash;
  const el = document.getElementById(id);
  if (!el) return;
  const navHeight = 72;
  const top = el.getBoundingClientRect().top + window.scrollY - navHeight;
  window.scrollTo({ top, behavior: 'smooth' });
}

export default function SchoolSite() {
  const { slug: slugParam } = useParams<{ slug: string }>();
  const { isCustomDomain, schoolSlug: domainSlug } = useDomainContext();
  const slug = slugParam ?? domainSlug ?? '';
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showBackTop, setShowBackTop] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const heroRef = useRef<HTMLElement>(null);

  const [statsRef,  statsVisible]  = useInView();
  const [aboutRef,  aboutVisible]  = useInView();
  const [progsRef,  progsVisible]  = useInView();
  const [newsRef,   newsVisible]   = useInView();
  const [gallRef,   gallVisible]   = useInView();
  const [staffRef,  staffVisible]  = useInView();
  const [ctaRef,    ctaVisible]    = useInView();
  const [contRef,   contVisible]   = useInView();
  const [testimonRef, testimonVisible] = useInView();

  // On custom domain/subdomain, restore the clean URL (hide /school/slug from address bar)
  useEffect(() => {
    if (isCustomDomain) {
      window.history.replaceState(null, '', '/');
    }
  }, [isCustomDomain]);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 60);
      setShowBackTop(window.scrollY > 500);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Hero slideshow auto-advance
  useEffect(() => {
    const slides = school?.site_config?.hero_slides ?? [];
    if (slides.length <= 1) return;
    const timer = setInterval(() => setSlideIndex((i) => (i + 1) % slides.length), 5000);
    return () => clearInterval(timer);
  }, [school?.site_config?.hero_slides]);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setNotFound(false);
    schoolSiteService
      .getBySlug(slug)
      .then((data) => {
        if (!data) { setNotFound(true); return; }
        // If school has an active subdomain and visitor is on the default URL,
        // redirect permanently so only one domain is ever active.
        if (data.subdomain_active && data.subdomain && !isCustomDomain) {
          window.location.replace(`https://${data.subdomain}.schoolsyncedu.com`);
          return;
        }
        setSchool(data);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug, isCustomDomain]);

  // Inject school-specific PWA manifest + register service worker so
  // students can install the school's portal as a home screen app.
  useEffect(() => {
    if (!school || !slug) return;

    // 1. Inject school-specific manifest
    const params = new URLSearchParams({
      name:  school.name,
      slug,
      color: school.primary_color || '#1e3a5f',
      ...(school.logo_url ? { logo: school.logo_url } : {}),
    });

    const existing = document.querySelector('link[rel="manifest"]');
    if (existing) existing.remove();

    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = `/api/school-manifest?${params.toString()}`;
    document.head.appendChild(link);

    // 2. Register service worker (makes app installable on mobile)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // SW registration failure is non-fatal — site still works
      });
    }

    // 3. Update page title to school name
    document.title = school.name;

    return () => {
      link.remove();
      document.title = 'SchoolSync';
    };
  }, [school, slug]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="text-gray-400 text-sm">Loading school site...</p>
        </div>
      </div>
    );
  }

  if (notFound || !school) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4">
        <GraduationCap className="mb-4 h-16 w-16 text-gray-200" />
        <h1 className="text-2xl font-bold text-gray-900">School Not Found</h1>
        <p className="mt-2 text-gray-500 text-center max-w-sm">
          The school you're looking for doesn't exist or hasn't published their site yet.
        </p>
        <Link to="/" className="mt-6 text-blue-600 underline hover:text-blue-800 text-sm">
          Go to SchoolSync
        </Link>
      </div>
    );
  }

  if ((school as any).is_online === false) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 px-4 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gray-800">
          <GraduationCap className="h-10 w-10 text-gray-500" />
        </div>
        <h1 className="text-2xl font-bold text-white">{school.name}</h1>
        <p className="mt-3 text-base text-gray-400 max-w-sm">
          This school's portal is currently <span className="text-red-400 font-semibold">offline</span>.
        </p>
        <p className="mt-2 text-sm text-gray-500 max-w-sm">
          If you are a student or staff member, please contact your school administrator.
          The school may be renewing their subscription.
        </p>
        <div className="mt-8 rounded-lg border border-gray-800 bg-gray-900 px-6 py-4 text-sm text-gray-400">
          School administrators can restore access at{' '}
          <a href="mailto:support@schoolsyncedu.com" className="text-blue-400 underline">
            support@schoolsyncedu.com
          </a>
        </div>
      </div>
    );
  }

  const primary = school.primary_color || '#1e40af';
  const secondary = school.secondary_color || '#f59e0b';
  const heroHeadline = school.hero_headline || `Welcome to ${school.name}`;
  const heroSubtext =
    school.hero_subtext ||
    school.motto ||
    'Dedicated to academic excellence and character building.';
  const aboutText =
    school.about_text ||
    `${school.name} is a premier educational institution located in ${school.location || 'Liberia'}. We are committed to providing quality education and shaping the leaders of tomorrow.`;

  const cfg: SiteConfig = school.site_config ?? {};
  const vis = cfg.sections_visible ?? {};
  const show = (section: string) => vis[section] !== false;

  const hasPrograms = show('programs') && (cfg.programs ?? []).length > 0;
  const hasGallery = show('gallery') && (cfg.gallery_images ?? []).length > 0;
  const hasStaff = show('administration') && (cfg.staff ?? []).length > 0;
  const socialLinks = Object.entries(cfg.social_links ?? {}).filter(([, url]) => url);
  const heroSlides = cfg.hero_slides ?? [];

  // On custom domain/subdomain, use root-relative paths so the slug never appears in the URL
  const linkBase = isCustomDomain ? '' : `/school/${slug}`;

  const navLinks = [
    { label: 'Home', href: '#home' },
    ...(show('about') ? [{ label: 'About', href: '#about' }] : []),
    ...(hasPrograms ? [{ label: 'Programs', href: '#programs' }] : []),
    ...(hasGallery ? [{ label: 'Gallery', href: '#gallery' }] : []),
    ...(hasStaff ? [{ label: 'Team', href: '#administration' }] : []),
    ...(cfg.fee_schedule?.published ? [{ label: 'Fees', href: `/school/${slug}/fees` }] : []),
    { label: 'Contact', href: '#contact' },
  ];

  return (
    <>
    <style>{`
      @keyframes ssScaleIn {
        from { opacity: 0; transform: scale(0.55); }
        to   { opacity: 1; transform: scale(1); }
      }
      @keyframes ssFloat {
        0%, 100% { transform: translateY(0px); }
        50%       { transform: translateY(-14px); }
      }
      @keyframes ssFadeDown {
        from { opacity: 0; transform: translateY(-18px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes ssFadeUp {
        from { opacity: 0; transform: translateY(36px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes ssFadeIn {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
      @keyframes ssPulseRing {
        0%   { box-shadow: 0 0 0 0 rgba(255,255,255,0.25); }
        70%  { box-shadow: 0 0 0 16px rgba(255,255,255,0); }
        100% { box-shadow: 0 0 0 0 rgba(255,255,255,0); }
      }
      @keyframes ssWAFloat {
        0%, 100% { transform: translateY(0px) scale(1); }
        50%       { transform: translateY(-7px) scale(1.04); }
      }
      @keyframes ssWAPulse {
        0%   { box-shadow: 0 0 0 0 rgba(37,211,102,0.55); }
        70%  { box-shadow: 0 0 0 20px rgba(37,211,102,0); }
        100% { box-shadow: 0 0 0 0 rgba(37,211,102,0); }
      }
      .ss-logo-wrap   { animation: ssScaleIn 0.9s cubic-bezier(0.34,1.56,0.64,1) both; }
      .ss-logo-img    { animation: ssFloat 5s ease-in-out 1.1s infinite; }
      .ss-hero-badge  { animation: ssFadeDown 0.6s ease 0.3s both; }
      .ss-hero-h1     { animation: ssFadeUp 0.75s ease 0.45s both; }
      .ss-hero-sub    { animation: ssFadeUp 0.75s ease 0.65s both; }
      .ss-hero-btns   { animation: ssFadeUp 0.7s ease 0.85s both; }
      .ss-hero-hours  { animation: ssFadeIn 0.6s ease 1.1s both; }
      .ss-wa-btn      { animation: ssWAFloat 3s ease-in-out infinite, ssWAPulse 2.5s ease-out 2s infinite; }
    `}</style>
    <div className="min-h-screen bg-white antialiased" style={{ '--school-primary': primary, '--school-secondary': secondary } as React.CSSProperties}>

      {/* ===== NAVBAR ===== */}
      <nav
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-white/98 shadow-md backdrop-blur-md border-b border-gray-100'
            : 'bg-transparent'
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-2 sm:px-8">
          {/* Logo + Name */}
          <div className="flex items-center gap-3">
            {school.logo_url ? (
              <img src={school.logo_url} alt={school.name} className="h-10 w-10 object-contain" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: primary }}>
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
            )}
            <div>
              <p className={`text-sm font-extrabold leading-tight tracking-tight transition-colors ${scrolled ? 'text-gray-900' : 'text-white'}`}>
                {school.name}
              </p>
              {school.motto && (
                <p className={`text-[10px] italic leading-tight transition-colors ${scrolled ? 'text-gray-400' : 'text-white/60'}`}>
                  {school.motto}
                </p>
              )}
            </div>
          </div>

          {/* Desktop links */}
          <div className="hidden items-center gap-7 md:flex">
            {navLinks.map((lnk) =>
              lnk.href.startsWith('#') ? (
                <button
                  key={lnk.label}
                  type="button"
                  onClick={() => scrollToSection(lnk.href)}
                  className={`text-sm font-medium transition-colors hover:opacity-100 ${
                    scrolled ? 'text-gray-600 hover:text-gray-900' : 'text-white/75 hover:text-white'
                  }`}
                >
                  {lnk.label}
                </button>
              ) : (
                <Link
                  key={lnk.label}
                  to={lnk.href}
                  className={`text-sm font-medium transition-colors hover:opacity-100 ${
                    scrolled ? 'text-gray-600 hover:text-gray-900' : 'text-white/75 hover:text-white'
                  }`}
                >
                  {lnk.label}
                </Link>
              )
            )}
          </div>

          {/* CTAs */}
          <div className="hidden items-center gap-2.5 md:flex">
            <Link
              to={`${linkBase}/apply`}
              className="rounded-lg px-4 py-2 text-sm font-bold transition-all hover:opacity-90 hover:shadow-md"
              style={{ backgroundColor: secondary, color: '#fff' }}
            >
              Apply Now
            </Link>
            <Link
              to={`${linkBase}/login`}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-semibold transition-all hover:shadow-md ${
                scrolled
                  ? 'border-gray-200 bg-white text-gray-800 hover:border-gray-300'
                  : 'border-white/30 bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <LogIn className="h-3.5 w-3.5" /> Portal
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`rounded-xl p-2 transition-colors md:hidden ${
              scrolled ? 'text-gray-700 hover:bg-gray-100' : 'text-white hover:bg-white/10'
            }`}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="border-t border-gray-100 bg-white px-5 pb-5 pt-4 shadow-lg md:hidden">
            <div className="flex flex-col gap-1">
              {navLinks.map((lnk) =>
                lnk.href.startsWith('#') ? (
                  <button
                    key={lnk.label}
                    type="button"
                    onClick={() => { scrollToSection(lnk.href); setMobileMenuOpen(false); }}
                    className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {lnk.label}
                  </button>
                ) : (
                  <Link
                    key={lnk.label}
                    to={lnk.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {lnk.label}
                  </Link>
                )
              )}
              <div className="mt-3 flex flex-col gap-2 border-t border-gray-100 pt-3">
                <Link
                  to={`${linkBase}/apply`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-xl py-3 text-center text-sm font-bold text-white"
                  style={{ backgroundColor: secondary }}
                >
                  Apply Now
                </Link>
                <Link
                  to={`${linkBase}/login`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-700"
                >
                  <LogIn className="h-4 w-4" /> Portal Login
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ===== HERO ===== */}
      {show('hero') && (
        <section
          id="home"
          ref={heroRef}
          className="relative flex min-h-screen items-center overflow-hidden"
          style={!cfg.hero_image_url ? {
            background: `linear-gradient(145deg, ${primary} 0%, ${primary}e0 40%, ${primary}b0 100%)`,
          } : undefined}
        >
          {/* Background — slideshow, single image, or gradient */}
          {heroSlides.length > 0 ? (
            <>
              {heroSlides.map((slide, i) => (
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
              {/* Prev / Next arrows */}
              {heroSlides.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setSlideIndex((i) => (i - 1 + heroSlides.length) % heroSlides.length)}
                    className="absolute left-4 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/25"
                    aria-label="Previous slide"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSlideIndex((i) => (i + 1) % heroSlides.length)}
                    className="absolute right-4 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/25"
                    aria-label="Next slide"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  {/* Dots indicator */}
                  <div className="absolute bottom-16 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2">
                    {heroSlides.map((_, i) => (
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
          ) : cfg.hero_image_url ? (
            <>
              <div className="absolute inset-0">
                <img src={cfg.hero_image_url} alt="School campus" className="h-full w-full object-cover" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/50 to-black/30" />
              <div className="absolute inset-0" style={{ background: `linear-gradient(145deg, ${primary}70 0%, transparent 60%)` }} />
            </>
          ) : (
            <>
              {/* Decorative blobs */}
              <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full opacity-20 blur-3xl" style={{ backgroundColor: secondary }} />
              <div className="absolute bottom-0 -left-20 h-72 w-72 rounded-full opacity-15 blur-3xl" style={{ backgroundColor: secondary }} />
              <div className="absolute inset-0 opacity-[0.04]"
                style={{
                  backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)',
                  backgroundSize: '32px 32px',
                }}
              />
            </>
          )}

          <div className="relative mx-auto w-full max-w-6xl px-5 pb-24 pt-28 sm:px-8 lg:pt-36">
            <div className="flex flex-col items-center gap-10 lg:flex-row lg:items-center lg:gap-16">

              {/* School crest — large, left column on desktop */}
              {school.logo_url && (
                <div className="ss-logo-wrap shrink-0 flex justify-center">
                  <img
                    src={school.logo_url}
                    alt={school.name}
                    className="ss-logo-img h-52 w-52 object-contain drop-shadow-2xl sm:h-64 sm:w-64 lg:h-72 lg:w-72"
                  />
                </div>
              )}

              {/* Text content — right column on desktop */}
              <div className="flex-1 text-center lg:text-left">
                {/* Badge */}
                {(school.founded_year || school.county) && (
                  <div className="ss-hero-badge mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
                    <Award className="h-3.5 w-3.5 opacity-80" />
                    {school.founded_year && `Est. ${school.founded_year}`}
                    {school.founded_year && school.county && ' · '}
                    {school.county && `${school.county} County`}
                  </div>
                )}

                <h1 className="ss-hero-h1 text-4xl font-extrabold leading-[1.1] text-white sm:text-5xl lg:text-6xl">
                  {heroHeadline}
                </h1>

                <p className="ss-hero-sub mt-5 text-base leading-relaxed text-white/70 sm:text-lg">
                  {heroSubtext}
                </p>

                <div className="ss-hero-btns mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
                  <Link
                    to={`${linkBase}/apply`}
                    className="inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-bold text-white shadow-xl transition-all hover:scale-[1.03] hover:shadow-2xl sm:text-base"
                    style={{ backgroundColor: secondary }}
                  >
                    <ClipboardEdit className="h-4 w-4" /> Apply Now
                  </Link>
                  <button
                    type="button"
                    onClick={() => scrollToSection('#about')}
                    className="inline-flex items-center gap-2 rounded-xl border-2 border-white/25 bg-white/10 px-8 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/20 sm:text-base"
                  >
                    Discover More <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                {cfg.school_hours && (
                  <p className="ss-hero-hours mt-5 inline-flex items-center gap-1.5 text-xs text-white/40">
                    <Clock className="h-3.5 w-3.5" /> {cfg.school_hours}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Scroll cue */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/30">
            <ChevronDown className="h-5 w-5 animate-bounce" />
          </div>
        </section>
      )}

      {/* ===== STATS ===== */}
      {show('stats') && (cfg.stats ?? []).length > 0 && (
        <section className="relative bg-white">
          <div className="absolute -top-px left-0 right-0 h-1" style={{ backgroundColor: secondary }} />
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div ref={statsRef}
              className="grid divide-x divide-gray-100"
              style={{ gridTemplateColumns: `repeat(${Math.min((cfg.stats ?? []).length, 5)}, minmax(0, 1fr))` }}
            >
              {(cfg.stats ?? []).map((s, i) => {
                const Icon = getIcon(s.icon);
                const accent = i % 2 === 0 ? primary : secondary;
                return (
                  <div key={i} className="group flex flex-col items-center py-10 px-4 transition-colors hover:bg-gray-50/60"
                    style={fadeUp(i * 80, statsVisible)}
                  >
                    <div
                      className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl transition-transform group-hover:scale-110"
                      style={{ backgroundColor: accent + '15' }}
                    >
                      <Icon className="h-5 w-5" style={{ color: accent }} />
                    </div>
                    <p className="text-3xl font-extrabold tracking-tight sm:text-4xl" style={{ color: primary }}>
                      <StatValue raw={s.value} active={statsVisible} />
                    </p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-gray-400">{s.label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ===== ABOUT ===== */}
      {show('about') && (
        <section id="about" className="px-5 py-20 sm:px-8 sm:py-28">
          <div className="mx-auto max-w-6xl">
            <div className="text-center mb-14">
              <SectionLabel text="About Our School" color={secondary} />
              <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl lg:text-5xl">
                {cfg.mission_text ? 'Our Story & Mission' : `About ${school.name}`}
              </h2>
            </div>

            <div ref={aboutRef} className="grid grid-cols-1 gap-16 lg:grid-cols-2 lg:items-start">
              {/* Text side */}
              <div className="space-y-6" style={slideLeft(0, aboutVisible)}>
                {/* School identity badge */}
                <div className="flex items-center gap-2">
                  <div className="h-px w-10 rounded-full" style={{ backgroundColor: secondary }} />
                  <span className="text-sm font-semibold" style={{ color: primary }}>{school.name}</span>
                </div>
                <p className="text-base leading-8 text-gray-600 sm:text-lg">{aboutText}</p>

                {cfg.mission_text && (
                  <div
                    className="relative overflow-hidden rounded-2xl p-6"
                    style={{ backgroundColor: primary + '08', borderLeft: `4px solid ${primary}` }}
                  >
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest" style={{ color: primary }}>Our Mission</p>
                    <p className="text-sm leading-7 text-gray-600">{cfg.mission_text}</p>
                  </div>
                )}

                {cfg.vision_text && (
                  <div
                    className="relative overflow-hidden rounded-2xl p-6"
                    style={{ backgroundColor: secondary + '0c', borderLeft: `4px solid ${secondary}` }}
                  >
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest" style={{ color: secondary }}>Our Vision</p>
                    <p className="text-sm leading-7 text-gray-600">{cfg.vision_text}</p>
                  </div>
                )}

                {/* Principal quote */}
                {cfg.principal_message && (
                  <div className="mt-6 flex items-start gap-4 rounded-2xl border border-gray-100 bg-gray-50 p-5">
                    {cfg.principal_image_url ? (
                      <img
                        src={cfg.principal_image_url}
                        alt={school.principal_name || 'Principal'}
                        className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-offset-2"
                        style={{ outlineColor: primary }}
                      />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: primary + '15' }}>
                        <Users className="h-6 w-6" style={{ color: primary }} />
                      </div>
                    )}
                    <div>
                      <p className="text-sm italic leading-7 text-gray-500">"{cfg.principal_message}"</p>
                      <p className="mt-2 text-xs font-bold text-gray-800">— {school.principal_name || 'The Principal'}</p>
                      {cfg.principal_title && (
                        <p className="text-xs text-gray-400">{cfg.principal_title}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Visual side */}
              <div style={slideRight(100, aboutVisible)}>
                {cfg.building_image_url ? (
                  <div className="relative">
                    <div className="absolute -inset-4 rounded-3xl opacity-30 blur-2xl" style={{ backgroundColor: primary }} />
                    <div className="relative overflow-hidden rounded-3xl shadow-2xl">
                      <img src={cfg.building_image_url} alt={`${school.name} Campus`} className="h-auto w-full object-cover" />
                    </div>
                    {school.founded_year && (
                      <div className="absolute -bottom-4 -right-4 rounded-2xl px-5 py-3 text-center text-white shadow-xl"
                        style={{ backgroundColor: secondary }}>
                        <p className="text-xs font-medium opacity-80">Founded</p>
                        <p className="text-2xl font-extrabold">{school.founded_year}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { icon: GraduationCap, label: 'Academic Excellence', sub: 'Rigorous curriculum for every learner', color: primary },
                      { icon: Users, label: 'Dedicated Faculty', sub: 'Experienced and caring educators', color: secondary },
                      { icon: Shield, label: 'Safe Environment', sub: 'Nurturing spaces for growth', color: '#16a34a' },
                      { icon: Heart, label: 'Character Building', sub: 'Values-driven education', color: '#9333ea' },
                    ].map((f) => (
                      <div
                        key={f.label}
                        className="group flex flex-col rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:shadow-lg hover:-translate-y-0.5"
                      >
                        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: f.color + '12' }}>
                          <f.icon className="h-5 w-5" style={{ color: f.color }} />
                        </div>
                        <p className="text-sm font-bold text-gray-900">{f.label}</p>
                        <p className="mt-1 text-xs leading-relaxed text-gray-400">{f.sub}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ===== PROGRAMS ===== */}
      {show('programs') && (cfg.programs ?? []).length > 0 && (
        <section id="programs" className="px-5 py-20 sm:px-8 sm:py-28" style={{ backgroundColor: '#f8fafc' }}>
          <div className="mx-auto max-w-6xl">
            <div className="text-center mb-14">
              <SectionLabel text="What We Offer" color={secondary} />
              <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl lg:text-5xl">Academic Programs</h2>
            </div>
            <div ref={progsRef} className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {(cfg.programs ?? []).map((prog, i) => {
                const Icon = getIcon(prog.icon);
                return (
                  <div
                    key={i}
                    className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-7 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl"
                    style={fadeUp(i * 100, progsVisible)}
                  >
                    {/* Gradient top accent */}
                    <div
                      className="absolute inset-x-0 top-0 h-1 rounded-t-2xl"
                      style={{ background: `linear-gradient(90deg, ${primary}, ${secondary})` }}
                    />
                    <div
                      className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl transition-transform group-hover:scale-110"
                      style={{ backgroundColor: primary + '10' }}
                    >
                      <Icon className="h-6 w-6" style={{ color: primary }} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">{prog.name}</h3>
                    <p className="mt-2 text-sm leading-7 text-gray-500">{prog.description}</p>
                    <div className="mt-4 flex items-center gap-1 text-xs font-semibold" style={{ color: primary }}>
                      Learn more <ChevronRight className="h-3.5 w-3.5" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ===== ANNOUNCEMENTS ===== */}
      {show('announcements') && (cfg.announcements ?? []).length > 0 && (
        <section className="px-5 py-20 sm:px-8 sm:py-28 bg-white">
          <div className="mx-auto max-w-6xl">
            <div className="text-center mb-14">
              <SectionLabel text="Stay Informed" color={secondary} />
              <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl lg:text-5xl">News & Announcements</h2>
            </div>
            <div ref={newsRef} className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {(cfg.announcements ?? []).slice(0, 6).map((item, i) => {
                const d = new Date(item.date);
                return (
                  <article
                    key={i}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
                    style={fadeUp(i * 90, newsVisible)}
                  >
                    {/* Date band */}
                    <div className="flex items-center gap-3 px-5 py-3.5" style={{ backgroundColor: primary + '08' }}>
                      <div
                        className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl text-white"
                        style={{ backgroundColor: primary }}
                      >
                        <span className="text-xs font-bold leading-none">
                          {d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                        </span>
                        <span className="text-sm font-extrabold leading-tight">{d.getDate()}</span>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: secondary }}>
                          {(item as any).category || 'Announcement'}
                        </p>
                        <p className="text-xs text-gray-400">{d.getFullYear()}</p>
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <h3 className="text-base font-bold text-gray-900 group-hover:text-blue-700 transition-colors">{item.title}</h3>
                      <p className="mt-2 flex-1 text-sm leading-7 text-gray-500">{item.excerpt}</p>
                      <div className="mt-4 flex items-center gap-1 text-xs font-semibold" style={{ color: primary }}>
                        Read more <ChevronRight className="h-3.5 w-3.5" />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ===== GALLERY ===== */}
      {show('gallery') && (cfg.gallery_images ?? []).length > 0 && (
        <section id="gallery" className="px-5 py-20 sm:px-8 sm:py-28" style={{ backgroundColor: '#f8fafc' }}>
          <div className="mx-auto max-w-6xl">
            <div className="text-center mb-14">
              <SectionLabel text="School Life" color={secondary} />
              <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl lg:text-5xl">Photo Gallery</h2>
            </div>
            <div ref={gallRef} className="columns-2 gap-3 sm:columns-3 lg:columns-4">
              {(cfg.gallery_images ?? []).map((img, i) => (
                <div key={i} className="group relative mb-3 overflow-hidden rounded-2xl break-inside-avoid shadow-sm"
                  style={scaleUp(i * 60, gallVisible)}
                >
                  <img
                    src={img.url}
                    alt={img.caption || `School life ${i + 1}`}
                    className="w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    style={{ minHeight: i % 3 === 0 ? '220px' : '160px' }}
                  />
                  <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    {img.caption && (
                      <p className="p-3 text-xs font-medium text-white">{img.caption}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== ADMINISTRATION ===== */}
      {hasStaff && (
        <section id="administration" className="bg-white px-5 py-20 sm:px-8 sm:py-28">
          <div className="mx-auto max-w-6xl">
            <div className="mb-14 text-center">
              <SectionLabel text="Our Leadership" color={secondary} />
              <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl lg:text-5xl">
                Meet Our Administration
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base text-gray-500">
                Our dedicated leadership team committed to educational excellence.
              </p>
            </div>

            <div ref={staffRef} className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {(cfg.staff ?? []).map((member, i) => (
                <div
                  key={i}
                  className="group overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl"
                  style={scaleUp(i * 100, staffVisible)}
                >
                  {/* Top gradient accent strip */}
                  <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${primary}, ${secondary})` }} />

                  <div className="p-6 text-center">
                    {/* Photo with gradient ring */}
                    <div className="relative mx-auto mb-4 h-24 w-24">
                      <div
                        className="absolute inset-0 rounded-full"
                        style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
                      />
                      <div className="absolute inset-[3px] overflow-hidden rounded-full bg-white">
                        {member.photo_url ? (
                          <img
                            src={member.photo_url}
                            alt={member.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div
                            className="flex h-full w-full items-center justify-center"
                            style={{ backgroundColor: primary + '15' }}
                          >
                            <Users className="h-9 w-9" style={{ color: primary }} />
                          </div>
                        )}
                      </div>
                    </div>

                    <h3 className="text-sm font-bold text-gray-900">{member.name}</h3>
                    <span
                      className="mt-2 inline-block rounded-full px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white"
                      style={{ backgroundColor: primary }}
                    >
                      {member.role}
                    </span>
                    {member.bio && (
                      <p className="mt-3 text-xs leading-relaxed text-gray-500">{member.bio}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== TESTIMONIALS ===== */}
      {show('testimonials') && (cfg.testimonials ?? []).length > 0 && (
        <section className="px-5 py-20 sm:px-8 sm:py-28" style={{ backgroundColor: '#f8fafc' }}>
          <div className="mx-auto max-w-6xl">
            <div className="text-center mb-14">
              <SectionLabel text="What Parents Say" color={secondary} />
              <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl lg:text-5xl">
                Testimonials
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-base text-gray-500">
                Hear from the families and students who are part of our community.
              </p>
            </div>

            <div ref={testimonRef} className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {(cfg.testimonials ?? []).map((t, i) => (
                <div
                  key={i}
                  className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-7 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl"
                  style={scaleUp(i * 100, testimonVisible)}
                >
                  {/* Decorative top strip */}
                  <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl" style={{ background: `linear-gradient(90deg, ${primary}, ${secondary})` }} />

                  {/* Big decorative quote mark */}
                  <div className="absolute right-5 top-5 font-serif text-7xl leading-none opacity-[0.07]" style={{ color: primary }}>"</div>

                  {/* Star rating */}
                  {(t.rating ?? 0) > 0 && (
                    <div className="mb-4 flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <svg key={star} viewBox="0 0 20 20" className={`h-4 w-4 ${star <= (t.rating ?? 0) ? 'fill-amber-400' : 'fill-gray-200'}`}>
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                  )}

                  {/* Quote */}
                  <p className="relative text-sm leading-7 text-gray-600 italic">"{t.quote}"</p>

                  {/* Author */}
                  <div className="mt-6 flex items-center gap-3 border-t border-gray-50 pt-5">
                    {t.photo_url ? (
                      <img src={t.photo_url} alt={t.name} className="h-11 w-11 rounded-full object-cover ring-2 ring-offset-1" style={{ outlineColor: primary }} />
                    ) : (
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                        style={{ backgroundColor: primary }}
                      >
                        {t.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-bold text-gray-900">{t.name}</p>
                      <p className="text-xs text-gray-400">{t.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== CTA BAND ===== */}
      <section
        className="relative overflow-hidden px-5 py-16 sm:px-8"
        style={{ background: `linear-gradient(135deg, ${primary} 0%, ${primary}cc 100%)` }}
      >
        <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full opacity-10 blur-3xl" style={{ backgroundColor: secondary }} />
        <div className="absolute bottom-0 left-10 h-40 w-40 rounded-full opacity-10 blur-2xl" style={{ backgroundColor: secondary }} />
        <div ref={ctaRef} className="relative mx-auto flex max-w-5xl flex-col items-center gap-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <div style={slideLeft(0, ctaVisible)}>
            <p className="text-xs font-bold uppercase tracking-widest text-white/50 mb-1">Join Our Community</p>
            <h2 className="text-2xl font-extrabold text-white sm:text-3xl lg:text-4xl">
              Ready to Join {school.name}?
            </h2>
            <p className="mt-1.5 text-sm text-white/60">Applications are open. Start your journey with us today.</p>
          </div>
          <div style={slideRight(200, ctaVisible)}>
            <Link
              to={`${linkBase}/apply`}
              className="inline-flex items-center gap-2.5 rounded-2xl px-8 py-4 text-sm font-extrabold text-white shadow-xl transition-all hover:scale-[1.03] hover:shadow-2xl whitespace-nowrap sm:text-base"
              style={{ backgroundColor: secondary }}
            >
              Apply Now <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ===== CONTACT ===== */}
      {show('contact') && (
        <section id="contact" className="bg-white px-5 py-20 sm:px-8 sm:py-28">
          <div className="mx-auto max-w-5xl">
            <div className="text-center mb-14">
              <SectionLabel text="Get In Touch" color={secondary} />
              <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl lg:text-5xl">Contact Us</h2>
            </div>
            <div ref={contRef} className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {school.address && (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(school.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col items-center rounded-2xl border border-gray-100 bg-gray-50/60 p-7 text-center transition-all hover:-translate-y-0.5 hover:border-gray-200 hover:shadow-lg"
                  style={fadeUp(0, contVisible)}
                >
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl transition-transform group-hover:scale-110" style={{ backgroundColor: primary + '12' }}>
                    <MapPin className="h-6 w-6" style={{ color: primary }} />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Address</p>
                  <p className="text-sm font-medium leading-relaxed text-gray-700">{school.address}</p>
                </a>
              )}
              {school.phone && (
                <a
                  href={`tel:${school.phone}`}
                  className="group flex flex-col items-center rounded-2xl border border-gray-100 bg-gray-50/60 p-7 text-center transition-all hover:-translate-y-0.5 hover:border-gray-200 hover:shadow-lg"
                  style={fadeUp(80, contVisible)}
                >
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl transition-transform group-hover:scale-110" style={{ backgroundColor: secondary + '15' }}>
                    <Phone className="h-6 w-6" style={{ color: secondary }} />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Phone</p>
                  <p className="text-sm font-medium text-gray-700">{school.phone}</p>
                </a>
              )}
              {(school.principal_email || school.proprietor_email) && (
                <a
                  href={`mailto:${school.principal_email || school.proprietor_email}`}
                  className="group flex flex-col items-center rounded-2xl border border-gray-100 bg-gray-50/60 p-7 text-center transition-all hover:-translate-y-0.5 hover:border-gray-200 hover:shadow-lg"
                  style={fadeUp(160, contVisible)}
                >
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl transition-transform group-hover:scale-110" style={{ backgroundColor: '#16a34a12' }}>
                    <Mail className="h-6 w-6 text-green-600" />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Email</p>
                  <p className="text-sm font-medium text-gray-700 break-all">{school.principal_email || school.proprietor_email}</p>
                </a>
              )}
              {cfg.school_hours && (
                <div className="group flex flex-col items-center rounded-2xl border border-gray-100 bg-gray-50/60 p-7 text-center transition-all hover:border-gray-200 hover:shadow-lg"
                  style={fadeUp(240, contVisible)}
                >
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: '#9333ea12' }}>
                    <Clock className="h-6 w-6 text-purple-600" />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">School Hours</p>
                  <p className="text-sm font-medium text-gray-700">{cfg.school_hours}</p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ===== FOOTER ===== */}
      <footer style={{ backgroundColor: primary }}>
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {/* Brand */}
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-3">
                {school.logo_url ? (
                  <img src={school.logo_url} alt={school.name} className="h-20 w-20 object-contain drop-shadow-sm" />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-white/15">
                    <GraduationCap className="h-6 w-6 text-white" />
                  </div>
                )}
                <span className="text-base font-extrabold text-white">{school.name}</span>
              </div>
              {school.motto && (
                <p className="mt-3 max-w-xs text-xs italic leading-relaxed text-white/40">{school.motto}</p>
              )}
              {/* Social icons */}
              {socialLinks.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {socialLinks.map(([platform, url]) => (
                    <a
                      key={platform}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={platform}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white/50 transition-all hover:bg-white/20 hover:text-white"
                    >
                      <SocialIcon platform={platform} />
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="mb-4 text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">Quick Links</h3>
              <ul className="space-y-2.5">
                {navLinks.map((lnk) => (
                  <li key={lnk.label}>
                    {lnk.href.startsWith('#') ? (
                      <button type="button" onClick={() => scrollToSection(lnk.href)} className="text-sm text-white/50 transition-colors hover:text-white">{lnk.label}</button>
                    ) : (
                      <Link to={lnk.href} className="text-sm text-white/50 transition-colors hover:text-white">{lnk.label}</Link>
                    )}
                  </li>
                ))}
                <li>
                  <Link to={`${linkBase}/apply`} className="text-sm font-semibold transition-colors hover:text-white" style={{ color: secondary }}>
                    Apply Now →
                  </Link>
                </li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h3 className="mb-4 text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">Contact Info</h3>
              <ul className="space-y-3">
                {school.address && (
                  <li className="flex items-start gap-2.5">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-white/30" />
                    <span className="text-sm leading-relaxed text-white/50">{school.address}</span>
                  </li>
                )}
                {school.phone && (
                  <li className="flex items-center gap-2.5">
                    <Phone className="h-4 w-4 shrink-0 text-white/30" />
                    <a href={`tel:${school.phone}`} className="text-sm text-white/50 hover:text-white transition-colors">{school.phone}</a>
                  </li>
                )}
                {(school.principal_email || school.proprietor_email) && (
                  <li className="flex items-center gap-2.5">
                    <Mail className="h-4 w-4 shrink-0 text-white/30" />
                    <a
                      href={`mailto:${school.principal_email || school.proprietor_email}`}
                      className="text-sm text-white/50 hover:text-white transition-colors break-all"
                    >
                      {school.principal_email || school.proprietor_email}
                    </a>
                  </li>
                )}
                {school.website && (
                  <li className="flex items-center gap-2.5">
                    <Globe className="h-4 w-4 shrink-0 text-white/30" />
                    <a href={school.website} target="_blank" rel="noopener noreferrer" className="text-sm text-white/50 hover:text-white transition-colors">
                      {school.website}
                    </a>
                  </li>
                )}
              </ul>
            </div>

            {/* Portal */}
            <div>
              <h3 className="mb-4 text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">School Portal</h3>
              <p className="text-sm text-white/40 leading-relaxed mb-5">
                Access the school management system for staff, students, and administrators.
              </p>
              <Link
                to={`${linkBase}/login`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-white/20"
              >
                <LogIn className="h-4 w-4" /> Staff / Student Login
              </Link>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-7 sm:flex-row">
            <p className="text-xs text-white/25">
              &copy; {new Date().getFullYear()} {school.name}. All rights reserved.
            </p>
            <p className="text-xs text-white/20">
              Powered by <span className="font-bold text-white/35">SchoolSync</span>
            </p>
          </div>
        </div>
      </footer>

      {/* ===== WHATSAPP FLOATING BUTTON ===== */}
      {cfg.whatsapp_number && (
        <a
          href={`https://wa.me/${cfg.whatsapp_number.replace(/\D/g, '')}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat with us on WhatsApp"
          title="Chat with us on WhatsApp"
          className="ss-wa-btn fixed bottom-6 left-6 z-50 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-2xl transition-transform hover:scale-110"
          style={{ backgroundColor: '#25D366' }}
        >
          <svg viewBox="0 0 24 24" className="h-7 w-7 fill-white" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </a>
      )}

      {/* ===== BACK TO TOP ===== */}
      {showBackTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-50 flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-xl transition-all hover:scale-110 hover:shadow-2xl"
          style={{ backgroundColor: primary }}
          aria-label="Back to top"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      )}
    </div>
    </>
  );
}
