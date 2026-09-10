import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import Landing from '../src/app/pages/Landing';

/**
 * A `/ava-pco` falava com o dono da plataforma, não com quem vai comprar.
 *
 * O dono mandou uma auditoria de conversão da página em 10/set/2026, e o
 * diagnóstico batia com o código: a página listava "Score de risco",
 * "recalculado a cada 6 horas", "Gestão de IAs", "Métricas & SEO" e
 * "Limite mensal e escopo configurados em /admin/tutor" — tudo verdadeiro, e
 * tudo escrito da perspectiva de quem OPERA a escola.
 *
 * É a mesma família de defeito que este projeto persegue em `/admin`: tela que
 * fala a linguagem do sistema em vez da de quem lê. Lá custava confiança; aqui
 * custa venda, porque quem lê se sente vigiado em vez de acolhido.
 *
 * E os dois CTAs — "Conhecer o AVA" no topo, "Entrar no AVA" no fim —
 * pressupunham que quem lê já é aluno. Quem chegava pela busca sem ter
 * comprado terminava a página sem para onde ir.
 *
 * ## O que estes casos cobram, e o que NÃO cobram
 *
 * Cobram a **regra**, não a redação: o bastidor não aparece, o caminho para a
 * compra existe, e nenhum número volátil é cravado no markup. Reescrever a
 * copy continua livre.
 *
 * Não cobram as seções que dependem de dado que só o dono tem — garantia,
 * prazo de acesso, depoimentos, faixa numérica de alunos. Elas ficaram
 * deliberadamente **fora** da página: publicar número inventado num site que
 * vende formação em saúde mental é problema de E-E-A-T e de CDC, e este
 * projeto já tomou a decisão equivalente na `/autor`.
 */

const consulta = vi.hoisted(() => ({ cursos: {} as Record<string, unknown> }));

vi.mock('../src/app/data/hooks', () => ({
  useCourses: () => consulta.cursos,
}));

vi.mock('../src/app/components/SiteHeader', () => ({
  default: () => null,
}));

function comCursos(lista: unknown[]) {
  consulta.cursos = { data: lista, isPending: false, isError: false, fetchStatus: 'idle' };
  return render(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>,
  );
}

const CURSO = {
  id: 'c-1',
  title: 'Curso de Psicanálise Clínica Online',
  description: 'Formação completa em psicanálise clínica.',
  active: true,
};

describe('o bastidor não aparece para quem vai comprar', () => {
  it('não mostra o vocabulário de quem opera a escola', () => {
    const { container } = comCursos([CURSO]);
    const texto = container.textContent ?? '';

    // O pior deles: um caminho de rota administrativa impresso na página de venda.
    expect(texto).not.toContain('/admin/tutor');
    expect(texto).not.toContain('Score de risco');
    expect(texto).not.toContain('Gestão de IAs');
    expect(texto).not.toContain('Métricas & SEO');
    expect(texto).not.toContain('Previsão de evasão');
    // "some se ninguém aprovar" descrevia o ciclo de vida de um rascunho.
    expect(texto).not.toContain('aprovar');
  });

  it('não se posiciona atacando ninguém', () => {
    const { container } = comCursos([CURSO]);
    const texto = container.textContent ?? '';
    // Gastava a frase mais nobre da seção mais persuasiva contra um adversário
    // que ninguém tinha citado.
    expect(texto).not.toContain('mascote');
    expect(texto).not.toContain('ranking infantil');
  });

  it('o acompanhamento continua na página, contado do lado do aluno', () => {
    const { container } = comCursos([CURSO]);
    const texto = container.textContent ?? '';
    // Remover a seção não podia remover o benefício: ele é real e é o que
    // diferencia a escola. O que mudou é de que lado ele é contado.
    expect(texto).toContain('retoma');
    expect(texto.toLowerCase()).toContain('plano de retomada');
  });
});

