import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import LearningLayout from '../src/app/layouts/LearningLayout';

/**
 * A trilha do modo de estudo abria TODOS os módulos de uma vez.
 *
 * A barra lateral fazia `open={!moduloConcluido(module)}`: todo módulo ainda
 * não terminado nascia aberto, com todas as aulas dentro. Medido no banco de
 * produção em 10/set/2026, o carro-chefe tem **19 módulos e 146 aulas** — para
 * quem está começando, isso é a coluna inteira aberta, cerca de 165 linhas num
 * painel de 288px, e a aula que a pessoa está assistindo perdida no meio dela.
 *
 * No celular era pior: o painel da trilha nem colapso tinha, e não marcava o
 * que já fora concluído nem onde a pessoa estava.
 *
 * ## Por que NÃO é paginação
 *
 * O relato foi "a listagem de módulos e aulas não tem paginação". Paginar seria
 * o conserto errado: a trilha é sequencial, e o valor dela é mostrar o caminho
 * inteiro e onde você está nele — "página 2 de 4" tira as duas coisas, e ainda
 * obriga a saber em que página você está antes de procurar. O que sobrava não
 * era informação demais, era **ruído**: dezoito módulos abertos que a pessoa
 * não está cursando agora.
 *
 * Então a regra que estes casos cobram é essa, e não um desenho: **um módulo
 * aberto — o da aula atual — e nunca nenhum**, porque coluna toda fechada
 * esconde o próximo passo, que é o que ela existe para mostrar.
 */

const MODULOS = 19;
const AULAS_POR_MODULO = 8;

function cursoGrande() {
  return {
    id: 'c-1',
    title: 'Curso de Psicanálise Clínica Online',
    modules: Array.from({ length: MODULOS }, (_, m) => ({
      id: `m-${m + 1}`,
      title: `Módulo ${m + 1}`,
      description: '',
      lessons: Array.from({ length: AULAS_POR_MODULO }, (_, l) => ({
        id: `m${m + 1}-a${l + 1}`,
        title: `Aula ${l + 1} do módulo ${m + 1}`,
      })),
    })),
  };
}

const consulta = vi.hoisted(() => ({
  cursos: {} as Record<string, unknown>,
  progresso: {} as Record<string, unknown>,
}));

vi.mock('../src/app/data/hooks', () => ({
  useCourses: () => consulta.cursos,
  useMyProgress: () => consulta.progresso,
}));

