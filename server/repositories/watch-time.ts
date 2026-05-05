// Tracking de tempo assistido por aula. Cliente envia heartbeats com chunks
// de tempo assistido (em segundos). Agregamos por (userId, lessonId).

import { JsonStore } from '../db/json-store';

export interface WatchTimeEntry {
  userId: string;
  lessonId: string;
  courseId: string;
  totalSeconds: number;
  lastHeartbeatAt: string;
  // Cap de segurança: se o cliente reportar mais que esse total, recusamos
  maxAllowedSeconds: number;
  updatedAt: string;
}

const store = new JsonStore<WatchTimeEntry>('watch-time.json', () => []);

export async function getEntry(
  userId: string,
  lessonId: string,
): Promise<WatchTimeEntry | null> {
  return await store.findOne(
    (e) => e.userId === userId && e.lessonId === lessonId,
  );
}

/** Retorna a última aula visitada pelo usuário (maior lastHeartbeatAt). */
export async function getLastWatchedForUser(
  userId: string,
): Promise<WatchTimeEntry | null> {
  const all = await store.filter((e) => e.userId === userId);
  if (all.length === 0) return null;
  return [...all].sort(
    (a, b) => (b.lastHeartbeatAt > a.lastHeartbeatAt ? 1 : -1),
  )[0]!;
}

export interface AddChunkInput {
  userId: string;
  lessonId: string;
  courseId: string;
  // Quantos segundos foram assistidos no chunk recém-completo
  deltaSeconds: number;
  // Duração total da aula (segurança contra inflar dados)
  lessonDurationSeconds?: number;
}

export async function addChunk(input: AddChunkInput): Promise<WatchTimeEntry> {
  const safeDelta = Math.max(0, Math.min(input.deltaSeconds, 60));
  const cap = input.lessonDurationSeconds
    ? Math.ceil(input.lessonDurationSeconds * 1.5)
    : 60 * 60 * 4; // 4h máximo padrão
  const now = new Date().toISOString();
  const existing = await getEntry(input.userId, input.lessonId);
  if (existing) {
    const next = Math.min(existing.totalSeconds + safeDelta, cap);
    const updated = await store.update(
      (e) => e.userId === input.userId && e.lessonId === input.lessonId,
      (e) => ({
        ...e,
        totalSeconds: next,
        maxAllowedSeconds: cap,
        lastHeartbeatAt: now,
        updatedAt: now,
      }),
    );
    return updated!;
  }
  const entry: WatchTimeEntry = {
    userId: input.userId,
    lessonId: input.lessonId,
    courseId: input.courseId,
    totalSeconds: Math.min(safeDelta, cap),
    maxAllowedSeconds: cap,
    lastHeartbeatAt: now,
    updatedAt: now,
  };
  await store.unshift(entry);
  return entry;
}

export async function listForLesson(lessonId: string): Promise<WatchTimeEntry[]> {
  return await store.filter((e) => e.lessonId === lessonId);
}

export async function listForCourse(courseId: string): Promise<WatchTimeEntry[]> {
  return await store.filter((e) => e.courseId === courseId);
}

export async function listForUser(userId: string): Promise<WatchTimeEntry[]> {
  return await store.filter((e) => e.userId === userId);
}

export async function aggregateLesson(lessonId: string): Promise<{
  lessonId: string;
  uniqueViewers: number;
  totalSeconds: number;
  avgSecondsPerViewer: number;
}> {
  const list = await listForLesson(lessonId);
  const totalSeconds = list.reduce((s, e) => s + e.totalSeconds, 0);
  return {
    lessonId,
    uniqueViewers: list.length,
    totalSeconds,
    avgSecondsPerViewer:
      list.length === 0 ? 0 : Math.round(totalSeconds / list.length),
  };
}

export async function aggregateCourse(courseId: string): Promise<{
  courseId: string;
  totalSeconds: number;
  uniqueLearners: number;
  byLesson: Array<{ lessonId: string; totalSeconds: number; viewers: number }>;
}> {
  const list = await listForCourse(courseId);
  const learners = new Set(list.map((e) => e.userId));
  const byLesson = new Map<string, { total: number; viewers: Set<string> }>();
  for (const e of list) {
    const cur = byLesson.get(e.lessonId) ?? {
      total: 0,
      viewers: new Set<string>(),
    };
    cur.total += e.totalSeconds;
    cur.viewers.add(e.userId);
    byLesson.set(e.lessonId, cur);
  }
  return {
    courseId,
    totalSeconds: list.reduce((s, e) => s + e.totalSeconds, 0),
    uniqueLearners: learners.size,
    byLesson: Array.from(byLesson.entries()).map(([lessonId, v]) => ({
      lessonId,
      totalSeconds: v.total,
      viewers: v.viewers.size,
    })),
  };
}
