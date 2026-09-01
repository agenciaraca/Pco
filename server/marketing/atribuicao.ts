/**
 * De onde veio a venda.
 *
 * O AVA vendeu por dois dias sem guardar isso. A loja WooCommerce guardava, em
 * `_wc_order_attribution_*`, e foi de lá que vieram os cinco anos de histórico:
 * 720 pedidos com origem, 185 vindos do Google, campanhas com nome
 * (`PerformancePCO2025`, `PCO-AMPLAS-CONV-25`). Sem isso, "qual campanha
 * converteu" não tem resposta — só palpite.
 *
 * ## Duas regras que este módulo existe para sustentar
 *
 * **Nulo não vira "direto".** 1.125 dos 1.845 pedidos importados não têm
 * atribuição nenhuma na origem. Marcá-los como tráfego direto transformaria
 * "não medi" em "medi e foi direto" — e inflaria o canal que já é o mais fácil
 * de superestimar. Sem dado, o quadro fica em travessão.
 *
 * **A atribuição é do pedido, não da pessoa.** A mesma pessoa chega por um
 * anúncio hoje e por busca orgânica no ano que vem; presa ao aluno, a segunda
 * visita apagaria a primeira.
 */

export type { Atribuicao } from '../../shared/atribuicao';
export { resumoDaOrigem, temAtribuicao } from '../../shared/atribuicao';

import { type Atribuicao, CAMPOS_ATRIBUICAO, temAtribuicao } from '../../shared/atribuicao';

const CAMPOS = CAMPOS_ATRIBUICAO;

const MAX = 300;

/**
 * Monta a atribuição a partir dos parâmetros de uma URL e do referrer.
 *
 * Devolve `null` quando não há nada de útil — e é isso que preserva a regra do
 * travessão: um pedido sem origem conhecida grava NULL, não um objeto vazio
 * fingindo medição.
 */
export function daNavegacao(
  params: Record<string, string | undefined> | URLSearchParams,
  referrer?: string | null,
): Atribuicao | null {
  const ler = (k: string): string | undefined => {
    const v = params instanceof URLSearchParams ? params.get(k) : params[k];
    const s = (v ?? '').trim();
    return s ? s.slice(0, MAX) : undefined;
  };

  const a: Atribuicao = {
    origem: ler('utm_source'),
    meio: ler('utm_medium'),
    campanha: ler('utm_campaign'),
    conteudo: ler('utm_content'),
    termo: ler('utm_term'),
    idCampanha: ler('utm_id'),
    gclid: ler('gclid'),
    fbclid: ler('fbclid'),
    referrer: (referrer ?? '').trim().slice(0, MAX) || undefined,
  };

  // O tipo é derivado, e derivar é melhor que perguntar: quem monta a URL do
  // anúncio erra o utm_medium com frequência, mas a presença do gclid não mente.
  if (a.gclid || a.fbclid || a.origem || a.campanha) a.tipoOrigem = 'utm';
  else if (a.referrer) a.tipoOrigem = 'referral';

  return temAtribuicao(a) ? limpa(a) : null;
}

/** Remove chaves vazias — jsonb com `{"origem": ""}` mente tanto quanto zero. */
export function limpa(a: Atribuicao): Atribuicao {
  const out: Atribuicao = {};
  for (const k of CAMPOS) {
    const v = a[k];
    if (typeof v === 'string' && v.trim()) out[k] = v.trim().slice(0, MAX);
  }
  return out;
}

