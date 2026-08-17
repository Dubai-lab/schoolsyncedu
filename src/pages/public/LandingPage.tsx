import AppShowcase from '@/components/shared/AppShowcase';
import GridBackdrop from '@/components/shared/GridBackdrop';
import SchoolDayFlow from '@/components/shared/SchoolDayFlow';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useFetch } from '@/hooks/useFetch';
import { pricingPlanService } from '@/services/adminService';
import type { SubscriptionPlan } from '@/types/report.types';
import SchoolSitePreview from '@/components/shared/SchoolSitePreview';
import {
  BookOpen,
  GraduationCap,
  CalendarCheck,
  DollarSign,
  Mail,
  Shield,
  BarChart3,
  Nfc,
  Users,
  Library,
  FileText,
  ArrowRight,
  CheckCircle,
  MessageSquare,
  Globe,
  Zap,
  Sparkles,
} from 'lucide-react';

// ── Scroll-reveal hook ────────────────────────────────────────────────────────
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);

  const observe = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('in-view');
          obs.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    return observe();
  }, [observe]);

  return ref;
}

// For arrays of children — observe the container, add in-view to each child
function useStaggerReveal(count: number) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const children = Array.from(container.querySelectorAll<HTMLElement>('.reveal'));

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          children.forEach((child, i) => {
            setTimeout(() => child.classList.add('in-view'), i * 80);
          });
          obs.disconnect();
        }
      },
      { threshold: 0.08 },
    );
    obs.observe(container);
    return () => obs.disconnect();
  }, [count]);

  return containerRef;
}

// ── Data ──────────────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: GraduationCap, title: 'Student Management', desc: 'Enrollment, profiles, academic records, and class assignments in one place.' },
  { icon: CalendarCheck, title: 'Attendance Tracking', desc: 'Digital attendance marking with NFC cards and automated absence alerts.' },
  { icon: FileText, title: 'Grade Management', desc: 'Grade entry, report cards, transcripts, and GPA calculations.' },
  { icon: DollarSign, title: 'Fee Collection', desc: 'Fee structures per class, balances, receipts, and financial reports.' },
  { icon: Mail, title: 'Communications', desc: 'Announcements, messaging, letter templates, and automated notifications.' },
  { icon: Library, title: 'Library System', desc: 'Book catalog, checkout tracking, overdue management, and reports.' },
  { icon: Nfc, title: 'Smart ID Cards', desc: 'NFC-enabled student and staff ID cards with built-in attendance scanning.' },
  { icon: BarChart3, title: 'Reports & Analytics', desc: 'Academic, attendance, and financial dashboards with exportable reports.' },
  { icon: Shield, title: 'Role-Based Access', desc: '14 user roles with granular permissions from Super Admin to Parent.' },
  { icon: Users, title: 'Staff Management', desc: 'Staff profiles, permissions, and role assignments for your entire team.' },
  { icon: Globe, title: 'WAEC Exam Registration', desc: 'Register candidates for LJHSCE and WASSCE exams directly in the platform.' },
  { icon: Zap, title: 'Multi-Tenant SaaS', desc: 'Each school gets its own environment — isolated, secure, and scalable.' },
];

// Four things a school head can act on, each true of the product today.
//
// These were engineering figures — '74 Database Tables', '14 User Roles',
// '99.9% Uptime Target'. A principal does not buy a schema, 'user roles' is
// internal vocabulary, and calling uptime a *target* quietly admits it is a
// hope rather than a record. Replaced with what the system actually does for
// the person reading, and nothing that is not already built.
const STATS = [
  { value: 'Free',    label: 'Website for every school' },
  { value: 'Offline', label: 'Attendance without internet' },
  { value: 'NFC',     label: 'Tap to mark attendance' },
  { value: '2 apps',  label: 'Student portal & attendance' },
];

