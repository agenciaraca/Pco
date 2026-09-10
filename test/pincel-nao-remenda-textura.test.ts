import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PUBLIC_CSS } from '../server/public/styles';

/**
 * A onda que dissolve entre seções virava um remendo, e o dono chamou de
 * "emenda" — em três lugares diferentes (rodapé, "Sua carreira", "Faça já sua
 * matrícula") que eram, na origem, o MESMO defeito.
 *
 * ## A causa
 *
 * O pincel dissolve com duas camadas translúcidas (opacity .3 e .5) por cima
 * de uma sólida — pensadas para se misturar com um fundo LISO. Duas coisas
 * quebravam essa premissa:
 *
 * 1. **Textura por baixo.** `.com-textura` desenha o padrão de ondas até a
 *    borda da seção. As camadas translúcidas do pincel, em vez de diluir a
 *    cor, revelavam o desenho por baixo — um remendo felpudo bem onde a
 *    dissolução deveria ser mais limpa.
 * 2. **Matizes opostos.** Laranja e verde são quase complementares no círculo
 *    cromático. Verde translúcido sobre laranja sólido produz caqui/oliva —
 *    isso acontece mesmo sem textura nenhuma, é a álgebra da mistura alfa.
 *
 * ## O conserto, em duas partes
 *
 * - `.com-textura::before` ganhou uma máscara que apaga o padrão no último
 *   trecho da seção (a altura do pincel, com folga) — o pincel passa a
 *   dissolver contra o degradê sólido, não contra o padrão.
 * - `.cta-final` (laranja, e é ela que encosta no rodapé verde) ganhou um
 *   SEGUNDO fundo, empilhado por cima do degradê laranja, que pinta a mesma
 *   zona final de verde antes de a onda do rodapé nascer — a passagem de
 *   matiz acontece num degradê comum, e a onda (agora verde sobre verde)
 *   dissolve limpo, do mesmo jeito que já funcionava em toda transição
 *   analógica do site.
 *
 * `.faixa-carreira` (foto, não textura) recebeu o equivalente: a foto já
 * nascia mascarada no topo (110px, para a onda de entrada); ganhou a mesma
 * máscara na base, simétrica, para a onda de saída não misturar suas camadas
 * translúcidas com o rosto da foto.
 */

const RAIZ = path.resolve(__dirname, '..');
let tmpDir: string;

// A home continua renderizando 200 com as camadas novas — smoke check contra
// um erro de sintaxe no CSS/HTML que só apareceria ao montar a página.
beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-pincel-'));
  process.env.DATA_DIR = tmpDir;
  const { publicSite } = await import('../server/public/router');
  const res = await publicSite.fetch(new Request('http://local/'));
  expect(res.status).toBe(200);
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

function regra(seletor: string): string {
  const i = PUBLIC_CSS.indexOf(seletor + '{');
  expect(i, `seletor ausente no CSS: ${seletor}`).toBeGreaterThan(-1);
  const abre = i + seletor.length + 1;
  return PUBLIC_CSS.slice(abre, PUBLIC_CSS.indexOf('}', abre));
}

describe('a textura para antes do pincel começar', () => {
  it('o padrão tem máscara que fecha no fim da seção', () => {
    const r = regra('.com-textura::before');
    expect(r, 'a textura voltou a ir até a borda, sem apagar antes do pincel').toMatch(
      /mask-image:linear-gradient\(180deg,#000 0,#000 calc\(100% - var\(--pincel-altura\)/,
    );
  });

  it('a máscara some de verdade (transparent no fim), não só escurece', () => {
    const r = regra('.com-textura::before');
    expect(r).toContain('transparent 100%');
  });
});

describe('a faixa laranja pré-esverdeia antes da onda do rodapé', () => {
  it('.cta-final tem um segundo fundo que pinta a base de verde', () => {
    const r = regra('.cta-final');
    // Duas camadas de fundo: a vertical (transparente → verde) por cima do
    // degradê laranja diagonal — é isso que evita a mistura de matizes
    // opostos na translucidez do pincel.
    expect(r).toContain('linear-gradient(180deg');
    expect(r).toContain('var(--brand-grad-topo)');
    expect(r).toContain('var(--cta-gradient)');
  });

  it('o verde do pré-fade é EXATAMENTE o que o pincel do rodapé usa', async () => {
    // Se os dois divergirem, a pré-mistura erra a cor e a listra volta —
    // só que agora verde-contra-verde-diferente, mais discreta e mais difícil
    // de notar em revisão. O que se compara é a FONTE (a onda é gerada, não
    // aparece como texto no HTML servido).
    const layoutSrc = await fs.readFile(path.join(RAIZ, 'server/public/layout.ts'), 'utf-8');
    const i = layoutSrc.indexOf('function footer(');
    const fim = layoutSrc.indexOf('<footer class="site-footer">', i);
    expect(i, 'footer() sumiu de layout.ts').toBeGreaterThan(-1);
    expect(fim, 'a tag <footer> sumiu de dentro da função').toBeGreaterThan(i);
    expect(layoutSrc.slice(i, fim)).toContain("pincel('var(--brand-grad-topo)'");
  });
});

describe('a foto da carreira tem máscara nas DUAS pontas', () => {
  it('entra mascarada (onda de cima) e sai mascarada (onda de baixo)', () => {
    const r = regra('.carreira-foto');
    const mask = /mask-image:linear-gradient\(([^)]+)\)/.exec(r);
    expect(mask, 'a foto perdeu a máscara').not.toBeNull();
    // Quatro paradas: transparente, opaca (entrada), opaca, transparente (saída).
    const paradas = mask![1].split(',').length;
    expect(paradas, 'a máscara só cobre uma ponta').toBe(4);
  });
});

describe('preço da faixa de matrícula: parcela primeiro, maior', () => {
  it('o texto principal é a parcela, não o total', async () => {
    const routerSrc = await fs.readFile(path.join(RAIZ, 'server/public/router.ts'), 'utf-8');
    const i = routerSrc.indexOf('const precoMatricula');
    const bloco = routerSrc.slice(i, i + 500);
    // A ordem no template: condicoesFormatted (parcela) fora do <span>,
    // priceFormatted (total) dentro — <span> é o texto pequeno por CSS.
    const antes = bloco.indexOf('condicoesFormatted');
    const depois = bloco.indexOf('priceFormatted', antes + 1);
    expect(antes, 'condicoesFormatted sumiu do bloco').toBeGreaterThan(-1);
    expect(depois, 'priceFormatted não vem depois — a ordem não foi invertida').toBeGreaterThan(
      antes,
    );
    expect(bloco).toContain('à vista');
  });

  it('o total à vista fica no <span> — que é o texto pequeno', () => {
    const r = regra('.faixa-cta-preco span');
    expect(r).toContain('font-size:14px');
    // E o texto de fora (a parcela) é o grande — a regra base do seletor pai.
    const pai = regra('.faixa-cta-preco');
    expect(pai).toMatch(/font-size:clamp\(2\dpx/);
  });
});
