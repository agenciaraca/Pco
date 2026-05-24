import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { server } from './msw/server';
import { renderWithProviders } from './msw/test-utils';
import { AuthProvider } from '../src/app/auth/AuthContext';
import { I18nProvider } from '../src/app/i18n';
import { ToastProvider } from '../src/app/components/Toast';

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'bypass' });
});
afterEach(() => {
  server.resetHandlers();
  localStorage.clear();
});
afterAll(() => {
  server.close();
});

function createQc() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
}

function hookWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <I18nProvider>
          <AuthProvider>
            <ToastProvider>{children}</ToastProvider>
          </AuthProvider>
        </I18nProvider>
      </QueryClientProvider>
    );
  };
}

function setAuth() {
  localStorage.setItem(
    'ava-pco-auth',
    JSON.stringify({
      user: { id: 'stu-001', name: 'Aluno', email: 'a@t.local', role: 'student' },
      token: 'mock-jwt-token-123',
    }),
  );
}

describe('UI Integration — Hooks with MSW', () => {
  it('useCourses fetches from /api/courses via MSW', async () => {
    const { useCourses } = await import('../src/app/data/hooks');
    const qc = createQc();
    const { result } = renderHook(() => useCourses(), { wrapper: hookWrapper(qc) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].title).toBe('Psicanálise Clínica');
  });

  it('useMyProgress fetches with auth token via MSW', async () => {
    setAuth();
    const { useMyProgress } = await import('../src/app/data/hooks');
    const qc = createQc();
    const { result } = renderHook(() => useMyProgress(), { wrapper: hookWrapper(qc) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.completedLessonIds).toContain('psi-mod-1-les-1');
  });

  it('useRetentionRisks fetches retention data via MSW', async () => {
    const { useRetentionRisks } = await import('../src/app/data/hooks');
    const qc = createQc();
    const { result } = renderHook(() => useRetentionRisks(), { wrapper: hookWrapper(qc) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});

describe('UI Integration — Login page render', () => {
  it('renderiza campos de e-mail e senha', async () => {
    const Login = (await import('../src/app/pages/Login')).default;
    renderWithProviders(<Login />, { route: '/login' });

    expect(screen.getByLabelText(/e-?mail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument();
  });

  it('mostra botão de submit no form', async () => {
    const Login = (await import('../src/app/pages/Login')).default;
    renderWithProviders(<Login />, { route: '/login' });

    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });
});

describe('UI Integration — Eventos page', () => {
  it('renderiza página de eventos', async () => {
    setAuth();
    const Eventos = (await import('../src/app/pages/Eventos')).default;
    renderWithProviders(<Eventos />, { authenticated: true });

    await waitFor(() => {
      expect(screen.getAllByText(/sem encontros|eventos|encontros/i).length).toBeGreaterThan(0);
    });
  });
});

describe('UI Integration — Quiz API via hooks', () => {
  it('fetchQuiz retorna questões via MSW', async () => {
    setAuth();
    const api = await import('../src/app/data/api');
    const result = await api.fetchQuiz('c-psi', { max: 10 });
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].prompt).toContain('transferência');
    expect(result.questions[0].options).toHaveLength(2);
  });

  it('submitQuiz retorna resultado via MSW', async () => {
    setAuth();
    const api = await import('../src/app/data/api');
    const result = await api.submitQuiz('c-psi', [
      { questionId: 'q1', selectedOptionIds: ['o1'] },
    ]);
    expect(result.pct).toBe(100);
    expect(result.results[0].correct).toBe(true);
  });
});
