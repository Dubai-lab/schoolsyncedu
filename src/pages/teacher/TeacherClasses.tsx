import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { teacherService } from '@/services/teacherService';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Card, CardContent } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { Users, BookOpen, GraduationCap, CalendarCheck, BarChart3 } from 'lucide-react';

export default function TeacherClasses() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const schoolId = user?.school_id ?? '';
  const teacherId = user?.id ?? '';

  const { data: classes, isLoading } = useFetch(
    ['teacher-classes', schoolId, teacherId],
    () => teacherService.getMyClasses(schoolId, teacherId),
    { enabled: !!schoolId && !!teacherId },
  );

  const classIds = (classes ?? []).map((c) => c.id);

  const { data: studentCounts } = useFetch(
    ['teacher-class-counts', classIds.join(',')],
    () => teacherService.getClassStudentCounts(classIds),
    { enabled: classIds.length > 0 },
  );

  const { data: subjects } = useFetch(
    ['teacher-subjects', schoolId, teacherId],
    () => teacherService.getMySubjects(schoolId, teacherId),
    { enabled: !!schoolId && !!teacherId },
  );

  // Group subjects by class
  const subjectsByClass = new Map<string, { subject_name: string; subject_code: string }[]>();
  (subjects ?? []).forEach((s) => {
    const list = subjectsByClass.get(s.class_id) ?? [];
    list.push({ subject_name: s.subject_name, subject_code: s.subject_code });
    subjectsByClass.set(s.class_id, list);
  });

  return (
    <div className="space-y-5">
      <Breadcrumb
        items={[
          { label: 'Teacher Portal', href: '/teacher' },
          { label: 'My Classes' },
        ]}
      />

      <div>
        <h1 className="text-xl font-bold text-slate-900">My Classes</h1>
        <p className="text-sm text-slate-500">
          {classes?.length ?? 0} class{(classes?.length ?? 0) !== 1 ? 'es' : ''} assigned
        </p>
      </div>

      {isLoading ? (
        <LoadingSpinner fullPage label="Loading classes..." />
      ) : !classes || classes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <Users className="h-10 w-10 text-slate-300 mb-3" />
            <p className="text-sm text-slate-400">No classes assigned yet. Contact your administrator.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((cls) => {
            const count = studentCounts?.[cls.id] ?? 0;
            const clsSubjects = subjectsByClass.get(cls.id) ?? [];

            return (
              <div
                key={cls.id}
                className="group rounded-xl border border-slate-200 bg-white p-5 hover:shadow-md hover:border-primary-200 transition-all"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-slate-800">{cls.name}</h3>
                    <p className="text-xs text-slate-400">
                      {cls.grade_level}
                      {cls.section ? ` · Section ${cls.section}` : ''}
                    </p>
                  </div>
                  {cls.isHomeroom && (
                    <Badge variant="info" size="sm">Homeroom</Badge>
                  )}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center gap-1.5 text-sm text-slate-600">
                    <GraduationCap className="h-4 w-4 text-slate-400" />
                    <span className="font-medium">{count}</span>
                    <span className="text-slate-400">students</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-slate-600">
                    <BookOpen className="h-4 w-4 text-slate-400" />
                    <span className="font-medium">{clsSubjects.length}</span>
                    <span className="text-slate-400">subjects</span>
                  </div>
                </div>

                {/* Subjects */}
                {clsSubjects.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-1">
                    {clsSubjects.map((s) => (
                      <span
                        key={s.subject_code}
                        className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                      >
                        {s.subject_code || s.subject_name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 border-t border-slate-100 pt-3">
                  <button
                    onClick={() => navigate('/teacher/attendance', { state: { classId: cls.id } })}
                    className="flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition"
                  >
                    <CalendarCheck className="h-3.5 w-3.5" />
                    Attendance
                  </button>
                  <button
                    onClick={() => navigate('/teacher/grades', { state: { classId: cls.id } })}
                    className="flex items-center gap-1 rounded-md bg-purple-50 px-2.5 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 transition"
                  >
                    <BarChart3 className="h-3.5 w-3.5" />
                    Grades
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
