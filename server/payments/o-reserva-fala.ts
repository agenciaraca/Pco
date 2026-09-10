// Quando o reserva cobra, o pedido diz que o principal recusou — e por quê.
//
// ## O que acontecia
//
// `cobrar()` monta `tentativas[]` com cada recusa, na ordem, e os **três**
// pontos de checkout faziam
//
//     const { gateway, resultado } = await cobrar(...)
//
// descartando exatamente a informação de que o principal recusou. A venda
// passava, o pedido era reatribuído ao reserva — corretamente, senão o webhook
// não casaria — e **nada em lugar nenhum dizia por quê**.
//
// O dono abriu `/admin/gateways`, viu o Pagar.me como principal do cartão, viu
// as cobranças saindo pelo Asaas, e perguntou por que o sistema "encaminhava".
// O sistema estava certo: o Pagar.me recusa toda cobrança porque a conta não
// tem o produto Checkout habilitado, e o reserva assume. **O produto não sabia
// responder a pergunta**, e a única frase que a responderia —
// `The checkout payment method is not available for this account.` — estava
// dentro de `tentativas[]`, sendo jogada fora.
//
// A frase só aparecia quando **todos** falhavam: aí o `catch` de cada checkout
// gravava `err.message` no pedido. Ou seja, a venda que morre conta o porquê e
// a venda que passa pelo reserva não — que é o inverso do útil, porque a que
// morre alguém percebe.
//
// ## A segunda metade, que a medição achou
//
// Aquele `catch` grava a mensagem **crua**: medido no banco de produção, os
// pedidos falhados de 5 e 6/set carregam
// `{"errors":[{"code":"invalid_object","description":"..."}]}` inteiro dentro
// de `events[].note`.
//
// Isso é o que `providers/ping-http.ts` existe para não fazer, com o motivo
// escrito lá: corpo de erro de gateway traz id de conta e `request-id`, e há
// provedor que ecoa fragmento de credencial em validação malformada — e
// `events` entra no despejo do banco e sobe para um bucket **sem lifecycle**,
// isto é, para sempre. A regra valia para o card do admin e não valia para o
// pedido, que é o lugar em que o dado fica.
//
// Por isso a extração daqui é conservadora: sai a **frase**, não o corpo.

import { ALL_PROVIDERS } from './providers/registry';
import type { TentativaDeCobranca } from './cobranca';
import type { PaymentProvider } from './types';

/** Nome que o dono reconhece na tela. Sem rótulo, o próprio id. */
export function rotuloDoProvider(id: string): string {
  return ALL_PROVIDERS.find((p) => p.id === (id as PaymentProvider))?.label ?? id;
}

/** Só a frase cabe na nota; o resto do corpo é longo e não ajuda a decidir. */
const LIMITE = 180;

/**
 * As chaves em que os gateways deste projeto põem a frase legível.
 *
 * Medido contra o banco de produção: o Pagar.me responde `{"message": "..."}`
 * e o Asaas `{"errors":[{"code":"…","description":"…"}]}`. A busca é
 * recursiva porque a segunda forma aninha, e é por chave conhecida — varrer
 * toda string do corpo traria id de conta e `request-id` junto.
 */
const CHAVES_DE_FRASE = ['message', 'description', 'error_description', 'detail', 'reason'];

/**
 * Parece segredo? Então não atravessa.
 *
 * Duas famílias, e as duas já foram vistas em corpo de erro de gateway: o
 * prefixo declarado (`sk_`, `Bearer …`) e a sequência longa sem espaço, que é
 * a cara de um token ecoado por validação malformada. Frase de gente tem
 * espaço; chave, não.
 *
 * Erra para o lado de calar: perder uma frase custa uma consulta ao log, e o
 * log tem rotação. Gravar uma chave no pedido custa para sempre.
 */
function pareceSegredo(s: string): boolean {
  if (/\b(sk|pk|rk|ak)_[A-Za-z0-9]/.test(s)) return true;
  if (/\bbearer\s+\S/i.test(s)) return true;
  if (/\b(api[_-]?key|secret|password|senha|token|authorization)\b\s*[:=]/i.test(s)) return true;
  return /[A-Za-z0-9+/_-]{24,}/.test(s);
}

