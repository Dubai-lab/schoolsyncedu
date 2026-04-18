import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { ToastProvider } from '@/components/shared/Toast'
import { DomainProvider } from '@/context/DomainContext'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <DomainProvider>
          <App />
          <ToastProvider />
        </DomainProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
