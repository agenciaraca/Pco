/**
 * A faixa final da home — laranja, com textura, encostada no rodapé.
 *
 * Antes ela era `.hero-deep`: o **mesmo** degradê petróleo do rodapé. As duas
 * faixas se fundiam numa mancha só e o último convite da página tinha
 * aparência de rodapé — o lugar da página em que ninguém procura oferta.
 *
 * O que este arquivo trava são as três decisões que um retoque futuro pode
 * desfazer sem perceber:
 *
 * 1. **O arquivo da textura existe.** `url()` para caminho errado não dá erro
 *    em lugar nenhum: dá 404 no navegador de quem visita e uma faixa lisa.
 * 2. **O texto sobre o laranja é escuro.** Branco sobre `#ff914d` dá 2,8:1 e
 *    reprova em qualquer tamanho; o `--on-orange` da paleta dá 7,5:1. É a
 *    troca que mais tenta quem mexe em faixa colorida.
 * 3. **A última seção da home é a faixa.** A regra que cola o pincel do rodapé
 *    nela é `main:has(> .cta-final:last-child)`. Entrar qualquer seção depois
 *    dela devolve o vão de 64px sem quebrar nada — e ninguém veria.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PUBLIC_CSS } from '../server/public/styles';

let tmpDir: string;
let home = '';

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-faixa-'));
  process.env.DATA_DIR = tmpDir;
  const { publicSite } = await import('../server/public/router');
  const res = await publicSite.fetch(new Request('http://local/'));
  expect(res.status).toBe(200);
  home = await res.text();
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('faixa final da home', () => {
  it('é a última coisa dentro do <main> — é disso que a regra do pincel depende', () => {
    const main = home.slice(home.indexOf('<main'), home.indexOf('</main>'));
    expect(main).toContain('class="section cta-final"');
    // Nada de seção depois dela: `:last-child` deixaria de casar e o vão volta.
    const depois = main.slice(main.lastIndexOf('cta-final'));
    expect(depois).not.toContain('<section');
  });

  it('não usa mais o degradê do rodapé — era ele que fundia as duas', () => {
    const main = home.slice(home.indexOf('<main'), home.indexOf('</main>'));
    const faixa = main.slice(main.lastIndexOf('<section'));
    expect(faixa).not.toContain('hero-deep');
    // E nada de cor branca escrita à mão no style, que era como o texto claro
    // entrava antes de existir regra.
    expect(faixa).not.toMatch(/color:\s*#fff/i);
  });

  it('o arquivo da textura existe de verdade', async () => {
    const url = /url\('([^']+)'\)/.exec(PUBLIC_CSS.slice(PUBLIC_CSS.indexOf('.cta-final::before')));
    expect(url, 'a faixa deixou de declarar a textura').not.toBeNull();
    const arquivo = path.join(process.cwd(), 'public', url![1].replace(/^\//, ''));
    await expect(
      fs.access(arquivo),
      `a CSS aponta para ${url![1]} e o arquivo não está em public/`,
    ).resolves.toBeUndefined();
  });

  it('o texto sobre o laranja é a tinta escura da paleta, não branco', () => {
    const bloco = PUBLIC_CSS.slice(
      PUBLIC_CSS.indexOf('.cta-final{'),
      PUBLIC_CSS.indexOf('.site-footer{'),
    );
    expect(bloco).toContain('.cta-final h2{color:var(--on-orange)');
    expect(bloco).not.toMatch(/\.cta-final h2\{color:#fff/i);
  });

  it('o pincel do rodapé é puxado para dentro da faixa, sem vão', () => {
    expect(PUBLIC_CSS).toContain('main:has(> .cta-final:last-child) + .pincel-topo');
    // A folga que a faixa reserva embaixo e o puxão do pincel saem do MESMO
    // token: se um mudar sozinho, sobra ou falta exatamente essa diferença.
    expect(PUBLIC_CSS).toContain('--pincel-altura:');
    expect(PUBLIC_CSS).toContain('height:var(--pincel-altura)');
    expect(PUBLIC_CSS).toContain('margin-top:calc(-1 * var(--pincel-altura))');
    expect(PUBLIC_CSS).toContain('padding-bottom:calc(clamp(48px,7vw,88px) + var(--pincel-altura))');
  });
});
