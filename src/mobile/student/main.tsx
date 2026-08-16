import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { ToastProvider } from '@/components/shared/Toast';
import '@/index.css';
import '../mobile-base.css';
import './mobile.css';
import { restoreBranding } from './branding';
import StudentApp from './StudentApp';

// Paint the school's colours before first render, so a returning student
// never sees a flash of generic SchoolSync purple.
restoreBranding();

/**
 * Entry point for the SchoolSync student app.
 *
 * Differs from src/main.tsx in two ways:
 *   - no DomainProvider: custom-domain resolution is a web concern, and it
 *     costs a network round trip before first paint
 *   - mounts StudentApp instead of App, which is what keeps the staff and
 *     admin routes out of this bundle
 *
 * BrowserRouter is safe here — Capacitor serves the built assets from a local
 * HTTP origin, so history routing behaves exactly as it does on the web.
 */

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <StudentApp />
        <ToastProvider />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
