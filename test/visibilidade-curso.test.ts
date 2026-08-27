import { describe, it, expect } from 'vitest';
import { isPubliclyListed } from '../shared/visibilidade';
import { isPubliclyListed as doServidor } from '../server/public/projections';

/**
 * A regra de "está na vitrine" já existia no servidor, com um comentário
 * dizendo ser o portão único por onde todo caminho público passava. Não era:
 * o catálogo do SPA filtrava por "tem produto ativo" e ignorava
 * `publicListed`. Curso tirado da vitrine sumia do site público, tinha a
 * compra barrada no checkout — e continuava na prateleira do `/catalogo`,
 * mandando quem clicasse para um 404.
 *
 * A função mudou de casa para `shared/` para que servidor e navegador leiam o
 * mesmo código. Estes testes existem para que ela não se duplique de novo.
 */

describe('isPubliclyListed', () => {
  it('curso sem flag nenhuma aparece — a regra é aditiva', () => {
    expect(isPubliclyListed({})).toBe(true);
    expect(isPubliclyListed({ title: 'Psicanálise' })).toBe(true);
  });

  it('active: false tira do site — não se vende o que ninguém pode cursar', () => {
    expect(isPubliclyListed({ active: false })).toBe(false);
    expect(isPubliclyListed({ active: false, publicListed: true })).toBe(false);
  });

  it('publicListed: false tira só da vitrine', () => {
    expect(isPubliclyListed({ publicListed: false })).toBe(false);
    // E o curso segue ativo: quem já comprou continua acessando.
    expect(isPubliclyListed({ active: true, publicListed: false })).toBe(false);
  });

  it('as duas ligadas aparecem', () => {
    expect(isPubliclyListed({ active: true, publicListed: true })).toBe(true);
  });

  it('o servidor exporta exatamente a mesma função, não uma cópia', () => {
    // Se alguém reescrever a regra em projections.ts em vez de reexportar,
    // este teste cai — que é o ponto.
    expect(doServidor).toBe(isPubliclyListed);
  });
});
