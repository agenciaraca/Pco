// "Testar conexão" de um gateway de pagamento.
//
// Existia para e-mail, para os conectores de importação, para os webhooks de
// saída e para a IA — e não existia justamente para pagamento, que é o domínio
// em que credencial vencida custa dinheiro. O modo de falha é conhecido: o
// worker da Sandra confirmava pagamento em silêncio até a chave expirar, e o
// `/admin/jobs` continuava dizendo que ele rodava.
//
// Este caminho **nunca cobra ninguém**: cada `ping` de provider é uma leitura.

import * as gatewaysRepo from './gateways-repo';
import { getPaymentProvider } from './providers/registry';
import type { PingResult } from './providers/types';

export interface GatewayPingResult extends PingResult {
  /** Ficou registrado no gateway? `false` quando não havia o que registrar. */
  registrado: boolean;
}

/**
 * Nunca lança: provider que estoure vira resultado com `ok: false`. Um botão
 * de teste que devolve 500 não diz nada sobre o gateway — diz sobre nós.
 */
export async function pingGateway(id: string): Promise<GatewayPingResult | null> {
  const gw = await gatewaysRepo.findById(id);
  if (!gw) return null;

  const provider = getPaymentProvider(gw.provider);
  if (!provider) {
    // `manual` e `legado-wp` não cobram nada e não têm API para consultar.
    // Dizer "OK" aqui seria mentira confortável.
    return {
      ok: false,
      alcancou: false,
      registrado: false,
      message: `"${gw.provider}" não é um gateway com API — é registro de venda feita fora do sistema.`,
    };
  }
  if (!provider.ping) {
    return {
      ok: false,
      alcancou: false,
      registrado: false,
      message: `Provider ${gw.provider} não expõe consulta de teste.`,
    };
  }

  // `getDecryptedCredentials` ficava **fora** deste `try`, e a promessa de
  // "nunca lança" logo acima era falsa: `decryptApiKey` estoura em quatro
  // casos — chave-mestra ausente, formato inválido, IV/tag errados e falha de
  // autenticação AES-GCM depois de girar `AI_KEY_ENCRYPTION_SECRET`. O
  // resultado era um 500 genérico pelo `app.onError` **sem gravar
  // `lastTestStatus`**: o card seguia exibindo o último teste bem-sucedido.
  // Degradação silenciosa exatamente no recurso cujo propósito é diagnosticar.
  let resultado: PingResult;
  try {
    const creds = await gatewaysRepo.getDecryptedCredentials(id);
    if (!creds) return null;
    resultado = await provider.ping(gw, creds);
  } catch (err) {
    resultado = {
      ok: false,
      alcancou: false,
      message: `Falha ao testar: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  await gatewaysRepo.recordTest(id, resultado.ok ? 'ok' : 'error', resultado.message);
  return { ...resultado, registrado: true };
}
