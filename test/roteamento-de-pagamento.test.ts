import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PaymentProviderError } from '../server/payments/providers/types';
import type { PaymentProviderImpl } from '../server/payments/providers/types';

/**
 * Roteamento por método de pagamento, com principal e reserva.
 *
 * ## O que existia
 *
 *     gw = body.gatewayId ? findById(body.gatewayId) : listActive()[0]
 *
 * `listActive()[0]` é o **primeiro do arquivo**, não "o ativo": os gateways
 * vivem num `JsonStore`, nada impede dois estarem ativos, e a tela dizia — no
 * singular — "apenas o gateway ativo é usado". Em produção, Pagar.me e Asaas
 * estavam os dois "Ativo". E como `createGateway` faz `unshift`, o primeiro da
 * lista é o **último cadastrado**: cadastrar um gateway novo e já ativo tomava,
 * na hora, todas as vendas da escola — sem ninguém ter escolhido nada, e sem
 * nada na tela dizendo que houve troca de adquirente.
 *
 * ## O que estes casos cobram
 *
 * 1. Quem cobra sai da **escolha**, não da posição.
 * 2. O reserva entra quando o principal recusa **sem criar cobrança**.
 * 3. O reserva **não** entra quando a cobrança pode existir. Esta é a que
 *    importa: o contrário é cobrar duas vezes a mesma pessoa, e o projeto já
 *    sabe como isso acontece — o 502 da Sandra vem com `invoiceId`, a fatura
 *    está lá, e reemitir cria a segunda.
 * 4. O método pedido chega ao provider. Sem isso o roteamento seria
 *    decorativo: o gateway certo cobraria no método errado.
 */

let tmpDir: string;
let repo: typeof import('../server/payments/gateways-repo');
let roteamento: typeof import('../server/payments/roteamento');
let cobranca: typeof import('../server/payments/cobranca');
let registry: typeof import('../server/payments/providers/registry');

const chamadas: string[] = [];

/** Um provider que registra quem foi chamado e falha como mandarem. */
function providerDeTeste(
  nome: string,
  falha: null | { criouCobranca: 'nao' | 'talvez' } | 'explode',
): PaymentProviderImpl {
  return {
    metodosSuportados: ['pix', 'boleto', 'credit_card'],
    async createPayment() {
      chamadas.push(nome);
      if (falha === 'explode') throw new Error('socket hang up');
      if (falha) {
        throw new PaymentProviderError('FALHOU', nome + ' recusou', falha.criouCobranca);
      }
      return { externalId: 'ext-' + nome, status: 'pending' as const };
    },
    async parseWebhook() {
      return null;
    },
  };
}

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-rota-'));
  process.env.DATA_DIR = tmpDir;
  repo = await import('../server/payments/gateways-repo');
  roteamento = await import('../server/payments/roteamento');
  cobranca = await import('../server/payments/cobranca');
  registry = await import('../server/payments/providers/registry');
});

afterAll(async () => {
  if (!tmpDir) return;
  const { drenarEscritasPendentes } = await import('../server/db/json-store');
  await drenarEscritasPendentes();
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
});

beforeEach(() => {
  chamadas.length = 0;
  vi.restoreAllMocks();
});

const entrada = {
  amountCents: 10000,
  currency: 'BRL',
  description: 'Curso',
  customerEmail: 'aluno@pco.local',
  metadata: { orderId: 'ord-1' },
};

describe('quem cobra sai da escolha, não da posição no arquivo', () => {
  it('a escolha vence a posição — inclusive contra o último cadastrado', async () => {
    const antigo = await repo.createGateway({
      provider: 'asaas',
      displayName: 'Cadastrado primeiro',
      mode: 'test',
      apiKey: 'x',
      active: true,
    });
    const recente = await repo.createGateway({
      provider: 'mock',
      displayName: 'Cadastrado depois',
      mode: 'test',
      apiKey: 'y',
      active: true,
    });

    // Sem rota vence o primeiro da lista — e `createGateway` faz `unshift`,
    // então o primeiro da lista é o **último cadastrado**. Ou seja: cadastrar
    // um gateway novo e já ativo tomava na hora todas as vendas da escola, sem
    // ninguém ter escolhido nada. É o defeito, medido.
    expect((await roteamento.candidatosPara())[0]!.id).toBe(recente.id);

    // Com rota, quem cobra é quem foi escolhido.
    await roteamento.salvarRota('pix', { principalId: antigo.id, fallbackId: null });
    expect((await roteamento.candidatosPara('pix')).map((g) => g.id)).toEqual([antigo.id]);
  });

  it('gateway que não sabe cobrar o método não pode ser escolhido', async () => {
    // O Stripe deste código manda `payment_method_types[0] = 'card'` fixo.
    // Deixar configurar boleto nele mataria a venda **na hora de vender**, e
    // não na hora de configurar, que é quando alguém está olhando.
    const stripe = await repo.createGateway({
      provider: 'stripe',
      displayName: 'Stripe',
      mode: 'test',
      apiKey: 's',
      active: true,
    });
    await expect(
      roteamento.salvarRota('boleto', { principalId: stripe.id, fallbackId: null }),
    ).rejects.toBeInstanceOf(roteamento.RotaInvalida);
    // E o mesmo gateway é aceito no método que ele cobra.
    await expect(
      roteamento.salvarRota('credit_card', { principalId: stripe.id, fallbackId: null }),
    ).resolves.toMatchObject({ principalId: stripe.id });
  });

  it('o reserva não pode ser o próprio principal', async () => {
    const [gw] = (await repo.listAll()).filter((g) => g.provider === 'mock');
    await expect(
      roteamento.salvarRota('credit_card', { principalId: gw!.id, fallbackId: gw!.id }),
    ).rejects.toBeInstanceOf(roteamento.RotaInvalida);
  });

  it('gateway desativado sai da rota sem precisar reconfigurar nada', async () => {
    // Desativar é a ação que a tela oferece; ela não pede para mexer na rota.
    // A rota gravada continua lá, e o gateway simplesmente deixa de ser
    // candidato — quem cobra passa a ser o reserva, se houver.
    const rota = (await roteamento.listarRotas()).find((r) => r.metodo === 'pix')!;
    const principal = rota.principalId!;
    await repo.updateGateway(principal, { active: false });
    expect((await roteamento.candidatosPara('pix')).some((g) => g.id === principal)).toBe(false);
    await repo.updateGateway(principal, { active: true });
    expect((await roteamento.candidatosPara('pix')).some((g) => g.id === principal)).toBe(true);
  });
});

