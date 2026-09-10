/**
 * A faixa da carreira: foto de fundo com overlay LARANJA VIVO da marca.
 *
 * Até 10/set/2026 o overlay era um único tom (`#a65e32`), escolhido só para o
 * branco passar em 4,5:1 sobre o `multiply` da foto — passava, e parecia
 * marrom. Depois da paleta verde do dia, destoava do resto da home. A pedido
 * do dono, virou o laranja vivo — `#ff914d` primeiro, depois `#ff932e` na
 * mesma noite, quando o dono corrigiu a marca de novo — o mesmo do `.btn-cta`
 * e da faixa final.
 *
 * Branco sobre `#ff932e` é **2,2:1** — reprova em qualquer tamanho. A
 * legibilidade vem de camadas, não da cor sozinha, e é isso que este arquivo
 * trava:
 *
 * 1. **O degradê afunda.** `--carreira-fundo` sai do laranja vivo (topo, onde
 *    a onda encosta) e vai a `#8a3d10` na base, onde ficam os parágrafos.
 * 2. **Um véu quente** (`.faixa-carreira::after`) escurece por cima da foto,
 *    transparente no topo e fechando embaixo — afrouxado na mesma noite (o
 *    dono achou escuro demais), com mais foto aparecendo por baixo.
 * 3. **A foto** entra por `multiply`, e a opacidade dela é o que separa
 *    "overlay com foto de fundo" de "foto com filtro" — foi ajustada duas
 *    vezes na mesma noite (45% → 30% → 40%, a pedido do dono, que queria mais
 *    rosto e menos overlay).
 * 4. **`text-shadow`** no h2 e nos parágrafos.
 *
 * O caso central compõe o degradê com o véu e **calcula o contraste** — clarear
 * qualquer uma das camadas reprova a faixa e o teste diz qual. O número
 * ponta-a-ponta, medido no navegador depois de montar: **h2 5,4:1, parágrafos
 * 7,3 a 8,7:1**.
 *
 * O que mais este arquivo trava:
 *
 * - **Os três arquivos da imagem existem.** `url()` para caminho errado não dá
 *   erro em lugar nenhum: dá 404 no navegador de quem visita e uma faixa lisa.
 * - **O padrão é a MENOR imagem**, como no herói.
 * - **A onda da seção anterior usa a cor do TOPO da faixa.** Ela é sólida e
 *   encosta no topo; cor diferente vira uma listra atravessando a página. E o
 *   topo da faixa é o primeiro stop do degradê — não um valor à parte que
 *   alguém esquece de sincronizar.
 * - **`isolation:isolate`**, sem o qual o multiply mistura com o que estiver
 *   atrás na pilha.
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

type Rgb = [number, number, number];

/** Luminância relativa da WCAG 2.x. */
function luminancia([r, g, b]: Rgb): number {
  const canal = (c: number): number => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

function contrasteComBranco(cor: Rgb): number {
  return 1.05 / (luminancia(cor) + 0.05);
}

function hexParaRgb(hex: string): Rgb {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  expect(m, `cor fora do formato #rrggbb: ${hex}`).not.toBeNull();
  const n = parseInt(m![1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** `base` com `cima` (rgba) por cima — o que o navegador faz ao empilhar. */
function sobrepoe(base: Rgb, cima: Rgb, alpha: number): Rgb {
  return [
    Math.round(base[0] * (1 - alpha) + cima[0] * alpha),
    Math.round(base[1] * (1 - alpha) + cima[1] * alpha),
    Math.round(base[2] * (1 - alpha) + cima[2] * alpha),
  ];
}

/** Os stops `#rrggbb` de um `linear-gradient(...)`, na ordem. */
function stopsHex(valor: string): string[] {
  return [...valor.matchAll(/#[0-9a-f]{6}/gi)].map((m) => m[0]);
}

function token(nome: string): string {
  const m = new RegExp(`${nome}:\\s*([^;]+);`).exec(PUBLIC_CSS);
  expect(m, `token ${nome} sumiu da paleta`).not.toBeNull();
  return m![1].trim();
}

describe('faixa da carreira', () => {
  it('a onda da seção anterior tem a cor do TOPO da faixa', () => {
    const i = home.indexOf('class="section faixa-carreira');
    expect(i, 'a faixa sumiu da home').toBeGreaterThan(-1);
    const antes = home.slice(0, i);
    const ultimoFill = [...antes.matchAll(/fill="([^"]+)"/g)].pop();
    expect(ultimoFill, 'a seção anterior não emite pincel nenhum').toBeTruthy();
    // O divisor é sólido e encosta no topo da faixa. O topo da faixa é o
    // primeiro stop de --carreira-fundo — e --carreira-laranja tem de ser
    // exatamente ele, senão a onda desenha uma listra.
    expect(ultimoFill![1]).toBe('var(--carreira-laranja)');
    const primeiroStop = stopsHex(token('--carreira-fundo'))[0];
    expect(
      primeiroStop.toLowerCase(),
      'o topo do degradê da faixa não bate com --carreira-laranja: a onda vira uma listra',
    ).toBe(token('--carreira-laranja').toLowerCase());
  });

  it('o texto do MEIO da faixa passa em 4,5:1 — degradê + véu, não a cor sozinha', () => {
    // Branco sobre o laranja vivo puro reprova; é o que as camadas consertam.
    const laranjaVivo = hexParaRgb(token('--carreira-laranja'));
    expect(contrasteComBranco(laranjaVivo)).toBeLessThan(3);

    const stops = stopsHex(token('--carreira-fundo')).map(hexParaRgb);
    expect(stops.length, '--carreira-fundo precisa de pelo menos 3 stops').toBeGreaterThanOrEqual(
      3,
    );
    const meio = stops[1]; // ~42% — onde começa o primeiro parágrafo

    // O véu (`::after`): pega a MENOR opacidade declarada e a cor mais clara
    // dele — o pior caso para o texto.
    const veu = regra('.faixa-carreira::after');
    const alphas = [...veu.matchAll(/rgba\([^)]*,\s*(0?\.\d+)\)/g)]
      .map((m) => Number(m[1]))
      .filter((a) => a > 0);
    expect(alphas.length, 'o véu perdeu as camadas de opacidade').toBeGreaterThan(0);
    const veuRgb = (() => {
      const m = /rgba\((\d+),\s*(\d+),\s*(\d+)/.exec(veu);
      return m ? ([Number(m[1]), Number(m[2]), Number(m[3])] as Rgb) : ([74, 28, 6] as Rgb);
    })();
    const alphaMin = Math.min(...alphas);

    const composto = sobrepoe(meio, veuRgb, alphaMin);
    const razao = contrasteComBranco(composto);
    expect(
      razao,
      `o meio do degradê (${meio.join(',')}) sob o véu a ${alphaMin} dá ` +
        `${razao.toFixed(2)}:1. Mínimo 4,5:1 para texto normal. ` +
        'Clarear o degradê ou enfraquecer o véu reprova a faixa.',
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('a BASE do degradê — onde estão os parágrafos longos — é folgada', () => {
    const base = stopsHex(token('--carreira-fundo')).map(hexParaRgb).at(-1)!;
    // Aqui a foto (multiply) e o véu só escurecem: este é o piso, sem compor.
    expect(contrasteComBranco(base)).toBeGreaterThanOrEqual(6);
  });

  it('a foto aparece menos: multiply e opacidade baixa', () => {
    // Ajustada de 45% para 30% e depois para 40% (10/set/2026, à noite, a
    // pedido do dono — ele queria mais foto visível). O teto continua
    // existindo: "a 1 a foto vence" (comentário do CSS) — o que se cobra é
    // que o degradê continue no comando, não um número específico.
    const corpo = regra('.carreira-foto');
    expect(corpo).toContain('mix-blend-mode:multiply');
    const op = /opacity:\s*(0?\.\d+)/.exec(corpo);
    expect(op, 'a foto perdeu a opacidade explícita').not.toBeNull();
    expect(Number(op![1]), 'a foto voltou a dominar a faixa').toBeLessThanOrEqual(0.5);
    // Sem isolation o multiply atravessa a seção.
    expect(regra('.faixa-carreira')).toContain('isolation:isolate');
  });

  it('o texto é branco e tem sombra — a terceira camada', () => {
    for (const sel of ['.faixa-carreira h2', '.carreira-colunas p']) {
      const r = regra(sel);
      expect(r, `${sel} deixou de ser branco`).toContain('color:#fff');
      expect(r, `${sel} perdeu o text-shadow`).toContain('text-shadow');
    }
  });

  it('o texto fica acima da foto e do véu', () => {
    // .wrap em z-index 2; foto em auto(0); véu em 1.
    expect(regra('.faixa-carreira .wrap')).toContain('z-index:2');
    expect(regra('.faixa-carreira::after')).toContain('z-index:1');
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
    expect(regra('.carreira-foto')).toContain('carreira-psicanalise-760.webp');
    for (const w of [1280, 1441]) {
      const i = PUBLIC_CSS.indexOf(`carreira-psicanalise-${w}.webp`);
      expect(i, `a imagem de ${w}px não é servida`).toBeGreaterThan(-1);
      const antes = PUBLIC_CSS.slice(0, i);
      const abertura = antes.lastIndexOf('@media');
      expect(
        antes.slice(abertura, abertura + 40),
        `a imagem de ${w}px não está atrás de um min-width`,
      ).toContain('min-width');
    }
  });

  it('o texto que o dono escreveu continua na faixa', () => {
    const i = home.indexOf('class="section faixa-carreira');
    const faixa = home.slice(i, home.indexOf('</section>', i));
    expect(faixa).toContain('Sua carreira após a Formação em Psicanálise Clínica aqui na PCO');
    expect(faixa).toContain('Desperte o psicanalista em você');
    expect(faixa).toContain('Seja desbravando consultórios virtuais');
  });
});
