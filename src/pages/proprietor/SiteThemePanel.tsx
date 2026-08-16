import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { notify } from '@/components/shared/Toast';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  resolveTheme, PRESET_INFO, SURFACE_INFO,
  type SiteTheme, type ThemePreset, type SurfaceStyle,
  type CornerStyle, type HeadingFont, type LogoPlacement, type HeroLayout,
  type BandStyle, type AuthLayout,
} from '@/types/siteTheme';
import { buildSiteStyles } from '@/utils/siteThemeStyles';
import { Loader2, Check, Save } from 'lucide-react';

/**
 * Choose how the school's site looks.
 *
 * Curated rather than open: every control is a short list of options that are
 * known to work together, so a school picks between good designs instead of
 * being handed a canvas it can wreck. That is a deliberate product decision —
 * the aim is that every school ends up with a site that looks considered, not
 * that every school can build anything.
 *
 * Each control shows a live miniature rather than only a label, because
 * "Editorial" and "Warm" mean nothing until you can see them.
 */

const CORNERS: { value: CornerStyle; label: string }[] = [
  { value: 'sharp', label: 'Sharp' },
  { value: 'soft', label: 'Soft' },
  { value: 'round', label: 'Round' },
  { value: 'pill', label: 'Pill' },
];

const FONTS: { value: HeadingFont; label: string; css: string }[] = [
  { value: 'sans', label: 'Sans', css: "'Inter', system-ui, sans-serif" },
  { value: 'serif', label: 'Serif', css: "Georgia, serif" },
  { value: 'slab', label: 'Slab', css: "Rockwell, Georgia, serif" },
  { value: 'display', label: 'Display', css: "'Trebuchet MS', sans-serif" },
];

const HEROES: { value: HeroLayout; label: string; description: string }[] = [
  { value: 'centered', label: 'Centred', description: 'Text over the image, centred' },
  { value: 'split', label: 'Split', description: 'Text one side, image the other' },
  { value: 'full-image', label: 'Full image', description: 'Edge-to-edge photo, text low' },
  { value: 'minimal', label: 'Minimal', description: 'No photo — colour and type' },
  { value: 'card', label: 'Card', description: 'Text in a raised card' },
];

const AUTH_LAYOUTS: { value: AuthLayout; label: string; description: string }[] = [
  { value: 'split',    label: 'Split',    description: 'Branding beside the form' },
  { value: 'centered', label: 'Centred',  description: 'Form over the branding' },
  { value: 'card',     label: 'Card',     description: 'Raised card on an image' },
  { value: 'minimal',  label: 'Minimal',  description: 'Plain, logo above the form' },
  { value: 'cover',    label: 'Cover',    description: 'Full image, frosted panel' },
];

const BANDS: { value: BandStyle; label: string }[] = [
  { value: 'brand',   label: 'Brand' },
  { value: 'deep',    label: 'Deep' },
  { value: 'ink',     label: 'Ink' },
  { value: 'surface', label: 'Plain' },
];

/** Same darkening the site uses, so the swatch matches what renders. */
function shade(hex: string, ratio: number): string {
  const c = hex.replace('#', '');
  const full = c.length === 3 ? c.split('').map((x) => x + x).join('') : c;
  if (!/^[0-9a-f]{6}$/i.test(full)) return hex;
  const parts = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  return '#' + parts.map((v) => Math.round(v * (1 - ratio)).toString(16).padStart(2, '0')).join('');
}

const PLACEMENTS: { value: LogoPlacement; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Centre' },
  { value: 'right', label: 'Right' },
];

