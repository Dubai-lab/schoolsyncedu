import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { gradeService } from '@/services/gradeService';
import { registrarService } from '@/services/registrarService';
import { notify } from '@/components/shared/Toast';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import { Card, CardContent } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Breadcrumb from '@/components/shared/Breadcrumb';
import Dialog, { DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/Dialog';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { CheckCircle2, XCircle } from 'lucide-react';

export default function GradeApproval() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';
  const userId = user?.id ?? '';

  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Fetch school year
  const { data: academicYear } = useFetch(
    ['school-year', schoolId],
    () => registrarService.getSetting(schoolId, 'current_academic_year'),
    { enabled: !!schoolId },
  );

  // Fetch classes & subjects (distinct keys to avoid collision with list-page cache)
  const { data: classes } = useFetch(
    ['grade-approval-classes', schoolId],
    () => gradeService.getClasses(schoolId),
    { enabled: !!schoolId },
  );

  const { data: subjects } = useFetch(
    ['grade-approval-subjects', schoolId],
    () => gradeService.getSubjects(schoolId),
    { enabled: !!schoolId },
  );

  // Pending grades
  const { data: pendingGrades, isLoading, refetch } = useFetch(
    ['pending-grades', schoolId, selectedClass, selectedSubject, academicYear ?? ''],
    () => gradeService.listPendingApproval(schoolId, {
      classId: selectedClass || undefined,
      subjectId: selectedSubject || undefined,
      academicYear: academicYear || undefined,
    }),
    { enabled: !!schoolId },
  );

  const classOptions = (classes ?? []).map((c) => ({ label: `${c.name} — ${c.grade_level || ''}`, value: c.id }));
  const subjectOptions = (subjects ?? []).map((s) => ({ label: `${s.name} (${s.code})`, value: s.id }));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (!pendingGrades) return;
    if (selectedIds.size === pendingGrades.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingGrades.map((g) => g.id)));
    }
  };

  const approveMutation = useMutate(
    async () => {
      if (selectedIds.size === 0) throw new Error('No grades selected');
      return gradeService.approveGrades(Array.from(selectedIds), userId);
    },
    [['grades'], ['pending-grades']],
    {
      onSuccess: () => {
        notify.success(`${selectedIds.size} grades approved`);
        setSelectedIds(new Set());
        refetch();
      },
    },
  );

  const rejectMutation = useMutate(
    async () => {
      if (selectedIds.size === 0) throw new Error('No grades selected');
      if (!rejectReason.trim()) throw new Error('Reason required');
      return gradeService.rejectGrades(Array.from(selectedIds), userId, rejectReason);
    },
    [['grades'], ['pending-grades']],
    {
      onSuccess: () => {
        notify.success(`${selectedIds.size} grades rejected`);
        setSelectedIds(new Set());
        setShowReject(false);
        setRejectReason('');
        refetch();
      },
    },
  );

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Grades', href: '/grades' }, { label: 'Approve Grades' }]} />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Grade Approval</h1>
          <p className="text-sm text-slate-500">
            Review and approve grades submitted by teachers{academicYear ? ` — ${academicYear}` : ''}.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select label="Class" options={classOptions} value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)} placeholder="All classes" className="w-56" />
        <Select label="Subject" options={subjectOptions} value={selectedSubject}
          onChange={(e) => setSelectedSubject(e.target.value)} placeholder="All subjects" className="w-56" />
      </div>

      {isLoading ? (
        <LoadingSpinner label="Loading pending grades..." fullPage={false} />
      ) : !pendingGrades || pendingGrades.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-300 mb-3" />
            <p className="text-sm text-slate-500">No grades pending approval.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Action bar */}
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selectedIds.size === pendingGrades.length && pendingGrades.length > 0}
                onChange={selectAll}
                className="h-4 w-4 rounded border-slate-300 text-primary-600"
              />
              <span className="text-sm text-slate-600">
                {selectedIds.size > 0 ? `${selectedIds.size} selected` : `${pendingGrades.length} grades pending`}
              </span>
            </div>
            {selectedIds.size > 0 && (
              <div className="flex gap-2">
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => approveMutation.mutate(undefined)} loading={approveMutation.isPending}>
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                </Button>
                <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => setShowReject(true)}>
                  <XCircle className="h-4 w-4 mr-1" /> Reject
                </Button>
              </div>
            )}
          </div>

          {/* Grade table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-slate-500 bg-slate-50/50">
                      <th className="px-4 py-3 w-10"></th>
                      <th className="px-4 py-3 font-medium">Student</th>
                      <th className="px-4 py-3 font-medium">Subject</th>
                      <th className="px-4 py-3 font-medium">Score</th>
                      <th className="px-4 py-3 font-medium">Grade</th>
                      <th className="px-4 py-3 font-medium">Entered By</th>
                      <th className="px-4 py-3 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingGrades.map((grade) => {
                      const student = grade.students as { first_name: string; last_name: string; registration_number: string | null };
                      const subject = grade.subjects as { name: string; code: string | null };
                      const enteredUser = grade.entered_user as { first_name: string; last_name: string } | null;
                      const letter = grade.letter_grade;
                      return (
                        <tr key={grade.id} className="border-b last:border-0 hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(grade.id)}
                              onChange={() => toggleSelect(grade.id)}
                              className="h-4 w-4 rounded border-slate-300 text-primary-600"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-800">{student.last_name}, {student.first_name}</p>
                            {student.registration_number && <p className="text-xs text-slate-400 font-mono">{student.registration_number}</p>}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-slate-700">{subject.name}</span>
                            {subject.code && <Badge variant="info" size="sm" className="ml-1">{subject.code}</Badge>}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-800">{grade.score}</td>
                          <td className="px-4 py-3">
                            <span className={`font-semibold ${letter === 'A' ? 'text-emerald-600' : letter === 'B' ? 'text-blue-600' : letter === 'C' ? 'text-slate-600' : letter === 'D' ? 'text-amber-600' : 'text-red-600'}`}>
                              {letter}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-500 text-xs">
                            {enteredUser ? `${enteredUser.first_name} ${enteredUser.last_name}` : '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-xs">
                            {grade.entered_at ? new Date(grade.entered_at).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Reject Dialog */}
      <Dialog open={showReject} onClose={() => setShowReject(false)}>
        <DialogHeader><DialogTitle>Reject Grades</DialogTitle></DialogHeader>
        <DialogBody>
          <p className="text-sm text-slate-600 mb-3">
            Rejecting {selectedIds.size} grade(s). The teacher will be notified and can re-enter.
          </p>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason for rejection (required)..."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-100 resize-none"
            rows={3}
          />
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowReject(false)}>Cancel</Button>
          <Button variant="danger" onClick={() => rejectMutation.mutate(undefined)}
            loading={rejectMutation.isPending} disabled={!rejectReason.trim()}>
            Reject Grades
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
