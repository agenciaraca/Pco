import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Podcasts from '../src/app/pages/Podcasts';

/**
 * A lista de podcasts tem a mesma forma do defeito da biblioteca — e a mesma causa.
 *
 * A importação de 10/set/2026 encheu as duas telas no mesmo dia. Medido em
 * produção: **43 episódios, todos com a mesma tag "PCO POD"**, e nenhum campo
 * de busca. A fileira de tags mostrava `Todos | PCO POD` — um filtro com uma
 * alternativa, que não filtra nada e ocupa a primeira dobra.
 *
 * Quem procurasse um episódio pelo nome rolava 43 cartões.
 *
 * A regra que os casos cobram é a mesma da biblioteca, e é por isso que o
 * normalizador mora em `src/app/lib/busca.ts` e não em cada tela: duas cópias
 * da mesma regra acabam discordando, e quem paga é quem está procurando.
 */

const consulta = vi.hoisted(() => ({ podcasts: {} as Record<string, unknown> }));

vi.mock('../src/app/data/hooks', () => ({
  usePodcasts: () => consulta.podcasts,
  useMyPodcastEngagement: () => ({ data: [] }),
  useSetPodcastEngagement: () => ({ isPending: false, mutateAsync: async () => {} }),
}));
vi.mock('../src/app/components/Toast', () => ({
  useToast: () => ({ success: () => {}, error: () => {}, info: () => {} }),
}));

function pronta(data: unknown) {
  return {
    data,
    error: null,
    isPending: false,
    isLoading: false,
    isError: false,
    fetchStatus: 'idle',
    refetch: () => {},
  };
}

/** Como os 43 chegaram: mesma tag, e a descrição igual ao título. */
const IMPORTADOS = [
  {
    id: 'p1',
    title: 'Psicanálise e cultura: o que o inconsciente revela',
    description: 'Psicanálise e cultura: o que o inconsciente revela',
    durationMinutes: 4,
    publishedAt: '2026-09-01T00:00:00.000Z',
    coverColor: 'from-pco-blue to-pco-deep',
    tags: ['PCO POD'],
  },
  {
    id: 'p2',
    title: 'O luto na clínica contemporânea',
    description: 'O luto na clínica contemporânea',
    durationMinutes: 7,
    publishedAt: '2026-09-02T00:00:00.000Z',
    coverColor: 'from-pco-blue to-pco-deep',
    tags: ['PCO POD'],
  },
];

function montar(itens: unknown[] = IMPORTADOS) {
  consulta.podcasts = pronta(itens);
  return render(
    <MemoryRouter>
      <Podcasts />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  consulta.podcasts = pronta([]);
});

describe('busca nos episódios', () => {
  it('acha pelo título', async () => {
    montar();
    await userEvent.type(screen.getByRole('searchbox'), 'luto');
    expect(screen.getByText('O luto na clínica contemporânea')).toBeTruthy();
    expect(screen.queryByText(/Psicanálise e cultura/)).toBeNull();
  });

  it('ignora acento no que foi digitado', async () => {
    montar();
    await userEvent.type(screen.getByRole('searchbox'), 'clinica');
    expect(screen.getByText('O luto na clínica contemporânea')).toBeTruthy();
  });

  it('e acha também com o acento digitado', async () => {
    montar();
    await userEvent.type(screen.getByRole('searchbox'), 'Psicanálise');
    expect(screen.getByText(/Psicanálise e cultura/)).toBeTruthy();
  });

  it('não achar nada diz que foi a busca', async () => {
    montar();
    await userEvent.type(screen.getByRole('searchbox'), 'lacan');
    expect(screen.getByText(/Nada encontrado para/)).toBeTruthy();
  });
});

describe('a fileira de tags só existe quando separa alguma coisa', () => {
  it('uma tag só não vira filtro', () => {
    montar();
    // Os 43 importados têm todos "PCO POD": a fileira mostrava `Todos | PCO POD`
    // e clicar em qualquer um dos dois devolvia exatamente a mesma lista.
    //
    // A busca é por BOTÃO, e não por texto, porque o H1 da própria página é
    // "PCO POD" — `queryByText` casava com o título e o teste falhava sobre um
    // código correto. Foi o que aconteceu na primeira versão deste arquivo.
    expect(screen.queryByRole('button', { name: 'PCO POD' })).toBeNull();
  });

  it('duas tags viram filtro', () => {
    montar([IMPORTADOS[0], { ...IMPORTADOS[1], id: 'p9', tags: ['Clínica'] }]);
    expect(screen.getByRole('button', { name: 'PCO POD' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Clínica' })).toBeTruthy();
  });
});

describe('o resumo repetido não vira bloco', () => {
  it('descrição igual ao título não aparece duas vezes', () => {
    montar([IMPORTADOS[0]]);
    // A origem não tem resumo — nem o LearnDash, nem a Vimeo. A importação
    // gravou o título ali em vez de inventar texto; repeti-lo no cartão faria
    // a mesma frase aparecer colada duas vezes.
    expect(screen.getAllByText(/Psicanálise e cultura/)).toHaveLength(1);
  });
});