function colher(v: unknown, achadas: string[], profundidade = 0): void {
  if (achadas.length >= 2 || profundidade > 4 || v == null) return;
  if (Array.isArray(v)) {
    for (const item of v) colher(item, achadas, profundidade + 1);
    return;
  }
  if (typeof v !== 'object') return;
  for (const [chave, valor] of Object.entries(v as Record<string, unknown>)) {
    if (achadas.length >= 2) return;
    if (typeof valor === 'string' && CHAVES_DE_FRASE.includes(chave)) {
      const limpa = valor.replace(/\s+/g, ' ').trim();
      if (limpa && !pareceSegredo(limpa) && !achadas.includes(limpa)) achadas.push(limpa);
    } else {
      colher(valor, achadas, profundidade + 1);
    }
  }
}

/**
 * A frase que uma pessoa lê, extraída do que o gateway respondeu.
 *
 * `null` quando não há o que mostrar com segurança — e aí quem chama diz que o
 * detalhe está no log, em vez de despejar o corpo.
 */
export function frasePublica(cru: string | undefined | null): string | null {
  if (!cru) return null;
  const texto = String(cru).trim();
  if (!texto) return null;

  const achadas: string[] = [];
  try {
    colher(JSON.parse(texto), achadas);
  } catch {
    // Não é JSON: é mensagem nossa (`Asaas apiKey ausente.`) ou texto do
    // gateway. Vale como frase, sujeita às mesmas travas.
    const limpa = texto.replace(/\s+/g, ' ').trim();
    if (!pareceSegredo(limpa)) achadas.push(limpa);
  }

  if (achadas.length === 0) return null;
  const frase = achadas.join('; ');
  return frase.length > LIMITE ? `${frase.slice(0, LIMITE - 1)}…` : frase;
}

/**
 * O corpo cru vai para o log, com a mesma disciplina do ping.
 *
 * O diagnóstico fino continua existindo — muda de lugar. Log tem rotação;
 * `events` do pedido, não.
 */
export function guardarNoLog(contexto: string, cru: string | undefined | null): void {
  const limpo = String(cru ?? '')
    .slice(0, 500)
    .replace(/\s+/g, ' ')
    .trim();
  if (limpo) console.error(`[checkout] ${contexto}: ${limpo}`);
}

/** Como uma recusa aparece na nota: quem, o código nosso, e a frase. */
function recusaEmTexto(t: TentativaDeCobranca): string {
  const quem = rotuloDoProvider(t.provider);
  const codigo = t.codigo ? ` (${t.codigo})` : '';
  const frase = frasePublica(t.mensagem);
  return frase
    ? `${quem} recusou${codigo}: ${frase}`
    : `${quem} recusou${codigo} — o corpo da resposta está no log do servidor.`;
}

/**
 * A marca que torna a queda no reserva **procurável** depois.
 *
 * É por ela que o painel de saúde conta as vendas que passaram pelo reserva.
 * Contar de outro jeito exigiria comparar o gateway do pedido com o principal
 * da rota **de hoje** — e aí toda venda antiga viraria "caiu no reserva" no
 * dia em que alguém trocasse a configuração, que é justamente quando o painel
 * precisa estar dizendo a verdade.
 */
export const MARCA_DE_RESERVA = '→ cobrado no ';

/** Esta nota registra uma venda que o reserva salvou? */
export function notaDizQueCaiuNoReserva(nota: string | undefined | null): boolean {
  return typeof nota === 'string' && nota.includes(MARCA_DE_RESERVA);
}

/**
 * A nota do histórico do pedido para a cobrança que deu certo.
 *
 * Sem recusa nenhuma, é a frase de sempre: acrescentar "o principal aceitou"
 * em toda venda normal seria ruído em cima do caso comum, e o que se quer
 * enxergar é a exceção.
 */
export function notaDaCobranca(opts: {
  tentativas: TentativaDeCobranca[];
  externalId: string;
  providerQueCobrou: string;
}): string {
  const recusas = opts.tentativas.filter((t) => !t.ok);
  if (recusas.length === 0) return `Gateway respondeu (externalId ${opts.externalId})`;
  const quemCobrou = rotuloDoProvider(opts.providerQueCobrou);
  return (
    `${recusas.map(recusaEmTexto).join(' | ')} ` +
    `${MARCA_DE_RESERVA}${quemCobrou} (externalId ${opts.externalId})`
  );
}

