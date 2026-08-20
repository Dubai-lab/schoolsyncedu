import { Link } from 'react-router-dom';
import {
  Users, GraduationCap, Heart, Shield, MapPin, Phone, Mail,
  Clock, ArrowRight,
} from 'lucide-react';
import AppShowcase from '@/components/shared/AppShowcase';
import { bandStyle } from '@/utils/siteThemeStyles';
import {
  useInView, fadeUp, scaleUp, slideLeft, slideRight,
  getIcon, StatValue, BlockHead, type BlockProps,
} from './shared';

/**
 * The eleven original sections as block components.
 *
 * Ported from SchoolSite.tsx unchanged in markup and class names — this step
 * is a move, not a redesign, so a school that has edited nothing sees exactly
 * the page it saw before.
 *
 * Two differences, both consequences of becoming a list:
 *
 *   1. No `order` style. Sections used to sit in fixed JSX and be rearranged
 *      with CSS `order`, which moved them visually but not in the document —
 *      a school that put its gallery above its programmes had a page that was
 *      seen in the new order and spoken by a screen reader in the old one.
 *      A real list puts them in the DOM in the order they appear.
 *
 *   2. Content comes from the block, not from SiteConfig. That is what makes a
 *      second gallery possible: the photos belong to the instance rather than
 *      to the site.
 */

// ── Key numbers ──────────────────────────────────────────────────────────────

interface Stat { value: string; label: string; icon: string }

