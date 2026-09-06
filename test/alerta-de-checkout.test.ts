import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * A venda ficou dois dias fora do ar, e a detecção foi alguém abrir uma tela.
 *
 * Entre 3 e 5/set/2026 **toda** compra falhou: a conta do Pagar.me não tinha o
 * produto Checkout habilitado. Foram 14 pedidos perdidos, 4 pessoas distintas,
 * com campanha paga rodando — o dinheiro do anúncio saindo enquanto o funil não
 * fechava. Ninguém soube até alguém abrir `/admin/pedidos` por outro motivo.
 *
 * O botão de testar gateway não pega esse caso, e não é falha dele: ele lê
 * credencial, e a credencial estava boa. "Produto não habilitado" só aparece na
 * cobrança real.
 *
 * ## O que este arquivo cobra, e por que cada coisa
 *
 * O risco de um alarme não é ele não disparar; é ele disparar à toa até virar
 * filtro de caixa de entrada. Por isso metade dos casos aqui é sobre **não**
 * alarmar: pouco movimento não mede, pendente não é falha, e desistência é do
 * negócio.
 */

const criados: string[] = [];
let repo: typeof import('../server/payments/orders-repo');
let saude: typeof import('../server/payments/saude-do-checkout');
let worker: typeof import('../server/payments/alerta-checkout-worker');

/*
  Cada caso ganha um `DATA_DIR` novo **e** um registro de módulos novo.

  Não basta esvaziar o arquivo: o `JsonStore` guarda a lista em memória por
  instância, e o repositório tem a dele. Uma segunda instância apontando para o
  mesmo arquivo não limpa o cache da primeira, e os pedidos de um caso vazariam
  para o seguinte — o medidor lê **todos** os pedidos da janela, então isso
  contamina exatamente o que se está medindo.

  `resetModules` também zera o estado do worker (`ultimoEstado`), que é o que
  faz o "avisa uma vez por episódio" ser testável a partir do zero.
*/
beforeEach(async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-checkout-'));
  criados.push(dir);
  process.env.DATA_DIR = dir;
  vi.resetModules();
  repo = await import('../server/payments/orders-repo');
  saude = await import('../server/payments/saude-do-checkout');
  worker = await import('../server/payments/alerta-checkout-worker');
});

afterAll(async () => {
  const { drenarEscritasPendentes } = await import('../server/db/json-store');
  await drenarEscritasPendentes();
  for (const d of criados) await fs.rm(d, { recursive: true, force: true }).catch(() => {});
});

type Fim = 'paid' | 'failed' | 'canceled' | 'pending';

async function pedido(fim: Fim, nota?: string) {
  const o = await repo.createOrder({
    userId: 'u-1',
    userEmail: 'a@pco.local',
    productId: 'p-1',
    productSnapshot: {
      name: 'Curso',
      priceCents: 119_980,
      currency: 'BRL',
      kind: 'course',
      refId: 'c-1',
    },
    gatewayId: 'gw-pagarme',
    gatewayProvider: 'pagarme',
    amountCents: 119_980,
    currency: 'BRL',
  });
  if (fim !== 'pending') await repo.updateStatus(o.id, fim, nota);
  return o;
}

/** A mensagem real que o Pagar.me devolveu durante o incidente. */
const MOTIVO_REAL =
  '{"errors":[{"message":"The checkout payment method is not available for this account"}]}';

describe('o alarme dispara quando a venda para', () => {
  it('reconhece o incidente de 3–5/set: todas falhando, mesmo motivo', async () => {
    for (let i = 0; i < 9; i++) await pedido('failed', MOTIVO_REAL);
    const s = await saude.avaliarCheckout();

    expect(s.falhas).toBe(9);
    expect(s.taxaFalhaPct).toBe(100);
    expect(s.alerta).toBe(true);
    // O motivo é o que transforma "está falhando" em "é a conta do gateway".
    // Sem ele, o alerta manda alguém abrir a tela para descobrir o que o
    // alerta já sabia.
    expect(s.motivoMaisComum).toContain('checkout payment method is not available');
    expect(s.gatewaysComFalha).toEqual(['pagarme']);
  });

  it('a frase legível traz a base junto do percentual', async () => {
    for (let i = 0; i < 9; i++) await pedido('failed', MOTIVO_REAL);
    const texto = saude.resumoLegivel(await saude.avaliarCheckout());
    // Percentual anda com a base: "100%" sozinho não deixa ninguém desconfiar.
    expect(texto).toContain('100%');
    expect(texto).toContain('9 de 9');
  });
});

