import { describe, it, expect, vi, beforeEach } from 'vitest';
import type React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import CourseAccessNotice from '../src/app/components/CourseAccessNotice';
import LMSCourse from '../src/app/pages/LMSCourse';
import LMSModule from '../src/app/pages/LMSModule';
import { mensagemDeAcesso } from '../shared/mensagens-acesso';
import type { CourseAccessRow } from '../src/app/data/api';

/**
 * O aluno com matrícula suspensa ou cancelada tem de ler o motivo.
 *
 * Até 2/set/2026 ele não lia em lugar nenhum: o card na estante mostrava o
 * curso normal, a página do curso não trazia aviso, e a aula caía no ramo
 * "Conteúdo desta aula ainda não disponível" — que soa como falha da escola em
 * cadastrar a aula, não como pendência dele. Enquanto isso o servidor devolvia
 * 403 com a explicação pronta, que nenhuma tela lia.
 *
 * São **238 suspensas e 138 canceladas** em produção.
 *
 * O componente é o ponto certo para cobrar isso: ele é o mesmo em toda página
 * de curso, e falha aqui é falha em todas.
 */

const acessos = vi.hoisted(() => ({ rows: [] as CourseAccessRow[] }));

const pronta = {
  data: undefined as unknown,
  error: null,
  isPending: false,
  isLoading: false,
  isError: false,
  fetchStatus: 'idle' as const,
  refetch: () => {},
};

vi.mock('../src/app/data/hooks', () => ({
  useMyCourseAccess: () => ({ data: acessos.rows }),
  // O resto é o que as duas telas pedem para chegar até o aviso.
  useCourses: () => ({ ...pronta, data: [CURSO] }),
  useMyProgress: () => ({ data: { completedLessonIds: [] } }),
  useMyNotes: () => ({ data: [] }),
  useCurrentStudent: () => ({ data: null }),
  useMyMentoring: () => ({ data: { configs: [] } }),
}));

vi.mock('../src/app/components/CourseReviews', () => ({ default: () => null }));

const CURSO = vi.hoisted(() => ({
  id: 'c-1',
  slug: 'c-1',
  title: 'Curso de Psicanálise',
  shortTitle: 'Psicanálise',
  description: '',
  coverColor: 'from-pco-blue to-pco-cyan',
  totalHours: 4,
  certificateAvailable: false,
  modules: [
    {
      id: 'm-1',
      courseId: 'c-1',
      title: 'Módulo 1',
      description: '',
      order: 1,
      lessons: [
        {
          id: 'l-1',
          courseId: 'c-1',
          moduleId: 'm-1',
          title: 'Aula 1',
          durationMinutes: 10,
          order: 1,
          isMandatory: false,
        },
      ],
    },
  ],
}));

function linha(state: CourseAccessRow['state']): CourseAccessRow {
  return {
    courseId: 'c-1',
    courseTitle: 'Curso de Psicanálise',
    enrolledAt: '2025-01-10T00:00:00.000Z',
    accessMonths: 12,
    state,
    expiresAt: '2026-12-01T00:00:00.000Z',
    daysLeft: 90,
    canStudy: state !== 'expired' && state !== 'suspended' && state !== 'canceled',
  };
}

function montar(state: CourseAccessRow['state']) {
  acessos.rows = [linha(state)];
  return render(
    <MemoryRouter>
      <CourseAccessNotice courseId="c-1" />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  acessos.rows = [];
});

describe('matrícula suspensa', () => {
  it('diz que está suspensa e por quê', () => {
    montar('suspended');
    expect(screen.getByText(mensagemDeAcesso('suspended').titulo)).toBeInTheDocument();
    expect(screen.getByText(/pagamento pendente/i)).toBeInTheDocument();
  });

  it('não manda renovar — renovar não resolve pagamento pendente', () => {
    // O aviso de vencimento tem um botão "Pedir renovação". Reaproveitá-lo aqui
    // mandaria a pessoa para o caminho errado bem na hora em que ela já está
    // barrada, que é o mesmo erro do e-mail que o sistema não enviava.
    montar('suspended');
    expect(screen.queryByText(/renova/i)).not.toBeInTheDocument();
    expect(screen.getByText(/falar com a coordenação/i)).toBeInTheDocument();
  });

  it('avisa que o progresso não se perde', () => {
    montar('suspended');
    expect(screen.getByText(/progresso.*guardad/i)).toBeInTheDocument();
  });
});

