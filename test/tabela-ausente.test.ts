import { describe, it, expect, beforeEach } from 'vitest';
import { tabelaAusente, _reset } from '../server/db/tabela-ausente';

/**
 * Tabela que ainda não existe cai no JSON, em vez de derrubar a rota.
 *
 * Descoberto no deploy de 27/ago/2026. Produção estava 43 commits atrás, com
 * cinco tabelas pendentes, e o usuário da aplicação (`pco_lms_app`) não tem
 * permissão de DDL — quem cria tabela é `pco_lms_owner`, por outro caminho.
 *
 * O molde copiado por todos os repositórios decide pela **presença de
 * `DATABASE_URL`**, não pela existência da tabela:
 *
 * ```ts
 * const db = getDb();
 * if (db) { const rows = await db.select().from(schema.x); ... }
 * ```
 *
 * Enquanto migração e deploy andam juntos isso nunca aparece. Naquele dia
 * apareceria: cupom, pedido, agendamento, banco de questões e medição
 * estourariam na primeira leitura.
 *
 * `bancoSeTabelaExiste` devolve `null` quando a tabela não existe — o mesmo
 * que o repositório já recebe sem `DATABASE_URL`, então o caminho do JSON
 * assume sozinho e nenhum chamador precisa aprender um caso novo.
 */

beforeEach(() => _reset());

describe('detecção de tabela ausente', () => {
  it('reconhece o código 42P01 do Postgres', () => {
    expect(tabelaAusente({ code: '42P01' })).toBe(true);
  });

  it('reconhece a mensagem, mesmo sem o código', () => {
    expect(tabelaAusente({ message: 'relation "analytics_daily" does not exist' })).toBe(true);
  });

  it('desce pela cadeia de `cause` — o drizzle embrulha o erro do driver', () => {
    const embrulhado = {
      message: 'Failed query',
      cause: { message: 'ops', cause: { code: '42P01' } },
    };
    expect(tabelaAusente(embrulhado)).toBe(true);
  });

  it('não confunde coluna ausente com tabela ausente', () => {
    // 42703 é coluna; quem trata isso é `metaColumnAvailable`, em courses.ts.
    expect(tabelaAusente({ code: '42703', message: 'column "meta" does not exist' })).toBe(false);
  });

  it('não confunde permissão negada com tabela ausente', () => {
    // Este é o caso que NÃO pode virar fallback silencioso: permissão negada
    // com o JSON assumindo esconderia o problema atrás de dado desatualizado.
    expect(
      tabelaAusente({ code: '42501', message: 'permission denied for table users' }),
    ).toBe(false);
  });

  it('banco fora do ar também não é tabela ausente', () => {
    expect(tabelaAusente({ code: 'ECONNREFUSED', message: 'connect ECONNREFUSED' })).toBe(false);
  });

  it('aguenta erro estranho sem quebrar', () => {
    expect(tabelaAusente(null)).toBe(false);
    expect(tabelaAusente(undefined)).toBe(false);
    expect(tabelaAusente('só uma string')).toBe(false);
    // Cadeia circular não pode virar laço infinito.
    const circular: Record<string, unknown> = { message: 'x' };
    circular.cause = circular;
    expect(tabelaAusente(circular)).toBe(false);
  });
});

describe('sem DATABASE_URL o portão devolve null sem consultar nada', () => {
  it('não tenta ir ao banco quando não há banco', async () => {
    // `getDb()` devolve null sem DATABASE_URL, que é o ambiente desta suíte.
    const { bancoSeTabelaExiste } = await import('../server/db/tabela-ausente');
    expect(await bancoSeTabelaExiste('analytics_daily')).toBeNull();
  });
});