describe('e fica calado quando não há base — que é metade do valor dele', () => {
  it('menos de cinco tentativas não medem: `null`, não zero', async () => {
    await pedido('failed', MOTIVO_REAL);
    const s = await saude.avaliarCheckout();
    // Uma pessoa desistindo num domingo é 1 de 1 = 100%. Alarme que grita aí é
    // alarme que se aprende a ignorar — e aí ele não serve no dia que importa.
    expect(s.taxaFalhaPct).toBeNull();
    expect(s.alerta).toBe(false);
    expect(saude.resumoLegivel(s)).toContain('sem base para medir');
  });

  it('pendente não é falha', async () => {
    // Boleto e pix vivem em aberto por dias. Contá-los derrubaria a saúde do
    // checkout todo dia de manhã.
    for (let i = 0; i < 10; i++) await pedido('pending');
    const s = await saude.avaliarCheckout();
    expect(s.tentativas).toBe(0);
    expect(s.taxaFalhaPct).toBeNull();
    expect(s.alerta).toBe(false);
  });

  it('cancelado não é falha do sistema', async () => {
    // Quase sempre é desistência de quem comprou, e desistência é do negócio.
    for (let i = 0; i < 10; i++) await pedido('canceled');
    const s = await saude.avaliarCheckout();
    expect(s.falhas).toBe(0);
    expect(s.tentativas).toBe(0);
  });

  it('uma falha no meio de vendas normais não alarma', async () => {
    for (let i = 0; i < 9; i++) await pedido('paid');
    await pedido('failed', MOTIVO_REAL);
    const s = await saude.avaliarCheckout();
    expect(s.taxaFalhaPct).toBe(10);
    expect(s.alerta).toBe(false);
  });

  it('metade falhando alarma — é o limiar', async () => {
    for (let i = 0; i < 5; i++) await pedido('paid');
    for (let i = 0; i < 5; i++) await pedido('failed', MOTIVO_REAL);
    const s = await saude.avaliarCheckout();
    expect(s.taxaFalhaPct).toBe(50);
    expect(s.alerta).toBe(true);
  });
});

describe('o worker manda um aviso por episódio, não um por tique', () => {
  it('avisa na virada e cala enquanto durar; e avisa de novo quando volta', async () => {
    for (let i = 0; i < 9; i++) await pedido('failed', MOTIVO_REAL);
    const primeira = await worker.checarAgora();
    expect(primeira.mudou, 'a primeira medição ruim tem de avisar').toBe(true);

    // Segunda rodada, mesma condição: vinte e-mails iguais viram filtro de
    // caixa de entrada, e aí o vigésimo primeiro não é lido.
    const segunda = await worker.checarAgora();
    expect(segunda.mudou, 'repetiu o aviso com a condição inalterada').toBe(false);

    // A venda volta.
    for (let i = 0; i < 30; i++) await pedido('paid');
    const volta = await worker.checarAgora();
    // Quem recebeu "a venda está quebrada" precisa saber que voltou, senão
    // fica conferindo à mão — o trabalho que o worker existe para tirar.
    expect(volta.saude.alerta).toBe(false);
    expect(volta.mudou, 'a recuperação também é notícia').toBe(true);
  });

  it('o ensaio mede e não escreve para ninguém — nem move o estado', async () => {
    // Sonda é leitura: se ela avançasse o estado, o alerta de verdade ficaria
    // preso achando que já avisou.
    for (let i = 0; i < 9; i++) await pedido('failed', MOTIVO_REAL);
    const r = await worker.checarAgora({ dryRun: true });
    expect(r.enviados).toBe(0);
    expect(r.saude.alerta).toBe(true);
    expect(worker.getStatus().estado, 'o ensaio moveu o estado do worker').toBeNull();
  });
});

describe('o alerta chega às telas, não só ao e-mail', () => {
  it('a saúde do sistema traz o checkout, e `null` vira "na" e não "ok"', async () => {
    const s = await fs.readFile(
      path.join(process.cwd(), 'server', 'health', 'dashboard.ts'),
      'utf8',
    );
    expect(s).toContain("id: 'checkout'");
    // Pouco movimento não é saúde confirmada. Um verde ali diria que se mediu
    // quando não se mediu — a mesma regra das telas de métrica.
    expect(s).toMatch(/taxaFalhaPct === null \? 'na'/);
  });

  it('o worker está no inventário de jobs e pode ser disparado à mão', async () => {
    const inv = await fs.readFile(
      path.join(process.cwd(), 'server', 'jobs', 'inventario.ts'),
      'utf8',
    );
    expect(inv).toContain("name: 'checkout-alerta'");
    const app = await fs.readFile(path.join(process.cwd(), 'server', 'app.ts'), 'utf8');
    expect(app).toContain("name === 'checkout-alerta'");
  });
});
