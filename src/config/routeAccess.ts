import { USER_ROLES, type UserRole } from '@/utils/constants';

/**
 * Who may open which page.
 *
 * There were two answers to that question and they disagreed. The sidebar
 * decided what a role could see; App.tsx decided what a role could reach. Only
 * 14 routes named a role at all — the other 93 sat inside <RequireAuth>, which
 * proves you are signed in and nothing more. A teacher could open
 * /settings/system, a student could open /staff/permissions, simply by typing
 * the address. The menu was doing the access control, and a menu is not a lock.
 *
 * This is now the only answer. The router reads it to decide what loads, and
 * the sidebar reads it to decide what to show, so a menu can never offer a
 * page the router will refuse.
 *
 * Anything absent from this table is denied. That is deliberate: a new page
 * with no entry is unreachable rather than open to everyone, so forgetting to
 * add one fails safe.
 */

const {
  SUPER_ADMIN, PROPRIETOR, PRINCIPAL, VICE_PRINCIPAL, REGISTRAR, BURSAR,
  DEAN, ADMIN_STAFF, IT_ADMIN, TEACHER, LIBRARIAN, COUNSELOR, PARENT, STUDENT,
} = USER_ROLES;

/** Leadership, for pages where both heads act alike. */
const HEADS: UserRole[] = [PRINCIPAL, VICE_PRINCIPAL];

/** Anyone with a staff seat — used for pages that are only ever read. */
const ALL_STAFF: UserRole[] = [
  PRINCIPAL, VICE_PRINCIPAL, DEAN, ADMIN_STAFF, LIBRARIAN,
  COUNSELOR, REGISTRAR, BURSAR, TEACHER, IT_ADMIN,
];

