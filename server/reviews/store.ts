// Reviews/ratings de cursos. Apenas alunos matriculados podem avaliar.
// Cada aluno tem um único review por curso (upsert).

import crypto from 'node:crypto';
import { JsonStore } from '../db/json-store';

export interface CourseReview {
  id: string;
  courseId: string;
  userId: string;
  userEmail: string;
  userName: string;
  rating: number; // 1..5
  comment?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CourseRatingSummary {
  courseId: string;
  count: number;
  avg: number; // 0..5 (1 casa)
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

const store = new JsonStore<CourseReview>('course-reviews.json', () => []);

function newId(): string {
  return `rev-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

export async function listForCourse(courseId: string): Promise<CourseReview[]> {
  const all = await store.filter((r) => r.courseId === courseId);
  return [...all].sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
}

export async function listAll(): Promise<CourseReview[]> {
  return await store.getAll();
}

export async function findMine(
  courseId: string,
  userId: string,
): Promise<CourseReview | null> {
  return await store.findOne((r) => r.courseId === courseId && r.userId === userId);
}

export async function summary(courseId: string): Promise<CourseRatingSummary> {
  const all = await listForCourse(courseId);
  const dist: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of all) {
    if (r.rating >= 1 && r.rating <= 5) {
      dist[r.rating as 1 | 2 | 3 | 4 | 5]++;
    }
  }
  const sum = all.reduce((s, r) => s + r.rating, 0);
  const avg = all.length === 0 ? 0 : Math.round((sum / all.length) * 10) / 10;
  return { courseId, count: all.length, avg, distribution: dist };
}

export interface UpsertInput {
  courseId: string;
  userId: string;
  userEmail: string;
  userName: string;
  rating: number;
  comment?: string;
}

export async function upsertReview(input: UpsertInput): Promise<CourseReview> {
  if (input.rating < 1 || input.rating > 5) {
    throw new Error('rating deve estar entre 1 e 5');
  }
  const existing = await findMine(input.courseId, input.userId);
  if (existing) {
    const updated = await store.update(
      (r) => r.id === existing.id,
      (r) => ({
        ...r,
        rating: input.rating,
        comment: input.comment,
        updatedAt: new Date().toISOString(),
      }),
    );
    return updated!;
  }
  const now = new Date().toISOString();
  const review: CourseReview = {
    id: newId(),
    courseId: input.courseId,
    userId: input.userId,
    userEmail: input.userEmail,
    userName: input.userName,
    rating: input.rating,
    comment: input.comment,
    createdAt: now,
    updatedAt: now,
  };
  await store.unshift(review);
  return review;
}

export async function deleteReview(id: string): Promise<boolean> {
  const all = await store.getAll();
  const keep = all.filter((r) => r.id !== id);
  if (keep.length === all.length) return false;
  await store.setAll(keep);
  return true;
}

/**
 * Corta o vínculo com a pessoa e mantém a avaliação.
 *
 * Anonimizar em vez de apagar porque a nota **entra na média que os outros
 * leem**: sumir com ela reescreveria um número público por causa de um pedido
 * individual. O expurgo tira o nome e o vínculo; a média fica de pé.
 */
export async function anonimizarParaUsuario(
  userId: string,
  marca: { nome: string },
): Promise<number> {
  const all = await store.getAll();
  let tocados = 0;
  const novos = all.map((x) => {
    if (x.userId !== userId) return x;
    tocados += 1;
    return { ...x, userId: `anon-${x.id}`, userName: marca.nome };
  });
  if (tocados > 0) await store.setAll(novos);
  return tocados;
}
