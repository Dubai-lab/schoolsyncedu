import { Link } from 'react-router-dom';
import {
  BookOpen,
  GraduationCap,
  Users,
  Globe,
  Shield,
  Zap,
  Heart,
  Target,
  Eye,
  CheckCircle,
  ArrowRight,
  Mail,
  BarChart3,
  CalendarCheck,
  DollarSign,
  Nfc,
  Library,
  FileText,
} from 'lucide-react';

const STATS = [
  { value: '50+',    label: 'Schools Active' },
  { value: '12,000+', label: 'Students Managed' },
  { value: '8',      label: 'Counties Covered' },
  { value: '20+',    label: 'Platform Modules' },
];

const FEATURES_SUMMARY = [
  { icon: GraduationCap, title: 'Student Enrollment',   desc: 'Online application forms, enrollment workflows, and complete student profile management.' },
  { icon: CalendarCheck, title: 'Attendance Tracking',  desc: 'Digital attendance with NFC-enabled ID cards and automated absence notifications.' },
  { icon: FileText,      title: 'Grades & Report Cards', desc: 'Grade entry, automatic GPA calculation, Liberian-format report cards, and transcripts.' },
  { icon: DollarSign,   title: 'Fee Management',        desc: 'Automated fee billing, installment plans, mobile money collection, and financial reports.' },
  { icon: Nfc,          title: 'NFC Smart ID Cards',    desc: 'Design, print, and scan NFC-enabled student and staff identity cards.' },
  { icon: Library,      title: 'Library System',        desc: 'Book catalog, student checkouts, overdue tracking, and library reports.' },
  { icon: BarChart3,    title: 'Reports & Analytics',   desc: 'Academic, attendance, and financial dashboards with exportable data.' },
  { icon: Globe,        title: 'WAEC Registration',     desc: 'Register students for LJHSCE and WASSCE examinations directly in the platform.' },
];

const VALUES = [
  {
    icon: Target,
    title: 'Our Mission',
    body: 'To make quality school administration accessible and affordable for every school in Liberia — from small rural primary schools to large urban senior secondary institutions.',
  },
  {
    icon: Eye,
    title: 'Our Vision',
    body: 'A Liberia where every school runs on modern, digital systems — where no teacher wastes hours on paperwork, no parent waits weeks for a report card, and no administrator loses data in a flood or fire.',
  },
  {
    icon: Heart,
    title: 'Our Values',
    body: 'Simplicity, reliability, and local relevance. We build for the realities of Liberian schools — intermittent internet, mobile-first users, LRD and USD payments, and WAEC exam requirements.',
  },
];

const WHY_US = [
  'Built specifically for Liberian and West African schools — not a generic global product adapted for Africa',
  'Supports both Liberian Dollar (LRD) and US Dollar (USD) fee transactions',
  'Integrates MTN Mobile Money for fee payments — no bank account required',
  'Includes WAEC LJHSCE and WASSCE candidate registration built into the platform',
  'NFC-based student ID cards for fast, contactless attendance scanning',
  '14 distinct user roles from Super Admin to Parent — every stakeholder has a portal',
  'Each school gets its own isolated, secure environment with row-level data security',
  'Free trial included — get started with no upfront payment',
];