describe('quem ainda não comprou tem para onde ir', () => {
  it('o CTA do topo leva à vitrine, não a uma porta de aluno', () => {
    comCursos([CURSO]);
    const principal = screen.getAllByRole('link', { name: /ver formações e valores/i });
    expect(principal.length).toBeGreaterThan(0);
    expect(principal[0]).toHaveAttribute('href', '/formacoes');
  });

  it('o CTA final oferece a compra primeiro e o login depois', () => {
    comCursos([CURSO]);
    expect(screen.getByRole('link', { name: /escolher minha formação/i })).toHaveAttribute(
      'href',
      '/formacoes',
    );
    // O login continua, para quem já é aluno — só deixou de ser o caminho único.
    expect(screen.getByRole('link', { name: /já sou aluno/i })).toBeTruthy();
  });

  /*
    O botão para a vitrine só aparecia quando havia MAIS de oito cursos — ou
    seja, nunca, com o catálogo de hoje (medido em produção: 2 publicamente
    listados). Numa página de venda, o caminho para a compra não pode depender
    do tamanho do catálogo.
  */
  it('o caminho para a vitrine existe mesmo com poucos cursos', () => {
    comCursos([CURSO]);
    const paraVitrine = screen
      .getAllByRole('link')
      .filter((a) => a.getAttribute('href') === '/formacoes');
    expect(paraVitrine.length).toBeGreaterThanOrEqual(2);
  });

  it('catálogo que não carregou não inventa vitrine', () => {
    consulta.cursos = { data: undefined, isPending: true, isError: false, fetchStatus: 'fetching' };
    const { container } = render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>,
    );
    // A seção some — anunciar cardápio velho é pior que não anunciar —, mas o
    // caminho para a compra continua de pé no hero e no CTA final.
    expect(
      screen.getAllByRole('link').filter((a) => a.getAttribute('href') === '/formacoes').length,
    ).toBeGreaterThan(0);
    expect(container.textContent).not.toContain('formações, um só ambiente');
  });
});

describe('nada volátil é cravado no markup', () => {
  /*
    O plano de conversão pedia "15 formações". A vitrine pública devolve 2
    (medido em produção em 10/set/2026): a copy erraria por treze, e voltaria a
    errar a cada curso publicado ou despublicado.
  */
  it('não crava a quantidade de formações', () => {
    const { container } = comCursos([CURSO, { ...CURSO, id: 'c-2', title: 'Terapia Familiar' }]);
    expect(container.textContent).not.toMatch(/\d+\s+formações/);
  });

  /*
    O teto de parcelas sai de `server/payments/condicoes.ts` e depende do
    gateway roteado — já houve o "12x fantasma" e o cartão de curso que cravava
    "12x" no markup. Aqui a página não fala de preço: manda para a vitrine, que
    é SSR e calcula.
  */
  it('não anuncia preço nem parcelamento', () => {
    const { container } = comCursos([CURSO]);
    const texto = container.textContent ?? '';
    expect(texto).not.toMatch(/\d+x de R\$/);
    expect(texto).not.toMatch(/R\$\s?\d/);
    expect(texto).not.toMatch(/\d+\s?x\s+(sem juros|no cartão)/i);
  });

  /*
    Garantia, prazo de acesso e número de alunos são dados que só o dono tem —
    e prazo tem armadilha própria: declarar meses é RETROATIVO (ver "Prazo de
    acesso" no CLAUDE.md), e nenhum curso declara hoje. A página não pode
    inventá-los enquanto ele não responder.
  */
  it('não promete garantia, prazo de acesso nem contagem de alunos', () => {
    const { container } = comCursos([CURSO]);
    const texto = container.textContent ?? '';
    expect(texto).not.toMatch(/\d+\s*dias de garantia/i);
    expect(texto).not.toMatch(/garantia incondicional/i);
    expect(texto).not.toMatch(/\d[\d.]*\s*alunos/i);
    expect(texto).not.toMatch(/acesso por \d/i);
    // E nenhum placeholder do plano pode ter vazado para a tela.
    expect(texto).not.toContain('[X]');
    expect(texto).not.toContain('[período]');
  });
});

describe('a barra do navegador não muda de cor no meio do site', () => {
  /*
    A troca de paleta de 10/set/2026 levou o SSR para o verde e deixou o
    `index.html` da SPA e o manifest no azul antigo. No celular, a barra do
    navegador MUDAVA DE COR ao ir de /formacoes (SSR) para /login (SPA) — o
    mesmo site com duas identidades, e nada no código reclamando.
  */
  it('o index.html da SPA usa o mesmo theme-color do SSR', async () => {
    const raiz = path.resolve(__dirname, '..');
    const [html, layout] = await Promise.all([
      fs.readFile(path.join(raiz, 'index.html'), 'utf-8'),
      fs.readFile(path.join(raiz, 'server/public/layout.ts'), 'utf-8'),
    ]);

    const cores = (fonte: string) =>
      [...fonte.matchAll(/theme-color"\s+content="(#[0-9a-fA-F]{3,8})"/g)]
        .map((m) => m[1].toLowerCase())
        .sort();

    const doSsr = cores(layout);
    expect(doSsr.length).toBeGreaterThan(0);
    expect(cores(html)).toEqual(doSsr);
  });

  it('o app instalado não nasce com a cor antiga', async () => {
    const manifest = await fs.readFile(
      path.resolve(__dirname, '../public/manifest.webmanifest'),
      'utf-8',
    );
    // O azul que era o token de marca até 10/set/2026.
    expect(manifest.toLowerCase()).not.toContain('#0097b2');
  });
});
