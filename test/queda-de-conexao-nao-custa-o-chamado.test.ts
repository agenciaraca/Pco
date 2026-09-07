/**
 * Queda de conexão com o banco custava o chamado do aluno.
 *
 * Medido no log de produção em 7/set/2026, com 7 quedas de conexão no período:
 * 10 `insert into support_tickets` falharam — aluno escreveu, clicou em enviar
 * e levou erro —, 21 leituras do site público falharam (cursos, posts,
 * certificados), e a primeira linha do log é um `[auto-issue cert] erro ao
 * verificar`: certificado que não foi emitido. As mensagens são
 * `Connection terminated unexpectedly` e `read ETIMEDOUT` — conexão TCP de
 * longa distância derrubada no meio, com o banco remoto. Nada de errado com a
 * consulta, e nenhuma retentativa em lugar nenhum.
 *
 * **A regra é a mesma que este projeto já escreveu para pagamento.** Em
 * `criou-cobranca.ts`, `!res.ok` não provava que a cobrança não fora criada, e
 * repetir gerava cobrança dobrada. Aqui: leitura repete sempre; escrita só
 * repete quando é CERTO que a consulta não saiu. Conexão morta durante um
 * `INSERT` pode ter deixado o commit gravado do outro lado — o que se perdeu
 * foi a resposta.
 *
 * Errar para o lado de não repetir custa uma mensagem que a pessoa refaz à mão.
 * Errar para o outro cria chamado, certificado e matrícula em duplicata — e
 * ninguém vai atrás do que não deu erro.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  ehFalhaDeConexao,
  ehLeitura,
  nadaFoiEnviado,
  podeRepetir,
  instalarRetry,
} from '../server/db/repetir-consulta';

/** As mensagens exatas colhidas do log de produção. */
const QUEDA_NO_MEIO = new Error('Connection terminated unexpectedly');
const TIMEOUT_DE_LEITURA = Object.assign(new Error('read ETIMEDOUT'), {
  code: 'ETIMEDOUT',
});
const NAO_CONSEGUIU_CONECTAR = new Error('Connection terminated due to connection timeout');
const POOL_ESGOTADO = new Error('timeout exceeded when trying to connect');
/** Erro de verdade da consulta: chave duplicada. Nunca deve repetir. */
const CHAVE_DUPLICADA = Object.assign(new Error('duplicate key value'), {
  code: '23505',
});

describe('o que é falha de conexão', () => {
  it('reconhece as mensagens que aparecem no log de produção', () => {
    expect(ehFalhaDeConexao(QUEDA_NO_MEIO)).toBe(true);
    expect(ehFalhaDeConexao(TIMEOUT_DE_LEITURA)).toBe(true);
    expect(ehFalhaDeConexao(NAO_CONSEGUIU_CONECTAR)).toBe(true);
    expect(ehFalhaDeConexao(POOL_ESGOTADO)).toBe(true);
    expect(ehFalhaDeConexao(Object.assign(new Error('x'), { code: '57P01' }))).toBe(true);
  });

  it('e não confunde erro da consulta com queda de rede', () => {
    expect(ehFalhaDeConexao(CHAVE_DUPLICADA)).toBe(false);
    expect(ehFalhaDeConexao(new Error('syntax error at or near'))).toBe(false);
    expect(ehFalhaDeConexao(null)).toBe(false);
  });

  it('só a falha de AQUISIÇÃO prova que a consulta não saiu', () => {
    expect(nadaFoiEnviado(NAO_CONSEGUIU_CONECTAR)).toBe(true);
    expect(nadaFoiEnviado(POOL_ESGOTADO)).toBe(true);
    // Esta é a distinção que separa "repetir" de "gravar duas vezes": a
    // conexão morreu com a consulta já enviada.
    expect(nadaFoiEnviado(QUEDA_NO_MEIO)).toBe(false);
    expect(nadaFoiEnviado(TIMEOUT_DE_LEITURA)).toBe(false);
  });
});

describe('leitura é select, e nada além disso', () => {
  it('reconhece select', () => {
    expect(ehLeitura('select * from courses')).toBe(true);
    expect(ehLeitura('  SELECT 1')).toBe(true);
  });

  it('não trata escrita como leitura', () => {
    for (const sql of [
      'insert into support_tickets values ($1)',
      'update payment_orders set status = $1',
      'delete from users where id = $1',
    ]) {
      expect(ehLeitura(sql), sql).toBe(false);
    }
  });

  it('WITH fica de fora de propósito — a CTE pode terminar em INSERT', () => {
    expect(ehLeitura('with x as (select 1) insert into t select * from x')).toBe(false);
    // E mesmo a CTE inofensiva não passa: o custo de errar aqui é gravar duas
    // vezes, então a checagem é estrita e não esperta.
    expect(ehLeitura('with x as (select 1) select * from x')).toBe(false);
  });
});

