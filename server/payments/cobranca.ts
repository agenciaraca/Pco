// Emite a cobrança no gateway certo, e só cai para o reserva quando é seguro.
//
// Ponto único: os três checkouts (aluno logado, visitante, agendamento de
// sessão) passam por aqui. Antes cada um repetia a mesma sequência — escolher
// gateway, achar o provider, decifrar credencial, chamar `createPayment` — e
// era nessa repetição que "o primeiro ativo" morava em três lugares.

import * as gatewaysRepo from './gateways-repo';
import { candidatosPara } from './roteamento';
import { getPaymentProvider } from './providers/registry';
import { PaymentProviderError } from './providers/types';
import type { CreatePaymentInput, CreatePaymentResult } from './providers/types';
import type { PaymentGateway } from './types';
import type { MetodoPagamento } from '../../shared/metodos-pagamento';

export interface TentativaDeCobranca {
  gatewayId: string;
  provider: string;
  ok: boolean;
  codigo?: string;
  mensagem?: string;
}

export interface CobrancaFeita {
  /** Quem cobrou de fato. Pode não ser o principal. */
  gateway: PaymentGateway;
  resultado: CreatePaymentResult;
  /** Todas as tentativas, na ordem. Vai para o log do pedido. */
  tentativas: TentativaDeCobranca[];
}

export class SemGatewayParaCobrar extends Error {
  constructor(mensagem: string) {
    super(mensagem);
  }
}

/**
 * O erro autoriza tentar o próximo gateway?
 *
 * **Só `PaymentProviderError` marcado `criouCobranca: 'nao'`.** Qualquer outra
 * coisa — um `TypeError` de rede, um `AbortError` de tempo esgotado, um erro
 * que ninguém classificou — significa que a requisição pode ter chegado, e
 * cobrar de novo em outro gateway seria cobrar duas vezes a mesma pessoa.
 *
 * A falha segura aqui é **parar**: uma venda perdida se refaz, uma cobrança
 * dobrada se devolve com dor e desconfiança.
 */
function podeTentarOProximo(err: unknown): boolean {
  return err instanceof PaymentProviderError && err.criouCobranca === 'nao';
}

/**
 * Quem será tentado, em ordem.
 *
 * Separado de `cobrar` porque o pedido nasce **antes** da cobrança e precisa
 * nascer com um gateway: o primeiro daqui. Se o reserva acabar cobrando,
 * `attachGatewayResult` reescreve o campo — e tem de reescrever, senão o
 * webhook não casa.
 *
 * Gateway explícito não ganha reserva: quem escolheu o gateway escolheu o
 * gateway, e trocá-lo por baixo seria decidir por quem já decidiu.
 */
export async function escolherCandidatos(opts: {
  metodo?: MetodoPagamento;
  gatewayExplicito?: PaymentGateway | null;
}): Promise<PaymentGateway[]> {
  if (opts.gatewayExplicito) return [opts.gatewayExplicito];
  return await candidatosPara(opts.metodo);
}

export async function cobrar(opts: {
  /** Pix, boleto ou cartão. Ausente = comportamento antigo (o gateway decide). */
  metodo?: MetodoPagamento;
  input: CreatePaymentInput;
  /** De `escolherCandidatos`. O primeiro é o principal. */
  candidatos: PaymentGateway[];
}): Promise<CobrancaFeita> {
  const { candidatos } = opts;

  if (candidatos.length === 0) {
    throw new SemGatewayParaCobrar(
      opts.metodo
        ? 'Nenhum gateway configurado para este meio de pagamento.'
        : 'Nenhum gateway de pagamento ativo configurado.',
    );
  }

  const tentativas: TentativaDeCobranca[] = [];
  let ultimoErro: unknown = null;

  for (const gw of candidatos) {
    const provider = getPaymentProvider(gw.provider);
    if (!provider) {
      tentativas.push({
        gatewayId: gw.id,
        provider: gw.provider,
        ok: false,
        codigo: 'PROVIDER_NOT_IMPLEMENTED',
        mensagem: `Provider ${gw.provider} não cobra.`,
      });
      continue;
    }
    const creds = await gatewaysRepo.getDecryptedCredentials(gw.id).catch(() => null);
    if (!creds) {
      // Credencial ilegível é do mesmo tipo do provider ausente: nada saiu da
      // máquina, então o próximo da rota pode ser tentado.
      tentativas.push({
        gatewayId: gw.id,
        provider: gw.provider,
        ok: false,
        codigo: 'GATEWAY_MISCONFIGURED',
        mensagem: 'Gateway sem credencial legível.',
      });
      continue;
    }

    try {
      const resultado = await provider.createPayment(gw, creds, {
        ...opts.input,
        metodo: opts.metodo,
      });
      tentativas.push({ gatewayId: gw.id, provider: gw.provider, ok: true });
      return { gateway: gw, resultado, tentativas };
    } catch (err) {
      ultimoErro = err;
      tentativas.push({
        gatewayId: gw.id,
        provider: gw.provider,
        ok: false,
        codigo: err instanceof PaymentProviderError ? err.code : 'ERRO',
        mensagem: err instanceof Error ? err.message : String(err),
      });
      if (!podeTentarOProximo(err)) throw err;
    }
  }

  if (ultimoErro) throw ultimoErro;
  throw new SemGatewayParaCobrar('Nenhum gateway conseguiu emitir a cobrança.');
}
