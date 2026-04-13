import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  motion,
  useInView,
  useScroll,
  useTransform,
  AnimatePresence,
} from 'framer-motion';
import {
  ArrowRight,
  CheckCircle,
  Building2,
  UserPlus,
  Users,
  GraduationCap,
  DollarSign,
  CalendarCheck,
  BarChart3,
  Nfc,
  Mail,
  Shield,
  Play,
  ChevronRight,
  BookOpen,
  Zap,
  Star,
  Globe,
} from 'lucide-react';

// ─── Data ────────────────────────────────────────────────────────────────────

const STEPS = [
  {
    number: '01',
    icon: Building2,
    title: 'Register Your School',
    desc: 'Fill in your school details — name, county, principal, contact info. Takes under 3 minutes.',
    color: 'from-blue-500 to-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    tip: 'Have your MOE registration number ready if you want to include it.',
  },
  {
    number: '02',
    icon: Mail,
    title: 'Verify Your Email',
    desc: 'We send a 6-digit OTP to your email. Enter it to confirm your identity and secure your account.',
    color: 'from-violet-500 to-violet-600',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    tip: 'Check your spam folder if you don\'t receive the code within a minute.',
  },
  {
    number: '03',
    icon: Shield,
    title: 'Choose a Plan',
    desc: 'Pick the plan that fits your school size. Every plan starts with a free trial — no credit card required.',
    color: 'from-emerald-500 to-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    tip: 'Not sure which plan? Start with Basic and upgrade anytime.',
  },
  {
    number: '04',
    icon: Nfc,
    title: 'Brand Your School',
    desc: 'Upload your school logo, set your colors, and write your motto. Your portal is uniquely yours.',
    color: 'from-amber-500 to-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    tip: 'A good logo and clear motto builds trust with parents.',
  },
  {
    number: '05',
    icon: UserPlus,
    title: 'Add Your IT Admin',
    desc: 'Create the IT Admin account — they manage users, settings, and system configuration.',
    color: 'from-rose-500 to-rose-600',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    tip: 'The IT Admin is your technical point of contact inside the school.',
  },
  {
    number: '06',
    icon: Users,
    title: 'Invite Staff & Teachers',
    desc: 'Add your registrar, bursar, teachers, and librarian. Assign each person the right role and permissions.',
    color: 'from-cyan-500 to-cyan-600',
    bg: 'bg-cyan-50',
    border: 'border-cyan-200',
    tip: 'Staff receive a welcome email with login instructions automatically.',
  },
  {
    number: '07',
    icon: GraduationCap,
    title: 'Enroll Students',
    desc: 'Import your student roster or add students one by one. Assign them to classes and academic terms.',
    color: 'from-primary-500 to-primary-600',
    bg: 'bg-primary-50',
    border: 'border-primary-200',
    tip: 'Use bulk import for large rosters — CSV upload supported.',
  },
  {
    number: '08',
    icon: Zap,
    title: 'You\'re Live!',
    desc: 'Start taking attendance, entering grades, collecting fees, and communicating with parents. Your school is fully digital.',
    color: 'from-green-500 to-green-600',
    bg: 'bg-green-50',
    border: 'border-green-200',
    tip: 'Share your school portal link with parents so they can track their children.',
  },
];

