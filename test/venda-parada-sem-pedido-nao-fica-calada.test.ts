import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Hono } from 'hono';

/**
 * A venda pode parar sem criar pedido nenhum — e o alarme era cego para isso.
 *
 * ## O caso
 *
 * Em 7/set/2026 o checkout público passou a exigir data de nascimento e
 * endereço. Quem já tinha visitado o site guardava o script anterior em cache
 * por uma hora, e ele montava o corpo sem os campos novos: a pessoa via os
 * campos na tela, preenchia, clicava em pagar, e levava *"Informe a data de
 * nascimento"* sobre um campo preenchido.
 *
 * **Naquele dia não se criou um pedido sequer.** A validação roda antes de
 * `createOrder`, então a tentativa recusada não existe em `payment_orders` — e
 * `avaliarCheckout` mede taxa de falha sobre pedidos. Com zero pedidos ele
 * calculava `taxaFalhaPct = null`, o painel escrevia "sem base para medir", e
 * o worker `return`ava antes de avisar ninguém.
 *
 * O alarme escrito para o dia em que a venda para enxergava a fila de pedidos
 * **falhando**, e era cego para a fila **parar de encher**.
 *
 * ## O que este arquivo cobra
 *
 * Metade dos casos é sobre **não** alarmar, pela mesma razão do arquivo irmão
 * (`alerta-de-checkout.test.ts`): o risco de um alarme não é ele calar, é ele
 * gritar até virar filtro de caixa de entrada. Recusa acontece todo dia — gente
 * digita CPF errado —, e recusa com a venda passando não é venda parada.
 */

const criados: string[] = [];
let repo: typeof import('../server/payments/orders-repo');
let saude: typeof import('../server/payments/saude-do-checkout');
let recusas: typeof import('../server/payments/recusas-de-checkout');
let worker: typeof import('../server/payments/alerta-checkout-worker');

/*
  `DATA_DIR` novo e registro de módulos novo a cada caso — o `JsonStore` guarda
  a lista em memória por instância, então apagar o arquivo não basta: as
  recusas de um caso vazariam para o seguinte, que é exatamente o que se está
  contando aqui.
*/
beforeEach(async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-recusas-'));
  criados.push(dir);
  process.env.DATA_DIR = dir;
  vi.resetModules();
  repo = await import('../server/payments/orders-repo');
  saude = await import('../server/payments/saude-do-checkout');
  recusas = await import('../server/payments/recusas-de-checkout');
  worker = await import('../server/payments/alerta-checkout-worker');
});

afterAll(async () => {
  const { drenarEscritasPendentes } = await import('../server/db/json-store');
  await drenarEscritasPendentes();
  for (const d of criados) await fs.rm(d, { recursive: true, force: true }).catch(() => {});
});

/** A frase exata que quem estava comprando leu, em 7/set/2026. */
const FRASE_REAL = 'Informe a data de nascimento.';

async function pedidoPago() {
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
    gatewayId: 'gw-asaas',
    gatewayProvider: 'asaas',
    amountCents: 119_980,
    currency: 'BRL',
  });
  await repo.updateStatus(o.id, 'paid');
  return o;
}

describe('a recusa antes do pedido passa a ser contada', () => {
  it('conta, e diz qual frase se repetiu', async () => {
    for (let i = 0; i < 7; i++) await recusas.registrarRecusa('publico', FRASE_REAL);
    await recusas.registrarRecusa('publico', 'O CPF/CNPJ informado não é válido.');

    const r = await recusas.resumirRecusas(24);
    expect(r.total).toBe(8);
    // O número sozinho não diz o que consertar. A frase diz.
    expect(r.motivoMaisComum).toBe(FRASE_REAL);
    expect(r.motivoMaisComumPct).toBe(87.5);
  });

  it('não guarda nada de quem tentou comprar', async () => {
    await recusas.registrarRecusa('publico', FRASE_REAL);
    const arquivo = path.join(process.env.DATA_DIR!, 'checkout-recusas.json');
    const { drenarEscritasPendentes } = await import('../server/db/json-store');
    await drenarEscritasPendentes();
    const linhas = JSON.parse(await fs.readFile(arquivo, 'utf8')) as Record<string, unknown>[];

    // Três campos, e só. Sem IP, sem e-mail, sem nome — é o que mantém isto
    // fora das duas pontas da LGPD sem precisar de categoria nem de rotina.
    expect(Object.keys(linhas[0]!).sort()).toEqual(['motivo', 'rota', 'ts']);
  });

  it('só conta o que está dentro da janela', async () => {
    await recusas.registrarRecusa('publico', FRASE_REAL);
    /*
      `resumirRecusas(0)` calcula `desde = Date.now()` no instante em que RODA
      — não no instante em que a recusa foi registrada, uma linha acima. As
      duas chamadas de `Date.now()` podem cair no mesmo milissegundo (comum em
      CI, onde a máquina é rápida), e aí o registro entra na janela por empate
      em vez de ficar de fora: `total` vira 1 em vez de 0, sem nenhum bug no
      código sob teste. Uma pausa real, maior que a resolução do relógio,
      garante que a recusa fica inequivocamente ANTES do instante medido.
    */
    await new Promise((r) => setTimeout(r, 20));
    const antiga = await recusas.resumirRecusas(0);
    expect(antiga.total).toBe(0);
    // E `null`, não zero com motivo inventado.
    expect(antiga.motivoMaisComum).toBeNull();
  });
});

