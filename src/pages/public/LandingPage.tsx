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
  Star,
  Globe,
  Zap,
} from 'lucide-react';

const FEATURES = [
  { icon: GraduationCap, title: 'Student Management', desc: 'Enrollment, profiles, academic records, and class assignments in one place.' },
  { icon: CalendarCheck, title: 'Attendance Tracking', desc: 'Digital attendance marking with NFC cards and automated absence alerts.' },
  { icon: FileText, title: 'Grade Management', desc: 'Grade entry, report cards, transcripts, and GPA calculations.' },
  { icon: DollarSign, title: 'Fee Collection', desc: 'Automated fee billing, mobile money payments, receipts, and financial reports.' },
  { icon: Mail, title: 'Communications', desc: 'Announcements, messaging, letter templates, and automated notifications.' },
  { icon: Library, title: 'Library System', desc: 'Book catalog, checkout tracking, overdue management, and reports.' },
  { icon: Nfc, title: 'Smart ID Cards', desc: 'NFC-enabled student and staff ID cards with built-in attendance scanning.' },
  { icon: BarChart3, title: 'Reports & Analytics', desc: 'Academic, attendance, and financial dashboards with exportable reports.' },
  { icon: Shield, title: 'Role-Based Access', desc: '14 user roles with granular permissions from Super Admin to Parent.' },
  { icon: Users, title: 'Staff Management', desc: 'Staff profiles, permissions, and role assignments for your entire team.' },
  { icon: Globe, title: 'WAEC Exam Registration', desc: 'Register candidates for LJHSCE and WASSCE exams directly in the platform.' },
  { icon: Zap, title: 'Multi-Tenant SaaS', desc: 'Each school gets its own environment — isolated, secure, and scalable.' },
];

const STATS = [
  { value: '20+', label: 'Modules' },
  { value: '74', label: 'Database Tables' },
  { value: '14', label: 'User Roles' },
  { value: '99.9%', label: 'Uptime Target' },
];

const TESTIMONIALS = [
  {
    quote: 'SchoolSync has completely transformed how we manage our school. Everything from enrollment to report cards is now digital.',
    name: 'Principal James Kollie',
    school: 'Monrovia Academy',
  },
  {
    quote: 'The fee collection system alone has saved us hours of manual tracking. Parents can pay via mobile money now.',
    name: 'Bursar Mary Benson',
    school: 'Liberia Christian Academy',
  },
  {
    quote: 'As a parent, I can finally see my child\'s grades, attendance, and fee status in real-time. No more guessing.',
    name: 'Parent Emmanuel Toe',
    school: 'Bright Future School',
  },
];

