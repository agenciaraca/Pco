/**
 * "Não consegui ler" não pode ser impresso como "não existe".
 *
 * O site público tem uma regra boa e uma consequência ruim. A regra:
 * `projections.ts` embrulha toda leitura em `safe()`, e **nunca** devolve 500
 * por erro de banco — a vitrine não pode cair porque uma tabela não respondeu.
 * A consequência: o `safe()` devolvia o fallback e a página seguia como se o
 * fallback fosse a verdade.
 *
 * Em 7/set/2026 o log de produção tinha **21 leituras do site público
 * falhando** (cursos, posts, certificados) por queda de conexão. O que o
 * visitante via naqueles momentos:
 *
 * - `/formacoes` com a lista vazia — a escola sem nenhuma formação;
 * - `/formacao/:slug` respondendo **404** — a página que vende dizendo que o
 *   curso não existe, para o comprador e para o robô do Google;
 * - `/blog/:slug` idem.
 *
 * É a mesma regra que este projeto já aplica às telas de métrica ("zero diz
 * *medi e não houve*; travessão diz *não medi*") e às telas do aluno ("sem rede
 * não é 'não existe'"). Faltava no único lugar em que o leitor é um
 * desconhecido decidindo comprar.
 *
 * ## Por que `AsyncLocalStorage`, e não mudar as assinaturas
 *
 * As projeções são chamadas de oito lugares e devolvem listas e objetos
 * diretos. Trocar todas por um `{ ok, valor }` espalharia a checagem por todo
 * o roteador e convidaria a esquecê-la em um ponto — que é como o defeito
 * apareceu. Aqui a falha é registrada onde acontece (`safe`) e consultada onde
 * importa (o render), sem passar por baixo de sete funções que não têm nada a
 * ver com isso.
 *
 * O armazém é **por requisição**: uma variável de módulo vazaria a falha de um
 * visitante para a página do seguinte.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

interface Coleta {
  falhas: string[];
}

const armazem = new AsyncLocalStorage<Coleta>();

/** Roda o manipulador da requisição com um coletor limpo. */
export function comColetaDeFalhas<T>(fn: () => Promise<T>): Promise<T> {
  return armazem.run({ falhas: [] }, fn);
}

/**
 * Anota que uma leitura falhou nesta requisição.
 *
 * Fora de uma requisição (script, teste, boot) não há coletor e a chamada é
 * inócua — de propósito: registrar falha não pode ser motivo de erro novo.
 */
export function registrarFalhaDeLeitura(rotulo: string): void {
  armazem.getStore()?.falhas.push(rotulo);
}

/** Alguma leitura falhou ao montar esta página? */
export function houveFalhaDeLeitura(): boolean {
  return (armazem.getStore()?.falhas.length ?? 0) > 0;
}

/** Quais falharam — para o log e para a página de indisponibilidade. */
export function falhasDaRequisicao(): string[] {
  return [...(armazem.getStore()?.falhas ?? [])];
}
