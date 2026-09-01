/**
 * O que o status de um pedido diz sobre a matrícula.
 *
 * Mora aqui, e não dentro do script de importação, pelo mesmo motivo que levou
 * o mapa de rotas fundidas para `server/public/rotas-fundidas.ts`: regra de
 * negócio escondida em script é regra que ninguém testa e que a próxima pessoa
 * reescreve por engano.
 *
 * A regra é do dono da escola (1/set/2026) e vale para o histórico da loja
 * WooCommerce e para o checkout próprio:
 *
 *   concluído ................. ATIVA      — pagou, está matriculado
 *   estorno ................... CANCELADA  — a compra foi desfeita
 *   desistência ............... CANCELADA  — a pessoa saiu
 *   em atraso / em espera ..... SUSPENSA   — pagamento pendurado, acesso para
 *   cancelado antes de pagar .. NENHUMA    — nunca houve matrícula
 *
 * **Situação não é prazo.** Uma matrícula `ativa` de 2021 está vencida pelo
 * `accessMonths` do curso, e uma `suspensa` de ontem está dentro do prazo e
 * mesmo assim não abre. São duas perguntas, e o portão faz as duas — ver
 * `guard.ts`.
 */

export type SituacaoMatricula = 'ativa' | 'suspensa' | 'cancelada' | 'nenhuma';

/** Status de pedido do próprio AVA. Espelha `OrderStatus` de payments/types. */
export type StatusPedidoAva = 'pending' | 'processing' | 'paid' | 'failed' | 'canceled' | 'refunded';

/**
 * Status da loja WooCommerce → status do AVA + o que implica na matrícula.
 *
 * `desistente`, `em-atraso` e `reembolsado` são status personalizados que a
 * escola criou no WooCommerce ao longo dos anos. Não existem no vocabulário do
 * AVA, então viram o equivalente mais próximo — e o original é gravado no
 * histórico do pedido, porque é ele que explica o caso para quem olhar depois.
 */
export const DA_LOJA: Record<string, { ava: StatusPedidoAva; situacao: SituacaoMatricula }> = {
  completed: { ava: 'paid', situacao: 'ativa' },
  processing: { ava: 'paid', situacao: 'ativa' },
  refunded: { ava: 'refunded', situacao: 'cancelada' },
  reembolsado: { ava: 'refunded', situacao: 'cancelada' },
  desistente: { ava: 'canceled', situacao: 'cancelada' },
  'on-hold': { ava: 'pending', situacao: 'suspensa' },
  'em-atraso': { ava: 'pending', situacao: 'suspensa' },
  pending: { ava: 'pending', situacao: 'suspensa' },
  cancelled: { ava: 'canceled', situacao: 'nenhuma' },
  failed: { ava: 'failed', situacao: 'nenhuma' },
};

/** Situação implicada por um status de pedido do AVA. */
export function situacaoDoStatus(status: StatusPedidoAva): SituacaoMatricula {
  switch (status) {
    case 'paid':
      return 'ativa';
    case 'refunded':
      return 'cancelada';
    case 'pending':
    case 'processing':
      return 'suspensa';
    case 'canceled':
    case 'failed':
      return 'nenhuma';
  }
}

/**
 * Peso para resolver conflito quando a mesma pessoa tem vários pedidos do mesmo
 * curso — comprou, foi estornada, comprou de novo.
 *
 * A mais forte vence, e isso é decisão de política, não de acaso: quem tem um
 * pedido pago em pé continua com acesso mesmo que outro pedido do mesmo curso
 * tenha sido estornado. O contrário trancaria quem pagou duas vezes e foi
 * estornado uma.
 */
const FORCA: Record<SituacaoMatricula, number> = {
  ativa: 3,
  suspensa: 2,
  cancelada: 1,
  nenhuma: 0,
};

export function situacaoMaisForte(
  a: SituacaoMatricula,
  b: SituacaoMatricula,
): SituacaoMatricula {
  return FORCA[a] >= FORCA[b] ? a : b;
}

/** A situação resultante de um conjunto de pedidos do mesmo curso. */
export function situacaoDeVarios(situacoes: SituacaoMatricula[]): SituacaoMatricula {
  return situacoes.reduce<SituacaoMatricula>((acc, s) => situacaoMaisForte(acc, s), 'nenhuma');
}

/**
 * Esta matrícula deve receber aviso de vencimento?
 *
 * Não: suspensa e cancelada não são caso de vencimento. Mandar "seu acesso
 * expirou" para quem teve o pedido estornado manda renovar o que foi desfeito —
 * o aviso vira cobrança de quem já pediu o dinheiro de volta. Ausente é `ativa`,
 * porque o mapa só carrega o que foge do normal.
 */
export function avisaVencimento(situacao: SituacaoMatricula | undefined): boolean {
  return situacao === undefined || situacao === 'ativa';
}
