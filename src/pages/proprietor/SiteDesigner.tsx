import { useState, Suspense } from 'react';
import { lazyWithReload } from '@/utils/lazyWithReload';
import { useSearchParams } from 'react-router-dom';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Loader2, Palette, LayoutTemplate, KeyRound, ExternalLink, Blocks } from 'lucide-react';
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
 * Four tabs, and each owns something the others do not.
 *
 *   Page    every section, its words, its pictures, its order and its own look
 *   Design  style for the whole site — preset, type, corners, backgrounds
 *   Brand   logo, colours, name, motto, web address
 *   Login   what staff and students see signing in
 *
 * Getting there meant retiring a fifth. Content held the page's words and
 * pictures while Page blocks held its headings and Design held its order, so a
 * gallery's photos, title and layout lived on three different screens and the
 * honest answer to "where do I change this?" was "it depends". Section
 * ordering existed in two places at once, and visibility in a third.
 *
 * A block owns everything about itself now, which is the only arrangement
 * where that question has one answer. Content's editors moved into the blocks
 * they belong to; the two site-wide things it held that belong to no block —
 * the WhatsApp button and the social links — sit under the block list, because
 * they are the footer rather than a section.
 */

const BrandPanel   = lazyWithReload(() => import('./SiteCustomizer'));
const LoginPanel   = lazyWithReload(() => import('@/pages/it-admin/AuthPageDesigner'));
const ThemePanel   = lazyWithReload(() => import('./SiteThemePanel'));
const BlocksPanel  = lazyWithReload(() => import('./SiteBlocksPanel'));

type Tab = 'blocks' | 'design' | 'brand' | 'login';

const TABS: { key: Tab; label: string; icon: React.ElementType; hint: string }[] = [
  { key: 'blocks',  label: 'Page',       icon: Blocks,         hint: 'Every section, its words and its pictures' },
  { key: 'design',  label: 'Design',     icon: LayoutTemplate, hint: 'Style, type and backgrounds for the whole site' },
  { key: 'brand',   label: 'Brand',      icon: Palette,        hint: 'Logo, colours, name and web address' },
  { key: 'login',   label: 'Login page', icon: KeyRound,       hint: 'What staff and students see signing in' },
];

export default function SiteDesigner() {
  const { user } = useAuth();
  const slug = (user as unknown as Record<string, unknown>)?.school_slug as string | undefined;

  const [params, setParams] = useSearchParams();
  const [tab, setTabState] = useState<Tab>((params.get('tab') as Tab) ?? 'blocks');

  const setTab = (t: Tab) => {
    setTabState(t);
    setParams(t === 'blocks' ? {} : { tab: t }, { replace: true });
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
        {tab === 'blocks' && <BlocksPanel />}
        {tab === 'design' && <ThemePanel />}
        {tab === 'brand'  && <BrandPanel />}
        {tab === 'login'  && <LoginPanel />}
      </Suspense>
    </div>
  );
}
