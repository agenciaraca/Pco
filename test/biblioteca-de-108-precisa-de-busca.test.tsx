import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Library from '../src/app/pages/Library';

/**
 * A tela da biblioteca foi desenhada para meia dúzia de itens, e passou a ter 108.
 *
 * Em 10/set/2026 a importação do LMS antigo trouxe **108 PDFs**. Medido no
 * acervo de produção, os quatro filtros desta tela viraram **constantes**:
 *
 * | filtro | como ficou nos 108 |
 * | --- | --- |
 * | tipo | `pdf` em 108 |
 * | obrigatório | `false` em 108 |
 * | curso | nenhum ligado |
 * | tag | `acervo` em 108 |
 *
 * Cada um dividia 108 em 108-e-0, e **não havia busca por texto**. Quem
 * procurasse "Luto e Melancolia" rolava 108 cartões.
 *
 * **Um filtro que não divide nada não é só ruído — ele mente.** A lista de
 * tipos era cravada no código (`pdf | apostila | leitura | artigo`), então
 * clicar em "APOSTILA" devolvia *"Nenhum material com esses filtros"*, que se
 * lê como **a escola não tem apostilas**. É a mesma regra que este projeto já
 * aplica às telas de métrica: ausência de resultado não pode passar por
 * ausência de acervo.
 *
 * Os casos abaixo cobram a **regra**, não o desenho: a busca acha por título e
 * por autor, ignora acento nos dois sentidos, e controle que não pode mudar o
 * resultado não vai para a tela.
 */

const consulta = vi.hoisted(() => ({
  biblioteca: {} as Record<string, unknown>,
  cursos: {} as Record<string, unknown>,
}));

vi.mock('../src/app/data/hooks', () => ({
  useLibrary: () => consulta.biblioteca,
  useCourses: () => consulta.cursos,
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

/** O acervo real, na forma em que ele chegou: tudo igual em todo campo. */
const ACERVO_IMPORTADO = [
  {
    id: 'l1',
    title: 'Luto e Melancolia',
    author: 'Sigmund Freud',
    type: 'pdf',
    mandatory: false,
    fileMockUrl: '/uploads/a.pdf',
    relatedCourseIds: [],
    tags: ['acervo'],
  },
  {
    id: 'l2',
    title: 'Os Arquétipos e o Inconsciente Coletivo',
    author: 'Carl G. Jung',
    type: 'pdf',
    mandatory: false,
    fileMockUrl: '/uploads/b.pdf',
    relatedCourseIds: [],
    tags: ['acervo'],
  },
  {
    id: 'l3',
    title: 'Teorias da personalidade',
    author: 'Acervo PCO',
    type: 'pdf',
    mandatory: false,
    fileMockUrl: '/uploads/c.pdf',
    relatedCourseIds: [],
    tags: ['acervo'],
  },
];

function montar(itens: unknown[] = ACERVO_IMPORTADO, cursos: unknown[] = []) {
  consulta.biblioteca = pronta(itens);
  consulta.cursos = pronta(cursos);
  return render(
    <MemoryRouter>
      <Library />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  consulta.biblioteca = pronta([]);
  consulta.cursos = pronta([]);
});

describe('a busca acha o que 108 cartões escondem', () => {
  it('acha pelo título', async () => {
    montar();
    await userEvent.type(screen.getByRole('searchbox'), 'melancolia');
    expect(screen.getByText('Luto e Melancolia')).toBeTruthy();
    expect(screen.queryByText('Teorias da personalidade')).toBeNull();
  });

  it('acha pelo AUTOR — que é a segunda coisa que alguém sabe de um livro', async () => {
    montar();
    await userEvent.type(screen.getByRole('searchbox'), 'jung');
    expect(screen.getByText('Os Arquétipos e o Inconsciente Coletivo')).toBeTruthy();
    expect(screen.queryByText('Luto e Melancolia')).toBeNull();
  });

  it('ignora acento no que foi digitado', async () => {
    // Ninguém digita acento no celular, e o acervo é cheio deles.
    montar();
    await userEvent.type(screen.getByRole('searchbox'), 'arquetipos');
    expect(screen.getByText('Os Arquétipos e o Inconsciente Coletivo')).toBeTruthy();
  });

  it('e também acha quando o acento VEM digitado', async () => {
    // A metade que se esquece: normalizar só o alvo faria o termo com acento
    // deixar de casar com o título sem acento.
    montar();
    await userEvent.type(screen.getByRole('searchbox'), 'Arquétipos');
    expect(screen.getByText('Os Arquétipos e o Inconsciente Coletivo')).toBeTruthy();
  });

  it('não achar nada diz que foi a BUSCA, não que o acervo está vazio', async () => {
    montar();
    await userEvent.type(screen.getByRole('searchbox'), 'lacan');
    expect(screen.getByText(/Nada encontrado para/)).toBeTruthy();
    // E diz o que fazer em seguida.
    expect(screen.getByText(/nome do autor/)).toBeTruthy();
  });
});

describe('controle que não pode mudar o resultado não vai para a tela', () => {
  it('sem tipo variado, o filtro de tipo some — em vez de mentir sobre apostilas', () => {
    montar();
    // Este era o pior: a lista era cravada no código, então "APOSTILA" existia
    // como opção num acervo que não tem nenhuma, e devolvia "nenhum material".
    expect(screen.queryByText('APOSTILA')).toBeNull();
    expect(screen.queryByText('Qualquer tipo')).toBeNull();
  });

  it('com tipos de verdade, o filtro aparece — e só com os que existem', () => {
    montar([
      { ...ACERVO_IMPORTADO[0] },
      { ...ACERVO_IMPORTADO[1], id: 'l9', type: 'artigo' },
    ]);
    expect(screen.getByText('PDF')).toBeTruthy();
    expect(screen.getByText('ARTIGO')).toBeTruthy();
    // O que não existe no acervo continua fora.
    expect(screen.queryByText('APOSTILA')).toBeNull();
  });

  it('tudo complementar: o filtro obrigatório/complementar some', () => {
    montar();
    expect(screen.queryByText('Obrigatórios')).toBeNull();
  });

  it('havendo os dois, ele aparece', () => {
    montar([ACERVO_IMPORTADO[0], { ...ACERVO_IMPORTADO[1], id: 'l8', mandatory: true }]);
    expect(screen.getByText('Obrigatórios')).toBeTruthy();
  });

  it('curso sem material nenhum não vira filtro', () => {
    montar(ACERVO_IMPORTADO, [{ id: 'c1', shortTitle: 'Formação em Psicanálise' }]);
    // Nenhum dos 108 está ligado a curso: oferecer o curso como filtro faria
    // o aluno concluir que aquele curso não tem material de apoio.
    expect(screen.queryByText('Formação em Psicanálise')).toBeNull();
  });

  it('curso COM material vira filtro', () => {
    montar([{ ...ACERVO_IMPORTADO[0], relatedCourseIds: ['c1'] }], [
      { id: 'c1', shortTitle: 'Formação em Psicanálise' },
    ]);
    expect(screen.getByText('Formação em Psicanálise')).toBeTruthy();
  });

  it('uma tag só não é filtro — é rótulo repetido em tudo', () => {
    montar();
    expect(screen.queryByText('Tags:')).toBeNull();
  });
});
