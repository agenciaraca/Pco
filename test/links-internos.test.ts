import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROTAS_FUNDIDAS } from '../server/public/rotas-fundidas';

/**
 * O botão que fecha a venda apontava para o lugar errado, e nada reclamou.
 *
 * Em 30/ago/2026 `/catalogo`, `/comparar` e `/landing` viraram 301. O
 * "Matricular-se" da página do curso continuou apontando para `/catalogo` —
 * quem decidia comprar era devolvido à lista de cursos de onde tinha acabado
 * de vir. Ao mesmo tempo o `/checkout`, que funciona e conversa com
 * `POST /public/checkout`, ficou sem nenhum link apontando para ele.
 *
 * Nenhuma suíte pegava isso porque ninguém olhava para os `href` do site.
 */

// jsdom nao entrega import.meta.url como file://, entao o caminho sai da raiz.
const routerSrc = readFileSync(resolve(process.cwd(), 'server/public/router.ts'), 'utf-8');

/** Todos os href="/..." literais do site público. */
function hrefsInternos(src: string): string[] {
  return [...src.matchAll(/href="(\/[^"$]*)"/g)].map((m) => m[1]);
}

describe('links internos do site público', () => {
  it('nenhum aponta para uma rota que responde 301', () => {
    const fundidas = Object.keys(ROTAS_FUNDIDAS);
    const ofensores = hrefsInternos(routerSrc).filter((href) =>
      fundidas.includes(href.split('?')[0]),
    );
    expect(
      ofensores,
      `href apontando para rota fundida (301). Use o destino final: ${JSON.stringify(ROTAS_FUNDIDAS)}`,
    ).toEqual([]);
  });

  it('a página do curso leva ao checkout quando o curso tem preço', () => {
    // O `/checkout` existia sem nenhum link apontando para ele. Se este teste
    // falhar, a venda voltou a ser um beco sem saída.
    expect(routerSrc).toContain('/checkout?curso=');
  });

  it('sem preço, o curso cai no WhatsApp — nunca num botão morto', () => {
    // O destino da compra é decidido num lugar só; é esse trecho que importa.
    const i = routerSrc.indexOf('const destinoCompra');
    expect(i, 'destinoCompra sumiu — o destino da compra voltou a ser espalhado').toBeGreaterThan(
      -1,
    );
    const trecho = routerSrc.slice(i, i + 200);
    expect(trecho).toContain('temPreco');
    expect(trecho).toContain('/checkout?curso=');
    // `wa` é ORG.whatsapp, atribuído na linha acima.
    expect(trecho).toContain('wa');
  });
});
