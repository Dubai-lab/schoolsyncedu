import { useState } from 'react';
import {
  GraduationCap,
  Users,
  BookOpen,
  CalendarCheck,
  Phone,
  MapPin,
  Mail,
  Globe,
  ChevronRight,
  Star,
  Award,
  Clock,
  Palette,
  Monitor,
} from 'lucide-react';

/**
 * 3D interactive preview of the default school website that every
 * proprietor receives when they register their school on SchoolSync.
 */
export default function SchoolSitePreview() {
  const [isFlat, setIsFlat] = useState(false);

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-50 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary-600">
            Your School Website
          </p>
          <h2 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
            Every school gets a stunning website
          </h2>
          <p className="mt-4 text-lg text-slate-500">
            Register your school and instantly get a professional, customizable
            website. Change colors, upload your logo, and make it yours.
          </p>
        </div>

        {/* Toggle flat / 3D view */}
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            onClick={() => setIsFlat(false)}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
              !isFlat
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Monitor className="h-3.5 w-3.5" /> 3D View
          </button>
          <button
            onClick={() => setIsFlat(true)}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
              isFlat
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Palette className="h-3.5 w-3.5" /> Flat View
          </button>
        </div>

        {/* 3D perspective wrapper */}
        <div className="mt-12" style={{ perspective: '1800px' }}>
          <div
            className="mx-auto max-w-5xl transition-transform duration-700 ease-out"
            style={{
              transform: isFlat
                ? 'rotateX(0deg) rotateY(0deg)'
                : 'rotateX(8deg) rotateY(-6deg)',
              transformStyle: 'preserve-3d',
            }}
          >
            {/* Browser chrome */}
            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-300/40 overflow-hidden">
              {/* Title bar */}
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-2.5">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-400" />
                  <div className="h-3 w-3 rounded-full bg-amber-400" />
                  <div className="h-3 w-3 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 mx-8">
                  <div className="flex items-center gap-2 rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-xs text-slate-400">
                    <Globe className="h-3 w-3" />
                    <span>
                      yourschool.eduliberia.com
                    </span>
                  </div>
                </div>
              </div>

              {/* ===== MOCK SCHOOL WEBSITE CONTENT ===== */}
              <div className="overflow-hidden">
                {/* School navbar */}
                <div className="flex items-center justify-between border-b border-slate-100 bg-white px-6 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600">
                      <GraduationCap className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 leading-tight">
                        Monrovia Academy
                      </p>
                      <p className="text-[10px] text-slate-400 leading-tight">
                        Excellence in Education
                      </p>
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-5 text-[11px] font-medium text-slate-500">
                    <span className="text-blue-600">Home</span>
                    <span className="hover:text-slate-700 cursor-default">About</span>
                    <span className="hover:text-slate-700 cursor-default">Academics</span>
                    <span className="hover:text-slate-700 cursor-default">Admissions</span>
                    <span className="hover:text-slate-700 cursor-default">Gallery</span>
                    <span className="hover:text-slate-700 cursor-default">Contact</span>
                    <span className="rounded-md bg-blue-600 px-3 py-1 text-[10px] font-semibold text-white">
                      Portal Login
                    </span>
                  </div>
                </div>

                {/* Hero */}
                <div className="relative bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 px-6 py-10 sm:py-14">
                  {/* Grid overlay */}
                  <div
                    className="absolute inset-0 opacity-[0.04]"
                    style={{
                      backgroundImage:
                        'linear-gradient(rgba(255,255,255,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.3) 1px, transparent 1px)',
                      backgroundSize: '40px 40px',
                    }}
                  />
                  <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-amber-400/10 blur-3xl" />
                  <div className="relative mx-auto max-w-xl text-center">
                    <div className="mb-3 inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-[10px] font-medium text-white/70 backdrop-blur-sm">
                      <Award className="h-3 w-3" /> Est. 1985 — Montserrado County
                    </div>
                    <h1 className="text-xl font-extrabold text-white sm:text-2xl">
                      Shaping Tomorrow's <span className="text-amber-400">Leaders</span> Today
                    </h1>
                    <p className="mt-2 text-[11px] leading-relaxed text-white/60">
                      A premier institution dedicated to academic excellence, character building, and preparing students for the challenges of the future.
                    </p>
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                      <span className="rounded-md bg-amber-500 px-3 py-1.5 text-[10px] font-semibold text-white shadow">
                        Apply Now
                      </span>
                      <span className="rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                        Virtual Tour
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-4 divide-x divide-slate-100 border-b border-slate-100 bg-white">
                  {[
                    { icon: Users, val: '1,200+', label: 'Students' },
                    { icon: GraduationCap, val: '85+', label: 'Teachers' },
                    { icon: BookOpen, val: '30+', label: 'Programs' },
                    { icon: Star, val: '98%', label: 'Pass Rate' },
                  ].map((s) => (
                    <div key={s.label} className="flex flex-col items-center py-3 sm:py-4">
                      <s.icon className="h-3.5 w-3.5 text-blue-500 mb-1" />
                      <p className="text-sm font-bold text-slate-900 sm:text-base">{s.val}</p>
                      <p className="text-[9px] text-slate-400">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Quick cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/50 p-4 sm:p-6">
                  {[
                    { icon: BookOpen, title: 'Academics', desc: 'K-12 curriculum', color: 'bg-blue-50 text-blue-600' },
                    { icon: CalendarCheck, title: 'Admissions', desc: 'Apply for 2026-27', color: 'bg-green-50 text-green-600' },
                    { icon: Users, title: 'Student Life', desc: 'Clubs & sports', color: 'bg-purple-50 text-purple-600' },
                    { icon: Phone, title: 'Contact Us', desc: 'Get in touch', color: 'bg-amber-50 text-amber-600' },
                  ].map((c) => (
                    <div
                      key={c.title}
                      className="flex flex-col items-center rounded-xl border border-slate-100 bg-white p-3 text-center transition-shadow hover:shadow-md"
                    >
                      <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${c.color}`}>
                        <c.icon className="h-4 w-4" />
                      </div>
                      <p className="text-[11px] font-semibold text-slate-800">{c.title}</p>
                      <p className="text-[9px] text-slate-400">{c.desc}</p>
                    </div>
                  ))}
                </div>

                {/* Latest news strip */}
                <div className="border-t border-slate-100 bg-white px-6 py-4">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-blue-600">
                    Latest News
                  </p>
                  <div className="space-y-2">
                    {[
                      { title: 'WAEC 2026 Registration Now Open', date: 'Apr 5, 2026' },
                      { title: 'Sports Day — April 15th', date: 'Apr 2, 2026' },
                      { title: 'Parent-Teacher Conference Next Week', date: 'Mar 28, 2026' },
                    ].map((n) => (
                      <div key={n.title} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ChevronRight className="h-3 w-3 text-blue-400" />
                          <span className="text-[11px] text-slate-700">{n.title}</span>
                        </div>
                        <span className="flex items-center gap-1 text-[9px] text-slate-400">
                          <Clock className="h-2.5 w-2.5" /> {n.date}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer */}
                <div className="border-t border-slate-100 bg-slate-800 px-6 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-600">
                        <GraduationCap className="h-3.5 w-3.5 text-white" />
                      </div>
                      <span className="text-[10px] font-semibold text-white">
                        Monrovia Academy
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-[9px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-2.5 w-2.5" /> Monrovia, Liberia
                      </span>
                      <span className="flex items-center gap-1">
                        <Phone className="h-2.5 w-2.5" /> +231 77 123 4567
                      </span>
                      <span className="flex items-center gap-1">
                        <Mail className="h-2.5 w-2.5" /> info@monroviaacademy.edu
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 text-center text-[8px] text-slate-500">
                    Powered by SchoolSync &bull; EduLiberia
                  </p>
                </div>
              </div>
            </div>

            {/* Shadow / Reflection effect */}
            <div
              className="mx-auto mt-1 h-4 rounded-full bg-gradient-to-r from-transparent via-slate-200/60 to-transparent blur-md"
              style={{ width: '70%' }}
            />
          </div>
        </div>

        {/* Customization points */}
        <div className="mx-auto mt-14 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              icon: Palette,
              title: 'Fully Customizable',
              desc: 'Change colors, fonts, logo, and layout to match your school brand.',
            },
            {
              icon: Globe,
              title: 'Free Subdomain',
              desc: 'Get yourschool.eduliberia.com instantly, or connect a custom domain.',
            },
            {
              icon: Monitor,
              title: 'Staff Dashboard Theming',
              desc: 'Proprietors & IT admins can customize the internal dashboard too.',
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-slate-100 bg-white p-5 text-center shadow-sm"
            >
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
