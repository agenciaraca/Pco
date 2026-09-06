import { describe, it, expect } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { criouCobrancaPeloStatus } from '../server/payments/providers/criou-cobranca';
import { PaymentProviderError } from '../server/payments/providers/types';

/**
 * SEC4-001 · o fallback tratava todo não-2xx como "não criou cobrança".
 *
 * O motor sempre esteve certo: só `PaymentProviderError` com
 * `criouCobranca: 'nao'` autoriza tentar o gateway seguinte, e o padrão do
 * construtor é `'talvez'`. **A falha estava na classificação.** Cinco providers
 * faziam
 *
 * ```ts
 * if (!res.ok) throw new PaymentProviderError(CODE, msg, 'nao');
 * ```
 *
 * com o comentário *"o gateway respondeu recusando: nada foi criado"* — que
 * descreve o 400 e o 422, e não o 500, o 502, o 503, o 504 nem o 429.
 *
 * O caso concreto: o adquirente grava o pedido, o proxy à frente dele estoura o
 * tempo e devolve 502. A cobrança **existe**. Com `'nao'`, o reserva cria a
 * segunda — a duplicidade que o resto do módulo inteiro foi escrito para
 * impedir.
 *
 * ## A assimetria que orienta o arquivo
 *
 * Errar para o lado do `'talvez'` custa uma venda que se refaz com um e-mail.
 * Errar para o lado do `'nao'` custa uma cobrança dobrada, e quem paga o prazo
 * do estorno é o aluno. Por isso qualquer status não classificado é `'talvez'`.
 */

describe('só o 4xx de validação prova que nada foi cobrado', () => {
  it('400 e 422 liberam o próximo gateway', () => {
    // O gateway leu o corpo, recusou e não gravou. É o único caso seguro.
    expect(criouCobrancaPeloStatus(400)).toBe('nao');
    expect(criouCobrancaPeloStatus(422)).toBe('nao');
    expect(criouCobrancaPeloStatus(401)).toBe('nao');
    expect(criouCobrancaPeloStatus(403)).toBe('nao');
    expect(criouCobrancaPeloStatus(404)).toBe('nao');
  });

  it('todo 5xx é "talvez" — é o caso que motivou o conserto', () => {
    for (const s of [500, 501, 502, 503, 504, 599]) {
      expect(criouCobrancaPeloStatus(s), `HTTP ${s} liberou o reserva`).toBe('talvez');
    }
  });

  it('429, 408, 409 e 425 também', () => {
    // 429: alguns gateways limitam **depois** de enfileirar.
    expect(criouCobrancaPeloStatus(429)).toBe('talvez');
    // 408: tempo esgotado do lado de lá — a requisição chegou.
    expect(criouCobrancaPeloStatus(408)).toBe('talvez');
    // 409: quase sempre chave de idempotência já usada, isto é, a cobrança
    // existe. Este é o mais perigoso de classificar como 'nao'.
    expect(criouCobrancaPeloStatus(409)).toBe('talvez');
    // 425 Too Early: repetível pelo cliente ≠ sem efeito.
    expect(criouCobrancaPeloStatus(425)).toBe('talvez');
  });

  it('o que não se classificou não autoriza retentativa', () => {
    // Mesma regra do padrão de `PaymentProviderError`: no caminho do dinheiro,
    // a falha segura é parar.
    expect(criouCobrancaPeloStatus(302)).toBe('talvez');
    expect(criouCobrancaPeloStatus(0)).toBe('talvez');
    expect(criouCobrancaPeloStatus(200)).toBe('talvez');
  });
});

describe('o motor continua exigindo a marca explícita', () => {
  it('o padrão do erro é "talvez"', () => {
    const e = new PaymentProviderError('X', 'y');
    expect(e.criouCobranca).toBe('talvez');
  });
});

describe('nenhum provider volta a marcar "nao" por `!res.ok`', () => {
  /*
    Esta é a guarda contra a regressão, e ela é textual de propósito: o defeito
    original não era um bug de lógica que um caso de teste pegaria — era um
    literal `'nao'` escrito ao lado de um comentário que dizia por que ele
    estaria certo. Só a leitura do arquivo pega isso voltando.
  */
  const PROVIDERS = ['asaas', 'pagarme', 'stripe', 'mercadopago', 'paypal', 'sandra'];

  it('todos os seis classificam pelo status na criação da cobrança', async () => {
    for (const p of PROVIDERS) {
      const s = await fs.readFile(
        path.join(process.cwd(), 'server', 'payments', 'providers', `${p}.ts`),
        'utf8',
      );
      const i = s.indexOf('async createPayment');
      expect(i, `${p}: não achei createPayment`).toBeGreaterThan(0);
      const fim = s.indexOf('\n  async ', i + 10);
      const bloco = s.slice(i, fim > 0 ? fim : undefined);

      // Dentro de `createPayment`, todo `throw` que nasce de uma resposta HTTP
      // tem de passar pelo classificador.
      expect(bloco, `${p}: createPayment não usa criouCobrancaPeloStatus`).toContain(
        'criouCobrancaPeloStatus(',
      );
    }
  });

  it('o `nao` que sobra é o de falha ANTES de a requisição sair', async () => {
    // Credencial ausente, documento inválido, configuração faltando: ali é
    // certo que nada saiu da máquina, e `'nao'` está correto. O teste ancora
    // isso para que ninguém "limpe" esses casos por simetria.
    const s = await fs.readFile(
      path.join(process.cwd(), 'server', 'payments', 'providers', 'asaas.ts'),
      'utf8',
    );
    expect(s).toMatch(/'NO_KEY',[\s\S]{0,80}'nao'/);
  });

  it('o 502 da Sandra continua fora da regra geral, e com o motivo escrito', async () => {
    // Ele vem com `invoiceId`: a fatura EXISTE, dito pelo gateway. Nenhuma
    // classificação por status pode passar por cima disso.
    const s = await fs.readFile(
      path.join(process.cwd(), 'server', 'payments', 'providers', 'sandra.ts'),
      'utf8',
    );
    const i = s.indexOf('SANDRA_GATEWAY_FALHOU');
    expect(i).toBeGreaterThan(0);
    expect(s.slice(i - 300, i)).toContain('r.status === 502 && j.invoiceId');
    // E não leva marca nenhuma: o padrão `'talvez'` é o que se quer.
    expect(s.slice(i, i + 400)).not.toContain("'nao'");
  });
});
