// Testa o filtro listAll do discussions store em tmpdir isolado.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let store: typeof import('../server/discussions/store');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-discuss-'));
  process.env.DATA_DIR = tmpDir;
  store = await import('../server/discussions/store');

  // Seed
  await store.createComment({
    lessonId: 'l1',
    courseId: 'c1',
    authorId: 'u1',
    authorName: 'Aluno A',
    authorRole: 'student',
    body: 'Primeiro comentário muito bom',
  });
  const visivelL2 = await store.createComment({
    lessonId: 'l2',
    courseId: 'c2',
    authorId: 'u2',
    authorName: 'Aluno B',
    authorRole: 'student',
    body: 'Outro curso conteúdo',
  });
  const escondido = await store.createComment({
    lessonId: 'l1',
    courseId: 'c1',
    authorId: 'u3',
    authorName: 'Aluno C',
    authorRole: 'student',
    body: 'Spam aqui',
  });
  await store.updateComment(escondido.id, { hidden: true });
  // referência usada para validar listAll por id
  void visivelL2;
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('discussions.listAll', () => {
  it('retorna todos sem filtro', async () => {
    const r = await store.listAll();
    expect(r.length).toBe(3);
  });

  it('filtra por courseId', async () => {
    const r = await store.listAll({ courseId: 'c1' });
    expect(r.length).toBe(2);
    expect(r.every((c) => c.courseId === 'c1')).toBe(true);
  });

  it('filtra por authorId', async () => {
    const r = await store.listAll({ authorId: 'u1' });
    expect(r.length).toBe(1);
    expect(r[0]!.authorName).toBe('Aluno A');
  });

  it('filtra por hidden=true', async () => {
    const r = await store.listAll({ hidden: true });
    expect(r.length).toBe(1);
    expect(r[0]!.body).toBe('Spam aqui');
  });

  it('filtra por hidden=false', async () => {
    const r = await store.listAll({ hidden: false });
    expect(r.length).toBe(2);
    expect(r.every((c) => !c.hidden)).toBe(true);
  });

  it('busca por texto no body', async () => {
    const r = await store.listAll({ search: 'spam' });
    expect(r.length).toBe(1);
    expect(r[0]!.body).toContain('Spam');
  });

  it('respeita limit', async () => {
    const r = await store.listAll({ limit: 2 });
    expect(r.length).toBe(2);
  });

  it('combina filtros', async () => {
    const r = await store.listAll({ courseId: 'c1', hidden: false });
    expect(r.length).toBe(1);
    expect(r[0]!.body).toContain('Primeiro');
  });
});
