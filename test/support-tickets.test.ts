import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let support: typeof import('../server/repositories/support');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-sup-'));
  process.env.DATA_DIR = tmpDir;
  // sem DATABASE_URL → cai no JsonStore
  delete process.env.DATABASE_URL;
  support = await import('../server/repositories/support');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('repositories/support', () => {
  it('createTicket gera id + status=open', async () => {
    const t = await support.createTicket({
      studentId: 'st-1',
      subject: 'Não consigo logar',
      category: 'acesso',
      message: 'Erro 500 na home',
    });
    expect(t.id).toMatch(/^t-/);
    expect(t.status).toBe('open');
    expect(t.subject).toBe('Não consigo logar');
    expect(t.studentId).toBe('st-1');
    expect(t.createdAt).toBe(t.updatedAt);
  });

  it('listForStudent retorna apenas do student e ordena desc', async () => {
    await support.createTicket({
      studentId: 'st-A',
      subject: 'A1',
      category: 'duvida_aula',
      message: '',
    });
    await new Promise((r) => setTimeout(r, 5));
    await support.createTicket({
      studentId: 'st-A',
      subject: 'A2',
      category: 'duvida_aula',
      message: '',
    });
    await support.createTicket({
      studentId: 'st-B',
      subject: 'B1',
      category: 'duvida_aula',
      message: '',
    });
    const a = await support.listTicketsForStudent('st-A');
    expect(a.length).toBeGreaterThanOrEqual(2);
    expect(a.every((t) => t.studentId === 'st-A')).toBe(true);
    // mais recente primeiro
    expect(a[0]!.subject).toBe('A2');
  });

  it('updateTicketStatus muda status', async () => {
    const t = await support.createTicket({
      studentId: 'st-up',
      subject: 'Up',
      category: 'acesso',
      message: '',
    });
    // Date tem resolução de 1ms: sem a pausa, criar e atualizar caem no mesmo
    // timestamp em máquina rápida e a comparação estrita falha (flake na CI).
    await new Promise((r) => setTimeout(r, 2));
    const u = await support.updateTicketStatus(t.id, 'resolved');
    expect(u!.status).toBe('resolved');
    expect(u!.updatedAt > t.updatedAt).toBe(true);
  });

  it('updateTicketStatus em id inexistente retorna null', async () => {
    expect(await support.updateTicketStatus('nao-existe', 'closed')).toBeNull();
  });

  it('findTicket retorna ticket por id ou null', async () => {
    const t = await support.createTicket({
      studentId: 'st-f',
      subject: 'F',
      category: 'duvida_aula',
      message: '',
    });
    expect((await support.findTicket(t.id))!.id).toBe(t.id);
    expect(await support.findTicket('xx-nope')).toBeNull();
  });

  it('listAllTickets ordena desc por updatedAt', async () => {
    const all = await support.listAllTickets();
    for (let i = 1; i < all.length; i++) {
      expect(all[i - 1]!.updatedAt >= all[i]!.updatedAt).toBe(true);
    }
  });

  it('createTicket sem studentId usa default', async () => {
    const t = await support.createTicket({
      subject: 'sem student',
      category: 'duvida_aula',
      message: '',
    });
    // não importa qual é o default, só precisa estar setado
    expect(t.studentId).toBeTruthy();
  });
});
