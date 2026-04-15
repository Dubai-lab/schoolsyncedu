import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Search, User, BookOpen, School, Users, X, Loader2 } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────

type ResultItem = {
  id: string;
  label: string;
  sublabel?: string;
  category: 'Students' | 'Classes' | 'Staff' | 'Schools';
  href: string;
};

const CATEGORY_ICON: Record<ResultItem['category'], React.ReactNode> = {
  Students: <User    className="h-4 w-4 text-blue-500" />,
  Classes:  <BookOpen className="h-4 w-4 text-emerald-500" />,
  Staff:    <Users   className="h-4 w-4 text-purple-500" />,
  Schools:  <School  className="h-4 w-4 text-amber-500" />,
};

const CATEGORY_ORDER: ResultItem['category'][] = ['Students', 'Classes', 'Staff', 'Schools'];

// ── Role gates ─────────────────────────────────────────────────────────
// Only school-level staff who manage students/classes may search them.
// Proprietor & super_admin have no business navigating to individual student
// pages — they are oversight/platform roles.

const CAN_SEARCH_STUDENTS = new Set([
  'registrar', 'teacher', 'bursar', 'it_admin', 'dean_of_students',
  'principal', 'vice_principal', 'admin_staff',
]);
const CAN_SEARCH_CLASSES = new Set([
  'registrar', 'teacher', 'it_admin', 'dean_of_students',
  'principal', 'vice_principal', 'admin_staff',
]);
const CAN_SEARCH_STAFF = new Set([
  'it_admin', 'principal', 'vice_principal',
]);
const CAN_SEARCH_SCHOOLS = new Set(['super_admin']);

// Roles that should see any search at all
export const ROLES_WITH_SEARCH = new Set([
  'registrar', 'teacher', 'bursar', 'it_admin', 'dean_of_students',
  'principal', 'vice_principal', 'admin_staff', 'super_admin',
]);

// Navigate to the right page for a student result based on the viewer's role
function studentHref(studentId: string, role: string): string {
  switch (role) {
    case 'it_admin':       return '/it-admin/students';
    case 'bursar':         return `/students/${studentId}`;
    case 'teacher':        return `/students/${studentId}`;
    default:               return `/students/${studentId}`;
  }
}

// ── Component ──────────────────────────────────────────────────────────

