// Progresso do aluno por aula — persiste em data/lesson-progress.json.

import { JsonStore } from '../db/json-store';

export interface LessonProgress {
  userId: string;
  lessonId: string;
  courseId: string;
  moduleId: string;
  completedAt: string;
}

const store = new JsonStore<LessonProgress>('lesson-progress.json', () => []);

export async function listForUser(userId: string): Promise<LessonProgress[]> {
  return await store.filter((p) => p.userId === userId);
}

export async function getCompletedLessons(userId: string): Promise<string[]> {
  const list = await listForUser(userId);
  return list.map((p) => p.lessonId);
}

/**
 * Quantos dias distintos o aluno teve atividade (completou alguma aula) nos
 * últimos N dias. Usado por achievements.engine como aproximação de streak.
 */
export async function distinctActivityDays(
  userId: string,
  days = 30,
): Promise<number> {
  const list = await listForUser(userId);
  const cutoff = Date.now() - days * 24 * 60 * 60_000;
  const dayKeys = new Set<string>();
  for (const p of list) {
    const t = new Date(p.completedAt).getTime();
    if (t < cutoff) continue;
    dayKeys.add(p.completedAt.slice(0, 10));
  }
  return dayKeys.size;
}

/**
 * Calcula sequência de dias consecutivos (current streak) e o maior streak
 * histórico (longest). "Streak" considera dias COM atividade (completou aula).
 * Tolerância: hoje sem atividade ainda mantém streak de ontem.
 */
export async function streakInfo(
  userId: string,
): Promise<{ current: number; longest: number; lastActiveDay: string | null }> {
  const list = await listForUser(userId);
  if (list.length === 0) return { current: 0, longest: 0, lastActiveDay: null };
  const days = new Set<string>();
  for (const p of list) days.add(p.completedAt.slice(0, 10));
  const sortedDays = Array.from(days).sort();

  // longest streak
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sortedDays) {
    if (prev && isNextDay(prev, d)) run++;
    else run = 1;
    if (run > longest) longest = run;
    prev = d;
  }

  // current streak — conta de hoje pra trás
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 24 * 60 * 60_000).toISOString().slice(0, 10);
  let current = 0;
  let cursor = days.has(today) ? today : days.has(yesterday) ? yesterday : null;
  while (cursor && days.has(cursor)) {
    current++;
    const next = new Date(cursor);
    next.setDate(next.getDate() - 1);
    cursor = next.toISOString().slice(0, 10);
  }

  return {
    current,
    longest,
    lastActiveDay: sortedDays[sortedDays.length - 1] ?? null,
  };
}

function isNextDay(a: string, b: string): boolean {
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  return Math.round((tb - ta) / (24 * 60 * 60_000)) === 1;
}

export async function isCompleted(userId: string, lessonId: string): Promise<boolean> {
  const found = await store.findOne((p) => p.userId === userId && p.lessonId === lessonId);
  return !!found;
}

interface CompleteInput {
  userId: string;
  lessonId: string;
  courseId: string;
  moduleId: string;
}

export async function markCompleted(input: CompleteInput): Promise<LessonProgress> {
  // Idempotente: se já existe, retorna existente
  const existing = await store.findOne(
    (p) => p.userId === input.userId && p.lessonId === input.lessonId,
  );
  if (existing) return existing;
  const entry: LessonProgress = {
    ...input,
    completedAt: new Date().toISOString(),
  };
  await store.unshift(entry);
  return entry;
}

export async function unmarkCompleted(userId: string, lessonId: string): Promise<boolean> {
  return await store.remove((p) => p.userId === userId && p.lessonId === lessonId);
}

export async function listAll(): Promise<LessonProgress[]> {
  return await store.getAll();
}

export async function completionsByDay(days = 7): Promise<Array<{ day: string; count: number }>> {
  const all = await listAll();
  const now = Date.now();
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  const buckets = new Map<string, number>();
  // Inicializa todos os dias com 0
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, 0);
  }
  for (const p of all) {
    const ts = new Date(p.completedAt).getTime();
    if (ts < cutoff) continue;
    const key = p.completedAt.slice(0, 10);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return Array.from(buckets.entries()).map(([day, count]) => ({ day, count }));
}

export async function progressByCourse(
  userId: string,
): Promise<Record<string, { lessonsCompleted: number; lastAt: string | null }>> {
  const all = await listForUser(userId);
  const out: Record<string, { lessonsCompleted: number; lastAt: string | null }> = {};
  for (const p of all) {
    const cur = out[p.courseId] ?? { lessonsCompleted: 0, lastAt: null };
    cur.lessonsCompleted += 1;
    if (!cur.lastAt || p.completedAt > cur.lastAt) cur.lastAt = p.completedAt;
    out[p.courseId] = cur;
  }
  return out;
}

/**
 * Apaga tudo desta pessoa. Usado pelo expurgo de dados (LGPD, art. 18, VI).
 *
 * Devolve quantos registros saíram — o expurgo precisa do número para dizer o
 * que fez, e "0 apagados" é resposta diferente de "não consegui".
 */
export async function clearForUser(userId: string): Promise<number> {
  const all = await store.getAll();
  const remaining = all.filter((x) => x.userId !== userId);
  const removed = all.length - remaining.length;
  if (removed > 0) await store.setAll(remaining);
  return removed;
}