export const ROUTE_ACCESS: Record<string, UserRole[]> = {
  // ── Overview ───────────────────────────────────────────────────────────────
  '/dashboard':                    [...ALL_STAFF, PARENT],
  '/dashboard/analytics':          [...HEADS, ADMIN_STAFF],

  // ── Students ───────────────────────────────────────────────────────────────
  // Leadership reads student records; creating and editing them is the
  // Registrar's clerical work, so those three are not theirs.
  '/students':                     [...HEADS, ADMIN_STAFF, DEAN, REGISTRAR, COUNSELOR],
  '/students/:id':                 [...HEADS, ADMIN_STAFF, DEAN, REGISTRAR, COUNSELOR],
  '/students/new':                 [REGISTRAR, ADMIN_STAFF, IT_ADMIN],
  '/students/:id/edit':            [REGISTRAR, ADMIN_STAFF, IT_ADMIN],
  '/students/enrollment':          [REGISTRAR, ADMIN_STAFF],
  '/students/idcards':             [ADMIN_STAFF, IT_ADMIN, REGISTRAR],

  // ── Academic structure — the Principal's ───────────────────────────────────
  '/classes':                      [...HEADS, ADMIN_STAFF],
  '/classes/new':                  [...HEADS, ADMIN_STAFF],
  '/classes/:id/edit':             [...HEADS, ADMIN_STAFF],
  '/subjects':                     [...HEADS, ADMIN_STAFF],
  '/classes/terms':                [...HEADS, IT_ADMIN],
  '/classes/timetable':            [...HEADS, ADMIN_STAFF],
  '/timetable':                    [...ALL_STAFF, PARENT],
  '/timetable/builder':            [...HEADS, ADMIN_STAFF],

  // ── Grades — teachers enter, leadership approves ───────────────────────────
  '/grades':                       [...HEADS, ADMIN_STAFF, PARENT],
  // Not the teacher's. This page lists every class in the school, while
  // /teacher/grades lists only theirs — and the database now refuses a grade
  // for a class they do not take, so sending them here would offer a choice
  // that fails on save. Their own screen is the one that works.
  '/grades/entry':                 [ADMIN_STAFF],
  '/grades/approval':              HEADS,
  '/grades/reports':               [...HEADS, ADMIN_STAFF, REGISTRAR],
  // Students included: the page already detects the student role and hides the
  // search panel, showing only their own transcript. Dropping them here would
  // have taken away a portal feature that was working.
  '/grades/transcript':            [...HEADS, ADMIN_STAFF, REGISTRAR, STUDENT],

  '/attendance':                   [...HEADS, ADMIN_STAFF, DEAN, PARENT],
  // Same reasoning as /grades/entry — /teacher/attendance is the scoped one.
  '/attendance/mark':              [ADMIN_STAFF],
  '/attendance/reports':           [...HEADS, ADMIN_STAFF, DEAN],

  // ── Finance — the Bursar acts, leadership reads ────────────────────────────
  // /fees/history and /reports/financial are read-only pages, which is how the
  // Principal keeps oversight after losing the write access.
  '/fees':                         [BURSAR, ADMIN_STAFF, PARENT],
  '/fees/payment':                 [BURSAR, ADMIN_STAFF],
  '/fees/history':                 [BURSAR, ADMIN_STAFF, ...HEADS],
  '/fees/reports':                 [BURSAR, ADMIN_STAFF, ...HEADS, PROPRIETOR],
  '/fees/receipt/:id':             [BURSAR, ADMIN_STAFF, PARENT],
  '/bursar':                       [BURSAR],
  '/bursar/fee-structures':        [BURSAR],
  '/bursar/application-fees':      [BURSAR],
  '/bursar/bank-transfers':        [BURSAR],
  '/bursar/reg-fee-confirmation':  [BURSAR],
  '/bursar/fee-correction':        [BURSAR],
  '/bursar/kiosk-settings':        [BURSAR, PROPRIETOR],

  // ── Letters and communications ─────────────────────────────────────────────
  '/letters':                      [...HEADS, ADMIN_STAFF, DEAN, REGISTRAR, BURSAR],
  '/letters/templates':            [...HEADS, ADMIN_STAFF],
  '/letters/create':               [...HEADS, ADMIN_STAFF, DEAN, REGISTRAR, BURSAR],
  '/letters/approvals':            HEADS,
  '/letters/print-queue':          [...HEADS, ADMIN_STAFF],
  // Fee notices are a real Bursar need, so /letters and /letters/create stay.
  // Uploading an arbitrary document to go out under the school's letterhead is
  // not a finance job, so this one does not.
  '/letters/custom-upload':        [...HEADS, ADMIN_STAFF, DEAN, REGISTRAR],
  '/communications':               [...HEADS, ADMIN_STAFF],
  '/communications/announce':      [...HEADS, ADMIN_STAFF],
  '/communications/messages':      [...HEADS, ADMIN_STAFF],
  '/communications/notifications': [...HEADS, ADMIN_STAFF],

  // ── Departments ────────────────────────────────────────────────────────────
  '/library':                      [LIBRARIAN, ADMIN_STAFF, VICE_PRINCIPAL],
  '/library/checkout':             [LIBRARIAN],
  '/library/overdue':              [LIBRARIAN],
  '/library/reports':              [LIBRARIAN, VICE_PRINCIPAL],
  '/librarian':                    [LIBRARIAN],
  '/librarian/nfc-checkout':       [LIBRARIAN],
  '/guidance':                     [COUNSELOR, DEAN, VICE_PRINCIPAL],
  '/guidance/incidents':           [COUNSELOR, DEAN, VICE_PRINCIPAL],
  '/guidance/meetings':            [COUNSELOR, DEAN, VICE_PRINCIPAL],
  '/idcards':                      [ADMIN_STAFF, VICE_PRINCIPAL, IT_ADMIN],
  '/idcards/generate':             [ADMIN_STAFF, IT_ADMIN],
  '/idcards/queue':                [ADMIN_STAFF, IT_ADMIN],

  // ── Staff ──────────────────────────────────────────────────────────────────
  // Assigning roles is security administration, not school leadership: it is
  // the one screen that can hand out more power than the person using it.
  '/staff':                        [...HEADS, ADMIN_STAFF],
  '/staff/new':                    [PRINCIPAL, ADMIN_STAFF, IT_ADMIN],
  '/staff/:id/edit':               [PRINCIPAL, ADMIN_STAFF, IT_ADMIN],
  '/staff/permissions':            [IT_ADMIN, PROPRIETOR],

  // ── Reports ────────────────────────────────────────────────────────────────
  '/reports':                      [...HEADS, ADMIN_STAFF],
  '/reports/academic':             [...HEADS, ADMIN_STAFF],
  '/reports/attendance':           [...HEADS, ADMIN_STAFF, DEAN],
  '/reports/financial':            [...HEADS, BURSAR, ADMIN_STAFF, PROPRIETOR],

  // ── Settings ───────────────────────────────────────────────────────────────
  '/settings':                     [PRINCIPAL, PROPRIETOR],
  '/settings/preferences':         [...ALL_STAFF, PARENT, STUDENT],
  '/settings/system':              [IT_ADMIN, PROPRIETOR],
  '/settings/audit':               [PRINCIPAL, PROPRIETOR, IT_ADMIN],

  // ── Registrar ──────────────────────────────────────────────────────────────
  // Admissions decisions and year-end promotion are leadership calls; the
  // registrar's own desk and bulk data entry are not.
  '/registrar':                    [REGISTRAR],
  '/registrar/applications':       [REGISTRAR, ...HEADS],
  '/registrar/applications/:id':   [REGISTRAR, ...HEADS],
  '/registrar/promotion':          HEADS,
  '/registrar/promoted':           [REGISTRAR, ...HEADS],
  '/registrar/import':             [REGISTRAR, ADMIN_STAFF, IT_ADMIN],

  // ── WAEC — registrar registers candidates, leadership signs off ────────────
  '/waec':                         [...HEADS, REGISTRAR],
  '/waec/register':                [REGISTRAR, ADMIN_STAFF],
  '/waec/candidates':              [REGISTRAR, ADMIN_STAFF],
  '/waec/results':                 [...HEADS, REGISTRAR],

  // ── Principal ──────────────────────────────────────────────────────────────
  '/principal':                    HEADS,

  // ── Dean ───────────────────────────────────────────────────────────────────
  '/dean':                         [DEAN],
  '/dean/incidents':               [DEAN],
  '/dean/referrals':               [DEAN],
  '/dean/suspensions':             [DEAN],
  '/dean/meetings':                [DEAN],
  '/dean/welfare':                 [DEAN],
  '/dean/attendance':              [DEAN],
  '/dean/reports':                 [DEAN],

  // ── Teacher ────────────────────────────────────────────────────────────────
  '/teacher':                      [TEACHER],
  '/teacher/classes':              [TEACHER],
  '/teacher/schedule':             [TEACHER],
  '/teacher/attendance':           [TEACHER],
  '/teacher/nfc-attendance':       [TEACHER],
  '/teacher/grades':               [TEACHER],

  // ── Student ────────────────────────────────────────────────────────────────
  '/student':                      [STUDENT],
  '/student/dashboard':            [STUDENT],
  '/student/grades':               [STUDENT],
  '/student/attendance':           [STUDENT],
  '/student/fees':                 [STUDENT],
  '/student/timetable':            [STUDENT],
  '/student/id-card':              [STUDENT],
  '/student/library':              [STUDENT],
  '/student/profile':              [STUDENT],

  // ── IT Admin ───────────────────────────────────────────────────────────────
  // The site and login-page designers are the Proprietor's: IT keeps the
  // school running, the owner decides how it looks.
  '/it-admin':                     [IT_ADMIN],
  '/it-admin/users':               [IT_ADMIN],
  '/it-admin/users/new':           [IT_ADMIN],
  '/it-admin/fees':                [IT_ADMIN],
  '/it-admin/system':              [IT_ADMIN],
  '/it-admin/settings':            [IT_ADMIN],
  '/it-admin/cards':               [IT_ADMIN],
  '/it-admin/cards/generate':      [IT_ADMIN],
  '/it-admin/cards/nfc':           [IT_ADMIN],
  '/it-admin/students':            [IT_ADMIN],
  '/it-admin/email':               [IT_ADMIN],
  '/it-admin/transcript':          [IT_ADMIN],
  '/it-admin/site':                [PROPRIETOR],
  '/it-admin/login-page':          [PROPRIETOR],

  // ── Proprietor ─────────────────────────────────────────────────────────────
  '/proprietor':                   [PROPRIETOR],
  '/proprietor/setup':             [PROPRIETOR],
  '/proprietor/it-admin':          [PROPRIETOR],
  '/proprietor/subscription':      [PROPRIETOR],
  '/proprietor/financial':         [PROPRIETOR],
  '/proprietor/audit':             [PROPRIETOR],
  '/proprietor/site':              [PROPRIETOR],
  '/proprietor/fees':              [PROPRIETOR],
  '/proprietor/login-page':        [PROPRIETOR],
  '/proprietor/payment-methods':   [PROPRIETOR],

  // ── Platform ───────────────────────────────────────────────────────────────
  '/admin':                        [SUPER_ADMIN],
  '/admin/schools':                [SUPER_ADMIN],
  '/admin/activation-requests':    [SUPER_ADMIN],
  '/admin/messages':               [SUPER_ADMIN],
  '/admin/pricing':                [SUPER_ADMIN],
  '/admin/billing':                [SUPER_ADMIN],
  '/admin/discounts':              [SUPER_ADMIN],
  '/admin/health':                 [SUPER_ADMIN],
  '/admin/social-media':           [SUPER_ADMIN],
};

