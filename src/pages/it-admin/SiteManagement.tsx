import { useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { itAdminSiteService } from '@/services/itAdminService';
import { uploadSchoolLogo, uploadSchoolSiteImage } from '@/utils/storage.upload';
import type { School, SiteConfig } from '@/types/school.types';
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
  Building2,
  Upload,
  Loader2,
  Plus,
  Trash2,
  GraduationCap,
  BarChart3,
  Megaphone,
  Heart,
  Users,
  Share2,
  LayoutGrid,
  BookOpen,
  MessageSquare,
  Link2,
  CheckCircle2,
  AlertCircle,
  Copy,
} from 'lucide-react';

// ==================== ICON MAP FOR STATS & PROGRAMS ====================
const ICON_OPTIONS = [
  'users', 'graduation-cap', 'book-open', 'star', 'award', 'trophy',
  'flask', 'calculator', 'music', 'palette', 'globe', 'laptop',
  'heart', 'shield', 'target', 'zap', 'brain', 'lightbulb',
  'building', 'library', 'microscope', 'pen-tool',
];

export default function SiteManagement() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const { data: school, isLoading, refetch: refetchSchool } = useFetch<School>(
    ['it-admin-school', schoolId],
    () => itAdminSiteService.getSchool(schoolId),
    { enabled: !!schoolId },
  );

  const [form, setForm] = useState<Partial<School>>({});
  const [configForm, setConfigForm] = useState<Partial<SiteConfig>>({});
  const [domainVerifying, setDomainVerifying] = useState(false);
  const [domainStatus, setDomainStatus] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [logoUploading, setLogoUploading] = useState(false);
  const [heroUploading, setHeroUploading] = useState(false);
  const [buildingUploading, setBuildingUploading] = useState(false);
  const [principalUploading, setPrincipalUploading] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [slideUploading, setSlideUploading] = useState(false);
  const [staffPhotoUploadingIdx, setStaffPhotoUploadingIdx] = useState<number | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const heroInputRef = useRef<HTMLInputElement>(null);
  const buildingInputRef = useRef<HTMLInputElement>(null);
  const principalInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const slideInputRef = useRef<HTMLInputElement>(null);
  const staffPhotoInputRef = useRef<HTMLInputElement>(null);
  const staffPhotoUploadIdxRef = useRef<number | null>(null);

  const merged = { ...school, ...form } as School | undefined;
  const existingConfig: SiteConfig = school?.site_config ?? {};
  const mergedConfig: SiteConfig = { ...existingConfig, ...configForm };

  const updateMutation = useMutate(
    (payload: Partial<School>) => itAdminSiteService.updateSchool(schoolId, payload),
    [['it-admin-school', schoolId]],
  );

  const set = (field: keyof School, value: string | number | boolean | null) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const setConfig = (field: keyof SiteConfig, value: unknown) =>
    setConfigForm((prev) => ({ ...prev, [field]: value }));

  const hasChanges = Object.keys(form).length > 0 || Object.keys(configForm).length > 0;

  const handleSave = () => {
    if (!hasChanges) return;
    const payload: Partial<School> = { ...form };
    if (Object.keys(configForm).length > 0) {
      payload.site_config = { ...existingConfig, ...configForm } as SiteConfig;
    }
    updateMutation.mutate(payload, {
      onSuccess: () => {
        notify.success('School site updated');
        setForm({});
        setConfigForm({});
      },
      onError: () => notify.error('Failed to update'),
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

  // ==================== IMAGE UPLOAD HANDLERS ====================
  const handleImageUpload = async (
    file: File,
    category: 'hero' | 'building' | 'gallery' | 'principal',
    setUploading: (v: boolean) => void,
  ) => {
    if (!schoolId) return;
    setUploading(true);
    try {
      const url = await uploadSchoolSiteImage(schoolId, file, category);
      if (category === 'gallery') {
        const existing = mergedConfig.gallery_images ?? [];
        setConfig('gallery_images', [...existing, { url, caption: '' }]);
      } else if (category === 'hero') {
        setConfig('hero_image_url', url);
      } else if (category === 'building') {
        setConfig('building_image_url', url);
      } else if (category === 'principal') {
        setConfig('principal_image_url', url);
      }
      notify.success(`${category} image uploaded`);
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // ==================== SECTION VISIBILITY TOGGLE ====================
  const toggleSection = (section: string) => {
    const visible = mergedConfig.sections_visible ?? {};
    setConfig('sections_visible', { ...visible, [section]: !(visible[section] ?? true) });
  };

  const isSectionVisible = (section: string) => (mergedConfig.sections_visible ?? {})[section] ?? true;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: 'IT Admin', href: '/it-admin' },
          { label: 'School Site Management' },
        ]}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            <Globe className="inline-block h-6 w-6 mr-2 text-blue-600" />
            School Website Designer
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Design your school's public website — branding, images, content, programs, and more.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {siteUrl && (
            <a
              href={siteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <Eye className="h-4 w-4" />
              Preview
              <ExternalLink className="h-3 w-3 opacity-50" />
            </a>
          )}
          <Button onClick={handleSave} loading={updateMutation.isPending} disabled={!hasChanges}>
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Site URL */}
      {siteUrl && (
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5 text-blue-600" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-slate-900">School Website URL</p>
                {subdomainLive && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">Custom Subdomain</span>
                )}
              </div>
              <a href={siteUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline break-all">
                {siteUrl}
              </a>
              {subdomainLive && (
                <p className="mt-1 text-xs text-slate-400">Default URL is hidden. Use the Custom Subdomain control below to revert.</p>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* ==================== BRANDED SUBDOMAIN ==================== */}
      {school && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Custom Subdomain</h2>
              <p className="text-sm text-slate-500">Get a professional URL like <span className="font-mono">yourschool.schoolsyncedu.com</span></p>
            </div>
          </div>
          <SubdomainAddonCard school={school} onRefresh={() => refetchSchool()} />
        </Card>
      )}

      {/* ==================== CUSTOM DOMAIN ==================== */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-1">
          <Link2 className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-slate-900">Custom Domain</h2>
        </div>
        <p className="text-sm text-slate-500 mb-5">
          Use your own domain (e.g. <span className="font-mono text-slate-700">portal.sdahs.edu.lr</span>) instead of the default SchoolSync URL.
          Visitors will see your school's website and staff portal under your domain.
        </p>

        {/* Current domain input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">Your Custom Domain</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={merged?.custom_domain ?? ''}
              onChange={(e) => { set('custom_domain', e.target.value.toLowerCase().trim()); setDomainStatus('idle'); }}
              placeholder="portal.yourschool.edu.lr"
              className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono"
            />
            <button
              type="button"
              disabled={domainVerifying || !merged?.custom_domain}
              onClick={async () => {
                setDomainVerifying(true);
                setDomainStatus('idle');
                try {
                  // Lightweight check: fetch the domain and see if it resolves to this app.
                  // In production Vercel handles SSL/CNAME — we just check if the domain is reachable.
                  const res = await fetch(`https://${merged?.custom_domain}`, { method: 'HEAD', mode: 'no-cors', signal: AbortSignal.timeout(6000) });
                  setDomainStatus(res.type === 'opaque' || res.ok ? 'ok' : 'fail');
                } catch {
                  setDomainStatus('fail');
                } finally {
                  setDomainVerifying(false);
                }
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {domainVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
              {domainVerifying ? 'Checking…' : 'Verify'}
            </button>
          </div>
          {domainStatus === 'ok' && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" /> Domain is reachable. Save changes to activate it.
            </p>
          )}
          {domainStatus === 'fail' && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
              <AlertCircle className="h-3.5 w-3.5" /> Domain not reachable yet — DNS may still be propagating (can take up to 48 hours).
            </p>
          )}
        </div>

        {/* DNS Setup Instructions */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">DNS Setup Instructions</p>
          <p className="text-xs text-slate-500">
            At your domain registrar (e.g. GoDaddy, Namecheap, Cloudflare), add this DNS record:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="pr-6 py-1 font-semibold">Type</th>
                  <th className="pr-6 py-1 font-semibold">Name / Host</th>
                  <th className="pr-6 py-1 font-semibold">Value / Points To</th>
                  <th className="py-1 font-semibold">TTL</th>
                </tr>
              </thead>
              <tbody>
                <tr className="text-slate-800">
                  <td className="pr-6 py-1">CNAME</td>
                  <td className="pr-6 py-1">{merged?.custom_domain ? merged.custom_domain.split('.').slice(0, -2).join('.') || '@' : 'portal'}</td>
                  <td className="pr-6 py-1 flex items-center gap-1">
                    cname.vercel-dns.com
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText('cname.vercel-dns.com').then(() => notify.success('Copied!'))}
                      className="ml-1 text-blue-500 hover:text-blue-700"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </td>
                  <td className="py-1">3600</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-200 pt-3 space-y-1.5 text-xs text-slate-500">
            <p>1. Add the CNAME record above at your domain registrar.</p>
            <p>2. Enter your domain in the field above and click <strong>Save Changes</strong>.</p>
            <p>3. Send an email to <a href="mailto:support@schoolsyncedu.com" className="text-blue-600 hover:underline">support@schoolsyncedu.com</a> with your domain so we can add it to the platform. SSL is automatic.</p>
            <p className="text-slate-400">DNS changes can take up to 48 hours to propagate worldwide.</p>
          </div>
        </div>
      </Card>

      {/* ==================== SECTION VISIBILITY ==================== */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <LayoutGrid className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-slate-900">Section Visibility</h2>
        </div>
        <p className="text-sm text-slate-500 mb-4">Toggle which sections appear on your school's public website.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {[
            { key: 'hero', label: 'Hero Banner', icon: Image },
            { key: 'stats', label: 'Statistics', icon: BarChart3 },
            { key: 'about', label: 'About / Welcome', icon: Heart },
            { key: 'programs', label: 'Programs', icon: BookOpen },
            { key: 'campus', label: 'Campus / Building', icon: Building2 },
            { key: 'announcements', label: 'Announcements', icon: Megaphone },
            { key: 'gallery', label: 'Photo Gallery', icon: Image },
            { key: 'administration', label: 'Administration Team', icon: Users },
            { key: 'contact', label: 'Contact Info', icon: MessageSquare },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => toggleSection(s.key)}
              className={`flex items-center gap-2 rounded-lg border p-3 text-left text-sm font-medium transition-colors ${
                isSectionVisible(s.key)
                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-slate-50 text-slate-400'
              }`}
            >
              <s.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{s.label}</span>
              <span className={`ml-auto text-[10px] font-semibold uppercase ${isSectionVisible(s.key) ? 'text-blue-500' : 'text-slate-300'}`}>
                {isSectionVisible(s.key) ? 'ON' : 'OFF'}
              </span>
            </button>
          ))}
        </div>
      </Card>

      {/* ==================== GENERAL INFO ==================== */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-slate-900">General Information</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="School Name" value={merged?.name ?? ''} onChange={(e) => set('name', e.target.value)} />
          <Input label="School Code" value={merged?.school_code ?? ''} disabled />
          <Input label="Location" value={merged?.location ?? ''} onChange={(e) => set('location', e.target.value)} />
          <Input label="Phone" value={merged?.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
          <Input label="Email" value={merged?.principal_email ?? ''} onChange={(e) => set('principal_email', e.target.value)} />
          <Input label="Motto" value={merged?.motto ?? ''} onChange={(e) => set('motto', e.target.value)} />
          <Input label="Address" value={merged?.address ?? ''} onChange={(e) => set('address', e.target.value)} />
          <Input label="Website URL" value={merged?.website ?? ''} onChange={(e) => set('website', e.target.value)} placeholder="https://www.yourschool.com" />
        </div>
      </Card>

      {/* ==================== BRANDING & COLORS ==================== */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Palette className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-slate-900">Branding & Colors</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Logo */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">School Logo</label>
            <div className="flex items-center gap-4">
              {merged?.logo_url ? (
                <img src={merged.logo_url} alt="School Logo" className="h-16 w-16 rounded-lg object-cover border border-slate-200" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50">
                  <Image className="h-6 w-6 text-slate-300" />
                </div>
              )}
              <div className="flex-1">
                <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml" className="hidden"
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
                <button type="button" onClick={() => logoInputRef.current?.click()} disabled={logoUploading}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50">
                  {logoUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {logoUploading ? 'Uploading...' : 'Upload Logo'}
                </button>
                <p className="mt-1 text-xs text-slate-400">PNG, JPG, GIF, WebP, or SVG. Max 2 MB.</p>
              </div>
            </div>
          </div>
          {/* Colors */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Primary Color</label>
              <div className="flex items-center gap-3">
                <input type="color" value={merged?.primary_color ?? '#1e40af'} onChange={(e) => set('primary_color', e.target.value)} className="h-10 w-14 rounded border cursor-pointer" />
                <Input value={merged?.primary_color ?? '#1e40af'} onChange={(e) => set('primary_color', e.target.value)} className="flex-1" />
              </div>
              <p className="mt-1 text-xs text-slate-400">Navbar, hero, buttons, footer</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Secondary Color</label>
              <div className="flex items-center gap-3">
                <input type="color" value={merged?.secondary_color ?? '#f59e0b'} onChange={(e) => set('secondary_color', e.target.value)} className="h-10 w-14 rounded border cursor-pointer" />
                <Input value={merged?.secondary_color ?? '#f59e0b'} onChange={(e) => set('secondary_color', e.target.value)} className="flex-1" />
              </div>
              <p className="mt-1 text-xs text-slate-400">Accents, CTA buttons, highlights</p>
            </div>
          </div>
        </div>
      </Card>

      {/* ==================== HERO SECTION ==================== */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Image className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-slate-900">Hero Section</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Headline" placeholder={`Welcome to ${school?.name || 'Your School'}`} value={merged?.hero_headline ?? ''} onChange={(e) => set('hero_headline', e.target.value)} />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Founded Year</label>
            <Input type="number" placeholder="1985" value={merged?.founded_year?.toString() ?? ''} onChange={(e) => set('founded_year', e.target.value ? parseInt(e.target.value) : null)} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Subtext</label>
            <textarea className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" rows={3}
              placeholder="A short description below the headline..."
              value={merged?.hero_subtext ?? ''} onChange={(e) => set('hero_subtext', e.target.value)} />
          </div>
          <Input label="County" placeholder="Montserrado" value={merged?.county ?? ''} onChange={(e) => set('county', e.target.value)} />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">School Hours</label>
            <Input placeholder="Mon-Fri 8:00 AM - 3:00 PM" value={mergedConfig.school_hours ?? ''} onChange={(e) => setConfig('school_hours', e.target.value)} />
          </div>
        </div>

        {/* Hero Background Image */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">Hero Background Image</label>
          <p className="text-xs text-slate-400 mb-3">Upload a photo of your school building or campus for the hero banner. Recommended: 1920x800px or larger.</p>
          <div className="flex items-start gap-4">
            {mergedConfig.hero_image_url ? (
              <img src={mergedConfig.hero_image_url} alt="Hero" className="h-32 w-56 rounded-lg object-cover border border-slate-200" />
            ) : (
              <div className="flex h-32 w-56 items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50">
                <div className="text-center">
                  <Image className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-1 text-xs text-slate-300">No hero image</p>
                </div>
              </div>
            )}
            <div>
              <input ref={heroInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, 'hero', setHeroUploading); e.target.value = ''; }} />
              <button type="button" onClick={() => heroInputRef.current?.click()} disabled={heroUploading}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50">
                {heroUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {heroUploading ? 'Uploading...' : 'Upload Hero Image'}
              </button>
              <p className="mt-1 text-xs text-slate-400">PNG, JPG, or WebP. Max 5 MB.</p>
              {mergedConfig.hero_image_url && (
                <button type="button" onClick={() => setConfig('hero_image_url', '')} className="mt-2 text-xs text-red-500 hover:text-red-700">
                  Remove image (use gradient)
                </button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* ==================== HERO SLIDESHOW ==================== */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Image className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-900">Hero Slideshow</h2>
          </div>
          <div>
            <input
              ref={slideInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file || !schoolId) return;
                e.target.value = '';
                setSlideUploading(true);
                try {
                  const url = await uploadSchoolSiteImage(schoolId, file, 'slide');
                  const slides = [...(mergedConfig.hero_slides ?? []), { image_url: url, caption: '' }];
                  setConfig('hero_slides', slides);
                  notify.success('Slide added');
                } catch (err) {
                  notify.error(err instanceof Error ? err.message : 'Upload failed');
                } finally {
                  setSlideUploading(false);
                }
              }}
            />
            <button
              type="button"
              onClick={() => slideInputRef.current?.click()}
              disabled={slideUploading}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {slideUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {slideUploading ? 'Uploading...' : 'Add Slide'}
            </button>
          </div>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Add multiple hero background images — the site will cycle through them automatically every 5 seconds.
          When slides are added they take priority over the single Hero Background Image above.
          Recommended: 1920×800 px or larger.
        </p>
        {(mergedConfig.hero_slides ?? []).length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-slate-200 p-8 text-center">
            <Image className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-2 text-sm text-slate-400">No slides yet. Click "Add Slide" to start building your slideshow.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {(mergedConfig.hero_slides ?? []).map((slide, i) => (
              <div key={i} className="group relative">
                <img src={slide.image_url} alt={`Slide ${i + 1}`} className="h-32 w-full rounded-lg object-cover border border-slate-200" />
                <div className="absolute inset-0 flex flex-col items-end justify-between rounded-lg bg-gradient-to-t from-black/50 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => {
                      const slides = (mergedConfig.hero_slides ?? []).filter((_, idx) => idx !== i);
                      setConfig('hero_slides', slides);
                    }}
                    className="rounded bg-red-500/80 p-1 text-white hover:bg-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <span className="text-xs font-semibold text-white">Slide {i + 1}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ==================== ABOUT / MISSION / VISION ==================== */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Type className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-slate-900">About, Mission & Vision</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">About Text</label>
            <textarea className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" rows={4}
              placeholder="Tell visitors about your school's history, mission, and values..."
              value={merged?.about_text ?? ''} onChange={(e) => set('about_text', e.target.value)} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Mission Statement</label>
              <textarea className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" rows={3}
                placeholder="Our mission is to..."
                value={mergedConfig.mission_text ?? ''} onChange={(e) => setConfig('mission_text', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Vision Statement</label>
              <textarea className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" rows={3}
                placeholder="Our vision is to..."
                value={mergedConfig.vision_text ?? ''} onChange={(e) => setConfig('vision_text', e.target.value)} />
            </div>
          </div>
          {/* Principal Message */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Principal's Welcome Message</label>
            <textarea className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" rows={3}
              placeholder="A welcome message from the principal..."
              value={mergedConfig.principal_message ?? ''} onChange={(e) => setConfig('principal_message', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Principal's Title / Credentials</label>
            <Input placeholder="e.g. B.Ed., Principal" value={mergedConfig.principal_title ?? ''} onChange={(e) => setConfig('principal_title', e.target.value)} />
            <p className="mt-1 text-xs text-slate-400">Shown below the principal's name on the website, e.g. "B.Ed., Principal" or "M.A., School Director".</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Principal Photo</label>
            <div className="flex items-center gap-4">
              {mergedConfig.principal_image_url ? (
                <img src={mergedConfig.principal_image_url} alt="Principal" className="h-20 w-20 rounded-full object-cover border-2 border-slate-200" />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-slate-200 bg-slate-50">
                  <Users className="h-6 w-6 text-slate-300" />
                </div>
              )}
              <div>
                <input ref={principalInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, 'principal', setPrincipalUploading); e.target.value = ''; }} />
                <button type="button" onClick={() => principalInputRef.current?.click()} disabled={principalUploading}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50">
                  {principalUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {principalUploading ? 'Uploading...' : 'Upload Photo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* ==================== SCHOOL BUILDING / CAMPUS ==================== */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-slate-900">School Building / Campus</h2>
        </div>
        <p className="text-sm text-slate-500 mb-4">Upload a large photo of your school's main building or campus. This will be displayed prominently on the landing page.</p>
        <div className="flex items-start gap-4">
          {mergedConfig.building_image_url ? (
            <img src={mergedConfig.building_image_url} alt="School Building" className="h-44 w-80 rounded-xl object-cover border border-slate-200" />
          ) : (
            <div className="flex h-44 w-80 items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50">
              <div className="text-center">
                <Building2 className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-2 text-sm text-slate-300">No building photo</p>
              </div>
            </div>
          )}
          <div>
            <input ref={buildingInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, 'building', setBuildingUploading); e.target.value = ''; }} />
            <button type="button" onClick={() => buildingInputRef.current?.click()} disabled={buildingUploading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50">
              {buildingUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {buildingUploading ? 'Uploading...' : 'Upload Building Photo'}
            </button>
            <p className="mt-1 text-xs text-slate-400">Recommended: 1200x600px or larger. Max 5 MB.</p>
            {mergedConfig.building_image_url && (
              <button type="button" onClick={() => setConfig('building_image_url', '')} className="mt-2 text-xs text-red-500 hover:text-red-700">
                Remove photo
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* ==================== STATS ==================== */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-900">Statistics</h2>
          </div>
          <button type="button" onClick={() => {
            const stats = [...(mergedConfig.stats ?? []), { label: '', value: '', icon: 'users' }];
            setConfig('stats', stats);
          }} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <Plus className="h-4 w-4" /> Add Stat
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-4">Showcase key numbers about your school (e.g., 500+ Students, 30+ Staff, 15 Programs).</p>
        {(mergedConfig.stats ?? []).length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-slate-200 p-6 text-center">
            <BarChart3 className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm text-slate-400">No stats added yet. Click "Add Stat" to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(mergedConfig.stats ?? []).map((stat, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                <select value={stat.icon} onChange={(e) => {
                  const stats = [...(mergedConfig.stats ?? [])];
                  stats[i] = { ...stat, icon: e.target.value };
                  setConfig('stats', stats);
                }} className="rounded border border-slate-200 bg-white px-2 py-1.5 text-sm">
                  {ICON_OPTIONS.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
                </select>
                <Input placeholder="Value (e.g. 500+)" value={stat.value} onChange={(e) => {
                  const stats = [...(mergedConfig.stats ?? [])];
                  stats[i] = { ...stat, value: e.target.value };
                  setConfig('stats', stats);
                }} className="flex-1" />
                <Input placeholder="Label (e.g. Students)" value={stat.label} onChange={(e) => {
                  const stats = [...(mergedConfig.stats ?? [])];
                  stats[i] = { ...stat, label: e.target.value };
                  setConfig('stats', stats);
                }} className="flex-1" />
                <button type="button" onClick={() => {
                  const stats = (mergedConfig.stats ?? []).filter((_, idx) => idx !== i);
                  setConfig('stats', stats);
                }} className="rounded p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ==================== ACADEMIC PROGRAMS ==================== */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-900">Academic Programs</h2>
          </div>
          <button type="button" onClick={() => {
            const programs = [...(mergedConfig.programs ?? []), { name: '', description: '', icon: 'book-open' }];
            setConfig('programs', programs);
          }} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <Plus className="h-4 w-4" /> Add Program
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-4">List the academic programs, departments, or tracks your school offers.</p>
        {(mergedConfig.programs ?? []).length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-slate-200 p-6 text-center">
            <BookOpen className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm text-slate-400">No programs added yet. Click "Add Program" to list your academic offerings.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(mergedConfig.programs ?? []).map((prog, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                <select value={prog.icon} onChange={(e) => {
                  const programs = [...(mergedConfig.programs ?? [])];
                  programs[i] = { ...prog, icon: e.target.value };
                  setConfig('programs', programs);
                }} className="mt-1 rounded border border-slate-200 bg-white px-2 py-1.5 text-sm">
                  {ICON_OPTIONS.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
                </select>
                <div className="flex-1 space-y-2">
                  <Input placeholder="Program Name (e.g. Sciences)" value={prog.name} onChange={(e) => {
                    const programs = [...(mergedConfig.programs ?? [])];
                    programs[i] = { ...prog, name: e.target.value };
                    setConfig('programs', programs);
                  }} />
                  <Input placeholder="Short description..." value={prog.description} onChange={(e) => {
                    const programs = [...(mergedConfig.programs ?? [])];
                    programs[i] = { ...prog, description: e.target.value };
                    setConfig('programs', programs);
                  }} />
                </div>
                <button type="button" onClick={() => {
                  const programs = (mergedConfig.programs ?? []).filter((_, idx) => idx !== i);
                  setConfig('programs', programs);
                }} className="mt-1 rounded p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ==================== ANNOUNCEMENTS ==================== */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-900">Announcements & News</h2>
          </div>
          <button type="button" onClick={() => {
            const items = [...(mergedConfig.announcements ?? []), { title: '', date: new Date().toISOString().slice(0, 10), excerpt: '' }];
            setConfig('announcements', items);
          }} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <Plus className="h-4 w-4" /> Add Announcement
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-4">Add news, events, or announcements that visitors will see on your landing page.</p>
        {(mergedConfig.announcements ?? []).length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-slate-200 p-6 text-center">
            <Megaphone className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm text-slate-400">No announcements yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(mergedConfig.announcements ?? []).map((item, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="flex-1 space-y-2">
                  <div className="flex gap-3">
                    <Input placeholder="Title" value={item.title} onChange={(e) => {
                      const items = [...(mergedConfig.announcements ?? [])];
                      items[i] = { ...item, title: e.target.value };
                      setConfig('announcements', items);
                    }} className="flex-1" />
                    <Input type="date" value={item.date} onChange={(e) => {
                      const items = [...(mergedConfig.announcements ?? [])];
                      items[i] = { ...item, date: e.target.value };
                      setConfig('announcements', items);
                    }} className="w-40" />
                  </div>
                  <Input placeholder="Short excerpt or description..." value={item.excerpt} onChange={(e) => {
                    const items = [...(mergedConfig.announcements ?? [])];
                    items[i] = { ...item, excerpt: e.target.value };
                    setConfig('announcements', items);
                  }} />
                </div>
                <button type="button" onClick={() => {
                  const items = (mergedConfig.announcements ?? []).filter((_, idx) => idx !== i);
                  setConfig('announcements', items);
                }} className="mt-1 rounded p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ==================== PHOTO GALLERY ==================== */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Image className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-900">Photo Gallery</h2>
          </div>
          <div>
            <input ref={galleryInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, 'gallery', setGalleryUploading); e.target.value = ''; }} />
            <button type="button" onClick={() => galleryInputRef.current?.click()} disabled={galleryUploading}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              {galleryUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {galleryUploading ? 'Uploading...' : 'Add Photo'}
            </button>
          </div>
        </div>
        <p className="text-sm text-slate-500 mb-4">Showcase school life — classrooms, events, sports, assemblies, labs, and more.</p>
        {(mergedConfig.gallery_images ?? []).length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-slate-200 p-8 text-center">
            <Image className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-2 text-sm text-slate-400">No gallery photos yet. Click "Add Photo" to start building your gallery.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {(mergedConfig.gallery_images ?? []).map((img, i) => (
              <div key={i} className="group relative">
                <img src={img.url} alt={img.caption || `Gallery ${i + 1}`} className="h-32 w-full rounded-lg object-cover border border-slate-200" />
                <div className="absolute inset-0 flex items-end rounded-lg bg-gradient-to-t from-black/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="flex w-full items-center justify-between p-2">
                    <input placeholder="Caption..." value={img.caption} onChange={(e) => {
                      const gallery = [...(mergedConfig.gallery_images ?? [])];
                      gallery[i] = { ...img, caption: e.target.value };
                      setConfig('gallery_images', gallery);
                    }} className="w-full rounded bg-black/30 px-2 py-1 text-xs text-white placeholder:text-white/50 focus:outline-none" />
                    <button type="button" onClick={() => {
                      const gallery = (mergedConfig.gallery_images ?? []).filter((_, idx) => idx !== i);
                      setConfig('gallery_images', gallery);
                    }} className="ml-2 rounded p-1 text-white/80 hover:bg-red-500/80 hover:text-white">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ==================== ADMINISTRATION TEAM ==================== */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-900">Administration Team</h2>
          </div>
          <button
            type="button"
            onClick={() => {
              const staff = [...(mergedConfig.staff ?? []), { name: '', role: '', photo_url: '', bio: '' }];
              setConfig('staff', staff);
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Plus className="h-4 w-4" /> Add Member
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Add your school's leadership team — principal, vice principal, registrar, and any other key staff.
          Enable the <strong>Administration Team</strong> section in Section Visibility above to show it on your site.
        </p>

        {/* Hidden file input for staff photos */}
        <input
          ref={staffPhotoInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            const idx = staffPhotoUploadIdxRef.current;
            if (!file || !schoolId || idx === null) return;
            e.target.value = '';
            setStaffPhotoUploadingIdx(idx);
            try {
              const url = await uploadSchoolSiteImage(schoolId, file, 'staff');
              const staff = [...(mergedConfig.staff ?? [])];
              staff[idx] = { ...staff[idx], photo_url: url };
              setConfig('staff', staff);
              notify.success('Photo uploaded');
            } catch (err) {
              notify.error(err instanceof Error ? err.message : 'Upload failed');
            } finally {
              setStaffPhotoUploadingIdx(null);
              staffPhotoUploadIdxRef.current = null;
            }
          }}
        />

        {(mergedConfig.staff ?? []).length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-slate-200 p-8 text-center">
            <Users className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm text-slate-400">No team members yet. Click "Add Member" to get started.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {(mergedConfig.staff ?? []).map((member, i) => (
              <div key={i} className="flex items-start gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
                {/* Photo */}
                <div className="shrink-0">
                  <div
                    className="relative h-16 w-16 cursor-pointer overflow-hidden rounded-full border-2 border-slate-200 bg-slate-100 hover:opacity-90"
                    onClick={() => { staffPhotoUploadIdxRef.current = i; staffPhotoInputRef.current?.click(); }}
                    title="Click to upload photo"
                  >
                    {staffPhotoUploadingIdx === i ? (
                      <div className="flex h-full w-full items-center justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                      </div>
                    ) : member.photo_url ? (
                      <img src={member.photo_url} alt={member.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-0.5">
                        <Upload className="h-4 w-4 text-slate-300" />
                        <span className="text-[9px] text-slate-300">Photo</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Fields */}
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    placeholder="Full Name"
                    value={member.name}
                    onChange={(e) => {
                      const staff = [...(mergedConfig.staff ?? [])];
                      staff[i] = { ...member, name: e.target.value };
                      setConfig('staff', staff);
                    }}
                  />
                  <Input
                    placeholder="Role (e.g. Principal)"
                    value={member.role}
                    onChange={(e) => {
                      const staff = [...(mergedConfig.staff ?? [])];
                      staff[i] = { ...member, role: e.target.value };
                      setConfig('staff', staff);
                    }}
                  />
                  <div className="sm:col-span-2">
                    <Input
                      placeholder="Short bio (optional)"
                      value={member.bio ?? ''}
                      onChange={(e) => {
                        const staff = [...(mergedConfig.staff ?? [])];
                        staff[i] = { ...member, bio: e.target.value };
                        setConfig('staff', staff);
                      }}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const staff = (mergedConfig.staff ?? []).filter((_, idx) => idx !== i);
                    setConfig('staff', staff);
                  }}
                  className="mt-1 shrink-0 rounded p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ==================== SOCIAL LINKS ==================== */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Share2 className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-slate-900">Social Media Links</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(['facebook', 'twitter', 'instagram', 'youtube', 'linkedin', 'tiktok'] as const).map((platform) => (
            <Input
              key={platform}
              label={platform.charAt(0).toUpperCase() + platform.slice(1)}
              placeholder={`https://${platform}.com/yourschool`}
              value={mergedConfig.social_links?.[platform] ?? ''}
              onChange={(e) => setConfig('social_links', { ...(mergedConfig.social_links ?? {}), [platform]: e.target.value })}
            />
          ))}
        </div>
      </Card>

      {/* ==================== SITE VISIBILITY ==================== */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Site Visibility</h2>
            <p className="mt-1 text-sm text-slate-500">Toggle whether your school website is visible to the public.</p>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input type="checkbox" checked={merged?.site_published ?? true} onChange={(e) => set('site_published', e.target.checked)} className="peer sr-only" />
            <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white" />
            <span className="ml-3 text-sm font-medium text-slate-700">{merged?.site_published ? 'Published' : 'Hidden'}</span>
          </label>
        </div>
      </Card>

      {/* Bottom save bar */}
      {hasChanges && (
        <div className="sticky bottom-4 z-40">
          <div className="mx-auto max-w-xl rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-blue-800">You have unsaved changes</p>
              <Button onClick={handleSave} loading={updateMutation.isPending} size="sm">
                <Save className="w-4 h-4 mr-1" />
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
