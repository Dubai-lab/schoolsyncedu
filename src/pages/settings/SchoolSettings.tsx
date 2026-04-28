import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { schoolSettingsService } from '@/services/settingsService';
import type { School } from '@/types/school.types';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { notify } from '@/components/shared/Toast';
import { Save, Building2 } from 'lucide-react';

export default function SchoolSettings() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const { data: school, isLoading } = useFetch<School>(
    ['school-settings', schoolId],
    () => schoolSettingsService.get(schoolId),
    { enabled: !!schoolId }
  );

  const [form, setForm] = useState<Partial<School>>({});
  const [errors, setErrors] = useState<Partial<Record<keyof School, string>>>({});
  const merged = { ...school, ...form } as School | undefined;

  const updateMutation = useMutate(
    (payload: Partial<School>) => schoolSettingsService.update(schoolId, payload),
    [['school-settings', schoolId]]
  );

  const set = (field: keyof School, value: string) => {
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof School, string>> = {};
    const code = (merged?.school_code ?? '').trim();
    if (code.length > 3) next.school_code = 'School code must be 3 characters or fewer (e.g. NCA).';
    if (code.length === 0 && 'school_code' in form) next.school_code = 'School code is required.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = () => {
    if (!Object.keys(form).length) return;
    if (!validate()) return;
    updateMutation.mutate(form, {
      onSuccess: () => {
        notify.success('School settings updated');
        setForm({});
        setErrors({});
      },
      onError: () => notify.error('Failed to update settings'),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Settings', href: '/settings' }, { label: 'School Settings' }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">School Settings</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage your school's profile information and branding.
          </p>
        </div>
        <Button onClick={handleSave} loading={updateMutation.isPending} disabled={!Object.keys(form).length}>
          <Save className="w-4 h-4 mr-2" />
          Save Changes
        </Button>
      </div>

      {/* General Info */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-5 h-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">General Information</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="School Name"
            value={merged?.name ?? ''}
            onChange={(e) => set('name', e.target.value)}
          />
          <Input
            label="School Code"
            value={merged?.school_code ?? ''}
            onChange={(e) => set('school_code', e.target.value.toUpperCase())}
            maxLength={3}
            hint="3 characters max (e.g. NCA)"
            error={errors.school_code}
          />
          <Input
            label="MOE Registration Number"
            value={merged?.moe_registration_number ?? ''}
            onChange={(e) => set('moe_registration_number', e.target.value)}
          />
          <Input
            label="Location"
            value={merged?.location ?? ''}
            onChange={(e) => set('location', e.target.value)}
          />
          <Input
            label="Address"
            value={merged?.address ?? ''}
            onChange={(e) => set('address', e.target.value)}
          />
          <Input
            label="Phone"
            value={merged?.phone ?? ''}
            onChange={(e) => set('phone', e.target.value)}
          />
          <Input
            label="Website"
            value={merged?.website ?? ''}
            onChange={(e) => set('website', e.target.value)}
          />
          <Input
            label="Motto"
            value={merged?.motto ?? ''}
            onChange={(e) => set('motto', e.target.value)}
          />
        </div>
      </Card>

      {/* Leadership */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Leadership</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Principal Name"
            value={merged?.principal_name ?? ''}
            onChange={(e) => set('principal_name', e.target.value)}
          />
          <Input
            label="Principal Email"
            type="email"
            value={merged?.principal_email ?? ''}
            onChange={(e) => set('principal_email', e.target.value)}
          />
          <Input
            label="Proprietor Name"
            value={merged?.proprietor_name ?? ''}
            onChange={(e) => set('proprietor_name', e.target.value)}
          />
          <Input
            label="Proprietor Email"
            type="email"
            value={merged?.proprietor_email ?? ''}
            onChange={(e) => set('proprietor_email', e.target.value)}
          />
        </div>
      </Card>

      {/* Branding */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Branding</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Logo URL"
            value={merged?.logo_url ?? ''}
            onChange={(e) => set('logo_url', e.target.value)}
          />
          <div />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Primary Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={merged?.primary_color ?? '#3b5fe2'}
                onChange={(e) => set('primary_color', e.target.value)}
                className="h-10 w-14 rounded border cursor-pointer"
              />
              <span className="text-sm text-gray-500">{merged?.primary_color ?? '#3b5fe2'}</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Secondary Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={merged?.secondary_color ?? '#f59e0b'}
                onChange={(e) => set('secondary_color', e.target.value)}
                className="h-10 w-14 rounded border cursor-pointer"
              />
              <span className="text-sm text-gray-500">{merged?.secondary_color ?? '#f59e0b'}</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
