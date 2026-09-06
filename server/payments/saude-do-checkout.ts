import * as ordersRepo from './orders-repo';
import type { Order } from './types';

/**
 * A venda está passando?
 *
 * ## O caso que criou este arquivo
 *
 * Entre 3 e 5/set/2026 **toda** compra falhou. A conta do Pagar.me não tinha o
 * produto Checkout habilitado, e cada tentativa voltava com
 * `The checkout payment method is not available for this account`. Foram 14
 * pedidos perdidos, 4 pessoas distintas, com campanha paga rodando — e a
 * detecção foi alguém abrir `/admin/pedidos` por outro motivo, dois dias
 * depois.
 *
 * O botão de testar gateway não pega esse caso, e não é defeito dele: ele lê
 * credencial, e credencial estava boa. "Produto não habilitado" só aparece no
 * ato da cobrança real. **O único sinal que existia era a própria fila de
 * pedidos falhando** — e ninguém a estava olhando.
 *
 * ## O que se mede aqui
 *
 * A taxa de falha das tentativas de checkout numa janela recente, contra um
 * mínimo de tentativas. As duas coisas juntas, porque nenhuma sozinha
 * significa nada:
 *
 * - **Só a taxa** dispara com um único pedido abandonado num dia devagar
 *   (1 de 1 = 100%), e alarme que grita à toa é alarme que se aprende a
 *   ignorar.
 * - **Só a contagem** não distingue "cinco falhas em cinquenta compras", que é
 *   a vida normal de um checkout, de "cinco falhas em cinco".
 *
 * ## O que NÃO é falha
 *
 * `pending` não é falha: boleto e pix vivem em aberto por dias, e contá-los
 * derrubaria a saúde do checkout todo dia às nove da manhã. `canceled` também
 * não — é quase sempre desistência de quem comprou, e desistência é do
 * negócio, não do sistema. Só `failed` conta: é o gateway tendo recusado a
 * criação da cobrança.
 */

export interface SaudeDoCheckout {
  /** Janela olhada, em horas. */
  janelaHoras: number;
  /**
   * Quantas tentativas eram necessárias para medir.
   *
   * Anda junto do resultado porque a frase legível o cita, e ler a constante do
   * módulo faria a mensagem mentir sempre que alguém chamasse com outro limiar.
   */
  minimoDeTentativas: number;
  tentativas: number;
  falhas: number;
  pagos: number;
  /**
   * Percentual de falha, ou `null` quando não houve tentativa suficiente.
   *
   * **`null` não é zero.** Zero diz "mediu e ninguém falhou"; `null` diz "não
   * houve movimento bastante para medir" — e a diferença muda o que quem lê
   * faz em seguida.
   */
  taxaFalhaPct: number | null;
  /** `true` quando a taxa passou do limite com tentativas suficientes. */
  alerta: boolean;
  /**
   * O motivo mais repetido entre as falhas, cru, como o gateway devolveu.
   *
   * É o que transforma "o checkout está falhando" em "a conta do Pagar.me não
   * tem o produto Checkout habilitado". Sem ele, o alerta manda alguém abrir a
   * tela para descobrir o que o alerta já sabia.
   */
  motivoMaisComum: string | null;
  /** Gateways envolvidos nas falhas, para saber se é um só ou todos. */
  gatewaysComFalha: string[];
}

const JANELA_PADRAO_HORAS = 24;
const MINIMO_DE_TENTATIVAS = 5;
const LIMITE_PCT = 50;

/** O texto do evento de falha, sem o ruído de JSON quando dá para evitar. */
function motivoDe(o: Order): string | null {
  const ev = [...o.events].reverse().find((e) => e.status === 'failed');
  const nota = ev?.note?.trim();
  if (!nota) return null;
  // Mensagens de gateway costumam vir dentro de JSON. O que se quer no alerta
  // é a frase, não a estrutura.
  const m = /"message"\s*:\s*"([^"]{5,160})"/.exec(nota);
  return (m?.[1] ?? nota).slice(0, 160);
}

export async function avaliarCheckout(
  opts: { janelaHoras?: number; minimoDeTentativas?: number; limitePct?: number } = {},
): Promise<SaudeDoCheckout> {
  const janelaHoras = opts.janelaHoras ?? JANELA_PADRAO_HORAS;
  const minimo = opts.minimoDeTentativas ?? MINIMO_DE_TENTATIVAS;
  const limite = opts.limitePct ?? LIMITE_PCT;

  const desde = Date.now() - janelaHoras * 3_600_000;
  const todos = await ordersRepo.listAll();
  const naJanela = todos.filter((o) => new Date(o.createdAt).getTime() >= desde);

  const falhados = naJanela.filter((o) => o.status === 'failed');
  const pagos = naJanela.filter((o) => o.status === 'paid').length;
  // Tentativa é pedido que chegou a uma conclusão: pagou ou falhou. O que ainda
  // está em aberto não diz nada sobre a saúde do checkout hoje.
  const tentativas = falhados.length + pagos;

  const contagem = new Map<string, number>();
  for (const o of falhados) {
    const m = motivoDe(o);
    if (m) contagem.set(m, (contagem.get(m) ?? 0) + 1);
  }
  const motivoMaisComum =
    [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const taxaFalhaPct =
    tentativas >= minimo ? Math.round((falhados.length / tentativas) * 1000) / 10 : null;

  return {
    janelaHoras,
    minimoDeTentativas: minimo,
    tentativas,
    falhas: falhados.length,
    pagos,
    taxaFalhaPct,
    alerta: taxaFalhaPct !== null && taxaFalhaPct >= limite,
    motivoMaisComum,
    gatewaysComFalha: [...new Set(falhados.map((o) => o.gatewayProvider))],
  };
}

/** A frase que vai para a tela e para o e-mail. */
export function resumoLegivel(s: SaudeDoCheckout): string {
  if (s.taxaFalhaPct === null) {
    return `Menos de ${s.minimoDeTentativas} tentativas em ${s.janelaHoras}h — sem base para medir.`;
  }
  const base = `${s.taxaFalhaPct}% das ${s.tentativas} tentativas falharam nas últimas ${s.janelaHoras}h (${s.falhas} de ${s.tentativas}).`;
  return s.motivoMaisComum ? `${base} Motivo mais comum: "${s.motivoMaisComum}".` : base;
}
