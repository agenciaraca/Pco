// Qual gateway cobra cada método de pagamento.
//
// ## O que existia antes
//
//     gw = body.gatewayId ? findById(body.gatewayId) : listActive()[0]
//
// `listActive()[0]` é **o primeiro da lista**, não "o ativo". Os gateways vivem
// num `JsonStore`, a tela não ordena, e nada impede dois estarem ativos ao
// mesmo tempo — foi o que se viu em produção, com Pagar.me e Asaas os dois
// marcados "Ativo" e a tela dizendo, no singular, "apenas o gateway ativo é
// usado". Um recebia todas as vendas; o outro, nenhuma.
//
// E a ordem é pior do que parece: `createGateway` faz `unshift`, então o
// primeiro da lista é o **último cadastrado**. Cadastrar um gateway novo e já
// ativo — para testar, para comparar taxas — tomava na hora todas as vendas da
// escola, sem ninguém ter escolhido, e sem nada na tela dizendo que o
// adquirente tinha mudado.
//
// ## O que existe agora
//
// Uma linha por método, com um principal e um reserva, escolhidos por gente e
// gravados por id. Sem posição, sem ordem de arquivo, sem empate.
//
// ## O reserva não é "tente de novo em outro lugar"
//
// Ele só entra quando é **certo que nenhuma cobrança foi criada** — ver
// `CriouCobranca` em `providers/types.ts`. Requisição que partiu e não voltou
// não autoriza fallback: pode ter chegado, e cobrar de novo em outro gateway
// seria a duplicidade que a chave de repetição da Sandra existe para impedir.

import { JsonStore } from '../db/json-store';
import * as gatewaysRepo from './gateways-repo';
import { getPaymentProvider } from './providers/registry';
import type { PaymentGateway } from './types';
import { METODOS_PAGAMENTO, type MetodoPagamento } from '../../shared/metodos-pagamento';

export interface RotaDeMetodo {
  metodo: MetodoPagamento;
  /** Gateway que cobra este método. `null` = ninguém escolheu ainda. */
  principalId: string | null;
  /** Só entra quando o principal recusa sem criar cobrança. */
  fallbackId: string | null;
}

function vazias(): RotaDeMetodo[] {
  return METODOS_PAGAMENTO.map((metodo) => ({ metodo, principalId: null, fallbackId: null }));
}

const store = new JsonStore<RotaDeMetodo>('payment-routing.json', vazias);

/** Sempre os três métodos, na mesma ordem, mesmo que o arquivo esteja incompleto. */
export async function listarRotas(): Promise<RotaDeMetodo[]> {
  const salvas = await store.getAll();
  return METODOS_PAGAMENTO.map(
    (metodo) => salvas.find((r) => r.metodo === metodo) ?? { metodo, principalId: null, fallbackId: null },
  );
}

export class RotaInvalida extends Error {}

/**
 * Grava a rota de um método.
 *
 * Recusa gateway que não existe e gateway cujo provider **não sabe cobrar
 * aquele método** — é isso que impede mandar boleto para o Stripe, e impede na
 * hora de configurar em vez de na hora de vender. Também recusa principal e
 * reserva iguais: um reserva que é o próprio principal é um reserva que nunca
 * salva ninguém, e dá a impressão contrária a quem lê a tela.
 */
export async function salvarRota(
  metodo: MetodoPagamento,
  entrada: { principalId: string | null; fallbackId: string | null },
): Promise<RotaDeMetodo> {
  const principalId = entrada.principalId || null;
  const fallbackId = entrada.fallbackId || null;

  if (principalId && fallbackId && principalId === fallbackId) {
    throw new RotaInvalida('O reserva não pode ser o mesmo gateway do principal.');
  }
  if (!principalId && fallbackId) {
    throw new RotaInvalida('Sem principal não há do que cair: escolha o principal primeiro.');
  }
  for (const id of [principalId, fallbackId]) {
    if (!id) continue;
    const gw = await gatewaysRepo.findById(id);
    if (!gw) throw new RotaInvalida('Gateway inexistente.');
    const provider = getPaymentProvider(gw.provider);
    if (!provider) {
      throw new RotaInvalida(`"${gw.provider}" registra venda feita fora do sistema — não cobra.`);
    }
    if (!provider.metodosSuportados.includes(metodo)) {
      throw new RotaInvalida(`${gw.displayName} não cobra este método.`);
    }
  }

  const atual = await store.findOne((r) => r.metodo === metodo);
  const nova: RotaDeMetodo = { metodo, principalId, fallbackId };
  if (atual) {
    await store.update((r) => r.metodo === metodo, () => nova);
  } else {
    await store.add(nova);
  }
  return nova;
}

/** O gateway serve para cobrar este método agora? */
function serve(gw: PaymentGateway | null, metodo: MetodoPagamento | undefined): gw is PaymentGateway {
  if (!gw || !gw.active) return false;
  const provider = getPaymentProvider(gw.provider);
  if (!provider) return false;
  return metodo ? provider.metodosSuportados.includes(metodo) : true;
}

/**
 * Os gateways que podem cobrar este método, na ordem em que serão tentados.
 *
 * Sem método — o checkout antigo, que não mandava nenhum — e sem rota gravada,
 * cai no comportamento anterior: os ativos, na ordem do arquivo. **Isso é
 * compatibilidade, não desenho**: enquanto ninguém tiver configurado a tabela,
 * a escola continua vendendo exatamente como vendia. A tela de saúde é que
 * deve cobrar a configuração.
 */
export async function candidatosPara(metodo?: MetodoPagamento): Promise<PaymentGateway[]> {
  const escolhidos: PaymentGateway[] = [];
  if (metodo) {
    const rota = (await listarRotas()).find((r) => r.metodo === metodo);
    for (const id of [rota?.principalId, rota?.fallbackId]) {
      if (!id) continue;
      const gw = await gatewaysRepo.findById(id);
      if (serve(gw, metodo)) escolhidos.push(gw);
    }
    if (escolhidos.length > 0) return escolhidos;
  }
  // Nada configurado: os ativos que sabem cobrar o método pedido.
  const ativos = await gatewaysRepo.listActive();
  return ativos.filter((gw) => serve(gw, metodo));
}

/** A tabela está configurada para este método? Usado pela tela de saúde. */
export async function metodoConfigurado(metodo: MetodoPagamento): Promise<boolean> {
  const rota = (await listarRotas()).find((r) => r.metodo === metodo);
  if (!rota?.principalId) return false;
  return serve(await gatewaysRepo.findById(rota.principalId), metodo);
}
