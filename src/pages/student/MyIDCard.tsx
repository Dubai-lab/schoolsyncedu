import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { studentPortalService } from '@/services/studentPortalService';
import { Card } from '@/components/ui/Card';
import Breadcrumb from '@/components/shared/Breadcrumb';
import {
  CreditCard,
  User,
  School,
  Shield,
  Barcode,
} from 'lucide-react';

export default function MyIDCard() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';
  const userId = user?.id ?? '';

  const { data: student } = useFetch(
    ['my-profile', schoolId, userId],
    () => studentPortalService.getMyProfile(schoolId, userId),
    { enabled: !!schoolId && !!userId },
  );

  const studentId = student?.id ?? '';

  const { data: cardData, isLoading } = useFetch(
    ['my-id-card', schoolId, studentId],
    () => studentPortalService.getMyIDCard(schoolId, studentId),
    { enabled: !!schoolId && !!studentId },
  );

  const { data: design } = useFetch(
    ['card-design', schoolId],
    () => studentPortalService.getActiveCardDesign(schoolId),
    { enabled: !!schoolId },
  );

  const designData = design?.design_data as Record<string, unknown> | null;

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'My Portal' }, { label: 'My ID Card' }]} />

      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          <CreditCard className="inline-block h-6 w-6 mr-2 text-blue-600" />
          My ID Card
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Your digital student identification card.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 rounded-full border-b-2 border-blue-600" />
        </div>
      ) : !cardData && !student ? (
        <Card className="p-12 text-center">
          <CreditCard className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-600">No ID card assigned</h3>
          <p className="text-sm text-slate-400 mt-1">Your ID card has not been issued yet. Contact your school administration.</p>
        </Card>
      ) : (
        <div className="max-w-md mx-auto space-y-6">
          {/* Front of Card */}
          <Card
            className="overflow-hidden rounded-2xl shadow-lg"
            style={{
              background: (designData?.bg_color as string) || 'linear-gradient(135deg, #1e40af, #3b82f6)',
            }}
          >
            <div
              className="p-6 text-white"
              style={{ color: (designData?.text_color as string) || '#ffffff' }}
            >
              {/* Header */}
              <div className="flex items-center gap-3 mb-5">
                <div className="h-10 w-10 bg-white/20 rounded-full flex items-center justify-center">
                  <School className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs opacity-75">Student ID Card</p>
                  <p className="font-bold text-sm">
                    {(designData?.school_name as string) || 'SchoolSync'}
                  </p>
                </div>
              </div>

              {/* Photo + Info */}
              <div className="flex gap-4">
                <div className="h-20 w-20 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {student?.photo_url ? (
                    <img src={student.photo_url as string} alt="Photo" className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-10 w-10 opacity-50" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-lg leading-tight truncate">
                    {student?.first_name} {student?.last_name}
                  </p>
                  <div className="mt-2 space-y-1 text-xs opacity-80">
                    <p>Reg: {student?.registration_number || '—'}</p>
                    <p>Class: {String((student?.classes as Record<string, unknown>)?.name) || '—'}</p>
                    {student?.date_of_birth && (
                      <p>DOB: {new Date(student.date_of_birth as string).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* NFC / Card Info */}
              {cardData && (
                <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between text-xs opacity-70">
                  <span className="flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    Card #{(cardData.card_number as string) || (cardData.nfc_uid as string) || ''}
                  </span>
                  {cardData.issued_date && (
                    <span>Issued: {new Date(cardData.issued_date as string).toLocaleDateString()}</span>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Back of Card */}
          <Card
            className="overflow-hidden rounded-2xl shadow-lg"
            style={{
              background: (designData?.back_bg_color as string) || '#f8fafc',
              color: (designData?.back_text_color as string) || '#334155',
            }}
          >
            <div className="p-6 space-y-4 text-sm">
              <div className="text-center">
                <p className="font-bold text-base">
                  {(designData?.school_name as string) || 'SchoolSync'}
                </p>
                {designData?.show_back_school_address ? (
                  <p className="text-xs opacity-70 mt-0.5">
                    {(designData?.school_address as string) || ''}
                  </p>
                ) : null}
              </div>

              {designData?.show_back_emergency_info ? (
                <div className="bg-black/5 rounded-lg p-3">
                  <p className="text-xs font-semibold mb-1">Emergency Contact</p>
                  <p className="text-xs opacity-70">
                    {student?.emergency_contact_name || 'Contact school administration'}
                  </p>
                  <p className="text-xs opacity-70">
                    {student?.emergency_contact_phone || ''}
                  </p>
                </div>
              ) : null}

              {designData?.back_content ? (
                <p className="text-xs opacity-70 text-center">{designData.back_content as string}</p>
              ) : null}

              {designData?.show_back_barcode !== false && (
                <div className="flex flex-col items-center gap-1 pt-2">
                  <Barcode className="h-8 w-16 opacity-30" />
                  <p className="text-[10px] opacity-40 font-mono">
                    {student?.registration_number || ''}
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Card status info */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Card Information</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-slate-400">Status</p>
                <p className="font-medium text-slate-700 capitalize">
                  {(cardData?.status as string) || (student ? 'Active' : 'Not Issued')}
                </p>
              </div>
              <div>
                <p className="text-slate-400">Card Type</p>
                <p className="font-medium text-slate-700">
                  {cardData?.nfc_uid ? 'NFC Enabled' : 'Digital Only'}
                </p>
              </div>
              <div>
                <p className="text-slate-400">Registration #</p>
                <p className="font-medium text-slate-700 font-mono">{student?.registration_number || '—'}</p>
              </div>
              <div>
                <p className="text-slate-400">Valid Until</p>
                <p className="font-medium text-slate-700">
                  {cardData?.expiry_date ? new Date(cardData.expiry_date as string).toLocaleDateString() : 'End of Year'}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
