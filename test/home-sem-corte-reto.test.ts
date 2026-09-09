/**
 * Nenhuma passagem de seção da home pode ser um corte reto.
 *
 * O desenho do site tem um divisor próprio — o "pincel", três ondas do tom da
 * seção seguinte subindo por cima da atual. Até 8/set/2026 ele existia em duas
 * passagens (a do herói e a da faixa de matrícula) e faltava em **seis**: o
 * resto da página trocava de cor num corte reto, e a mesma página tinha os dois
 * tratamentos.
 *
 * Três coisas que este arquivo trava, e as três já falharam de verdade:
 *
 * 1. **Toda troca de cor tem onda.** É a regra que o dono pediu.
 * 2. **Onde a cor não muda, não há onda.** Ela seria desenhada na própria cor
 *    do fundo — invisível, e só um vão a mais. Foi o cuidado pedido junto:
 *    "que não duplique".
 * 3. **A cor da onda é SÓLIDA.** O `fill` de SVG não entende
 *    `linear-gradient()`: ignora o valor e cai no **preto**. Três divisores
 *    saíram pretos assim, e é por isso que o pincel do rodapé sempre usou
 *    `--brand-grad-topo` em vez de `--brand-gradient`.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let home = '';

/** As seções de primeiro nível do `<main>`, com a marcação de cada uma. */
function secoesDaHome(html: string): string[] {
  const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
  const out: string[] = [];
  // As seções da home não são aninhadas: quebrar em `<section` basta, e é bem
  // mais legível que um parser de HTML para a pergunta que se faz aqui.
  const partes = main.split('<section');
  for (let i = 1; i < partes.length; i++) out.push('<section' + partes[i]);
  return out;
}

/**
 * O fundo efetivo de uma seção, deduzido da marcação.
 *
 * É a mesma dedução que o CSS faz, escrita aqui de propósito: um teste que
 * lesse o fundo pelo navegador precisaria de navegador, e este roda em
 * milissegundos na suíte que se roda antes de commitar.
 */
function fundoDe(secao: string): string {
  const abertura = secao.slice(0, secao.indexOf('>'));
  if (abertura.includes('cta-final')) return 'laranja';
  // A faixa da carreira é foto sobre laranja. O que a onda tem de usar é a cor
  // SOB a foto: ela entra por multiply, que só escurece, então esse é o tom em
  // que a faixa encosta na onda. Ver `test/faixa-da-carreira.test.ts`.
  if (abertura.includes('faixa-carreira')) return 'carreira';
  if (
    abertura.includes('hero-deep') ||
    abertura.includes('faixa-cta') ||
    abertura.includes('faixa-rntp') ||
    abertura.includes('--brand-gradient')
  ) {
    return 'petroleo';
  }
  if (abertura.includes('--surface-2')) return 'cinza';
  return 'papel';
}

/**
 * A cor com que a onda daquela seção foi pintada, se houver onda.
 *
 * Ancorado em `class="pincel"` de propósito: pegar o primeiro `<svg>` da seção
 * traria o ícone do WhatsApp do herói, que é `fill="currentColor"`.
 */
function corDaOnda(secao: string): string | null {
  const i = secao.indexOf('class="pincel"');
  if (i === -1) return null;
  const m = /<svg[^>]*\sfill="([^"]+)"/.exec(secao.slice(i));
  return m ? m[1] : null;
}

const SOLIDA: Record<string, string> = {
  papel: 'var(--paper)',
  cinza: 'var(--surface-2)',
  petroleo: 'var(--brand-grad-topo)',
  laranja: 'var(--cta-grad-topo)',
  carreira: 'var(--carreira-laranja)',
};

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-home-'));
  process.env.DATA_DIR = tmpDir;
  const { publicSite } = await import('../server/public/router');
  const res = await publicSite.fetch(new Request('http://local/'));
  expect(res.status).toBe(200);
  home = await res.text();
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('divisores da home', () => {
  it('toda troca de cor entre seções tem a onda, e com a cor da seção seguinte', () => {
    const secoes = secoesDaHome(home);
    expect(secoes.length).toBeGreaterThan(6);

    const faltando: string[] = [];
    const corErrada: string[] = [];
    for (let i = 0; i < secoes.length - 1; i++) {
      const atual = fundoDe(secoes[i]!);
      const proximo = fundoDe(secoes[i + 1]!);
      if (atual === proximo) continue;
      const cor = corDaOnda(secoes[i]!);
      if (!cor) {
        faltando.push(`${i}: ${atual} → ${proximo} sem divisor`);
      } else if (cor !== SOLIDA[proximo]) {
        corErrada.push(`${i}: ${atual} → ${proximo} pintado com ${cor}`);
      }
    }
    expect(faltando, `passagens com corte reto:\n${faltando.join('\n')}`).toEqual([]);
    expect(corErrada, `onda na cor errada:\n${corErrada.join('\n')}`).toEqual([]);
  });

  it('onde a cor não muda, não há divisor — ele seria invisível e só um vão', () => {
    const secoes = secoesDaHome(home);
    const duplicados: string[] = [];
    for (let i = 0; i < secoes.length - 1; i++) {
      if (fundoDe(secoes[i]!) !== fundoDe(secoes[i + 1]!)) continue;
      if (corDaOnda(secoes[i]!)) duplicados.push(`${i}: divisor entre dois fundos iguais`);
    }
    expect(duplicados, duplicados.join('\n')).toEqual([]);
  });

  it('a última seção não desenha divisor: quem fecha é o pincel do rodapé', () => {
    const secoes = secoesDaHome(home);
    const ultima = secoes[secoes.length - 1]!;
    expect(fundoDe(ultima)).toBe('laranja');
    expect(corDaOnda(ultima)).toBeNull();
    expect(home).toContain('pincel-topo');
  });

  it('nenhuma onda é pintada com degradê — o fill cairia no preto', () => {
    // O caso concreto: `fill="var(--brand-gradient)"` renderiza PRETO, e o
    // divisor vira uma faixa preta atravessando a página.
    const ondas = home.split('class="pincel').slice(1);
    const comDegrade = ondas
      .map((o) => /<svg[^>]*\sfill="([^"]+)"/.exec(o)?.[1] ?? '')
      .filter((cor) => /gradient(?!-topo)/.test(cor));
    expect(comDegrade, comDegrade.join('\n')).toEqual([]);
  });
});