export function StatsBlock({ block, ctx }: BlockProps) {
  const [ref, visible] = useInView();
  const items = (block.content.items ?? []) as Stat[];
  const layout = (block.design?.variant as typeof ctx.siteStyles.theme.layouts.stats) ?? ctx.siteStyles.theme.layouts.stats;

  if (items.length === 0 || layout === 'hidden') return null;

  return (
    <section className="relative bg-white">
      <div className="absolute -top-px left-0 right-0 h-1" style={{ backgroundColor: ctx.secondary }} />
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        {/*
          The column count used to be an inline style applied at every width, so
          five figures meant five columns on a phone as well as a desktop — each
          one about 60px wide, with a four-digit number in it. The count is a
          custom property now and only takes effect from the small breakpoint
          up; below that it is two columns.
        */}
        <div
          ref={ref}
          className={`ss-stats ss-stats--${layout} ss-stats-grid divide-x divide-gray-100`}
          style={{ '--ss-stat-cols': Math.min(items.length, 5) } as React.CSSProperties}
        >
          {items.map((s, i) => {
            const Icon = getIcon(s.icon);
            return (
              <div
                key={i}
                className="group flex flex-col items-center py-10 px-4 transition-colors hover:bg-gray-50/60"
                style={fadeUp(i * 80, visible)}
              >
                <div
                  className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl transition-transform group-hover:scale-110"
                  style={{ backgroundColor: i % 2 === 0 ? ctx.primaryTint : ctx.secondaryTint }}
                >
                  <Icon className="h-5 w-5" style={{ color: i % 2 === 0 ? ctx.primaryIcon : ctx.secondaryIcon }} />
                </div>
                <p className="text-3xl font-extrabold tracking-tight sm:text-4xl" style={{ color: ctx.primaryDisplay }}>
                  <StatValue raw={s.value} active={visible} />
                </p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-gray-400">{s.label}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── About ────────────────────────────────────────────────────────────────────

export function AboutBlock({ block, ctx, anchor }: BlockProps) {
  const [ref, visible] = useInView();
  const { school } = ctx;
  const c = block.content as Record<string, string | null>;

  // The block's own words win; the school column is the fallback, so a school
  // that has never opened the Page tab reads exactly as it did.
  const aboutText =
    c.body ||
    school.about_text ||
    `${school.name} is a premier educational institution located in ${school.location || 'Liberia'}. We are committed to providing quality education and shaping the leaders of tomorrow.`;

  return (
    <section id={anchor} className="px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <BlockHead
          block={block}
          ctx={ctx}
          defaultLabel="About Our School"
          defaultHeading={c.mission ? 'Our Story & Mission' : `About ${school.name}`}
        />

        <div ref={ref} className="grid grid-cols-1 gap-16 lg:grid-cols-2 lg:items-start">
          <div className="space-y-6" style={slideLeft(0, visible)}>
            <div className="flex items-center gap-2">
              <div className="h-px w-10 rounded-full" style={{ backgroundColor: ctx.secondary }} />
              <span className="text-sm font-semibold" style={{ color: ctx.primaryText }}>{school.name}</span>
            </div>
            <p className="text-base leading-8 text-gray-600 sm:text-lg">{aboutText}</p>

            {c.mission && (
              <div
                className="relative overflow-hidden rounded-2xl p-6"
                style={{ backgroundColor: ctx.primaryTint, borderLeft: `4px solid ${ctx.primaryIcon}` }}
              >
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest" style={{ color: ctx.primaryText }}>Our Mission</p>
                <p className="text-sm leading-7 text-gray-600">{c.mission}</p>
              </div>
            )}

            {c.vision && (
              <div
                className="relative overflow-hidden rounded-2xl p-6"
                style={{ backgroundColor: ctx.secondaryTint, borderLeft: `4px solid ${ctx.secondaryIcon}` }}
              >
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest" style={{ color: ctx.secondaryText }}>Our Vision</p>
                <p className="text-sm leading-7 text-gray-600">{c.vision}</p>
              </div>
            )}

            {c.principal_message && (
              <div className="mt-6 flex items-start gap-4 rounded-2xl border border-gray-100 bg-gray-50 p-5">
                {c.principal_image ? (
                  <img
                    src={c.principal_image}
                    alt={school.principal_name || 'Principal'}
                    className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-offset-2"
                    style={{ outlineColor: ctx.primary }}
                  />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: ctx.primaryTint }}>
                    <Users className="h-6 w-6" style={{ color: ctx.primaryIcon }} />
                  </div>
                )}
                <div>
                  <p className="text-sm italic leading-7 text-gray-500">"{c.principal_message}"</p>
                  <p className="mt-2 text-xs font-bold text-gray-800">— {school.principal_name || 'The Principal'}</p>
                  {c.principal_title && <p className="text-xs text-gray-400">{c.principal_title}</p>}
                </div>
              </div>
            )}
          </div>

          <div style={slideRight(100, visible)}>
            {c.building_image ? (
              <div className="relative">
                <div className="absolute -inset-4 rounded-3xl opacity-30 blur-2xl" style={{ backgroundColor: ctx.primary }} />
                <div className="relative overflow-hidden rounded-3xl shadow-2xl">
                  <img src={c.building_image} alt={`${school.name} Campus`} className="h-auto w-full object-cover" />
                </div>
                {school.founded_year && (
                  <div
                    className="absolute -bottom-4 -right-4 rounded-2xl px-5 py-3 text-center text-white shadow-xl"
                    style={{ backgroundColor: ctx.secondary }}
                  >
                    <p className="text-xs font-medium opacity-80">Founded</p>
                    <p className="text-2xl font-extrabold">{school.founded_year}</p>
                  </div>
                )}
              </div>
            ) : (
              // Shown when a school has uploaded no building photo. The wording
              // is generic because it has to be true of any school; the colours
              // now come from the palette rather than the hardcoded green and
              // purple, which appeared on a page whatever the school picked.
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: GraduationCap, label: 'Academic Excellence', sub: 'Rigorous curriculum for every learner', color: ctx.primaryIcon,   tint: ctx.primaryTint },
                  { icon: Users,         label: 'Dedicated Faculty',   sub: 'Experienced and caring educators',      color: ctx.secondaryIcon, tint: ctx.secondaryTint },
                  { icon: Shield,        label: 'Safe Environment',    sub: 'Nurturing spaces for growth',           color: ctx.primaryIcon,   tint: ctx.primaryTint },
                  { icon: Heart,         label: 'Character Building',  sub: 'Values-driven education',               color: ctx.secondaryIcon, tint: ctx.secondaryTint },
                ].map((f) => (
                  <div
                    key={f.label}
                    className="group flex flex-col rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:shadow-lg hover:-translate-y-0.5"
                  >
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: f.tint }}>
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
  );
}

// ── Programmes ───────────────────────────────────────────────────────────────

interface Program { name: string; description: string; icon: string }

export function ProgramsBlock({ block, ctx, anchor }: BlockProps) {
  const [ref, visible] = useInView();
  const items = (block.content.items ?? []) as Program[];
  if (items.length === 0) return null;

  return (
    <section id={anchor} className="bg-slate-50 px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <BlockHead block={block} ctx={ctx} defaultLabel="What We Offer" defaultHeading="Academic Programmes" />
        <div ref={ref} className={`ss-programs ss-programs--${block.design?.variant ?? ctx.siteStyles.theme.layouts.programs} grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3`}>
          {items.map((prog, i) => {
            const Icon = getIcon(prog.icon);
            return (
              <div
                key={i}
                className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-7 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl"
                style={fadeUp(i * 100, visible)}
              >
                <div
                  className="absolute inset-x-0 top-0 h-1 rounded-t-2xl"
                  style={{ background: `linear-gradient(90deg, ${ctx.primary}, ${ctx.secondary})` }}
                />
                <div
                  className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl transition-transform group-hover:scale-110"
                  style={{ backgroundColor: ctx.primaryTint }}
                >
                  <Icon className="h-6 w-6" style={{ color: ctx.primaryIcon }} />
                </div>
                <h3 className="text-lg font-bold text-gray-900">{prog.name}</h3>
                <p className="mt-2 text-sm leading-7 text-gray-500">{prog.description}</p>
                {/* The "Learn more →" affordance that used to sit here was
                    styled and coloured as a link and went nowhere — there is no
                    programme page for it to reach. Removed rather than faked. */}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Announcements ────────────────────────────────────────────────────────────

interface Announcement { title: string; date: string; excerpt: string; category?: string }

export function AnnouncementsBlock({ block, ctx, anchor }: BlockProps) {
  const [ref, visible] = useInView();
  const all = (block.content.items ?? []) as Announcement[];

  /**
   * How many to show.
   *
   * This was hardcoded to six, and there is no archive page, so a school's
   * seventh announcement existed in the database and could be seen by nobody.
   * Until single-announcement pages exist, the least a school should be able
   * to do is show all of them: 0 means no limit.
   */
  const limit = Number(block.content.limit ?? 6);
  const items = limit > 0 ? all.slice(0, limit) : all;

  if (items.length === 0) return null;

  return (
    <section id={anchor} className="px-5 py-20 sm:px-8 sm:py-28 bg-white">
      <div className="mx-auto max-w-6xl">
        <BlockHead block={block} ctx={ctx} defaultLabel="Stay Informed" defaultHeading="News & Announcements" />
        <div ref={ref} className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, i) => {
            const d = new Date(item.date);
            return (
              <article
                key={i}
                className="group flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
                style={fadeUp(i * 90, visible)}
              >
                <div className="flex items-center gap-3 px-5 py-3.5" style={{ backgroundColor: ctx.primaryTint }}>
                  <div
                    className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl text-white"
                    style={{ backgroundColor: ctx.primary }}
                  >
                    <span className="text-xs font-bold leading-none">
                      {d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                    </span>
                    <span className="text-sm font-extrabold leading-tight">{d.getDate()}</span>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: ctx.secondaryText }}>
                      {item.category || 'Announcement'}
                    </p>
                    <p className="text-xs text-gray-400">{d.getFullYear()}</p>
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  {/* Was group-hover:text-blue-700 — a blue that survived the
                      pass removing blue everywhere else, and appeared on the
                      page whatever colours the school had chosen. */}
                  <h3 className="text-base font-bold text-gray-900 transition-colors">{item.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-7 text-gray-500">{item.excerpt}</p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Gallery ──────────────────────────────────────────────────────────────────

interface GalleryImage { url: string; caption?: string }

export function GalleryBlock({ block, ctx, anchor }: BlockProps) {
  const [ref, visible] = useInView();
  const images = (block.content.images ?? []) as GalleryImage[];
  if (images.length === 0) return null;

  // This instance's own choices win over the theme's, so two galleries can
  // sit on different bands and use different layouts.
  const bandKey = block.design?.band ?? ctx.siteStyles.theme.galleryStyle;
  const variant = block.design?.variant ?? ctx.siteStyles.theme.layouts.gallery;
  const band = bandStyle(bandKey, ctx.primary, ctx.siteStyles.isDark);

  return (
    <section
      id={anchor}
      className={`px-5 py-20 sm:px-8 sm:py-28 ${bandKey === 'surface' ? '' : 'ss-band'}`}
      style={{ background: band.background, color: band.color }}
    >
      <div className="mx-auto max-w-6xl">
        <BlockHead block={block} ctx={ctx} defaultLabel="School Life" defaultHeading="Photo Gallery" />
        <div
          ref={ref}
          className={`ss-gallery ss-gallery--${variant} ss-gallery--shape-${ctx.siteStyles.theme.galleryShape} columns-2 gap-3 sm:columns-3 lg:columns-4`}
        >
          {images.map((img, i) => (
            <div
              key={i}
              className="group relative mb-3 overflow-hidden rounded-2xl break-inside-avoid shadow-sm"
              style={scaleUp(i * 60, visible)}
            >
              <img
                src={img.url}
                alt={img.caption || `School life ${i + 1}`}
                className="w-full object-cover transition-transform duration-500 group-hover:scale-105"
                style={{ minHeight: i % 3 === 0 ? '220px' : '160px' }}
              />
              <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                {img.caption && <p className="p-3 text-xs font-medium text-white">{img.caption}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Leadership & staff ───────────────────────────────────────────────────────

interface StaffMember { name: string; role: string; photo_url?: string; bio?: string }

export function AdministrationBlock({ block, ctx, anchor }: BlockProps) {
  const [ref, visible] = useInView();
  const members = (block.content.members ?? []) as StaffMember[];
  if (members.length === 0) return null;

  return (
    <section id={anchor} className="bg-white px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <BlockHead
          block={block}
          ctx={ctx}
          defaultLabel="Our Leadership"
          defaultHeading="Meet Our Administration"
          defaultIntro="Our dedicated leadership team committed to educational excellence."
        />
        <div ref={ref} className={`ss-staff ss-staff--${block.design?.variant ?? ctx.siteStyles.theme.layouts.staff} grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`}>
          {members.map((member, i) => (
            <div
              key={i}
              className="group overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl"
              style={scaleUp(i * 100, visible)}
            >
              <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${ctx.primary}, ${ctx.secondary})` }} />
              <div className="p-6 text-center">
                <div className="relative mx-auto mb-4 h-24 w-24">
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{ background: `linear-gradient(135deg, ${ctx.primary}, ${ctx.secondary})` }}
                  />
                  <div className="absolute inset-[3px] overflow-hidden rounded-full bg-white">
                    {member.photo_url ? (
                      <img src={member.photo_url} alt={member.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center" style={{ backgroundColor: ctx.primaryTint }}>
                        <Users className="h-9 w-9" style={{ color: ctx.primaryIcon }} />
                      </div>
                    )}
                  </div>
                </div>
                <h3 className="text-sm font-bold text-gray-900">{member.name}</h3>
                <span
                  className="mt-2 inline-block rounded-full px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white"
                  style={{ backgroundColor: ctx.primary }}
                >
                  {member.role}
                </span>
                {member.bio && <p className="mt-3 text-xs leading-relaxed text-gray-500">{member.bio}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Testimonials ─────────────────────────────────────────────────────────────

interface Testimonial { quote: string; name: string; role: string; photo_url?: string; rating?: number }

export function TestimonialsBlock({ block, ctx, anchor }: BlockProps) {
  const [ref, visible] = useInView();
  const items = (block.content.items ?? []) as Testimonial[];
  if (items.length === 0) return null;

  return (
    <section id={anchor} className="bg-slate-50 px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <BlockHead
          block={block}
          ctx={ctx}
          defaultLabel="What People Say"
          defaultHeading="Testimonials"
          defaultIntro="Hear from the families and students who are part of our community."
        />
        <div ref={ref} className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((t, i) => (
            <div
              key={i}
              className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-7 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl"
              style={scaleUp(i * 100, visible)}
            >
              <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl" style={{ background: `linear-gradient(90deg, ${ctx.primary}, ${ctx.secondary})` }} />
              <div className="absolute right-5 top-5 font-serif text-7xl leading-none opacity-[0.07]" style={{ color: ctx.primary }}>"</div>

              {(t.rating ?? 0) > 0 && (
                <div className="mb-4 flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg
                      key={star}
                      viewBox="0 0 20 20"
                      className="h-4 w-4"
                      style={{ fill: star <= (t.rating ?? 0) ? ctx.secondaryIcon : 'rgba(148,163,184,0.35)' }}
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
              )}

              <p className="relative text-sm leading-7 text-gray-600 italic">"{t.quote}"</p>

              <div className="mt-6 flex items-center gap-3 border-t border-gray-50 pt-5">
                {t.photo_url ? (
                  <img src={t.photo_url} alt={t.name} className="h-11 w-11 rounded-full object-cover ring-2 ring-offset-1" style={{ outlineColor: ctx.primary }} />
                ) : (
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: ctx.primary }}
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
  );
}

// ── Student app ──────────────────────────────────────────────────────────────

export function AppBlock({ ctx }: BlockProps) {
  return <AppShowcase variant="school" schoolName={ctx.school.name} />;
}

// ── Call to action ───────────────────────────────────────────────────────────

export function CtaBlock({ block, ctx }: BlockProps) {
  const [ref, visible] = useInView();
  const { school } = ctx;
  const band = bandStyle(block.design?.band ?? ctx.siteStyles.theme.ctaStyle, ctx.primary, ctx.siteStyles.isDark);

  const label   = block.label   ?? 'Join Our Community';
  const heading = block.heading ?? `Ready to Join ${school.name}?`;
  const intro   = block.intro   ?? 'Applications are open. Start your journey with us today.';
  const button  = (block.content.button_text as string) ?? 'Apply Now';

  return (
    <section className="relative overflow-hidden px-5 py-16 sm:px-8" style={{ background: band.background, color: band.color }}>
      <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full opacity-10 blur-3xl" style={{ backgroundColor: ctx.secondary }} />
      <div className="absolute bottom-0 left-10 h-40 w-40 rounded-full opacity-10 blur-2xl" style={{ backgroundColor: ctx.secondary }} />
      <div ref={ref} className="relative mx-auto flex max-w-5xl flex-col items-center gap-6 text-center sm:flex-row sm:justify-between sm:text-left">
        <div style={slideLeft(0, visible)}>
          <p className="text-xs font-bold uppercase tracking-widest text-white/50 mb-1">{label}</p>
          <h2 className="text-2xl font-extrabold text-white sm:text-3xl lg:text-4xl">{heading}</h2>
          <p className="mt-1.5 text-sm text-white/60">{intro}</p>
        </div>
        <div style={slideRight(200, visible)}>
          <Link
            to={`${ctx.linkBase}/apply`}
            className="inline-flex items-center gap-2.5 rounded-2xl px-8 py-4 text-sm font-extrabold text-white shadow-xl transition-all hover:scale-[1.03] hover:shadow-2xl whitespace-nowrap sm:text-base"
            style={{ backgroundColor: ctx.secondary }}
          >
            {button} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── Contact ──────────────────────────────────────────────────────────────────

export function ContactBlock({ block, ctx, anchor }: BlockProps) {
  const [ref, visible] = useInView();
  const { school } = ctx;
  const hours = block.content.hours as string | null;
  const email = school.principal_email || school.proprietor_email;

  const cards = [
    school.address && {
      key: 'address',
      href: `https://maps.google.com/?q=${encodeURIComponent(school.address)}`,
      external: true,
      icon: MapPin,
      tint: ctx.primaryTint,
      color: ctx.primaryIcon,
      label: 'Address',
      value: school.address,
    },
    school.phone && {
      key: 'phone',
      href: `tel:${school.phone}`,
      icon: Phone,
      tint: ctx.secondaryTint,
      color: ctx.secondaryIcon,
      label: 'Phone',
      value: school.phone,
    },
    email && {
      key: 'email',
      href: `mailto:${email}`,
      icon: Mail,
      // Was a hardcoded green that ignored the school's palette entirely.
      tint: ctx.primaryTint,
      color: ctx.primaryIcon,
      label: 'Email',
      value: email,
      breakAll: true,
    },
    hours && {
      key: 'hours',
      icon: Clock,
      // Was a hardcoded purple, for the same reason.
      tint: ctx.secondaryTint,
      color: ctx.secondaryIcon,
      label: 'School Hours',
      value: hours,
    },
  ].filter(Boolean) as Array<{
    key: string; href?: string; external?: boolean; icon: React.ElementType;
    tint: string; color: string; label: string; value: string; breakAll?: boolean;
  }>;

  if (cards.length === 0) return null;

  const cardClass =
    'group flex flex-col items-center rounded-2xl border border-gray-100 bg-gray-50/60 p-7 text-center transition-all hover:-translate-y-0.5 hover:border-gray-200 hover:shadow-lg';

  return (
    <section id={anchor} className="bg-white px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-5xl">
        <BlockHead block={block} ctx={ctx} defaultLabel="Get In Touch" defaultHeading="Contact Us" />
        <div ref={ref} className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card, i) => {
            const Icon = card.icon;
            const inner = (
              <>
                <div
                  className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl transition-transform group-hover:scale-110"
                  style={{ backgroundColor: card.tint }}
                >
                  <Icon className="h-6 w-6" style={{ color: card.color }} />
                </div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">{card.label}</p>
                <p className={`text-sm font-medium leading-relaxed text-gray-700 ${card.breakAll ? 'break-all' : ''}`}>
                  {card.value}
                </p>
              </>
            );

            return card.href ? (
              <a
                key={card.key}
                href={card.href}
                {...(card.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className={cardClass}
                style={fadeUp(i * 80, visible)}
              >
                {inner}
              </a>
            ) : (
              <div key={card.key} className={cardClass} style={fadeUp(i * 80, visible)}>
                {inner}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Text & image ─────────────────────────────────────────────────────────────

/**
 * The generic block, and the reason the library stops feeling limited.
 *
 * A heading, some words, one picture, image left or right. Nothing about it is
 * school-specific, which is the point: history, uniform policy, admissions
 * steps, boarding, term dates, why-choose-us — every request we did not
 * anticipate is a heading and some words and usually a picture.
 *
 * Paragraphs come from blank lines in the body rather than a rich text editor.
 * A school typing into a textarea gets sensible paragraphs, and the page cannot
 * be handed markup it has to trust.
 */
export function TextImageBlock({ block, ctx, anchor }: BlockProps) {
  const [ref, visible] = useInView();
  const c = block.content as Record<string, unknown>;

  const body = (c.body as string) ?? '';
  const imageUrl = (c.image_url as string | null) ?? null;
  const imageRight = ((c.image_side as string) ?? 'right') === 'right';
  const band = block.design?.band;
  const bandStyles = band ? bandStyle(band, ctx.primary, ctx.siteStyles.isDark) : null;

  const paragraphs = body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length === 0 && !imageUrl && !block.heading) return null;

  return (
    <section
      id={anchor}
      className={`px-5 py-20 sm:px-8 sm:py-28 ${bandStyles ? 'ss-band' : ''}`}
      style={bandStyles ? { background: bandStyles.background, color: bandStyles.color } : undefined}
    >
      <div className="mx-auto max-w-6xl">
        {(block.heading || block.label) && (
          <BlockHead block={block} ctx={ctx} defaultLabel="" defaultHeading={block.heading ?? ''} />
        )}

        <div
          ref={ref}
          className={`grid grid-cols-1 items-center gap-12 ${imageUrl ? 'lg:grid-cols-2' : ''}`}
        >
          <div
            className={`space-y-5 ${imageUrl && imageRight ? 'lg:order-1' : ''} ${imageUrl && !imageRight ? 'lg:order-2' : ''}`}
            style={slideLeft(0, visible)}
          >
            {paragraphs.map((p, i) => (
              <p key={i} className="text-base leading-8 text-gray-600 sm:text-lg">{p}</p>
            ))}
          </div>

          {imageUrl && (
            <div
              className={imageRight ? 'lg:order-2' : 'lg:order-1'}
              style={slideRight(100, visible)}
            >
              <div className="relative">
                <div className="absolute -inset-4 rounded-3xl opacity-25 blur-2xl" style={{ backgroundColor: ctx.primary }} />
                <div className="relative overflow-hidden rounded-3xl shadow-2xl">
                  <img src={imageUrl} alt="" className="h-auto w-full object-cover" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