export default function GlobalSearch() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const role     = user?.role ?? '';
  const schoolId = user?.school_id ?? '';

  const [query,       setQuery]       = useState('');
  const [results,     setResults]     = useState<ResultItem[]>([]);
  const [isLoading,   setIsLoading]   = useState(false);
  const [isOpen,      setIsOpen]      = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const wrapperRef  = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // ── Search logic ──────────────────────────────────────────────────────

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    const like = `%${trimmed}%`;
    const collected: ResultItem[] = [];

    try {
      // Students
      if (CAN_SEARCH_STUDENTS.has(role) && schoolId) {
        const { data } = await supabase
          .from('students')
          .select('id, first_name, last_name, registration_number, current_grade_level')
          .eq('school_id', schoolId)
          .or(`first_name.ilike.${like},last_name.ilike.${like},registration_number.ilike.${like}`)
          .limit(5);

        for (const s of data ?? []) {
          collected.push({
            id:       s.id,
            label:    `${s.first_name} ${s.last_name}`,
            sublabel: `${s.registration_number}${s.current_grade_level ? ` · ${s.current_grade_level}` : ''}`,
            category: 'Students',
            href:     studentHref(s.id, role),
          });
        }
      }

      // Classes
      if (CAN_SEARCH_CLASSES.has(role) && schoolId) {
        const { data } = await supabase
          .from('classes')
          .select('id, name, grade_level, section')
          .eq('school_id', schoolId)
          .ilike('name', like)
          .limit(4);

        for (const c of data ?? []) {
          collected.push({
            id:       c.id,
            label:    c.name,
            sublabel: [c.grade_level, c.section].filter(Boolean).join(' · '),
            category: 'Classes',
            href:     role === 'teacher' ? '/teacher/classes' : '/classes',
          });
        }
      }

      // Staff
      if (CAN_SEARCH_STAFF.has(role)) {
        let q2 = supabase
          .from('users')
          .select('id, full_name, email, role')
          .or(`full_name.ilike.${like},email.ilike.${like}`)
          .limit(4);

        if (schoolId && role !== 'super_admin') {
          q2 = q2.eq('school_id', schoolId);
        }

        const { data } = await q2;
        for (const u of data ?? []) {
          const roleLabel = (u.role as string)
            ?.replace(/_/g, ' ')
            .replace(/\b\w/g, (c: string) => c.toUpperCase());
          collected.push({
            id:       u.id,
            label:    u.full_name || u.email,
            sublabel: roleLabel,
            category: 'Staff',
            href:     '/staff',
          });
        }
      }

      // Schools (super_admin only) — search by school name OR proprietor name
      if (CAN_SEARCH_SCHOOLS.has(role)) {
        // Search by school name
        const { data: byName } = await supabase
          .from('schools')
          .select('id, name, slug')
          .ilike('name', like)
          .limit(5);

        // Search by proprietor full_name
        const { data: byOwner } = await supabase
          .from('users')
          .select('school_id, full_name, email')
          .eq('role', 'proprietor')
          .or(`full_name.ilike.${like},email.ilike.${like}`)
          .limit(5);

        // Merge, de-duplicate by school id
        const schoolMap = new Map<string, { name: string; slug: string; ownerName?: string }>();
        for (const s of byName ?? []) {
          schoolMap.set(s.id, { name: s.name, slug: s.slug });
        }
        for (const u of byOwner ?? []) {
          if (!u.school_id) continue;
          if (!schoolMap.has(u.school_id)) {
            // Fetch school name for this proprietor's school
            const { data: schoolRow } = await supabase
              .from('schools')
              .select('id, name, slug')
              .eq('id', u.school_id)
              .maybeSingle();
            if (schoolRow) {
              schoolMap.set(schoolRow.id, { name: schoolRow.name, slug: schoolRow.slug, ownerName: u.full_name || u.email });
            }
          } else {
            const existing = schoolMap.get(u.school_id)!;
            schoolMap.set(u.school_id, { ...existing, ownerName: u.full_name || u.email });
          }
        }

        for (const [id, s] of schoolMap) {
          collected.push({
            id,
            label:    s.name,
            sublabel: s.ownerName ? `Owner: ${s.ownerName}` : s.slug,
            category: 'Schools',
            href:     '/admin/schools',
          });
        }
      }

      setResults(collected);
      setIsOpen(true);
      setActiveIndex(-1);
    } catch (err) {
      console.error('GlobalSearch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [role, schoolId]);

  // ── Handlers ──────────────────────────────────────────────────────────

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current ?? undefined);
    if (val.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => runSearch(val), 300);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen) return;
    if (e.key === 'Escape') {
      clear();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      goTo(results[activeIndex].href);
    }
  }

  function goTo(href: string) {
    navigate(href);
    clear();
  }

  function clear() {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setActiveIndex(-1);
  }

  // ── Grouped results ───────────────────────────────────────────────────

  const grouped = CATEGORY_ORDER
    .map((cat) => ({ cat, items: results.filter((r) => r.category === cat) }))
    .filter(({ items }) => items.length > 0);

  // Build a flat ordered list for keyboard nav index
  const flatResults = grouped.flatMap(({ items }) => items);

  return (
    <div ref={wrapperRef} className="relative w-full">
      {/* Input */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (results.length > 0) setIsOpen(true); }}
          placeholder={role === 'super_admin' ? 'Search schools, proprietors...' : 'Search students, classes, staff...'}
          autoComplete="off"
          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-10 pr-8 text-sm text-slate-700 placeholder:text-slate-400 transition-colors focus:border-primary-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
        )}
        {query && !isLoading && (
          <button
            onClick={() => { clear(); inputRef.current?.focus(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60">
          {results.length === 0 && !isLoading ? (
            <p className="px-4 py-5 text-center text-sm text-slate-400">
              No results for{' '}
              <span className="font-medium text-slate-600">"{query}"</span>
            </p>
          ) : (
            <>
              <div className="max-h-80 overflow-y-auto py-1">
                {grouped.map(({ cat, items }) => (
                  <div key={cat}>
                    {/* Category header */}
                    <p className="px-3 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      {cat}
                    </p>

                    {items.map((item) => {
                      const flatIdx = flatResults.indexOf(item);
                      const isActive = flatIdx === activeIndex;
                      return (
                        <button
                          key={item.id}
                          onClick={() => goTo(item.href)}
                          className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
                            isActive ? 'bg-primary-50' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100">
                            {CATEGORY_ICON[cat]}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-800">
                              {item.label}
                            </p>
                            {item.sublabel && (
                              <p className="truncate text-xs text-slate-400">{item.sublabel}</p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Keyboard hint footer */}
              <div className="flex items-center gap-3 border-t border-slate-100 px-3 py-1.5 text-[10px] text-slate-400">
                <span>↑↓ navigate</span>
                <span>↵ open</span>
                <span>Esc close</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
