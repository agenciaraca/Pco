import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { naoVazio } from './nao-vazio';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let savedSearches: typeof import('../server/saved-searches/store');
let adminNotes: typeof import('../server/admin/notes-store');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-ssn-'));
  process.env.DATA_DIR = tmpDir;
  savedSearches = await import('../server/saved-searches/store');
  adminNotes = await import('../server/admin/notes-store');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('saved-searches/store', () => {
  it('createSearch + listForOwner', async () => {
    const s = await savedSearches.createSearch({
      ownerId: 'a-1',
      ownerEmail: 'admin@x.com',
      scope: 'orders',
      name: 'Pedidos pagos último mês',
      filters: { status: 'paid', period: '30d' },
    });
    expect(s.id).toMatch(/^sv-/);
    const list = await savedSearches.listForOwner('a-1');
    expect(list.some((x) => x.id === s.id)).toBe(true);
  });

  it('listForOwner isola por ownerId', async () => {
    await savedSearches.createSearch({
      ownerId: 'a-A',
      ownerEmail: 'a@x.com',
      scope: 'students',
      name: 'AltaA',
      filters: {},
    });
    await savedSearches.createSearch({
      ownerId: 'a-B',
      ownerEmail: 'b@x.com',
      scope: 'students',
      name: 'AltaB',
      filters: {},
    });
    const a = await savedSearches.listForOwner('a-A');
    expect(naoVazio(a).every((s) => s.ownerId === 'a-A')).toBe(true);
  });

  it('listForOwner filtra por scope', async () => {
    await savedSearches.createSearch({
      ownerId: 'a-S',
      ownerEmail: 'x@x.com',
      scope: 'students',
      name: 'St',
      filters: {},
    });
    await savedSearches.createSearch({
      ownerId: 'a-S',
      ownerEmail: 'x@x.com',
      scope: 'orders',
      name: 'Or',
      filters: {},
    });
    const orders = await savedSearches.listForOwner('a-S', 'orders');
    expect(naoVazio(orders).every((s) => s.scope === 'orders')).toBe(true);
    expect(orders.length).toBeGreaterThan(0);
  });

  it('updateSearch só permite ao owner', async () => {
    const s = await savedSearches.createSearch({
      ownerId: 'a-up',
      ownerEmail: 'up@x.com',
      scope: 'orders',
      name: 'antigo',
      filters: {},
    });
    // Owner correto
    const u = await savedSearches.updateSearch(s.id, 'a-up', { name: 'novo' });
    expect(u!.name).toBe('novo');
    // Owner errado
    const u2 = await savedSearches.updateSearch(s.id, 'outro', {
      name: 'hack',
    });
    expect(u2).toBeNull();
  });

  it('deleteSearch só permite ao owner', async () => {
    const s = await savedSearches.createSearch({
      ownerId: 'a-d',
      ownerEmail: 'd@x.com',
      scope: 'orders',
      name: 'del',
      filters: {},
    });
    expect(await savedSearches.deleteSearch(s.id, 'outro')).toBe(false);
    expect(await savedSearches.deleteSearch(s.id, 'a-d')).toBe(true);
    expect(await savedSearches.deleteSearch(s.id, 'a-d')).toBe(false);
  });

  it('listForOwner ordena alfabeticamente por name', async () => {
    const list = await savedSearches.listForOwner('a-S');
    for (let i = 1; i < list.length; i++) {
      expect(list[i - 1]!.name <= list[i]!.name).toBe(true);
    }
  });
});

describe('admin/notes-store', () => {
  it('createNote + listForStudent', async () => {
    const n = await adminNotes.createNote({
      studentId: 's-1',
      authorId: 'a-1',
      authorEmail: 'admin@x.com',
      body: 'Aluno está com dificuldade no módulo 2',
    });
    expect(n.id).toMatch(/^note-/);
    expect(n.pinned).toBe(false);
    const list = await adminNotes.listForStudent('s-1');
    expect(list.some((x) => x.id === n.id)).toBe(true);
  });

  it('updateNote pin coloca no topo', async () => {
    const a = await adminNotes.createNote({
      studentId: 's-pin',
      authorId: 'a',
      authorEmail: 'a@x.com',
      body: 'A',
    });
    await new Promise((r) => setTimeout(r, 5));
    await adminNotes.createNote({
      studentId: 's-pin',
      authorId: 'a',
      authorEmail: 'a@x.com',
      body: 'B',
    });
    await adminNotes.updateNote(a.id, { pinned: true });
    const list = await adminNotes.listForStudent('s-pin');
    expect(list[0]!.id).toBe(a.id);
    expect(list[0]!.pinned).toBe(true);
  });

  it('updateNote body altera updatedAt', async () => {
    const n = await adminNotes.createNote({
      studentId: 's-up',
      authorId: 'a',
      authorEmail: 'a@x.com',
      body: 'antes',
    });
    await new Promise((r) => setTimeout(r, 10));
    const u = await adminNotes.updateNote(n.id, { body: 'depois' });
    expect(u!.body).toBe('depois');
    expect(u!.updatedAt > n.updatedAt).toBe(true);
  });

  it('listForStudent isola por studentId', async () => {
    await adminNotes.createNote({
      studentId: 's-A',
      authorId: 'a',
      authorEmail: 'x@x.com',
      body: 'A',
    });
    await adminNotes.createNote({
      studentId: 's-B',
      authorId: 'a',
      authorEmail: 'x@x.com',
      body: 'B',
    });
    const a = await adminNotes.listForStudent('s-A');
    expect(naoVazio(a).every((n) => n.studentId === 's-A')).toBe(true);
  });

  it('deleteNote remove + retorna false em segunda', async () => {
    const n = await adminNotes.createNote({
      studentId: 's-del',
      authorId: 'a',
      authorEmail: 'x@x.com',
      body: 'd',
    });
    expect(await adminNotes.deleteNote(n.id)).toBe(true);
    expect(await adminNotes.deleteNote(n.id)).toBe(false);
    expect(await adminNotes.findById(n.id)).toBeNull();
  });

  it('findById retorna null pra inexistente', async () => {
    expect(await adminNotes.findById('note-fake')).toBeNull();
  });
});
