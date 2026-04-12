import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { proprietorSchoolService, proprietorITAdminService } from '@/services/proprietorService';
import type { School } from '@/types/school.types';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { notify } from '@/components/shared/Toast';
import {
  Building2,
  Monitor,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Palette,
  Upload,
  Shield,
} from 'lucide-react';

type Step = 1 | 2 | 3;

const STEPS = [
  { step: 1, label: 'School Branding', icon: Palette },
  { step: 2, label: 'Create IT Admin', icon: Monitor },
  { step: 3, label: 'All Done', icon: CheckCircle },
] as const;

export default function OnboardingWizard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const schoolId = user?.school_id ?? '';

  const [step, setStep] = useState<Step>(1);

  // ---------- Step 1: school branding ----------
  const { data: school } = useFetch<School>(
    ['onboard-school', schoolId],
    () => proprietorSchoolService.getSchool(schoolId),
    { enabled: !!schoolId },
  );

  const [brandForm, setBrandForm] = useState({
    motto: '',
    logo_url: '',
    primary_color: '#1e40af',
    secondary_color: '#f59e0b',
    website: '',
  });

  // Populate form once school data loads
  useState(() => {
    if (school) {
      setBrandForm({
        motto: school.motto ?? '',
        logo_url: school.logo_url ?? '',
        primary_color: school.primary_color ?? '#1e40af',
        secondary_color: school.secondary_color ?? '#f59e0b',
        website: school.website ?? '',
      });
    }
  });

  // Re-set form when school loads (useEffect substitute via useFetch callback)
  if (school && !brandForm.motto && school.motto) {
    setBrandForm({
      motto: school.motto ?? '',
      logo_url: school.logo_url ?? '',
      primary_color: school.primary_color ?? '#1e40af',
      secondary_color: school.secondary_color ?? '#f59e0b',
      website: school.website ?? '',
    });
  }

  const updateSchool = useMutate(
    (p: Partial<School>) => proprietorSchoolService.updateSchool(schoolId, p),
    [['onboard-school']],
  );

  // ---------- Step 2: IT admin ----------
  const [adminForm, setAdminForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    password: '',
  });

  const { data: hasAdmin = false, refetch: recheckAdmin } = useFetch<boolean>(
    ['onboard-has-admin', schoolId],
    () => proprietorITAdminService.hasITAdmin(schoolId),
    { enabled: !!schoolId },
  );

  const createAdmin = useMutate(
    () => proprietorITAdminService.createITAdmin(schoolId, {
      email: adminForm.email,
      password: adminForm.password,
      first_name: adminForm.first_name,
      last_name: adminForm.last_name,
      phone: adminForm.phone || undefined,
    }),
    [['onboard-has-admin'], ['prop-it-admins']],
  );

  // ---------- Step handlers ----------
  function handleBrandingSave() {
    const payload: Partial<School> = {};
    if (brandForm.motto) payload.motto = brandForm.motto;
    if (brandForm.logo_url) payload.logo_url = brandForm.logo_url;
    if (brandForm.primary_color) payload.primary_color = brandForm.primary_color;
    if (brandForm.secondary_color) payload.secondary_color = brandForm.secondary_color;
    if (brandForm.website) payload.website = brandForm.website;

    if (Object.keys(payload).length === 0) {
      setStep(2);
      return;
    }

    updateSchool.mutate(payload, {
      onSuccess: () => {
        notify.success('Branding saved');
        setStep(2);
      },
      onError: () => notify.error('Failed to save branding'),
    });
  }

  function handleCreateAdmin() {
    if (!adminForm.first_name.trim() || !adminForm.last_name.trim() || !adminForm.email.trim()) return;
    if (adminForm.password.length < 8) {
      notify.error('Password must be at least 8 characters');
      return;
    }

    createAdmin.mutate(undefined, {
      onSuccess: () => {
        notify.success('IT Admin created successfully!');
        recheckAdmin();
        setStep(3);
      },
      onError: () => notify.error('Failed to create IT Admin'),
    });
  }

  function handleFinish() {
    navigate('/proprietor');
  }

  return (
    <div className="min-h-[80vh] flex items-start justify-center pt-8">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-100 text-primary-600 mb-4">
            <Building2 className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Set Up Your School
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Let's get your school system ready in just a few steps.
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2">
          {STEPS.map(({ step: s, label, icon: Icon }) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                s === step
                  ? 'bg-primary-100 text-primary-700'
                  : s < step
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-400'
              }`}>
                {s < step ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">{label}</span>
              </div>
              {s < 3 && <ArrowRight className="w-4 h-4 text-gray-300" />}
            </div>
          ))}
        </div>

        {/* STEP 1: School Branding */}
        {step === 1 && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              School Branding
            </h2>
            <p className="text-sm text-gray-500 mb-5">
              Customize how your school appears across the system. You can always update this later in Settings.
            </p>
            <div className="space-y-4">
              <Input
                label="School Motto"
                value={brandForm.motto}
                onChange={(e) => setBrandForm((f) => ({ ...f, motto: e.target.value }))}
                placeholder="Knowledge is Power"
              />
              <Input
                label="Logo URL"
                value={brandForm.logo_url}
                onChange={(e) => setBrandForm((f) => ({ ...f, logo_url: e.target.value }))}
                placeholder="https://example.com/logo.png"
                icon={<Upload className="w-4 h-4" />}
              />
              <Input
                label="School Website"
                value={brandForm.website}
                onChange={(e) => setBrandForm((f) => ({ ...f, website: e.target.value }))}
                placeholder="https://myschool.edu.lr"
              />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Primary Color
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={brandForm.primary_color}
                      onChange={(e) => setBrandForm((f) => ({ ...f, primary_color: e.target.value }))}
                      className="h-10 w-14 cursor-pointer rounded border border-gray-300"
                    />
                    <span className="text-sm text-gray-500">{brandForm.primary_color}</span>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Secondary Color
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={brandForm.secondary_color}
                      onChange={(e) => setBrandForm((f) => ({ ...f, secondary_color: e.target.value }))}
                      className="h-10 w-14 cursor-pointer rounded border border-gray-300"
                    />
                    <span className="text-sm text-gray-500">{brandForm.secondary_color}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-between">
              <Button variant="ghost" onClick={() => navigate('/proprietor')}>
                Skip for now
              </Button>
              <Button onClick={handleBrandingSave} loading={updateSchool.isPending}>
                Save & Continue <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </Card>
        )}

        {/* STEP 2: Create IT Admin */}
        {step === 2 && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              Create Your IT Admin
            </h2>
            <p className="text-sm text-gray-500 mb-5">
              This person will manage your entire school system — creating staff, configuring classes, managing ID cards, and more.
              You only need to create this one account.
            </p>

            {hasAdmin ? (
              <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                <Shield className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-800">IT Admin already exists</p>
                  <p className="text-xs text-green-600 mt-0.5">Your school already has an active IT Admin. You can manage them from the IT Admin Setup page.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="First Name"
                    value={adminForm.first_name}
                    onChange={(e) => setAdminForm((f) => ({ ...f, first_name: e.target.value }))}
                    placeholder="First name"
                    required
                  />
                  <Input
                    label="Last Name"
                    value={adminForm.last_name}
                    onChange={(e) => setAdminForm((f) => ({ ...f, last_name: e.target.value }))}
                    placeholder="Last name"
                    required
                  />
                </div>
                <Input
                  label="Email Address"
                  type="email"
                  value={adminForm.email}
                  onChange={(e) => setAdminForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="admin@school.edu"
                  hint="This will be their login email."
                  required
                />
                <Input
                  label="Phone Number"
                  type="tel"
                  value={adminForm.phone}
                  onChange={(e) => setAdminForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+231 XXX XXX XXXX"
                />
                <Input
                  label="Temporary Password"
                  type="password"
                  value={adminForm.password}
                  onChange={(e) => setAdminForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="Min. 8 characters"
                  hint="The IT Admin will use this password for their first login."
                  required
                />
              </div>
            )}

            <div className="mt-6 flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              {hasAdmin ? (
                <Button onClick={() => setStep(3)}>
                  Continue <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setStep(3)}>
                    Skip
                  </Button>
                  <Button
                    onClick={handleCreateAdmin}
                    loading={createAdmin.isPending}
                    disabled={!adminForm.first_name.trim() || !adminForm.last_name.trim() || !adminForm.email.trim() || adminForm.password.length < 8}
                  >
                    Create IT Admin <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* STEP 3: Done! */}
        {step === 3 && (
          <Card className="p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600 mb-4">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              You're all set!
            </h2>
            <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
              Your school is configured and ready. Your IT Admin can now sign in and start
              setting up the rest of the system — creating staff accounts, configuring classes,
              managing student records, and more.
            </p>

            <div className="mt-6 rounded-lg bg-gray-50 p-4 text-left max-w-sm mx-auto">
              <h3 className="text-sm font-semibold text-gray-800 mb-2">What happens next:</h3>
              <ol className="text-sm text-gray-600 space-y-1.5 list-decimal list-inside">
                <li>IT Admin logs in with their email</li>
                <li>They create all staff accounts (principal, teachers, bursar, etc.)</li>
                <li>Staff begin using the system for their roles</li>
                <li>You monitor everything from your dashboard</li>
              </ol>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="outline" onClick={() => navigate('/proprietor/it-admin')}>
                <Monitor className="w-4 h-4 mr-1" /> Manage IT Admin
              </Button>
              <Button onClick={handleFinish}>
                Go to Dashboard <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
