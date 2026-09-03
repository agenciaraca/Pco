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
  /**
   * Quantas varreduras seguidas falharam **por inteiro** (a função lançou,
   * nenhuma cobrança foi consultada). Zera na primeira que completa.
   *
   * Existe porque este worker é o **único** confirmador de pagamento da
   * Sandra — o gateway ainda não emite `charge.paid`. Até 3/set/2026 o tick
   * era `void varrer().catch(() => undefined)`: credencial expirada, mudança
   * de contrato da API ou DNS fora derrubavam a varredura em silêncio, o
   * `/admin/jobs` seguia dizendo que o worker rodava, e **pagamento real
   * deixava de virar matrícula** até a janela de 10 dias fechar sozinha.
   */
  falhasSeguidas: number;
  /** A varredura completou alguma vez desde o boot? */
  saudavel: boolean;
}

const estado: Estado = {
  ultimaExecucao: null,
  pendentesVistos: 0,
  confirmados: 0,
  erros: 0,
  ultimoErro: null,
  falhasSeguidas: 0,
  saudavel: true,
};

/** A partir daqui não é soluço de rede: é problema que precisa de gente. */
const FALHAS_ATE_GRITAR = 3;

export function getStatus(): Estado & { nome: string } {
  return { nome: 'sandra-poll', ...estado };
}

export async function varrer(): Promise<{ vistos: number; confirmados: number }> {
  estado.ultimaExecucao = new Date().toISOString();
  estado.falhasSeguidas = 0;
  estado.saudavel = true;
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

/**
 * Roda `varrer()` sem deixar a exceção sumir.
 *
 * O tick não pode derrubar o processo, mas também não pode fingir que
 * funcionou: quem confirma pagamento aqui é este laço, e um erro engolido
 * significa dinheiro que entrou e matrícula que não saiu.
 */
async function tick(): Promise<void> {
  try {
    await varrer();
  } catch (err) {
    estado.falhasSeguidas++;
    estado.saudavel = false;
    estado.erros++;
    estado.ultimoErro = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error(
      `[sandra-poll] varredura falhou (${estado.falhasSeguidas}ª seguida): ${estado.ultimoErro}`,
    );
    if (estado.falhasSeguidas >= FALHAS_ATE_GRITAR) {
      // eslint-disable-next-line no-console
      console.error(
        `[sandra-poll] ATENÇÃO: ${estado.falhasSeguidas} varreduras seguidas falharam. ` +
          'Enquanto isso, cobrança paga na Sandra NÃO está virando matrícula. ' +
          'Confira a credencial do gateway em /admin/payments/gateways.',
      );
    }
  }
}

let timer: NodeJS.Timeout | null = null;

/** Intervalo generoso, como a doc da Sandra pede: minutos, não segundos. */
export function startWorker(intervalMs = 5 * 60_000): void {
  if (timer) return;
  timer = setInterval(() => {
    void tick();
  }, intervalMs);
  // `unref` para que o worker não segure o processo em teste nem no build.
  timer.unref?.();
}

export function stopWorker(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
