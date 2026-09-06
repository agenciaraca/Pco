import type { CriouCobranca } from './types';

/**
 * O gateway respondeu com erro. A cobrança chegou a existir?
 *
 * ## O defeito que isto conserta
 *
 * Cinco providers faziam, dentro de `createPayment`:
 *
 * ```ts
 * if (!res.ok) throw new PaymentProviderError(CODE, msg, 'nao');
 * ```
 *
 * com o comentário *"o gateway respondeu recusando: nada foi criado"*. O
 * comentário descreve o 400 e o 422 — e `!res.ok` é **tudo** fora da faixa 2xx,
 * inclusive 500, 502, 503, 504 e 429.
 *
 * Nenhum desses prova ausência de cobrança. O caso que importa é preciso: o
 * adquirente grava o pedido, o proxy à frente dele estoura o tempo e devolve
 * 502 — a cobrança **existe** e a resposta não chegou. Com `'nao'`, o motor de
 * fallback tenta o gateway reserva, que cria a segunda. É exatamente a
 * duplicidade que todo o resto do módulo foi escrito para impedir.
 *
 * ## A regra
 *
 * `'nao'` exige que o gateway tenha dito, ele mesmo, que recusou **antes** de
 * gravar. Isso é o 4xx de validação e de autorização. Todo o resto — 5xx,
 * excesso de requisições, conflito, tempo esgotado — é `'talvez'`, e `'talvez'`
 * não autoriza o reserva.
 *
 * Isso torna o fallback **mais raro**, e é o lado certo para errar: uma venda
 * perdida se refaz com um e-mail; uma cobrança dobrada se devolve com dor e
 * desconfiança, e é o aluno quem paga o custo do estorno em prazo.
 *
 * ## Por que 409 e 425 não são `'nao'`
 *
 * 409 é conflito — quase sempre chave de idempotência já usada, isto é, **a
 * cobrança existe**. 425 (`Too Early`) diz que a requisição pode ser repetida
 * pelo cliente, o que não é o mesmo que não ter efeito.
 *
 * ## O que continua fora daqui
 *
 * Falha que acontece **antes** de a requisição sair — credencial ausente,
 * documento inválido, provider sem chave — segue marcada `'nao'` no ponto de
 * origem, porque ali é certo. Esta função é só para resposta HTTP recebida.
 */
export function criouCobrancaPeloStatus(status: number): CriouCobranca {
  // 5xx: o servidor do gateway falhou depois de ter recebido o pedido. Pode ter
  // gravado. É o caso que motivou este arquivo.
  if (status >= 500) return 'talvez';

  // Excesso de requisições. Alguns gateways limitam **depois** de enfileirar.
  if (status === 429) return 'talvez';

  // Tempo esgotado do lado do gateway (408) e do lado de um proxy (504, já
  // coberto acima): a requisição chegou.
  if (status === 408) return 'talvez';

  // Conflito: idempotência já usada, ou recurso já existente. Cobrança existe.
  if (status === 409) return 'talvez';

  // "Cedo demais" — repetível pelo cliente, não sem efeito.
  if (status === 425) return 'talvez';

  // 4xx de validação/autorização: o gateway leu, recusou e não gravou.
  if (status >= 400) return 'nao';

  // 3xx e qualquer coisa fora do previsto. Não classificado não autoriza
  // retentativa — é o padrão de `PaymentProviderError` e vale aqui também.
  return 'talvez';
}
