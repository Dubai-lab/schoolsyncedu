import { useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { schoolSettingsService } from '@/services/settingsService';
import { uploadSchoolLogo } from '@/utils/storage.upload';
import type { School } from '@/types/school.types';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { notify } from '@/components/shared/Toast';
import SubdomainAddonCard from '@/components/shared/SubdomainAddonCard';
import {
  Save,
  Globe,
  Palette,
  Eye,
  Image,
  Type,
  ExternalLink,
  Upload,
  Loader2,
} from 'lucide-react';

export default function SiteCustomizer() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const { data: school, isLoading, refetch: refetchSchool } = useFetch<School>(
    ['school-site', schoolId],
    () => schoolSettingsService.get(schoolId),
    { enabled: !!schoolId }
  );

  const [form, setForm] = useState<Partial<School>>({});
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const merged = { ...school, ...form } as School | undefined;

  const updateMutation = useMutate(
    (payload: Partial<School>) => schoolSettingsService.update(schoolId, payload),
    [['school-site', schoolId]]
  );

  const set = (field: keyof School, value: string | number | boolean | null) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = () => {
    if (!Object.keys(form).length) return;
    updateMutation.mutate(form, {
      onSuccess: () => {
        notify.success('Site updated successfully');
        setForm({});
      },
      onError: () => notify.error('Failed to update site'),
    });
  };

  const defaultUrl = merged?.slug ? `${window.location.origin}/school/${merged.slug}` : null;
  const subdomainLive =
    merged?.subdomain_active &&
    merged?.subdomain &&
    merged?.subdomain_paid_until &&
    new Date(merged.subdomain_paid_until).getTime() > Date.now() - 24 * 60 * 60 * 1000;
  const siteUrl = subdomainLive
    ? `https://${merged!.subdomain}.schoolsyncedu.com`
    : defaultUrl;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: 'Proprietor', href: '/proprietor' },
          { label: 'Customize School Site' },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">School Website</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Customize your school's public-facing website that parents and visitors see.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {siteUrl && (
            <a
              href={siteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
            >
              <Eye className="h-4 w-4" />
              Preview Site
              <ExternalLink className="h-3 w-3 opacity-50" />
            </a>
          )}
          <Button onClick={handleSave} loading={updateMutation.isPending} disabled={!Object.keys(form).length}>
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Site URL */}
      {siteUrl && (
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5 text-primary-600" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-900 dark:text-white">Your School Website URL</p>
                {subdomainLive && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">Custom Subdomain</span>
                )}
              </div>
              <a
                href={siteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary-600 hover:underline break-all"
              >
                {siteUrl}
              </a>
              {subdomainLive && (
                <p className="mt-1 text-xs text-gray-400">Default URL is hidden. Use the Custom Subdomain control below to revert.</p>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Custom Subdomain Add-on */}
      {school && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-5 h-5 text-primary-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Custom Subdomain</h2>
              <p className="text-sm text-gray-500">Get a professional URL like <span className="font-mono">yourschool.schoolsyncedu.com</span></p>
            </div>
          </div>
          <SubdomainAddonCard school={school} onRefresh={() => refetchSchool()} />
        </Card>
      )}

      {/* Branding */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Palette className="w-5 h-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Branding & Colors</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">School Logo</label>
            <div className="flex items-center gap-4">
              {merged?.logo_url ? (
                <img
                  src={merged.logo_url}
                  alt="School Logo"
                  className="h-16 w-16 rounded-lg object-cover border border-slate-200"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50">
                  <Image className="h-6 w-6 text-slate-300" />
                </div>
              )}
              <div className="flex-1">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !schoolId) return;
                    setLogoUploading(true);
                    try {
                      const url = await uploadSchoolLogo(schoolId, file);
                      set('logo_url', url);
                      notify.success('Logo uploaded');
                    } catch (err) {
                      notify.error(err instanceof Error ? err.message : 'Upload failed');
                    } finally {
                      setLogoUploading(false);
                      e.target.value = '';
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={logoUploading}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  {logoUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {logoUploading ? 'Uploading...' : 'Upload Logo'}
                </button>
                <p className="mt-1 text-xs text-slate-400">PNG, JPG, GIF, WebP, or SVG. Max 2 MB.</p>
              </div>
            </div>
          </div>
          <Input
            label="School Motto"
            placeholder="Excellence in Education"
            value={merged?.motto ?? ''}
            onChange={(e) => set('motto', e.target.value)}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Primary Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={merged?.primary_color ?? '#1e40af'}
                onChange={(e) => set('primary_color', e.target.value)}
                className="h-10 w-14 rounded border cursor-pointer"
              />
              <span className="text-sm text-gray-500">{merged?.primary_color ?? '#1e40af'}</span>
              <span className="text-xs text-gray-400">— navbar, buttons, footer</span>
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
              <span className="text-xs text-gray-400">— accents, CTA buttons</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Hero Section */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Image className="w-5 h-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Hero Section</h2>
        </div>
        <div className="grid grid-cols-1 gap-4">
          <Input
            label="Headline"
            placeholder={`Welcome to ${school?.name || 'Your School'}`}
            value={merged?.hero_headline ?? ''}
            onChange={(e) => set('hero_headline', e.target.value)}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subtext</label>
            <textarea
              className="block w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              rows={3}
              placeholder="A short description that appears below the headline..."
              value={merged?.hero_subtext ?? ''}
              onChange={(e) => set('hero_subtext', e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* About Section */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Type className="w-5 h-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">About Section</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Founded Year"
            type="number"
            placeholder="1985"
            value={merged?.founded_year?.toString() ?? ''}
            onChange={(e) => set('founded_year', e.target.value ? parseInt(e.target.value) : null)}
          />
          <Input
            label="County"
            placeholder="Montserrado"
            value={merged?.county ?? ''}
            onChange={(e) => set('county', e.target.value)}
          />
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">About Text</label>
            <textarea
              className="block w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              rows={5}
              placeholder="Tell visitors about your school's history, mission, and values..."
              value={merged?.about_text ?? ''}
              onChange={(e) => set('about_text', e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* Site Visibility */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Site Visibility</h2>
            <p className="mt-1 text-sm text-gray-500">
              Toggle whether your school website is visible to the public.
            </p>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={merged?.site_published ?? true}
              onChange={(e) => set('site_published', e.target.checked)}
              className="peer sr-only"
            />
            <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary-600 peer-checked:after:translate-x-full peer-checked:after:border-white dark:border-gray-600 dark:bg-gray-700" />
            <span className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">
              {merged?.site_published ? 'Published' : 'Hidden'}
            </span>
          </label>
        </div>
      </Card>
    </div>
  );
}