describe('matrícula cancelada', () => {
  it('diz que foi cancelada, e admite que o dado pode estar errado', () => {
    // 138 dos cancelamentos vieram da importação da loja, e a importação já
    // errou antes. "Se isso não confere, fale com a coordenação" é o que evita
    // que um erro de dado vire porta fechada sem recurso.
    montar('canceled');
    expect(screen.getByText(mensagemDeAcesso('canceled').titulo)).toBeInTheDocument();
    expect(screen.getByText(/não confere/i)).toBeInTheDocument();
  });

  it('não é confundida com suspensa', () => {
    montar('canceled');
    expect(screen.queryByText(/pagamento pendente/i)).not.toBeInTheDocument();
  });
});

describe('e nada muda para quem está em dia', () => {
  it('matrícula ativa não gera aviso nenhum', () => {
    const { container } = montar('active');
    expect(container).toBeEmptyDOMElement();
  });

  it('acesso vitalício também não', () => {
    const { container } = montar('lifetime');
    expect(container).toBeEmptyDOMElement();
  });

  it('o aviso de vencimento continua como era', () => {
    montar('expired');
    expect(screen.getByText(/acesso a este curso terminou/i)).toBeInTheDocument();
    expect(screen.getByText(/pedir renovação/i)).toBeInTheDocument();
  });

  it('o aviso de "vence em breve" continua aparecendo para quem está vencendo', () => {
    montar('expiring');
    expect(screen.getByText(/termina em 90 dias/i)).toBeInTheDocument();
  });

  it('estado desconhecido cala, em vez de inventar contagem regressiva', () => {
    // O ramo final já foi um `else`: estado novo caía nele e virava "seu acesso
    // termina em N dias" para alguém cujo caso era outro.
    acessos.rows = [{ ...linha('active'), state: 'algo-novo' as CourseAccessRow['state'] }];
    const { container } = render(
      <MemoryRouter>
        <CourseAccessNotice courseId="c-1" />
      </MemoryRouter>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('curso sem linha de acesso não renderiza nada', () => {
    acessos.rows = [];
    const { container } = render(
      <MemoryRouter>
        <CourseAccessNotice courseId="c-1" />
      </MemoryRouter>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

/**
 * ALU4-004 · o aviso tem de estar em toda tela de onde se clica para a aula.
 *
 * A página do curso ganhou o aviso em 2/set/2026; a **do módulo, não** — e ela
 * é o caminho de quem já está estudando, além de ser para onde os e-mails de
 * retomada apontam. Quem entrasse por ali só descobria a suspensão ao bater no
 * 403 da aula seguinte, que é exatamente o silêncio que este componente existe
 * para acabar.
 */
describe('onde o aviso aparece', () => {
  function montarTela(Tela: React.ComponentType, rota: string, caminho: string) {
    acessos.rows = [linha('suspended')];
    return render(
      <MemoryRouter initialEntries={[rota]}>
        <Routes>
          <Route path={caminho} element={<Tela />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('a página do curso avisa', () => {
    montarTela(LMSCourse, '/curso/c-1', '/curso/:courseId');
    expect(screen.getByText(new RegExp(mensagemDeAcesso('suspended').titulo, 'i'))).toBeInTheDocument();
  });

  it('a página do módulo também — é de onde se clica para a aula', () => {
    montarTela(LMSModule, '/curso/c-1/modulo/m-1', '/curso/:courseId/modulo/:moduleId');
    expect(screen.getByText(new RegExp(mensagemDeAcesso('suspended').titulo, 'i'))).toBeInTheDocument();
  });
});
