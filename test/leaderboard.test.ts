import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let tmpDir: string;
let buildLeaderboard: typeof import('../server/activity/leaderboard').buildLeaderboard;
let getUserRank: typeof import('../server/activity/leaderboard').getUserRank;
let progressRepo: typeof import('../server/repositories/progress');
let usersStore: typeof import('../server/auth/users-store');

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ava-pco-lb-'));
  process.env.DATA_DIR = tmpDir;
  process.env.AVA_ENCRYPTION_KEY = 'a'.repeat(64);
  process.env.JWT_SECRET = 'test-secret';

  const mod = await import('../server/activity/leaderboard');
  buildLeaderboard = mod.buildLeaderboard;
  getUserRank = mod.getUserRank;
  progressRepo = await import('../server/repositories/progress');
  usersStore = await import('../server/auth/users-store');

  // Cria 3 alunos
  const u1 = await usersStore.createUser({
    email: 'a1@test.com',
    name: 'Aluno 1',
    role: 'student',
    password: 'pwd-test-12345678',
    active: true,
  });
  const u2 = await usersStore.createUser({
    email: 'a2@test.com',
    name: 'Aluno 2',
    role: 'student',
    password: 'pwd-test-12345678',
    active: true,
  });
  const u3 = await usersStore.createUser({
    email: 'a3@test.com',
    name: 'Aluno 3',
    role: 'student',
    password: 'pwd-test-12345678',
    active: true,
  });

  // Aluno 1: completou 5 aulas em 3 dias diferentes
  for (let i = 0; i < 5; i++) {
    await progressRepo.markCompleted({
      userId: u1.id,
      lessonId: `l${i}`,
      courseId: 'c1',
      moduleId: 'm1',
    });
  }
  // Aluno 2: 2 aulas
  for (let i = 0; i < 2; i++) {
    await progressRepo.markCompleted({
      userId: u2.id,
      lessonId: `l${i + 10}`,
      courseId: 'c1',
      moduleId: 'm1',
    });
  }
  // Aluno 3: 0 aulas

  // Memoriza ids para testes
  (globalThis as any).__lb_u1 = u1.id;
  (globalThis as any).__lb_u2 = u2.id;
  (globalThis as any).__lb_u3 = u3.id;
});

afterAll(async () => {
  if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('buildLeaderboard', () => {
  it('ranqueia por aulas concluídas (peso 10×)', async () => {
    const r = await buildLeaderboard(30);
    expect(r.entries.length).toBeGreaterThanOrEqual(2);
    expect(r.entries[0]!.userName).toBe('Aluno 1');
    expect(r.entries[0]!.rank).toBe(1);
    expect(r.entries[0]!.lessonsCompleted).toBe(5);
    expect(r.entries[1]!.userName).toBe('Aluno 2');
    expect(r.entries[1]!.lessonsCompleted).toBe(2);
  });

  it('exclui alunos sem atividade', async () => {
    const r = await buildLeaderboard(30);
    expect(r.entries.find((e) => e.userName === 'Aluno 3')).toBeUndefined();
  });

  it('respeita limit', async () => {
    const r = await buildLeaderboard(30, 1);
    expect(r.entries.length).toBe(1);
    expect(r.entries[0]!.rank).toBe(1);
  });

  it('clamp days entre 1 e 365', async () => {
    const r = await buildLeaderboard(9999);
    expect(r.range.days).toBe(365);
    const r2 = await buildLeaderboard(0);
    expect(r2.range.days).toBe(1);
  });

  it('score = aulas*10 + dias*5 + cnq*2', async () => {
    const r = await buildLeaderboard(30);
    const a1 = r.entries[0]!;
    // 5 aulas, 1 dia ativo (todas hoje), 0 conquistas → 5*10 + 1*5 = 55
    expect(a1.score).toBe(a1.lessonsCompleted * 10 + a1.activeDays * 5);
  });
});

describe('getUserRank', () => {
  it('retorna posição correta', async () => {
    const u1 = (globalThis as any).__lb_u1 as string;
    const r = await getUserRank(u1, 30);
    expect(r.rank).toBe(1);
    expect(r.entry?.userName).toBe('Aluno 1');
  });

  it('retorna rank=0 para usuário sem atividade', async () => {
    const u3 = (globalThis as any).__lb_u3 as string;
    const r = await getUserRank(u3, 30);
    expect(r.rank).toBe(0);
    expect(r.entry).toBeUndefined();
  });
});
