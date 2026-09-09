/**
 * O gateway reserva pode custar a promessa da vitrine — e isso já aconteceu
 * duas vezes.
 *
 * A promessa de parcelamento é o **mínimo** entre os candidatos da rota, e tem
 * de ser: quem cai no reserva não pode descobrir a troca depois de ter
 * decidido comprar. A consequência é que um reserva fraco rebaixa o método
 * inteiro.
 *
 * O par concreto: o Asaas faz 6x no boleto, o Pagar.me faz 1x, e
 * `min(6,1) = 1`. Em 5/set/2026 as três rotas nasceram com o Pagar.me de
 * reserva e o site parou de anunciar o boleto parcelado que a escola vende.
 * Foi desfeito em 6/set. **Voltou em 8/set**, configurado pela tela, e foi
 * medido em produção em 9/set: `teto boleto = 1`.
 *
 * Duas vezes o mesmo prejuízo diz que faltava código, e não atenção — a regra
 * estava escrita na documentação e nada a verificava. Este arquivo é a
 * verificação.
 *
 * **Ele não recusa a configuração**, e isso é deliberado: aceitar menos
 * parcelas para ter um segundo gateway é uma troca legítima e é do dono. O que
 * não pode é a troca acontecer em silêncio.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PARCELAS_MAXIMAS_POR_METODO } from '../shared/parcelamento';

let tmpDir: string;
const DATA_DIR_ORIGINAL = process.env.DATA_DIR;

/** Um gateway cru, no formato do JsonStore. */
function gateway(id: string, provider: string, displayName: string) {
  return {
    id,
    provider,
    displayName,
    mode: 'live',
    active: true,
    apiKey: 'x',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };
}

async function escrever(nome: string, dados: unknown): Promise<void> {
  await fs.writeFile(path.join(tmpDir, nome), JSON.stringify(dados), 'utf8');
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-rota-'));
  process.env.DATA_DIR = tmpDir;
  vi.resetModules();
});

afterEach(async () => {
  if (DATA_DIR_ORIGINAL === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = DATA_DIR_ORIGINAL;
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
  vi.resetModules();
});

describe('o reserva não pode rebaixar a promessa em silêncio', () => {
  it('acusa o par exato que já custou a venda: Asaas 6x com Pagar.me de reserva', async () => {
    await escrever('payment-gateways.json', [
      gateway('gw-asaas', 'asaas', 'Asaas'),
      gateway('gw-pagarme', 'pagarme', 'Pagar.me'),
    ]);
    await escrever('payment-routing.json', [
      { metodo: 'boleto', principalId: 'gw-asaas', fallbackId: 'gw-pagarme' },
    ]);

    const { rebaixamentosDeParcela } = await import('../server/payments/reserva-rebaixa');
    const quedas = await rebaixamentosDeParcela();
    const boleto = quedas.find((q) => q.metodo === 'boleto');

    expect(boleto, 'o rebaixamento do boleto passou batido').toBeTruthy();
    expect(boleto!.comOPrincipal).toBeGreaterThan(boleto!.comOReserva);
    expect(boleto!.reserva).toContain('Pagar.me');
    // E o número tem de ser o real, não um símbolo: é ele que aparece na tela.
    expect(boleto!.comOReserva).toBe(1);
  });

  it('a promessa que ele afirma é a mesma que a vitrine calcula', async () => {
    // Duas contas do mesmo número em lugares diferentes acabam discordando.
    // Este caso amarra o aviso ao que o site de fato anuncia.
    await escrever('payment-gateways.json', [
      gateway('gw-asaas', 'asaas', 'Asaas'),
      gateway('gw-pagarme', 'pagarme', 'Pagar.me'),
    ]);
    await escrever('payment-routing.json', [
      { metodo: 'boleto', principalId: 'gw-asaas', fallbackId: 'gw-pagarme' },
    ]);
    const { rebaixamentosDeParcela } = await import('../server/payments/reserva-rebaixa');
    const { tetoDeParcelas } = await import('../server/payments/condicoes');
    const queda = (await rebaixamentosDeParcela()).find((q) => q.metodo === 'boleto')!;
    expect(await tetoDeParcelas('boleto')).toBe(queda.comOReserva);
  });

  it('sem reserva não há o que avisar — é a configuração correta', async () => {
    await escrever('payment-gateways.json', [gateway('gw-asaas', 'asaas', 'Asaas')]);
    await escrever('payment-routing.json', [{ metodo: 'boleto', principalId: 'gw-asaas' }]);
    const { rebaixamentosDeParcela } = await import('../server/payments/reserva-rebaixa');
    expect(await rebaixamentosDeParcela()).toEqual([]);
    // E a promessa volta ao que a escola vende.
    const { tetoDeParcelas } = await import('../server/payments/condicoes');
    expect(await tetoDeParcelas('boleto')).toBe(PARCELAS_MAXIMAS_POR_METODO.boleto);
  });

  it('reserva que não rebaixa não vira ruído', async () => {
    // No cartão os dois declaram 12x: o mínimo continua sendo o principal, e
    // avisar disso encheria o painel de alarme sem ação nenhuma atrás.
    await escrever('payment-gateways.json', [
      gateway('gw-asaas', 'asaas', 'Asaas'),
      gateway('gw-pagarme', 'pagarme', 'Pagar.me'),
    ]);
    await escrever('payment-routing.json', [
      { metodo: 'credit_card', principalId: 'gw-asaas', fallbackId: 'gw-pagarme' },
    ]);
    const { rebaixamentosDeParcela } = await import('../server/payments/reserva-rebaixa');
    expect(await rebaixamentosDeParcela()).toEqual([]);
  });

  it('o painel de saúde mostra o aviso, com os dois números', async () => {
    await escrever('payment-gateways.json', [
      gateway('gw-asaas', 'asaas', 'Asaas'),
      gateway('gw-pagarme', 'pagarme', 'Pagar.me'),
    ]);
    await escrever('payment-routing.json', [
      { metodo: 'boleto', principalId: 'gw-asaas', fallbackId: 'gw-pagarme' },
    ]);
    const { buildSnapshot } = await import('../server/health/dashboard');
    const snap = await buildSnapshot();
    const check = snap.checks.find((c) => c.id === 'parcelamento');
    expect(check, 'o painel voltou a não perguntar pela promessa').toBeTruthy();
    expect(check!.status).toBe('warn');
    expect(check!.message).toContain('boleto');
    expect(check!.message).toMatch(/\d+x cai para \d+x/);
  });

  it('configuração correta não põe o aviso no painel', async () => {
    await escrever('payment-gateways.json', [gateway('gw-asaas', 'asaas', 'Asaas')]);
    await escrever('payment-routing.json', [{ metodo: 'boleto', principalId: 'gw-asaas' }]);
    const { buildSnapshot } = await import('../server/health/dashboard');
    const snap = await buildSnapshot();
    expect(snap.checks.find((c) => c.id === 'parcelamento')).toBeUndefined();
  });
});
