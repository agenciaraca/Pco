import { expect } from 'vitest';

/**
 * `every` numa lista vazia é **verdadeiro**. Este arquivo existe por causa disso.
 *
 * A auditoria de 3/set/2026 encontrou **32 asserções vacuamente verdadeiras**
 * na suíte, quase todas com a mesma forma:
 *
 * ```ts
 * const meus = await repo.listForUser('u-A');
 * expect(meus.every((x) => x.userId === 'u-A')).toBe(true);
 * ```
 *
 * Lido rápido, isso parece cobrar isolamento entre usuários. Mas se
 * `listForUser` passar a devolver **lista vazia** — porque o filtro ficou
 * estrito demais, porque a semente mudou de nome, porque o `userId` deixou de
 * casar —, a asserção continua verde. Ou seja: **o caso passa exatamente
 * quando a função quebra do jeito mais comum**.
 *
 * Elas estavam concentradas justamente nos testes de isolamento por usuário —
 * pedidos, progresso, notas da coordenação, histórico do tutor de IA, tempo de
 * assistência —, que são os que respondem "um aluno vê o dado de outro?". A
 * garantia mais cara da base era a menos testada, e parecia testada.
 *
 * ## Uso
 *
 * ```ts
 * expect(naoVazio(meus).every((x) => x.userId === 'u-A')).toBe(true);
 * ```
 *
 * Devolve a mesma lista, então encaixa sem reescrever a asserção.
 *
 * **Quando NÃO usar:** quando a lista vazia é o resultado esperado. Aí a
 * asserção certa é `expect(lista).toEqual([])`, que diz o que se quer, em vez
 * de um `every` que passa por acidente.
 */
export function naoVazio<T>(lista: readonly T[], oQue = 'a lista'): readonly T[] {
  expect(
    lista.length,
    `${oQue} veio vazia — um \`every\` sobre lista vazia é verdadeiro, ` +
      'então este caso passaria justamente com a função quebrada',
  ).toBeGreaterThan(0);
  return lista;
}
