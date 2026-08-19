import { useEffect, useState } from 'react';
import { buildSiteStyles, bandStyle, readableBrandColor, brandTint } from '@/utils/siteThemeStyles';
import { resolveBlocks, navEntriesFromBlocks } from '@/types/siteBlocks';
import BlockRenderer from '@/components/site/BlockRenderer';
import type { SiteCtx } from '@/components/site/shared';
import { usePreviewTheme } from '@/hooks/usePreviewTheme';
import type { SiteTheme } from '@/types/siteTheme';
import '@/styles/siteTheme.css';
import { useParams, Link } from 'react-router-dom';
import { schoolSiteService } from '@/services/schoolSiteService';
import { useDomainContext } from '@/context/DomainContext';
import type { School, SiteConfig } from '@/types/school.types';
import {
  GraduationCap,
  Phone,
  MapPin,
  Mail,
  LogIn,
  Globe,
  ArrowUp,
  Menu,
  X,
} from 'lucide-react';

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
  // Non-null only inside the designer's preview frame.
  const previewTheme = usePreviewTheme();


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

  // The hero headline and subtext, and the about copy, moved into their own
  // blocks. Each still falls back to the school record exactly as it did here.

  const cfg: SiteConfig = school.site_config ?? {};
  // Theme lives inside site_config alongside the page content. resolveTheme
  // fills every gap with the previous hardcoded values, so a school that has
  // chosen nothing renders exactly as it did before.
  // A draft theme handed over by the designer's preview frame takes precedence
  // over the saved one, so a proprietor sees the choice before committing to
  // it. Nothing else changes: same component, same data, same rendering path —
  // which is the point, because a preview built out of a separate mock would
  // drift from the real page and stop being worth trusting.
  const siteStyles = buildSiteStyles(
    previewTheme ?? ((cfg as Record<string, unknown>).theme as SiteTheme | undefined),
    primary,
    secondary,
  );
  // The footer was one of the blocks painted with the school's colour through
  // an inline style, so it ignored the preset entirely — a dark page ended up
  // with bright bands still in the old colour, reading as two designs stitched
  // together.
  //
  // Only the footer's band is resolved here now. The CTA and gallery bands
  // moved into their own blocks, which is where they belong: a second gallery
  // should be free to sit on a different band from the first.
  const footerBand = bandStyle(siteStyles.theme.footerStyle, primary, siteStyles.isDark);

  // For text set directly on the page in the school's colour. See
  // readableBrandColor: a deep brand colour on the dark preset is unreadable,
  // and an inline style is out of the theme layer's reach.
  const primaryText = readableBrandColor(primary, siteStyles.isDark);
  const secondaryText = readableBrandColor(secondary, siteStyles.isDark);
  // The stat figures are 30–40px, so they clear contrast at a lower luminance
  // than the small caps labels do.
  const primaryDisplay = readableBrandColor(primary, siteStyles.isDark, 'large');
  // Icons are graphics, so they take the 3:1 threshold rather than 4.5:1 —
  // same rule the size argument encodes for text.
  const primaryIcon   = readableBrandColor(primary, siteStyles.isDark, 'large');
  const secondaryIcon = readableBrandColor(secondary, siteStyles.isDark, 'large');
  // Tints for the rounded tiles the icons sit on. Still the school's colour,
  // still a wash — just one that exists on a dark ground.
  const primaryTint   = brandTint(primary, siteStyles.isDark);
  const secondaryTint = brandTint(secondary, siteStyles.isDark);

  const socialLinks = Object.entries(cfg.social_links ?? {}).filter(([, url]) => url);

  // On custom domain/subdomain, use root-relative paths so the slug never appears in the URL
  const linkBase = isCustomDomain ? '' : `/school/${slug}`;

  /**
   * The page, as a list.
   *
   * Sections used to be fixed JSX rearranged with CSS `order`, which moved
   * them on screen but not in the document — a school that put its gallery
   * above its programmes had a page seen in one order and spoken by a screen
   * reader in another. A real list has no such gap, and it is also what lets a
   * school add a block or use one twice.
   *
   * A school that has never edited its layout has no stored list, so one is
   * derived from the old fields. Nothing is written to the database until
   * someone deliberately changes something.
   */
  const blocks = resolveBlocks(cfg, siteStyles.theme.sectionOrder);

  /** Everything the blocks need that is not their own content. */
  const siteCtx: SiteCtx = {
    school, cfg, slug, linkBase,
    primary, secondary,
    primaryText, secondaryText, primaryDisplay, primaryIcon, secondaryIcon,
    primaryTint, secondaryTint,
    siteStyles,
    scrollToSection,
  };

  /**
   * Navigation, built from the page itself.
   *
   * It used to be assembled from the old config fields while the page was
   * assembled from something else; the two agreed only because both read the
   * same data. Now that a school can hide a block or add a second gallery, the
   * nav has to come from the same list the page renders, or it will link to
   * sections that are not there and miss ones that are.
   *
   * Fees stays outside this: it is a separate page rather than an anchor, and
   * it appears only once the school has published a fee schedule.
   */
  const navLinks = [
    ...navEntriesFromBlocks(blocks),
    ...(cfg.fee_schedule?.published ? [{ label: 'Fees', href: `/school/${slug}/fees` }] : []),
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
    {/* data-preset drives the few rules that must know whether the surface is
        dark. Everything else reads the tokens, so a new preset needs no change
        here. */}
    <div
      className={`ss-theme ss-head--${siteStyles.theme.sectionHeader} min-h-screen bg-white antialiased`}
      data-preset={siteStyles.theme.preset}
      style={{
        '--school-primary': primary,
        '--school-secondary': secondary,
        ...siteStyles.vars,
      } as React.CSSProperties}
    >
      {/* One fixed texture layer for the whole page rather than one per
          section, so the pattern runs continuously instead of restarting at
          every block. */}
      {siteStyles.surface && (
        <div className="ss-surface" style={{ ...siteStyles.surface, color: 'var(--site-text)' }} />
      )}


      {/* ===== NAVBAR ===== */}
      <nav
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-white/98 shadow-md backdrop-blur-md border-b border-gray-100'
            : 'bg-transparent'
        }`}
      >
        <div className={`ss-nav--${siteStyles.theme.logoPlacement} mx-auto flex max-w-7xl items-center justify-between px-5 py-2 sm:px-8`}>
          {/* Logo + Name. ss-nav-brand is what the logo-placement rules move —
              order and margin only, so the markup stays as it is. */}
          <div className="ss-nav-brand flex items-center gap-3">
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


      {/* The eleven sections used to sit here as fixed JSX, rearranged with
          CSS `order`. They are a list now: see components/site/BlockRenderer.
          A school that has never edited its layout gets that list derived from
          the old fields by blocksFromLegacy, so the page is unchanged. */}
      <BlockRenderer blocks={blocks} ctx={siteCtx} />
      {/* ===== FOOTER ===== */}
      <footer className="ss-footer" style={{ order: 1000, backgroundColor: footerBand.background, color: footerBand.color }}>
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