export default function AboutPage() {
  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-900 via-primary-700 to-primary-600 py-20 sm:py-28">
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
        <div className="relative mx-auto max-w-3xl px-4 text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm text-white/80 backdrop-blur-sm">
            <BookOpen className="h-4 w-4" />
            About SchoolSync
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Built for Liberia,<br />by Liberians
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/70">
            SchoolSync is the leading school management platform for Liberian schools. We give principals,
            registrars, bursars, teachers, students, and parents one unified system to run the entire school — digitally.
          </p>
        </div>
      </section>

      {/* ── Stats bar ────────────────────────────────────────────────────────── */}
      <section className="border-b border-slate-100 bg-white py-10">
        <div className="mx-auto max-w-4xl px-4">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-3xl font-extrabold text-primary-600">{s.value}</p>
                <p className="mt-1 text-sm text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Our Story ────────────────────────────────────────────────────────── */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center mb-12">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary-600">Our Story</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
              Why we built SchoolSync
            </h2>
          </div>
          <div className="prose prose-slate prose-lg mx-auto text-slate-600 leading-relaxed space-y-5">
            <p>
              SchoolSync was born out of a simple observation: schools in Liberia were managing critical
              student data — enrollment records, grade sheets, fee ledgers, attendance registers — on paper,
              in spreadsheets, or in disconnected tools that weren't built for the Liberian education system.
              When data was lost, it was lost forever. When a parent wanted to know their child's grade,
              they had to physically come to school. When a bursar needed to reconcile term fees, it took days.
            </p>
            <p>
              The EduLiberia team set out to change that. We built SchoolSync as a unified, cloud-based
              school management system designed from the ground up for how Liberian schools actually work —
              with WAEC exam registration, mobile money payments, Liberian Dollar support, NFC-based
              attendance, and role structures that match the real hierarchy of a Liberian school staff.
            </p>
            <p>
              Today, SchoolSync serves schools across multiple counties in Liberia, from kindergarten through
              senior secondary. Private schools, public schools, faith-based schools, and community schools
              all run on the same platform. Our goal is to make digital school administration the standard
              in Liberia — not the exception.
            </p>
          </div>
        </div>
      </section>

      {/* ── Mission / Vision / Values ────────────────────────────────────────── */}
      <section className="bg-slate-50 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center mb-12">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary-600">What drives us</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">Mission, Vision & Values</h2>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {VALUES.map((v) => (
              <div key={v.title} className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100">
                  <v.icon className="h-6 w-6 text-primary-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">{v.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-500">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Who We Serve ─────────────────────────────────────────────────────── */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-primary-600">Who we serve</p>
              <h2 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
                Every school in Liberia
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-500">
                SchoolSync is designed for any school in Liberia or West Africa, regardless of size or type.
                Whether you run a small community primary school in Bong County or a large private senior
                secondary school in Monrovia, SchoolSync scales to fit your needs.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  'Private and faith-based schools',
                  'Public and government-assisted schools',
                  'Community and NGO-supported schools',
                  'Primary, junior high, and senior secondary schools',
                  'Single-campus and multi-branch institutions',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-slate-600">
                    <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-primary-50 to-primary-100 p-8">
              <div className="space-y-4">
                {[
                  { role: 'Principal / Head Teacher',   desc: 'Full oversight — enrollment, staff, reports, and school-wide analytics.' },
                  { role: 'Registrar',                  desc: 'Student applications, enrollment approvals, and academic records.' },
                  { role: 'Bursar / Accountant',        desc: 'Fee billing, payment collection, installment plans, and financial reports.' },
                  { role: 'Teacher / Class Teacher',    desc: 'Attendance marking, grade entry, and communication with parents.' },
                  { role: 'Student',                    desc: 'Personal portal for grades, attendance, fees, timetable, and ID card.' },
                  { role: 'Parent / Guardian',          desc: 'Real-time access to their child\'s academic progress and fee status.' },
                ].map((r) => (
                  <div key={r.role} className="rounded-xl bg-white p-4 shadow-sm">
                    <p className="text-sm font-semibold text-slate-800">{r.role}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{r.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Platform Features ────────────────────────────────────────────────── */}
      <section className="bg-slate-50 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center mb-12">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary-600">Platform</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
              One platform. Every module your school needs.
            </h2>
            <p className="mt-4 text-base text-slate-500">
              SchoolSync covers every aspect of school administration — from the first student
              application to the final graduation certificate.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES_SUMMARY.map((f) => (
              <div key={f.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100">
                  <f.icon className="h-5 w-5 text-primary-600" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">{f.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{f.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <a href="/#features" className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:underline">
              See all features <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {/* ── Why SchoolSync ───────────────────────────────────────────────────── */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center mb-12">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary-600">Why choose us</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
              What makes SchoolSync different
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {WHY_US.map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
                <Zap className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" />
                <p className="text-sm leading-relaxed text-slate-600">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Security ─────────────────────────────────────────────────────────── */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 sm:p-10 shadow-sm">
            <div className="flex flex-col items-center text-center gap-4 sm:flex-row sm:text-left sm:items-start sm:gap-6">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-green-100">
                <Shield className="h-7 w-7 text-green-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Your data is secure and private</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  SchoolSync is built on enterprise-grade infrastructure with HTTPS encryption, row-level database
                  security, and role-based access control. Each school's data is fully isolated — no school
                  can ever access another school's information. Your student records, fee data, and staff
                  information are protected at every layer of the system.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Team / Contact ───────────────────────────────────────────────────── */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-primary-600">The team</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">Passionate about Liberian education</h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-500">
                The EduLiberia team is made up of software engineers, educators, and administrators
                who understand the challenges facing Liberian schools firsthand. We work closely with
                school principals, registrars, and teachers to keep improving the platform based
                on real feedback from real schools.
              </p>
              <p className="mt-4 text-sm leading-relaxed text-slate-500">
                We are headquartered in Monrovia, Liberia, and support schools across all 15 counties.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/contact"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 transition-colors"
                >
                  <Mail className="h-4 w-4" /> Get in Touch
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Register Your School <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100">
                    <Mail className="h-4 w-4 text-blue-600" />
                  </div>
                  <p className="text-sm font-semibold text-slate-800">Email Us</p>
                </div>
                <a href="mailto:support@schoolsyncedu.com" className="text-sm text-primary-600 hover:underline">
                  support@schoolsyncedu.com
                </a>
                <p className="mt-1 text-xs text-slate-400">Response within 1–2 business days</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100">
                    <Users className="h-4 w-4 text-green-600" />
                  </div>
                  <p className="text-sm font-semibold text-slate-800">Register Your School</p>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Sign up online in minutes. Your school portal includes a free trial —
                  no payment needed to get started.
                </p>
                <Link to="/register" className="mt-2 block text-sm text-primary-600 hover:underline">
                  Start free trial →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────────── */}
      <section className="bg-primary-900 py-20">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Ready to modernize your school?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/60">
            Join schools across Liberia already using SchoolSync. Get started free today — no credit card required.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-accent-500 px-6 py-3.5 text-base font-semibold text-white shadow-lg hover:bg-accent-600 hover:-translate-y-0.5 transition-all"
            >
              Register Your School Free <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-6 py-3.5 text-base font-semibold text-white backdrop-blur-sm hover:bg-white/20 transition-all"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
