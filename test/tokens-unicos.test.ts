import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PUBLIC_CSS } from '../server/public/styles';

/**
 * Os tokens do design têm uma fonte declarada: `docs/design/tokens.css`.
 *
 * Ela **não** é importada em runtime, e isso é decisão, não preguiça. As classes
 * do aplicativo usam modificador de opacidade em massa — `bg-status-success/10`
 * aparece 75 vezes, `bg-pco-orange/10` 62 — e o Tailwind não sabe aplicar `/10`
 * sobre um `var()` que guarda hex. Passar os tokens para canais (`0 151 178`)
 * obrigaria a reescrever também todo o CSS do site público, que os consome como
 * cor. O risco não paga.
 *
 * Então a unificação é por VALOR, e é este teste que a sustenta. Sem ele,
 * "fonte única" seria só um arquivo bonito na pasta de documentação enquanto os
 * dois lados andam para lados diferentes — que foi exatamente o que aconteceu
 * com o laranja: `#ff914d` no site, `#FE9002` no aplicativo, meses assim.
 */
const raiz = process.cwd();
const tokensCss = readFileSync(resolve(raiz, 'docs/design/tokens.css'), 'utf-8');
const tailwind = readFileSync(resolve(raiz, 'tailwind.config.js'), 'utf-8');

/**
 * Só o código. O comentário precisa poder CITAR o valor aposentado para
 * explicar por que ele saiu — senão documentar o motivo derrubaria o teste.
 */
const tailwindCodigo = tailwind
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter((l) => !/^\s*(\/\/|\*)/.test(l))
  .join('\n');

/** Lê o bloco `:root { … }` do tema claro. */
function tokensDoTemaClaro(css: string): Record<string, string> {
  const bloco = css.slice(css.indexOf(':root {'), css.indexOf('/* tema escuro'));
  const out: Record<string, string> = {};
  for (const m of bloco.matchAll(/(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    out[m[1]] = m[2].toLowerCase();
  }
  return out;
}

const TOKENS = tokensDoTemaClaro(tokensCss);

/** Nome no Tailwind -> token que ele espelha. */
const ESPELHO: Array<[string, string]> = [
  ['pco.blue', '--accent'],
  ['pco.cyan', '--accent-bright'],
  ['pco.cyan-light', '--accent-light'],
  ['pco.orange', '--brand-orange'],
  ['pco.deep', '--brand-petroleo'],
  ['pco.graphite', '--ink'],
  ['surface.white', '--raise'],
  ['surface.off', '--paper'],
  ['surface.gray', '--surface-2'],
  ['ink.base', '--ink'],
  ['ink.muted', '--ink-soft'],
  ['ink.subtle', '--ink-faint'],
  ['status.success', '--good'],
  ['status.danger', '--crit'],
  ['status.warning', '--warn'],
];

/** Extrai `chave: '#hex'` de dentro do grupo indicado no config do Tailwind. */
function corDoTailwind(caminho: string): string | null {
  const [grupo, chave] = caminho.split('.');
  const iGrupo = tailwind.indexOf(`${grupo}: {`);
  if (iGrupo < 0) return null;
  const trecho = tailwind.slice(iGrupo, tailwind.indexOf('},', iGrupo));
  const re = new RegExp(`'?${chave.replace(/[-]/g, '\\-')}'?:\\s*'(#[0-9a-fA-F]{3,8})'`);
  const m = trecho.match(re);
  return m ? m[1].toLowerCase() : null;
}

describe('tokens do design', () => {
  it('o arquivo de tokens está no repositório e tem o essencial', () => {
    for (const t of ['--accent', '--brand-orange', '--ink', '--paper', '--good']) {
      expect(TOKENS[t], `token ${t} sumiu de docs/design/tokens.css`).toBeTruthy();
    }
  });

  it('a paleta do aplicativo espelha os tokens', () => {
    const divergentes: string[] = [];
    for (const [nome, token] of ESPELHO) {
      const doTailwind = corDoTailwind(nome);
      const doToken = TOKENS[token];
      if (doTailwind !== doToken) {
        divergentes.push(`${nome}=${doTailwind} mas ${token}=${doToken}`);
      }
    }
    expect(divergentes, 'tailwind.config.js divergiu de docs/design/tokens.css').toEqual([]);
  });

  it('o CSS do site público espelha os tokens', () => {
    // O site consome os tokens como cor, com os mesmos nomes.
    for (const token of [
      '--accent',
      '--brand-orange',
      '--ink',
      '--paper',
      '--surface-2',
      '--ink-soft',
      '--ink-faint',
      '--good',
      '--warn',
      '--crit',
      '--accent-bright',
      '--accent-light',
      '--brand-petroleo',
    ]) {
      const esperado = TOKENS[token];
      expect(esperado, `token ${token} ausente na fonte`).toBeTruthy();
      expect(PUBLIC_CSS, `server/public/styles.ts não declara ${token}:${esperado}`).toContain(
        `${token}:${esperado}`,
      );
    }
  });

  it('o laranja é um só nas duas metades', () => {
    // A divergência que o handoff listava em aberto: #ff914d no site público,
    // #FE9002 no admin e na área do aluno. O desenho aprovado decidiu.
    expect(TOKENS['--brand-orange']).toBe('#ff914d');
    expect(corDoTailwind('pco.orange')).toBe('#ff914d');
    expect(PUBLIC_CSS).toContain('--brand-orange:#ff914d');
    expect(tailwindCodigo).not.toContain('#FE9002');
  });
});
