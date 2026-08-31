import { describe, it, expect } from 'vitest';
import { PUBLIC_CSS, PUBLIC_CSS_SERVIDO } from '../server/public/styles';

/**
 * O CSS do site público é inlinado no `<head>` de toda página — é o que evita
 * um request bloqueante e protege o LCP. O preço disso é que tudo o que está no
 * arquivo viaja junto, comentário incluído.
 *
 * `PUBLIC_CSS` é a fonte comentada, para quem lê o código. `PUBLIC_CSS_SERVIDO`
 * é o que vai para o HTML. Estes testes garantem que a poda tire só comentário
 * — nunca regra.
 */
describe('CSS público servido', () => {
  it('não leva comentário para o navegador', () => {
    expect(PUBLIC_CSS_SERVIDO).not.toContain('/*');
    expect(PUBLIC_CSS_SERVIDO.length).toBeLessThan(PUBLIC_CSS.length);
  });

  it('mantém tokens, componentes e media queries', () => {
    // Uma amostra de cada camada: token, botão, e uma classe de cada página
    // transposta do protótipo. Se a poda comer regra, cai aqui.
    for (const trecho of [
      '--accent:#0097b2',
      '--brand-gradient:',
      '.btn-cta{',
      '.btn-wa{',
      '.curso-hero{',
      '.curso-matricula',
      '.curso-linha{',
      '.lista-ajuda{',
      '.ck-resumo{',
      '.fi{',
      '@media (max-width:960px)',
      '@media (prefers-color-scheme:dark)',
    ]) {
      expect(PUBLIC_CSS_SERVIDO, `sumiu do CSS servido: ${trecho}`).toContain(trecho);
    }
  });

  it('tem o mesmo número de chaves da fonte', () => {
    // Comentário não abre nem fecha bloco, então a contagem tem de bater.
    const chaves = (s: string) => [s.split('{').length, s.split('}').length];
    expect(chaves(PUBLIC_CSS_SERVIDO)).toEqual(chaves(PUBLIC_CSS));
  });
});