export default function LandingPage() {
  // Fetch visible pricing plans for preview
  const { data: plans = [] } = useFetch<SubscriptionPlan[]>(
    ['public-plans'],
    () => pricingPlanService.list(),
  );
  const visiblePlans = plans.filter((p) => p.is_visible && p.is_active).slice(0, 3);

  return (
    <div>
      {/* ========== HERO ========== */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-900 via-primary-700 to-primary-600">
        {/* Background effects */}
        <div className="absolute inset-0">
          <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-accent-500/10 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-white/5 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }}
          />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-36">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm text-white/80 backdrop-blur-sm">
              <BookOpen className="h-4 w-4" />
              Built for Liberian Schools
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Transform School
              <br />
              Management with{' '}
              <span className="text-accent-500">SchoolSync</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/70">
              A unified SaaS platform for enrollment, grades, attendance, fees,
              communication, and more — designed specifically for schools in Liberia.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 rounded-xl bg-accent-500 px-6 py-3.5 text-base font-semibold text-white shadow-lg transition-all hover:bg-accent-600 hover:shadow-xl"
              >
                Get Started Free <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#features"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-6 py-3.5 text-base font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/20"
              >
                See Features
              </a>
            </div>
          </div>

          {/* Stats bar */}
          <div className="mx-auto mt-16 flex max-w-2xl flex-wrap justify-center gap-8 sm:gap-14">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-3xl font-bold text-white">{s.value}</p>
                <p className="mt-1 text-sm text-white/50">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== SCHOOL SITE PREVIEW ========== */}
      <SchoolSitePreview />

      {/* ========== FEATURES ========== */}
      <section id="features" className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary-600">Features</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
              Everything your school needs
            </h2>
            <p className="mt-4 text-lg text-slate-500">
              From enrollment to graduation — manage every aspect of your school in one platform.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-slate-100 bg-white p-6 transition-all hover:border-primary-200 hover:shadow-lg hover:shadow-primary-50"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-600 transition-colors group-hover:bg-primary-600 group-hover:text-white">
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="text-base font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== HOW IT WORKS ========== */}
      <section className="bg-slate-50 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary-600">How It Works</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
              Get your school online in minutes
            </h2>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
            {[
              {
                step: '01',
                title: 'Register Your School',
                desc: 'Fill in your school details, choose a plan, and create your admin account. Setup takes under 5 minutes.',
              },
              {
                step: '02',
                title: 'Set Up Your Team',
                desc: 'Invite your registrar, bursar, teachers, and other staff. Assign roles and permissions to control access.',
              },
              {
                step: '03',
                title: 'Go Live',
                desc: 'Your school is live! Start enrolling students, managing fees, taking attendance, and entering grades.',
              },
            ].map((item) => (
              <div key={item.step} className="relative rounded-2xl bg-white p-8 shadow-sm">
                <span className="text-5xl font-extrabold text-primary-100">{item.step}</span>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== PRICING PREVIEW ========== */}
      {visiblePlans.length > 0 && (
        <section id="pricing" className="py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-wider text-primary-600">Pricing</p>
              <h2 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
                Simple, transparent pricing
              </h2>
              <p className="mt-4 text-lg text-slate-500">
                Start with a free trial. Upgrade when you're ready.
              </p>
            </div>

            <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
              {visiblePlans.map((plan, i) => {
                const isPopular = i === 1;
                return (
                  <div
                    key={plan.id}
                    className={`relative rounded-2xl border p-8 ${
                      isPopular
                        ? 'border-primary-300 bg-primary-50/30 shadow-lg shadow-primary-100'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary-600 px-4 py-1 text-xs font-semibold text-white">
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
                          ? 'bg-primary-600 text-white shadow-sm hover:bg-primary-700'
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
              <Link
                to="/pricing"
                className="text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                View all plans & compare features →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ========== TESTIMONIALS ========== */}
      <section className="bg-slate-50 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary-600">Testimonials</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
              Trusted by schools across Liberia
            </h2>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="rounded-2xl bg-white p-8 shadow-sm">
                <div className="flex gap-1 text-accent-500 mb-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="text-sm leading-relaxed text-slate-600 italic">"{t.quote}"</p>
                <div className="mt-6 border-t border-slate-100 pt-4">
                  <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.school}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== ABOUT ========== */}
      <section id="about" className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-primary-600">About EduLiberia</p>
              <h2 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
                Built for Liberia, by Liberians
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-500">
                SchoolSync is part of the EduLiberia initiative to digitize education management across Liberia.
                Our platform is designed with the unique challenges and needs of Liberian schools in mind — 
                from WAEC exam registration to mobile money fee collection.
              </p>
              <p className="mt-4 text-base leading-relaxed text-slate-500">
                We support schools from kindergarten through senior secondary, whether private, public, or faith-based.
                Our mission is to make quality school administration accessible and affordable for every school in Liberia.
              </p>
              <div className="mt-8 flex gap-4">
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700"
                >
                  Register Your School <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="mailto:info@eduliberia.com"
                  className="inline-flex items-center rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Contact Us
                </a>
              </div>
            </div>

            {/* Visual element */}
            <div className="relative">
              <div className="rounded-2xl bg-gradient-to-br from-primary-100 to-primary-50 p-8">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Schools Active', value: '50+', color: 'bg-blue-500' },
                    { label: 'Students Managed', value: '12,000+', color: 'bg-green-500' },
                    { label: 'Counties Covered', value: '8', color: 'bg-purple-500' },
                    { label: 'Uptime', value: '99.9%', color: 'bg-amber-500' },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl bg-white p-5 shadow-sm">
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

      {/* ========== FINAL CTA ========== */}
      <section className="bg-primary-900 py-20">
        <div className="mx-auto max-w-3xl text-center px-4">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Ready to modernize your school?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/60">
            Join schools across Liberia that are already using SchoolSync to manage enrollment, grades, attendance, fees, and more.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-accent-500 px-6 py-3.5 text-base font-semibold text-white shadow-lg transition-all hover:bg-accent-600"
            >
              Get Started Free <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-6 py-3.5 text-base font-semibold text-white backdrop-blur-sm hover:bg-white/20"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
