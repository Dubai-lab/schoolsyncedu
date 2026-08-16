import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { ToastProvider } from '@/components/shared/Toast';
import '@/index.css';
import '../mobile-base.css';
import AttendApp from './AttendApp';

/**
 * Entry point for SchoolSync Attend.
 *
 * Like the student entry, no DomainProvider and no import of src/App.tsx —
 * that is what keeps the staff and admin routes out of this bundle.
 */

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AttendApp />
        <ToastProvider />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
