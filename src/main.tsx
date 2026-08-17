import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { ToastProvider } from '@/components/shared/Toast'
import { DomainProvider } from '@/context/DomainContext'
import ErrorBoundary from '@/components/shared/ErrorBoundary'
import { installChunkReloadHandler } from '@/utils/lazyWithReload'
import './styles/web-fonts.css'
import './index.css'
import App from './App.tsx'

// A tab open across a deploy asks for chunks the server has replaced.
// Reload once rather than showing the proprietor a module URL.
installChunkReloadHandler()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <DomainProvider>
          {/* Outer net: catches anything above the dashboard shell — the
              sidebar, the header, a public page. The per-page boundary in
              DashboardLayout handles the common case and keeps the shell. */}
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
          <ToastProvider />
        </DomainProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
