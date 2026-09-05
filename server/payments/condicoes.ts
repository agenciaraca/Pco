// O que a vitrine pode prometer, por meio de pagamento.
//
// ## Por que não é uma constante
//
// "12x" era número fixo na vitrine enquanto o pedido enviado ao gateway
// oferecia 1x. O conserto de 4/set/2026 pôs os dois lados a ler o mesmo módulo
// — e isso resolveu a divergência entre *código e código*, mas não a que
// sobrou: **a política da escola não é a capacidade do gateway**.
//
// A escola quer vender em 12x no cartão e 6x no boleto. O Pagar.me parcela
// cartão e **não** parcela boleto (a API v5 não tem o campo). O Asaas parcela
// boleto, emitindo um carnê. Ou seja: o que se pode prometer depende de **quem
// vai cobrar**, e quem vai cobrar sai da tabela de roteamento.
//
// ## A regra do mínimo, e por que ela não é conservadorismo
//
// Cada método tem um principal e pode ter um reserva. Se o principal faz 6x e o
// reserva faz 1x, anunciar 6x é anunciar uma condição que **metade das compras
// não vai receber** — e quem cair no reserva descobre isso na tela do gateway,
// depois de ter decidido comprar. Por isso a condição anunciada é o **mínimo
// entre todos os candidatos**: o que se promete é o que qualquer um deles
// honra.

import { candidatosPara } from './roteamento';
import { getPaymentProvider } from './providers/registry';
import {
  PARCELAS_MAXIMAS_POR_METODO,
  parcelasPara,
  valorDaParcelaCents,
} from '../../shared/parcelamento';
import { METODOS_PAGAMENTO, type MetodoPagamento } from '../../shared/metodos-pagamento';

export interface CondicaoDePagamento {
  metodo: MetodoPagamento;
  /** Quantas vezes, já considerando preço, política e gateway. */
  parcelas: number;
  valorParcelaCents: number;
}

/**
 * Teto real de parcelas de um método: política ∩ capacidade de quem vai cobrar.
 *
 * Devolve `0` quando **ninguém** cobra aquele método — e zero não é "à vista",
 * é "não oferecemos". A vitrine some com a linha, em vez de anunciar um meio de
 * pagamento que o checkout vai recusar.
 */
export async function tetoDeParcelas(metodo: MetodoPagamento): Promise<number> {
  const candidatos = await candidatosPara(metodo);
  if (candidatos.length === 0) return 0;

  let teto = PARCELAS_MAXIMAS_POR_METODO[metodo];
  for (const gw of candidatos) {
    const provider = getPaymentProvider(gw.provider);
    // Provider sem implementação não deveria estar na lista; se estiver, ele
    // não honra nada — e o mínimo tem de refletir isso.
    const doProvider = provider?.parcelasMaximas[metodo] ?? 1;
    teto = Math.min(teto, doProvider);
  }
  return Math.max(1, teto);
}

/**
 * As condições que a vitrine pode anunciar para um preço.
 *
 * Ordem: cartão, boleto, pix — é a ordem em que se lê "12x no cartão ou 6x no
 * boleto". Método sem gateway sai da lista.
 */
export async function condicoesDePagamento(
  valorCents: number,
): Promise<CondicaoDePagamento[]> {
  const ordem: MetodoPagamento[] = ['credit_card', 'boleto', 'pix'];
  const fora = METODOS_PAGAMENTO.filter((m) => !ordem.includes(m));
  const condicoes: CondicaoDePagamento[] = [];

  for (const metodo of [...ordem, ...fora]) {
    const teto = await tetoDeParcelas(metodo);
    if (teto === 0) continue;
    const parcelas = parcelasPara(valorCents, teto);
    condicoes.push({
      metodo,
      parcelas,
      valorParcelaCents: valorDaParcelaCents(valorCents, parcelas),
    });
  }
  return condicoes;
}