const MODULES = [
  {
    id: 'attendance',
    label: 'Attendance',
    icon: CalendarCheck,
    color: 'text-blue-600',
    activeBg: 'bg-blue-600',
    title: 'Digital Attendance Tracking',
    desc: 'Mark attendance in seconds using NFC smart ID cards or manual entry. Automated absence alerts notify parents immediately.',
    features: ['NFC tap-in / tap-out', 'Manual override per teacher', 'Parent SMS/email alerts', 'Absence & late reports', 'Period-by-period tracking'],
    visual: { bars: [85, 92, 78, 96, 88, 94, 91], label: 'Weekly attendance rate' },
  },
  {
    id: 'grades',
    label: 'Grades',
    icon: GraduationCap,
    color: 'text-violet-600',
    activeBg: 'bg-violet-600',
    title: 'Grade Management & Report Cards',
    desc: 'Teachers enter grades per subject and term. The system automatically calculates GPAs, class rank, and generates printable report cards.',
    features: ['Multi-subject grade entry', 'Automatic GPA calculation', 'Class ranking', 'Printable report cards', 'WAEC exam registration'],
    visual: { bars: [72, 88, 65, 94, 81, 77, 90], label: 'Average class performance' },
  },
  {
    id: 'fees',
    label: 'Fees',
    icon: DollarSign,
    color: 'text-emerald-600',
    activeBg: 'bg-emerald-600',
    title: 'Fee Collection & Billing',
    desc: 'Bill parents automatically, track payments, issue digital receipts. Accept mobile money (Orange, MTN, Lonestar) and cash.',
    features: ['Automated fee billing', 'Mobile money payments', 'Digital receipt generation', 'Outstanding balance tracking', 'Financial dashboards'],
    visual: { bars: [60, 75, 82, 90, 95, 88, 97], label: 'Monthly fee collection rate' },
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: BarChart3,
    color: 'text-amber-600',
    activeBg: 'bg-amber-600',
    title: 'Analytics & Reports',
    desc: 'Real-time dashboards show enrollment trends, attendance rates, fee collection, and academic performance — exportable as PDF or Excel.',
    features: ['Enrollment analytics', 'Attendance rate trends', 'Fee collection reports', 'Academic performance charts', 'Exportable PDF / Excel'],
    visual: { bars: [55, 68, 74, 82, 79, 88, 93], label: 'Report generation this term' },
  },
];

const FAQS = [
  { q: 'How long does setup take?', a: 'Most schools are fully live within 1–2 days. Registration itself takes under 5 minutes. Bulk-importing students and inviting staff is the most time-consuming part, but our team can assist.' },
  { q: 'Do I need technical knowledge?', a: 'No. SchoolSync is designed to be used by school administrators without any IT background. The interface is simple, step-by-step, and fully guided.' },
  { q: 'Can I try it before paying?', a: 'Yes! Every plan includes a free trial period. You have full access to all features during the trial with no credit card required.' },
  { q: 'What if my school has more students than my plan allows?', a: 'You can upgrade your plan at any time from your admin dashboard. Upgrades take effect immediately.' },
  { q: 'Can parents and students access the system?', a: 'Yes. Parents get a parent portal where they can view grades, attendance, fees, and receive communications. Students can view their own academic records.' },
  { q: 'Is my school\'s data safe?', a: 'Absolutely. Each school\'s data is completely isolated from other schools using row-level security. All data is encrypted at rest and in transit.' },
];

// ─── Animation variants ───────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