/**
 * A nota do histórico quando nenhum gateway cobrou.
 *
 * Substitui o `err.message` cru que os três checkouts gravavam. Quando houve
 * mais de um candidato, a nota traz **todas** as recusas: era comum o pedido
 * dizer só o que o último respondeu, e o último costuma ser o reserva — a
 * pessoa lia o erro do Asaas sem saber que o Pagar.me tinha recusado antes.
 */
export function notaDaFalha(tentativas: TentativaDeCobranca[], err: unknown): string {
  const recusas = tentativas.filter((t) => !t.ok);
  if (recusas.length > 0) return recusas.map(recusaEmTexto).join(' | ');
  const frase = frasePublica(err instanceof Error ? err.message : String(err));
  return frase ?? 'A cobrança não foi criada. O detalhe está no log do servidor.';
}

/**
 * O reserva cobrou nesta venda?
 *
 * É `true` quando alguém recusou **antes** de a cobrança sair — que é o caso
 * em que a rota configurada não está sendo cumprida, mesmo com a venda
 * passando.
 */
export function caiuNoReserva(tentativas: TentativaDeCobranca[]): boolean {
  return tentativas.some((t) => !t.ok) && tentativas.some((t) => t.ok);
}

export interface ReservaCobrando {
  /** Vendas que o reserva salvou na janela. */
  quedas: number;
  /** Vendas com cobrança criada na janela — a base do percentual. */
  cobrancas: number;
  /** A recusa mais comum, com o nome de quem recusou. É a frase que diz o que consertar. */
  motivoMaisComum: string | null;
}

/**
 * Quantas vendas o reserva salvou numa janela recente.
 *
 * ## Por que isto merece aviso mesmo com a venda passando
 *
 * Cair no reserva é o sistema funcionando — foi para isso que o reserva foi
 * configurado. Mas **toda** venda caindo nele quer dizer que o principal parou
 * de vender, e isso não aparece em lugar nenhum: o pedido é pago, a matrícula
 * sai, o alarme de checkout mede taxa de falha e não vê falha. Foi assim que a
 * conta do Pagar.me passou dias sem o produto Checkout habilitado enquanto o
 * Asaas cobrava tudo, e a pergunta do dono foi "por que o sistema encaminha
 * para o Asaas?".
 *
 * Há ainda um custo que ninguém mede: cada venda no cartão espera a recusa do
 * principal antes de a do reserva sair — medido em produção, ~10 s contra 1–2 s
 * de uma cobrança direta, com a pessoa parada na tela de pagamento.
 *
 * ## O que ele NÃO conta
 *
 * Pedido anterior a esta anotação. A contagem lê a nota do histórico, então o
 * passado que nunca foi anotado não entra — e é melhor assim: a alternativa
 * seria comparar o gateway do pedido com o principal de hoje, e aí trocar a
 * configuração reescreveria a história de todas as vendas antigas.
 */
export function medirQuedasNoReserva(
  pedidos: Array<{ createdAt: string; events?: Array<{ note?: string }> }>,
  janelaHoras = 24,
): ReservaCobrando {
  const desde = Date.now() - janelaHoras * 3_600_000;
  const naJanela = pedidos.filter((o) => new Date(o.createdAt).getTime() >= desde);

  let quedas = 0;
  let cobrancas = 0;
  const contagem = new Map<string, number>();
  for (const o of naJanela) {
    const nota = (o.events ?? [])
      .map((e) => e.note)
      .find((n) => typeof n === 'string' && n.includes('externalId'));
    if (!nota) continue;
    cobrancas++;
    if (!notaDizQueCaiuNoReserva(nota)) continue;
    quedas++;
    const motivo = nota.split(MARCA_DE_RESERVA)[0].trim();
    if (motivo) contagem.set(motivo, (contagem.get(motivo) ?? 0) + 1);
  }

  return {
    quedas,
    cobrancas,
    motivoMaisComum: [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
  };
}
