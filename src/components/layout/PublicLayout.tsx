import { Outlet, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { BookOpen, Menu, X } from 'lucide-react';
import { socialLinksService, type PlatformSocialLinks } from '@/services/adminService';

// ── Social brand icons (inline SVG — no extra dep needed) ─────────────────────

function SocialIcon({ platform }: { platform: string }) {
  switch (platform) {
    case 'x':
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case 'facebook':
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      );
    case 'youtube':
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      );
    case 'instagram':
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
        </svg>
      );
    case 'tiktok':
      return (
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.27 8.27 0 0 0 4.83 1.55V6.79a4.85 4.85 0 0 1-1.06-.1z" />
        </svg>
      );
    default:
      return null;
  }
}

const SOCIAL_LABELS: Record<string, string> = {
  x: 'X', facebook: 'Facebook', youtube: 'YouTube',
  instagram: 'Instagram', tiktok: 'TikTok',
};

const navLinks = [
  { label: 'Home', href: '/' },
  { label: 'Features', href: '/#features' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'About', href: '/about' },
];

export default function PublicLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const [socialLinks, setSocialLinks] = useState<PlatformSocialLinks | null>(null);

  useEffect(() => {
    socialLinksService.get().then(setSocialLinks).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600 text-white">
              <BookOpen className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold text-slate-900">
              School<span className="text-primary-600">Sync</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className={`text-sm font-medium transition-colors hover:text-primary-600 ${
                  location.pathname === link.href ? 'text-primary-600' : 'text-slate-600'
                }`}
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* CTA buttons */}
          <div className="hidden items-center gap-3 md:flex">
            <Link
              to="/auth/login"
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:text-primary-600"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-700 hover:shadow-md"
            >
              Get Started Free
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="rounded-lg p-2 text-slate-600 md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="border-t border-slate-100 bg-white px-4 pb-4 pt-2 md:hidden">
            <nav className="space-y-1">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3">
              <Link
                to="/auth/login"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2.5 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg bg-primary-600 px-3 py-2.5 text-center text-sm font-semibold text-white"
              >
                Get Started Free
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Page content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
            {/* Brand */}
            <div className="md:col-span-1">
              <Link to="/" className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white">
                  <BookOpen className="h-4 w-4" />
                </div>
                <span className="text-lg font-bold text-slate-900">SchoolSync</span>
              </Link>
              <p className="mt-3 text-sm text-slate-500 leading-relaxed">
                Transforming school management in Liberia with a modern, unified SaaS platform.
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Product</h4>
              <ul className="mt-3 space-y-2">
                <li><a href="/#features" className="text-sm text-slate-500 hover:text-primary-600">Features</a></li>
                <li><Link to="/pricing" className="text-sm text-slate-500 hover:text-primary-600">Pricing</Link></li>
                <li><Link to="/about" className="text-sm text-slate-500 hover:text-primary-600">About</Link></li>
              </ul>
            </div>

            {/* Support */}
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Support</h4>
              <ul className="mt-3 space-y-2">
                <li><Link to="/contact" className="text-sm text-slate-500 hover:text-primary-600">Contact Us</Link></li>
                <li><Link to="/onboarding" className="text-sm text-slate-500 hover:text-primary-600">Onboarding</Link></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Legal</h4>
              <ul className="mt-3 space-y-2">
                <li><Link to="/privacy" className="text-sm text-slate-500 hover:text-primary-600">Privacy Policy</Link></li>
                <li><Link to="/terms" className="text-sm text-slate-500 hover:text-primary-600">Terms of Service</Link></li>
              </ul>
            </div>
          </div>

          {/* Social media icons */}
          {socialLinks && (() => {
            const links = [
              { key: 'x',         url: socialLinks.social_x },
              { key: 'facebook',  url: socialLinks.social_facebook },
              { key: 'youtube',   url: socialLinks.social_youtube },
              { key: 'instagram', url: socialLinks.social_instagram },
              { key: 'tiktok',    url: socialLinks.social_tiktok },
            ].filter((l) => l.url);
            if (links.length === 0) return null;
            return (
              <div className="mt-8 flex items-center gap-3">
                <span className="text-xs text-slate-400 font-medium">Follow us</span>
                <div className="flex items-center gap-2">
                  {links.map(({ key, url }) => (
                    <a
                      key={key}
                      href={/^https?:\/\//i.test(url!) ? url! : `https://${url!}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={SOCIAL_LABELS[key]}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-200 text-slate-600 transition-all hover:bg-primary-600 hover:text-white"
                    >
                      <SocialIcon platform={key} />
                    </a>
                  ))}
                </div>
              </div>
            );
          })()}

          <div className="mt-6 border-t border-slate-200 pt-6 flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
            <p className="text-xs text-slate-400">
              &copy; {new Date().getFullYear()} EduLiberia. SchoolSync v4.0. All rights reserved.
            </p>
            <p className="text-xs text-slate-400">
              Made with ❤️ for Liberian schools
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
