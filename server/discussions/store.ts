// Discussões/comentários por aula. Threads simples — apenas nível 0 (comentário) e
// nível 1 (resposta). Não aninhamos profundo.

import crypto from 'node:crypto';
import { JsonStore } from '../db/json-store';

export interface LessonComment {
  id: string;
  lessonId: string;
  courseId: string;
  parentId: string | null; // null = comentário raiz; senão = resposta a outro
  authorId: string;
  authorName: string;
  authorRole: 'student' | 'admin' | 'superadmin';
  body: string;
  pinned: boolean;
  hidden: boolean; // moderado
  createdAt: string;
  updatedAt: string;
}

const store = new JsonStore<LessonComment>('lesson-comments.json', () => []);

function newId(): string {
  return `cmt-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

export async function listForLesson(
  lessonId: string,
  opts: { includeHidden?: boolean } = {},
): Promise<LessonComment[]> {
  const all = await store.filter((c) => c.lessonId === lessonId);
  return all
    .filter((c) => opts.includeHidden || !c.hidden)
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return a.createdAt > b.createdAt ? 1 : -1;
    });
}

export async function findById(id: string): Promise<LessonComment | null> {
  return await store.findOne((c) => c.id === id);
}

export interface CreateCommentInput {
  lessonId: string;
  courseId: string;
  parentId?: string | null;
  authorId: string;
  authorName: string;
  authorRole: 'student' | 'admin' | 'superadmin';
  body: string;
}

export async function createComment(input: CreateCommentInput): Promise<LessonComment> {
  const now = new Date().toISOString();
  const c: LessonComment = {
    id: newId(),
    lessonId: input.lessonId,
    courseId: input.courseId,
    parentId: input.parentId ?? null,
    authorId: input.authorId,
    authorName: input.authorName,
    authorRole: input.authorRole,
    body: input.body,
    pinned: false,
    hidden: false,
    createdAt: now,
    updatedAt: now,
  };
  await store.unshift(c);
  return c;
}

export async function updateComment(
  id: string,
  patch: { body?: string; pinned?: boolean; hidden?: boolean },
): Promise<LessonComment | null> {
  return await store.update(
    (c) => c.id === id,
    (c) => ({
      ...c,
      ...(patch.body !== undefined ? { body: patch.body } : {}),
      ...(patch.pinned !== undefined ? { pinned: patch.pinned } : {}),
      ...(patch.hidden !== undefined ? { hidden: patch.hidden } : {}),
      updatedAt: new Date().toISOString(),
    }),
  );
}

export async function deleteComment(id: string): Promise<boolean> {
  const all = await store.getAll();
  const keep = all.filter((c) => c.id !== id && c.parentId !== id);
  if (keep.length === all.length) return false;
  await store.setAll(keep);
  return true;
}
