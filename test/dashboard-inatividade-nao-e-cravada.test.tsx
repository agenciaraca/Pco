import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../src/app/i18n';
import AdminDashboard from '../src/app/pages/admin/AdminDashboard';

/**
 * "Acessos recentes / Janelas de inatividade" mostrava três números
 * CRAVADOS no `.tsx` — 38, 19, 12 — em qualquer estado real do banco. É a
 * mesma classe de defeito que este projeto já documentou na home e no
 * `/admin/metricas`: número inventado, nunca ligado a dado nenhum. Achado
 * em 12/set/2026, numa varredura autônoma.
 *
 * `useAdminStudents` já trazia `lastAccessAt` por aluno — a correção não
 * precisou de rota nova, só de calcular em cima do que já chegava.
 */

const pronta = {
  data: undefined as unknown,
  error: null,
  isPending: false,
  isLoading: false,
  isError: false,
  fetchStatus: 'idle' as const,
  refetch: () => {},
};

const HOJE = Date.parse('2026-09-12T12:00:00.000Z');

function aluno(id: string, status: string, diasSemAcesso: number) {
  const lastAccessAt = new Date(HOJE - diasSemAcesso * 86_400_000).toISOString();
  return {
    id,
    name: `Aluno ${id}`,
    email: `${id}@teste.local`,
    enrolledCourseIds: [],
    progressByCourse: {},
    status,
    riskScore: 0,
    lastAccessAt,
    createdAt: '2025-01-01T00:00:00.000Z',
  };
}

const mocks = vi.hoisted(() => ({ students: [] as unknown[] }));

vi.mock('../src/app/data/hooks', () => ({
  useHealth: () => ({ ...pronta, data: undefined }),
  useRetentionRisks: () => ({ ...pronta, data: [] }),
  useAdminStudents: () => ({ ...pronta, data: mocks.students }),
  useCourses: () => ({ ...pronta, data: [] }),
  useAllCertificates: () => ({ ...pronta, data: [] }),
  useAuditLog: () => ({ ...pronta, data: [] }),
  useCompletionsStats: () => ({ ...pronta, data: undefined }),
  useAdminAlerts: () => ({ ...pronta, data: undefined }),
  useAdminKpis: () => ({ ...pronta, data: undefined, isPending: false }),
}));

function montar() {
  return render(
    <I18nProvider>
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>
    </I18nProvider>,
  );
}

describe('a janela de inatividade do dashboard é calculada, não cravada', () => {
  it('conta de verdade quantos alunos ativos estão sem acesso há 7/14/30 dias', () => {
    mocks.students = [
      aluno('a1', 'ativo', 3), // dentro de todas as janelas: não conta em nenhuma
      aluno('a2', 'ativo', 10), // conta em 7d, não em 14d/30d
      aluno('a3', 'ativo', 20), // conta em 7d e 14d, não em 30d
      aluno('a4', 'ativo', 40), // conta nas três
      aluno('a5', 'bloqueado', 40), // bloqueado não entra na contagem de inatividade
    ];
    montar();
    // 7d: a2, a3, a4 = 3 · 14d: a3, a4 = 2 · 30d: a4 = 1
    expect(screen.getByText('Sem acesso 7d').previousSibling?.textContent).toBe('3');
    expect(screen.getByText('Sem acesso 14d').previousSibling?.textContent).toBe('2');
    expect(screen.getByText('Sem acesso 30d').previousSibling?.textContent).toBe('1');
  });

  it('nunca mostra os números cravados antigos (38/19/12) quando o dado real é outro', () => {
    mocks.students = [aluno('a1', 'ativo', 100)];
    montar();
    expect(screen.getByText('Sem acesso 7d').previousSibling?.textContent).toBe('1');
    expect(screen.queryByText('38')).not.toBeInTheDocument();
    expect(screen.queryByText('19')).not.toBeInTheDocument();
  });

  it('zero alunos inativos mostra 0 de verdade — dado medido, não travessão', () => {
    mocks.students = [aluno('a1', 'ativo', 1)];
    montar();
    expect(screen.getByText('Sem acesso 30d').previousSibling?.textContent).toBe('0');
  });
});
