import { useState, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Loader2, Palette, LayoutTemplate, FileText, KeyRound, ExternalLink } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

/**
 * One place to design the school's public site.
 *
 * Replaces four scattered screens across two roles:
 *
 *   /proprietor/site         brand basics      SiteCustomizer
 *   /it-admin/site           page content      SiteManagement
 *   /proprietor/login-page   sign-in page      AuthPageDesigner
 *   /it-admin/login-page     the same page again
 *
 * The two site screens wrote overlapping school fields through different
 * services — schoolSettingsService and itAdminSiteService — so a proprietor
 * and an IT admin editing at the same time silently overwrote each other.
 * Site design now belongs to the proprietor alone: the school owner owns the
 * brand, and IT admin keeps users, cards and systems.
 *
 * The existing panels are reused rather than rewritten. They work, they hold a
 * lot of detail, and merging them into one component would have been a large
 * rewrite with nothing to show for it. What changes is that they are now one
 * screen with one navigation, instead of four entries in two sidebars.
 */

const BrandPanel   = lazy(() => import('./SiteCustomizer'));
const ContentPanel = lazy(() => import('@/pages/it-admin/SiteManagement'));
const LoginPanel   = lazy(() => import('@/pages/it-admin/AuthPageDesigner'));
const ThemePanel   = lazy(() => import('./SiteThemePanel'));

type Tab = 'design' | 'brand' | 'content' | 'login';

const TABS: { key: Tab; label: string; icon: React.ElementType; hint: string }[] = [
  { key: 'design',  label: 'Design',     icon: LayoutTemplate, hint: 'Style, layout and backgrounds' },
  { key: 'brand',   label: 'Brand',      icon: Palette,        hint: 'Logo, colours, name and motto' },
  { key: 'content', label: 'Content',    icon: FileText,       hint: 'Hero, programmes, gallery, staff' },
  { key: 'login',   label: 'Login page', icon: KeyRound,       hint: 'What staff and students see signing in' },
];

export default function SiteDesigner() {
  const { user } = useAuth();
  const slug = (user as unknown as Record<string, unknown>)?.school_slug as string | undefined;

  const [params, setParams] = useSearchParams();
  const [tab, setTabState] = useState<Tab>((params.get('tab') as Tab) ?? 'design');

  const setTab = (t: Tab) => {
    setTabState(t);
    setParams(t === 'design' ? {} : { tab: t }, { replace: true });
  };

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Proprietor', href: '/proprietor' }, { label: 'School Website' }]} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">School Website</h1>
          <p className="mt-1 text-sm text-slate-500">
            Everything about how your school's public site looks and reads.
          </p>
        </div>
        {slug && (
          <a
            href={`/school/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <ExternalLink className="h-4 w-4" /> View site
          </a>
        )}
      </div>

      {/* Tabs. Design first: it is the one that changes how the site looks
          rather than what it says, and was the thing schools could not do. */}
      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            title={t.hint}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      <Suspense
        fallback={
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
          </div>
        }
      >
        {tab === 'design'  && <ThemePanel />}
        {tab === 'brand'   && <BrandPanel />}
        {tab === 'content' && <ContentPanel />}
        {tab === 'login'   && <LoginPanel />}
      </Suspense>
    </div>
  );
}
