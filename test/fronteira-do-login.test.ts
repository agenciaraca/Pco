import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PUBLIC_CSS } from '../server/public/styles';

/**
 * A fronteira do login não pode ter salto.
 *
 * O site público é servido em system-ui, com zero webfont de propósito: sem
 * request bloqueante e sem CLS por troca de fonte. A aplicação carregava a
 * Inter do Google Fonts — então quem vinha do site e entrava no AVA via a letra
 * mudar exatamente na hora de logar. Mesma escola, duas tipografias.
 *
 * O handoff de design é explícito: as duas metades em system-ui. Estes testes
 * cobram isso dos dois lados, porque a regressão é fácil — basta alguém colar
 * de volta um `<link>` de fonte ou trocar a pilha do Tailwind.
 */
const raiz = process.cwd();
const indexHtml = readFileSync(resolve(raiz, 'index.html'), 'utf-8');
const tailwind = readFileSync(resolve(raiz, 'tailwind.config.js'), 'utf-8');

/** Comentário pode citar o que foi removido; código, não. */
const semComentarioHtml = indexHtml.replace(/<!--[\s\S]*?-->/g, '');
const semComentarioJs = tailwind
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter((l) => !/^\s*(\/\/|\*)/.test(l))
  .join('\n');

describe('fronteira do login', () => {
  it('a aplicação não carrega webfont', () => {
    expect(semComentarioHtml).not.toContain('fonts.googleapis.com');
    expect(semComentarioHtml).not.toContain('fonts.gstatic.com');
    expect(semComentarioHtml).not.toContain('Inter');
  });

  it('o Tailwind usa a mesma pilha do site público', () => {
    expect(semComentarioJs).not.toContain("'Inter'");
    // system-ui primeiro: é o que faz as duas metades renderizarem igual.
    const m = semComentarioJs.match(/sans:\s*\[([^\]]*)\]/);
    expect(m, 'fontFamily.sans sumiu do tailwind.config.js').not.toBeNull();
    expect(m![1].trim().startsWith("'system-ui'")).toBe(true);
  });

  it('o site público continua sem webfont', () => {
    // A metade pública nunca teve; se ganhar uma, o salto volta pelo outro lado.
    expect(PUBLIC_CSS).not.toContain('fonts.googleapis.com');
    expect(PUBLIC_CSS).toContain('font-family:system-ui');
  });
});
