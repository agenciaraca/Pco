/**
 * O selo do RNTP na home — grande, e sem a moldura branca que ninguém pediu.
 *
 * ## O defeito, que não estava no selo
 *
 * O arquivo do selo é um círculo com anel azul `#336699`, cantos
 * transparentes e proporção 406x415 — mais alto que largo. O container
 * (`.selo-rntp`) o punha num quadrado com `background:#fff` e `padding:10px`,
 * e a imagem entrava com `object-fit:contain`: a altura preenchia, a largura
 * sobrava, e o branco do container aparecia como um **anel em volta do
 * círculo azul**. O selo ganhava uma moldura que o selo não tem.
 *
 * O conserto é o fundo do disco ser a cor do próprio selo. É por isso que o
 * caso que importa aqui **mede o arquivo**, em vez de repetir a string do
 * CSS: se alguém trocar o PNG por uma versão de outro tom, o fundo deixa de
 * combinar e a moldura volta — de outra cor, e igualmente sem erro nenhum.
 *
 * ## O que mais este arquivo trava
 *
 * - **A proporção 1/3-2/3 depende do `minmax(0,...)`.** Sem ele a coluna
 *   herda `min-width:auto`, o tamanho do selo passa a mandar na largura dela,
 *   e a divisão que se pediu deixa de valer sem nada quebrar visivelmente.
 * - **As dimensões declaradas na `<img>` são as do arquivo.** Elas existem
 *   para reservar o espaço antes de a imagem chegar; erradas, viram
 *   deslocamento de layout no celular de quem visita.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';
import { PUBLIC_CSS } from '../server/public/styles';

const RAIZ = path.resolve(__dirname, '..');
const SELO_GRANDE = path.join(RAIZ, 'public/img/selo-rntp.png');

let tmpDir: string;
let home = '';

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-selo-'));
  process.env.DATA_DIR = tmpDir;
  const { publicSite } = await import('../server/public/router');
  const res = await publicSite.fetch(new Request('http://local/'));
  expect(res.status).toBe(200);
  home = await res.text();
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

/** O corpo de uma regra do CSS, pelo seletor exato. */
function regra(seletor: string): string {
  const i = PUBLIC_CSS.indexOf(seletor + '{');
  expect(i, `seletor ausente no CSS: ${seletor}`).toBeGreaterThan(-1);
  const abre = i + seletor.length + 1;
  return PUBLIC_CSS.slice(abre, PUBLIC_CSS.indexOf('}', abre));
}

