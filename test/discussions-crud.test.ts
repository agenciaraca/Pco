import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let store: typeof import('../server/discussions/store');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-discrud-'));
  process.env.DATA_DIR = tmpDir;
  store = await import('../server/discussions/store');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('discussions/store CRUD', () => {
  it('createComment cria root comment com defaults', async () => {
    const c = await store.createComment({
      lessonId: 'lesson-1',
      courseId: 'course-1',
      authorId: 'u-1',
      authorName: 'Maria',
      authorRole: 'student',
      body: 'Pergunta',
    });
    expect(c.id).toMatch(/^cmt-/);
    expect(c.parentId).toBeNull();
    expect(c.pinned).toBe(false);
    expect(c.hidden).toBe(false);
    expect(c.createdAt).toBe(c.updatedAt);
  });

  it('createComment cria reply com parentId', async () => {
    const root = await store.createComment({
      lessonId: 'lesson-2',
      courseId: 'c-2',
      authorId: 'u-A',
      authorName: 'A',
      authorRole: 'student',
      body: 'root',
    });
    const reply = await store.createComment({
      lessonId: 'lesson-2',
      courseId: 'c-2',
      parentId: root.id,
      authorId: 'u-B',
      authorName: 'B',
      authorRole: 'admin',
      body: 'reply',
    });
    expect(reply.parentId).toBe(root.id);
  });

  it('updateComment altera body + updatedAt', async () => {
    const c = await store.createComment({
      lessonId: 'l-up',
      courseId: 'c-up',
      authorId: 'u',
      authorName: 'U',
      authorRole: 'student',
      body: 'antes',
    });
    // espera ms pra updatedAt mudar
    await new Promise((r) => setTimeout(r, 10));
    const u = await store.updateComment(c.id, { body: 'depois' });
    expect(u!.body).toBe('depois');
    expect(u!.updatedAt > c.updatedAt).toBe(true);
  });

  it('updateComment pinned=true', async () => {
    const c = await store.createComment({
      lessonId: 'l-pin',
      courseId: 'c-pin',
      authorId: 'u',
      authorName: 'U',
      authorRole: 'admin',
      body: 'destacado',
    });
    const p = await store.updateComment(c.id, { pinned: true });
    expect(p!.pinned).toBe(true);
  });

  it('listForLesson hides hidden por default, mostra com includeHidden', async () => {
    await store.createComment({
      lessonId: 'l-hide',
      courseId: 'c-h',
      authorId: 'u-1',
      authorName: 'V',
      authorRole: 'student',
      body: 'visível',
    });
    const spam = await store.createComment({
      lessonId: 'l-hide',
      courseId: 'c-h',
      authorId: 'u-2',
      authorName: 'S',
      authorRole: 'student',
      body: 'spam',
    });
    await store.updateComment(spam.id, { hidden: true });
    const visible = await store.listForLesson('l-hide');
    const all = await store.listForLesson('l-hide', { includeHidden: true });
    expect(visible.length).toBe(1);
    expect(all.length).toBe(2);
  });

  it('listForLesson coloca pinned no topo', async () => {
    const a = await store.createComment({
      lessonId: 'l-order',
      courseId: 'c-o',
      authorId: 'u',
      authorName: 'U',
      authorRole: 'student',
      body: 'a',
    });
    await new Promise((r) => setTimeout(r, 5));
    await store.createComment({
      lessonId: 'l-order',
      courseId: 'c-o',
      authorId: 'u',
      authorName: 'U',
      authorRole: 'student',
      body: 'b',
    });
    await store.updateComment(a.id, { pinned: true });
    const list = await store.listForLesson('l-order');
    expect(list[0]!.id).toBe(a.id);
    expect(list[0]!.pinned).toBe(true);
  });

  it('deleteComment remove + cascade nas replies (parentId === id)', async () => {
    const root = await store.createComment({
      lessonId: 'l-cascade',
      courseId: 'c-cas',
      authorId: 'u',
      authorName: 'U',
      authorRole: 'student',
      body: 'root',
    });
    const reply1 = await store.createComment({
      lessonId: 'l-cascade',
      courseId: 'c-cas',
      parentId: root.id,
      authorId: 'u',
      authorName: 'U',
      authorRole: 'student',
      body: 'reply 1',
    });
    const reply2 = await store.createComment({
      lessonId: 'l-cascade',
      courseId: 'c-cas',
      parentId: root.id,
      authorId: 'u',
      authorName: 'U',
      authorRole: 'student',
      body: 'reply 2',
    });

    expect(await store.deleteComment(root.id)).toBe(true);
    expect(await store.findById(root.id)).toBeNull();
    expect(await store.findById(reply1.id)).toBeNull();
    expect(await store.findById(reply2.id)).toBeNull();
  });

  it('deleteComment retorna false em id inexistente', async () => {
    expect(await store.deleteComment('cmt-nao-existe')).toBe(false);
  });

  it('updateComment em id inexistente retorna null', async () => {
    expect(await store.updateComment('cmt-nao-existe', { body: 'x' })).toBeNull();
  });
});
