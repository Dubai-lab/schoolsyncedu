import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { studentPortalService } from '@/services/studentPortalService';
import { Card } from '@/components/ui/Card';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { StudentIdCard, StudentIdCardBack } from '@/components/shared/StudentIdCard';
import type { IdCardDesignData } from '@/types/nfc.types';
import { CreditCard } from 'lucide-react';

/**
 * The student's digital ID card.
 *
 * Renders with the school's OWN active design, through the same component the
 * printed card uses — so what a student sees here matches the plastic in their
 * pocket.
 *
 * This page previously drew its own card from properties the designer never
 * writes (bg_color, school_name, school_address) and read them from
 * design_data when the column is design_json. Both resolved to undefined, so
 * every student at every school saw the same hardcoded SchoolSync fallback.
 */
export default function MyIDCard() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';
  const userId = user?.id ?? '';

  const { data: student } = useFetch(
    ['my-profile', schoolId, userId],
    () => studentPortalService.getMyProfile(schoolId, userId),
    { enabled: !!schoolId && !!userId },
  );

  const studentId = (student as Record<string, unknown> | null)?.id as string ?? '';

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

  const { data: school } = useFetch(
    ['my-school', schoolId],
    () => studentPortalService.getMySchool(schoolId),
    { enabled: !!schoolId },
  );

  const s = student as Record<string, unknown> | null;
  const c = cardData as Record<string, unknown> | null;
  const sc = school as Record<string, unknown> | null;

  // Prefer the design attached to this student's own card row — getMyIDCard
  // joins id_card_designs, so that is the design their physical card was
  // printed with. Falling back to the school's currently active design would
  // show a different card than the one in their pocket whenever the school
  // redesigns. The school-wide design is only the fallback, for students whose
  // card has not been generated yet.
  //
  // design_json is the column the designer writes; the old code read
  // design_data, which does not exist on this table.
  const cardOwnDesign =
    (c?.id_card_designs as Record<string, unknown> | null)?.design_json as
      | IdCardDesignData
      | undefined;

  const schoolActiveDesign = (design as Record<string, unknown> | null)?.design_json as
    | IdCardDesignData
    | undefined;

  const designJson = cardOwnDesign ?? schoolActiveDesign ?? null;

  const cardStudent = {
    first_name: s?.first_name as string | null,
    last_name: s?.last_name as string | null,
    registration_number: s?.registration_number as string | null,
    current_grade_level:
      ((s?.classes as Record<string, unknown> | null)?.name as string) ??
      (s?.current_grade_level as string | null),
    photo_url: s?.photo_url as string | null,
  };

  const cardSchool = {
    name: sc?.name as string | null,
    logo_url: sc?.logo_url as string | null,
    motto: sc?.motto as string | null,
    address: sc?.address as string | null,
  };

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'My Portal' }, { label: 'My ID Card' }]} />

      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          <CreditCard className="mr-2 inline-block h-6 w-6 text-blue-600" />
          My ID Card
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Your school identification card.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
        </div>
      ) : !student ? (
        <Card className="p-12 text-center">
          <CreditCard className="mx-auto mb-3 h-12 w-12 text-slate-300" />
          <h3 className="text-lg font-semibold text-slate-600">No ID card assigned</h3>
          <p className="mt-1 text-sm text-slate-400">
            Your ID card has not been issued yet. Contact your school administration.
          </p>
        </Card>
      ) : (
        <div className="mx-auto max-w-md space-y-6">
          {/* Front — scaled up from the 220px print base so it reads on a phone */}
          <div className="flex justify-center">
            <StudentIdCard
              design={designJson}
              student={cardStudent}
              school={cardSchool}
              scale={1.55}
            />
          </div>

          {/* Back */}
          <div className="flex justify-center">
            <StudentIdCardBack design={designJson} school={cardSchool} scale={1.55} />
          </div>

          <Card className="p-4">
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Card Information</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-slate-400">Status</p>
                <p className="font-medium capitalize text-slate-700">
                  {(c?.status as string) || 'Not Issued'}
                </p>
              </div>
              <div>
                <p className="text-slate-400">Card Type</p>
                <p className="font-medium text-slate-700">
                  {c?.nfc_chip_id || c?.nfc_uid ? 'NFC Enabled' : 'Digital Only'}
                </p>
              </div>
              <div>
                <p className="text-slate-400">Registration #</p>
                <p className="font-mono font-medium text-slate-700">
                  {cardStudent.registration_number || '—'}
                </p>
              </div>
              <div>
                <p className="text-slate-400">Valid Until</p>
                <p className="font-medium text-slate-700">
                  {c?.valid_until
                    ? new Date(c.valid_until as string).toLocaleDateString()
                    : c?.expiry_date
                      ? new Date(c.expiry_date as string).toLocaleDateString()
                      : 'End of Year'}
                </p>
              </div>
            </div>
          </Card>

          {!designJson && (
            <p className="text-center text-xs leading-relaxed text-slate-400">
              Your school has not published a card design yet, so this shows the default layout.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
