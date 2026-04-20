import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { gradeService } from '@/services/gradeService';
import { ACADEMIC_YEAR_TERMS } from '@/utils/constants';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Pagination from '@/components/ui/Pagination';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Plus, FileText } from 'lucide-react';

type GradeRow = {
  id: string;
  student_name: string;
  student_id_number: string | null;
  subject_name: string;
  subject_code: string | null;
  academic_year: string;
  semester: string;
  score: number;
  letter_grade: string;
  gpa_points: number;
};

const semesterOptions = Object.entries(ACADEMIC_YEAR_TERMS).map(([, v]) => ({
  label: v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
  value: v,
}));

function gradeBadgeVariant(letter: string) {
  if (letter === 'A') return 'success' as const;
  if (letter === 'B') return 'info' as const;
  if (letter === 'C') return 'default' as const;
  if (letter === 'D') return 'warning' as const;
  return 'danger' as const;
}

export default function GradeList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    subjectId: '',
    academicYear: '',
    semester: '',
    classId: '',
  });

  const { data: classes } = useFetch(
    ['grade-list-classes', schoolId],
    () => gradeService.getClasses(schoolId),
    { enabled: !!schoolId },
  );

  const { data: subjects } = useFetch(
    ['grade-list-subjects', schoolId],
    () => gradeService.getSubjects(schoolId),
    { enabled: !!schoolId },
  );

  const { data: result, isLoading } = useFetch(
    ['grades', schoolId, String(page), JSON.stringify(filters)],
    () =>
      gradeService.list(schoolId, {
        page,
        pageSize: 25,
        subjectId: filters.subjectId || undefined,
        academicYear: filters.academicYear || undefined,
        semester: filters.semester || undefined,
        classId: filters.classId || undefined,
      }),
    { enabled: !!schoolId },
  );

  const rows: GradeRow[] = (result?.data ?? []).map((g) => {
    const student = g.students as Record<string, string> | undefined;
    const subject = g.subjects as Record<string, string> | undefined;
    return {
      id: g.id as string,
      student_name: student ? `${student.first_name} ${student.last_name}` : '',
      student_id_number: student?.registration_number ?? null,
      subject_name: subject?.name ?? '',
      subject_code: subject?.code ?? null,
      academic_year: g.academic_year as string,
      semester: g.semester as string,
      score: g.score as number,
      letter_grade: g.letter_grade as string,
      gpa_points: g.gpa_points as number,
    };
  });

  const totalPages = Math.ceil((result?.count ?? 0) / 25);

  const classOptions = (classes ?? []).map((c) => ({ label: `${c.name} — ${c.grade_level || ''}`, value: c.id }));
  const subjectOptions = (subjects ?? []).map((s) => ({ label: s.name, value: s.id }));

  const columns: Column<GradeRow>[] = [
    { key: 'student_name', header: 'Student', render: (r) => (
      <div>
        <p className="font-medium text-slate-900">{r.student_name}</p>
        {r.student_id_number && <p className="text-xs text-slate-400">{r.student_id_number}</p>}
      </div>
    )},
    { key: 'subject_name', header: 'Subject', render: (r) => (
      <div>
        <p className="text-sm">{r.subject_name}</p>
        {r.subject_code && <p className="text-xs text-slate-400">{r.subject_code}</p>}
      </div>
    )},
    { key: 'academic_year', header: 'Year' },
    { key: 'semester', header: 'Semester', render: (r) => (
      <span className="text-sm capitalize">{r.semester?.replace(/_/g, ' ')}</span>
    )},
    { key: 'score', header: 'Score', render: (r) => <span className="font-medium">{r.score}</span> },
    { key: 'letter_grade', header: 'Grade', render: (r) => (
      <Badge variant={gradeBadgeVariant(r.letter_grade)} size="sm">{r.letter_grade}</Badge>
    )},
    { key: 'gpa_points', header: 'GPA', render: (r) => <span className="text-sm">{r.gpa_points}</span> },
  ];

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Grades' }]} />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Grade Book</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/grades/reports')}>
            <FileText className="h-4 w-4 mr-1" /> Report Cards
          </Button>
          <Button size="sm" onClick={() => navigate('/grades/entry')}>
            <Plus className="h-4 w-4 mr-1" /> Enter Grades
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select
          label="Class"
          options={classOptions}
          value={filters.classId}
          onChange={(e) => { setFilters((f) => ({ ...f, classId: e.target.value })); setPage(1); }}
          placeholder="All Classes"
          className="w-52"
        />
        <Select
          label="Subject"
          options={subjectOptions}
          value={filters.subjectId}
          onChange={(e) => { setFilters((f) => ({ ...f, subjectId: e.target.value })); setPage(1); }}
          placeholder="All Subjects"
          className="w-52"
        />
        <Select
          label="Semester"
          options={semesterOptions}
          value={filters.semester}
          onChange={(e) => { setFilters((f) => ({ ...f, semester: e.target.value })); setPage(1); }}
          placeholder="All Semesters"
          className="w-44"
        />
      </div>

      <Table columns={columns} data={rows} keyExtractor={(r) => r.id} loading={isLoading} emptyMessage="No grades found." />

      {totalPages > 1 && (
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      )}
    </div>
  );
}