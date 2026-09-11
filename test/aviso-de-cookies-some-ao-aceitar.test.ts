import { describe, it, expect } from 'vitest';
import { PUBLIC_CSS_SERVIDO } from '../server/public/styles';

/**
 * `server/public/client.ts` faz `banner.hidden = true` ao aceitar ou recusar
 * o aviso de cookies — mas isso só esconde de verdade se o CSS não brigar
 * com o atributo `hidden`. `.consent{display:flex}` e o `[hidden]{display:
 * none}` padrão do navegador têm a MESMA especificidade (0,1,0); quem vem
 * depois no CSS vence, e a folha do site carrega depois da folha padrão do
 * navegador — então `.consent` sempre ganhava, e a barra nunca sumia.
 *
 * Relatado pelo dono em 11/set/2026: *"notificação de cookie não some
 * quando dá o aceite"*.
 */

describe('o aviso de cookies some de verdade ao aceitar/recusar', () => {
  it('existe uma regra que dá `display:none` explícito a `.consent[hidden]`', () => {
    expect(PUBLIC_CSS_SERVIDO).toMatch(/\.consent\[hidden\]\s*\{[^}]*display\s*:\s*none/);
  });

  it('a regra de override vem DEPOIS da regra que define `.consent{display:flex}` — ordem importa quando a especificidade empata', () => {
    const iDisplay = PUBLIC_CSS_SERVIDO.indexOf('.consent{');
    const iOverride = PUBLIC_CSS_SERVIDO.indexOf('.consent[hidden]');
    expect(iDisplay).toBeGreaterThan(-1);
    expect(iOverride).toBeGreaterThan(iDisplay);
  });
});
