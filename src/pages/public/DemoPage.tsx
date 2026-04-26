import { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, GraduationCap, CalendarCheck, FileText, DollarSign,
  Users, BookOpen, ClipboardList, Settings, BarChart3, ChevronLeft,
  ChevronRight, Play, Pause, RotateCcw, CheckCircle, Shield, Bell,
  Calendar, UserCog, Nfc, Clock, Check, ChevronDown,
} from 'lucide-react';

// ── Mock data ─────────────────────────────────────────────────────────────────
const SCHOOL = { name: 'Monrovia Christian Academy', code: 'MCA', county: 'Montserrado', principal: 'Dr. Samuel K. Johnson' };
const TODAY = 'Monday, April 28, 2026';
const TERM = 'First Term · 2025/2026';

const STUDENTS = [
  { id: 1, name: 'James Kollie',    cls: '10A', gpa: 3.7, att: 96, fee: 'paid',    amt: 190, paid: 190, present: true,  late: false },
  { id: 2, name: 'Fatima Kamara',   cls: '10A', gpa: 3.4, att: 92, fee: 'paid',    amt: 190, paid: 190, present: true,  late: false },
  { id: 3, name: 'Emmanuel Toe',    cls: '10A', gpa: 2.9, att: 88, fee: 'pending', amt: 190, paid: 0,   present: false, late: false },
  { id: 4, name: 'Grace Wleh',      cls: '10A', gpa: 3.8, att: 98, fee: 'paid',    amt: 190, paid: 190, present: true,  late: false },
  { id: 5, name: 'Moses Nimba',     cls: '10B', gpa: 2.5, att: 79, fee: 'overdue', amt: 190, paid: 0,   present: false, late: false },
  { id: 6, name: 'Blessing Flumo',  cls: '10A', gpa: 3.2, att: 91, fee: 'paid',    amt: 190, paid: 190, present: true,  late: true  },
  { id: 7, name: 'David Konneh',    cls: '10A', gpa: 3.5, att: 94, fee: 'paid',    amt: 190, paid: 190, present: true,  late: false },
  { id: 8, name: 'Rachel Zoe',      cls: '10B', gpa: 3.1, att: 87, fee: 'partial', amt: 190, paid: 100, present: true,  late: false },
  { id: 9, name: 'Samuel Barchue',  cls: '10B', gpa: 2.8, att: 83, fee: 'pending', amt: 190, paid: 0,   present: false, late: false },
  { id: 10, name: 'Patience Quaye', cls: '10A', gpa: 3.6, att: 95, fee: 'paid',    amt: 190, paid: 190, present: true,  late: false },
];

const STAFF = [
  { name: 'Samuel Weah',      role: 'Registrar',      email: 'registrar@mca.edu.lr', active: true  },
  { name: 'Martha Kpellen',   role: 'Bursar',          email: 'bursar@mca.edu.lr',    active: true  },
  { name: 'Joseph Zahn',      role: 'Teacher',         email: 'jzahn@mca.edu.lr',     active: true  },
  { name: 'Agnes Flomo',      role: 'Teacher',         email: 'aflomo@mca.edu.lr',    active: true  },
  { name: 'Thomas Quiwonkpa', role: 'IT Admin',        email: 'it@mca.edu.lr',        active: true  },
  { name: 'Jemima Saye',      role: 'Vice Principal',  email: 'vp@mca.edu.lr',        active: true  },
  { name: 'Peter Kollie',     role: 'Dean of Students',email: 'dean@mca.edu.lr',      active: true  },
  { name: 'Ruth Flomo',       role: 'Proprietor',      email: 'owner@mca.edu.lr',     active: true  },
];

const SUBJECTS = ['Mathematics', 'English Language', 'Biology', 'Chemistry', 'Social Studies', 'French'];

const GRADE_ROWS = [
  { name: 'James Kollie',   scores: [85, 79, 82, 76, 88, 74], gpa: 3.7, pos: 2 },
  { name: 'Grace Wleh',     scores: [91, 88, 90, 86, 84, 82], gpa: 3.8, pos: 1 },
  { name: 'Fatima Kamara',  scores: [78, 83, 76, 80, 85, 79], gpa: 3.4, pos: 4 },
  { name: 'Patience Quaye', scores: [82, 77, 84, 88, 80, 76], gpa: 3.6, pos: 3 },
  { name: 'David Konneh',   scores: [80, 75, 79, 77, 82, 71], gpa: 3.5, pos: 3 },
  { name: 'Blessing Flumo', scores: [74, 80, 72, 78, 76, 80], gpa: 3.2, pos: 5 },
];