const FOUNDING_BENEFITS = [
  {
    icon: Users,
    title: 'Set up with you',
    desc: 'We import your students, create your staff accounts and configure your fees with you — not a documentation link.',
  },
  {
    icon: MessageSquare,
    title: 'Talk to the people who built it',
    desc: 'Questions and problems go straight to the team. No ticket queue, no first-line script.',
  },
  {
    icon: Sparkles,
    title: 'Shape what comes next',
    desc: 'What our first schools ask for is what gets built next. You are early enough for that to matter.',
  },
];


const HOW_STEPS = [
  {
    step: '01',
    title: 'Register Your School',
    desc: 'Fill in your school details, choose a plan, and create your admin account. Setup takes under 5 minutes.',
    reveal: 'reveal',
  },
  {
    step: '02',
    title: 'Set Up Your Team',
    desc: 'Invite your registrar, bursar, teachers, and other staff. Assign roles and permissions to control access.',
    reveal: 'reveal',
  },
  {
    step: '03',
    title: 'Go Live',
    desc: 'Your school is live! Start enrolling students, managing fees, taking attendance, and entering grades.',
    reveal: 'reveal',
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [pricingView, setPricingView] = useState<'standard' | 'enterprise'>('standard');
  const [heroVisible, setHeroVisible] = useState(false);

  // Hero animates immediately on mount
  useEffect(() => {
    const t = setTimeout(() => setHeroVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  const featuresRef   = useStaggerReveal(FEATURES.length);
  const howRef        = useStaggerReveal(HOW_STEPS.length);
  const testimonialsRef = useStaggerReveal(FOUNDING_BENEFITS.length);
  const foundingCtaRef = useScrollReveal();
  const pricingRef    = useScrollReveal();
  const aboutLeftRef  = useScrollReveal();
  const aboutRightRef = useScrollReveal();
  const ctaRef        = useScrollReveal();
  const featuresTitleRef = useScrollReveal();
  const howTitleRef   = useScrollReveal();
  const testimonialsTitleRef = useScrollReveal();
  const pricingTitleRef = useScrollReveal();

  // Fetch visible pricing plans for preview
  const { data: plans = [] } = useFetch<SubscriptionPlan[]>(
    ['public-plans'],
    () => pricingPlanService.list(),
  );
  const visiblePlans = plans.filter((p) => p.is_visible && p.is_active && !p.is_enterprise).slice(0, 3);

  const heroBase = 'transition-all duration-700 ease-out';
  const heroShow = 'opacity-100 translate-y-0';
  const heroHide = 'opacity-0 translate-y-8';

  return (
    <div>
      {/* ========== HERO ========== */}
      {/* Was a blue primary-900→600 gradient. The ruled dark panel replaces it:
          same white type, but the accent colours now read as accents instead of
          competing with a saturated background. The blobs stay — they give the
          grid something to sit under, and are far more visible on dark. */}
      <GridBackdrop glow="violet" className="relative">
        {/* Animated background blobs */}
        <div className="absolute inset-0">
          <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-accent-500/10 blur-3xl animate-blob-float" />
          <div className="absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-white/5 blur-3xl animate-blob-float-alt" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-36">
          <div className="mx-auto max-w-3xl text-center">
            {/* Badge */}
            <div
              className={`mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm text-white/80 backdrop-blur-sm ${heroBase} ${heroVisible ? heroShow : heroHide}`}
              style={{ transitionDelay: '0ms' }}
            >
              <BookOpen className="h-4 w-4" />
              Built for Liberian Schools
            </div>

            {/* Heading */}
            <h1
              className={`text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl ${heroBase} ${heroVisible ? heroShow : heroHide}`}
              style={{ transitionDelay: '120ms' }}
            >
              Transform School
              <br />
              Management with{' '}
              <span className="text-accent-500">SchoolSync</span>
            </h1>

            {/* Subtitle */}
            <p
              className={`mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/70 ${heroBase} ${heroVisible ? heroShow : heroHide}`}
              style={{ transitionDelay: '240ms' }}
            >
              A unified SaaS platform for enrollment, grades, attendance, fees,
              communication, and more — designed specifically for schools in Liberia.
            </p>

            {/* CTAs */}
            <div
              className={`mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center ${heroBase} ${heroVisible ? heroShow : heroHide}`}
              style={{ transitionDelay: '360ms' }}
            >
              <Link
                to="/register"
                className="inline-flex items-center gap-2 rounded-xl bg-accent-500 px-6 py-3.5 text-base font-semibold text-white shadow-lg transition-all hover:bg-accent-600 hover:shadow-xl hover:-translate-y-0.5"
              >
                Get Started Free <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#features"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-6 py-3.5 text-base font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/20 hover:-translate-y-0.5"
              >
                See Features
              </a>
            </div>
          </div>

          {/* Stats bar */}
          <div
            className={`mx-auto mt-16 grid max-w-3xl grid-cols-2 gap-y-8 gap-x-6 sm:grid-cols-4 sm:gap-x-8 ${heroBase} ${heroVisible ? heroShow : heroHide}`}
            style={{ transitionDelay: '480ms' }}
          >
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-3xl font-bold text-white">{s.value}</p>
                <p className="mt-1 text-xs leading-snug text-white/50 sm:text-sm">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </GridBackdrop>

      {/* ========== SCHOOL SITE PREVIEW ========== */}
      <SchoolSitePreview />

      {/* ========== FEATURES ========== */}
      <section id="features" className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div ref={featuresTitleRef} className="reveal mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-amber-600">Features</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
              Everything your school needs
            </h2>
            <p className="mt-4 text-lg text-slate-500">
              From enrollment to graduation — manage every aspect of your school in one platform.
            </p>
          </div>

          <div ref={featuresRef} className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="reveal group rounded-2xl border border-slate-100 bg-white p-6 transition-all hover:border-amber-200 hover:shadow-lg hover:shadow-amber-50 hover:-translate-y-1"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600 transition-colors group-hover:bg-accent-500 group-hover:text-white">
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="text-base font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== MOBILE APPS ========== */}
      <AppShowcase />

      {/* ========== HOW IT WORKS ========== */}
      <section className="bg-slate-50 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div ref={howTitleRef} className="reveal mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-amber-600">How It Works</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
              Get your school online in minutes
            </h2>
          </div>

          <div ref={howRef} className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
            {HOW_STEPS.map((item) => (
              <div key={item.step} className={`reveal relative rounded-2xl bg-white p-8 shadow-sm hover:shadow-md transition-shadow`}>
                <span className="text-5xl font-extrabold text-amber-100">{item.step}</span>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== PRICING PREVIEW ========== */}
      <section id="pricing" className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div ref={pricingTitleRef} className="reveal mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-amber-600">Pricing</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
              Simple, transparent pricing
            </h2>
            <p className="mt-4 text-lg text-slate-500">
              Start with a free trial. Upgrade when you're ready.
            </p>

            {/* Standard / Enterprise toggle */}
            <div className="mt-8 inline-flex items-center rounded-full border border-slate-200 bg-slate-100 p-1">
              <button
                onClick={() => setPricingView('standard')}
                className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
                  pricingView === 'standard'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Standard Plans
              </button>
              <button
                onClick={() => setPricingView('enterprise')}
                className={`flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-medium transition-all ${
                  pricingView === 'enterprise'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                Enterprise
              </button>
            </div>
          </div>

          {/* ── Standard plan cards ── */}
          {pricingView === 'standard' && (
            <>
              <div ref={pricingRef as React.RefObject<HTMLDivElement>} className="reveal mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
                {visiblePlans.map((plan, i) => {
                  const isPopular = i === 1;
                  return (
                    <div
                      key={plan.id}
                      className={`relative rounded-2xl border p-8 transition-transform hover:-translate-y-1 ${
                        isPopular
                          ? 'border-amber-300 bg-amber-50/40 shadow-lg shadow-amber-100'
                          : 'border-slate-200 bg-white hover:shadow-md'
                      }`}
                    >
                      {isPopular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-900 px-4 py-1 text-xs font-semibold text-white">
                          Most Popular
                        </div>
                      )}
                      <h3 className="text-lg font-semibold text-slate-900">{plan.name}</h3>
                      <p className="mt-1 text-sm text-slate-500">{plan.description}</p>
                      <div className="mt-6">
                        <span className="text-4xl font-extrabold text-slate-900">${plan.price_usd}</span>
                        <span className="text-sm text-slate-500">/{plan.billing_cycle}</span>
                      </div>
                      <ul className="mt-6 space-y-3">
                        <li className="flex items-center gap-2 text-sm text-slate-600">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          Up to {plan.student_limit.toLocaleString()} students
                        </li>
                        <li className="flex items-center gap-2 text-sm text-slate-600">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          {plan.trial_days} day free trial
                        </li>
                        {plan.features && Object.entries(plan.features).filter(([, v]) => v).slice(0, 4).map(([key]) => (
                          <li key={key} className="flex items-center gap-2 text-sm text-slate-600">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            {key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                          </li>
                        ))}
                      </ul>
                      <Link
                        to={`/register?plan=${plan.slug}`}
                        className={`mt-8 block w-full rounded-lg py-2.5 text-center text-sm font-semibold transition-all ${
                          isPopular
                            ? 'bg-slate-900 text-white shadow-sm hover:bg-slate-800'
                            : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {plan.cta_button_text?.trim() || 'Start Free Trial'}
                      </Link>
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 text-center">
                <Link to="/pricing" className="text-sm font-medium text-amber-600 hover:text-amber-700">
                  View all plans & compare features →
                </Link>
              </div>
            </>
          )}

          {/* ── Enterprise view ── */}
          {pricingView === 'enterprise' && (
            <div className="mx-auto mt-12 max-w-4xl">
              <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-10 shadow-sm">
                <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center">

                  {/* Left: highlights */}
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                      <Sparkles className="h-3.5 w-3.5" /> Enterprise
                    </div>
                    <h3 className="mt-4 text-2xl font-bold text-slate-900">
                      A plan built around your school
                    </h3>
                    <p className="mt-3 text-sm text-slate-500 leading-relaxed">
                      Large institutions have unique needs. Our Enterprise plan gives you a fully custom
                      setup — talk to us about student numbers, specific modules, and pricing that works
                      for your budget.
                    </p>

                    <ul className="mt-6 space-y-3">
                      {[
                        'Unlimited students — no enrollment cap',
                        'Custom module selection',
                        'Dedicated onboarding & staff training',
                        'Priority email & phone support',
                        'Flexible billing — annual or government invoicing',
                        'Custom data retention & MOE compliance',
                      ].map((item) => (
                        <li key={item} className="flex items-center gap-2.5 text-sm text-slate-700">
                          <CheckCircle className="h-4 w-4 shrink-0 text-amber-600" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Right: CTA card */}
                  <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
                      <Sparkles className="h-7 w-7 text-amber-600" />
                    </div>
                    <h4 className="mt-4 text-lg font-bold text-slate-900">Let's talk</h4>
                    <p className="mt-2 text-sm text-slate-500">
                      Fill out a short form on our pricing page and our team will reach out within
                      1–2 business days with a custom proposal.
                    </p>
                    <Link
                      to="/pricing?view=enterprise"
                      className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
                    >
                      <Mail className="h-4 w-4" /> Contact Sales
                    </Link>
                    <p className="mt-3 text-xs text-slate-400">
                      Or email us directly at{' '}
                      <a href="mailto:support@schoolsyncedu.com" className="text-amber-600 hover:underline">
                        support@schoolsyncedu.com
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ========== FOUNDING SCHOOLS ==========
           This slot held three testimonials from named principals, bursars and
           parents at named Liberian schools. None of them exist. In a market
           this size principals know each other, and the first one who rings
           "Monrovia Academy" to ask about us costs more than an empty section
           ever could — one of the quotes also claimed parents were already
           paying by mobile money, which is not true.

           Being early is the honest pitch, and a better one: no established
           vendor can offer a principal the person who built it. */}
      <section className="bg-slate-50 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div ref={testimonialsTitleRef} className="reveal mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-amber-600">Founding Schools</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
              Be one of our first schools
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-500">
              SchoolSync is built and running. We are onboarding our first schools now and
              working with each one directly — you get the people who built it, not a support
              queue, and what you ask for shapes what gets built next.
            </p>
          </div>

          <div ref={testimonialsRef} className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
            {FOUNDING_BENEFITS.map((b) => (
              <div key={b.title} className="reveal rounded-2xl bg-white p-8 shadow-sm">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50">
                  <b.icon className="h-5 w-5 text-amber-600" />
                </div>
                <p className="text-base font-semibold text-slate-900">{b.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{b.desc}</p>
              </div>
            ))}
          </div>

          <div ref={foundingCtaRef} className="reveal mt-10 text-center">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-accent-500 px-8 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-600 sm:text-base"
            >
              Register your school <ArrowRight className="h-4 w-4" />
            </Link>
            <p className="mt-3 text-sm text-slate-500">
              Free to register. We will contact you to arrange your subscription.
            </p>
          </div>
        </div>
      </section>

      {/* ========== ONE SCHOOL DAY ==========
           Full-bleed, on the same ruled backdrop as the hero. The page kept
           asserting that this makes running a school easier; this is the first
           place it shows it rather than saying it. */}
      <SchoolDayFlow />

      {/* ========== ABOUT ========== */}
      <section id="about" className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
            <div ref={aboutLeftRef} className="reveal reveal-left">
              <p className="text-sm font-semibold uppercase tracking-wider text-amber-600">About EduLiberia</p>
              <h2 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
                Built for Liberia, by Liberians
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-500">
                SchoolSync is part of the EduLiberia initiative to digitize education management across Liberia.
                Our platform is designed with the unique challenges and needs of Liberian schools in mind —
                from WAEC exam registration to Liberian Dollar fee tracking and attendance that keeps working when the internet does not.
              </p>
              <p className="mt-4 text-base leading-relaxed text-slate-500">
                We support schools from kindergarten through senior secondary, whether private, public, or faith-based.
                Our mission is to make quality school administration accessible and affordable for every school in Liberia.
              </p>
              <div className="mt-8 flex gap-4">
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-accent-600 hover:-translate-y-0.5 transition-all"
                >
                  Register Your School <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="mailto:support@schoolsyncedu.com"
                  className="inline-flex items-center rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Contact Us
                </a>
              </div>
            </div>

            {/* Visual element */}
            <div ref={aboutRightRef} className="reveal reveal-right relative">
              <div className="rounded-2xl bg-gradient-to-br from-amber-100 to-amber-50 p-8">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Schools Active', value: '50+', color: 'bg-amber-500' },
                    { label: 'Students Managed', value: '12,000+', color: 'bg-green-500' },
                    { label: 'Counties Covered', value: '8', color: 'bg-purple-500' },
                    { label: 'Uptime', value: '99.9%', color: 'bg-amber-500' },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
                      <div className={`mb-2 h-2 w-8 rounded-full ${s.color}`} />
                      <p className="text-2xl font-bold text-slate-900">{s.value}</p>
                      <p className="text-xs text-slate-500">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== FINAL CTA ==========
           On the ruled backdrop rather than a flat primary-900 block, so the
           page closes on the same ground it opened on.

           The line under the heading read "Join schools across Liberia that are
           already using SchoolSync" — the same claim the invented testimonials
           made, and just as untrue. Replaced with what actually happens when
           the button is pressed. */}
      <GridBackdrop glow="amber" className="py-20 sm:py-24">
        <div ref={ctaRef} className="reveal mx-auto max-w-3xl text-center px-4">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Ready to modernize your school?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/60">
            Register in minutes — your school and its website go live straight away,
            and we will be with you while you set the rest up.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-accent-500 px-6 py-3.5 text-base font-semibold text-white shadow-lg transition-all hover:bg-accent-600 hover:-translate-y-0.5"
            >
              Get Started Free <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-6 py-3.5 text-base font-semibold text-white backdrop-blur-sm hover:bg-white/20 transition-all hover:-translate-y-0.5"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </GridBackdrop>
    </div>
  );
}
