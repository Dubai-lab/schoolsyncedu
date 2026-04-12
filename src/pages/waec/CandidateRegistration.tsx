import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { waecSessionService, waecCandidateService } from '@/services/waecService';
import { studentService } from '@/services/studentService';
import { notify } from '@/components/shared/Toast';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Save, ArrowLeft, Search } from 'lucide-react';
import type { WaecExamSession, WaecExamType, WaecSubjectCategory, RegisterCandidateForm } from '@/types/waec.types';
import { WASSCE_SUBJECTS, LJHSCE_SUBJECTS } from '@/types/waec.types';

interface StudentOption {
  id: string;
  first_name: string;
  last_name: string;
  current_grade_level: string;
  registration_number: string | null;
}

export default function CandidateRegistration() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const schoolId = user?.school_id ?? '';

  const [sessionId, setSessionId] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedSubjects, setSelectedSubjects] = useState<
    { subjectName: string; subjectCode: string; category: WaecSubjectCategory }[]
  >([]);

  // Fetch active sessions
  const { data: sessions = [] } = useFetch<WaecExamSession[]>(
    ['waec-sessions', schoolId],
    () => waecSessionService.list(schoolId),
    { enabled: !!schoolId },
  );

  const activeSessions = sessions.filter((s) => s.is_active);
  const selectedSession = activeSessions.find((s) => s.id === sessionId);
  const examType = selectedSession?.exam_type ?? ('WASSCE' as WaecExamType);
  const availableSubjects = examType === 'WASSCE' ? WASSCE_SUBJECTS : LJHSCE_SUBJECTS;

  // Fetch students for search
  const { data: studentResult } = useFetch(
    ['students-search', schoolId, studentSearch],
    () => studentService.list(schoolId, { search: studentSearch, pageSize: 50 }),
    { enabled: !!schoolId && studentSearch.length >= 2 },
  );
  const students = (studentResult?.data ?? []) as StudentOption[];

  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  const sessionOptions = activeSessions.map((s) => ({
    label: `${s.exam_type} — ${s.academic_year} (Exam ${s.exam_year})`,
    value: s.id,
  }));

  const registerMutation = useMutate(
    (form: RegisterCandidateForm) =>
      waecCandidateService.register(schoolId, form, user?.id ?? ''),
    [['waec-sessions', schoolId], ['waec-candidates-all', schoolId]],
  );

  const toggleSubject = (subjectCode: string) => {
    const subj = availableSubjects.find((s) => s.code === subjectCode);
    if (!subj) return;
    setSelectedSubjects((prev) => {
      const exists = prev.find((s) => s.subjectCode === subjectCode);
      if (exists) return prev.filter((s) => s.subjectCode !== subjectCode);
      return [...prev, { subjectName: subj.name, subjectCode: subj.code, category: subj.category }];
    });
  };

  const coreSubjects = availableSubjects.filter((s) => s.category === 'core');
  const electiveSubjects = availableSubjects.filter((s) => s.category === 'elective');

  const handleSubmit = async () => {
    if (!sessionId) { notify.error('Select an exam session'); return; }
    if (!selectedStudentId) { notify.error('Select a student'); return; }
    if (selectedSubjects.length === 0) { notify.error('Select at least one subject'); return; }

    try {
      await registerMutation.mutateAsync({
        sessionId,
        studentId: selectedStudentId,
        examType,
        gradeLevel: selectedStudent?.current_grade_level ?? '',
        subjects: selectedSubjects,
      });
      notify.success('Candidate registered successfully');
      navigate('/waec/candidates');
    } catch {
      notify.error('Failed to register candidate');
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: 'WAEC', href: '/waec' },
          { label: 'Register Candidate' },
        ]}
      />

      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate('/waec')}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <h1 className="text-2xl font-bold text-slate-900">Register WAEC Candidate</h1>
      </div>

      {/* Step 1: Session */}
      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">1. Select Exam Session</h2>
        {activeSessions.length === 0 ? (
          <p className="text-sm text-slate-500">
            No active sessions. Create an exam session on the{' '}
            <span className="cursor-pointer text-primary underline" onClick={() => navigate('/waec')}>
              dashboard
            </span>{' '}
            first.
          </p>
        ) : (
          <Select
            label="Exam Session"
            options={sessionOptions}
            value={sessionId}
            onChange={(e) => {
              setSessionId(e.target.value);
              setSelectedSubjects([]);
            }}
            placeholder="Choose a session..."
          />
        )}
        {selectedSession && (
          <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            <p><strong>Deadline:</strong> {new Date(selectedSession.registration_deadline).toLocaleDateString()}</p>
            <p><strong>Fee:</strong> ${Number(selectedSession.fee_per_candidate_usd).toFixed(2)} per candidate + ${Number(selectedSession.fee_per_subject_usd).toFixed(2)} per subject</p>
          </div>
        )}
      </Card>

      {/* Step 2: Student */}
      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">2. Select Student</h2>
        <div className="relative">
          <Input
            label="Search Student"
            placeholder="Type student name or ID..."
            value={studentSearch}
            onChange={(e) => {
              setStudentSearch(e.target.value);
              setSelectedStudentId('');
            }}
            icon={<Search className="h-4 w-4" />}
          />
        </div>
        {students.length > 0 && !selectedStudentId && (
          <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200">
            {students.map((s) => (
              <div
                key={s.id}
                className="cursor-pointer px-4 py-2 text-sm hover:bg-slate-50"
                onClick={() => {
                  setSelectedStudentId(s.id);
                  setStudentSearch(`${s.first_name} ${s.last_name}`);
                }}
              >
                <span className="font-medium">{s.first_name} {s.last_name}</span>
                <span className="ml-2 text-slate-400">
                  {s.registration_number ?? ''} · Grade {s.current_grade_level}
                </span>
              </div>
            ))}
          </div>
        )}
        {selectedStudent && (
          <div className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">
            Selected: <strong>{selectedStudent.first_name} {selectedStudent.last_name}</strong> — Grade {selectedStudent.current_grade_level}
          </div>
        )}
      </Card>

      {/* Step 3: Subjects */}
      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          3. Select Subjects ({selectedSubjects.length} selected)
        </h2>

        {/* Core */}
        <h3 className="mb-2 text-sm font-semibold uppercase text-slate-500">Core Subjects</h3>
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {coreSubjects.map((subj) => {
            const isSelected = selectedSubjects.some((s) => s.subjectCode === subj.code);
            return (
              <label
                key={subj.code}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm transition-colors ${
                  isSelected
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSubject(subj.code)}
                  className="accent-primary"
                />
                <span>{subj.name}</span>
                <span className="ml-auto text-xs text-slate-400">{subj.code}</span>
              </label>
            );
          })}
        </div>

        {/* Elective */}
        <h3 className="mb-2 text-sm font-semibold uppercase text-slate-500">Elective Subjects</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {electiveSubjects.map((subj) => {
            const isSelected = selectedSubjects.some((s) => s.subjectCode === subj.code);
            return (
              <label
                key={subj.code}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm transition-colors ${
                  isSelected
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSubject(subj.code)}
                  className="accent-primary"
                />
                <span>{subj.name}</span>
                <span className="ml-auto text-xs text-slate-400">{subj.code}</span>
              </label>
            );
          })}
        </div>
      </Card>

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate('/waec')}>Cancel</Button>
        <Button onClick={handleSubmit} loading={registerMutation.isPending}>
          <Save className="mr-2 h-4 w-4" /> Register Candidate
        </Button>
      </div>
    </div>
  );
}
