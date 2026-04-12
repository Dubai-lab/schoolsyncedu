import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { registrarService } from '@/services/registrarService';
import type { SchoolSetting } from '@/types/application.types';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Breadcrumb from '@/components/shared/Breadcrumb';
import {
  Settings,
  Key,
  Shield,
  Save,
  Check,
  Globe,
  DollarSign,
  Calendar,
  Eye,
  EyeOff,
} from 'lucide-react';

// ==================== SETTINGS GROUPS ====================

interface SettingField {
  key: string;
  label: string;
  description: string;
  type: 'text' | 'number' | 'password' | 'toggle';
  icon: React.ElementType;
  placeholder?: string;
}

const settingsGroups: { title: string; icon: React.ElementType; fields: SettingField[] }[] = [
  {
    title: 'Default Passwords',
    icon: Key,
    fields: [
      {
        key: 'default_staff_password',
        label: 'Default Staff Password',
        description: 'Password assigned to new staff accounts. IT Admin shares this with the new staff member. They should change it after first login.',
        type: 'password',
        icon: Shield,
        placeholder: 'e.g., Staff@2025',
      },
      {
        key: 'default_student_password',
        label: 'Default Student Password',
        description: 'Password assigned to new student accounts when accepted. Students can change it after first login.',
        type: 'password',
        icon: Shield,
        placeholder: 'e.g., Welcome@2025',
      },
      {
        key: 'default_parent_password',
        label: 'Default Parent Password',
        description: 'Password assigned to new parent accounts created from student applications.',
        type: 'password',
        icon: Shield,
        placeholder: 'e.g., Parent@2025',
      },
    ],
  },
  {
    title: 'Admissions Settings',
    icon: Globe,
    fields: [
      {
        key: 'accepting_applications',
        label: 'Accept Applications',
        description: 'Enable or disable online applications on the school website.',
        type: 'toggle',
        icon: Globe,
      },
      {
        key: 'application_fee_usd',
        label: 'Application Fee (USD)',
        description: 'Fee charged for student applications. Set to 0 for free applications.',
        type: 'number',
        icon: DollarSign,
        placeholder: '0.00',
      },
      {
        key: 'current_academic_year',
        label: 'Current Academic Year',
        description: 'The active academic year for new enrollments.',
        type: 'text',
        icon: Calendar,
        placeholder: '2025-2026',
      },
    ],
  },
];

// ==================== COMPONENT ====================

export default function SchoolSettingsPage() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  // Load all settings
  const { data: settings, isLoading } = useFetch(
    ['school-settings', schoolId],
    () => registrarService.getAllSettings(schoolId),
    { enabled: !!schoolId },
  );

  // Populate form values when data loads
  useEffect(() => {
    if (settings) {
      const map: Record<string, string> = {};
      settings.forEach((s: SchoolSetting) => {
        map[s.setting_key] = s.setting_value;
      });
      setValues(map);
    }
  }, [settings]);

  const handleSave = async (key: string) => {
    const value = values[key] ?? '';
    setSaving(key);
    try {
      await registrarService.upsertSetting(schoolId, key, value);
      setSaved(key);
      setTimeout(() => setSaved(null), 2000);
    } catch (err) {
      console.error('Failed to save setting:', err);
      alert('Failed to save setting');
    } finally {
      setSaving(null);
    }
  };

  const togglePassword = (key: string) => {
    setShowPasswords((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Breadcrumb items={[{ label: 'IT Admin', href: '/it-admin' }, { label: 'School Settings' }]} />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'IT Admin', href: '/it-admin' }, { label: 'School Settings' }]} />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          <Settings className="inline-block h-6 w-6 mr-2 text-blue-600" />
          School Settings
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Configure default passwords, admissions settings, and system preferences.
        </p>
      </div>

      {/* Settings Groups */}
      {settingsGroups.map((group) => (
        <Card key={group.title} className="p-6">
          <div className="flex items-center gap-2 mb-5">
            <group.icon className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-900">{group.title}</h2>
          </div>

          <div className="space-y-6">
            {group.fields.map((field) => (
              <div key={field.key} className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <field.icon className="h-4 w-4 text-slate-400" />
                    <label className="text-sm font-medium text-slate-700">{field.label}</label>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 ml-6">{field.description}</p>
                </div>

                <div className="flex items-center gap-2 sm:w-80">
                  {field.type === 'toggle' ? (
                    <button
                      onClick={() => {
                        const current = values[field.key] ?? 'false';
                        const newVal = current === 'true' ? 'false' : 'true';
                        setValues({ ...values, [field.key]: newVal });
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        values[field.key] === 'true' ? 'bg-primary-600' : 'bg-slate-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          values[field.key] === 'true' ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  ) : field.type === 'password' ? (
                    <div className="relative flex-1">
                      <input
                        type={showPasswords[field.key] ? 'text' : 'password'}
                        value={values[field.key] ?? ''}
                        onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                        placeholder={field.placeholder}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-10 text-sm text-slate-700 placeholder:text-slate-400 focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-100"
                      />
                      <button
                        type="button"
                        onClick={() => togglePassword(field.key)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPasswords[field.key] ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  ) : (
                    <Input
                      type={field.type}
                      value={values[field.key] ?? ''}
                      onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                      placeholder={field.placeholder}
                      className="flex-1"
                    />
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    loading={saving === field.key}
                    onClick={() => handleSave(field.key)}
                    className="shrink-0"
                  >
                    {saved === field.key ? (
                      <><Check className="h-4 w-4 mr-1 text-emerald-600" /> Saved</>
                    ) : (
                      <><Save className="h-4 w-4 mr-1" /> Save</>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}

      {/* Info box */}
      <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-800">About Default Passwords</p>
            <p className="text-xs text-blue-600 mt-1">
              <strong>Staff:</strong> When you create a staff account the default staff password is used automatically.
              Share the login credentials with the new staff member so they can log in and change their password.
            </p>
            <p className="text-xs text-blue-600 mt-1">
              <strong>Students &amp; Parents:</strong> Default passwords are assigned when the Registrar accepts a student application.
              The system creates user accounts for both the student and their primary guardian.
              Students log in with their registration number and this default password.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
