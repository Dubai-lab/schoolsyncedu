import { useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { itAdminSiteService } from '@/services/itAdminService';
import { uploadSchoolSiteImage } from '@/utils/storage.upload';
import type { School, SiteConfig, AuthPageConfig } from '@/types/school.types';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { notify } from '@/components/shared/Toast';
import {
  Save,
  Loader2,
  ExternalLink,
  Palette,
  Type,
  Image,
  Upload,
  Trash2,
  Plus,
  Eye,
  Megaphone,
  KeyRound,
  GraduationCap,
  LogIn,
  MessageSquare,
} from 'lucide-react';

export default function AuthPageDesigner() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const { data: school, isLoading } = useFetch<School>(
    ['auth-page-school', schoolId],
    () => itAdminSiteService.getSchool(schoolId),
    { enabled: !!schoolId },
  );

  const existingConfig: SiteConfig = school?.site_config ?? {};
  const saved: AuthPageConfig = existingConfig.auth_page ?? {};

  const [draft, setDraft] = useState<AuthPageConfig | null>(null);
  const [touched, setTouched] = useState(false);
  const auth = draft ?? saved;

  const update = (partial: Partial<AuthPageConfig>) => {
    setDraft((prev) => ({ ...(prev ?? saved), ...partial }));
    setTouched(true);
  };

  // Feature helpers
  const features = auth.features ?? [];
  const updateFeature = (idx: number, partial: Partial<{ label: string; description: string }>) => {
    const next = [...features];
    next[idx] = { ...next[idx], ...partial };
    update({ features: next });
  };
  const addFeature = () => {
    if (features.length >= 4) return;
    update({ features: [...features, { label: '', description: '' }] });
  };
  const removeFeature = (idx: number) => {
    update({ features: features.filter((_, i) => i !== idx) });
  };

  // Background image upload
  const bgInputRef = useRef<HTMLInputElement>(null);
  const [bgUploading, setBgUploading] = useState(false);
  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !schoolId) return;
    setBgUploading(true);
    try {
      const url = await uploadSchoolSiteImage(schoolId, file, 'auth-bg');
      update({ background_image_url: url });
      notify.success('Background image uploaded');
    } catch (err: any) {
      notify.error(err?.message ?? 'Upload failed');
    } finally {
      setBgUploading(false);
      if (bgInputRef.current) bgInputRef.current.value = '';
    }
  };

  // Save
  const updateMutation = useMutate(
    (payload: Partial<School>) => itAdminSiteService.updateSchool(schoolId, payload),
    [['auth-page-school', schoolId]],
  );

  const handleSave = () => {
    if (!touched || !draft) return;
    const payload: Partial<School> = {
      site_config: { ...existingConfig, auth_page: draft } as SiteConfig,
    };
    updateMutation.mutate(payload, {
      onSuccess: () => {
        notify.success('Login page saved');
        setTouched(false);
      },
      onError: () => notify.error('Failed to save'),
    });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
      </div>
    );
  }

  const primary = school?.primary_color || '#1e40af';
  const accentColor = auth.accent_color || primary;

  return (
    <div className="space-y-6 pb-24">
      <Breadcrumb
        items={[
          { label: 'School Website', href: '/it-admin/site' },
          { label: 'Login Page Designer' },
        ]}
      />

      {/* Top bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <KeyRound className="h-6 w-6 text-blue-600" />
            Login Page Designer
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Customize the login page your staff, teachers and students see at{' '}
            <code className="rounded bg-gray-100 px-1 py-0.5 text-xs font-mono">/school/{school?.slug}/login</code>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {school?.slug && (
            <a
              href={`/school/${school.slug}/login`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <ExternalLink className="h-4 w-4" /> Preview
            </a>
          )}
          <Button onClick={handleSave} disabled={!touched || updateMutation.isPending}>
            {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Save
          </Button>
        </div>
      </div>

      {/* ===== TEXT & MESSAGING ===== */}
      <Card>
        <div className="border-b border-gray-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Type className="h-4 w-4 text-blue-500" /> Text & Messaging
          </h2>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Input
            label="Welcome Heading"
            placeholder={`Welcome to ${school?.name ?? 'School'}`}
            value={auth.welcome_heading ?? ''}
            onChange={(e) => update({ welcome_heading: e.target.value })}
          />
          <Input
            label="Subtitle"
            placeholder="Sign in to access your school portal"
            value={auth.welcome_subtext ?? ''}
            onChange={(e) => update({ welcome_subtext: e.target.value })}
          />
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              <span className="flex items-center gap-1.5">
                <Megaphone className="h-3.5 w-3.5 text-amber-500" />
                Announcement Banner
              </span>
            </label>
            <textarea
              rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="e.g. School reopens January 15th. All staff must report by 8 AM."
              value={auth.announcement ?? ''}
              onChange={(e) => update({ announcement: e.target.value })}
            />
            <p className="mt-1 text-xs text-gray-400">Leave empty to hide the banner. Great for important notices visible before login.</p>
          </div>
          <Input
            label="Footer Text"
            placeholder={`© ${new Date().getFullYear()} ${school?.name ?? 'School'}`}
            value={auth.footer_text ?? ''}
            onChange={(e) => update({ footer_text: e.target.value })}
          />
        </div>
      </Card>

      {/* ===== COLORS & BACKGROUND ===== */}
      <Card>
        <div className="border-b border-gray-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Palette className="h-4 w-4 text-purple-500" /> Colors & Background
          </h2>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Accent / Button Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                className="h-10 w-14 cursor-pointer rounded border border-gray-200"
                value={accentColor}
                onChange={(e) => update({ accent_color: e.target.value })}
              />
              <input
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono"
                value={auth.accent_color ?? ''}
                placeholder={primary}
                onChange={(e) => update({ accent_color: e.target.value })}
              />
              <button
                className="text-xs text-gray-400 hover:text-gray-600"
                onClick={() => update({ accent_color: undefined })}
              >
                Reset
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-400">Defaults to your school's primary color</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Panel Background Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                className="h-10 w-14 cursor-pointer rounded border border-gray-200"
                value={auth.background_color || primary}
                onChange={(e) => update({ background_color: e.target.value })}
              />
              <input
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono"
                value={auth.background_color ?? ''}
                placeholder={primary}
                onChange={(e) => update({ background_color: e.target.value })}
              />
              <button
                className="text-xs text-gray-400 hover:text-gray-600"
                onClick={() => update({ background_color: undefined })}
              >
                Reset
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-400">Used when no background image is set</p>
          </div>

          {/* Background Image */}
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              <span className="flex items-center gap-1.5">
                <Image className="h-3.5 w-3.5 text-blue-500" />
                Background Image (left panel)
              </span>
            </label>
            {auth.background_image_url ? (
              <div className="relative rounded-lg overflow-hidden border border-gray-200">
                <img
                  src={auth.background_image_url}
                  alt="Auth background"
                  className="h-48 w-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-3 opacity-0 hover:opacity-100 transition-opacity">
                  <button
                    className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow hover:bg-gray-50"
                    onClick={() => bgInputRef.current?.click()}
                  >
                    <Upload className="inline h-4 w-4 mr-1" /> Replace
                  </button>
                  <button
                    className="rounded-lg bg-red-500 px-3 py-2 text-sm font-medium text-white shadow hover:bg-red-600"
                    onClick={() => update({ background_image_url: undefined })}
                  >
                    <Trash2 className="inline h-4 w-4 mr-1" /> Remove
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => bgInputRef.current?.click()}
                disabled={bgUploading}
                className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 py-10 text-sm text-gray-500 hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
              >
                {bgUploading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                ) : (
                  <Upload className="h-5 w-5" />
                )}
                {bgUploading ? 'Uploading...' : 'Upload background image'}
              </button>
            )}
            <input
              ref={bgInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={handleBgUpload}
            />
            <p className="mt-1 text-xs text-gray-400">Recommended: 1200×800+ px. The panel will show a dark overlay for text readability.</p>
          </div>
        </div>
      </Card>

      {/* ===== FEATURE CARDS ===== */}
      <Card>
        <div className="border-b border-gray-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-green-500" /> Feature Cards
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">Shown on the left branding panel (max 4)</p>
        </div>
        <div className="p-5 space-y-3">
          {features.map((f, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="flex-1 grid gap-2 sm:grid-cols-2">
                <input
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="Feature label"
                  value={f.label}
                  onChange={(e) => updateFeature(i, { label: e.target.value })}
                />
                <input
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="Short description"
                  value={f.description}
                  onChange={(e) => updateFeature(i, { description: e.target.value })}
                />
              </div>
              <button
                className="mt-1 rounded p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600"
                onClick={() => removeFeature(i)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {features.length < 4 && (
            <button
              className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800"
              onClick={addFeature}
            >
              <Plus className="h-4 w-4" /> Add feature card
            </button>
          )}
          {features.length === 0 && (
            <p className="text-xs text-gray-400">No custom features — the page will show default cards (Grades, Attendance, Fees, Communication).</p>
          )}
        </div>
      </Card>

      {/* ===== OPTIONS ===== */}
      <Card>
        <div className="border-b border-gray-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <LogIn className="h-4 w-4 text-indigo-500" /> Login Options
          </h2>
        </div>
        <div className="p-5 space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              checked={auth.show_student_login !== false}
              onChange={(e) => update({ show_student_login: e.target.checked })}
            />
            <div>
              <span className="text-sm font-medium text-gray-700">Show student login link</span>
              <p className="text-xs text-gray-400">Displays "Sign in with registration number" below the form</p>
            </div>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              checked={auth.show_forgot_password !== false}
              onChange={(e) => update({ show_forgot_password: e.target.checked })}
            />
            <div>
              <span className="text-sm font-medium text-gray-700">Show "Forgot password?" link</span>
              <p className="text-xs text-gray-400">Displays the password recovery link on the form</p>
            </div>
          </label>
        </div>
      </Card>

      {/* ===== LIVE PREVIEW (mini) ===== */}
      <Card>
        <div className="border-b border-gray-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Eye className="h-4 w-4 text-amber-500" /> Preview
          </h2>
        </div>
        <div className="p-5">
          <div className="flex rounded-xl border border-gray-200 overflow-hidden h-80">
            {/* Mini left panel */}
            <div
              className="hidden sm:flex w-1/2 relative overflow-hidden"
              style={{
                background: auth.background_image_url
                  ? `url(${auth.background_image_url}) center/cover no-repeat`
                  : `linear-gradient(135deg, ${auth.background_color || primary} 0%, ${auth.background_color || primary}cc 100%)`,
              }}
            >
              {auth.background_image_url && <div className="absolute inset-0 bg-black/50" />}
              <div className="relative z-10 flex flex-col justify-between p-6 text-white w-full">
                <div className="flex items-center gap-2">
                  {school?.logo_url ? (
                    <img src={school.logo_url} alt="" className="h-8 w-8 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
                      <GraduationCap className="h-4 w-4" />
                    </div>
                  )}
                  <span className="text-sm font-bold truncate">{school?.name}</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold leading-tight">
                    {auth.welcome_heading || `Welcome to ${school?.name}`}
                  </h3>
                  {(auth.welcome_subtext || 'Sign in to access your portal') && (
                    <p className="mt-1 text-xs text-white/60">{auth.welcome_subtext || 'Sign in to access your school portal'}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(features.length > 0 ? features : [
                    { label: 'Grades', description: 'Performance' },
                    { label: 'Attendance', description: 'Daily tracking' },
                  ]).slice(0, 2).map((f) => (
                    <div key={f.label} className="rounded-lg border border-white/10 bg-white/5 p-2">
                      <p className="text-[10px] font-semibold">{f.label || 'Feature'}</p>
                      <p className="text-[8px] text-white/40">{f.description || 'Description'}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* Mini right panel */}
            <div className="flex w-full sm:w-1/2 flex-col items-center justify-center bg-slate-50 p-6">
              {auth.announcement && (
                <div
                  className="mb-3 w-full rounded-md px-2 py-1.5 text-[9px] flex items-center gap-1"
                  style={{ backgroundColor: accentColor + '10', color: accentColor }}
                >
                  <Megaphone className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate">{auth.announcement}</span>
                </div>
              )}
              <div className="w-full space-y-2.5">
                <div className="h-3 w-20 rounded bg-gray-200" />
                <div className="h-2 w-32 rounded bg-gray-100" />
                <div className="h-8 w-full rounded-md border border-gray-200 bg-white" />
                <div className="h-8 w-full rounded-md border border-gray-200 bg-white" />
                <div
                  className="flex h-8 w-full items-center justify-center rounded-md text-[10px] font-semibold text-white"
                  style={{ backgroundColor: accentColor }}
                >
                  Sign in
                </div>
              </div>
              <p className="mt-3 text-[8px] text-gray-300">Powered by SchoolSync</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Sticky save bar */}
      {touched && (
        <div className="fixed bottom-0 inset-x-0 z-50 border-t border-gray-200 bg-white/95 px-6 py-3 shadow-lg backdrop-blur-sm">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <p className="text-sm text-gray-500">You have unsaved changes</p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => { setDraft(null); setTouched(false); }}
              >
                Discard
              </Button>
              <Button onClick={handleSave} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