/** Pages every signed-in user may see, whatever their role. */
const ALWAYS_ALLOWED = new Set(['/unauthorized']);

/** '/students/:id/edit' → /^\/students\/[^/]+\/edit$/ */
function toPattern(route: string): RegExp {
  const body = route
    .split('/')
    .map((seg) => (seg.startsWith(':') ? '[^/]+' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('/');
  return new RegExp(`^${body}$`);
}

// Longest first, so '/students/new' is tested before '/students/:id'. Without
// this a literal segment could be swallowed by a parameter pattern and get the
// wrong role list.
const COMPILED: { re: RegExp; roles: UserRole[]; route: string }[] = Object.entries(ROUTE_ACCESS)
  .sort((a, b) => {
    const params = (r: string) => (r.match(/:/g) ?? []).length;
    return params(a[0]) - params(b[0]) || b[0].length - a[0].length;
  })
  .map(([route, roles]) => ({ re: toPattern(route), roles, route }));

/** The entry governing a path, or undefined if the path is not listed. */
export function matchRoute(pathname: string): { route: string; roles: UserRole[] } | undefined {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const hit = COMPILED.find((c) => c.re.test(clean));
  return hit ? { route: hit.route, roles: hit.roles } : undefined;
}

/**
 * May this role open this path?
 *
 * super_admin passes everywhere by design — it is the platform operator, and
 * locking it out of a school's page would leave nobody able to put it right.
 */
export function canAccess(pathname: string, role: UserRole | undefined | null): boolean {
  if (!role) return false;
  if (role === SUPER_ADMIN) return true;
  if (ALWAYS_ALLOWED.has(pathname)) return true;

  const hit = matchRoute(pathname);
  if (!hit) return false;
  return hit.roles.includes(role);
}
