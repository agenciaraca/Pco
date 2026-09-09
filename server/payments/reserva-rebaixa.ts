/**
 * O gateway reserva pode custar a promessa da vitrine — sem dar erro nenhum.
 *
 * ## O caso, duas vezes
 *
 * A promessa de parcelamento é o **mínimo** entre os candidatos da rota
 * (`condicoes.ts`), e tem de ser: quem cai no reserva não pode descobrir a
 * troca depois de decidir comprar. A consequência é que um reserva fraco
 * rebaixa o método inteiro.
 *
 * Em 5/set/2026 as três rotas nasceram com o Pagar.me de reserva. O Asaas faz
 * 6x no boleto, o Pagar.me faz 1x, e `min(6,1) = 1`: o site parou de anunciar
 * o boleto parcelado que a escola vende. Foi corrigido em 6/set.
 *
 * **Em 8/set voltou** — pela tela, oito minutos depois de alguém testar outro
 * gateway em `/admin/gateways`. Medido em produção em 9/set: `teto boleto = 1`.
 * A escola anunciava 6x e o sistema oferecia 1x, de novo.
 *
 * Duas vezes o mesmo prejuízo diz que faltava código, não atenção: a regra
 * estava escrita na documentação e **nada a verificava**. O prejuízo não
 * aparece como erro; aparece como uma linha a menos na vitrine, que é o que
 * ninguém procura.
 *
 * ## O que isto NÃO faz
 *
 * Não recusa a configuração. Rebaixar pode ser deliberado — aceitar menos
 * parcelas para ter um segundo gateway é uma troca legítima, e é do dono. O
 * que não pode é a troca acontecer **em silêncio**. Por isso isto é um aviso
 * com o número junto: quanto se prometia, quanto se promete, e por causa de
 * quem.
 */
import { getPaymentProvider } from './providers/registry';
import { listarRotas } from './roteamento';
import * as gatewaysRepo from './gateways-repo';
import type { PaymentGateway } from './types';
import { PARCELAS_MAXIMAS_POR_METODO } from '../../shared/parcelamento';
import { METODOS_PAGAMENTO, type MetodoPagamento } from '../../shared/metodos-pagamento';

export interface Rebaixamento {
  metodo: MetodoPagamento;
  /** Quantas parcelas o principal sozinho sustentaria. */
  comOPrincipal: number;
  /** Quantas a rota promete de fato, com o reserva no meio. */
  comOReserva: number;
  /** O nome do reserva, para a mensagem dizer de quem é a culpa. */
  reserva: string;
}

/** Quantas parcelas um gateway sustenta num método, pela política e pelo provider. */
function tetoDe(gw: PaymentGateway | null, metodo: MetodoPagamento): number {
  if (!gw) return 0;
  const provider = getPaymentProvider(gw.provider);
  // Provider sem implementação não honra nada — e o mínimo tem de refletir
  // isso, como em `condicoes.ts`.
  const doProvider = provider?.parcelasMaximas[metodo] ?? 1;
  return Math.min(PARCELAS_MAXIMAS_POR_METODO[metodo], doProvider);
}

/**
 * Os métodos em que o reserva configurado promete menos que o principal.
 *
 * Nunca lança: quem chama é painel de saúde.
 */
export async function rebaixamentosDeParcela(): Promise<Rebaixamento[]> {
  const achados: Rebaixamento[] = [];
  let rotas: Awaited<ReturnType<typeof listarRotas>>;
  try {
    rotas = await listarRotas();
  } catch {
    return achados;
  }

  for (const metodo of METODOS_PAGAMENTO) {
    const rota = rotas.find((r) => r.metodo === metodo);
    if (!rota?.principalId || !rota.fallbackId) continue;
    try {
      const principal = await gatewaysRepo.findById(rota.principalId);
      const reserva = await gatewaysRepo.findById(rota.fallbackId);
      if (!principal || !reserva) continue;
      const doPrincipal = tetoDe(principal, metodo);
      const doReserva = tetoDe(reserva, metodo);
      // Só interessa quando o reserva PUXA PARA BAIXO. Reserva mais capaz que
      // o principal não muda promessa nenhuma — o mínimo continua sendo o
      // principal — e avisar disso seria ruído.
      if (doReserva < doPrincipal) {
        achados.push({
          metodo,
          comOPrincipal: doPrincipal,
          comOReserva: Math.min(doPrincipal, doReserva),
          reserva: reserva.displayName || reserva.provider,
        });
      }
    } catch {
      // Um método ilegível não pode derrubar a checagem dos outros.
    }
  }
  return achados;
}
