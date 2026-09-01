import { describe, it, expect } from 'vitest';
import { decodificarEntidades } from '../shared/entidades-html';

/**
 * O caso real que motivou isto estava visível na lista de aulas em produção:
 * `A psicoterapia pode dar &#8220;errado&#8221;?`. O WordPress entrega o título
 * escapado, a importação gravou assim, e o React escapa de novo na exibição —
 * fazendo o certo. Quem lia a entidade era o aluno.
 */
describe('decodificarEntidades', () => {
  it('desfaz as aspas curvas que vieram do WordPress', () => {
    expect(decodificarEntidades('A psicoterapia pode dar &#8220;errado&#8221;?')).toBe(
      'A psicoterapia pode dar \u201cerrado\u201d?',
    );
  });

  it('desfaz o travessão dos títulos de módulo', () => {
    expect(decodificarEntidades('2° Módulo &#8211; Epidemiologia')).toBe(
      '2° Módulo \u2013 Epidemiologia',
    );
  });

  it('aceita entidade hexadecimal e nomeada', () => {
    expect(decodificarEntidades('&#x201C;a&#x201D; &mdash; b')).toBe('\u201ca\u201d \u2014 b');
  });

  it('desfaz &amp; por último: `&amp;lt;` é o texto `&lt;`, não `<`', () => {
    // Ordem errada aqui produziria `<`, mudando o significado do texto.
    expect(decodificarEntidades('&amp;lt;')).toBe('&lt;');
    expect(decodificarEntidades('Direito &amp; Justiça')).toBe('Direito & Justiça');
  });

  it('entidade desconhecida fica como está, em vez de virar tradução inventada', () => {
    expect(decodificarEntidades('&naoexiste; fim')).toBe('&naoexiste; fim');
  });

  it('texto sem & não é tocado', () => {
    expect(decodificarEntidades('Título normal')).toBe('Título normal');
    expect(decodificarEntidades('')).toBe('');
  });
});
