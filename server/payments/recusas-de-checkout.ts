/**
 * Quem tentou comprar e foi recusado ANTES de virar pedido.
 *
 * ## O caso que criou este arquivo
 *
 * Em 7/set/2026 o checkout público passou a exigir data de nascimento e
 * endereço. O navegador de quem já tinha visitado o site guardava o script
 * anterior por uma hora, e esse script montava o corpo sem os campos novos: a
 * pessoa via os campos, preenchia, clicava em pagar, e levava
 * *"Informe a data de nascimento"* sobre um campo preenchido.
 *
 * Naquele dia **nenhum pedido foi criado** — e é isso que importa aqui. A
 * validação roda antes de `createOrder`, então a tentativa recusada não
 * aparece em `payment_orders`. O alarme da venda
 * (`saude-do-checkout.ts`) mede taxa de falha **sobre pedidos**: com zero
 * pedidos ele calcula `taxaFalhaPct = null`, o painel escreve "sem base para
 * medir", e ninguém é avisado.
 *
 * Ou seja: o alarme escrito para o dia em que a venda para enxergava a fila de
 * pedidos **falhando** e era cego para a fila **parar de encher**. É a mesma
 * classe de sempre neste projeto — a rotina rodava, contava e reportava
 * sucesso —, um passo acima na tubulação.
 *
 * ## O que se guarda, e o que NÃO se guarda
 *
 * Três campos: quando, por qual rota, e o motivo que a pessoa leu na tela.
 * **Não entra IP, nem e-mail, nem nome, nem nada do formulário** — de
 * propósito. O que se quer responder é *"quantas pessoas foram recusadas, e
 * pelo mesmo motivo?"*, e para isso identificar ninguém é necessário. Sem dado
 * pessoal, isto não vira categoria de exportação nem de expurgo, e o arquivo
 * pode ser lido por qualquer operador sem cuidado especial.
 *
 * ## O ruído, dito de frente
 *
 * Um robô postando lixo na rota também vira recusa contada. Por isso o número
 * nunca anda sozinho: o **motivo mais comum** vai junto, sempre. Lixo de robô
 * produz motivos variados e estranhos; checkout quebrado produz a mesma frase
 * repetida — e é a frase que diz o que consertar.
 */
import type { MiddlewareHandler } from 'hono';
import { JsonStore } from '../db/json-store';

export interface RecusaDeCheckout {
  ts: string;
  /** `publico` (visitante) ou `aluno` (logado). São dois caminhos distintos. */
  rota: 'publico' | 'aluno';
  /** A frase que a pessoa leu na tela, cortada. */
  motivo: string;
}

/**
 * Teto baixo de propósito: isto é sinal de operação, não histórico. Quinhentas
 * entradas cobrem com folga a janela de 24h que o alarme olha, e um arquivo
 * pequeno é um arquivo que ninguém precisa administrar.
 */
const MAX_ENTRIES = 500;

const store = new JsonStore<RecusaDeCheckout>('checkout-recusas.json', () => []);

/**
 * Anota uma recusa. **Nunca lança.**
 *
 * Chamada de dentro dos caminhos de erro do checkout: se ela derrubasse a
 * requisição, uma falha de disco trocaria "seu CPF está errado" por um 500 —
 * piorando exatamente o momento que este arquivo existe para medir.
 */
export async function registrarRecusa(
  rota: RecusaDeCheckout['rota'],
  motivo: string,
): Promise<void> {
  try {
    await store.unshiftComTeto(
      { ts: new Date().toISOString(), rota, motivo: String(motivo ?? '').slice(0, 160) },
      MAX_ENTRIES,
    );
  } catch (e) {
    console.error('[checkout] não deu para anotar a recusa:', e);
  }
}

export interface ResumoDeRecusas {
  total: number;
  /** A frase mais repetida — é ela que diz o que consertar. */
  motivoMaisComum: string | null;
  /** Quanto do total esse motivo representa, em pontos percentuais. */
  motivoMaisComumPct: number | null;
}

export async function resumirRecusas(janelaHoras: number): Promise<ResumoDeRecusas> {
  const desde = Date.now() - janelaHoras * 3_600_000;
  let todas: RecusaDeCheckout[];
  try {
    todas = await store.getAll();
  } catch {
    // Não dá para contar não é zero recusas — mas aqui o consumidor é um
    // alarme, e um alarme que grita porque não conseguiu ler um arquivo é
    // pior que um alarme calado. O silêncio fica registrado no log acima.
    return { total: 0, motivoMaisComum: null, motivoMaisComumPct: null };
  }
  const naJanela = todas.filter((r) => new Date(r.ts).getTime() >= desde);
  if (naJanela.length === 0) {
    return { total: 0, motivoMaisComum: null, motivoMaisComumPct: null };
  }
  const contagem = new Map<string, number>();
  for (const r of naJanela) contagem.set(r.motivo, (contagem.get(r.motivo) ?? 0) + 1);
  const [motivo, n] = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]!;
  return {
    total: naJanela.length,
    motivoMaisComum: motivo,
    motivoMaisComumPct: Math.round((n / naJanela.length) * 1000) / 10,
  };
}

/** Só para teste: zera o arquivo. */
export async function _limpar(): Promise<void> {
  await store.setAll([]);
}

/**
 * Middleware que anota a recusa lendo a própria resposta.
 *
 * **É um lugar só, e não uma chamada em cada `return`.** As duas rotas de
 * checkout têm mais de dez saídas de erro entre as duas; espalhar a anotação
 * por todas seria repetir a receita de defeito que este projeto já pagou caro
 * — gancho em muitos lugares é gancho que alguém esquece ao acrescentar a
 * décima primeira saída. Aqui a regra é uma: se a rota respondeu erro de
 * cliente, alguém tentou comprar e não conseguiu.
 *
 * Duas faixas ficam de fora, e as duas por não serem o que se quer medir:
 *
 * - **5xx**, porque nas duas rotas a falha do gateway é `502` e ela acontece
 *   **depois** de o pedido existir — ele já vai para `failed` e já é contado
 *   pela outra metade da saúde. Contar aqui também faria o mesmo incidente
 *   aparecer em dobro. Erro de servidor já tem caminho próprio (`recordError`
 *   e Sentry).
 * - **429**, que é o freio de mão do limitador, não uma recusa do conteúdo.
 *   Quem apanha dele é robô ou dedo nervoso, e deixá-lo entrar encheria o
 *   número com o que não é venda perdida.
 */
export function anotarRecusas(rota: RecusaDeCheckout['rota']): MiddlewareHandler {
  return async (c, next) => {
    await next();
    const st = c.res.status;
    if (st < 400 || st >= 500 || st === 429) return;
    try {
      // `clone()` porque o corpo só pode ser lido uma vez — sem ele, a
      // resposta chegaria vazia a quem está comprando.
      const corpo = (await c.res.clone().json()) as { error?: { message?: string } } | null;
      const msg = corpo?.error?.message;
      if (msg) await registrarRecusa(rota, msg);
    } catch {
      // Resposta sem JSON, ou ilegível. Anotar é observabilidade: falhar aqui
      // não pode custar nada a quem está no meio de uma compra.
    }
  };
}
