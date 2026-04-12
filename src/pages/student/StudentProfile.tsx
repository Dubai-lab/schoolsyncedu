import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { studentPortalService } from '@/services/studentPortalService';
import { Card } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Breadcrumb from '@/components/shared/Breadcrumb';
import {
  User,
  Mail,
  Phone,
  Calendar,
  MapPin,
  Hash,
  Shield,
  Users,
} from 'lucide-react';

export default function StudentProfile() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';
  const userId = user?.id ?? '';

  const { data: student, isLoading } = useFetch(
    ['my-profile', schoolId, userId],
    () => studentPortalService.getMyProfile(schoolId, userId),
    { enabled: !!schoolId && !!userId },
  );

  const guardians = (student as Record<string, unknown>)?.guardians as Record<string, unknown>[] | undefined;

  function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | undefined }) {
    return (
      <div className="flex items-start gap-3 py-2.5">
        <Icon className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-xs text-slate-400">{label}</p>
          <p className="text-sm font-medium text-slate-700">{value || '—'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'My Portal' }, { label: 'My Profile' }]} />

      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          <User className="inline-block h-6 w-6 mr-2 text-blue-600" />
          My Profile
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Your personal and academic information.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 rounded-full border-b-2 border-blue-600" />
        </div>
      ) : !student ? (
        <Card className="p-12 text-center">
          <User className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-600">Profile not found</h3>
          <p className="text-sm text-slate-400 mt-1">Contact your school administrator.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Photo + Basic */}
          <Card className="p-6 text-center lg:col-span-1">
            <div className="h-24 w-24 mx-auto rounded-full bg-blue-100 flex items-center justify-center overflow-hidden">
              {student.photo_url ? (
                <img src={student.photo_url as string} alt="Photo" className="h-full w-full object-cover" />
              ) : (
                <User className="h-10 w-10 text-blue-400" />
              )}
            </div>
            <h2 className="mt-3 text-lg font-bold text-slate-800">
              {student.first_name} {student.middle_name || ''} {student.last_name}
            </h2>
            <p className="text-sm text-slate-400 mt-0.5 font-mono">{student.registration_number}</p>
            <div className="mt-3 flex justify-center gap-2">
              <Badge variant="info" size="sm">Student</Badge>
              <Badge variant={student.status === 'active' ? 'success' : 'default'} size="sm">
                {(student.status as string) || 'Active'}
              </Badge>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 text-left space-y-0">
              <InfoRow icon={Hash} label="Registration Number" value={student.registration_number as string} />
              <InfoRow icon={Calendar} label="Date of Birth" value={student.date_of_birth ? new Date(student.date_of_birth as string).toLocaleDateString() : undefined} />
              <InfoRow icon={User} label="Gender" value={student.gender as string} />
              <InfoRow icon={Shield} label="Blood Type" value={student.blood_type as string} />
            </div>
          </Card>

          {/* Academic + Contact */}
          <div className="lg:col-span-2 space-y-6">
            {/* Academic Information */}
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Academic Information</h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-0">
                <InfoRow
                  icon={Calendar}
                  label="Admission Date"
                  value={student.admission_date ? new Date(student.admission_date as string).toLocaleDateString() : undefined}
                />
                <InfoRow
                  icon={Hash}
                  label="Current Class"
                  value={(student.classes as Record<string, unknown> | null)?.name as string}
                />
                <InfoRow
                  icon={Calendar}
                  label="Academic Year"
                  value={student.current_academic_year as string}
                />
                <InfoRow
                  icon={Shield}
                  label="Grade Level"
                  value={
                    ((student.classes as Record<string, unknown> | null)?.grade_level as string)
                    || (student.current_grade_level as string)
                  }
                />
              </div>
            </Card>

            {/* Contact Information */}
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Contact Information</h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-0">
                <InfoRow icon={Mail} label="Email" value={user?.email} />
                <InfoRow icon={Phone} label="Phone" value={student.phone as string} />
                <InfoRow icon={MapPin} label="Address" value={student.address as string} />
                <InfoRow icon={MapPin} label="City" value={student.city as string} />
              </div>
            </Card>

            {/* Emergency Contact */}
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Emergency Contact</h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-0">
                <InfoRow icon={User} label="Contact Name" value={student.emergency_contact_name as string} />
                <InfoRow icon={Phone} label="Contact Phone" value={student.emergency_contact_phone as string} />
                <InfoRow icon={Users} label="Relationship" value={student.emergency_contact_relationship as string} />
              </div>
            </Card>

            {/* Guardians */}
            {guardians && guardians.length > 0 && (
              <Card className="p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">
                  <Users className="inline-block h-4 w-4 mr-1.5" />
                  Guardians / Parents
                </h3>
                <div className="space-y-3">
                  {guardians.map((g, i) => (
                    <div key={i} className="p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm text-slate-800">
                          {(g.first_name as string)} {(g.last_name as string)}
                        </p>
                        <Badge variant="default" size="sm">{(g.relationship as string) || 'Guardian'}</Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
                        {g.phone ? (
                          <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {g.phone as string}</span>
                        ) : null}
                        {g.email ? (
                          <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {g.email as string}</span>
                        ) : null}
                        {g.occupation ? (
                          <span className="flex items-center gap-1"><User className="h-3 w-3" /> {g.occupation as string}</span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