describe('quem pode repetir', () => {
  it('leitura repete em qualquer queda de conexão', () => {
    expect(podeRepetir('select * from courses', QUEDA_NO_MEIO)).toBe(true);
    expect(podeRepetir('select * from courses', TIMEOUT_DE_LEITURA)).toBe(true);
  });

  it('ESCRITA NAO repete quando a conexão caiu no meio', () => {
    // A garantia central. O commit pode ter acontecido do outro lado.
    expect(podeRepetir('insert into support_tickets values ($1)', QUEDA_NO_MEIO)).toBe(false);
    expect(podeRepetir('update certificates set status = $1', TIMEOUT_DE_LEITURA)).toBe(false);
  });

  it('escrita repete quando o pool nem entregou conexão', () => {
    expect(podeRepetir('insert into support_tickets values ($1)', POOL_ESGOTADO)).toBe(true);
    expect(podeRepetir('insert into support_tickets values ($1)', NAO_CONSEGUIU_CONECTAR)).toBe(
      true,
    );
  });

  it('erro da consulta nunca repete, nem em leitura', () => {
    expect(podeRepetir('select * from courses', CHAVE_DUPLICADA)).toBe(false);
  });
});

/** Um pool de mentira com o mínimo que o wrapper toca. */
function poolFalso(comportamento: (n: number) => unknown) {
  let chamadas = 0;
  const pool = {
    query: (..._args: unknown[]) => {
      chamadas++;
      const r = comportamento(chamadas);
      return r instanceof Error ? Promise.reject(r) : Promise.resolve(r);
    },
    get chamadas() {
      return chamadas;
    },
  };
  return pool;
}

describe('instalarRetry no pool', () => {
  it('a leitura que cai duas vezes ainda entrega o resultado', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const pool = poolFalso((n) => (n < 3 ? QUEDA_NO_MEIO : { rows: [{ ok: 1 }] }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    instalarRetry(pool as any);
    const r = (await pool.query('select 1')) as { rows: unknown[] };
    expect(r.rows).toHaveLength(1);
    expect(pool.chamadas).toBe(3);
  });

  it('desiste depois das tentativas previstas, em vez de insistir para sempre', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const pool = poolFalso(() => QUEDA_NO_MEIO);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    instalarRetry(pool as any);
    await expect(pool.query('select 1')).rejects.toThrow('Connection terminated');
    expect(pool.chamadas).toBe(3); // a original + duas repetições
  });

  it('o INSERT que caiu no meio é chamado UMA vez, e o erro sobe', async () => {
    const pool = poolFalso(() => QUEDA_NO_MEIO);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    instalarRetry(pool as any);
    await expect(pool.query('insert into support_tickets values ($1)')).rejects.toThrow();
    expect(pool.chamadas).toBe(1);
  });

  it('o INSERT que nem saiu é repetido', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const pool = poolFalso((n) => (n < 2 ? POOL_ESGOTADO : { rows: [] }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    instalarRetry(pool as any);
    await pool.query('insert into support_tickets values ($1)');
    expect(pool.chamadas).toBe(2);
  });

  it('aceita a consulta em forma de objeto, que é como o Drizzle chama', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const pool = poolFalso((n) => (n < 2 ? QUEDA_NO_MEIO : { rows: [] }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    instalarRetry(pool as any);
    await pool.query({ text: 'select 1', values: [] });
    expect(pool.chamadas).toBe(2);
  });

  it('a forma com callback passa direto — embrulhar mudaria o contrato', async () => {
    const pool = poolFalso(() => ({ rows: [] }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    instalarRetry(pool as any);
    const r = pool.query('select 1', [], () => {});
    // Sem promessa de retentativa: o retorno é o do original, e só houve uma
    // chamada.
    expect(pool.chamadas).toBe(1);
    await r;
  });

  it('instalar duas vezes não empilha wrapper', () => {
    const pool = poolFalso(() => ({ rows: [] }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    instalarRetry(pool as any);
    const primeiro = pool.query;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    instalarRetry(pool as any);
    expect(pool.query).toBe(primeiro);
  });
});
