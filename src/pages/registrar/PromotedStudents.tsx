import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { promotionService } from '@/services/promotionService';
import type { PromotedPendingAssignment } from '@/services/promotionService';
import { classService } from '@/services/classService';
import type { Class } from '@/types/school.types';
import Breadcrumb from '@/components/shared/Breadcrumb';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Dialog, { DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/Dialog';
import { notify } from '@/components/shared/Toast';
import {
  GraduationCap, UserCheck, CheckCircle2, AlertCircle, Users,
} from 'lucide-react';

export default function PromotedStudents() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const [assigningStudent, setAssigningStudent] = useState<PromotedPendingAssignment | null>(null);
  const [selectedClassId, setSelectedClassId]   = useState('');

  const {
    data: pending = [],
    isLoading,
    refetch: refetchPending,
  } = useFetch(
    ['promoted-pending', schoolId],
    () => promotionService.listPendingAssignment(schoolId),
    { enabled: !!schoolId },
  );

  // Load all school classes — classes are permanent and reused across years
  const { data: classData } = useFetch(
    ['classes', schoolId],
    () => classService.list(schoolId),
    { enabled: !!schoolId },
  );
  const classes: Class[] = classData?.data ?? [];

  const assignMutation = useMutate(
    () => promotionService.assignToClass(
      assigningStudent!.student_id,
      // Retained students pass null — RPC uses their current class automatically
      assigningStudent!.outcome === 'retained' ? null : selectedClassId,
      assigningStudent!.next_year,
    ),
    [['promoted-pending', schoolId], ['registrar-stats', schoolId]],
    {
      onSuccess: (result) => {
        notify.success(result?.message ?? 'Student assigned');
        setAssigningStudent(null);
        setSelectedClassId('');
        refetchPending();
      },
      onError: (err: Error) => {
        notify.error(err.message ?? 'Assignment failed');
      },
    },
  );

  // Group by next_year for display
  const byYear = new Map<string, PromotedPendingAssignment[]>();
  for (const s of pending as PromotedPendingAssignment[]) {
    if (!byYear.has(s.next_year)) byYear.set(s.next_year, []);
    byYear.get(s.next_year)!.push(s);
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Registrar', href: '/registrar' }, { label: 'Promoted Students' }]} />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Promoted Students — Class Assignment</h1>
          <p className="text-sm text-slate-500 mt-1">
            Assign each promoted student to a class for their new academic year.
            Once assigned, all class fees are automatically applied and the student's
            enrollment becomes active.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span><strong>{(pending as PromotedPendingAssignment[]).length}</strong> awaiting assignment</span>
        </div>
      </div>

      {/* Empty state */}
      {!isLoading && (pending as PromotedPendingAssignment[]).length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <GraduationCap className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-3 text-base font-medium text-slate-700">No students pending assignment</p>
          <p className="mt-1 text-sm text-slate-400">
            Run the Year-End Promotion first. Promoted students will appear here.
          </p>
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      )}

      {/* Student tables grouped by year */}
      {[...byYear.entries()].map(([year, yearStudents]) => (
        <div key={year} className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-5 py-3.5 rounded-t-xl">
            <Users className="h-5 w-5 text-slate-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-800">
                Academic Year {year}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {yearStudents.length} student{yearStudents.length !== 1 ? 's' : ''} need class assignment
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-medium text-slate-500">
                  <th className="px-5 py-2.5 text-left">Student</th>
                  <th className="px-5 py-2.5 text-left">Grade</th>
                  <th className="px-5 py-2.5 text-left">Status</th>
                  <th className="px-5 py-2.5 text-left">Reg No.</th>
                  <th className="px-5 py-2.5 text-left">Reg Fee</th>
                  <th className="px-5 py-2.5 text-left">Date</th>
                  <th className="px-5 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {yearStudents.map((s) => (
                  <tr key={s.student_id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-900">
                      {s.first_name} {s.last_name}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{s.from_grade_level}</td>
                    <td className="px-5 py-3">
                      {s.outcome === 'retained' ? (
                        <Badge variant="warning" size="sm">Retained — Same Class</Badge>
                      ) : (
                        <Badge variant="success" size="sm">Promoted</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">{s.registration_number}</td>
                    <td className="px-5 py-3">
                      {s.reg_fee_paid ? (
                        <Badge variant="success" size="sm">
                          <CheckCircle2 className="inline h-3 w-3 mr-0.5" /> Paid
                        </Badge>
                      ) : (
                        <Badge variant="warning" size="sm">
                          Pending ${Number(s.reg_fee_amount).toFixed(2)}
                        </Badge>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-400">
                      {new Date(s.promoted_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button
                        size="sm"
                        disabled={!s.reg_fee_paid}
                        title={s.reg_fee_paid
                          ? s.outcome === 'retained' ? 'Re-enroll in same class' : 'Assign to a class'
                          : 'Bursar must record registration fee payment first'}
                        onClick={() => { setAssigningStudent(s); setSelectedClassId(''); }}
                      >
                        <UserCheck className="h-3.5 w-3.5 mr-1" />
                        {!s.reg_fee_paid ? 'Fee Pending' : s.outcome === 'retained' ? 'Re-Enroll' : 'Assign Class'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Assign class dialog */}
      {assigningStudent && (
        <Dialog open onClose={() => setAssigningStudent(null)} className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {assigningStudent.outcome === 'retained' ? 'Re-Enroll Student' : 'Assign Class'} — {assigningStudent.next_year}
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <p className="text-sm text-slate-600">
              <strong>{assigningStudent.first_name} {assigningStudent.last_name}</strong>
              {assigningStudent.outcome === 'retained'
                ? ' is retained and will re-enroll in the same class. All class fees for the new year will be applied automatically.'
                : ' is promoted. Assign them to a class for the new year. All class fees will be automatically applied.'}
            </p>

            {/* Only show class picker for promoted students */}
            {assigningStudent.outcome === 'promoted' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Select New Class
                </label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
                >
                  <option value="">Choose a class...</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.grade_level ? ` — ${c.grade_level}` : ''}
                    </option>
                  ))}
                </select>
                {classes.length === 0 && (
                  <p className="mt-1.5 text-xs text-amber-600">
                    No classes found. Ask the Principal to create classes first.
                  </p>
                )}
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAssigningStudent(null)}>Cancel</Button>
            <Button
              disabled={assigningStudent.outcome === 'promoted' && !selectedClassId}
              loading={assignMutation.isPending}
              onClick={() => assignMutation.mutate(undefined)}
            >
              <UserCheck className="h-4 w-4 mr-1.5" />
              {assigningStudent.outcome === 'retained' ? 'Confirm Re-Enrollment' : 'Confirm Assignment'}
            </Button>
          </DialogFooter>
        </Dialog>
      )}
    </div>
  );
}