describe('o reserva só entra quando é certo que nada foi cobrado', () => {
  async function doisGateways() {
    const principal = await repo.createGateway({
      provider: 'pagarme',
      displayName: 'Principal',
      mode: 'test',
      apiKey: 'p',
      active: true,
    });
    const reserva = await repo.createGateway({
      provider: 'asaas',
      displayName: 'Reserva',
      mode: 'test',
      apiKey: 'r',
      active: true,
    });
    // `createGateway` devolve a forma pública, sem credencial. Quem cobra
    // precisa da inteira — é o mesmo objeto que a rota passa adiante.
    return {
      principal: (await repo.findById(principal.id))!,
      reserva: (await repo.findById(reserva.id))!,
    };
  }

  it('principal recusa sem criar cobrança → o reserva cobra', async () => {
    const { principal, reserva } = await doisGateways();
    vi.spyOn(registry, 'getPaymentProvider').mockImplementation((nome) =>
      nome === 'pagarme'
        ? providerDeTeste('principal', { criouCobranca: 'nao' })
        : providerDeTeste('reserva', null),
    );

    const feito = await cobranca.cobrar({
      metodo: 'pix',
      candidatos: [principal, reserva],
      input: entrada,
    });

    expect(chamadas).toEqual(['principal', 'reserva']);
    expect(feito.gateway.id).toBe(reserva.id);
    expect(feito.tentativas).toHaveLength(2);
    expect(feito.tentativas[0]!.ok).toBe(false);
  });

  it('principal pode ter criado a cobrança → NINGUÉM mais é chamado', async () => {
    // O caso caro. `talvez` é o padrão de `PaymentProviderError` justamente
    // para que erro não classificado não autorize retentativa.
    const { principal, reserva } = await doisGateways();
    vi.spyOn(registry, 'getPaymentProvider').mockImplementation((nome) =>
      nome === 'pagarme'
        ? providerDeTeste('principal', { criouCobranca: 'talvez' })
        : providerDeTeste('reserva', null),
    );

    await expect(
      cobranca.cobrar({ metodo: 'pix', candidatos: [principal, reserva], input: entrada }),
    ).rejects.toThrow(/recusou/);
    expect(chamadas, 'o reserva não pode ser chamado').toEqual(['principal']);
  });

  it('erro de rede também não autoriza o reserva — a requisição pode ter chegado', async () => {
    const { principal, reserva } = await doisGateways();
    vi.spyOn(registry, 'getPaymentProvider').mockImplementation((nome) =>
      nome === 'pagarme'
        ? providerDeTeste('principal', 'explode')
        : providerDeTeste('reserva', null),
    );

    await expect(
      cobranca.cobrar({ metodo: 'pix', candidatos: [principal, reserva], input: entrada }),
    ).rejects.toThrow(/socket hang up/);
    expect(chamadas).toEqual(['principal']);
  });

  it('gateway explícito não ganha reserva — quem escolheu, escolheu', async () => {
    const { principal, reserva } = await doisGateways();
    const candidatos = await cobranca.escolherCandidatos({
      metodo: 'pix',
      gatewayExplicito: principal,
    });
    expect(candidatos.map((g) => g.id)).toEqual([principal.id]);
    expect(candidatos.some((g) => g.id === reserva.id)).toBe(false);
  });

  it('o método pedido chega ao provider', async () => {
    // Sem isto o roteamento seria decorativo: o gateway certo receberia a
    // cobrança e cobraria no método errado — foi o que o Asaas fez por meses,
    // cobrando pix por padrão sem ninguém ter escolhido.
    const { principal } = await doisGateways();
    let recebido: string | undefined;
    vi.spyOn(registry, 'getPaymentProvider').mockImplementation(() => ({
      metodosSuportados: ['pix', 'boleto', 'credit_card'],
      async createPayment(_g, _c, input) {
        recebido = input.metodo;
        return { externalId: 'ext', status: 'pending' as const };
      },
      async parseWebhook() {
        return null;
      },
    }));
    await cobranca.cobrar({ metodo: 'boleto', candidatos: [principal], input: entrada });
    expect(recebido).toBe('boleto');
  });
});
