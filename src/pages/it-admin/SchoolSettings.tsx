import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch } from '@/hooks/useFetch';
import { registrarService } from '@/services/registrarService';
import type { SchoolSetting } from '@/types/application.types';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Dialog, { DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/Dialog';
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
  ArrowRight,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

const MONTHS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

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
        description: 'Password assigned to new staff accounts. Share with the new staff member — they should change it after first login.',
        type: 'password',
        icon: Shield,
        placeholder: 'e.g., Staff@2025',
      },
      {
        key: 'default_student_password',
        label: 'Default Student Password',
        description: 'Password assigned to new student accounts when accepted. Students log in with their registration number and this password.',
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
  const [showCloseYear, setShowCloseYear] = useState(false);
  const [closingYear, setClosingYear] = useState(false);

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

  const closeYear = async () => {
    const next = values['next_academic_year']?.trim();
    if (!next) return;
    setClosingYear(true);
    try {
      await registrarService.upsertSetting(schoolId, 'current_academic_year', next);
      await registrarService.upsertSetting(schoolId, 'next_academic_year', '');
      setValues((prev) => ({ ...prev, current_academic_year: next, next_academic_year: '' }));
      setShowCloseYear(false);
    } catch (err) {
      console.error('Failed to close year:', err);
      alert('Failed to close academic year');
    } finally {
      setClosingYear(false);
    }
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

      {/* Academic Year Management */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-900">Academic Year Management</h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCloseYear(true)}
            disabled={!values['next_academic_year']?.trim()}
            title={!values['next_academic_year']?.trim() ? 'Set Next Academic Year first' : 'Close current year and open the next'}
            className="text-amber-600 border-amber-300 hover:bg-amber-50"
          >
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Close Current Year
          </Button>
        </div>

        <div className="space-y-6">
          {/* Current Academic Year */}
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-slate-400" />
                <label className="text-sm font-medium text-slate-700">Current Academic Year</label>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 ml-6">
                The active year for enrollments, fees, and class records (e.g. <strong>2025-2026</strong>).
                In Liberia this runs <strong>September → June</strong>.
              </p>
            </div>
            <div className="flex items-center gap-2 sm:w-80">
              <Input
                type="text"
                value={values['current_academic_year'] ?? ''}
                onChange={(e) => setValues({ ...values, current_academic_year: e.target.value })}
                placeholder="e.g. 2025-2026"
                className="flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                loading={saving === 'current_academic_year'}
                onClick={() => handleSave('current_academic_year')}
                className="shrink-0"
              >
                {saved === 'current_academic_year' ? (
                  <><Check className="h-4 w-4 mr-1 text-emerald-600" /> Saved</>
                ) : (
                  <><Save className="h-4 w-4 mr-1" /> Save</>
                )}
              </Button>
            </div>
          </div>

          {/* Next Academic Year */}
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-400" />
                <label className="text-sm font-medium text-slate-700">Next Academic Year</label>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 ml-6">
                Target year for promotions (e.g. <strong>2026-2027</strong>).
                Set this before the Registrar runs year-end promotions. Click <em>Close Current Year</em> when ready to open it.
              </p>
            </div>
            <div className="flex items-center gap-2 sm:w-80">
              <Input
                type="text"
                value={values['next_academic_year'] ?? ''}
                onChange={(e) => setValues({ ...values, next_academic_year: e.target.value })}
                placeholder="e.g. 2026-2027"
                className="flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                loading={saving === 'next_academic_year'}
                onClick={() => handleSave('next_academic_year')}
                className="shrink-0"
              >
                {saved === 'next_academic_year' ? (
                  <><Check className="h-4 w-4 mr-1 text-emerald-600" /> Saved</>
                ) : (
                  <><Save className="h-4 w-4 mr-1" /> Save</>
                )}
              </Button>
            </div>
          </div>

          {/* Year Start & End Months */}
          <div className="border-t border-slate-100 pt-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-4 w-4 text-slate-400" />
                <label className="text-sm font-medium text-slate-700">Year Start Month</label>
              </div>
              <p className="text-xs text-slate-400 mb-2">Month the academic year begins (Liberia: September).</p>
              <div className="flex items-center gap-2">
                <Select
                  options={MONTHS}
                  value={values['academic_year_start_month'] ?? '9'}
                  onChange={(e) => setValues({ ...values, academic_year_start_month: e.target.value })}
                  placeholder="Select month"
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  loading={saving === 'academic_year_start_month'}
                  onClick={() => handleSave('academic_year_start_month')}
                  className="shrink-0"
                >
                  {saved === 'academic_year_start_month' ? (
                    <><Check className="h-4 w-4 mr-1 text-emerald-600" /> Saved</>
                  ) : (
                    <><Save className="h-4 w-4 mr-1" /> Save</>
                  )}
                </Button>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-4 w-4 text-slate-400" />
                <label className="text-sm font-medium text-slate-700">Year End Month</label>
              </div>
              <p className="text-xs text-slate-400 mb-2">Month the academic year closes (Liberia: June).</p>
              <div className="flex items-center gap-2">
                <Select
                  options={MONTHS}
                  value={values['academic_year_end_month'] ?? '6'}
                  onChange={(e) => setValues({ ...values, academic_year_end_month: e.target.value })}
                  placeholder="Select month"
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  loading={saving === 'academic_year_end_month'}
                  onClick={() => handleSave('academic_year_end_month')}
                  className="shrink-0"
                >
                  {saved === 'academic_year_end_month' ? (
                    <><Check className="h-4 w-4 mr-1 text-emerald-600" /> Saved</>
                  ) : (
                    <><Save className="h-4 w-4 mr-1" /> Save</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Close Year Confirmation Dialog */}
      {showCloseYear && (
        <Dialog open onClose={() => setShowCloseYear(false)} className="max-w-md">
          <DialogHeader>
            <DialogTitle>Close Academic Year?</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <p className="text-sm text-slate-600">
              This will close <strong>{values['current_academic_year']}</strong> and open{' '}
              <strong>{values['next_academic_year']}</strong> as the new current year.
            </p>
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700 space-y-1">
              <p className="font-medium">Before closing, make sure:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>All year-end promotions have been processed by the Registrar</li>
                <li>All promoted students have been assigned to a class</li>
                <li>Graduation ceremony has been completed</li>
              </ul>
            </div>
            <p className="text-xs text-slate-400">
              New enrollments, fee structures, and class assignments will reference <strong>{values['next_academic_year']}</strong> going forward.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCloseYear(false)}>Cancel</Button>
            <Button
              loading={closingYear}
              onClick={closeYear}
              className="bg-amber-600 hover:bg-amber-700 text-white border-0"
            >
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Close {values['current_academic_year']} &amp; Open {values['next_academic_year']}
            </Button>
          </DialogFooter>
        </Dialog>
      )}

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
