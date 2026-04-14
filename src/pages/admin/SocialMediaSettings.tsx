import { useState, useEffect } from 'react';
import { socialLinksService, type PlatformSocialLinks } from '@/services/adminService';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { ExternalLink, Save, Globe } from 'lucide-react';

// ── Inline SVG brand icons ────────────────────────────────────────────────────

function IconX() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function IconFacebook() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function IconYouTube() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function IconInstagram() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
    </svg>
  );
}

function IconTikTok() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.27 8.27 0 0 0 4.83 1.55V6.79a4.85 4.85 0 0 1-1.06-.1z" />
    </svg>
  );
}

// ── Platform config ───────────────────────────────────────────────────────────

const PLATFORMS = [
  {
    key: 'social_x' as keyof PlatformSocialLinks,
    label: 'X (Twitter)',
    placeholder: 'https://x.com/yourhandle',
    Icon: IconX,
    color: 'bg-black',
    hint: 'Your X profile URL',
  },
  {
    key: 'social_facebook' as keyof PlatformSocialLinks,
    label: 'Facebook',
    placeholder: 'https://facebook.com/yourpage',
    Icon: IconFacebook,
    color: 'bg-[#1877F2]',
    hint: 'Your Facebook page URL',
  },
  {
    key: 'social_youtube' as keyof PlatformSocialLinks,
    label: 'YouTube',
    placeholder: 'https://youtube.com/@yourchannel',
    Icon: IconYouTube,
    color: 'bg-[#FF0000]',
    hint: 'Your YouTube channel URL',
  },
  {
    key: 'social_instagram' as keyof PlatformSocialLinks,
    label: 'Instagram',
    placeholder: 'https://instagram.com/yourhandle',
    Icon: IconInstagram,
    color: 'bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400',
    hint: 'Your Instagram profile URL',
  },
  {
    key: 'social_tiktok' as keyof PlatformSocialLinks,
    label: 'TikTok',
    placeholder: 'https://tiktok.com/@yourhandle',
    Icon: IconTikTok,
    color: 'bg-black',
    hint: 'Your TikTok profile URL',
  },
] as const;

// ── Component ─────────────────────────────────────────────────────────────────

export default function SocialMediaSettings() {
  const [form, setForm] = useState<PlatformSocialLinks>({
    social_x: '',
    social_facebook: '',
    social_youtube: '',
    social_instagram: '',
    social_tiktok: '',
  });
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    socialLinksService.get()
      .then((data) => {
        setForm({
          social_x:         data.social_x         ?? '',
          social_facebook:  data.social_facebook  ?? '',
          social_youtube:   data.social_youtube   ?? '',
          social_instagram: data.social_instagram ?? '',
          social_tiktok:    data.social_tiktok    ?? '',
        });
      })
      .catch(() => setError('Failed to load social links.'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await socialLinksService.update({
        social_x:         form.social_x         || null,
        social_facebook:  form.social_facebook  || null,
        social_youtube:   form.social_youtube   || null,
        social_instagram: form.social_instagram || null,
        social_tiktok:    form.social_tiktok    || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Platform', href: '/admin' }, { label: 'Social Media' }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary-600" />
            Social Media Links
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            These links appear in the public site footer for all visitors.
          </p>
        </div>
        <Button onClick={handleSave} loading={saving} disabled={loading}>
          <Save className="h-4 w-4 mr-1.5" />
          {saved ? 'Saved!' : 'Save Changes'}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {saved && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          Social media links updated — changes are live on the public site.
        </div>
      )}

      <Card className="divide-y divide-slate-100">
        {loading ? (
          <div className="space-y-4 p-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 rounded-lg bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : (
          PLATFORMS.map(({ key, label, placeholder, Icon, color, hint }) => {
            const value = form[key] ?? '';
            const hasValue = value.trim().length > 0;
            return (
              <div key={key} className="flex items-center gap-4 px-6 py-4">
                {/* Platform icon */}
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white ${color}`}>
                  <Icon />
                </div>

                {/* Label + input */}
                <div className="flex-1 min-w-0">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {label}
                  </label>
                  <input
                    type="url"
                    value={value}
                    onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 transition-colors"
                  />
                  <p className="mt-1 text-xs text-slate-400">{hint}</p>
                </div>

                {/* Live link preview — ensure absolute URL so browser doesn't treat it as relative */}
                {hasValue && (
                  <a
                    href={/^https?:\/\//i.test(value) ? value : `https://${value}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 hover:border-primary-300 hover:text-primary-600 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Preview
                  </a>
                )}
              </div>
            );
          })
        )}
      </Card>

      <p className="text-xs text-slate-400 text-center">
        Leave a field blank to hide that platform's icon from the footer.
      </p>
    </div>
  );
}
