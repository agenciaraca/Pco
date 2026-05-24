import { type ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../src/app/auth/AuthContext';
import { I18nProvider } from '../../src/app/i18n';
import { ToastProvider } from '../../src/app/components/Toast';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

interface WrapperOptions {
  route?: string;
  authenticated?: boolean;
}

function createWrapper(opts: WrapperOptions = {}) {
  const { route = '/', authenticated = false } = opts;

  if (authenticated) {
    localStorage.setItem(
      'ava-pco-auth',
      JSON.stringify({
        user: {
          id: 'stu-001',
          name: 'Aluno Teste',
          email: 'aluno@test.local',
          role: 'student',
        },
        token: 'mock-jwt-token-123',
      }),
    );
  }

  const qc = createTestQueryClient();

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <I18nProvider>
          <AuthProvider>
            <ToastProvider>
              <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
            </ToastProvider>
          </AuthProvider>
        </I18nProvider>
      </QueryClientProvider>
    );
  };
}

export function renderWithProviders(
  ui: React.ReactElement,
  options: WrapperOptions & Omit<RenderOptions, 'wrapper'> = {},
) {
  const { route, authenticated, ...renderOptions } = options;
  const wrapper = createWrapper({ route, authenticated });
  return render(ui, { wrapper, ...renderOptions });
}