const WAEC = [
  { name: 'Robert Johnson', id: 'WASSCE/2026/001', subjects: 8, status: 'submitted' },
  { name: 'Mary Konneh',    id: 'WASSCE/2026/002', subjects: 8, status: 'submitted' },
  { name: 'Prince Weah',    id: 'WASSCE/2026/003', subjects: 7, status: 'pending'   },
  { name: 'Alice Flomo',    id: 'WASSCE/2026/004', subjects: 8, status: 'submitted' },
  { name: 'George Nimba',   id: 'WASSCE/2026/005', subjects: 6, status: 'pending'   },
  { name: 'Helen Zoe',      id: 'WASSCE/2026/006', subjects: 8, status: 'submitted' },
  { name: 'Daniel Quiwonkpa',id:'WASSCE/2026/007', subjects: 7, status: 'submitted' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function FeeChip({ status }: { status: string }) {
  if (status === 'paid')    return <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">Paid</span>;
  if (status === 'partial') return <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">Partial</span>;
  if (status === 'overdue') return <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">Overdue</span>;
  return <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">Pending</span>;
}

function gradeToLetter(n: number) {
  if (n >= 90) return 'A';
  if (n >= 80) return 'B';
  if (n >= 70) return 'C';
  if (n >= 60) return 'D';
  return 'F';
}

function Avatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  const sizes = { sm: 'h-7 w-7 text-xs', md: 'h-9 w-9 text-sm', lg: 'h-12 w-12 text-base' };
  return (
    <div className={`${sizes[size]} flex items-center justify-center rounded-full bg-primary-100 font-semibold text-primary-700`}>
      {initials}
    </div>
  );
}

// ── Shared shell ─────────────────────────────────────────────────────────────
const NAV = [
  { label: 'Dashboard',   icon: LayoutDashboard },
  { label: 'Students',    icon: GraduationCap   },
  { label: 'Attendance',  icon: CalendarCheck   },
  { label: 'Grades',      icon: FileText        },
  { label: 'Fees',        icon: DollarSign      },
  { label: 'Report Cards',icon: ClipboardList   },
  { label: 'WAEC Exams',  icon: BookOpen        },
  { label: 'Staff',       icon: UserCog         },
  { label: 'Settings',    icon: Settings        },
];

function Shell({ active, children, title }: { active: string; children: React.ReactNode; title: string }) {
  return (
    <div className="flex h-full bg-slate-50">
      {/* Sidebar */}
      <aside className="flex w-56 flex-shrink-0 flex-col border-r border-slate-200 bg-white">
        {/* Logo */}
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
            <GraduationCap className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-900">SchoolSync</p>
            <p className="text-[10px] text-slate-400 leading-none">{SCHOOL.code}</p>
          </div>
        </div>
        {/* School name */}
        <div className="border-b border-slate-100 px-4 py-2.5">
          <p className="truncate text-xs font-semibold text-slate-700">{SCHOOL.name}</p>
          <p className="text-[10px] text-slate-400">{SCHOOL.county}</p>
        </div>
        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {NAV.map(({ label, icon: Icon }) => (
            <div
              key={label}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                active === label
                  ? 'bg-primary-600 text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6">
          <div>
            <h1 className="text-sm font-semibold text-slate-900">{title}</h1>
            <p className="text-[11px] text-slate-400">{TODAY} · {TERM}</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative rounded-lg p-1.5 text-slate-400 hover:bg-slate-50">
              <Bell className="h-4 w-4" />
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
            </button>
            <div className="flex items-center gap-2">
              <Avatar name={SCHOOL.principal} />
              <div className="hidden text-xs sm:block">
                <p className="font-medium text-slate-700">{SCHOOL.principal}</p>
                <p className="text-slate-400">Principal</p>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-5">
          {children}
        </main>
      </div>
    </div>
  );
}

// ── SCENE 1: Dashboard ────────────────────────────────────────────────────────
function SceneDashboard() {
  return (
    <Shell active="Dashboard" title="School Dashboard">
      <div className="space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Students', value: '342', sub: '+12 this term',  icon: GraduationCap, bg: 'bg-blue-50',   ic: 'text-blue-600'   },
            { label: 'Present Today',  value: '287', sub: '83.9% attendance',icon: CalendarCheck, bg: 'bg-green-50',  ic: 'text-green-600'  },
            { label: 'Active Staff',   value: '28',  sub: '3 absent today',  icon: Users,         bg: 'bg-purple-50', ic: 'text-purple-600' },
            { label: 'Monthly Revenue',value: '$2,150',sub: '14 pending fees',icon: DollarSign,   bg: 'bg-amber-50',  ic: 'text-amber-600'  },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg ${s.bg}`}>
                <s.icon className={`h-5 w-5 ${s.ic}`} />
              </div>
              <p className="text-xl font-bold text-slate-900">{s.value}</p>
              <p className="mt-0.5 text-xs font-medium text-slate-600">{s.label}</p>
              <p className="text-[11px] text-slate-400">{s.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* Attendance by class */}
          <div className="col-span-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Today's Attendance by Class</h3>
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">Live</span>
            </div>
            <div className="space-y-3">
              {[
                { cls: 'Class 10A', present: 28, total: 32 },
                { cls: 'Class 10B', present: 25, total: 30 },
                { cls: 'Class 9A',  present: 31, total: 34 },
                { cls: 'Class 9B',  present: 27, total: 31 },
                { cls: 'Class 8A',  present: 29, total: 33 },
              ].map(c => (
                <div key={c.cls} className="flex items-center gap-3">
                  <span className="w-16 text-xs text-slate-500">{c.cls}</span>
                  <div className="flex-1 h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-primary-500 transition-all" style={{ width: `${(c.present/c.total)*100}%` }} />
                  </div>
                  <span className="w-12 text-right text-xs font-medium text-slate-700">{c.present}/{c.total}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick actions */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-slate-700">Quick Actions</h3>
            <div className="space-y-2">
              {[
                { label: 'Mark Attendance', icon: CalendarCheck, color: 'bg-green-50 text-green-700'  },
                { label: 'Record Payment',  icon: DollarSign,    color: 'bg-amber-50 text-amber-700'  },
                { label: 'Enroll Student',  icon: GraduationCap, color: 'bg-blue-50 text-blue-700'    },
                { label: 'Enter Grades',    icon: FileText,      color: 'bg-purple-50 text-purple-700' },
                { label: 'Generate Report', icon: BarChart3,     color: 'bg-slate-100 text-slate-700'  },
              ].map(a => (
                <button key={a.label} className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-opacity hover:opacity-80 ${a.color}`}>
                  <a.icon className="h-3.5 w-3.5" /> {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Alerts */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: '14 students have unpaid fees', icon: DollarSign,    color: 'border-amber-200 bg-amber-50',  ic: 'text-amber-600'  },
            { label: '3 Grade 12 WAEC forms pending',icon: ClipboardList, color: 'border-blue-200 bg-blue-50',    ic: 'text-blue-600'   },
            { label: '5 new student applications',   icon: GraduationCap, color: 'border-green-200 bg-green-50',  ic: 'text-green-600'  },
          ].map(a => (
            <div key={a.label} className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${a.color}`}>
              <a.icon className={`h-5 w-5 flex-shrink-0 ${a.ic}`} />
              <p className="text-xs font-medium text-slate-700">{a.label}</p>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}

// ── SCENE 2: Student Enrollment ───────────────────────────────────────────────
function SceneEnrollment() {
  return (
    <Shell active="Students" title="Student Enrollment">
      <div className="grid grid-cols-3 gap-5">
        {/* Application list */}
        <div className="col-span-2 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Pending Applications</h3>
              <p className="text-xs text-slate-500">5 new applications waiting for review</p>
            </div>
            <button className="rounded-lg bg-primary-600 px-4 py-2 text-xs font-semibold text-white">+ New Enrollment</button>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-slate-50">
              <tr>
                {['Applicant', 'Grade Applied', 'Submitted', 'Status', 'Action'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-semibold text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'Michael Kollie',  grade: 'Grade 10', date: 'Apr 26, 2026', status: 'pending'  },
                { name: 'Sandra Nimba',    grade: 'Grade 9',  date: 'Apr 25, 2026', status: 'pending'  },
                { name: 'Aaron Flomo',     grade: 'Grade 11', date: 'Apr 24, 2026', status: 'approved' },
                { name: 'Blessing Weah',   grade: 'Grade 8',  date: 'Apr 23, 2026', status: 'approved' },
                { name: 'James Tulay',     grade: 'Grade 10', date: 'Apr 22, 2026', status: 'pending'  },
              ].map((r, i) => (
                <tr key={i} className="border-t border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={r.name} />
                      <span className="font-medium text-slate-800">{r.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.grade}</td>
                  <td className="px-4 py-3 text-slate-500">{r.date}</td>
                  <td className="px-4 py-3">
                    {r.status === 'approved'
                      ? <span className="rounded-full bg-green-100 px-2.5 py-0.5 font-semibold text-green-700">Approved</span>
                      : <span className="rounded-full bg-amber-100 px-2.5 py-0.5 font-semibold text-amber-700">Pending</span>}
                  </td>
                  <td className="px-4 py-3">
                    {r.status === 'pending' && (
                      <div className="flex gap-1">
                        <button className="rounded bg-green-500 px-2 py-1 text-[10px] font-semibold text-white">Approve</button>
                        <button className="rounded bg-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600">Review</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Stats sidebar */}
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">Enrollment Stats</h3>
            <div className="space-y-3">
              {[
                { label: 'Total Enrolled',  value: '342', color: 'text-slate-900' },
                { label: 'This Term',       value: '+24', color: 'text-green-600' },
                { label: 'Applications',    value: '5',   color: 'text-amber-600' },
                { label: 'Capacity',        value: '400', color: 'text-slate-500' },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{s.label}</span>
                  <span className={`text-sm font-bold ${s.color}`}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-green-200 bg-green-50 p-4">
            <div className="mb-2 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-xs font-semibold text-green-800">Online Applications</span>
            </div>
            <p className="text-xs text-green-700 leading-relaxed">
              Parents can apply from any phone or computer at <strong>schoolsyncedu.com</strong>. No paperwork needed.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-xs font-semibold text-slate-600">By Grade Level</h3>
            {[
              { grade: 'Grade 12', count: 38 },
              { grade: 'Grade 11', count: 42 },
              { grade: 'Grade 10', count: 67 },
              { grade: 'Grade 9',  count: 71 },
              { grade: 'Grade 8',  count: 65 },
            ].map(g => (
              <div key={g.grade} className="flex items-center gap-2 py-1">
                <span className="w-16 text-xs text-slate-500">{g.grade}</span>
                <div className="flex-1 h-1.5 rounded-full bg-slate-100">
                  <div className="h-1.5 rounded-full bg-primary-400" style={{ width: `${(g.count/80)*100}%` }} />
                </div>
                <span className="text-xs font-medium text-slate-700">{g.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Shell>
  );
}

// ── SCENE 3: Attendance ───────────────────────────────────────────────────────
function SceneAttendance() {
  return (
    <Shell active="Attendance" title="Mark Attendance">
      <div className="space-y-4">
        {/* Controls */}
        <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <label className="block text-xs font-medium text-slate-500">Class</label>
            <div className="mt-1 flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800">
              Class 10A <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Date</label>
            <div className="mt-1 flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800">
              <Calendar className="h-3.5 w-3.5 text-slate-400" /> {TODAY}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs">
            <span className="rounded-full bg-green-100 px-2 py-1 font-semibold text-green-700">7 Present</span>
            <span className="rounded-full bg-red-100 px-2 py-1 font-semibold text-red-700">2 Absent</span>
            <span className="rounded-full bg-amber-100 px-2 py-1 font-semibold text-amber-700">1 Late</span>
          </div>
          <button className="rounded-lg bg-primary-600 px-4 py-2 text-xs font-semibold text-white">Save Attendance</button>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-left font-semibold text-slate-500">#</th>
                <th className="px-5 py-3 text-left font-semibold text-slate-500">Student Name</th>
                <th className="px-5 py-3 text-left font-semibold text-slate-500">Student ID</th>
                <th className="px-5 py-3 text-center font-semibold text-slate-500">Present</th>
                <th className="px-5 py-3 text-center font-semibold text-slate-500">Absent</th>
                <th className="px-5 py-3 text-center font-semibold text-slate-500">Late</th>
                <th className="px-5 py-3 text-center font-semibold text-slate-500">Excused</th>
              </tr>
            </thead>
            <tbody>
              {STUDENTS.filter(s => s.cls === '10A').map((s, i) => {
                const status = s.late ? 'late' : s.present ? 'present' : 'absent';
                return (
                  <tr key={s.id} className="border-t border-slate-50 hover:bg-slate-50/60">
                    <td className="px-5 py-3 text-slate-400">{i + 1}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={s.name} />
                        <span className="font-medium text-slate-800">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-400">MCA-{2024 + i}-{String(i+1).padStart(3,'0')}</td>
                    {(['present','absent','late','excused'] as const).map(opt => (
                      <td key={opt} className="px-5 py-3 text-center">
                        <div className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all ${
                          status === opt
                            ? opt === 'present' ? 'border-green-500 bg-green-500'
                            : opt === 'absent'  ? 'border-red-500 bg-red-500'
                            : opt === 'late'    ? 'border-amber-500 bg-amber-500'
                            : 'border-blue-500 bg-blue-500'
                            : 'border-slate-200 bg-white'
                        }`}>
                          {status === opt && <Check className="h-3 w-3 text-white" />}
                        </div>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}

// ── SCENE 4: Grades ───────────────────────────────────────────────────────────
function SceneGrades() {
  return (
    <Shell active="Grades" title="Grade Entry — Class 10A">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">Class 10A</div>
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">First Term 2025/2026</div>
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">In Progress</span>
          </div>
          <button className="rounded-lg bg-primary-600 px-4 py-2 text-xs font-semibold text-white">Save All Grades</button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-500">Student</th>
                {SUBJECTS.map(s => <th key={s} className="px-3 py-3 text-center font-semibold text-slate-500">{s.split(' ')[0]}</th>)}
                <th className="px-4 py-3 text-center font-semibold text-slate-500">GPA</th>
                <th className="px-4 py-3 text-center font-semibold text-slate-500">Position</th>
              </tr>
            </thead>
            <tbody>
              {GRADE_ROWS.map((row, i) => (
                <tr key={i} className="border-t border-slate-50 hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={row.name} />
                      <span className="font-medium text-slate-800">{row.name}</span>
                    </div>
                  </td>
                  {row.scores.map((score, j) => (
                    <td key={j} className="px-3 py-3 text-center">
                      <div className={`inline-flex items-center justify-center rounded-lg px-2.5 py-1 font-semibold ${
                        score >= 85 ? 'bg-green-100 text-green-700' :
                        score >= 70 ? 'bg-blue-100 text-blue-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {score} <span className="ml-1 text-[10px] opacity-70">{gradeToLetter(score)}</span>
                      </div>
                    </td>
                  ))}
                  <td className="px-4 py-3 text-center font-bold text-primary-600">{row.gpa.toFixed(1)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`rounded-full px-2.5 py-0.5 font-bold text-[11px] ${
                      row.pos === 1 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                    }`}>{row.pos === 1 ? '1st' : row.pos === 2 ? '2nd' : `${row.pos}th`}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Report card preview */}
        <div className="rounded-xl border border-primary-200 bg-primary-50/40 p-4">
          <div className="flex items-center gap-3">
            <ClipboardList className="h-5 w-5 text-primary-600" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-primary-800">Report cards are ready to generate</p>
              <p className="text-[11px] text-primary-600">All grades entered. Click below to generate Liberian-format report cards for all 32 students in Class 10A.</p>
            </div>
            <button className="rounded-lg bg-primary-600 px-4 py-2 text-xs font-semibold text-white">Generate Report Cards</button>
          </div>
        </div>
      </div>
    </Shell>
  );
}

// ── SCENE 5: Fees ─────────────────────────────────────────────────────────────
function SceneFees() {
  const totalOwed = STUDENTS.reduce((s, st) => s + st.amt, 0);
  const totalPaid = STUDENTS.reduce((s, st) => s + st.paid, 0);
  return (
    <Shell active="Fees" title="Fee Collection">
      <div className="space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Billed',  value: `$${totalOwed}`,         bg: 'bg-slate-50',  tc: 'text-slate-900' },
            { label: 'Collected',     value: `$${totalPaid}`,          bg: 'bg-green-50',  tc: 'text-green-700' },
            { label: 'Outstanding',   value: `$${totalOwed-totalPaid}`,bg: 'bg-red-50',    tc: 'text-red-700'   },
            { label: 'Paid Students', value: `${STUDENTS.filter(s=>s.fee==='paid').length}/${STUDENTS.length}`, bg: 'bg-blue-50', tc: 'text-blue-700' },
          ].map(c => (
            <div key={c.label} className={`rounded-xl border border-slate-200 ${c.bg} p-4 shadow-sm`}>
              <p className={`text-xl font-bold ${c.tc}`}>{c.value}</p>
              <p className="mt-1 text-xs text-slate-500">{c.label}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Student Fee Records — Class 10A</h3>
            <button className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white">+ Record Payment</button>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-slate-50">
              <tr>
                {['Student', 'Total Fee', 'Amount Paid', 'Balance', 'Status', 'Last Payment', 'Action'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-semibold text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {STUDENTS.map(s => (
                <tr key={s.id} className="border-t border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={s.name} />
                      <span className="font-medium text-slate-800">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">${s.amt}</td>
                  <td className="px-4 py-3 text-slate-700 font-medium">${s.paid}</td>
                  <td className={`px-4 py-3 font-semibold ${s.amt - s.paid > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    ${s.amt - s.paid}
                  </td>
                  <td className="px-4 py-3"><FeeChip status={s.fee} /></td>
                  <td className="px-4 py-3 text-slate-400">Apr {10 + s.id}, 2026</td>
                  <td className="px-4 py-3">
                    {s.fee !== 'paid' && (
                      <button className="rounded bg-primary-50 px-2 py-1 text-[10px] font-semibold text-primary-700">Record</button>
                    )}
                    <button className="ml-1 rounded bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">Receipt</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}

// ── SCENE 6: Student Portal ───────────────────────────────────────────────────
function ScenePortal() {
  const student = STUDENTS[0];
  return (
    <div className="flex h-full bg-slate-50">
      {/* Student sidebar */}
      <aside className="flex w-48 flex-shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
            <GraduationCap className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-900">SchoolSync</p>
            <p className="text-[10px] text-slate-400 leading-none">Student Portal</p>
          </div>
        </div>
        <div className="border-b border-slate-100 px-4 py-3 text-center">
          <Avatar name={student.name} size="lg" />
          <p className="mt-2 text-xs font-semibold text-slate-800">{student.name}</p>
          <p className="text-[11px] text-slate-400">Class {student.cls} · {SCHOOL.code}</p>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {[
            { label: 'My Dashboard',  icon: LayoutDashboard, active: true  },
            { label: 'My Grades',     icon: FileText,        active: false },
            { label: 'Attendance',    icon: CalendarCheck,   active: false },
            { label: 'Timetable',     icon: Calendar,        active: false },
            { label: 'My Fees',       icon: DollarSign,      active: false },
            { label: 'My ID Card',    icon: Nfc,             active: false },
          ].map(item => (
            <div key={item.label} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${item.active ? 'bg-primary-600 text-white' : 'text-slate-600'}`}>
              <item.icon className="h-3.5 w-3.5" /> {item.label}
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-5">
          <div>
            <p className="text-sm font-semibold text-slate-900">Welcome back, James</p>
            <p className="text-[11px] text-slate-400">{TODAY} · {TERM}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">Fees Paid</span>
            <Avatar name={student.name} />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Current GPA',  value: `${student.gpa}`, sub: 'Class rank: 2nd', color: 'text-primary-600' },
              { label: 'Attendance',   value: `${student.att}%`,sub: 'This term',       color: 'text-green-600'   },
              { label: 'Fee Balance',  value: '$0',             sub: 'All paid',        color: 'text-slate-900'   },
              { label: 'Subjects',     value: '6',              sub: 'Registered',      color: 'text-slate-900'   },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs font-medium text-slate-600">{s.label}</p>
                <p className="text-[11px] text-slate-400">{s.sub}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-700">My Recent Grades</h3>
              <div className="space-y-2">
                {SUBJECTS.map((sub, i) => {
                  const score = GRADE_ROWS[0].scores[i];
                  return (
                    <div key={sub} className="flex items-center justify-between py-1 border-b border-slate-50">
                      <span className="text-xs text-slate-600">{sub}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${score >= 85 ? 'text-green-600' : score >= 70 ? 'text-blue-600' : 'text-amber-600'}`}>{score}%</span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{gradeToLetter(score)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Today's Timetable</h3>
              <div className="space-y-2">
                {[
                  { time: '8:00 AM',  subj: 'Mathematics',    room: 'Room 101' },
                  { time: '9:30 AM',  subj: 'English Language',room: 'Room 203' },
                  { time: '11:00 AM', subj: 'Biology',         room: 'Lab A'    },
                  { time: '1:00 PM',  subj: 'Chemistry',       room: 'Lab B'    },
                  { time: '2:30 PM',  subj: 'Social Studies',  room: 'Room 105' },
                ].map(t => (
                  <div key={t.time} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2">
                    <span className="w-16 text-[11px] font-medium text-primary-600">{t.time}</span>
                    <div>
                      <p className="text-xs font-medium text-slate-800">{t.subj}</p>
                      <p className="text-[10px] text-slate-400">{t.room}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// ── SCENE 7: Staff & Roles ────────────────────────────────────────────────────
function SceneStaff() {
  const roleColors: Record<string, string> = {
    'Principal':       'bg-purple-100 text-purple-700',
    'Vice Principal':  'bg-indigo-100 text-indigo-700',
    'Proprietor':      'bg-pink-100 text-pink-700',
    'Registrar':       'bg-blue-100 text-blue-700',
    'Bursar':          'bg-green-100 text-green-700',
    'Teacher':         'bg-amber-100 text-amber-700',
    'IT Admin':        'bg-slate-100 text-slate-700',
    'Dean of Students':'bg-red-100 text-red-700',
  };
  return (
    <Shell active="Staff" title="Staff & User Management">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">28 active staff members · 14 user roles</p>
          <button className="rounded-lg bg-primary-600 px-4 py-2 text-xs font-semibold text-white">+ Add Staff Member</button>
        </div>

        {/* Role permission highlight */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { role: 'Registrar',  desc: 'Enrollment, student records, applications',  icon: GraduationCap },
            { role: 'Bursar',     desc: 'Fees, payments, receipts, finance reports',   icon: DollarSign    },
            { role: 'Teacher',    desc: 'Attendance, grades for assigned classes only',icon: BookOpen      },
            { role: 'Parent',     desc: 'Own child only — grades, fees, attendance',   icon: Users         },
          ].map(r => (
            <div key={r.role} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50">
                <r.icon className="h-4 w-4 text-primary-600" />
              </div>
              <p className="text-xs font-semibold text-slate-800">{r.role}</p>
              <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">{r.desc}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50">
              <tr>
                {['Staff Member', 'Role', 'Email', 'Date Added', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-semibold text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {STAFF.map((s, i) => (
                <tr key={i} className="border-t border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={s.name} />
                      <span className="font-medium text-slate-800">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${roleColors[s.role] ?? 'bg-slate-100 text-slate-700'}`}>
                      {s.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{s.email}</td>
                  <td className="px-4 py-3 text-slate-400">Jan {i + 5}, 2025</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-semibold text-green-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Active
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button className="rounded bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-200">Edit Role</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}

// ── SCENE 8: WAEC ─────────────────────────────────────────────────────────────
function SceneWaec() {
  return (
    <Shell active="WAEC Exams" title="WAEC / WASSCE Registration">
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Candidates', value: '38',  color: 'text-slate-900' },
            { label: 'Forms Submitted',  value: '29',  color: 'text-green-600' },
            { label: 'Pending',          value: '9',   color: 'text-amber-600' },
            { label: 'Exam Year',        value: '2026', color: 'text-primary-600' },
          ].map(c => (
            <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
              <p className="mt-1 text-xs text-slate-500">{c.label}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-xs font-semibold text-blue-800">WASSCE 2026 Registration Open</p>
              <p className="text-[11px] text-blue-600">Deadline: May 30, 2026 · Register candidates directly in SchoolSync — no separate WAEC portal needed</p>
            </div>
            <button className="ml-auto rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white">Submit Batch</button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Grade 12 WASSCE Candidates</h3>
            <div className="flex gap-2 text-xs">
              <button className="rounded-lg bg-primary-600 px-3 py-1.5 font-semibold text-white">+ Add Candidate</button>
              <button className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-600">Export List</button>
            </div>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-slate-50">
              <tr>
                {['Candidate Name', 'WAEC ID', 'Subjects Registered', 'School No.', 'Status', 'Action'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-semibold text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WAEC.map((c, i) => (
                <tr key={i} className="border-t border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={c.name} />
                      <span className="font-medium text-slate-800">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-500">{c.id}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-800">{c.subjects}</span>
                      <span className="text-slate-400">subjects</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">MCA-2026</td>
                  <td className="px-4 py-3">
                    {c.status === 'submitted'
                      ? <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-semibold text-green-700"><Check className="h-3 w-3" /> Submitted</span>
                      : <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700"><Clock className="h-3 w-3" /> Pending</span>}
                  </td>
                  <td className="px-4 py-3">
                    <button className="rounded bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}

// ── Scene registry ────────────────────────────────────────────────────────────
const SCENES = [
  { id: 'dashboard',  label: 'School Dashboard',        Component: SceneDashboard  },
  { id: 'enrollment', label: 'Student Enrollment',       Component: SceneEnrollment },
  { id: 'attendance', label: 'Attendance Tracking',      Component: SceneAttendance },
  { id: 'grades',     label: 'Grades & Report Cards',    Component: SceneGrades     },
  { id: 'fees',       label: 'Fee Collection',           Component: SceneFees       },
  { id: 'portal',     label: 'Student & Parent Portal',  Component: ScenePortal     },
  { id: 'staff',      label: 'Staff & User Roles',       Component: SceneStaff      },
  { id: 'waec',       label: 'WAEC Registration',        Component: SceneWaec       },
];

const SCENE_DURATION = 30; // seconds per scene

// ── Demo player ───────────────────────────────────────────────────────────────
export default function DemoPage() {
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [elapsed, setElapsed] = useState(0);

  const advance = useCallback((dir: 1 | -1) => {
    setCurrent(c => (c + dir + SCENES.length) % SCENES.length);
    setElapsed(0);
  }, []);

  const restart = useCallback(() => {
    setCurrent(0);
    setElapsed(0);
    setPlaying(true);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setElapsed(e => {
        if (e + 1 >= SCENE_DURATION) {
          setCurrent(c => (c + 1) % SCENES.length);
          return 0;
        }
        return e + 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [playing]);

  const Scene = SCENES[current].Component;
  const pct = ((elapsed / SCENE_DURATION) * 100).toFixed(1);

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-900" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* ── Top HUD ── */}
      <div className="flex items-center gap-4 bg-slate-900 px-5 py-2.5">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-600">
            <GraduationCap className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-bold text-white">SchoolSync</span>
        </div>

        <div className="h-4 w-px bg-slate-700" />

        {/* Scene label */}
        <div className="flex items-center gap-2">
          <span className="rounded bg-slate-700 px-2 py-0.5 text-[11px] font-semibold text-slate-300">
            {current + 1} / {SCENES.length}
          </span>
          <span className="text-sm font-medium text-white">{SCENES[current].label}</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Timer */}
          <span className="text-xs text-slate-400 tabular-nums">
            {String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')} / {String(Math.floor(SCENE_DURATION / 60)).padStart(2, '0')}:{String(SCENE_DURATION % 60).padStart(2, '0')}
          </span>

          {/* Controls */}
          <button onClick={() => advance(-1)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setPlaying(p => !p)}
            className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-500"
          >
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>
          <button onClick={() => advance(1)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button onClick={restart} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white" title="Restart">
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Scene area ── */}
      <div className="flex-1 overflow-hidden rounded-t-none">
        <Scene />
      </div>

      {/* ── Bottom progress ── */}
      <div className="bg-slate-900 px-5 py-2">
        {/* Scene dots */}
        <div className="mb-1.5 flex items-center gap-1.5">
          {SCENES.map((s, i) => (
            <button
              key={s.id}
              onClick={() => { setCurrent(i); setElapsed(0); }}
              title={s.label}
              className={`rounded-full transition-all ${
                i === current
                  ? 'w-16 h-2 bg-primary-500'
                  : i < current
                  ? 'w-2 h-2 bg-primary-700'
                  : 'w-2 h-2 bg-slate-600 hover:bg-slate-500'
              }`}
            />
          ))}
          <span className="ml-auto text-[11px] text-slate-500">
            {SCENES.map(s => s.label).join(' → ')}
          </span>
        </div>
        {/* Timer bar */}
        <div className="h-0.5 w-full rounded-full bg-slate-700">
          <div
            className="h-0.5 rounded-full bg-primary-500 transition-all duration-1000"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
