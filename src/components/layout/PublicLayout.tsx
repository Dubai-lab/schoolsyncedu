import { Outlet, Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { BookOpen, Menu, X } from 'lucide-react';

const navLinks = [
  { label: 'Home', href: '/' },
  { label: 'Features', href: '/#features' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'About', href: '/#about' },
];

export default function PublicLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

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
                <li><a href="/#about" className="text-sm text-slate-500 hover:text-primary-600">About</a></li>
              </ul>
            </div>

            {/* Support */}
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Support</h4>
              <ul className="mt-3 space-y-2">
                <li><a href="mailto:support@eduliberia.com" className="text-sm text-slate-500 hover:text-primary-600">Contact Us</a></li>
                <li><a href="mailto:onboarding@eduliberia.com" className="text-sm text-slate-500 hover:text-primary-600">Onboarding</a></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Legal</h4>
              <ul className="mt-3 space-y-2">
                <li><a href="#" className="text-sm text-slate-500 hover:text-primary-600">Privacy Policy</a></li>
                <li><a href="#" className="text-sm text-slate-500 hover:text-primary-600">Terms of Service</a></li>
              </ul>
            </div>
          </div>

          <div className="mt-10 border-t border-slate-200 pt-6 flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
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
