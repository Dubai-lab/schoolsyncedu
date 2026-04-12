import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { useQueryClient } from '@tanstack/react-query';
import { itAdminStudentService, type StudentWithoutAccount } from '@/services/itAdminService';
import { registrarService } from '@/services/registrarService';
import Breadcrumb from '@/components/shared/Breadcrumb';
import Button from '@/components/ui/Button';
import {
  GraduationCap,
  Search,
  UserCheck,
  UserX,
  Key,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Info,
  Eye,
  EyeOff,
  Loader2,
  Users,
} from 'lucide-react';

// ==================== TYPES ====================

interface ProvisionResult {
  registration_number: string;
  success: boolean;
  message: string;
}

// ==================== MAIN COMPONENT ====================

export default function StudentAccounts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const schoolId = user?.school_id ?? '';

  const [search, setSearch] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [provisioning, setProvisioning] = useState<Set<string>>(new Set());
  const [bulkRunning, setBulkRunning] = useState(false);
  const [results, setResults] = useState<ProvisionResult[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Fetch default student password from school settings
  const { data: defaultPassword } = useFetch(
    ['school-setting-default-student-password', schoolId],
    () => registrarService.getSetting(schoolId, 'default_student_password'),
    { enabled: !!schoolId },
  );

  // Fetch students without accounts
  const {
    data: students,
    isLoading,
    refetch,
  } = useFetch(
    ['students-without-accounts', schoolId],
    () => itAdminStudentService.listStudentsWithoutAccounts(schoolId),
    { enabled: !!schoolId },
  );

  const filtered = useMemo(() => {
    if (!students) return [];
    if (!search.trim()) return students;
    const q = search.toLowerCase();
    return students.filter(
      (s) =>
        s.first_name.toLowerCase().includes(q) ||
        s.last_name.toLowerCase().includes(q) ||
        s.registration_number.toLowerCase().includes(q) ||
        s.current_grade_level.toLowerCase().includes(q),
    );
  }, [students, search]);

  const password = defaultPassword || 'school123';

  async function provision(student: StudentWithoutAccount) {
    setProvisioning((prev) => new Set(prev).add(student.id));
    try {
      await itAdminStudentService.provisionStudentAccount(
        schoolId,
        student.registration_number,
        password,
      );
      setResults((prev) => [
        { registration_number: student.registration_number, success: true, message: 'Account created' },
        ...prev,
      ]);
      queryClient.invalidateQueries({ queryKey: ['students-without-accounts', schoolId] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create account';
      setResults((prev) => [
        { registration_number: student.registration_number, success: false, message: msg },
        ...prev,
      ]);
    } finally {
      setProvisioning((prev) => {
        const next = new Set(prev);
        next.delete(student.id);
        return next;
      });
    }
  }

  async function provisionSelected() {
    if (!students) return;
    const targets = students.filter((s) => selectedIds.has(s.id));
    if (!targets.length) return;

    setBulkRunning(true);
    for (const student of targets) {
      await provision(student);
    }
    setSelectedIds(new Set());
    setBulkRunning(false);
  }

  async function provisionAll() {
    if (!students?.length) return;
    setBulkRunning(true);
    for (const student of filtered) {
      await provision(student);
    }
    setBulkRunning(false);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((s) => s.id)));
    }
  }

  const pendingCount = students?.length ?? 0;
  const selectedCount = selectedIds.size;

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'IT Management', href: '/it-admin' }, { label: 'Student Accounts' }]} />

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Student Login Accounts</h1>
          <p className="mt-1 text-sm text-slate-500">
            Provision login credentials for enrolled students who cannot yet sign in.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={<RefreshCw className="h-4 w-4" />}
            onClick={() => refetch()}
          >
            Refresh
          </Button>
          {selectedCount > 0 && (
            <Button
              size="sm"
              icon={bulkRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
              onClick={provisionSelected}
              disabled={bulkRunning}
            >
              Create {selectedCount} Account{selectedCount !== 1 ? 's' : ''}
            </Button>
          )}
          {selectedCount === 0 && pendingCount > 0 && (
            <Button
              size="sm"
              icon={bulkRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
              onClick={provisionAll}
              disabled={bulkRunning}
            >
              Create All ({pendingCount})
            </Button>
          )}
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
        <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
        <div className="text-sm text-blue-700 space-y-1">
          <p>
            <strong>How it works:</strong> When you create an account, a login is generated using the
            student's registration number as their username and the school's default password below.
            Students sign in at <strong>/auth/student-login</strong>.
          </p>
          <p className="text-xs text-blue-500">
            Only enrolled students (accepted applications) appear here. Students with existing accounts are excluded.
          </p>
        </div>
      </div>

      {/* Default password card */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50">
            <Key className="h-4 w-4 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-700">Default Student Password</p>
            <p className="text-xs text-slate-400">
              All accounts are created with this password. Students should change it after first login.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <code className={`rounded bg-slate-100 px-3 py-1.5 text-sm font-mono ${showPassword ? 'text-slate-900' : 'text-transparent select-none'} relative`}>
              {showPassword ? password : password.replace(/./g, '•')}
            </code>
            <button
              onClick={() => setShowPassword(!showPassword)}
              className="text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-amber-600 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Change this in <strong>School Settings</strong> under &ldquo;default_student_password&rdquo; if needed.
        </p>
      </div>

      {/* Results log */}
      {results.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Activity Log</h3>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {results.map((r, i) => (
              <div key={i} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${r.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                {r.success
                  ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  : <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
                <span className="font-mono font-medium">{r.registration_number}</span>
                <span className="text-slate-500">—</span>
                <span>{r.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search + table */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center gap-3 border-b border-slate-100 p-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, registration or grade..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20"
            />
          </div>
          {pendingCount > 0 && (
            <span className="text-xs text-slate-500">
              {filtered.length} of {pendingCount} student{pendingCount !== 1 ? 's' : ''} need accounts
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading students...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            {pendingCount === 0 ? (
              <>
                <CheckCircle2 className="h-10 w-10 text-emerald-400 mb-3" />
                <p className="text-sm font-medium text-slate-700">All enrolled students have accounts</p>
                <p className="text-xs text-slate-400 mt-1">Nothing to provision right now.</p>
              </>
            ) : (
              <>
                <UserX className="h-10 w-10 text-slate-300 mb-3" />
                <p className="text-sm text-slate-500">No students match your search</p>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-4 py-3 text-left" aria-label="Select all">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filtered.length && filtered.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300"
                    />
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">Student</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">Registration #</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">Grade</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">Enrolled</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((student) => {
                  const isLoading = provisioning.has(student.id);
                  return (
                    <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(student.id)}
                          onChange={() => toggleSelect(student.id)}
                          disabled={isLoading}
                          className="rounded border-slate-300"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                            {student.first_name[0]}{student.last_name[0]}
                          </div>
                          <div>
                            <p className="font-medium text-slate-800">{student.first_name} {student.last_name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <code className="rounded bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-700">
                          {student.registration_number}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{student.current_grade_level}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {student.enrollment_date
                          ? new Date(student.enrollment_date).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => provision(student)}
                          disabled={isLoading || bulkRunning}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isLoading ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <GraduationCap className="h-3 w-3" />
                          )}
                          {isLoading ? 'Creating...' : 'Create Account'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Credential distribution tip */}
      {pendingCount > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-700 space-y-1">
          <p className="font-semibold">How to distribute credentials to students:</p>
          <ol className="list-decimal list-inside space-y-0.5 ml-1">
            <li>Create accounts for all enrolled students using this page.</li>
            <li>Print this page or write each student's registration number on a slip.</li>
            <li>Tell them to visit <strong>/auth/student-login</strong> and use their registration number + the default password shown above.</li>
            <li>Advise students to change their password after first login via My Profile.</li>
          </ol>
        </div>
      )}
    </div>
  );
}
