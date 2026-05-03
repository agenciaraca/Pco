// Stub de monitoramento. Quando VITE_SENTRY_DSN for definido em build,
// inicializa Sentry. Caso contrário, fallback no console.
//
// Para habilitar:
// 1. npm install @sentry/react
// 2. Defina VITE_SENTRY_DSN no .env (ou nas envs do Vercel)
// 3. Descomente o bloco initSentry abaixo

let initialized = false;

export function initMonitoring() {
  if (initialized) return;
  initialized = true;

  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  // Quando @sentry/react estiver instalado, descomente:
  //
  // import * as Sentry from '@sentry/react';
  // Sentry.init({
  //   dsn,
  //   environment: import.meta.env.MODE,
  //   tracesSampleRate: 0.2,
  //   replaysSessionSampleRate: 0.0,
  //   replaysOnErrorSampleRate: 1.0,
  // });

  // eslint-disable-next-line no-console
  console.warn(
    '[monitoring] VITE_SENTRY_DSN definido mas @sentry/react não instalado. Rode: npm install @sentry/react',
  );
}

export function reportError(
  error: unknown,
  context?: Record<string, unknown>,
) {
  // Em prod com Sentry: Sentry.captureException(error, { extra: context })
  // eslint-disable-next-line no-console
  console.error('[error]', error, context);
}
