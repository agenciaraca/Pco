// Trilhas de estudo: sequência ordenada de cursos. Admin cria, aluno
// progride. Trilha conclui quando todos os cursos foram concluídos pelo aluno.

import crypto from 'node:crypto';
import { JsonStore } from '../db/json-store';

export interface StudyPath {
  id: string;
  /** Slug único e estável. Usado em URLs públicas. */
  slug: string;
  title: string;
  description: string;
  /** Cor de capa estilo Tailwind gradient (ex: "from-pco-blue to-pco-cyan"). */
  coverColor: string;
  /** Cursos em ordem (precedência: estuda primeiro o courseIds[0]). */
  courseIds: string[];
  /** Trilha aceita matrícula livre? Se false, é apenas curatorial. */
  active: boolean;
  /** Visível no catálogo público? */
  publicVisible: boolean;
  createdAt: string;
  updatedAt: string;
}

const store = new JsonStore<StudyPath>('study-paths.json', () => []);

function newId(): string {
  return `path-${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}

function normalizeSlug(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export class PathError extends Error {
  constructor(
    public code:
      | 'INVALID_SLUG'
      | 'INVALID_TITLE'
      | 'SLUG_TAKEN'
      | 'NOT_FOUND'
      | 'INVALID_COURSES',
    message: string,
  ) {
    super(message);
    this.name = 'PathError';
  }
}

export async function listPaths(): Promise<StudyPath[]> {
  const all = await store.getAll();
  return all
    .slice()
    .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
}

export async function listPublicPaths(): Promise<StudyPath[]> {
  const all = await listPaths();
  return all.filter((p) => p.active && p.publicVisible);
}

export async function findById(id: string): Promise<StudyPath | null> {
  const all = await store.getAll();
  return all.find((p) => p.id === id) ?? null;
}

export async function findBySlug(slug: string): Promise<StudyPath | null> {
  const all = await store.getAll();
  const norm = normalizeSlug(slug);
  return all.find((p) => p.slug === norm) ?? null;
}

export interface CreatePathInput {
  slug: string;
  title: string;
  description?: string;
  coverColor?: string;
  courseIds?: string[];
  active?: boolean;
  publicVisible?: boolean;
}

export async function createPath(input: CreatePathInput): Promise<StudyPath> {
  const slug = normalizeSlug(input.slug);
  if (!slug || slug.length < 2 || slug.length > 60) {
    throw new PathError('INVALID_SLUG', 'Slug deve ter 2-60 caracteres válidos.');
  }
  const title = input.title.trim();
  if (!title || title.length > 160) {
    throw new PathError('INVALID_TITLE', 'Título deve ter 1-160 caracteres.');
  }
  const exists = await findBySlug(slug);
  if (exists) throw new PathError('SLUG_TAKEN', `Slug "${slug}" já existe.`);
  const now = new Date().toISOString();
  const path: StudyPath = {
    id: newId(),
    slug,
    title,
    description: input.description?.trim() ?? '',
    coverColor: input.coverColor ?? 'from-pco-blue to-pco-cyan',
    courseIds: validateCourseIds(input.courseIds ?? []),
    active: input.active ?? true,
    publicVisible: input.publicVisible ?? true,
    createdAt: now,
    updatedAt: now,
  };
  await store.unshift(path);
  return path;
}

export interface UpdatePathInput {
  title?: string;
  description?: string;
  coverColor?: string;
  courseIds?: string[];
  active?: boolean;
  publicVisible?: boolean;
}

export async function updatePath(
  id: string,
  patch: UpdatePathInput,
): Promise<StudyPath> {
  const path = await findById(id);
  if (!path) throw new PathError('NOT_FOUND', 'Trilha não encontrada.');
  const updates: Partial<StudyPath> = {};
  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (!t || t.length > 160) {
      throw new PathError('INVALID_TITLE', 'Título inválido.');
    }
    updates.title = t;
  }
  if (patch.description !== undefined) updates.description = patch.description.trim();
  if (patch.coverColor !== undefined) updates.coverColor = patch.coverColor;
  if (patch.courseIds !== undefined)
    updates.courseIds = validateCourseIds(patch.courseIds);
  if (patch.active !== undefined) updates.active = patch.active;
  if (patch.publicVisible !== undefined) updates.publicVisible = patch.publicVisible;
  updates.updatedAt = new Date().toISOString();
  await store.update((p) => p.id === id, (p) => Object.assign(p, updates));
  return (await findById(id))!;
}

export async function deletePath(id: string): Promise<boolean> {
  const path = await findById(id);
  if (!path) return false;
  await store.modify((arr) => {
    const idx = arr.findIndex((p) => p.id === id);
    if (idx >= 0) arr.splice(idx, 1);
  });
  return true;
}

function validateCourseIds(ids: string[]): string[] {
  if (!Array.isArray(ids)) {
    throw new PathError('INVALID_COURSES', 'courseIds deve ser array.');
  }
  if (ids.length > 30) {
    throw new PathError('INVALID_COURSES', 'Máximo 30 cursos por trilha.');
  }
  const out: string[] = [];
  for (const raw of ids) {
    const s = String(raw).trim();
    if (!s || s.length > 40) {
      throw new PathError('INVALID_COURSES', `courseId inválido: "${raw}".`);
    }
    if (!out.includes(s)) out.push(s);
  }
  return out;
}

/**
 * Calcula progresso do aluno em uma trilha: quantos cursos da trilha
 * o aluno já completou (100% das aulas), e qual é o próximo curso.
 */
export interface PathProgress {
  pathId: string;
  totalCourses: number;
  completedCourses: number;
  /** ID do próximo curso não-concluído na ordem da trilha. Null se concluiu tudo. */
  nextCourseId: string | null;
  /** Trilha 100% concluída. */
  done: boolean;
  /** courseIds com flag completed pra UI. */
  status: { courseId: string; completed: boolean }[];
}

export function computePathProgress(
  path: { id: string; courseIds: string[] },
  completedCourseIds: string[],
): PathProgress {
  const done = new Set(completedCourseIds);
  const status = path.courseIds.map((cid) => ({
    courseId: cid,
    completed: done.has(cid),
  }));
  const completedCount = status.filter((s) => s.completed).length;
  const nextCourseId = status.find((s) => !s.completed)?.courseId ?? null;
  return {
    pathId: path.id,
    totalCourses: path.courseIds.length,
    completedCourses: completedCount,
    nextCourseId,
    done: nextCourseId === null && path.courseIds.length > 0,
    status,
  };
}

export async function _resetForTests(): Promise<void> {
  await store.setAll([]);
}
