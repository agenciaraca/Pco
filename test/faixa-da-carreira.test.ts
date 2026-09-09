/**
 * A faixa da carreira: foto de fundo com overlay laranja.
 *
 * O tratamento veio do site antigo, e com ele veio um defeito que **não** foi
 * copiado: lá o texto era branco sobre `#FF9000`, o que dá 2,2:1 e reprova em
 * qualquer tamanho de fonte. É a mesma troca que o projeto já documentou na
 * faixa final — a que mais tenta quem mexe em faixa colorida.
 *
 * Por isso o caso central aqui **calcula o contraste** em vez de conferir que
 * a cor é a que alguém escreveu. A conta é a da WCAG, e o resultado é um
 * número: clarear o laranja reprova a faixa inteira e o teste diz por quê.
 *
 * Ele vale como piso de tudo porque a foto entra por `mix-blend-mode:multiply`,
 * que só escurece: o tom mais claro que a faixa alcança é o `--carreira-laranja`
 * puro, nas áreas em que a foto é branca. Trocar a imagem não muda o piso.
 *
 * O que mais este arquivo trava:
 *
 * - **Os três arquivos da imagem existem.** `url()` para caminho errado não dá
 *   erro em lugar nenhum: dá 404 no navegador de quem visita e uma faixa lisa.
 * - **O padrão é a MENOR imagem**, como no herói — quem não casar com media
 *   query nenhuma leva a leve, não a pesada.
 * - **A onda da seção anterior usa a cor da faixa.** Ela é sólida e encosta no
 *   topo; apontando para outra cor, aparece uma listra atravessando a página.
 * - **`isolation:isolate`**, sem o qual o multiply mistura com o que estiver
 *   atrás na pilha e o resultado muda conforme a seção vizinha.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PUBLIC_CSS } from '../server/public/styles';

const RAIZ = path.resolve(__dirname, '..');
const LARGURAS = [760, 1280, 1441];

let tmpDir: string;
let home = '';

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-carreira-'));
  process.env.DATA_DIR = tmpDir;
  const { publicSite } = await import('../server/public/router');
  const res = await publicSite.fetch(new Request('http://local/'));
  expect(res.status).toBe(200);
  home = await res.text();
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

/** Luminância relativa da WCAG 2.x. */
function luminancia([r, g, b]: [number, number, number]): number {
  const canal = (c: number): number => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

/** Razão de contraste contra o branco puro. */
function contrasteComBranco(cor: [number, number, number]): number {
  return 1.05 / (luminancia(cor) + 0.05);
}

function hexParaRgb(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  expect(m, `cor fora do formato #rrggbb: ${hex}`).not.toBeNull();
  const n = parseInt(m![1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function corDaFaixa(): [number, number, number] {
  const m = /--carreira-laranja:\s*(#[0-9a-f]{6})/i.exec(PUBLIC_CSS);
  expect(m, 'o token --carreira-laranja sumiu da paleta').not.toBeNull();
  return hexParaRgb(m![1]);
}

describe('faixa da carreira', () => {
  it('o texto branco passa em contraste sobre o laranja — que é o pior caso', () => {
    const cor = corDaFaixa();
    const razao = contrasteComBranco(cor);
    expect(
      razao,
      `rgb(${cor.join(',')}) dá ${razao.toFixed(2)}:1 com texto branco. ` +
        'O mínimo da WCAG AA para texto normal é 4,5:1. O site antigo usava ' +
        '#FF9000 aqui, que dá 2,2:1 — clarear o token repete aquele defeito.',
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('o texto da faixa é branco de verdade, não herda a tinta de fundo claro', () => {
    expect(regra('.faixa-carreira h2')).toContain('color:#fff');
    expect(regra('.carreira-colunas p')).toContain('color:#fff');
  });

  it('a foto só escurece — é o multiply que faz do laranja o piso', () => {
    const corpo = regra('.carreira-foto');
    expect(corpo).toContain('mix-blend-mode:multiply');
    // Sem isolation o multiply atravessa a seção e o resultado passa a
    // depender de quem está atrás na pilha.
    expect(regra('.faixa-carreira')).toContain('isolation:isolate');
  });

  it('os três arquivos da imagem existem', async () => {
    for (const w of LARGURAS) {
      const arq = path.join(RAIZ, `public/img/carreira-psicanalise-${w}.webp`);
      const st = await fs.stat(arq).catch(() => null);
      expect(st, `faltando: ${arq} — url() errada não dá erro, dá 404`).not.toBeNull();
      expect(st!.size).toBeGreaterThan(1000);
    }
  });

  it('o padrão é a MENOR imagem, e as maiores entram por media query', () => {
    // Fora de qualquer media query: a leve.
    expect(regra('.carreira-foto')).toContain('carreira-psicanalise-760.webp');
    for (const w of [1280, 1441]) {
      const i = PUBLIC_CSS.indexOf(`carreira-psicanalise-${w}.webp`);
      expect(i, `a imagem de ${w}px não é servida`).toBeGreaterThan(-1);
      // A regra que a traz tem de estar dentro de um @media min-width.
      const antes = PUBLIC_CSS.slice(0, i);
      const abertura = antes.lastIndexOf('@media');
      expect(
        antes.slice(abertura, abertura + 40),
        `a imagem de ${w}px não está atrás de um min-width`,
      ).toContain('min-width');
    }
  });

  it('a onda que desce até a faixa tem a cor da faixa', () => {
    // Pelo markup: o CSS vai inline no <head>, e o nome da classe aparece
    // antes ali — a busca pela classe solta cairia dentro da folha de estilo.
    const i = home.indexOf('class="section faixa-carreira');
    expect(i, 'a faixa sumiu da home').toBeGreaterThan(-1);
    // O pincel da seção anterior é o último antes da faixa começar.
    const antes = home.slice(0, i);
    const ultimoFill = [...antes.matchAll(/fill="([^"]+)"/g)].pop();
    expect(ultimoFill, 'a seção anterior não emite pincel nenhum').toBeTruthy();
    expect(
      ultimoFill![1],
      'a onda da seção anterior encosta no topo da faixa: cor diferente vira ' +
        'uma listra atravessando a página',
    ).toBe('var(--carreira-laranja)');
  });

  it('o texto que o dono escreveu continua na faixa', () => {
    const i = home.indexOf('class="section faixa-carreira');
    expect(i, 'a faixa sumiu da home').toBeGreaterThan(-1);
    const faixa = home.slice(i, home.indexOf('</section>', i));
    expect(faixa).toContain('Sua carreira após a Formação em Psicanálise Clínica aqui na PCO');
    expect(faixa).toContain('Desperte o psicanalista em você');
    expect(faixa).toContain('Seja desbravando consultórios virtuais');
  });
});
