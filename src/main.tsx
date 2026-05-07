import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './app/auth/AuthContext';
import { I18nProvider } from './app/i18n';
import { ToastProvider } from './app/components/Toast';
import ErrorBoundary from './app/components/ErrorBoundary';
import { initMonitoring } from './app/monitoring/sentry';
import { installChunkErrorRecovery } from './app/monitoring/chunk-error-recovery';
import { router } from './app/routes';
import './styles/theme.css';

initMonitoring();

// Auto-reload quando lazy chunk falha (deploy novo invalidou os hashes).
installChunkErrorRecovery();

// PWA: registra service worker em produção (skip em dev pra não interferir no HMR).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // ignora — SW é progressivo
    });
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error: unknown) => {
        const status =
          typeof error === 'object' && error !== null && 'status' in error
            ? Number((error as { status: number }).status)
            : 0;
        if (status >= 400 && status < 500) return false; // não retry em 4xx
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <AuthProvider>
            <ToastProvider>
              <RouterProvider router={router} />
            </ToastProvider>
          </AuthProvider>
        </I18nProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
