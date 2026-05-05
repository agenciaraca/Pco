// Wishlist de cursos por aluno. Cada entrada = (userId, courseId, addedAt).
// Idempotente — adicionar de novo é no-op.

import { JsonStore } from '../db/json-store';

export interface WishlistEntry {
  userId: string;
  courseId: string;
  addedAt: string;
}

const store = new JsonStore<WishlistEntry>('course-wishlist.json', () => []);

export async function add(userId: string, courseId: string): Promise<WishlistEntry> {
  const existing = await store.findOne(
    (e) => e.userId === userId && e.courseId === courseId,
  );
  if (existing) return existing;
  const entry: WishlistEntry = {
    userId,
    courseId,
    addedAt: new Date().toISOString(),
  };
  await store.unshift(entry);
  return entry;
}

export async function remove(userId: string, courseId: string): Promise<boolean> {
  const all = await store.getAll();
  const keep = all.filter(
    (e) => !(e.userId === userId && e.courseId === courseId),
  );
  if (keep.length === all.length) return false;
  await store.setAll(keep);
  return true;
}

export async function listForUser(userId: string): Promise<WishlistEntry[]> {
  return await store.filter((e) => e.userId === userId);
}

export interface CourseWishCount {
  courseId: string;
  count: number;
  addedLastWeek: number;
}

export async function aggregateByCourse(): Promise<CourseWishCount[]> {
  const all = await store.getAll();
  const weekAgo = Date.now() - 7 * 24 * 60 * 60_000;
  const counts = new Map<string, { count: number; addedLastWeek: number }>();
  for (const e of all) {
    const cur = counts.get(e.courseId) ?? { count: 0, addedLastWeek: 0 };
    cur.count++;
    if (new Date(e.addedAt).getTime() >= weekAgo) cur.addedLastWeek++;
    counts.set(e.courseId, cur);
  }
  return Array.from(counts.entries())
    .map(([courseId, v]) => ({ courseId, ...v }))
    .sort((a, b) => b.count - a.count);
}

export async function isWished(
  userId: string,
  courseId: string,
): Promise<boolean> {
  const found = await store.findOne(
    (e) => e.userId === userId && e.courseId === courseId,
  );
  return !!found;
}