function abrir(rota: string, concluidas: string[] = []) {
  consulta.cursos = { data: [cursoGrande()], isPending: false, isError: false };
  consulta.progresso = {
    data: { completedLessonIds: concluidas, weekMinutes: 0, weeklyGoalMinutes: 180 },
    isPending: false,
    isError: false,
  };
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <Routes>
        <Route path="/curso/:courseId" element={<LearningLayout />}>
          <Route path="aula/:lessonId" element={<div>conteúdo</div>} />
          <Route index element={<div>capa</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

/** Os `<details>` da barra lateral que estão abertos. */
function abertos(container: HTMLElement): HTMLDetailsElement[] {
  return [...container.querySelectorAll('details')].filter(
    (d) => (d as HTMLDetailsElement).open,
  ) as HTMLDetailsElement[];
}

describe('um módulo aberto por vez, e é o da aula que está sendo vista', () => {
  it('não abre os dezenove', () => {
    const { container } = abrir('/curso/c-1/aula/m7-a3');
    expect(container.querySelectorAll('details').length).toBe(MODULOS);
    expect(abertos(container)).toHaveLength(1);
  });

  it('o aberto é o módulo da aula atual', () => {
    const { container } = abrir('/curso/c-1/aula/m7-a3');
    for (const d of abertos(container)) {
      expect(d.textContent).toContain('Módulo 7');
    }
  });

  /*
    Nunca nenhum: uma coluna toda fechada esconde o próximo passo. Na capa do
    curso, sem aula na URL, abre o módulo em andamento.
  */
  it('na capa do curso, abre o módulo em andamento', () => {
    const { container } = abrir('/curso/c-1', ['m4-a1', 'm4-a2']);
    const janelas = abertos(container);
    expect(janelas.length).toBeGreaterThan(0);
    for (const d of janelas) expect(d.textContent).toContain('Módulo 4');
  });

  it('aluno que nunca estudou abre o primeiro, não nenhum', () => {
    const { container } = abrir('/curso/c-1');
    const janelas = abertos(container);
    expect(janelas.length).toBeGreaterThan(0);
    for (const d of janelas) expect(d.textContent).toContain('Módulo 1');
  });

  /*
    Quem terminou tudo não pode ficar com a coluna fechada — é justamente quem
    volta para rever uma aula.
  */
  it('curso inteiro concluído continua com um módulo aberto', () => {
    const todas = Array.from({ length: MODULOS }, (_, m) =>
      Array.from({ length: AULAS_POR_MODULO }, (_, l) => `m${m + 1}-a${l + 1}`),
    ).flat();
    const { container } = abrir('/curso/c-1', todas);
    expect(abertos(container).length).toBeGreaterThan(0);
  });
});

describe('o módulo fechado continua dizendo alguma coisa', () => {
  it('mostra quantas aulas já foram concluídas', () => {
    const { container } = abrir('/curso/c-1/aula/m1-a1', ['m3-a1', 'm3-a2', 'm3-a3']);
    const texto = container.textContent ?? '';
    // Sem isto a coluna vira uma lista de títulos sem estado, e a pessoa abre
    // um a um para descobrir onde parou.
    expect(texto).toContain(`3/${AULAS_POR_MODULO}`);
    expect(texto).toContain(`0/${AULAS_POR_MODULO}`);
  });
});

describe('a trilha do celular deixou de ser uma lista corrida', () => {
  /** O painel do celular só é montado ao ser aberto — daí o clique. */
  async function abrirPainel(container: HTMLElement) {
    await userEvent.click(screen.getByRole('button', { name: /abrir a trilha/i }));
    return container;
  }

  it('ela colapsa, como a do desktop', async () => {
    const { container } = abrir('/curso/c-1/aula/m7-a3');
    const soDesktop = container.querySelectorAll('details').length;
    await abrirPainel(container);
    // Antes o painel do celular renderizava <div> por módulo, sem <details>:
    // abri-lo não acrescentava nenhum módulo colapsável.
    expect(container.querySelectorAll('details').length).toBe(soDesktop + MODULOS);
    // E ele também abre um só.
    expect(abertos(container)).toHaveLength(2);
  });

  it('marca o que já foi concluído', async () => {
    const { container } = abrir('/curso/c-1/aula/m7-a1', ['m7-a1']);
    await abrirPainel(container);
    // A lista do celular não distinguia aula feita de aula por fazer.
    const links = [...container.querySelectorAll('a')].filter((a) =>
      a.getAttribute('href')?.endsWith('/aula/m7-a1'),
    );
    expect(links.length).toBe(2);
    for (const a of links) expect(a.querySelector('svg')).toBeTruthy();
  });

  it('o botão que abre a trilha tem nome para leitor de tela', () => {
    abrir('/curso/c-1/aula/m7-a3');
    expect(screen.getByRole('button', { name: /abrir a trilha/i })).toBeTruthy();
  });
});

describe('renderizar a trilha não pode quebrar fora do navegador', () => {
  /*
    `scrollIntoView` não existe no jsdom: chamá-lo direto derrubaria todo teste
    que renderize esta tela — a mesma armadilha do `matchMedia` no menu mobile.
    Este caso existe porque a guarda é fácil de remover sem ninguém notar: no
    navegador continuaria funcionando.
  */
  it('sobrevive a um ambiente sem scrollIntoView', () => {
    expect(() => abrir('/curso/c-1/aula/m12-a5')).not.toThrow();
    expect(screen.getByText('conteúdo')).toBeTruthy();
  });
});
