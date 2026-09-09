import { describe, it, expect, beforeAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { NAV } from '../server/public/layout';

/**
 * O hero da home começava 160px à direita do resto do site.
 *
 * O contêiner dele tinha `max-width:860px` inline enquanto o site usa
 * `--wrap: 1180px`. Como `.wrap` é `margin:0 auto`, encolher a largura
 * **centraliza** a coluna: numa janela de 1365px a borda esquerda do texto do
 * hero caía em 276px, contra 116px de todas as outras seções. As seções
 * "Sobre a PCO" e "Sua carreira" tinham o mesmo problema, com 820px.
 *
 * O protótipo aprovado (`pages/Home.dc.html`) faz o contrário, e é o que ficou:
 *
 * - no hero, contêiner na largura do site e o limite de linha na TIPOGRAFIA
 *   (`max-width` em `ch` no `h1`, `62ch` no parágrafo);
 * - nas seções de texto, coluna estreita **encostada à esquerda** dentro do
 *   contêiner largo (`margin-right:auto`, nunca `margin:0 auto`).
 *
 * Encolher o contêiner resolve a medida de leitura e quebra o alinhamento.
 * Limitar o texto resolve as duas coisas.
 */
describe('alinhamento da home', () => {
  let router: string;
  let styles: string;

  beforeAll(async () => {
    router = await fs.readFile(path.join(process.cwd(), 'server', 'public', 'router.ts'), 'utf8');
    styles = await fs.readFile(path.join(process.cwd(), 'server', 'public', 'styles.ts'), 'utf8');
  });

  it('o hero não encolhe o próprio contêiner', () => {
    const i = router.indexOf('class="hero-deep"');
    expect(i).toBeGreaterThan(0);
    const bloco = router.slice(i, i + 1200);
    expect(
      bloco,
      'o wrap do hero voltou a ter largura própria — ele centraliza, e a borda ' +
        'esquerda sai do lugar em relação a todas as outras seções',
    ).not.toMatch(/class="wrap"\s+style="[^"]*max-width/);
  });

  it('e limita a linha no texto, como o protótipo', () => {
    const i = router.indexOf('class="hero-deep"');
    const bloco = router.slice(i, i + 1600);
    // Sem limite nenhum, o título correria os 1180px inteiros.
    expect(bloco).toMatch(/<h1[^>]*max-width:\s*\d+ch/);
    expect(bloco).toMatch(/max-width:\s*62ch/);
  });

  it('a coluna de texto, por padrão, encosta à esquerda', () => {
    expect(styles).toContain('.coluna-texto{max-width:820px;margin-right:auto}');
    // `margin:0 auto` na regra BASE devolveria o defeito inteiro: centralizaria
    // toda coluna de texto do site sem ninguém ter pedido.
    expect(styles).not.toMatch(/^\.coluna-texto\{[^}]*margin:0 auto/m);
  });

  it('centralizar é exceção declarada por seção, nunca o padrão', () => {
    // "Sobre a PCO" é centralizada desde 9/set/2026, a pedido do dono: a
    // seção já tinha os números declarados centralizados no meio de texto
    // encostado à esquerda, e eram três alinhamentos num bloco só.
    //
    // O que este caso trava é a FORMA da exceção. Ela vale por uma classe na
    // seção, então lê-se na marcação quem está centralizado e quem não está;
    // afrouxar a regra base para conseguir o mesmo efeito centralizaria todas
    // as colunas do site de uma vez, que é o defeito que este arquivo existe
    // para impedir.
    expect(router).toContain('class="section sobre-pco"');
    expect(styles).toMatch(/\.sobre-pco \.coluna-texto[^{]*\{[^}]*margin-left:auto/);
    expect(styles).toMatch(/\.sobre-pco \.coluna-texto[^{]*\{[^}]*text-align:center/);
    // A medida de leitura continua limitada — é a razão de a coluna existir.
    expect(styles).not.toMatch(/\.sobre-pco \.coluna-texto[^{]*\{[^}]*max-width:\s*none/);
  });

  it('a seção de texto da home usa a coluna', () => {
    const inicio = router.indexOf("publicSite.get('/', async");
    const home = router.slice(inicio, router.indexOf("publicSite.get('/formacoes'"));
    // Eram duas até 9/set/2026. "Sua carreira" virou faixa de destaque, com
    // foto de fundo e título centralizado — ver `faixa-da-carreira.test.ts`.
    // Sobrou "Sobre a PCO", que continua sendo texto corrido em fundo claro.
    const usos = home.match(/class="coluna-texto"/g) ?? [];
    expect(usos.length).toBe(1);
    // E ela não pode ter voltado ao wrap estreito.
    expect(home).not.toMatch(/class="wrap"\s+style="max-width:820px"/);
  });

  it('a faixa da carreira não encolhe o contêiner — o alinhamento é o mesmo', () => {
    // A regra deste arquivo vale para ela também, por outro caminho: o título
    // é centralizado por `text-align`, e não por um wrap estreito. Encolher o
    // contêiner centralizaria a faixa inteira e a borda esquerda do texto
    // sairia do lugar em relação a todas as outras seções.
    const i = router.indexOf('class="section faixa-carreira');
    expect(i).toBeGreaterThan(0);
    const bloco = router.slice(i, i + 900);
    expect(bloco).toMatch(/class="wrap"/);
    expect(bloco).not.toMatch(/class="wrap"\s+style="[^"]*max-width/);
  });
});

/**
 * "Sobre" e "Contato" saíram da barra do topo para o rodapé.
 *
 * A barra ficou com o que leva a uma decisão de compra. O que não pode
 * acontecer é a página perder TODO link interno: página pública sem link é
 * página que o buscador deixa de rastrear, e foi assim que o `/checkout` ficou
 * órfão em 30/ago/2026.
 */
describe('menu do topo e rodapé', () => {
  let layout: string;

  beforeAll(async () => {
    layout = await fs.readFile(path.join(process.cwd(), 'server', 'public', 'layout.ts'), 'utf8');
  });

  it('a barra do topo não tem mais Sobre nem Contato', () => {
    const chaves = NAV.map((n) => n.key);
    expect(chaves).not.toContain('sobre');
    expect(chaves).not.toContain('contato');
    // E continua com o que decide compra.
    expect(chaves).toEqual(expect.arrayContaining(['cursos', 'carro-chefe', 'ava', 'blog']));
  });

  it('as duas continuam alcançáveis pelo rodapé, de qualquer página', () => {
    const i = layout.indexOf('class="wrap legal"');
    expect(i).toBeGreaterThan(0);
    const rodape = layout.slice(i, i + 700);
    expect(rodape, '/sobre ficou órfã').toContain('href="/sobre"');
    expect(rodape, '/contato ficou órfã').toContain('href="/contato"');
  });

  it('nenhuma rota do NAV aponta para endereço que não existe mais', () => {
    // As fundidas viraram 301 em 30/ago/2026; link interno para 301 é o
    // defeito que fez o botão "Matricular-se" devolver quem ia comprar.
    for (const n of NAV) {
      expect(n.href.startsWith('/'), `${n.key} não é link interno`).toBe(true);
      expect(['/catalogo', '/comparar', '/landing']).not.toContain(n.href);
    }
  });
});
