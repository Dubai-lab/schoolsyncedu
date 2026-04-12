import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { promotionService } from '@/services/promotionService';
import type { PromotionOutcome, PromotionDecision, StudentGradeSummary } from '@/services/promotionService';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Select from '@/components/ui/Select';
import Breadcrumb from '@/components/shared/Breadcrumb';
import Dialog, { DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/Dialog';
import { notify } from '@/components/shared/Toast';
import {
  GraduationCap, TrendingUp, AlertTriangle, CheckCircle2,
  Users, BarChart2, ChevronDown, ChevronUp,
} from 'lucide-react';

const OUTCOME_CONFIG: Record<PromotionOutcome, { label: string; color: string; badgeVariant: 'success' | 'danger' | 'info' }> = {
  promoted:  { label: 'Promoted',  color: 'bg-emerald-100 text-emerald-700 border-emerald-300', badgeVariant: 'success' },
  retained:  { label: 'Retained',  color: 'bg-red-100 text-red-700 border-red-300',             badgeVariant: 'danger' },
  graduated: { label: 'Graduated', color: 'bg-blue-100 text-blue-700 border-blue-300',          badgeVariant: 'info' },
};

function OutcomeToggle({ value, onChange }: { value: PromotionOutcome; onChange: (v: PromotionOutcome) => void }) {
  return (
    <div className="flex gap-1">
      {(['promoted', 'retained', 'graduated'] as PromotionOutcome[]).map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
            value === o ? OUTCOME_CONFIG[o].color : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
          }`}
        >
          {OUTCOME_CONFIG[o].label}
        </button>
      ))}
    </div>
  );
}

export default function StudentPromotion() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const [selectedYear, setSelectedYear] = useState('');
  const [decisions, setDecisions] = useState<Record<string, PromotionDecision>>({});
  const [expandedGrades, setExpandedGrades] = useState<Set<string>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);
  const [notesFor, setNotesFor] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  const { data: years = [] } = useFetch(
    ['grade-years', schoolId],
    () => promotionService.getAcademicYearsWithGrades(schoolId),
    { enabled: !!schoolId },
  );

  const { data: students = [], isLoading } = useFetch(
    ['promotion-students', schoolId, selectedYear],
    () => promotionService.getStudentsWithGrades(schoolId, selectedYear),
    { enabled: !!schoolId && !!selectedYear },
  );

  // Initialise decisions from suggestions when students load
  useMemo(() => {
    if ((students as StudentGradeSummary[]).length > 0) {
      const initial: Record<string, PromotionDecision> = {};
      for (const s of students as StudentGradeSummary[]) {
        if (!decisions[s.student_id]) {
          initial[s.student_id] = { student_id: s.student_id, outcome: s.suggested_outcome, notes: '' };
        }
      }
      if (Object.keys(initial).length > 0) setDecisions((prev) => ({ ...initial, ...prev }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students]);

  const saveMutation = useMutate(
    () => promotionService.savePromotions(
      schoolId,
      selectedYear,
      Object.values(decisions),
      user?.id ?? '',
    ),
    [['promotion-students'], ['grade-years'], ['registrar-students']],
    {
      onSuccess: () => {
        notify.success(`${Object.values(decisions).length} students promoted for ${selectedYear}`);
        setShowConfirm(false);
        setDecisions({});
      },
    },
  );

  // Group students by grade level
  const byGrade = useMemo(() => {
    const map = new Map<string, StudentGradeSummary[]>();
    for (const s of students as StudentGradeSummary[]) {
      const g = s.current_grade_level;
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(s);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [students]);

  function bulkSetGrade(gradeLevel: string, outcome: PromotionOutcome) {
    const update: Record<string, PromotionDecision> = {};
    for (const s of (students as StudentGradeSummary[]).filter((s) => s.current_grade_level === gradeLevel)) {
      update[s.student_id] = { student_id: s.student_id, outcome, notes: decisions[s.student_id]?.notes ?? '' };
    }
    setDecisions((prev) => ({ ...prev, ...update }));
  }

  function setOutcome(studentId: string, outcome: PromotionOutcome) {
    setDecisions((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], student_id: studentId, outcome },
    }));
  }

  function saveNote(studentId: string) {
    setDecisions((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], student_id: studentId, notes: noteText },
    }));
    setNotesFor(null);
    setNoteText('');
  }

  function toggleGrade(grade: string) {
    setExpandedGrades((prev) => {
      const next = new Set(prev);
      if (next.has(grade)) next.delete(grade); else next.add(grade);
      return next;
    });
  }

  const promotedCount  = Object.values(decisions).filter((d) => d.outcome === 'promoted').length;
  const retainedCount  = Object.values(decisions).filter((d) => d.outcome === 'retained').length;
  const graduatedCount = Object.values(decisions).filter((d) => d.outcome === 'graduated').length;
  const totalStudents  = (students as StudentGradeSummary[]).length;

  const yearOptions = (years as string[]).map((y) => ({ value: y, label: y }));

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Registrar', href: '/registrar' }, { label: 'Year-End Promotion' }]} />

      <div>
        <h1 className="text-xl font-bold text-slate-900">Year-End Student Promotion</h1>
        <p className="text-sm text-slate-500">
          Review student grades and confirm promotion, retention, or graduation for the selected academic year.
        </p>
      </div>

      {/* Year selector */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-56">
            <Select
              label="Academic Year to Process"
              options={yearOptions}
              value={selectedYear}
              onChange={(e) => { setSelectedYear(e.target.value); setDecisions({}); }}
              placeholder="Select year..."
            />
          </div>
          {selectedYear && totalStudents > 0 && (
            <p className="text-sm text-slate-500 pb-1">
              <strong>{totalStudents}</strong> students pending promotion decision
            </p>
          )}
          {selectedYear && !isLoading && totalStudents === 0 && (
            <p className="text-sm text-slate-500 pb-1 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              No pending students — either all have been processed or no approved grades exist for this year yet.
            </p>
          )}
        </div>
      </Card>

      {/* Summary bar */}
      {totalStudents > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3 flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-lg font-bold text-emerald-700">{promotedCount}</p>
              <p className="text-xs text-slate-500">Promoted</p>
            </div>
          </Card>
          <Card className="p-3 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
            <div>
              <p className="text-lg font-bold text-red-700">{retainedCount}</p>
              <p className="text-xs text-slate-500">Retained</p>
            </div>
          </Card>
          <Card className="p-3 flex items-center gap-3">
            <GraduationCap className="h-5 w-5 text-blue-600 shrink-0" />
            <div>
              <p className="text-lg font-bold text-blue-700">{graduatedCount}</p>
              <p className="text-xs text-slate-500">Graduating</p>
            </div>
          </Card>
        </div>
      )}

      {/* Students by grade */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 rounded-xl bg-slate-100 animate-pulse" />)}
        </div>
      ) : (
        byGrade.map(([grade, gradeStudents]) => {
          const isExpanded = expandedGrades.has(grade);
          const avgForGrade = gradeStudents.reduce((s, g) => s + (g.average_score ?? 0), 0) / gradeStudents.length;
          const passCount = gradeStudents.filter((s) => (s.average_score ?? 0) >= 50).length;

          return (
            <Card key={grade} className="overflow-hidden">
              {/* Grade header */}
              <div
                className="flex items-center justify-between px-4 py-3 bg-slate-50/80 border-b border-slate-100 cursor-pointer select-none"
                onClick={() => toggleGrade(grade)}
              >
                <div className="flex items-center gap-3">
                  <Users className="h-4 w-4 text-slate-400" />
                  <span className="font-semibold text-slate-800">{grade}</span>
                  <span className="text-xs text-slate-400">{gradeStudents.length} students</span>
                  <span className="text-xs text-slate-400">· Avg: {avgForGrade.toFixed(1)}%</span>
                  <span className="text-xs text-slate-400">· {passCount}/{gradeStudents.length} passed</span>
                </div>
                <div className="flex items-center gap-3">
                  {/* Bulk actions */}
                  <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => bulkSetGrade(grade, 'promoted')}
                      className="px-2 py-1 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                    >
                      Promote All
                    </button>
                    <button
                      onClick={() => bulkSetGrade(grade, 'retained')}
                      className="px-2 py-1 rounded text-xs font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
                    >
                      Retain All
                    </button>
                  </div>
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </div>
              </div>

              {/* Student rows */}
              {isExpanded && (
                <div className="divide-y divide-slate-50">
                  {gradeStudents.map((s) => {
                    const decision = decisions[s.student_id];
                    const outcome = decision?.outcome ?? s.suggested_outcome;
                    const hasNote = decision?.notes;
                    const isSuggested = outcome === s.suggested_outcome;

                    return (
                      <div key={s.student_id} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50/60 transition-colors">
                        {/* Student info */}
                        <div className="w-52 min-w-0">
                          <p className="font-medium text-slate-900 text-sm truncate">
                            {s.last_name}, {s.first_name}
                          </p>
                          <p className="text-xs text-slate-400">{s.registration_number}</p>
                        </div>

                        {/* Grade stats */}
                        <div className="flex gap-4 text-xs text-slate-500 flex-1">
                          <div className="flex items-center gap-1">
                            <BarChart2 className="h-3.5 w-3.5" />
                            <span>
                              {s.average_score !== null ? (
                                <span className={s.average_score >= 50 ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>
                                  {s.average_score}%
                                </span>
                              ) : (
                                <span className="text-slate-400 italic">No grades</span>
                              )}
                            </span>
                          </div>
                          <span>{s.subjects_passed}/{s.subject_count} subjects passed</span>
                          {!isSuggested && (
                            <Badge variant="warning" size="sm">Overridden</Badge>
                          )}
                        </div>

                        {/* Outcome toggle */}
                        <OutcomeToggle value={outcome} onChange={(v) => setOutcome(s.student_id, v)} />

                        {/* Notes button */}
                        <button
                          onClick={() => { setNotesFor(s.student_id); setNoteText(decision?.notes ?? ''); }}
                          className={`text-xs px-2 py-1 rounded border transition-colors ${hasNote ? 'bg-amber-50 text-amber-700 border-amber-200' : 'text-slate-400 border-slate-200 hover:bg-slate-100'}`}
                        >
                          {hasNote ? 'Note ✓' : '+ Note'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })
      )}

      {/* Confirm button */}
      {totalStudents > 0 && Object.keys(decisions).length === totalStudents && (
        <div className="flex justify-end pt-2">
          <Button onClick={() => setShowConfirm(true)} className="px-6">
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Confirm Promotion for {selectedYear}
          </Button>
        </div>
      )}

      {/* Note dialog */}
      {notesFor && (
        <Dialog open onClose={() => setNotesFor(null)} className="max-w-md">
          <DialogHeader><DialogTitle>Add Note</DialogTitle></DialogHeader>
          <DialogBody>
            <textarea
              rows={3}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Optional note for this student's promotion decision..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none resize-none"
            />
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNotesFor(null)}>Cancel</Button>
            <Button onClick={() => saveNote(notesFor)}>Save Note</Button>
          </DialogFooter>
        </Dialog>
      )}

      {/* Confirm promotion dialog */}
      {showConfirm && (
        <Dialog open onClose={() => setShowConfirm(false)} className="max-w-md">
          <DialogHeader><DialogTitle>Confirm Year-End Promotion</DialogTitle></DialogHeader>
          <DialogBody className="space-y-3">
            <p className="text-sm text-slate-600">
              You are about to finalise promotion decisions for <strong>{selectedYear}</strong>.
              This will update all student grade levels and cannot be undone.
            </p>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-emerald-700 font-medium">Promoted</span>
                <span className="font-bold">{promotedCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-600 font-medium">Retained</span>
                <span className="font-bold">{retainedCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-700 font-medium">Graduated</span>
                <span className="font-bold">{graduatedCount}</span>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowConfirm(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate(undefined)} loading={saveMutation.isPending}>
              Confirm & Process
            </Button>
          </DialogFooter>
        </Dialog>
      )}
    </div>
  );
}