/** `#rrggbb` -> [r,g,b]. */
function hexParaRgb(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  expect(m, `cor fora do formato #rrggbb: ${hex}`).not.toBeNull();
  const n = parseInt(m![1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

interface Png {
  largura: number;
  altura: number;
  /** RGBA por pixel. */
  pixel(x: number, y: number): [number, number, number, number];
}

/**
 * Decodificador mínimo de PNG RGBA de 8 bits, não entrelaçado — que é o que
 * este arquivo é. Não vale como biblioteca; vale como medição do arquivo que
 * o site serve, sem trazer dependência para o repositório por causa de um
 * teste.
 */
function lerPng(buf: Buffer): Png {
  expect(buf.readUInt32BE(0), 'não é um PNG').toBe(0x89504e47);
  const largura = buf.readUInt32BE(16);
  const altura = buf.readUInt32BE(20);
  expect(buf[24], 'profundidade de bit inesperada').toBe(8);
  expect(buf[25], 'não é RGBA (color type 6)').toBe(6);
  expect(buf[28], 'PNG entrelaçado não é suportado aqui').toBe(0);

  const pedacos: Buffer[] = [];
  for (let off = 8; off < buf.length; ) {
    const len = buf.readUInt32BE(off);
    if (buf.toString('ascii', off + 4, off + 8) === 'IDAT') {
      pedacos.push(buf.subarray(off + 8, off + 8 + len));
    }
    off += 12 + len;
  }
  const cru = zlib.inflateSync(Buffer.concat(pedacos));

  const bpp = 4;
  const linha = largura * bpp;
  const saida = Buffer.alloc(altura * linha);
  let p = 0;
  for (let y = 0; y < altura; y++) {
    const filtro = cru[p++];
    const atualCru = cru.subarray(p, p + linha);
    p += linha;
    const atual = saida.subarray(y * linha, (y + 1) * linha);
    const acima = y > 0 ? saida.subarray((y - 1) * linha, y * linha) : Buffer.alloc(linha);
    for (let x = 0; x < linha; x++) {
      const a = x >= bpp ? atual[x - bpp] : 0;
      const b = acima[x];
      const c = x >= bpp ? acima[x - bpp] : 0;
      let v = atualCru[x];
      if (filtro === 1) v += a;
      else if (filtro === 2) v += b;
      else if (filtro === 3) v += (a + b) >> 1;
      else if (filtro === 4) {
        const est = a + b - c;
        const da = Math.abs(est - a);
        const db = Math.abs(est - b);
        const dc = Math.abs(est - c);
        v += da <= db && da <= dc ? a : db <= dc ? b : c;
      }
      atual[x] = v & 255;
    }
  }
  return {
    largura,
    altura,
    pixel(x, y) {
      const i = y * linha + x * bpp;
      return [saida[i], saida[i + 1], saida[i + 2], saida[i + 3]];
    },
  };
}

/** Distância euclidiana entre duas cores, em unidades de canal. */
function distancia(a: [number, number, number], b: [number, number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

describe('selo do RNTP na faixa da home', () => {
  const seletorFaixa = '.faixa-rntp .rntp-bloco .selo-rntp';

  it('não tem mais moldura: sem padding e sem o branco herdado', () => {
    const corpo = regra(seletorFaixa);
    // O padding é metade da moldura — era ele que a engrossava.
    expect(corpo).toMatch(/padding:\s*0(?![.\d])/);
    // E o fundo tem de ser trocado, não só o padding: o object-fit deixa
    // sobrar faixa nas laterais, e ela mostra o fundo do container.
    expect(corpo).toContain('background:var(--rntp-azul)');
    expect(corpo).not.toMatch(/#fff|#ffffff|white/i);
  });

  it('o fundo do disco é a cor do anel do arquivo do selo — medida no PNG', async () => {
    const token = /--rntp-azul:\s*(#[0-9a-f]{6})/i.exec(PUBLIC_CSS);
    expect(token, 'o token --rntp-azul sumiu da paleta').not.toBeNull();
    const declarada = hexParaRgb(token![1]);

    const png = lerPng(await fs.readFile(SELO_GRANDE));
    const meioY = png.altura >> 1;
    const meioX = png.largura >> 1;

    /** Primeiro pixel opaco a partir da borda, andando na direção dada. */
    const primeiroOpaco = (
      x0: number,
      y0: number,
      dx: number,
      dy: number,
    ): [number, number, number] => {
      for (let i = 0; i < 80; i++) {
        const [r, g, b, a] = png.pixel(x0 + dx * i, y0 + dy * i);
        // Dois pixels para dentro do primeiro opaco: a borda do círculo é
        // suavizada, e ali a cor ainda está misturada com o transparente.
        if (a === 255) {
          const [r2, g2, b2] = png.pixel(x0 + dx * (i + 2), y0 + dy * (i + 2));
          return [r2, g2, b2];
        }
        void r;
        void g;
        void b;
      }
      throw new Error('não achei o anel do selo — o arquivo mudou de forma?');
    };

    const amostras: Array<[string, [number, number, number]]> = [
      ['esquerda', primeiroOpaco(0, meioY, 1, 0)],
      ['direita', primeiroOpaco(png.largura - 1, meioY, -1, 0)],
      ['topo', primeiroOpaco(meioX, 0, 0, 1)],
      ['base', primeiroOpaco(meioX, png.altura - 1, 0, -1)],
    ];

    for (const [onde, cor] of amostras) {
      expect(
        distancia(cor, declarada),
        `o anel do selo em ${onde} é rgb(${cor.join(',')}), e o CSS pinta o fundo de rgb(${declarada.join(',')}) — a moldura volta, de outra cor`,
      ).toBeLessThan(24);
    }
  });

  it('o selo dobrou de tamanho, e com teto — não com largura cravada', () => {
    const corpo = regra(seletorFaixa);
    // 400px é o dobro dos 200px anteriores. O `min(...,100%)` é o que permite
    // à coluna ser 1/3: largura fixa forçaria o mínimo automático dela.
    expect(corpo).toContain('min(400px,100%)');
    expect(corpo).not.toMatch(/width:\s*\d+px/);
  });

  it('o texto fica com 2/3, e o minmax(0,...) é o que sustenta isso', () => {
    const corpo = regra('.rntp-bloco');
    expect(corpo).toContain('grid-template-columns:minmax(0,1fr) minmax(0,2fr)');
  });

  it('as dimensões declaradas na <img> são as do arquivo', async () => {
    const png = lerPng(await fs.readFile(SELO_GRANDE));
    // Pelo markup, não pela classe solta: o CSS vai inline no <head>, então
    // `rntp-bloco` aparece antes, e a busca cairia na logo do cabeçalho.
    const i = home.indexOf('class="wrap rntp-bloco"');
    expect(i, 'o bloco do selo sumiu da home').toBeGreaterThan(-1);
    const bloco = home.slice(i);
    const tag = bloco.slice(bloco.indexOf('<img'), bloco.indexOf('>', bloco.indexOf('<img')));
    expect(tag).toContain('selo-rntp.png');
    expect(tag).toContain(`width="${png.largura}"`);
    expect(tag).toContain(`height="${png.altura}"`);
  });
});
