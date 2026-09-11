import { describe, it, expect, vi, beforeAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * `listTicketsForStudent` e `createTicket` já sabiam ler/gravar o banco
 * quando ele existe (`getDb()`). `listAllTickets`, `findTicket` e
 * `updateTicketStatus` — os três que a TELA DO ADMIN usa — nunca ganharam
 * essa ramificação: liam e escreviam só no `JsonStore`, sempre.
 *
 * Em produção (`DATABASE_URL` definida) o aluno abre o chamado pela rota que
 * grava no banco. `/admin/support/tickets`, que lê por `listAllTickets`,
 * olhava só o JSON — que fica parado nos dois tickets de semente.
 *
 * Relatado pelo dono em 11/set/2026: *"suporte de tickets não aparece os
 * abertos"*. Medido em produção no mesmo dia: **5 chamados reais no
 * Postgres, zero visíveis** na tela — e o botão "Responder"/mudar status
 * também nunca teria alcançado esses 5, porque `findTicket` e
 * `updateTicketStatus` tinham o mesmo buraco.
 *
 * Este teste não sobe um Postgres de verdade (a suíte não tem um à mão —
 * ver `docs/`); ele mocka `getDb()` como os outros testes de banco deste
 * projeto fazem (`test/curso-desativado-nao-congela-aluno.test.ts`), com UM
 * ticket que só existe no "banco" e nunca no JSON. Se as três funções ainda
 * lessem/escrevessem só o JSON, nenhuma o encontraria.
 */

const ticketDoBanco = vi.hoisted(() => ({
  id: 't-db-only',
  studentId: 'st-banco',
  subject: 'Chamado real, só existe no banco',
  category: 'acesso' as const,
  status: 'open' as const,
  message: 'Preciso de ajuda de verdade',
  createdAt: new Date('2026-09-11T10:00:00.000Z'),
  updatedAt: new Date('2026-09-11T10:00:00.000Z'),
}));

const bancoFalso = vi.hoisted(() => {
  let atual = { ...ticketDoBanco };
  function nomeDaTabela(t: object): string {
    const s = Object.getOwnPropertySymbols(t).find((x) => x.description === 'drizzle:Name');
    return s ? String((t as Record<symbol, unknown>)[s]) : '?';
  }
  return {
    select: () => ({
      from: (t: object) => {
        const rows = nomeDaTabela(t) === 'support_tickets' ? [atual] : [];
        return {
          where: () => ({ limit: () => Promise.resolve(rows) }),
          orderBy: () => Promise.resolve(rows),
        };
      },
    }),
    update: () => ({
      set: (patch: Partial<typeof atual>) => ({
        where: () => ({
          returning: () => {
            atual = { ...atual, ...patch };
            return Promise.resolve([atual]);
          },
        }),
      }),
    }),
  };
});

vi.mock('../server/db/client', async () => {
  const real =
    await vi.importActual<typeof import('../server/db/client')>('../server/db/client');
  return { ...real, getDb: () => bancoFalso, hasDb: () => true };
});

let support: typeof import('../server/repositories/support');

beforeAll(async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-sup-banco-'));
  process.env.DATA_DIR = tmpDir;
  // Semente do JSON com um ticket de id DIFERENTE do que só existe no
  // "banco" — é o que prova qual dos dois a função de fato consultou.
  await fs.writeFile(
    path.join(tmpDir, 'support-tickets.json'),
    JSON.stringify(
      [
        {
          id: 't-json-only',
          studentId: 'st-json',
          subject: 'Ticket de semente, só existe no JSON',
          category: 'outro',
          status: 'open',
          message: '',
          createdAt: '2020-01-01T00:00:00.000Z',
          updatedAt: '2020-01-01T00:00:00.000Z',
        },
      ],
      null,
      2,
    ),
    'utf8',
  );
  support = await import('../server/repositories/support');
});

describe('a tela do admin de suporte lê o banco quando ele existe', () => {
  it('listAllTickets traz o ticket do banco, não o de semente do JSON', async () => {
    const todos = await support.listAllTickets();
    expect(todos.map((t) => t.id)).toContain('t-db-only');
    expect(todos.map((t) => t.id)).not.toContain('t-json-only');
  });

  it('findTicket acha o ticket que só existe no banco', async () => {
    const t = await support.findTicket('t-db-only');
    expect(t).not.toBeNull();
    expect(t!.subject).toBe('Chamado real, só existe no banco');
  });

  it('updateTicketStatus muda o status do ticket do banco (o admin consegue responder)', async () => {
    const u = await support.updateTicketStatus('t-db-only', 'resolved');
    expect(u).not.toBeNull();
    expect(u!.status).toBe('resolved');
  });
});
