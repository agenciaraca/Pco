/**
 * Sondagem das cobranças da Sandra — a confirmação de pagamento enquanto o
 * aviso de volta não existe.
 *
 * A Sandra ainda não emite `charge.paid` (é fase 2 do lado dela). A própria
 * documentação diz o que fazer nesse meio-tempo: consultar, **em minutos, não
 * em segundos**, e parar depois do vencimento. É o que este worker faz.
 *
 * Três decisões que valem estar escritas:
 *
 * 1. **Não sonda para sempre.** Pedido pendente há mais de `JANELA_DIAS` sai da
 *    varredura. Sondar cobrança vencida há meses gasta o limite da chave (300
 *    chamadas por minuto, por chave) e não descobre nada — quem pagou depois do
 *    vencimento aparece por renegociação, que é caso de gente, não de robô.
 *
 * 2. **Quem libera o acesso é a mesma função do webhook.**
 *    `aplicarSituacaoDoPedido` é importada de `app.ts`, não reescrita aqui.
 *    Duas implementações de "o que o pagamento libera" divergem em silêncio, e
 *    a divergência só aparece quando um aluno paga e não entra.
 *
 * 3. **Só sobe de pendente para pago.** Pedido cancelado ou estornado não
 *    ressuscita porque a Sandra ainda o lista; mudar esses estados é decisão de
 *    gente, e o worker não a toma.
 *
 * Quando a fase 2 entrar, o webhook assume e este worker vira rede de
 * segurança — `parseWebhook` já está escrito no contrato documentado.
 */

import * as ordersRepo from './orders-repo';
import * as gatewaysRepo from './gateways-repo';
import { consultarCobranca, lerOpcoes } from './providers/sandra';

/** Além disto, a cobrança já venceu e a sondagem não descobre mais nada. */
const JANELA_DIAS = 10;

interface Estado {
  ultimaExecucao: string | null;
  pendentesVistos: number;
  confirmados: number;
  erros: number;
  ultimoErro: string | null;
}

const estado: Estado = {
  ultimaExecucao: null,
  pendentesVistos: 0,
  confirmados: 0,
  erros: 0,
  ultimoErro: null,
};

export function getStatus(): Estado & { nome: string } {
  return { nome: 'sandra-poll', ...estado };
}

export async function varrer(): Promise<{ vistos: number; confirmados: number }> {
  estado.ultimaExecucao = new Date().toISOString();
  let vistos = 0;
  let confirmados = 0;

  // `listActive` traz o registro cru; `listAll` devolve a versão pública, sem
  // credencial — e a chave é justamente o que a sondagem precisa.
  const gateways = (await gatewaysRepo.listActive()).filter((g) => g.provider === 'sandra');
  if (gateways.length === 0) return { vistos, confirmados };

  const limite = Date.now() - JANELA_DIAS * 24 * 60 * 60 * 1000;
  const todos = await ordersRepo.listAll();
  const pendentes = todos.filter(
    (o) =>
      o.gatewayProvider === 'sandra' &&
      (o.status === 'pending' || o.status === 'processing') &&
      Boolean(o.externalId) &&
      new Date(o.createdAt).getTime() >= limite,
  );

  for (const pedido of pendentes) {
    const gw = gateways.find((g) => g.id === pedido.gatewayId) ?? gateways[0]!;
    const o = lerOpcoes(gw.options);
    const creds = await gatewaysRepo.getDecryptedCredentials(gw.id);
    if (!o.baseUrl || !o.tenantSlug || !creds?.apiKey) continue;
    vistos++;
    try {
      const r = await consultarCobranca(o.baseUrl, o.tenantSlug, creds.apiKey, pedido.externalId!);
      if (!r || r.status !== 'paid') continue;

      const atualizado = await ordersRepo.updateStatus(pedido.id, 'paid', 'sandra:poll');
      if (atualizado) {
        // Pelo ponto unico, mesmo caminho do webhook: quem volta depois de
        // um estorno tem a matricula `cancelada`, e so matricular de novo
        // nao a reativa.
        const { aplicarSituacaoDoPedido } = await import('../app');
        await aplicarSituacaoDoPedido(atualizado, pedido.status);
        confirmados++;
      }
    } catch (err) {
      estado.erros++;
      estado.ultimoErro = err instanceof Error ? err.message : String(err);
    }
  }

  estado.pendentesVistos = vistos;
  estado.confirmados += confirmados;
  return { vistos, confirmados };
}

let timer: NodeJS.Timeout | null = null;

/** Intervalo generoso, como a doc da Sandra pede: minutos, não segundos. */
export function startWorker(intervalMs = 5 * 60_000): void {
  if (timer) return;
  timer = setInterval(() => {
    void varrer().catch(() => undefined);
  }, intervalMs);
  // `unref` para que o worker não segure o processo em teste nem no build.
  timer.unref?.();
}

export function stopWorker(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