export default function SiteThemePanel() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';

  const [theme, setTheme] = useState<SiteTheme>({});
  const [colors, setColors] = useState({ primary: '#2d4fd6', secondary: '#f59e0b' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('schools')
        .select('site_config, primary_color, secondary_color')
        .eq('id', schoolId)
        .maybeSingle();

      const cfg = (data?.site_config ?? {}) as Record<string, unknown>;
      setTheme((cfg.theme as SiteTheme) ?? {});
      setColors({
        primary: data?.primary_color ?? '#2d4fd6',
        secondary: data?.secondary_color ?? '#f59e0b',
      });
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => { void load(); }, [load]);

  function update<K extends keyof SiteTheme>(key: K, value: SiteTheme[K]) {
    setTheme((t) => ({ ...t, [key]: value }));
    setDirty(true);
  }

  function updateLayout(key: 'hero', value: HeroLayout) {
    setTheme((t) => ({ ...t, layouts: { ...(t.layouts ?? {}), [key]: value } }));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    try {
      // Read-modify-write on site_config: it holds all the page content too,
      // and replacing the whole object would erase programmes, gallery and
      // staff along with it.
      const { data: current } = await supabase
        .from('schools').select('site_config').eq('id', schoolId).maybeSingle();

      const merged = { ...((current?.site_config ?? {}) as object), theme };

      const { error } = await supabase
        .from('schools').update({ site_config: merged }).eq('id', schoolId);
      if (error) throw error;

      notify.success('Design saved.');
      setDirty(false);
    } catch {
      notify.error('Could not save the design.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
      </div>
    );
  }

  const t = resolveTheme(theme);

  return (
    <div className="space-y-6 pb-24">
      {/* Style */}
      <section>
        <h2 className="text-sm font-bold text-slate-900">Style</h2>
        <p className="mb-3 text-xs text-slate-500">
          Sets the overall character — surfaces, spacing and headings.
        </p>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {(Object.keys(PRESET_INFO) as ThemePreset[]).map((p) => {
            const s = buildSiteStyles({ ...theme, preset: p }, colors.primary, colors.secondary);
            const active = t.preset === p;
            return (
              <button
                key={p}
                onClick={() => update('preset', p)}
                className={`overflow-hidden rounded-xl border-2 text-left transition-all ${
                  active ? 'border-primary-600 ring-2 ring-primary-600/20' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Miniature rendered with the real tokens, so the swatch
                    cannot drift from what the site actually does. */}
                <div className="relative h-20 p-3" style={{ ...s.vars, background: 'var(--site-page-bg)' }}>
                  {s.surface && <div className="absolute inset-0" style={{ ...s.surface, color: 'var(--site-text)' }} />}
                  <div className="relative">
                    <div
                      style={{
                        fontFamily: 'var(--site-heading-font)',
                        fontWeight: 'var(--site-heading-weight)' as never,
                        letterSpacing: 'var(--site-heading-tracking)',
                        color: 'var(--site-text)',
                      }}
                      className="text-[11px]"
                    >
                      School Name
                    </div>
                    <div className="mt-1 h-1.5 w-14 rounded-full" style={{ background: colors.primary }} />
                    <div className="mt-2 flex gap-1">
                      <div className="h-5 w-8 rounded" style={{ background: 'var(--site-surface-alt)', border: 'var(--site-border)', borderRadius: 'var(--site-radius)' }} />
                      <div className="h-5 w-8 rounded" style={{ background: 'var(--site-surface-alt)', border: 'var(--site-border)', borderRadius: 'var(--site-radius)' }} />
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-1.5 border-t border-slate-100 bg-white p-2.5">
                  {active && <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-600" />}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800">{PRESET_INFO[p].label}</p>
                    <p className="mt-0.5 text-[10px] leading-snug text-slate-500">{PRESET_INFO[p].description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Background */}
      <section>
        <h2 className="text-sm font-bold text-slate-900">Background</h2>
        <p className="mb-3 text-xs text-slate-500">Texture behind full-width sections.</p>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {(Object.keys(SURFACE_INFO) as SurfaceStyle[]).map((sf) => {
            const s = buildSiteStyles({ ...theme, surface: sf }, colors.primary, colors.secondary);
            const active = t.surface === sf;
            return (
              <button
                key={sf}
                onClick={() => update('surface', sf)}
                className={`overflow-hidden rounded-xl border-2 transition-all ${
                  active ? 'border-primary-600 ring-2 ring-primary-600/20' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="relative h-14" style={{ ...s.vars, background: 'var(--site-page-bg)' }}>
                  {s.surface && <div className="absolute inset-0" style={{ ...s.surface, color: 'var(--site-text)' }} />}
                </div>
                <p className="border-t border-slate-100 bg-white p-2 text-[11px] font-medium text-slate-700">
                  {SURFACE_INFO[sf].label}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Hero layout */}
      <section>
        <h2 className="text-sm font-bold text-slate-900">Hero layout</h2>
        <p className="mb-3 text-xs text-slate-500">
          How the top of your page is arranged. Your text and images stay the same.
        </p>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {HEROES.map((h) => {
            const active = t.layouts.hero === h.value;
            return (
              <button
                key={h.value}
                onClick={() => updateLayout('hero', h.value)}
                className={`overflow-hidden rounded-xl border-2 text-left transition-all ${
                  active ? 'border-primary-600 ring-2 ring-primary-600/20' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <HeroThumb layout={h.value} primary={colors.primary} />
                <div className="border-t border-slate-100 bg-white p-2.5">
                  <p className="text-xs font-semibold text-slate-800">{h.label}</p>
                  <p className="mt-0.5 text-[10px] leading-snug text-slate-500">{h.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Login page */}
      <section>
        <h2 className="text-sm font-bold text-slate-900">Login page</h2>
        <p className="mb-3 text-xs text-slate-500">
          The sign-in screen shares this design. Its wording and images stay under
          the Login page tab — this is the arrangement.
        </p>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {AUTH_LAYOUTS.map((a) => {
            const active = t.authLayout === a.value;
            return (
              <button
                key={a.value}
                onClick={() => update('authLayout', a.value)}
                className={`overflow-hidden rounded-xl border-2 text-left transition-all ${
                  active ? 'border-primary-600 ring-2 ring-primary-600/20' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <AuthThumb layout={a.value} primary={colors.primary} />
                <div className="border-t border-slate-100 bg-white p-2.5">
                  <p className="text-xs font-semibold text-slate-800">{a.label}</p>
                  <p className="mt-0.5 text-[10px] leading-snug text-slate-500">{a.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Footer and CTA bands */}
      <section>
        <h2 className="text-sm font-bold text-slate-900">Footer &amp; call-to-action</h2>
        <p className="mb-3 text-xs text-slate-500">
          These two bands used to stay in your school colour whatever style you chose,
          which left a dark page with two bright blocks. Now they follow your pick.
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          {([
            ['footerStyle', 'Footer'],
            ['ctaStyle', 'Call-to-action band'],
          ] as const).map(([key, label]) => (
            <Card key={key} className="p-4">
              <h3 className="mb-2.5 text-xs font-bold text-slate-900">{label}</h3>
              <div className="grid grid-cols-4 gap-2">
                {BANDS.map((b) => {
                  const active = (t[key] as string) === b.value;
                  const bg =
                    b.value === 'brand' ? colors.primary
                    : b.value === 'deep' ? shade(colors.primary, 0.55)
                    : b.value === 'ink' ? '#0b1020'
                    : '#e2e8f0';
                  return (
                    <button
                      key={b.value}
                      onClick={() => update(key, b.value)}
                      className={`overflow-hidden rounded-lg border-2 transition-all ${
                        active ? 'border-primary-600 ring-2 ring-primary-600/20' : 'border-slate-200'
                      }`}
                    >
                      <div className="h-9" style={{ background: bg }} />
                      <p className="bg-white px-1 py-1 text-[10px] font-medium text-slate-600">{b.label}</p>
                    </button>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Details */}
      <section className="grid gap-5 sm:grid-cols-3">
        <Card className="p-4">
          <h3 className="mb-2 text-xs font-bold text-slate-900">Corners</h3>
          <div className="flex flex-wrap gap-1.5">
            {CORNERS.map((c) => (
              <button
                key={c.value}
                onClick={() => update('corners', c.value)}
                className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  t.corners === c.value ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
                style={{ borderRadius: c.value === 'sharp' ? 0 : c.value === 'soft' ? 6 : c.value === 'round' ? 12 : 999 }}
              >
                {c.label}
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="mb-2 text-xs font-bold text-slate-900">Headings</h3>
          <div className="flex flex-wrap gap-1.5">
            {FONTS.map((f) => (
              <button
                key={f.value}
                onClick={() => update('headingFont', f.value)}
                style={{ fontFamily: f.css }}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  t.headingFont === f.value ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="mb-2 text-xs font-bold text-slate-900">Logo position</h3>
          <div className="flex flex-wrap gap-1.5">
            {PLACEMENTS.map((pl) => (
              <button
                key={pl.value}
                onClick={() => update('logoPlacement', pl.value)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  t.logoPlacement === pl.value ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {pl.label}
              </button>
            ))}
          </div>
        </Card>
      </section>

      {/* Save bar — fixed, because these controls run past a screen and a save
          button at the bottom of a long page is a button people do not find. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:pl-64">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            {dirty ? 'Unsaved changes' : 'All changes saved'}
          </p>
          <Button onClick={save} disabled={saving || !dirty}>
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
            Save design
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Wireframe of each login arrangement. */
function AuthThumb({ layout, primary }: { layout: AuthLayout; primary: string }) {
  const form = (extra = '') => (
    <div className={`flex flex-col gap-1 rounded bg-white p-1.5 shadow ${extra}`}>
      <div className="h-1 w-10 rounded-full bg-slate-300" />
      <div className="h-1 w-8 rounded-full bg-slate-200" />
      <div className="mt-0.5 h-1.5 w-6 rounded-full" style={{ background: primary }} />
    </div>
  );
  return (
    <div className="flex h-20 items-center justify-center bg-slate-50 p-2">
      {layout === 'split' && (
        <div className="flex h-full w-full gap-1">
          <div className="w-1/2 rounded" style={{ background: primary }} />
          <div className="flex w-1/2 items-center justify-center">{form()}</div>
        </div>
      )}
      {layout === 'centered' && (
        <div className="flex h-full w-full items-center justify-center rounded" style={{ background: primary }}>
          {form()}
        </div>
      )}
      {layout === 'card' && (
        <div className="flex h-full w-full items-center justify-center rounded" style={{ background: `${primary}66` }}>
          {form('shadow-lg')}
        </div>
      )}
      {layout === 'minimal' && (
        <div className="flex h-full w-full items-center justify-center rounded bg-white">{form()}</div>
      )}
      {layout === 'cover' && (
        <div className="flex h-full w-full items-center justify-center rounded" style={{ background: `${primary}aa` }}>
          <div className="flex flex-col gap-1 rounded bg-white/80 p-1.5">
            <div className="h-1 w-10 rounded-full bg-slate-400" />
            <div className="h-1 w-8 rounded-full bg-slate-300" />
          </div>
        </div>
      )}
    </div>
  );
}

/** Wireframe of each hero arrangement — enough to tell them apart at a glance. */
function HeroThumb({ layout, primary }: { layout: HeroLayout; primary: string }) {
  const bar = (w: string, h = 'h-1.5', c = 'bg-slate-300') => (
    <div className={`${h} ${c} rounded-full`} style={{ width: w }} />
  );

  return (
    <div className="flex h-20 items-center justify-center bg-slate-50 p-2">
      {layout === 'centered' && (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 rounded" style={{ background: `${primary}22` }}>
          {bar('55%', 'h-2', 'bg-slate-400')}{bar('35%')}
          <div className="mt-0.5 h-2 w-10 rounded-full" style={{ background: primary }} />
        </div>
      )}
      {layout === 'split' && (
        <div className="flex h-full w-full gap-1.5">
          <div className="flex flex-1 flex-col justify-center gap-1">
            {bar('80%', 'h-2', 'bg-slate-400')}{bar('60%')}
            <div className="mt-0.5 h-2 w-8 rounded-full" style={{ background: primary }} />
          </div>
          <div className="w-1/2 rounded" style={{ background: `${primary}33` }} />
        </div>
      )}
      {layout === 'full-image' && (
        <div className="flex h-full w-full flex-col justify-end gap-1 rounded p-1.5" style={{ background: `${primary}44` }}>
          {bar('60%', 'h-2', 'bg-white')}{bar('40%', 'h-1.5', 'bg-white/70')}
        </div>
      )}
      {layout === 'minimal' && (
        <div className="flex h-full w-full flex-col items-start justify-center gap-1 rounded px-2" style={{ background: primary }}>
          {bar('70%', 'h-2', 'bg-white')}{bar('45%', 'h-1.5', 'bg-white/60')}
        </div>
      )}
      {layout === 'card' && (
        <div className="flex h-full w-full items-center rounded p-1.5" style={{ background: `${primary}33` }}>
          <div className="flex w-3/4 flex-col gap-1 rounded bg-white p-1.5 shadow">
            {bar('75%', 'h-1.5', 'bg-slate-400')}{bar('50%')}
          </div>
        </div>
      )}
    </div>
  );
}
