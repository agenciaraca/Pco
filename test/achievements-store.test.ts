import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { naoVazio } from './nao-vazio';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let store: typeof import('../server/achievements/store');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-achv-'));
  process.env.DATA_DIR = tmpDir;
  store = await import('../server/achievements/store');
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('achievements/store', () => {
  it('BADGES tem 6 itens canônicos', () => {
    expect(Object.keys(store.BADGES).length).toBe(6);
    expect(store.BADGES.first_lesson.icon).toBe('🎯');
    expect(store.BADGES.streak_30.icon).toBe('⚡');
  });

  it('grant cria badge novo', async () => {
    const a = await store.grant('user-1', 'first_lesson');
    expect(a).not.toBeNull();
    expect(a!.userId).toBe('user-1');
    expect(a!.badgeId).toBe('first_lesson');
    expect(a!.awardedAt).toBeDefined();
  });

  it('grant idempotente — segunda chamada retorna null', async () => {
    await store.grant('user-1', 'first_course');
    const second = await store.grant('user-1', 'first_course');
    expect(second).toBeNull();
  });

  it('hasBadge true após grant, false sem grant', async () => {
    expect(await store.hasBadge('user-1', 'first_lesson')).toBe(true);
    expect(await store.hasBadge('user-1', 'streak_7')).toBe(false);
    expect(await store.hasBadge('user-x', 'first_lesson')).toBe(false);
  });

  it('listForUser isola por userId', async () => {
    await store.grant('user-2', 'first_lesson');
    await store.grant('user-2', 'streak_7');
    const u1 = await store.listForUser('user-1');
    const u2 = await store.listForUser('user-2');
    expect(naoVazio(u1).every((b) => b.userId === 'user-1')).toBe(true);
    expect(naoVazio(u2).every((b) => b.userId === 'user-2')).toBe(true);
    expect(u2.length).toBe(2);
  });

  it('listForUser ordena desc por awardedAt', async () => {
    const list = await store.listForUser('user-2');
    for (let i = 1; i < list.length; i++) {
      expect(list[i - 1]!.awardedAt >= list[i]!.awardedAt).toBe(true);
    }
  });

  it('grant com meta opcional', async () => {
    const a = await store.grant('user-meta', 'tutor_helper', {
      conversationCount: 10,
    });
    expect(a!.meta).toEqual({ conversationCount: 10 });
  });

  it('listAll devolve tudo', async () => {
    const all = await store.listAll();
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((b) => b.id.startsWith('bdg-'))).toBe(true);
  });

  it('badges diferentes do mesmo user coexistem', async () => {
    await store.grant('user-3', 'first_lesson');
    await store.grant('user-3', 'streak_7');
    await store.grant('user-3', 'three_courses');
    const list = await store.listForUser('user-3');
    expect(list.length).toBe(3);
    const ids = list.map((b) => b.badgeId).sort();
    expect(ids).toEqual(['first_lesson', 'streak_7', 'three_courses']);
  });
});
