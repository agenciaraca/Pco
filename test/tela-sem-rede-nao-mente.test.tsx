import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LMSCourse from '../src/app/pages/LMSCourse';
import LMSModule from '../src/app/pages/LMSModule';
import LMSAssessment from '../src/app/pages/LMSAssessment';

/**
 * REG-016/017 e TELA-005 · sem rede não é "não existe".
 *
 * A auditoria de 3/set/2026 encontrou **76 arquivos** que usam `isLoading` e
 * não têm `isError` em lugar nenhum. A causa é uma sutileza do TanStack Query
 * v5 que não aparece lendo o código:
 *
 * > Requisição feita **sem conexão** fica com `fetchStatus: 'paused'`. Nesse
 * > estado `isLoading` é **`false`** — ele é `isPending && isFetching`, e nada
 * > está sendo buscado — e `isError` também é `false`, porque não houve erro: a
 * > requisição nem partiu.
 *
 * Ou seja, o estado mais comum do mundo real — celular no metrô — não é nem
 * "carregando" nem "erro". Numa tela que só conhece esses dois, a execução
 * escorre até o ramo final, que era `if (!course)`. E o ramo final dizia, ou
 * fazia, a coisa mais ofensiva possível:
 *
 * - `LMSCourse`, `LMSModule`, `LMSAssessment`, `Quiz`: `<Navigate to="/cursos" />`
 *   — o aluno era **jogado para fora da aula sem uma palavra**.
 * - `LearningLayout`: **"Este curso não existe ou não está na sua estante"** —
 *   sobre um curso que ele cursa e pagou.
 *
 * E há um segundo caminho para o mesmo ramo, que não tem nada a ver com rede:
 * as **418 contas com login e sem ficha de aluno** em produção. Para elas o
 * catálogo não devolve as matrículas, então o curso legítimo não está na lista
 * e a tela afirmava que ele não existe. Antes da correção de 3/set a tela
 * mostrava o curso *errado*; depois dela, negava o *certo*.
 *
 * Por isso os casos abaixo cobram duas coisas, e a segunda é a que se esquece:
 *
 * 1. Offline e erro têm tela própria, com o que fazer.
 * 2. **A tela nunca afirma que o curso não existe** — nem no ramo de "não
 *    encontrei". Ela não sabe, e dizer isso a quem pagou manda embora justo
 *    quem precisa de ajuda.
 */

const consulta = vi.hoisted(() => ({
  cursos: {} as Record<string, unknown>,
  progresso: {} as Record<string, unknown>,
}));

vi.mock('../src/app/data/hooks', () => ({
  useCourses: () => consulta.cursos,
  useMyProgress: () => consulta.progresso,
  useCurrentStudent: () => ({ data: null }),
  useMyMentoring: () => ({ data: { configs: [] } }),
  useMyNotes: () => ({ data: [] }),
}));

/** Uma consulta do TanStack v5 em cada um dos estados que importam. */
const estados = {
  /** Sem conexão: o estado que nenhuma das telas conhecia. */
  offline: {
    data: undefined,
    error: null,
    isPending: true,
    isLoading: false, // <- o ponto: `isLoading` é FALSE offline
    isError: false,
    fetchStatus: 'paused' as const,
    refetch: () => {},
  },
  carregando: {
    data: undefined,
    error: null,
    isPending: true,
    isLoading: true,
    isError: false,
    fetchStatus: 'fetching' as const,
    refetch: () => {},
  },
  erro: {
    data: undefined,
    error: new Error('O servidor não respondeu (500).'),
    isPending: false,
    isLoading: false,
    isError: true,
    fetchStatus: 'idle' as const,
    refetch: () => {},
  },
  /** Carregou, e o curso não está na lista — o caso das 418 contas sem ficha. */
  semOCurso: {
    data: [] as unknown[],
    error: null,
    isPending: false,
    isLoading: false,
    isError: false,
    fetchStatus: 'idle' as const,
    refetch: () => {},
  },
};

beforeEach(() => {
  consulta.cursos = estados.carregando;
  consulta.progresso = { data: { completedLessonIds: [] } };
});

// Imports estáticos, não `import(`...${tela}`)`: o template literal impede o
// Vite de resolver o módulo em tempo de build, e a suíte trava sem dizer por
// quê — descoberto do jeito difícil ao escrever este arquivo.
const TELAS = {
  LMSCourse,
  LMSModule,
  LMSAssessment,
} as const;

function montar(tela: keyof typeof TELAS) {
  const Componente = TELAS[tela];
  return render(
    <MemoryRouter initialEntries={['/curso/c-1']}>
      <Componente />
    </MemoryRouter>,
  );
}

describe('sem conexão, a tela diz "sem conexão"', () => {
  for (const tela of ['LMSCourse', 'LMSModule', 'LMSAssessment'] as const) {
    it(`${tela} não empurra o aluno para fora`, () => {
      consulta.cursos = estados.offline;
      montar(tela);

      expect(screen.getByText(/sem conexão/i)).toBeInTheDocument();
      // O texto que estava lá antes, e que era falso.
      expect(screen.queryByText(/não existe/i)).not.toBeInTheDocument();
    });
  }
});

describe('erro de servidor, a tela diz o que houve e oferece saída', () => {
  for (const tela of ['LMSCourse', 'LMSModule', 'LMSAssessment'] as const) {
    it(`${tela} mostra o motivo e um botão de tentar de novo`, () => {
      consulta.cursos = estados.erro;
      montar(tela);

      expect(screen.getByText(/não respondeu/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /tentar de novo/i })).toBeInTheDocument();
      expect(screen.queryByText(/não existe/i)).not.toBeInTheDocument();
    });
  }
});

describe('curso fora da lista: a tela não afirma o que não sabe', () => {
  it('não diz "não existe" — pode ser uma das 418 contas sem ficha', () => {
    consulta.cursos = estados.semOCurso;
    montar('LMSCourse');

    // Este é o ramo legítimo de "não encontrei". Mesmo aqui, a afirmação de
    // inexistência é proibida: quem chega por conta sem ficha tem o curso.
    expect(screen.getByText(/não achei este curso/i)).toBeInTheDocument();
    expect(screen.queryByText(/não existe/i)).not.toBeInTheDocument();
    // E tem para onde ir — mandar embora sem saída é o que fazia o Navigate.
    expect(screen.getByRole('link', { name: /secretaria/i })).toBeInTheDocument();
  });
});

describe('carregando de verdade continua sendo carregando', () => {
  it('não mostra erro nem "não encontrei" enquanto busca', () => {
    consulta.cursos = estados.carregando;
    montar('LMSCourse');

    // Guarda contra "consertar" mostrando erro para quem só está esperando.
    expect(screen.queryByText(/sem conexão/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/não achei/i)).not.toBeInTheDocument();
  });
});