describe('o dia 7/set: muita recusa e nenhuma venda', () => {
  it('deixa de aparecer como "sem base para medir"', async () => {
    for (let i = 0; i < 6; i++) await recusas.registrarRecusa('publico', FRASE_REAL);

    const s = await saude.avaliarCheckout();
    // Nenhum pedido: é este `null` que calava tudo.
    expect(s.taxaFalhaPct).toBeNull();
    expect(s.alertaDeRecusas).toBe(true);

    const texto = saude.resumoLegivel(s);
    expect(texto).not.toContain('sem base para medir');
    expect(texto).toContain('6 tentativa(s) recusadas');
    expect(texto).toContain(FRASE_REAL);
  });

  it('e o worker manda o aviso, em vez de sair calado', async () => {
    for (let i = 0; i < 6; i++) await recusas.registrarRecusa('publico', FRASE_REAL);

    const r = await worker.checarAgora({ dryRun: true });
    expect(r.saude.alertaDeRecusas).toBe(true);
    // Contra o código anterior isto era `false`: o `taxaFalhaPct === null`
    // devolvia antes de qualquer decisão.
    expect(r.mudou).toBe(true);
  });
});

describe('e fica calado quando recusa é vida normal', () => {
  it('com venda passando na janela, recusa não alarma', async () => {
    for (let i = 0; i < 6; i++) await recusas.registrarRecusa('publico', FRASE_REAL);
    await pedidoPago();

    const s = await saude.avaliarCheckout();
    expect(s.pagos).toBe(1);
    // Gente errando o CPF enquanto outras compram não é a venda parada.
    expect(s.alertaDeRecusas).toBe(false);
  });

  it('pouca recusa não alarma, mesmo sem venda', async () => {
    for (let i = 0; i < 3; i++) await recusas.registrarRecusa('publico', FRASE_REAL);
    const s = await saude.avaliarCheckout();
    expect(s.recusas.total).toBe(3);
    expect(s.alertaDeRecusas).toBe(false);
  });

  it('sem recusa nenhuma, a frase antiga continua valendo', async () => {
    const s = await saude.avaliarCheckout();
    expect(s.alertaDeRecusas).toBe(false);
    expect(saude.resumoLegivel(s)).toContain('sem base para medir');
  });
});

describe('o middleware anota lendo a própria resposta', () => {
  /** Uma rota que responde como as de checkout respondem. */
  function rota(status: number, corpo: unknown) {
    const app = new Hono();
    app.post('/x', recusas.anotarRecusas('publico'), (c) =>
      c.json(corpo as Record<string, unknown>, status as 400),
    );
    return app;
  }

  it('guarda a frase que a pessoa leu, e devolve a resposta inteira', async () => {
    const app = rota(400, { error: { code: 'INVALID_INPUT', message: FRASE_REAL } });
    const res = await app.fetch(new Request('http://local/x', { method: 'POST' }));

    expect(res.status).toBe(400);
    // O corpo não pode ter sido consumido pela leitura do middleware.
    expect(await res.json()).toEqual({
      error: { code: 'INVALID_INPUT', message: FRASE_REAL },
    });
    expect((await recusas.resumirRecusas(24)).motivoMaisComum).toBe(FRASE_REAL);
  });

  it('não conta 2xx', async () => {
    const app = rota(201, { orderId: 'o-1' });
    await app.fetch(new Request('http://local/x', { method: 'POST' }));
    expect((await recusas.resumirRecusas(24)).total).toBe(0);
  });

  it('não conta 5xx — a falha do gateway já é um pedido `failed`', async () => {
    const app = rota(502, { error: { code: 'GATEWAY_FAILED', message: 'Falha ao cobrar.' } });
    await app.fetch(new Request('http://local/x', { method: 'POST' }));
    // Contar aqui faria o mesmo incidente aparecer duas vezes na saúde.
    expect((await recusas.resumirRecusas(24)).total).toBe(0);
  });

  it('não conta 429 — limitador é freio, não recusa de conteúdo', async () => {
    const app = rota(429, { error: { code: 'RATE_LIMITED', message: 'Devagar.' } });
    await app.fetch(new Request('http://local/x', { method: 'POST' }));
    expect((await recusas.resumirRecusas(24)).total).toBe(0);
  });
});
