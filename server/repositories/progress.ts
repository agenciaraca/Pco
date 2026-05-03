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