const fadeLeft = {
  hidden: { opacity: 0, x: -50 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

const fadeRight = {
  hidden: { opacity: 0, x: 50 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepCard({ step, index }: { step: typeof STEPS[0]; index: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  const isEven = index % 2 === 0;

  return (
    <div ref={ref} className="relative flex flex-col items-center gap-6 md:flex-row md:gap-12">
      {/* Timeline dot */}
      <div className="absolute left-1/2 top-0 hidden h-full md:block" style={{ transform: 'translateX(-50%)' }}>
        <motion.div
          initial={{ scaleY: 0, originY: 0 }}
          animate={isInView ? { scaleY: 1 } : { scaleY: 0 }}
          transition={{ duration: 0.8, delay: index * 0.1, ease: 'easeOut' }}
          className="mx-auto h-full w-0.5 bg-gradient-to-b from-slate-200 to-slate-100"
        />
      </div>

      {/* Left / Right layout alternating */}
      <motion.div
        variants={isEven ? fadeLeft : fadeRight}
        initial="hidden"
        animate={isInView ? 'visible' : 'hidden'}
        transition={{ delay: 0.1 }}
        className={`flex-1 ${isEven ? 'md:text-right' : 'md:order-3'}`}
      >
        {isEven ? (
          <div className={`rounded-2xl border ${step.border} ${step.bg} p-6 shadow-sm`}>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{step.tip}</p>
            <p className="text-sm text-slate-600 italic">💡 Pro tip</p>
          </div>
        ) : (
          <div className={`rounded-2xl border ${step.border} ${step.bg} p-6 shadow-sm`}>
            <h3 className="text-lg font-bold text-slate-900">{step.title}</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">{step.desc}</p>
          </div>
        )}
      </motion.div>

      {/* Center icon */}
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={isInView ? { scale: 1, rotate: 0 } : { scale: 0, rotate: -20 }}
        transition={{ duration: 0.5, delay: index * 0.05, type: 'spring', stiffness: 200 }}
        className="relative z-10 flex-shrink-0"
      >
        <div className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${step.color} shadow-lg`}>
          <step.icon className="h-8 w-8 text-white" />
        </div>
        <div className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-bold text-slate-700 shadow-md border border-slate-100">
          {step.number}
        </div>
      </motion.div>

      {/* Right / Left content */}
      <motion.div
        variants={isEven ? fadeRight : fadeLeft}
        initial="hidden"
        animate={isInView ? 'visible' : 'hidden'}
        transition={{ delay: 0.1 }}
        className={`flex-1 ${isEven ? 'md:order-3' : 'md:text-right'}`}
      >
        {isEven ? (
          <div className={`rounded-2xl border ${step.border} ${step.bg} p-6 shadow-sm`}>
            <h3 className="text-lg font-bold text-slate-900">{step.title}</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">{step.desc}</p>
          </div>
        ) : (
          <div className={`rounded-2xl border ${step.border} ${step.bg} p-6 shadow-sm`}>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{step.tip}</p>
            <p className="text-sm text-slate-600 italic">💡 Pro tip</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function BarChart({ bars, label }: { bars: number[]; label: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div ref={ref} className="rounded-xl bg-slate-900 p-5">
      <p className="text-xs text-slate-400 mb-4">{label}</p>
      <div className="flex items-end gap-2 h-28">
        {bars.map((h, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <motion.div
              initial={{ height: 0 }}
              animate={isInView ? { height: `${h}%` } : { height: 0 }}
              transition={{ duration: 0.7, delay: i * 0.08, ease: 'easeOut' }}
              className="w-full rounded-t bg-primary-500 min-h-[4px]"
              style={{ height: `${h}%` }}
            />
            <span className="text-[10px] text-slate-500">{days[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FAQItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      variants={fadeUp}
      className="rounded-xl border border-slate-200 bg-white overflow-hidden"
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-6 py-5 text-left"
      >
        <span className="text-sm font-semibold text-slate-900">{q}</span>
        <motion.div
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0 ml-4"
        >
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <p className="px-6 pb-5 text-sm text-slate-500 leading-relaxed border-t border-slate-100 pt-4">
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Onboarding() {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const [activeModule, setActiveModule] = useState(0);
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroY = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  const stepsRef = useRef(null);
  const modulesRef = useRef(null);
  const modulesInView = useInView(modulesRef, { once: true, margin: '-100px' });

  return (
    <div className="overflow-x-hidden">

      {/* ── HERO ── */}
      <section ref={heroRef} className="relative min-h-screen flex items-center overflow-hidden bg-gradient-to-br from-primary-900 via-primary-700 to-primary-600">
        {/* Animated background blobs */}
        <motion.div
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-accent-500/10 blur-3xl"
        />
        <motion.div
          animate={{ x: [0, -20, 0], y: [0, 30, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-violet-500/10 blur-3xl"
        />

        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.2) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        {/* Back to Home button */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="absolute top-6 left-6 z-20"
        >
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition-all hover:bg-white/20"
          >
            <ArrowRight className="h-4 w-4 rotate-180" /> Back to Home
          </Link>
        </motion.div>

        <motion.div style={{ y: heroY }} className="relative mx-auto max-w-5xl px-4 py-20 text-center sm:px-6">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm text-white/80 backdrop-blur-sm mb-8"
          >
            <BookOpen className="h-4 w-4" />
            Getting Started with SchoolSync
          </motion.div>

          {/* Headline with staggered words */}
          <motion.h1
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="text-4xl font-extrabold text-white sm:text-6xl lg:text-7xl leading-tight"
          >
            {['Your school,', 'fully digital', 'in minutes.'].map((line, i) => (
              <motion.span key={i} variants={fadeUp} className="block">
                {i === 1 ? <span className="text-accent-400">{line}</span> : line}
              </motion.span>
            ))}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.6 }}
            className="mx-auto mt-6 max-w-2xl text-lg text-white/70 leading-relaxed"
          >
            From registration to your first student enrolled — this guide walks you through every step.
            Follow along and your school will be live faster than you think.
          </motion.p>

          {/* Feature chips */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.6 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-3"
          >
            {['✓ Free trial included', '✓ No credit card required', '✓ 5-min setup', '✓ Full support'].map((chip) => (
              <span key={chip} className="rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm text-white/80">
                {chip}
              </span>
            ))}
          </motion.div>

          {/* CTA buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1, duration: 0.6 }}
            className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
          >
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-accent-500 px-7 py-4 text-base font-semibold text-white shadow-lg shadow-accent-500/30 transition-all hover:bg-accent-600 hover:shadow-xl hover:scale-105"
            >
              Start Free Trial <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#steps"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-7 py-4 text-base font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/20"
            >
              <Play className="h-4 w-4" /> See how it works
            </a>
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2"
          >
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              className="flex flex-col items-center gap-1"
            >
              <div className="h-6 w-3.5 rounded-full border-2 border-white/30 flex items-start justify-center pt-1">
                <motion.div
                  animate={{ y: [0, 6, 0], opacity: [1, 0, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="h-1 w-1 rounded-full bg-white/60"
                />
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      </section>

      {/* ── STATS BAR ── */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={stagger}
        className="border-b border-slate-100 bg-white py-10"
      >
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {[
              { value: '5 min', label: 'Average setup time' },
              { value: '14', label: 'User roles supported' },
              { value: '20+', label: 'Modules available' },
              { value: '99.9%', label: 'Platform uptime' },
            ].map((s) => (
              <motion.div key={s.label} variants={scaleIn} className="text-center">
                <p className="text-3xl font-extrabold text-primary-600">{s.value}</p>
                <p className="mt-1 text-sm text-slate-500">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ── STEPS TIMELINE ── */}
      <section id="steps" ref={stepsRef} className="py-20 sm:py-28 bg-slate-50">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="text-center mb-16"
          >
            <motion.p variants={fadeUp} className="text-sm font-semibold uppercase tracking-wider text-primary-600">
              Step by Step
            </motion.p>
            <motion.h2 variants={fadeUp} className="mt-2 text-3xl font-extrabold text-slate-900 sm:text-4xl">
              From zero to live in 8 steps
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-4 text-lg text-slate-500 max-w-xl mx-auto">
              Follow this guide in order. Each step builds on the last.
            </motion.p>
          </motion.div>

          <div className="space-y-16">
            {STEPS.map((step, index) => (
              <StepCard key={step.number} step={step} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* ── MODULES TOUR ── */}
      <section ref={modulesRef} className="py-20 sm:py-28 bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="text-center mb-12"
          >
            <motion.p variants={fadeUp} className="text-sm font-semibold uppercase tracking-wider text-primary-600">Modules</motion.p>
            <motion.h2 variants={fadeUp} className="mt-2 text-3xl font-extrabold text-slate-900 sm:text-4xl">
              Everything your school needs
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-4 text-lg text-slate-500">
              Click a module to explore its features
            </motion.p>
          </motion.div>

          {/* Module tab bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={modulesInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="flex flex-wrap items-center justify-center gap-3 mb-10"
          >
            {MODULES.map((m, i) => (
              <button
                key={m.id}
                onClick={() => setActiveModule(i)}
                className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all ${
                  activeModule === i
                    ? `${m.activeBg} text-white shadow-lg scale-105`
                    : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <m.icon className="h-4 w-4" />
                {m.label}
              </button>
            ))}
          </motion.div>

          {/* Module content panel */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeModule}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="grid grid-cols-1 gap-8 lg:grid-cols-2 items-center"
            >
              {/* Text */}
              <div>
                <div className={`inline-flex items-center gap-2 rounded-xl p-3 mb-4 ${MODULES[activeModule].bg ?? 'bg-slate-100'}`}>
                  {(() => { const Icon = MODULES[activeModule].icon; return <Icon className={`h-6 w-6 ${MODULES[activeModule].color}`} />; })()}
                </div>
                <h3 className="text-2xl font-bold text-slate-900">{MODULES[activeModule].title}</h3>
                <p className="mt-3 text-base text-slate-500 leading-relaxed">{MODULES[activeModule].desc}</p>
                <ul className="mt-6 space-y-3">
                  {MODULES[activeModule].features.map((f, i) => (
                    <motion.li
                      key={f}
                      initial={{ opacity: 0, x: -15 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.07 }}
                      className="flex items-center gap-2.5 text-sm text-slate-700"
                    >
                      <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
                      {f}
                    </motion.li>
                  ))}
                </ul>
              </div>

              {/* Visual */}
              <div className="space-y-4">
                <BarChart
                  bars={MODULES[activeModule].visual.bars}
                  label={MODULES[activeModule].visual.label}
                />
                {/* Mock stat cards */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'This Week', value: `${MODULES[activeModule].visual.bars[6]}%` },
                    { label: 'This Month', value: `${Math.round(MODULES[activeModule].visual.bars.reduce((a, b) => a + b) / MODULES[activeModule].visual.bars.length)}%` },
                    { label: 'Trend', value: '↑ Good' },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg border border-slate-200 bg-white px-3 py-4 text-center">
                      <p className="text-lg font-bold text-slate-900">{s.value}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* ── ROLES ── */}
      <section className="py-20 sm:py-28 bg-slate-50">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="text-center mb-12"
          >
            <motion.p variants={fadeUp} className="text-sm font-semibold uppercase tracking-wider text-primary-600">User Roles</motion.p>
            <motion.h2 variants={fadeUp} className="mt-2 text-3xl font-extrabold text-slate-900 sm:text-4xl">
              The right access for everyone
            </motion.h2>
            <motion.p variants={fadeUp} className="mt-4 text-lg text-slate-500 max-w-2xl mx-auto">
              SchoolSync supports 14 user roles. Each person sees only what they need to do their job.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
          >
            {[
              { role: 'Proprietor', desc: 'Full ownership & billing', icon: Shield, color: 'bg-violet-100 text-violet-700' },
              { role: 'IT Admin', desc: 'System config & users', icon: Globe, color: 'bg-blue-100 text-blue-700' },
              { role: 'Principal', desc: 'School-wide oversight', icon: GraduationCap, color: 'bg-primary-100 text-primary-700' },
              { role: 'Registrar', desc: 'Enrollment & records', icon: BookOpen, color: 'bg-emerald-100 text-emerald-700' },
              { role: 'Bursar', desc: 'Fees & finance', icon: DollarSign, color: 'bg-amber-100 text-amber-700' },
              { role: 'Teacher', desc: 'Grades & attendance', icon: Users, color: 'bg-rose-100 text-rose-700' },
              { role: 'Parent', desc: 'Child progress view', icon: Star, color: 'bg-pink-100 text-pink-700' },
              { role: 'Student', desc: 'Own academic records', icon: Zap, color: 'bg-cyan-100 text-cyan-700' },
            ].map((r) => (
              <motion.div
                key={r.role}
                variants={scaleIn}
                whileHover={{ y: -4, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}
                className="rounded-2xl border border-slate-200 bg-white p-5 text-center cursor-default"
              >
                <div className={`mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${r.color}`}>
                  <r.icon className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-slate-900">{r.role}</p>
                <p className="mt-0.5 text-xs text-slate-500">{r.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-20 sm:py-28 bg-white">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="text-center mb-12"
          >
            <motion.p variants={fadeUp} className="text-sm font-semibold uppercase tracking-wider text-primary-600">FAQ</motion.p>
            <motion.h2 variants={fadeUp} className="mt-2 text-3xl font-extrabold text-slate-900 sm:text-4xl">
              Common questions
            </motion.h2>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="space-y-3"
          >
            {FAQS.map((item, i) => (
              <FAQItem key={item.q} q={item.q} a={item.a} index={i} />
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-900 via-primary-700 to-primary-600 py-24">
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[500px] rounded-full bg-accent-500/20 blur-3xl"
        />

        <div className="relative mx-auto max-w-3xl px-4 text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            <motion.div variants={scaleIn} className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
              <BookOpen className="h-8 w-8 text-white" />
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl font-extrabold text-white sm:text-5xl">
              Ready to get started?
            </motion.h2>
            <motion.p variants={fadeUp} className="mx-auto mt-4 max-w-xl text-lg text-white/70">
              Register your school today. Your free trial starts immediately — no credit card, no commitment.
            </motion.p>
            <motion.div variants={fadeUp} className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 rounded-xl bg-accent-500 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-accent-500/30 transition-all hover:bg-accent-600 hover:scale-105"
              >
                Register Your School <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-8 py-4 text-base font-semibold text-white backdrop-blur-sm hover:bg-white/20"
              >
                Talk to Us
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
