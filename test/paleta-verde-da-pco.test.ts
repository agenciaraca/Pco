/**
 * A cor de marca virou verde — e trocar hex sem olhar contraste quebra texto.
 *
 * Em 10/set/2026 o dono definiu o verde da PCO como `#04d3a9`, com `#67d8bf`
 * para os tons claros. A cor antiga (`#0097b2`) era o token dominante do
 * produto: **29 usos no CSS do site público e 158 arquivos do app**.
 *
 * O que a troca revelou, e que já era problema antes dela:
 *
 * - **18 dos 29 usos de `--accent` no site são `color:`** — texto. Com o azul
 *   antigo isso dava 3,46:1, abaixo do mínimo de texto normal; com o verde
 *   novo cairia para **1,93:1**, reprovando em qualquer tamanho. O próprio
 *   projeto já tinha a regra escrita no Tailwind — *marca para preenchimento e
 *   traço, `-ink` para o que carrega letra* — e o CSS público não a seguia.
 *   Aplicá-la aqui **melhorou** o que existia: 3,46 → 5,03.
 * - **`--on-accent` era branco.** Branco sobre `#04d3a9` dá 1,93:1. É a mesma
 *   troca que a faixa laranja já tinha feito: sobre cor clara e saturada, o
 *   texto é escuro.
 *
 * Este teste trava a paleta pelo **contraste**, não pelo hex: quem trocar a
 * cor de novo precisa passar pelos mesmos mínimos, e é isso que impede a
 * próxima troca de repetir o problema.
 */
import { describe, it, expect } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';

function luminancia(hex: string): number {
  const c = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}
function razao(a: string, b: string): number {
  const l1 = luminancia(a);
  const l2 = luminancia(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const ler = (p: string) => fs.readFile(path.join(process.cwd(), p), 'utf8');
const VERDE = '#04d3a9';
const CLARO = '#67d8bf';

describe('o verde pedido está nos tokens dos dois lados', () => {
  it('no CSS do site público', async () => {
    const css = await ler('server/public/styles.ts');
    expect(css).toContain(`--accent:${VERDE}`);
    expect(css).toContain(`--accent-light:${CLARO}`);
  });

  it('no Tailwind do app', async () => {
    const tw = await ler('tailwind.config.js');
    expect(tw).toContain(`blue: '${VERDE}'`);
    expect(tw).toContain(`'cyan-light': '${CLARO}'`);
  });

  it('e nas variáveis do tema do app', async () => {
    const t = await ler('src/styles/theme.css');
    expect(t).toContain(`--pco-blue: ${VERDE}`);
    expect(t).toContain(`--pco-cyan-light: ${CLARO}`);
  });

  it('nada ficou para trás com o azul antigo', async () => {
    // Um hex esquecido não dá erro: dá uma peça azul no meio do verde, e
    // ninguém acha depois.
    for (const f of [
      'server/public/styles.ts',
      'src/styles/theme.css',
      'tailwind.config.js',
      'server/public/layout.ts',
    ]) {
      const c = await ler(f);
      for (const antigo of ['#0097b2', '#0cc0df', '#5ce1e6', '#00798e', '#0b7486']) {
        expect(c.includes(antigo), `${f} ainda tem ${antigo}`).toBe(false);
      }
    }
  });
});

describe('o que carrega letra continua legível', () => {
  it('o tom de texto passa em AA sobre o branco', async () => {
    const css = await ler('server/public/styles.ts');
    const m = css.match(/--accent-ink:(#[0-9a-f]{6})/i);
    expect(m, 'não achei --accent-ink').toBeTruthy();
    expect(razao(m![1]!, '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });

  it('o texto sobre a cor de marca é escuro, não branco', async () => {
    // Branco sobre #04d3a9 dá 1,93:1. É a mesma troca da faixa laranja.
    const css = await ler('server/public/styles.ts');
    const m = css.match(/--on-accent:(#[0-9a-f]{6})/i);
    expect(m).toBeTruthy();
    expect(razao(m![1]!, VERDE)).toBeGreaterThanOrEqual(4.5);
  });

  it('a cor de marca NÃO é usada como cor de texto no site', async () => {
    // A regra já estava escrita no Tailwind e o CSS público não a seguia.
    // A exceção é a aspa decorativa, que vive em opacity .3 e não é leitura.
    const css = await ler('server/public/styles.ts');
    const linhas = css.split('\n').filter((l) => l.includes('color:var(--accent)'));
    for (const l of linhas) {
      const decorativa = l.includes('opacity:.3');
      const naoEhTexto = /border-color|border-top-color|accent-color/.test(l);
      expect(decorativa || naoEhTexto, `texto na cor de marca: ${l.trim().slice(0, 70)}`).toBe(true);
    }
  });

  it('o botão primário do app segue legível', async () => {
    const tw = await ler('tailwind.config.js');
    const m = tw.match(/'blue-ink':\s*'(#[0-9a-f]{6})'/i);
    expect(m).toBeTruthy();
    // Ele é `bg-pco-blue-ink text-white`.
    expect(razao('#ffffff', m![1]!)).toBeGreaterThanOrEqual(4.5);
  });

  it('no tema escuro o acento clareia, em vez de escurecer', async () => {
    const css = await ler('server/public/styles.ts');
    const i = css.indexOf('--brand-petroleo:#041f27');
    expect(i, 'não achei o bloco do tema escuro').toBeGreaterThan(0);
    const bloco = css.slice(i, i + 300);
    const m = bloco.match(/--accent:(#[0-9a-f]{6})/i);
    expect(m).toBeTruthy();
    // Sobre a superfície escura do app.
    expect(razao(m![1]!, '#0a1418')).toBeGreaterThanOrEqual(4.5);
  });
});

describe('o H1 da home não carrega mais o ano', () => {
  it('a frase termina em "cabe na sua vida"', async () => {
    const r = await ler('server/public/router.ts');
    expect(r).toContain("'Formação em psicanálise clínica que cabe na sua vida'");
  });

  it('mas o ano continua onde ele responde alguma coisa', async () => {
    // Tirar da home não é apagar a prova de tempo de escola.
    const cfg = await ler('server/public/config.ts');
    expect(cfg).toContain("founded: '2018'");
  });
});
