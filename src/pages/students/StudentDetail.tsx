import { useParams, useNavigate } from 'react-router-dom';
import { useFetch } from '@/hooks/useFetch';
import { studentService, enrollmentService } from '@/services/studentService';
import { Tabs, TabList, TabTrigger, TabContent } from '@/components/ui/Tabs';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Breadcrumb from '@/components/shared/Breadcrumb';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import type { StudentStatus } from '@/types/student.types';
import {
  ArrowLeft,
  Pencil,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  Calendar,
  GraduationCap,
  User,
  Users,
  FileText,
  DollarSign,
} from 'lucide-react';

const statusVariant: Record<StudentStatus, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  enrolled: 'success',
  suspended: 'warning',
  expelled: 'danger',
  withdrawn: 'default',
  graduated: 'info',
  on_leave: 'warning',
};

export default function StudentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: student, isLoading } = useFetch(
    ['student', id!],
    () => studentService.getById(id!),
    { enabled: !!id },
  );

  const { data: enrollments } = useFetch(
    ['enrollments', id!],
    () => enrollmentService.listByStudent(id!),
    { enabled: !!id },
  );

  if (isLoading) return <LoadingSpinner fullPage label="Loading student..." />;
  if (!student) return <p className="py-10 text-center text-slate-400">Student not found.</p>;

  const fullName = `${student.first_name} ${student.last_name}`;

  return (
    <div className="space-y-5">
      <Breadcrumb items={[
        { label: 'Students', href: '/students' },
        { label: fullName },
      ]} />

      {/* Profile header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate('/students')} />
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-100 text-lg font-bold text-primary-700">
            {student.first_name[0]}{student.last_name[0]}
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{fullName}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm text-slate-500 font-mono">{student.registration_number}</span>
              <Badge variant={statusVariant[student.status]}>{student.status.replace(/_/g, ' ')}</Badge>
            </div>
          </div>
        </div>
        <Button size="sm" icon={<Pencil className="h-4 w-4" />} onClick={() => navigate(`/students/${id}/edit`)}>
          Edit Student
        </Button>
      </div>

      {/* Pending Registration Fee Warning */}
      {enrollments?.some((e) => (e.status as string) === 'pending_payment') && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <DollarSign className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Registration Fee Pending</p>
            <p className="text-xs text-amber-700 mt-0.5">
              This student's enrollment is waiting for the registration fee to be paid.
              The Bursar must record the payment to activate enrollment.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="profile">
        <TabList>
          <TabTrigger value="profile"><User className="h-4 w-4" /> Profile</TabTrigger>
          <TabTrigger value="guardians"><Users className="h-4 w-4" /> Guardians</TabTrigger>
          <TabTrigger value="enrollment"><FileText className="h-4 w-4" /> Enrollment</TabTrigger>
        </TabList>

        {/* Profile tab */}
        <TabContent value="profile">
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <InfoRow icon={<User className="h-4 w-4" />} label="Gender" value={student.gender} />
                <InfoRow icon={<Calendar className="h-4 w-4" />} label="Date of Birth" value={student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString() : '—'} />
                <InfoRow icon={<GraduationCap className="h-4 w-4" />} label="Grade Level" value={student.current_grade_level ?? '—'} />
                <InfoRow icon={<Calendar className="h-4 w-4" />} label="Enrolled" value={student.enrollment_date ? new Date(student.enrollment_date).toLocaleDateString() : '—'} />
                {student.previous_school && (
                  <InfoRow icon={<GraduationCap className="h-4 w-4" />} label="Previous School" value={student.previous_school} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Emergency Contact</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <InfoRow icon={<User className="h-4 w-4" />} label="Name" value={student.emergency_contact_name ?? '—'} />
                <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={student.emergency_contact_phone ?? '—'} />
              </CardContent>
            </Card>
          </div>
        </TabContent>

        {/* Guardians tab */}
        <TabContent value="guardians">
          {student.guardians.length === 0 ? (
            <Card><CardContent><p className="text-sm text-slate-400 py-4">No guardians on record.</p></CardContent></Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {student.guardians.map((g) => (
                <Card key={g.id}>
                  <CardContent className="space-y-2.5 py-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-sm font-semibold">
                        {g.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">{g.full_name}</p>
                        <p className="text-xs text-slate-400 capitalize">{g.relationship}</p>
                      </div>
                    </div>
                    <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={g.phone ?? '—'} />
                    {g.email && <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={g.email} />}
                    {g.address && <InfoRow icon={<MapPin className="h-4 w-4" />} label="Address" value={g.address} />}
                    {g.occupation && <InfoRow icon={<Briefcase className="h-4 w-4" />} label="Occupation" value={g.occupation} />}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabContent>

        {/* Enrollment tab */}
        <TabContent value="enrollment">
          <Card>
            <CardHeader><CardTitle>Enrollment History</CardTitle></CardHeader>
            <CardContent>
              {!enrollments || enrollments.length === 0 ? (
                <p className="text-sm text-slate-400 py-4">No enrollment records.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {enrollments.map((e) => (
                    <div key={e.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-700">{e.academic_year}</p>
                        <p className="text-xs text-slate-400">
                          Enrolled {new Date(e.enrollment_date).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant={
                        e.status === 'active' ? 'success' :
                        e.status === 'completed' ? 'info' :
                        (e.status as string) === 'pending_payment' ? 'warning' :
                        'default'
                      }>
                        {(e.status as string) === 'pending_payment' ? 'Pending Payment' : e.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabContent>
      </Tabs>
    </div>
  );
}

// ==================== HELPER ====================

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-slate-400">{icon}</span>
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-sm text-slate-700 capitalize">{value}</p>
      </div>
    </div>
  );
}